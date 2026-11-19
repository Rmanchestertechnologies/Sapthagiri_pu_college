// Guards the question display against the mistakes teachers reported from real papers and the selection screen:
//  - powers / indices stored as Unicode ("10⁻³⁴", "Fe²⁺", "H₂SO₄") printed as "10^-^3^4", "Fe^2^+", "H_2SO_4";
//  - plain "x^2+k" options printed with the caret;
//  - match codes "i→b, ii→d" named labels the column table does not print;
//  - statement questions (statements pulled out, question text empty) showed only their options on the selection card;
//  - match questions showed an empty Column II.
// Every case here is a question shape from the bank. Do not loosen a test to make it pass: fix the display instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { processMathOnly } from '../src/utils/mathPipeline.js';
import { harmonizeMatchCode } from '../src/components/question/layout.js';
import { buildQuestionPreview, previewParts } from '../src/components/question/previewModel.js';

/** The text a reader sees: every KaTeX block replaced by [M], tags removed. */
function visible(html) {
    let out = ''; let i = 0;
    while (i < html.length) {
        const k = html.indexOf('<span class="katex', i);
        if (k < 0) { out += html.slice(i); break; }
        out += html.slice(i, k) + '[M]';
        let depth = 0; let j = html.length; const re = /<span\b|<\/span>/g; re.lastIndex = k; let m;
        while ((m = re.exec(html)) !== null) { depth += m[0] === '</span>' ? -1 : 1; if (depth === 0) { j = re.lastIndex; break; } }
        i = j;
    }
    return out.replace(/<[^>]+>/g, '');
}
const RAW_CODE = /\^|[A-Za-z0-9]_[0-9A-Za-z{]|\\[a-zA-Z]{2,}|\$/;

test('Unicode powers and indices print as superscript / subscript, never as ^ or _ codes', () => {
    const cases = {
        '6.6 × 10⁻³⁴ m': '<sup>−34</sup>',
        '1.0 × 10⁻³⁵ m': '<sup>−35</sup>',
        'Fe²⁺': '<sup>2+</sup>',
        'Cr⁺': '<sup>+</sup>',
        '[Ar]3d⁷4s⁰': '<sup>7</sup>',
        'H₂SO₄': '<sub>2</sub>',
        'The associated wavelength will be (h = 6.6 × 10⁻³⁴ Js):': '<sup>−34</sup>',
    };
    for (const [text, expected] of Object.entries(cases)) {
        const html = processMathOnly(text);
        assert.ok(html.includes(expected), `${text} -> ${html}`);
        assert.doesNotMatch(visible(html), RAW_CODE, text);
    }
});

test('Unicode powers inside $...$ are one power, not a double-superscript error', () => {
    for (const text of ['$10⁻³⁴$', '$x² + y₂$', 'energy $E = mc²$ here']) {
        const html = processMathOnly(text);
        assert.ok(!html.includes('katex-error') && !html.includes('inline-math font-medium'), `${text} fell back: ${html.slice(0, 120)}`);
        assert.doesNotMatch(visible(html), RAW_CODE, text);
    }
});

test('plain powers typed without $ are typeset', () => {
    for (const text of ['x^2+k', '27c^3', '(4/27)c^3', 'e^x', '10^-34 m', 'I_n = 5', 'R^+']) {
        assert.doesNotMatch(visible(processMathOnly(text)), RAW_CODE, text);
    }
    // words with an underscore are not maths
    assert.equal(visible(processMathOnly('file_name')), 'file_name');
});

test('match codes come out with the labels the column table prints (A, B, C / 1, 2, 3)', () => {
    assert.equal(harmonizeMatchCode('i→b, ii→d, iii→c, iv→a'), 'A-(2), B-(4), C-(3), D-(1)');
    assert.equal(harmonizeMatchCode('(i)-(b), (ii)-(a)'), 'A-(2), B-(1)');
    assert.equal(harmonizeMatchCode('A-(Q); B-(P); C-(S); D-(R)'), 'A-(2), B-(1), C-(4), D-(3)');
    assert.equal(harmonizeMatchCode('i-a'), 'i-a'); // a single pair is not a code list
});

test('a statement question whose text is only its statements shows the statements (not just the options)', () => {
    const q = {
        type: 'STATEMENT_BASED', questionText: '',
        statements: [
            { label: 'Statement 1:', text: 'If $F(x)=\\int_1^x \\frac{\\log t}{1+t}\\,dt$ then $F(x)=-F(1/x)$.' },
            { label: 'Statement 2:', text: '$\\int_{-\\pi/2}^{\\pi/2}|\\sin x|\\,dx=2$.' },
        ],
        options: ['Both Statement-1 and Statement-2 are true', 'Both are false', 'Statement-1 is true but Statement-2 is false', 'Statement-1 is false but Statement-2 is true'],
        correct_option: 'C',
    };
    const m = buildQuestionPreview(q);
    assert.equal(m.kind, 'statement');
    assert.equal(m.statements.length, 2);
    assert.match(m.statements[0].text, /F\(x\)/);
    assert.equal(m.options.length, 4);
    assert.deepEqual(m.options.map(o => o.correct), [false, false, true, false]);
});

test('statements written inside the question text are split out', () => {
    const m = buildQuestionPreview({ type: 'STATEMENT_BASED', questionText: 'Given below are two statements:\nStatement I: Oxygen is paramagnetic.\nStatement II: Nitrogen is diamagnetic.\nChoose the correct answer.', options: ['a', 'b', 'c', 'd'] });
    assert.equal(m.statements.length, 2);
    assert.match(m.stem, /two statements/);
    assert.doesNotMatch(m.stem, /Oxygen/);
});

test('a match question shows both columns with their items and options in the same labels', () => {
    const q = {
        type: 'MATCH_FOLLOWING',
        questionText: 'Match species given in column I with the electronic configuration given in Column II.\n\n**Column I**\nCr⁺\nFe²⁺\nNi³⁺\nCu⁺\n\n**Column II**\n[Ar]3d⁷4s⁰\n[Ar]3d¹⁰4s⁰\n[Ar]3d⁶4s⁰\n[Ar]3d⁵4s⁰',
        columnA: ['Cr⁺', 'Fe²⁺', 'Ni³⁺', 'Cu⁺'], column_a: ['Cr⁺', 'Fe²⁺', 'Ni³⁺', 'Cu⁺'],
        columnB: ['[Ar]3d⁷4s⁰', '[Ar]3d¹⁰4s⁰', '[Ar]3d⁶4s⁰', '[Ar]3d⁵4s⁰'], column_b: ['[Ar]3d⁷4s⁰', '[Ar]3d¹⁰4s⁰', '[Ar]3d⁶4s⁰', '[Ar]3d⁵4s⁰'],
        matchPairs: [{ left: 'Cr⁺', right: '[Ar]3d⁷4s⁰' }, { left: 'Fe²⁺', right: '[Ar]3d¹⁰4s⁰' }, { left: 'Ni³⁺', right: '[Ar]3d⁶4s⁰' }, { left: 'Cu⁺', right: '[Ar]3d⁵4s⁰' }],
        options: ['i→b, ii→d, iii→c, iv→a', 'i→a, ii→b, iii→c, iv→d', 'i→d, ii→c, iii→a, iv→b', 'i→d, ii→b, iii→a, iv→c'],
        correct_option: 'C',
    };
    const m = buildQuestionPreview(q);
    assert.equal(m.kind, 'match');
    assert.equal(m.columns.left.length, 4);
    assert.equal(m.columns.right.length, 4);
    assert.deepEqual(m.columns.left.map(c => c.label), ['A', 'B', 'C', 'D']);
    assert.match(m.stem, /^Match species/);
    assert.doesNotMatch(m.stem, /Cr⁺|Column II\s*\n/); // the items are in the table, not repeated in the stem
    assert.equal(m.options[2].text, 'A-(4), B-(3), C-(1), D-(2)');
    assert.equal(m.options[2].correct, true);
    for (const part of previewParts(m)) assert.doesNotMatch(visible(processMathOnly(part.text)), RAW_CODE, `${part.where}: ${part.text}`);
});

test('a question typed "match" with no columns in its text is shown whole as an MCQ', () => {
    const m = buildQuestionPreview({ type: 'MATCH_FOLLOWING', questionText: 'Paragraph for Q-18 to Q-20\nIn a class of 10 students, probability of exactly $i$ students passing is proportional to $i^2$.', options: ['$1/11$', '$5/77$', '$25/77$', '$10/77$'] });
    assert.equal(m.kind, 'mcq');
    assert.match(m.stem, /Paragraph for Q-18/);
    assert.equal(m.columns, null);
});

test('assertion-reason shows both parts', () => {
    const m = buildQuestionPreview({ type: 'ASSERTION_REASON', questionText: 'Assertion: $As_2O_3$ is amphoteric.\nReason: As is a metalloid.', options: [] });
    assert.equal(m.kind, 'assertion');
    assert.match(m.assertion, /amphoteric/);
    assert.match(m.reason, /metalloid/);
    assert.equal(m.options.length, 4);
});

test('the de Broglie question prints its options as powers of ten', () => {
    const m = buildQuestionPreview({ type: 'MCQ', questionText: 'A 0.66 kg ball is moving with a speed of 100 m/s. The associated wavelength will be (h = 6.6 × 10⁻³⁴ Js):', options: ['6.6 × 10⁻³⁴ m', '1.0 × 10⁻³⁵ m', '1.0 × 10⁻³² m', '6.6 × 10⁻³² m'], correct_option: 'B' });
    for (const part of previewParts(m)) {
        const html = processMathOnly(part.text);
        assert.ok(html.includes('<sup>'), part.text);
        assert.doesNotMatch(visible(html), RAW_CODE, part.text);
    }
    assert.equal(m.options[1].correct, true);
});

// ---- real bank questions found by the card check in check:bank -------------------------------------------------------------

test('a one-word question equal to its topic ("Gymnosperms") keeps its text', () => {
    const m = buildQuestionPreview({ type: 'MCQ', questionText: 'Gymnosperms', concept: 'Gymnosperms', options: ['Are naked seeds plants', 'Have tap roots', 'Are heterosporous', 'All of these'], correct_option: 'D' });
    assert.equal(m.stem, 'Gymnosperms');
    // a real heading line above the question is still removed
    assert.equal(buildQuestionPreview({ type: 'MCQ', questionText: 'Gymnosperms\nWhich of these has naked seeds?', concept: 'Gymnosperms', options: ['a', 'b', 'c', 'd'] }).stem, 'Which of these has naked seeds?');
});

test('a statement that only mentions "Statement 1." keeps every statement when the question text is empty', () => {
    const m = buildQuestionPreview({
        type: 'STATEMENT_BASED', questionText: '',
        statements: [
            { label: 'Statement I:', text: 'If f is even and g is odd then $\dfrac fg$ is an odd function' },
            { label: 'Statement II:', text: 'Statement 2 is a correct explanation for Statement 1.' },
        ],
        options: ['Both correct', 'Both incorrect', 'I correct, II incorrect', 'I incorrect, II correct'], correct_option: 'C',
    });
    assert.equal(m.statements.length, 2);
});

test('a numerical question starting with (a) (b) (c) (d) items keeps its text', () => {
    const text = '(a) $\mathrm{CoCl_3\cdot4NH_3}$, (b) $\mathrm{CoCl_3\cdot5NH_3}$, (c) $\mathrm{CoCl_3\cdot6NH_3}$ and (d) $\mathrm{CoCl(NO_3)_2\cdot5NH_3}$\nNumber of complexes which show geometrical isomerism is';
    const m = buildQuestionPreview({ type: 'NUMERICAL', questionText: text, num_answer: '1' });
    assert.equal(m.stem, text);
    assert.equal(m.answerText, '1');
});

test('options typed inside an MCQ text are shown once, as options, not again in the question', () => {
    const m = buildQuestionPreview({ type: 'MCQ', questionText: 'Which is a noble gas?\n(a) Neon\n(b) Nitrogen\n(c) Sodium\n(d) Iron', correct_option: 'A' });
    assert.equal(m.stem, 'Which is a noble gas?');
    assert.deepEqual(m.options.map(o => o.text), ['Neon', 'Nitrogen', 'Sodium', 'Iron']);
    assert.equal(m.options[0].correct, true);
});
