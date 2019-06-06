/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Markup = require('telegraf/markup');
const Composer = require('telegraf/composer');
const WizardScene = require('telegraf/scenes/wizard');

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const {URLSearchParams} = require('url');
const yaml = require('js-yaml');

const {mainMenu, formatExams} = require('./../utils');

function reqTimeout(timeout) {
    const controller = new AbortController();
    return {
        controller,
        timeout: setTimeout(
            () => controller.abort(),
            timeout,
        ),
        param: {signal: controller.signal},
    };
}

const refreshCaptcha = async (ctx) => {
    if (ctx.wizard.state.user.cookie)
        return await checkExam(ctx);

    delete ctx.wizard.state.token;
    delete ctx.wizard.state.captcha;

    const timeout = reqTimeout(5000);
    await fetch('http://check.ege.edu.ru/api/captcha', timeout.param)
        .then((res) => res.json())
        .then((data) => {
            ctx.wizard.state.token = data.Token;
            ctx.replyWithPhoto({
                source: Buffer.from(data.Image, 'base64')
            }, Markup.inlineKeyboard([
                Markup.callbackButton('Обновить', 'refresh'),
                Markup.callbackButton('Отмена', 'cancel'),
            ]).extra());
        }).catch((err) => {
            if (err.name === 'AbortError')
                ctx.replyWithMarkdown('`check.ege.edu.ru` не отвечает :(',
                    Markup.inlineKeyboard([
                        Markup.callbackButton('Повторить', 'refresh'),
                        Markup.callbackButton('Отмена', 'cancel'),
                    ]).extra())
        }).finally(() => clearTimeout(timeout.timeout));
};

const checkExam = async (ctx) => {
    if (!ctx.wizard.state.user.cookie)
        return await refreshCaptcha(ctx);

    ctx.reply('Проверяем...');
    const timeout = reqTimeout(5000);
    await fetch('http://check.ege.edu.ru/api/exam', {
        ...timeout.param,
        headers: {
            cookie: ctx.wizard.state.user.cookie
        }
    })
        .then((res) => res.json())
        .then(async (data) => {
            let header = [
                `\`${ctx.wizard.state.user.name}\``,
                `Регион \`${ctx.wizard.state.user.region}\`, `
                + (ctx.wizard.state.user.type === 'code' ? 'код' : 'док. ')
                + ` \`${ctx.wizard.state.user.value}\``,
            ].join('\n') + '\n\n';

            if (data.Message === "Authorization has been denied for this request.") {
                delete ctx.wizard.state.user.cookie;
                delete (ctx.session.participants[ctx.wizard.state.user.id] || {}).cookie;

                if (ctx.session.raw)
                    ctx.replyWithMarkdown(
                        header + '```\n' + yaml.safeDump(data) + '\n```',
                        Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
                else
                    return await login(ctx);
            }

            // ctx.replyWithDocument({
            //     source: Buffer.of(yaml.safeDump(data)),
            //     filename: 'advanced.yaml'
            // });

            if (ctx.session.raw)
                ctx.replyWithMarkdown(
                    header + '```\n' + yaml.safeDump(data) + '\n```',
                    Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
            else {
                const timeout = reqTimeout(5000);
                // ctx.wizard.state.user.hasResults = await Promise.all(data.Result.Exams
                //     .map((exam) => (ctx.wizard.state.user.hasResults || {})[exam.ExamId]
                //         ? exam.ExamId : fetch(`http://check.ege.edu.ru/api/exam/${exam.ExamId}`, {
                //             ...timeout.param,
                //             headers: {
                //                 cookie: ctx.wizard.state.user.cookie
                //             }
                //         }).then(({ok}) => ok ? exam.ExamId : null).catch(() => null)))
                //     .then((has) => has.reduce((has, id) => id !== null ? {...has, [id]: true} : has, {}))
                //     .finally(() => clearTimeout(timeout.timeout));

                ctx.replyWithMarkdown(header
                    + formatExams(data.Result.Exams.map((exam) => ({
                        ...exam,
                        _HasResult: true //(ctx.wizard.state.user.hasResults | {})[exam.ExamId]
                    })))
                    + '\n\n\\* Результаты откроются после входа на http://check.ege.edu.ru',
                    Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
            }

            return await ctx.scene.leave();
        }).catch((err) => {
            if (err.name === 'AbortError')
                ctx.replyWithMarkdown('`check.ege.edu.ru` не отвечает :(',
                    Markup.inlineKeyboard([
                        Markup.callbackButton('Повторить', 'check'),
                        Markup.callbackButton('Отмена', 'cancel'),
                    ]).extra())
        }).finally(() => clearTimeout(timeout.timeout));
};

const login = async (ctx) => {
    if (ctx.wizard.state.user.cookie)
        return await checkExam(ctx);

    if (!ctx.wizard.state.token)
        return await refreshCaptcha(ctx);

    if (!ctx.wizard.state.captcha)
        return;

    let params = new URLSearchParams();

    for (let i in ctx.wizard.state.user.data)
        if (ctx.wizard.state.user.data.hasOwnProperty(i))
            params.append(i, ctx.wizard.state.user.data[i] || '');

    params.append('Captcha', ctx.wizard.state.captcha);
    params.append('Token', ctx.wizard.state.token);

    delete ctx.wizard.state.captcha;
    delete ctx.wizard.state.token;

    const timeout = reqTimeout(5000);
    await fetch('http://check.ege.edu.ru/api/participant/login', {
        ...timeout.param,
        method: 'POST',
        body: params
    })
        .then(async (res) => {
            let text = await res.text();
            if (res.ok) {
                let headers = res.headers.get('set-cookie');
                ctx.wizard.state.user.cookie = headers.replace(/(^\s*|^.*;\s*)(Participant=[^\s;]+)(\s|;).*$/g, '$2');
                ctx.session.participants[ctx.wizard.state.user.id] = ctx.wizard.state.user;
                await checkExam(ctx);
            } else if (text.trim() === '"Пожалуйста, проверьте правильность введённого кода с картинки"') {
                return await refreshCaptcha(ctx);
            } else {
                ctx.reply(text.trim(), Markup.inlineKeyboard([
                    Markup.callbackButton('Повторить', 'refresh'),
                    Markup.callbackButton('Отмена', 'cancel'),
                ]).extra());
            }
        }).catch((err) => {
            if (err.name === 'AbortError')
                ctx.replyWithMarkdown('`check.ege.edu.ru` не отвечает :(',
                    Markup.inlineKeyboard([
                        Markup.callbackButton('Повторить', 'login'),
                        Markup.callbackButton('Отмена', 'cancel'),
                    ]).extra())
        }).finally(() => clearTimeout(timeout.timeout));
};

module.exports.checkingWizard = new WizardScene('checking-wizard', {},
    new Composer(
        Composer.action(/check\s(\d+)/, async (ctx) => {
            ctx.wizard.state.user = (ctx.session.participants || {})[ctx.match[1]];
            if (!ctx.wizard.state.user) {
                ctx.reply('Выберите любую опцию', Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
                return await ctx.scene.leave();
            }
            await checkExam(ctx);
        }),
        Composer.action('check', checkExam),
        Composer.action('refresh', refreshCaptcha),
        Composer.action('login', login),
        Composer.action('cancel', (ctx) => {
            ctx.reply('Выберите любую опцию', Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
            return ctx.scene.leave();
        }),
        Composer.mount('text', async (ctx) => {
            let text = ctx.message.text.replace(/[^\d]/g, '');
            if (text.length) {
                ctx.wizard.state.captcha = text;
                await login(ctx);
            }
        }),
        () => 0,
    )
);
