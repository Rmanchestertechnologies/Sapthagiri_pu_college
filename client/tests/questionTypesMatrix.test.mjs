// 500+ generated cases: every question type the bank has (MCQ, statement, match, assertion-reason, numerical, true/false,
// diagram) x every kind of content that appears in it (Unicode powers and indices, ions, LaTeX fractions / roots / integrals,
// vectors, matrices, reaction arrows, Greek letters, units, plain carets, plain text...). Each case is run through the same
// reading the paper and the cards use (buildQuestionPreview -> processMathOnly) and must:
//   - keep its type and every part (statements, both match columns, assertion AND reason, options, numerical answer, diagram);
//   - print no raw code (^, _, \command, $), no KaTeX error, no "undefined" / "null" / "[object Object]";
//   - mark exactly the keyed option correct;
//   - print match codes in the labels the table shows (A-(1) ...), never i->b.
// Do not loosen a check to make a case pass: fix the display instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { processMathOnly } from '../src/utils/mathPipeline.js';
import { buildQuestionPreview, previewParts } from '../src/components/question/previewModel.js';

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
    return out.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
const RAW_CODE = /\^|[A-Za-z0-9]_[0-9A-Za-z{]|\\[a-zA-Z]{2,}|\$/;
const JUNK = /\bundefined\b|\bnull\b|\[object Object\]|NaN/;

function assertPrintsClean(text, where) {
    const html = processMathOnly(text);
    assert.ok(!html.includes('katex-error'), `${where}: KaTeX error for ${JSON.stringify(text)}`);
    const seen = visible(html);
    assert.doesNotMatch(seen, RAW_CODE, `${where}: raw code printed for ${JSON.stringify(text)} -> ${JSON.stringify(seen)}`);
    assert.doesNotMatch(seen, JUNK, `${where}: junk printed for ${JSON.stringify(text)}`);
    assert.ok(seen.trim().length > 0, `${where}: printed nothing for ${JSON.stringify(text)}`);
}

// ---- content that appears in the bank (stem phrase, option set) --------------------------------------------------------
const CONTENT = [
    { name: 'Unicode powers of ten', stem: 'The wavelength will be (h = 6.6 × 10⁻³⁴ Js)', opts: ['6.6 × 10⁻³⁴ m', '1.0 × 10⁻³⁵ m', '1.0 × 10⁻³² m', '6.6 × 10⁻³² m'] },
    { name: 'Unicode ions', stem: 'Which ion is paramagnetic: Fe²⁺, Zn²⁺, Cu⁺ or Sc³⁺', opts: ['Fe²⁺', 'Zn²⁺', 'Cu⁺', 'Sc³⁺'] },
    { name: 'Unicode subscripts', stem: 'The oxidation state of S in H₂SO₄ and Na₂S₂O₃', opts: ['H₂SO₄', 'Na₂S₂O₃', 'SO₂', 'H₂S'] },
    { name: 'electronic configurations', stem: 'The configuration of Co²⁺ is', opts: ['[Ar]3d⁷4s⁰', '[Ar]3d⁵4s²', '[Ar]3d⁶4s¹', '[Ar]3d¹⁰4s⁰'] },
    { name: 'units with negative powers', stem: 'The SI unit of acceleration is', opts: ['m s⁻²', 'm s⁻¹', 'kg m s⁻²', 'm² s⁻¹'] },
    { name: 'LaTeX fractions', stem: 'Evaluate $\\frac{1}{2}+\\frac{1}{3}$', opts: ['$\\frac{5}{6}$', '$\\frac{1}{6}$', '$\\frac{2}{5}$', '$1$'] },
    { name: 'square roots', stem: 'Simplify $\\sqrt{50}$', opts: ['$5\\sqrt{2}$', '$2\\sqrt{5}$', '$25\\sqrt{2}$', '$\\sqrt{10}$'] },
    { name: 'integrals', stem: 'The value of $\\int_0^1 x^2\\,dx$ is', opts: ['$\\frac{1}{3}$', '$\\frac{1}{2}$', '$1$', '$0$'] },
    { name: 'limits', stem: 'Find $\\lim_{x \\to 0} \\frac{\\sin x}{x}$', opts: ['$1$', '$0$', '$\\infty$', 'does not exist'] },
    { name: 'plain carets without $', stem: 'If f(x) = x^2 + k, the minimum value is', opts: ['x^2+k', '27c^3', '(4/27)c^3', 'e^x'] },
    { name: 'vectors', stem: 'If $\\vec{a} = 2\\hat{i} + 3\\hat{j}$, then $|\\vec{a}|$ is', opts: ['$\\sqrt{13}$', '$5$', '$\\sqrt{5}$', '$13$'] },
    { name: 'matrices', stem: 'The determinant of $\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ is', opts: ['$-2$', '$2$', '$10$', '$-10$'] },
    { name: 'Greek letters', stem: 'The angle $\\theta$ for which $\\sin\\theta = \\cos\\theta$ is', opts: ['$\\frac{\\pi}{4}$', '$\\frac{\\pi}{2}$', '$\\pi$', '$\\frac{\\pi}{3}$'] },
    { name: 'reaction arrows', stem: 'The product of $\\mathrm{CH_3CHO} \\xrightarrow{\\mathrm{NaBH_4}}$ is', opts: ['$\\mathrm{CH_3CH_2OH}$', '$\\mathrm{CH_3COOH}$', '$\\mathrm{CH_4}$', '$\\mathrm{HCHO}$'] },
    { name: 'degrees and percentages', stem: 'At 25°C the solution is 10% by mass. Its molality is', opts: ['1.2 mol kg⁻¹', '0.5 mol kg⁻¹', '2.0 mol kg⁻¹', '0.1 mol kg⁻¹'] },
    { name: 'mixed $ and Unicode', stem: 'Energy $E = mc²$ of a particle of mass 10⁻³ kg', opts: ['$9 × 10^{13}$ J', '9 × 10¹³ J', '$3 × 10^{8}$ J', '10⁻³ J'] },
    { name: 'plain biology text', stem: 'Which organelle is called the powerhouse of the cell', opts: ['Mitochondria', 'Ribosome', 'Golgi body', 'Lysosome'] },
    { name: 'plain physics words', stem: "Newton's second law relates force to", opts: ['mass and acceleration', 'velocity only', 'energy', 'momentum and time'] },
    { name: 'inequalities', stem: 'The solution set of $2x - 3 > 5$ is', opts: ['$x > 4$', '$x < 4$', '$x \\geq 4$', '$x \\leq -4$'] },
    { name: 'trigonometric powers', stem: 'The value of $\\sin^2 x + \\cos^2 x$ is', opts: ['$1$', '$0$', '$2$', '$\\tan^2 x$'] },
    { name: 'logarithms', stem: 'If $\\log_2 8 = x$, then x is', opts: ['$3$', '$2$', '$8$', '$\\frac{1}{3}$'] },
    { name: 'summation', stem: 'The sum $\\sum_{r=1}^{n} r$ equals', opts: ['$\\frac{n(n+1)}{2}$', '$n^2$', '$\\frac{n}{2}$', '$n(n-1)$'] },
    { name: 'numbers with decimals', stem: 'The pH of 0.001 M HCl is', opts: ['3', '2', '11', '1.5'] },
    { name: 'chemistry names with charge', stem: 'The hybridisation of NH₄⁺ and SO₄²⁻ are', opts: ['sp³ and sp³', 'sp² and sp³', 'sp and sp²', 'dsp² and sp³'] },
    { name: 'binomial', stem: 'The coefficient of $x^2$ in $(1+x)^5$ is', opts: ['$10$', '$5$', '$20$', '$1$'] },
];

const KEYS = ['A', 'B', 'C', 'D'];
const cases = [];
const add = (name, q, expect) => cases.push({ name, q, expect });

CONTENT.forEach((c, ci) => {
    const key = KEYS[ci % 4];
    const keyIdx = ci % 4;

    // 1. MCQ - options as strings, key as letter
    add(`MCQ / ${c.name}`, { type: 'MCQ', questionText: `${c.stem}?`, options: c.opts, correct_option: key }, { kind: 'mcq', options: 4, keyIdx });
    // 2. MCQ - options as objects
    add(`MCQ (option objects) / ${c.name}`, { type: 'MCQ', questionText: `${c.stem}?`, options: c.opts.map(t => ({ text: t })), correct_option: key }, { kind: 'mcq', options: 4, keyIdx });
    // 3. MCQ - lower-case type, key as option number
    add(`mcq (numeric key) / ${c.name}`, { type: 'mcq', questionText: `${c.stem}?`, options: c.opts, correct_option: String(keyIdx + 1) }, { kind: 'mcq', options: 4, keyIdx });
    // 4. MCQ with a diagram
    add(`MCQ with diagram / ${c.name}`, { type: 'MCQ', questionText: `${c.stem}, as shown in the figure?`, imageUrl: 'https://example.com/figure.png', options: c.opts, correct_option: key }, { kind: 'mcq', options: 4, keyIdx, diagram: true });

    // 5. Statements held separately, question text empty
    add(`Statement (separate, no text) / ${c.name}`, {
        type: 'STATEMENT_BASED', questionText: '',
        statements: [{ label: 'Statement I:', text: `${c.stem}.` }, { label: 'Statement II:', text: `${c.opts[0]} is the answer.` }],
        options: ['Both I and II are true', 'Both I and II are false', 'I is true, II is false', 'I is false, II is true'], correct_option: key,
    }, { kind: 'statement', statements: 2, options: 4, keyIdx });
    // 6. Statements written in the question text, roman labels
    add(`Statement (in text, I/II) / ${c.name}`, {
        type: 'STATEMENT_BASED',
        questionText: `Given below are two statements:\nStatement I: ${c.stem}.\nStatement II: ${c.opts[1]} is correct.\nChoose the correct answer.`,
        options: ['Both true', 'Both false', 'I true, II false', 'I false, II true'], correct_option: key,
    }, { kind: 'statement', statements: 2, options: 4, keyIdx, stemHas: /two statements/i });
    // 7. Three statements held separately with a stem and an outro
    add(`Statement (three, stem) / ${c.name}`, {
        type: 'STATEMENT_BASED', questionText: 'Consider the following statements:',
        statements: [{ label: '(A)', text: `${c.stem}.` }, { label: '(B)', text: `${c.opts[2]} holds.` }, { label: '(C)', text: `${c.opts[3]} holds.` }],
        options: ['A and B only', 'B and C only', 'A and C only', 'A, B and C'], correct_option: key,
    }, { kind: 'statement', statements: 3, options: 4, keyIdx, stemHas: /Consider/ });

    // 8. Match with pairs held separately, roman/letter codes
    const left = c.opts.map((o, i) => `${o} (item ${i + 1})`);
    const right = [...c.opts].reverse().map((o, i) => `Property ${i + 1} of ${o}`);
    add(`Match (pairs, i→b codes) / ${c.name}`, {
        type: 'MATCH_FOLLOWING', questionText: `Match Column I with Column II for: ${c.stem}.`,
        columnA: left, columnB: right, column_a: left, column_b: right,
        matchPairs: left.map((l, i) => ({ left: l, right: right[i] })),
        options: ['i→b, ii→d, iii→c, iv→a', 'i→a, ii→b, iii→c, iv→d', 'i→d, ii→c, iii→a, iv→b', 'i→c, ii→a, iii→d, iv→b'], correct_option: key,
    }, { kind: 'match', rows: 4, options: 4, keyIdx, harmonized: true });
    // 9. Match with A-(P) codes
    add(`Match (pairs, A-(P) codes) / ${c.name}`, {
        type: 'MATCH_FOLLOWING', questionText: `Match the following: ${c.stem}.`,
        matchPairs: left.map((l, i) => ({ left: l, right: right[i] })),
        options: ['A-(Q); B-(P); C-(S); D-(R)', 'A-(P); B-(Q); C-(R); D-(S)', 'A-(S); B-(R); C-(Q); D-(P)', 'A-(R); B-(S); C-(P); D-(Q)'], correct_option: key,
    }, { kind: 'match', rows: 4, options: 4, keyIdx, harmonized: true });
    // 10. Match with columns written in the text
    add(`Match (columns in text) / ${c.name}`, {
        type: 'MATCH_FOLLOWING',
        questionText: `Match the items: ${c.stem}.\n\n**Column I**\n${left.map((l, i) => `(${'ABCD'[i]}) ${l}`).join('\n')}\n\n**Column II**\n${right.map((r, i) => `(${i + 1}) ${r}`).join('\n')}`,
        options: ['A-(2), B-(1), C-(4), D-(3)', 'A-(1), B-(2), C-(3), D-(4)', 'A-(4), B-(3), C-(2), D-(1)', 'A-(3), B-(4), C-(1), D-(2)'], correct_option: key,
    }, { kind: 'match', rows: 4, options: 4, keyIdx, harmonized: true, stemNot: /Property 1/ });

    // 11. Assertion-reason in the text, options filled in
    add(`Assertion-Reason (text) / ${c.name}`, {
        type: 'ASSERTION_REASON', questionText: `Assertion (A): ${c.stem}.\nReason (R): ${c.opts[0]} is the reason.`, options: [], correct_option: key,
    }, { kind: 'assertion', options: 4, keyIdx });
    // 12. Assertion-reason typed MCQ but written as A/R
    add(`Assertion-Reason (typed MCQ) / ${c.name}`, {
        type: 'MCQ', questionText: `Assertion: ${c.stem}.\nReason: ${c.opts[1]} explains it.`,
        options: ['Both A and R are true and R explains A', 'Both A and R are true but R does not explain A', 'A is true but R is false', 'A is false but R is true'], correct_option: key,
    }, { kind: 'assertion', options: 4, keyIdx });

    // 13. Numerical
    add(`Numerical / ${c.name}`, { type: 'NUMERICAL', questionText: `${c.stem}? Give the value.`, num_answer: String(ci + 2) }, { kind: 'numerical', options: 0, answer: String(ci + 2) });
    // 14. Integer type
    add(`Integer / ${c.name}`, { type: 'INTEGER', questionText: `${c.stem}? Answer as an integer.`, answer: String(ci + 1) }, { kind: 'numerical', options: 0, answer: String(ci + 1) });
    // 15. True / false
    add(`True-False / ${c.name}`, { type: 'TRUE_FALSE', questionText: `${c.stem} equals ${c.opts[0]}.`, options: [], correct_option: 'A' }, { kind: 'truefalse', options: 2, keyIdx: 0 });

    // 16. Options embedded in the question text (no options array)
    add(`MCQ (options in text) / ${c.name}`, {
        type: 'MCQ', questionText: `${c.stem}?\n(a) ${c.opts[0]}\n(b) ${c.opts[1]}\n(c) ${c.opts[2]}\n(d) ${c.opts[3]}`, correct_option: key,
    }, { kind: 'mcq', options: 4, keyIdx, stemNot: new RegExp(`\\(d\\)`) });
    // 16b. Numbered options embedded in the question text
    add(`MCQ (numbered options in text) / ${c.name}`, {
        type: 'MCQ', questionText: `${c.stem}?\n(1) ${c.opts[0]}\n(2) ${c.opts[1]}\n(3) ${c.opts[2]}\n(4) ${c.opts[3]}`, correct_option: key,
    }, { kind: 'mcq', options: 4, keyIdx, stemNot: /\(4\)/ });
    // 17. Diagram placed in the text as markdown
    add(`MCQ (markdown diagram) / ${c.name}`, {
        type: 'MCQ', questionText: `${c.stem}?\n![figure](https://example.com/q${ci}.png)`, options: c.opts, correct_option: key,
    }, { kind: 'mcq', options: 4, keyIdx, diagram: true, stemNot: /!\[/ });
    // 18. Question field named `question` instead of questionText, with a solution
    add(`MCQ (question field + solution) / ${c.name}`, {
        type: 'MCQ', question: `${c.stem}?`, options: c.opts, correct_option: key, solutionText: `Since ${c.opts[keyIdx]} is correct.`,
    }, { kind: 'mcq', options: 4, keyIdx, solution: true });
    // 19. Five-row match
    const left5 = [...left, `${c.opts[0]} (item 5)`];
    const right5 = [...right, `Property 5 of ${c.opts[1]}`];
    add(`Match (five rows) / ${c.name}`, {
        type: 'MATCH_FOLLOWING', questionText: `Match Column I with Column II: ${c.stem}.`,
        matchPairs: left5.map((l, i) => ({ left: l, right: right5[i] })),
        options: ['A-(2), B-(1), C-(4), D-(3), E-(5)', 'A-(1), B-(2), C-(3), D-(4), E-(5)', 'A-(5), B-(4), C-(3), D-(2), E-(1)', 'A-(3), B-(5), C-(1), D-(2), E-(4)'], correct_option: key,
    }, { kind: 'match', rows: 5, options: 4, keyIdx, harmonized: true });
    // 20. Four statements in the text with numeric labels
    add(`Statement (in text, 1-4) / ${c.name}`, {
        type: 'STATEMENT_BASED',
        questionText: `Read the statements:\nStatement 1: ${c.stem}.\nStatement 2: ${c.opts[0]} holds.\nStatement 3: ${c.opts[1]} holds.\nStatement 4: ${c.opts[2]} holds.\nHow many are correct?`,
        options: ['1', '2', '3', '4'], correct_option: key,
    }, { kind: 'statement', statements: 4, options: 4, keyIdx });
});

// ---- the checks ----------------------------------------------------------------------------------------------------------
test(`question type matrix has 500+ cases (${cases.length})`, () => {
    assert.ok(cases.length >= 500, `only ${cases.length} cases`);
});

for (const { name, q, expect } of cases) {
    test(name, () => {
        const m = buildQuestionPreview(q);
        assert.ok(m, 'no preview');
        assert.equal(m.kind, expect.kind, 'kind');

        // nothing the card prints shows raw code or junk
        const parts = previewParts(m);
        assert.ok(parts.length > 0, 'card prints nothing');
        for (const p of parts) assertPrintsClean(p.text, p.where);
        if (expect.solution) assertPrintsClean(m.solution, 'solution');

        if (expect.kind !== 'statement' && expect.kind !== 'assertion') assert.ok(m.stem.trim(), 'question text is empty');
        if (expect.stemHas) assert.match(m.stem, expect.stemHas, 'stem');
        if (expect.stemNot) assert.doesNotMatch(m.stem, expect.stemNot, 'stem repeats something shown elsewhere');

        if (expect.statements != null) {
            assert.equal(m.statements.length, expect.statements, 'statement count');
            for (const s of m.statements) assert.ok(s.label && s.text.trim(), 'statement label / text');
        }
        if (expect.kind === 'assertion') {
            assert.ok(m.assertion.trim(), 'assertion missing');
            assert.ok(m.reason.trim(), 'reason missing');
        }
        if (expect.rows != null) {
            assert.ok(m.columns, 'no columns');
            assert.equal(m.columns.left.length, expect.rows, 'Column I rows');
            assert.equal(m.columns.right.length, expect.rows, 'Column II rows');
            assert.deepEqual(m.columns.left.map(c => c.label), 'ABCDE'.slice(0, expect.rows).split(''));
        }
        if (expect.harmonized) {
            for (const o of m.options) {
                assert.doesNotMatch(o.text, /\b(?:i|ii|iii|iv)\s*(?:→|->|-)\s*[a-d]\b|\([PQRS]\)/, `option not in table labels: ${o.text}`);
                assert.match(o.text, /^A-\(\d\)/, `option not in table labels: ${o.text}`);
            }
        }
        if (expect.diagram) assert.match(String(m.diagramUrl || ''), /^https:\/\/example\.com\//, 'diagram missing');

        assert.equal(m.options.length, expect.options, 'option count');
        if (expect.keyIdx != null) {
            assert.deepEqual(m.options.map((o, i) => (o.correct ? i : -1)).filter(i => i >= 0), [expect.keyIdx], 'correct option');
        }
        if (expect.answer != null) assert.equal(m.answerText, expect.answer, 'numerical answer');
    });
}
