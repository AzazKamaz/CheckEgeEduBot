/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Telegraf = require('telegraf');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');

const sqlite3 = require('sqlite3').verbose();
const session = require('telegraf-session-sqlite');
const LocalSession = require('telegraf-session-local');

const {mainMenu} = require('./utils');
const {addingWizard} = require('./wizards/adding');
const {checkingWizard} = require('./wizards/checking');

module.exports = class CheckBot extends Telegraf{
    constructor() {
        super(...arguments);

        if (process.env.DB_TYPE === 'lowdb')
            this.use(new LocalSession({database: './storage/db.json'}).middleware());
        else {
            this.db = new sqlite3.Database('./storage/db.sqlite3');

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
        this.use(stage.middleware());

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

    stop(cb) {
        console.log('Stopping telegraf...');
        super.stop(() => {
            console.log('Telegraf stopped.');

            console.log('Closing sqlite3...');
            this.db.close(() => {
                console.log('Sqlite3 closed.');

                cb();
            });
        });
    }
};