/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const fetch = require('node-fetch');
const emoji = require('node-emoji');
const AbortController = require('abort-controller');
const {DateUtils, Appeal, cond} = require('./vendor');

const reqTimeout = function (timeout) {
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

const fetchExam = async (cookie) => {
    const timeout = reqTimeout(5000);
    return await fetch('http://check.ege.edu.ru/api/exam', {
        ...timeout.param,
        headers: {cookie: `Participant=${cookie}`}
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.Message)
                throw new Error(data.Message);
            return data;
        }).finally(() => clearTimeout(timeout.timeout));
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
    resultLink: `http://check.ege.edu.ru/exams/${exam.ExamId}`,
    emoji: (exam.HasResult && (exam.Mark5 || exam.TestMark || !exam.IsHidden))
        ? ((exam.IsComposition ? exam.Mark5 === cond.composition.minMark : exam.TestMark >= exam.MinMark)
            ? emoji.get('white_check_mark') : emoji.get('x'))
        : emoji.get('clock5')
});

function formatExam(exam) {
    return [
        `\`${exam.id}\`. \`${exam.subject}\` (\`${exam.date}\`)`,
        (exam.testMark || !exam.IsHidden) ? `Тестовый балл: \`${exam.testMark}\`` : null,
        exam.testMark && Number(exam.testMark) < Number(exam.minMark) ? `Минимальный балл: \`${exam.minMark}\`` : null,
        `Статус: ${exam.emoji} [${exam.status}](${exam.resultLink})`,
        exam.appeal ? `Апелляция: [${exam.appeal}](${exam.appealLink})` : null,
    ].filter((s) => s !== null).join('\n');
}

const formatExams = function (exams) {
    return exams
        .map(mapExam)
        .map(formatExam).join('\n\n')
};

module.exports.checkExam = async (cookie) => {
    const data = await fetchExam(cookie);
    return `${formatExams(data.Result.Exams)}\n\n\\* Ссылка откроется после входа на [check.ege.edu.ru](http://check.ege.edu.ru)`
};