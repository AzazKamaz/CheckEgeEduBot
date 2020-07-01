/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');

const Keyv = require('keyv');
const Intl = require("intl");

const {checkExam} = require('./examapi');
const locale = require('./locale');

const examMarkup = data => Markup.inlineKeyboard([Markup.callbackButton(locale.updateBtn, data)]);

const ruDate = new Intl.DateTimeFormat('ru-RU', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZone: 'UTC',
});

module.exports = class CheckBot extends Telegraf {
    constructor() {
        super(...arguments);

        // Use redis connection or in-memory storage
        this.keyv = new Keyv(process.env.REDISCLOUD_URL || '');

        this.catch((e) => {
            console.log(e);
        });
        this.mount();
    }

    mount() {
        this.start((ctx) => ctx.reply(locale.start, Extra.markdown(true)));
        this.help((ctx) => ctx.reply(locale.help, Extra.markdown(true)));

        this.command("/cookie", async ctx => {
            const cookie = (ctx.message.text.match(/(^|\s)Participant=([0-9A-F]{200})(\s|$)/) || [])[2];
            if (!cookie)
                return await ctx.reply(locale.cookieCmd, Extra.markdown(true));

            const key = `${ctx.message.chat.id}:${ctx.message.message_id}`;
            const cbdata = {key, time: 0};
            await this.keyv.set(key, cookie);
            await ctx.reply(locale.initRes, Extra.inReplyTo(ctx.message.message_id).markup(examMarkup(JSON.stringify(cbdata))));
        });

        this.on('callback_query', async (ctx, next) => {
            if (Date.UTC(2020, 5, 29) < ctx.update.callback_query.message.date * 1e3) await next();
            else await ctx.answerCbQuery(locale.unsupportedMsg, true);
        });

        this.on('callback_query', async (ctx, next) => {
            const date = new Date(ctx.update.callback_query.message.date * 1e3);
            const now = new Date();
            const sepA = new Date(now.getFullYear() - 1, 8);
            const sepB = new Date(now.getFullYear(), 8);
            if ((date < sepA && sepA <= now) || (date < sepB && sepB <= now)) {
                await ctx.editMessageReplyMarkup();
                await ctx.answerCbQuery(locale.nextYear, true);
            } else
                await next();
        });

        this.on('callback_query', async ctx => {
            try {
                const cbdata = JSON.parse(ctx.update.callback_query.data);

                if (typeof (cbdata.key) != 'string' || cbdata.key.startsWith(`${ctx.update.callback_query.message.chat.id}:`))
                    return await ctx.answerCbQuery();

                if (Date.now() - (ctx.update.callback_query.message.edit_date || 0) * 1e3 < 15 * 1e3)
                    return await ctx.answerCbQuery(locale.cooldown);
                cbdata.time = Date.now();

                const cookie = await this.keyv.get(cbdata.key);

                const date = ruDate.format(new Date());

                const text = locale.examMsg(date, await checkExam(cookie));

                await ctx.editMessageText(text, Extra.markdown().markup(examMarkup(JSON.stringify(cbdata))));
            } catch (e) {
                await ctx.answerCbQuery(locale.error(e.message), true);
            }
        });
    }
};