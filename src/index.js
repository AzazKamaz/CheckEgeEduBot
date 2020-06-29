/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const CheckBot = require('./checkbot');
const uuid = require('uuid/v4');

const bot = new CheckBot(process.env.TG_TOKEN, {telegram: {webhookReply: true}});

if (process.env.WEBHOOK_DOMAIN)
    bot.launch({
        webhook: {
            domain: process.env.WEBHOOK_DOMAIN,
            port: process.env.PORT || 8000,
            hookPath: process.env.WEBHOOK_PATH || uuid()
        }
    }).then(() => console.log('Bot is up and running with webhook'));
else
    bot.launch({
        polling: {}
    }).then(() => console.log('Bot is up and running with polling'));

const stop = (sig) => {
    console.info(sig + ' signal received.');
    bot.stop().then(() => process.exit(0));
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));