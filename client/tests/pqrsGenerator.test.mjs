/**
 * PQRS permutation + answer key synchronisation tests.
 * Run from client/:  npm test      (node --test, no extra dependencies)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePaperSet, generateAllPQRS, generateAnswerKey, hasPositionalOptions } from '../src/utils/pqrsGenerator.js';
import { getResolvedAnswerLabel } from '../src/utils/sanitize.js';

const SETS = ['P', 'Q', 'R', 'S'];

/** 12 Physics + 8 Chemistry questions; the correct option text is always "RIGHT-<id>". */
function makePaper({ sections = true, n = 20 } = {}) {
    const questions = Array.from({ length: n }, (_, i) => {
        const correctIdx = i % 4;
        const options = [0, 1, 2, 3].map(k => (k === correctIdx ? `RIGHT-${i}` : `wrong-${i}-${k}`));
        return {
            _id: `q${i}`,
            questionText: `Question ${i}`,
            subject: sections ? (i < 12 ? 'Physics' : 'Chemistry') : 'Physics',
            marks: 4,
            options,
            answer: 'ABCD'[correctIdx],
            correct_option: String(correctIdx + 1),
            solutionText: `Solution for ${i}`,
        };
    });
    return { _id: 'paper-1', title: 'Unit Test', questions };
}

/** Text of the option the set's own answer key points at. */
function keyedOptionText(q) {
    const label = getResolvedAnswerLabel(q);
    const idx = /^[1-4]$/.test(label) ? Number(label) - 1 : 'ABCD'.indexOf(String(label).toUpperCase());
    return q.options[idx];
}
const idOf = q => q._id;

test('four sets contain exactly the same questions and total marks (no loss, no duplication)', () => {
    const paper = makePaper();
    const baseIds = paper.questions.map(idOf).sort();
    for (const set of SETS) {
        const out = generatePaperSet(paper, set);
        assert.deepEqual(out.questions.map(idOf).sort(), baseIds, `set ${set} question membership`);
        assert.equal(new Set(out.questions.map(idOf)).size, baseIds.length, `set ${set} duplicates`);
        assert.equal(out.questions.reduce((s, q) => s + q.marks, 0), 80, `set ${set} marks`);
    }
});

test('P keeps master order; Q/R/S reorder questions', () => {
    const paper = makePaper();
    const base = paper.questions.map(idOf);
    assert.deepEqual(generatePaperSet(paper, 'P').questions.map(idOf), base);
    for (const set of ['Q', 'R', 'S']) {
        assert.notDeepEqual(generatePaperSet(paper, set).questions.map(idOf), base, `set ${set} should be shuffled`);
    }
});

test('answer recalculation: every set key points at the originally correct option', () => {
    const paper = makePaper();
    for (const set of SETS) {
        for (const q of generatePaperSet(paper, set).questions) {
            assert.equal(keyedOptionText(q), `RIGHT-${q._id.slice(1)}`, `set ${set} ${q._id}`);
        }
    }
});

test('option shuffling happens in R and S only, and options are a permutation of the originals', () => {
    const paper = makePaper();
    const byId = Object.fromEntries(paper.questions.map(q => [q._id, q]));
    for (const set of ['P', 'Q']) {
        for (const q of generatePaperSet(paper, set).questions) assert.deepEqual(q.options, byId[q._id].options);
    }
    for (const set of ['R', 'S']) {
        const out = generatePaperSet(paper, set).questions;
        assert.ok(out.some(q => q.options.join() !== byId[q._id].options.join()), `set ${set} should shuffle some options`);
        for (const q of out) assert.deepEqual([...q.options].sort(), [...byId[q._id].options].sort());
    }
});

test('section boundaries are preserved: Physics block stays before Chemistry block', () => {
    const paper = makePaper();
    for (const set of SETS) {
        const subjects = generatePaperSet(paper, set).questions.map(q => q.subject);
        assert.deepEqual(subjects, [...Array(12).fill('Physics'), ...Array(8).fill('Chemistry')], `set ${set}`);
    }
});

for (const start of [1, 10, 25]) {
    test(`custom starting number ${start}: numbering is contiguous from ${start} in every set and in its key`, () => {
        const paper = makePaper();
        for (const set of SETS) {
            const out = generatePaperSet(paper, set, start);
            const expected = Array.from({ length: 20 }, (_, i) => start + i);
            assert.deepEqual(out.questions.map(q => q.setQNo), expected, `set ${set} paper numbering`);
            assert.deepEqual(out.answerKey.map(k => k.qNo), expected, `set ${set} key numbering`);
            // originalQNo maps back to the master position using the same offset
            assert.deepEqual(out.questions.map(q => q.originalQNo).sort((a, b) => a - b), expected);
        }
    });
}

test('answer key rows correspond to the same question as the paper row with that number', () => {
    const paper = makePaper();
    for (const set of SETS) {
        const out = generatePaperSet(paper, set, 10);
        out.questions.forEach((q, i) => {
            assert.equal(out.answerKey[i].qNo, q.setQNo);
            assert.equal(out.answerKey[i].answer, getResolvedAnswerLabel(q));
            assert.equal(out.answerKey[i].solutionText, q.solutionText, 'solution follows the question');
        });
    }
});

