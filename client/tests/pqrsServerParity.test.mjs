/**
 * The server grades OMR sheets with server/services/pqrsKeys.js, a port of the browser's PQRS
 * generator. These tests run both on the same papers and require identical question order and
 * identical correct option positions in every set. Run from client/: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { generatePaperSet } from '../src/utils/pqrsGenerator.js';
import { parseAnswerIndices } from '../src/utils/sanitize.js';

const require = createRequire(import.meta.url);
const server = require('../../server/services/pqrsKeys.js');

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

function makePaper(id, n, { sections }) {
    const answerForms = [i => 'ABCD'[i], i => String(i + 1), i => ['A, C', '1, 3'][i % 2]];
    const questions = Array.from({ length: n }, (_, i) => {
        const correct = Math.floor(rnd() * 4);
        const form = Math.floor(rnd() * 3);
        const base = {
            _id: `${id}-q${i}`,
            questionText: `Q ${i}`,
            subject: sections ? ['Physics', 'Chemistry', 'Biology'][i % 3] : 'Physics',
            options: [0, 1, 2, 3].map(k => `opt-${id}-${i}-${k}`),
        };
        if (form === 2) return { ...base, answer: answerForms[2](i), correct_option: undefined };
        if (rnd() < 0.2) return { ...base, options: ['x', 'y', 'Both A and B', 'None of these'], answer: 'C', correct_option: '3' };
        if (rnd() < 0.1) return { ...base, options: [], num_answer: '42', answer: '42' };
        return { ...base, answer: answerForms[form](correct), correct_option: form === 1 ? String(correct + 1) : undefined };
    });
    return { _id: id, title: 't', questions };
}

for (const sections of [false, true]) {
    for (const id of ['101', '7', 'abc-9']) {
        test(`server key == browser generator (paper ${id}, ${sections ? 'multi' : 'single'} section)`, () => {
            const paper = makePaper(id, 37, { sections });
            for (const set of ['P', 'Q', 'R', 'S']) {
                const client = generatePaperSet(paper, set, 1);
                const key = server.buildSeriesKey(paper, paper.questions, set);
                assert.equal(key.length, client.questions.length);
                client.questions.forEach((q, i) => {
                    assert.equal(key[i].questionId, q._id, `${set} #${i + 1} question order`);
                    const expected = parseAnswerIndices(q.correct_option ?? q.answer ?? q.correctAnswer ?? q.num_answer ?? '', q.options || []);
                    assert.deepEqual(key[i].correctIndices, expected, `${set} #${i + 1} correct option`);
                });
            }
        });
    }
}

test('papers without an id use the same default seed on both sides', () => {
    const paper = makePaper('x', 20, { sections: false });
    delete paper._id;
    const client = generatePaperSet(paper, 'S', 1);
    const key = server.buildSeriesKey(paper, paper.questions, 'S');
    assert.deepEqual(key.map(k => k.questionId), client.questions.map(q => q._id));
});
