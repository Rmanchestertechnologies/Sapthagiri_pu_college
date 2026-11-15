import test from 'node:test';
import assert from 'node:assert/strict';
import { processMathOnly } from '../src/utils/mathPipeline.js';

const R = String.raw;
const fellBack = (h) => h.includes('inline-math font-medium') || h.includes('katex-error');
const noPlaceholder = (h) => !h.includes('___MATH_BLOCK_');

test('a single unclosed $ no longer swallows the equations after it (real solution text)', () => {
    const t = R`We have
$$g(0)=4,\qquad g(5)=-\frac16.$$
By Lagrange's Mean Value Theorem, for some $c\in(0,5),
$$g'(c)=\frac{g(5)-g(0)}5$$
Hence
$$\frac{P+q}{Pq}=\frac56.$$`;
    const h = processMathOnly(t);
    assert.ok(!fellBack(h));
    assert.ok(noPlaceholder(h));
    assert.ok(!h.includes('$'));
    assert.equal((h.match(/class="katex"/g) || []).length, 4);
});

test('balanced maths is untouched by the repair', () => {
    const h = processMathOnly(R`If $x=1$ and $y=2$ then $$z=3$$ holds`);
    assert.equal((h.match(/class="katex"/g) || []).length, 3);
    assert.ok(!h.includes('$'));
});

test('maths typed without $ (powers and subscripts) is rendered', () => {
    for (const t of ['If y = 3^{x−1} + 3^{−x−1}, then', 'the term (−b)^{1/(n+1)} is', 'roots α and α^{n+1} = c/a', 'with y = (7 + 4√3)^{|x| − 8}', 'at x = (b/(2a))^{1/3}, so']) {
        const h = processMathOnly(t);
        assert.ok(h.includes('class="katex"'), t);
        assert.ok(!/\^\{/.test(h.replace(/<[^>]+>/g, '')), t);
        assert.ok(!fellBack(h), t);
    }
});

test('plain text with no maths is returned as it was', () => {
    assert.equal(processMathOnly('Which of the following is a prime number?'), 'Which of the following is a prime number?');
});

test('bare \\textit and an align* block render', () => {
    const a = processMathOnly(R`\textit{Haemophilus influenzae} is responsible for pneumonia`);
    assert.ok(a.includes('class="katex"') && !a.includes('\\textit'));
    const b = processMathOnly(R`Expand:
\begin{align*}
(\sec x+\tan x)^2 &= \sec^2 x + 2\sec x\tan x + \tan^2 x \\
&= 2\sec^2 x + 2\sec x\tan x - 1
\end{align*}
Done`);
    assert.ok(!fellBack(b));
    assert.ok(b.includes('class="katex'));
});

test('a bare command never swallows an already rendered equation', () => {
    const h = processMathOnly(R`so \int dx/$$x^2$$ + x`);
    assert.ok(noPlaceholder(h));
});

test('an option that is a bare formula (no $) is typeset whole, not only its first command', () => {
    const h = processMathOnly(String.raw`-\frac{x\sec x}{x\sin x+\cos x}+\tan x+c`);
    assert.ok(h.includes('class="katex"'));
    assert.ok(!/\tan/.test(h.replace(/<[^>]+>/g, '')));
    assert.equal((h.match(/class="katex"/g) || []).length, 1);
});

test('plain words with a unit command are not turned into a formula', () => {
    const h = processMathOnly(String.raw`The current is 0.49 \text{ A} in the wire`);
    assert.ok(h.startsWith('The current is'));
});
