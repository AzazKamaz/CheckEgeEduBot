/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Markup = require('telegraf/markup');
const emoji = require('node-emoji');

const {DateUtils} = require('./vendor');

module.exports.mainMenu = function (session, participants = session.participants) {
    return [...
        Object.values(participants || {}).map((i) => [
            Markup.callbackButton(`${emoji.get('grey_question')}${i.name}`, `check ${i.id}`),
            Markup.callbackButton(`${emoji.get('x')} ${i.type === 'code' ? 'код' : 'док.'} ${i.value}`, `del ${i.id}`)
        ]),
        [
            Markup.callbackButton('Добавить участника ЕГЭ', 'add'),
            session.raw
                ? Markup.callbackButton('Красивый вид', 'beauty')
                : Markup.callbackButton('Экспертный вывод', 'raw'),
        ]
    ];
};

function formatObject(obj) {
    const locale = {
        date: 'Дата экзамена',
        subject: 'Предмет',
        testMark: 'Тестовый балл',
        minMark: 'Минимальный балл',
        status: 'Статус экзамена',
        result: 'Результат',
    };

    let strs = [];
    for (let i in obj)
        if (obj.hasOwnProperty(i))
            if (obj[i].toString().match(/^https?:\/\//))
                strs.push(`  ${locale[i]}: ${obj[i]}`);
            else
                strs.push(`  ${locale[i]}: \`${obj[i]}\``);
    strs[0] = strs[0].replace(/^\s(\s+[^\s])/, '-$1');
    return strs.join('\n');
}

module.exports.formatExams = function (exams) {
    return exams
        .map((exam) => ({
            date: DateUtils.dateToRuFormat(exam.ExamDate),
            subject: exam.OralSubject || exam.Subject,
            testMark: exam.IsComposition
                ? (exam.Mark5 === 5 ? 'зачёт' : 'незачёт') : exam.TestMark,
            ...(exam.IsComposition ? {}
                : {minMark: exam.IsBasicMath ? cond.basicMath.minMark : exam.MinMark}),
            status: exam.HasResult
                ? (exam.IsComposition
                    ? (exam.Mark5 === 5 ? '«Зачёт»' : 'Нет результата со значением «зачёт»')
                    : (exam.IsHidden ? 'Результат скрыт' : 'Экзамен обработан'))
                : 'Нет результата',
            result: `http://check.ege.edu.ru/exams/${exam.ExamId}`
        }))
        .map(formatObject).join('\n\n')
};