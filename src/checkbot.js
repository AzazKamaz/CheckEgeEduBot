/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Telegraf = require('telegraf');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');

const fs = require('fs');
const uuid = require('uuid/v4');
const sqlite3 = require('sqlite3').verbose();
const session = require('telegraf-session-sqlite');
const LocalSession = require('telegraf-session-local');
const RedisSession = require('telegraf-session-redis');

const {mainMenu} = require('./utils');
const {addingWizard} = require('./wizards/adding');
const {checkingWizard} = require('./wizards/checking');

module.exports = class CheckBot extends Telegraf {
    constructor() {
        super(...arguments);

        if (!fs.existsSync('storage')) {
            fs.mkdirSync('storage');
        }

        const file = process.env.DB_FILE;
        if (process.env.DB_TYPE === 'lowdb')
            this.use(new LocalSession({database: file || './storage/db.json'}).middleware());
        else if (process.env.DB_TYPE === 'sqlite') {
            this.db = new sqlite3.Database(file || './storage/db.sqlite3');

            this.db.serialize(() => {
                this.db.run('CREATE TABLE IF NOT EXISTS user_session' +
                    '(id TEXT primary key, session TEXT);');
            });

            this.use(session({
                db: this.db,
                table_name: 'user_session'
            }));
        } else if (process.env.DB_TYPE === 'redis') {
            // Heroku Redis Cloud addon
            const redisUrl = process.env.REDISCLOUD_URL;
            this.use(new RedisSession({store: {url: redisUrl}}));
        } else {
            this.db = new sqlite3.Database(':memory:');

            this.db.serialize(() => {
                this.db.run('CREATE TABLE IF NOT EXISTS user_session' +
                    '(id TEXT primary key, session TEXT);');
            });

            this.use(session({
                db: this.db,
                table_name: 'user_session'
            }));
        }

        this.mount()
    }

    mount() {
        const stage = new Stage([addingWizard, checkingWizard]);
        stage.command(['start', 'menu'], async (ctx, next) => {
            await ctx.scene.leave();
            return await next();
        });
        this.use(stage.middleware());

        // Any input in "forms" (like name, document number and region) are processed above, in stage.
        // So this middleware will print only /start command and text out of system
        // This is a some kind of analytics, don't worry about it :)
        this.use((ctx, next) => {
            if (ctx.update && ctx.update.message)
                console.log(`@${ctx.update.message.from.username}: ${ctx.update.message.text}`);
            return next();
        });

        this.action('add', (ctx) => ctx.scene.enter('adding-wizard'));

        this.action(/check\s(\d+)/, (ctx) => ctx.scene.enter('checking-wizard'));

        this.action(/del\s(\d+)/, (ctx) => {
            delete (ctx.session.participants || {})[ctx.match[1]];
            ctx.reply('Участник ЕГЭ удален', Markup.inlineKeyboard(mainMenu(ctx.session)).extra());
        });

        this.action('raw', (ctx) => {
            ctx.session.raw = true;
            ctx.replyWithMarkdown(
                'Режим экспертного вывода включен, вы будете получать ровно то, что прислал \`check.ege.edu.ru\`',
                Markup.inlineKeyboard(mainMenu(ctx.session)).extra())
        });

        this.action('beauty', (ctx) => {
            ctx.session.raw = false;
            ctx.replyWithMarkdown(
                'Режим красивого вывода включен, вы будете получать красивый список с результатами',
                Markup.inlineKeyboard(mainMenu(ctx.session)).extra())
        });

        this.use((ctx) =>
            ctx.reply('Выберите любую опцию', Markup.inlineKeyboard(mainMenu(ctx.session)).extra())
        );
    }

    launch(options) {
        const domain = process.env.WEBHOOK_DOMAIN;
        const port = process.env.PORT || 8000;
        if (domain) {
            this.telegram
                .deleteWebhook()
                .then(async () => {
                    const secretPath = process.env.WEBHOOK_PATH || uuid();
                    this.startWebhook(`/${secretPath}`, undefined, port);
                    await this.telegram.setWebhook(
                        `https://${domain}/${secretPath}`,
                        undefined,
                        100
                    );
                    const webhookInfo = await this.telegram.getWebhookInfo();
                    console.info('Bot is up and running with webhooks', webhookInfo);
                })
                .catch(err => console.info('Bot launch error', err));
        } else {
            this.telegram
                .deleteWebhook()
                .then(async () => {
                    this.startPolling();
                    // Console that everything is fine
                    console.info('Bot is up and running');
                })
                .catch(err => console.info('Bot launch error', err));
        }
    }

    stop(cb) {
        console.log('Stopping telegraf...');
        super.stop(() => {
            console.log('Telegraf stopped.');

            if (this.db) {
                console.log('Closing sqlite3...');
                this.db.close(() => {
                    console.log('Sqlite3 closed.');

                    cb();
                });
            } else cb();
        });
    }
};
