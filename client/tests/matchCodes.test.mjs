import test from 'node:test';
import assert from 'node:assert/strict';
import { harmonizeMatchCode } from '../src/components/question/layout.js';

test('letters become capitals and roman numerals become the numbers printed next to Column II', () => {
    assert.equal(harmonizeMatchCode('a-(iii), b-(iv), c-(i), d-(ii)'), 'A-(3), B-(4), C-(1), D-(2)');
    assert.equal(harmonizeMatchCode('a-(ii), b-(i), c-(iii), d-(iv)'), 'A-(2), B-(1), C-(3), D-(4)');
    assert.equal(harmonizeMatchCode('(a)-(ii), (b)-(iii), (c)-(i)'), 'A-(2), B-(3), C-(1)');
});

test('other label styles are brought to the same form', () => {
    assert.equal(harmonizeMatchCode('A-P, B-Q, C-R, D-S'), 'A-(1), B-(2), C-(3), D-(4)');
    assert.equal(harmonizeMatchCode('A-2, B-1'), 'A-(2), B-(1)');
    assert.equal(harmonizeMatchCode('A \\to 2, B \\to 1'), 'A-(2), B-(1)');
    assert.equal(harmonizeMatchCode('A-v, B-iv'), 'A-(5), B-(4)');
});

test('anything that is not a plain list of mappings is left exactly as it was', () => {
    for (const s of ['Both A and B are true', '1.5 m', '(a) and (b) only', 'sp3 hybridised', '', 'A-(iii), see note']) assert.equal(harmonizeMatchCode(s), s);
    assert.equal(harmonizeMatchCode(undefined), undefined);
});
