/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Markup = require('telegraf/markup');
const Composer = require('telegraf/composer');
const WizardScene = require('telegraf/scenes/wizard');
const crypto = require('crypto');
const md5 = (data) => crypto.createHash('md5').update(data).digest('hex');

const {Regions} = require('./../vendor');
const {mainMenu} = require('./../utils');

module.exports.addingWizard = new WizardScene('adding-wizard', {},
    new Composer(
        (ctx) => {
            ctx.wizard.state = {};
            ctx.replyWithMarkdown('Введите фамилию имя и отчество (при наличии)\n' +
                '(например: `Иванов Иван Иванович`)');
            return ctx.wizard.next();
        }
    ),

    new Composer(
        Composer.mount('text', (ctx) => {
            ctx.wizard.state.name = ctx.message.text;
            ctx.replyWithMarkdown('Код регистрации или номер документа?', Markup.inlineKeyboard([
                Markup.callbackButton('Код регистрации', 'code'),
                Markup.callbackButton('Номер документа', 'document')
            ]).extra());
            return ctx.wizard.next();
        }),
        () => 0
    ),

    new Composer(
        Composer.action('code', (ctx) => {
            ctx.wizard.state.type = 'code';
            ctx.replyWithMarkdown('Введите код регистрации');
            ctx.wizard.next();
        }),
        Composer.action('document', (ctx) => {
            ctx.wizard.state.type = 'document';
            ctx.replyWithMarkdown('Введите номер документа без серии');
            ctx.wizard.next();
        }),
        () => 0,
    ),

    new Composer(
        Composer.mount('text', (ctx) => {
            let text = ctx.message.text.replace(/[^\d]/g, '');
            if (text.length) {
                ctx.wizard.state.value = text.padStart(12, '0');
                ctx.replyWithMarkdown('Введите номер региона\n' +
                    '`90` - ОУ, находящиеся за пределами РФ');
                return ctx.wizard.next();
            }
        }),
        () => 0
    ),

    new Composer(
        Composer.mount('text', (ctx) => {
            let text = ctx.message.text.replace(/(^0+|[^\d])/g, '');
            if (text.length) {
                ctx.wizard.state.region = text;
                ctx.replyWithMarkdown([
                        `Проверьте введенные данные:`,
                        `ФИО: \`${ctx.wizard.state.name}\``,
                        {
                            code: `Код регистрации: \`${ctx.wizard.state.value}\``,
                            document: `Номер документа (без серии): \`${ctx.wizard.state.value}\``
                        }[ctx.wizard.state.type] || '',
                        `Номер региона: \`${ctx.wizard.state.region}\``,
                        `Регион: \`${Regions[ctx.wizard.state.region]}\``
                    ].join('\n'),
                    Markup.inlineKeyboard([
                        Markup.callbackButton('Продолжить', 'continue'),
                        Markup.callbackButton('Повторить', 'retry'),
                        Markup.callbackButton('Отменить', 'cancel')
                    ]).extra()
                );

                return ctx.wizard.next();
            }
        }),
        () => 0
    ),

    new Composer(
        Composer.action('continue', (ctx) => {
            let user = {
                ...ctx.wizard.state,
                data: {
                    Hash: md5(
                        ctx.wizard.state.name
                            .toLowerCase()
                            .replace(/[^a-zA-Zа-яА-ЯЁё]+/g, '')
                            .replace(/ё/g, 'е')
                            .replace(/й/g, 'и')
                    ),
                    Code: ctx.wizard.state.type === 'code' ? ctx.wizard.state.value : null,
                    Document: ctx.wizard.state.type === 'document' ? ctx.wizard.state.value : null,
                    Region: ctx.wizard.state.region,
                },
                id: +Date.now()
            };

            ctx.session.participants = {
                ...ctx.session.participants,
                [user.id]: user
            };

            ctx.reply('Участник ЕГЭ добавлен', Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
            return ctx.scene.leave();
        }),
        Composer.action('retry', (ctx) => {
            ctx.wizard.state = {};
            ctx.replyWithMarkdown('Введите фамилию имя и отчество (при наличии) (например: `Иванов Иван Иванович`)');
            ctx.wizard.selectStep(1);
        }),
        Composer.action('cancel', (ctx) => {
            ctx.reply('Выберите любую опцию', Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
            return ctx.scene.leave();
        }),
        () => 0,
    )
);