/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const CheckBot = require('./checkbot');

const bot = new CheckBot(process.env.TG_TOKEN);

bot.launch();

const stop = (sig) => {
    console.info(sig + ' signal received.');

    bot.stop(() => {
        process.exit(0);
    });
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));