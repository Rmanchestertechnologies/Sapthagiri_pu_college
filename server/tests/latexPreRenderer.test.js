/**
 * Server-side math pre-rendering used by the PDF and Word exports. No database required.
 */
const { normalizeLatex, preRenderMath } = require('../utils/latexPreRenderer');

const hasError = html => /katex-error|raw-math/.test(html);

describe('normalizeLatex', () => {
    test('REGRESSION: commands inside existing $...$ are not wrapped a second time', () => {
        const input = 'Find $x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$ now';
        expect(normalizeLatex(input)).toBe(input);
    });

    test('commands after "{", "=" and "^" inside math stay intact', () => {
        for (const m of ['$\\int_0^{\\pi}\\sin\\theta\\,d\\theta$', '$\\dfrac{\\pi^2}{6}$', '$\\vec{F}\\cdot\\vec{v}$', '$$\\sum_{n=1}^{\\infty}\\frac{1}{n^2}$$']) {
            expect(normalizeLatex(m)).toBe(m);
        }
    });

    test('unwrapped commands in plain text are wrapped', () => {
        expect(normalizeLatex('Evaluate \\sqrt{2} + 3')).toContain('$\\sqrt{2}');
        expect(normalizeLatex('the symbol \\alpha here')).toContain('$\\alpha');
    });

    test('text outside math is wrapped while math in the same line is left alone', () => {
        const out = normalizeLatex('Use $\\pm$ and also \\pm outside');
        expect(out.startsWith('Use $\\pm$ and also')).toBe(true);
        expect(out.match(/\$/g).length).toBe(4);
    });

    test('currency-like dollars and empty input do not throw', () => {
        expect(() => normalizeLatex('cost is $5 and \\alpha is a symbol')).not.toThrow();
        expect(normalizeLatex('')).toBe('');
        expect(normalizeLatex(null)).toBe('');
    });
});

describe('preRenderMath', () => {
    test('REGRESSION: the equations that used to print as raw LaTeX now render', () => {
        for (const m of [
            'Roots $x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$',
            '$\\int_0^{\\pi}\\sin\\theta\\,d\\theta$',
            '$$\\sum_{n=1}^{\\infty}\\frac{1}{n^2}$$',
            '$\\vec{F}\\cdot\\vec{v}$',
            '$\\dfrac{\\pi^2}{6}$',
        ]) {
            const html = preRenderMath(m);
            expect(hasError(html)).toBe(false);
            expect(html).toContain('class="katex');
        }
    });

    test('plain text passes through unchanged', () => {
        expect(preRenderMath('A plain sentence.')).toBe('A plain sentence.');
    });
});
