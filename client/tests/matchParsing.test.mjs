// Match-the-following parsing: items must come out exactly as written (they used to lose their first letter or digit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseMatchFromText } from '../src/components/question/parsing.js';

const require = createRequire(import.meta.url);
const word = require('../../server/services/wordExport.js');

const q = (c1, c2) => ({ questionText: `Match the following.\n\nColumn I\n${c1.join('\n')}\n\nColumn II\n${c2.join('\n')}` });

const cases = {
    'items that start with A, B or I': [['Acetic acid', 'Ammonia', 'Benzene', 'Iron'], ['Weak acid', 'Weak base', 'Hydrocarbon', 'Metal']],
    'items with a decimal or locant': [['1.5 eV', '2.5 eV', 'p-nitrophenol', '2-butene'], ['Ground state', 'First excited', 'Acidic', 'Alkene']],
    'items that start with the word "with" or a capital I': [['Iodine', 'Isotope', 'Ion', 'Insulator'], ['Halogen', 'Same Z', 'Charged', 'No current']]
};

for (const [name, [left, right]] of Object.entries(cases)) {
    test(`browser parser: ${name}`, () => {
        const { pairs } = parseMatchFromText(q(left, right));
        assert.deepEqual(pairs.map(p => p.left), left);
        assert.deepEqual(pairs.map(p => p.right), right);
    });
    test(`Word export parser: ${name}`, () => {
        const { pairs } = word.parseMatchFromText(q(left, right));
        assert.deepEqual(pairs.map(p => p.left), left);
        assert.deepEqual(pairs.map(p => p.right), right);
    });
}

test('real labels and headers are still removed', () => {
    const labelled = { questionText: 'Match the following.\n\nColumn I\n(A) Acetic acid\n(B) Benzene\n(C) Iron\n\nColumn II\n(p) Weak acid\n(q) Hydrocarbon\n(r) Metal' };
    const { pairs } = parseMatchFromText(labelled);
    assert.deepEqual(pairs.map(p => p.left), ['Acetic acid', 'Benzene', 'Iron']);
    assert.deepEqual(pairs.map(p => p.right), ['Weak acid', 'Hydrocarbon', 'Metal']);
});