test('REGRESSION: generating a set from an already generated set equals generating it from the master', () => {
    // The wizard passed an already-permuted paper to the renderer / answer key, which permuted it again.
    const paper = makePaper();
    for (const from of SETS) {
        const generated = generatePaperSet(paper, from, 10);
        for (const to of SETS) {
            const direct = generatePaperSet(paper, to, 10);
            const viaGenerated = generatePaperSet(generated, to, 10);
            assert.deepEqual(viaGenerated.questions.map(idOf), direct.questions.map(idOf), `${from} -> ${to} order`);
            assert.deepEqual(viaGenerated.questions.map(q => q.options), direct.questions.map(q => q.options), `${from} -> ${to} options`);
            assert.deepEqual(viaGenerated.answerKey, direct.answerKey, `${from} -> ${to} key`);
            assert.equal(viaGenerated.title, direct.title, 'title is not suffixed twice');
        }
    }
});

test('sets survive a JSON round trip (A4AnswerKey clones questions with JSON)', () => {
    const paper = makePaper();
    const r = JSON.parse(JSON.stringify(generatePaperSet(paper, 'R', 25)));
    const again = generatePaperSet(r, 'R', 25);
    assert.deepEqual(again.answerKey, generatePaperSet(paper, 'R', 25).answerKey);
});

test('generation is deterministic and does not mutate the master paper', () => {
    const paper = makePaper();
    const snapshot = JSON.stringify(paper);
    const a = generatePaperSet(paper, 'S');
    const b = generatePaperSet(paper, 'S');
    assert.deepEqual(a.questions, b.questions);
    assert.equal(JSON.stringify(paper), snapshot);
});

test('editing the master paper (swap two questions) is reflected in every key', () => {
    const paper = makePaper({ sections: false });
    const edited = { ...paper, questions: [...paper.questions] };
    [edited.questions[0], edited.questions[5]] = [edited.questions[5], edited.questions[0]];
    const p = generatePaperSet(edited, 'P', 10);
    assert.equal(p.questions[0]._id, 'q5');
    assert.equal(p.answerKey[0].qNo, 10);
    assert.equal(p.answerKey[0].answer, getResolvedAnswerLabel(edited.questions[0]));
    for (const set of SETS) {
        for (const q of generatePaperSet(edited, set, 10).questions) assert.equal(keyedOptionText(q), `RIGHT-${q._id.slice(1)}`);
    }
});

test('options that refer to each other by position are not shuffled', () => {
    assert.equal(hasPositionalOptions(['x', 'y', 'Both 1 and 2', 'None of these']), true);
    assert.equal(hasPositionalOptions(['x', 'y', 'z', 'All of the above']), true);
    assert.equal(hasPositionalOptions(['4 m/s', '8 m/s', '12 m/s', '16 m/s']), false);
    const paper = makePaper({ sections: false, n: 6 });
    paper.questions = paper.questions.map(q => ({ ...q, options: ['alpha', 'beta', 'Both (A) and (B)', 'None of the above'], answer: 'C', correct_option: '3' }));
    for (const set of ['R', 'S']) {
        for (const q of generatePaperSet(paper, set).questions) {
            assert.deepEqual(q.options, ['alpha', 'beta', 'Both (A) and (B)', 'None of the above']);
            assert.equal(keyedOptionText(q), 'Both (A) and (B)');
        }
    }
});

test('questions whose answer cannot be resolved keep their option order', () => {
    const paper = makePaper({ sections: false, n: 6 });
    paper.questions = paper.questions.map(q => ({ ...q, answer: 'see solution', correct_option: undefined }));
    for (const q of generatePaperSet(paper, 'R').questions) {
        assert.deepEqual(q.options, paper.questions.find(b => b._id === q._id).options);
    }
});

test('numerical questions (no options) pass through unchanged', () => {
    const paper = { _id: 'n', questions: [{ _id: 'n1', questionText: 'x', options: [], num_answer: '42' }, { _id: 'n2', questionText: 'y', options: [], num_answer: '7' }] };
    const out = generatePaperSet(paper, 'S');
    assert.deepEqual(out.questions.map(q => q.num_answer).sort(), ['42', '7']);
});

test('generateAllPQRS honours the starting number; generateAnswerKey falls back to 1..N', () => {
    const all = generateAllPQRS(makePaper(), 25);
    for (const set of SETS) assert.equal(all[set].questions[0].setQNo, 25);
    assert.deepEqual(generateAnswerKey([{ answer: 'A', options: ['a', 'b'] }, { answer: 'B', options: ['a', 'b'] }]).map(k => k.qNo), [1, 2]);
});

test('empty and missing papers are handled', () => {
    assert.equal(generatePaperSet(null, 'Q'), null);
    assert.deepEqual(generatePaperSet({ questions: [] }, 'Q').questions, []);
});
