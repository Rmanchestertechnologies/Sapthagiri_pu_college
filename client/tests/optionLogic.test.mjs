// Option text cleaning and answer resolution: the logic behind the printed question paper and its answer key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    cleanOptionText, parseAnswerIndices, getResolvedAnswerLabel, getResolvedAnswerCode, isOptionCorrect, getQuestionOptionLabels
} from '../src/utils/sanitize.js';
import { cleanOptionText as layoutClean, isOptionSelectedCorrect, formatOptionKey } from '../src/components/question/layout.js';

test('values that start with a digit and a dot keep every digit (this used to print "1.5 m" as "5 m")', () => {
    for (const v of ['1.5 m', '2.5 eV', '3.2 \\times 10^{3}', '4.9 m/s^2', '1.2', '0.5 kg', '4-methylpentane', '2,2-dimethylbutane', '3:1 ratio', '10 N', 'C2H5OH', '3d orbital']) {
        assert.equal(cleanOptionText(v), v, `unchanged: ${v}`);
    }
});

test('real option labels are still removed', () => {
    assert.equal(cleanOptionText('A. 25 N'), '25 N');
    assert.equal(cleanOptionText('(b) 40 m/s'), '40 m/s');
    assert.equal(cleanOptionText('1) Newton'), 'Newton');
    assert.equal(cleanOptionText('(1) 1.5 m'), '1.5 m');
    assert.equal(cleanOptionText('[2] 2.5 eV'), '2.5 eV');
    assert.equal(cleanOptionText('1. 1.5 m'), '1.5 m');
});

test('matching codes and statement combinations are left alone', () => {
    assert.equal(cleanOptionText('a-(iv)'), 'a-(iv)');
    assert.equal(cleanOptionText('(a) and (b) only'), '(a) and (b) only');
    assert.equal(cleanOptionText('(1) A-iv, B-ii'), 'A-iv, B-ii');
});

test('stray closing braces from OCR are removed, balanced ones are not', () => {
    assert.equal(cleanOptionText('54.4 eV}'), '54.4 eV');
    assert.equal(cleanOptionText('\\frac{1}{2}'), '\\frac{1}{2}');
});

test('the question block and the key screens use the same cleaner', () => {
    for (const v of ['1.5 m', 'A. 25 N', '(1) 2.5 eV', 'a-(iv)', '54.4 eV}']) assert.equal(layoutClean(v), cleanOptionText(v), v);
});

test('answers: letters, digits, combinations and words', () => {
    assert.deepEqual(parseAnswerIndices('B'), [1]);
    assert.deepEqual(parseAnswerIndices('3'), [2]);
    assert.deepEqual(parseAnswerIndices('AB'), [0, 1]);
    assert.deepEqual(parseAnswerIndices('1, 3'), [0, 2]);
    assert.deepEqual(parseAnswerIndices('A and C'), [0, 2]);
    assert.deepEqual(parseAnswerIndices('Both (A) and (B)'), [0, 1]);
    assert.deepEqual(parseAnswerIndices(['A', 'D']), [0, 3]);
    assert.deepEqual(parseAnswerIndices(null), []);
    assert.deepEqual(parseAnswerIndices(''), []);
    assert.deepEqual(parseAnswerIndices('30 N', ['10 N', '20 N', '30 N', '40 N']), [2]);
});

test('numeric NEET/CET questions label options 1-4, JEE questions A-D', () => {
    assert.deepEqual(getQuestionOptionLabels({ options: ['a', 'b', 'c', 'd'], classes: ['NEET'] }), ['1', '2', '3', '4']);
    assert.deepEqual(getQuestionOptionLabels({ options: ['a', 'b', 'c', 'd'], classes: ['JEE'] }), ['A', 'B', 'C', 'D']);
});

test('the printed key, the key code and the ticked option all come from the SAME field (correct_option wins)', () => {
    // data that disagrees with itself: the letter says B, the answer text says the third option
    const q = { options: ['10 N', '20 N', '30 N', '40 N'], correct_option: 'B', answer: '30 N', classes: ['NEET'] };
    const label = getResolvedAnswerLabel(q);
    const code = getResolvedAnswerCode(q);
    const ticked = [0, 1, 2, 3].filter(i => isOptionCorrect(q, i));
    const tickedByQuestionBlock = [0, 1, 2, 3].filter(i => isOptionSelectedCorrect(i, q));
    assert.equal(label, '2');
    assert.equal(code, '2');
    assert.deepEqual(ticked, [1]);
    assert.deepEqual(tickedByQuestionBlock, [1]);
    assert.match(formatOptionKey(q, '(1) (2) (3) (4)'), /2/);
});

test('when only the answer text exists it still resolves', () => {
    const q = { options: ['10 N', '20 N', '30 N', '40 N'], answer: '30 N', classes: ['NEET'] };
    assert.equal(getResolvedAnswerLabel(q), '3');
    assert.deepEqual([0, 1, 2, 3].filter(i => isOptionCorrect(q, i)), [2]);
});
