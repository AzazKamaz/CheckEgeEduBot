/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Markup = require('telegraf/markup');
const emoji = require('node-emoji');
const AbortController = require('abort-controller');

const {DateUtils, Appeal} = require('./vendor');

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

module.exports.reqTimeout = function (timeout) {
    const controller = new AbortController();
    return {
        controller,
        timeout: setTimeout(
            () => controller.abort(),
            timeout,
        ),
        param: {signal: controller.signal},
    };
};

const mapExam = (exam) => ({
    id: exam.ExamId,
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
    ...(!exam.HasAppeal ? {}
        : {
            appeal: Appeal[exam.AppealStatus],
            appealLink: `http://check.ege.edu.ru/appeal/${exam.ExamId}`
        }),
    ...(!exam._HasResult ? {}
        : {resultLink: `http://check.ege.edu.ru/exams/${exam.ExamId}`}),
});

function formatExam(exam) {
    return [
        `\`${exam.id}\`. \`${exam.subject}\` (\`${exam.date}\`)`,
        exam.testMark ? `Тестовый балл: \`${exam.testMark}\`` : null,
        exam.minMark ? `Минимальный балл: \`${exam.minMark}\`` : null,
        `Статус: \`${exam.status}\``,
        exam.resultLink ? `\\*Проверьте: ${exam.resultLink}` : null,
        exam.appeal ? `Апелляция: \`${exam.appeal}\`` : null,
        exam.appealLink ? `\\*Апелляция: ${exam.appealLink}` : null,
    ].filter((s) => s !== null).join('\n');
}

module.exports.formatExams = function (exams) {
    return exams
        .map(mapExam)
        .map(formatExam).join('\n\n')
};