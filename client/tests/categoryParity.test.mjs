// The question category (mcq / ar / match / stmt / diag / numerical) is decided twice: in the browser (wizard counts) and on the
// server (selection). If the two ever disagree the wizard shows one mix and the paper gets another. This test keeps them equal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getQCategory } from '../src/pages/teacher/commissioned/examPatterns.js';
import { formatMarks, calcTotal } from '../src/components/paper-renderer/marks.js';

const require = createRequire(import.meta.url);
const { getQuestionCategory } = require('../../server/services/questionSelector.js');

const types = ['', 'MCQ', 'mcq', 'ASSERTION_REASON', 'MATCH_FOLLOWING', 'STATEMENT_BASED', 'DIAGRAM_BASED', 'NUMERICAL', 'true_false'];
const texts = [
    'Find the speed of the car.',
    'Assertion: light is a wave.\nReason: it shows diffraction.',
    'Match the following columns. Column I and Column II',
    'Statement I: heat flows. Statement II: it is energy.',
    'See figure {{IMG::https://res.cloudinary.com/x/y.png}} and answer',
    'Look at ![fig](https://res.cloudinary.com/x/y.png)',
    'The diagram [DIAGRAM: circuit] shows a loop.'
];
const extras = [
    {}, { imageUrl: 'https://res.cloudinary.com/a.png' }, { image_url: 'x.png' }, { diagram_urls: ['a.png'] }, { diagramUrls: ['a.png'] },
    { options: ['a', 'b', 'c', 'd'] }, { options: [] }, { opt_a: 'x', opt_b: 'y' }, { num_answer: '12' },
    { options: ['<img src="a.png">', 'b', 'c', 'd'] }, { opt_a: 'https://res.cloudinary.com/o.png', opt_b: 'y' }
];

test('client and server agree on the category of every combination (JEE and non-JEE)', () => {
    let compared = 0;
    for (const type of types) for (const questionText of texts) for (const extra of extras) for (const jee of [false, true]) {
        const q = { type, questionText, ...extra };
        assert.equal(getQCategory(q, jee), getQuestionCategory(q, jee), JSON.stringify({ type, questionText: questionText.slice(0, 20), extra, jee }));
        compared++;
    }
    assert.ok(compared > 1000);
});

test('marks: NEET and JEE are 4 per question, CET is 1, mixed papers add each question', () => {
    assert.equal(formatMarks('MCQ', ['NEET']), '4 Marks');
    assert.equal(formatMarks('MCQ', ['CET']), '1 Mark');
    assert.equal(calcTotal(new Array(180).fill({}), [], 'NEET'), 720);
    assert.equal(calcTotal(new Array(60).fill({}), [], 'CET'), 60);
    assert.equal(calcTotal(new Array(75).fill({}), [], 'JEE Main'), 300);
    assert.equal(calcTotal([{ type: '2M' }, { type: '3M' }, { type: '5M' }, { marks: '7' }], ['12'], 'CUSTOM'), 2 + 3 + 5 + 7);
    assert.equal(calcTotal([], [], 'NEET'), 0);
});
