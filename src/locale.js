/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

module.exports = {
    start: 'Отправь мне значение cookie "Participant" с check.ege.edu.ru командой `/cookie Participant=...`',
    help: 'Отправь мне значение cookie "Participant" с check.ege.edu.ru командой `/cookie Participant=...`',
    cookieCmd: 'Отправь мне значение cookie "Participant" с check.ege.edu.ru командой `/cookie Participant=...`',
    initRes: 'Если вы смотрите за результатами некольких людей, отредактируйте сообщение выше для удобного поиска. Обновите для получения результатов',
    cooldown: 'Проверяйте результаты не чаще чем раз в 15 секунд',
    nextYear: 'Результаты, полученные ранее 1 сентября, заморожены',
    updateBtn: 'Обновить',
    error: e => `Error: ${e}`,
    examMsg: (t, ex) => `Проверка от ${t}\n\n${ex} мск`
};