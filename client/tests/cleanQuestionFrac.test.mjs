import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuestionText } from '../src/components/question/parsing.js';

const R = String.raw;

test('valid brace-less fractions are left exactly as written (real bank questions)', () => {
    const a = R`In the expansion of $\left(\sqrt[3]{\dfrac ab}+\sqrt[3]{\dfrac b{\sqrt a}}\right)^{21}$ the term is`;
    const b = R`distance is expressed as
$$
\sqrt{\frac pq},
$$
where $p$ and $q$ are coprime`;
    assert.equal(cleanQuestionText(a), a);
    assert.equal(cleanQuestionText(b), b);
});

test('the damaged OCR forms are still repaired', () => {
    assert.equal(cleanQuestionText('a current of 1 fracA} flows'), 'a current of 1  A flows');
    assert.match(cleanQuestionText('measured in fracHz,} units'), /Hz,/);
    assert.ok(!cleanQuestionText('a current of 1 fracA} flows').includes('frac'));
});
