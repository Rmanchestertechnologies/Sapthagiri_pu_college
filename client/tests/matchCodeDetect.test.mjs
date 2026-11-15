import test from 'node:test';
import assert from 'node:assert/strict';
import { isMatchCodeOption } from '../src/components/question/layout.js';

const R = String.raw;

test('chemistry reaction options are never mistaken for match codes (they used to be cut apart and stop rendering)', () => {
    for (const o of [
        R`$C_2H_4 \xrightarrow{B_2H_6} A \xrightarrow[\mathrm{NaOH}]{H_2O} Z$`,
        R`$CH_3I \xrightarrow{\mathrm{Ag},\ \Delta} A \xrightarrow[\mathrm{Hg^{2+}}]{\mathrm{dil.}\ H_2SO_4} B$`,
        R`C_2H_4 \xrightarrow{HI} A \xrightarrow{\text{aqueous KOH}} B`,
        R`$x-1$`, R`$\frac{1}{2}$`, 'A-B', 'Carbon-12', 'C-4 bond',
    ]) assert.equal(isMatchCodeOption(o), false, o);
});

test('real match codes are still recognised', () => {
    for (const o of ['A-(3), B-(4), C-(1), D-(2)', 'A-(1), B-(2)', '(a)-(iv), (b)-(iii), (c)-(ii), (d)-(i)', 'p → (iv), q → (iii), r → (ii), s → (i)',
        'A - 2, B - 3, C - 1', 'a-(iii), b-(iv)', R`A \to 2, B \to 1`, 'A-(4), B-(1)']) {
        assert.equal(isMatchCodeOption(o), true, o);
    }
});

test('objects and empty values are handled', () => {
    assert.equal(isMatchCodeOption({ text: 'A-(1), B-(2)' }), true);
    assert.equal(isMatchCodeOption(null), false);
    assert.equal(isMatchCodeOption(''), false);
});

import { cleanOptionText } from '../src/utils/sanitize.js';
test('the ampere unit rule only touches a standalone A, never a symbol inside a formula', () => {
    assert.equal(cleanOptionText(String.raw`$0.49\, A$`).includes(String.raw`\text{ A}`), true);
    const formula = String.raw`$K_{2-2}\,C_4\,A_{2+4}$`;
    assert.equal(cleanOptionText(formula), formula);
});
