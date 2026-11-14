import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { normalizeEquation, ensureMathDelimiters } from '../src/utils/mathNormalize.js';

const R = String.raw;
const render = (m) => katex.renderToString(normalizeEquation(m), { output: 'html', throwOnError: true });

// Real snippets from the question bank that used to fail to render
test('an equation number (\\tag) inside inline maths renders', () => {
    const html = render(R`2f(x)+f(1-x)=x^2.\tag{1}`);
    assert.ok(!html.includes('katex-error'));
    assert.match(html, /class="mord text"><span class="mord">1<\/span><\/span><span class="mclose">\)/); // "(1)" at the end
});

test('a command inside \\text{} (\\text{ \\mu T}) renders as a symbol, not an error', () => {
    const html = render(R`24\text{ \mu T}`);
    assert.ok(html.includes('μ'));
    assert.ok(!html.includes('katex-error'));
});

test('plain \\text{} and unicode symbols are left alone', () => {
    assert.doesNotThrow(() => render(R`5\text{ m/s}`));
    assert.doesNotThrow(() => render('√2 × 3 ° '));
    assert.equal(normalizeEquation(R`5\text{ m/s}`), R`5\text{ m/s}`);
});

test('roots, fractions, left/right and arrows all render without errors', () => {
    for (const m of [R`\frac{P}{\sqrt3}`, R`\sqrt3P`, R`20\sqrt{2}`, R`\left(1-\frac{1}{n^2}\right)`, R`\sqrt{1-\frac{1}{n^2}}`, R`\xrightarrow{\Delta}`, R`\begin{vmatrix}a&b\\c&d\end{vmatrix}`, R`\lim_{x\to0}\frac{\sin x}{x}`]) {
        assert.doesNotThrow(() => render(m), m);
    }
});

// A matrix written inside $$ ... $$ used to be wrapped a second time, which nested the delimiters and printed raw text
test('a matrix already inside $$...$$ is left exactly as written', () => {
    const src = R`Let $$f(x)=\begin{vmatrix}a&1\\a&b\end{vmatrix},\qquad x\ne0.$$ Then`;
    assert.equal(ensureMathDelimiters(src), src);
});

test('a bare matrix outside any maths is still wrapped', () => {
    const out = ensureMathDelimiters(R`Find \begin{pmatrix}1&2\\3&4\end{pmatrix} now`);
    assert.ok(out.startsWith('Find $'));
    assert.ok(out.includes(R`\begin{pmatrix}`));
    assert.ok(!out.includes('$$$'));
});

test('text with several maths spans and one bare matrix keeps every span intact', () => {
    const out = ensureMathDelimiters(R`If $x=1$ and \begin{bmatrix}1\end{bmatrix} then $y=2$`);
    assert.ok(out.includes('$x=1$') && out.includes('$y=2$'));
});
