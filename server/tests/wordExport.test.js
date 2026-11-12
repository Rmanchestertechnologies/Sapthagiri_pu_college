const { latexToEditableText: f } = require('../services/wordExport');

describe('Word export: LaTeX to editable text', () => {
    test('\\dfrac and \\tfrac are fractions, including nested groups', () => {
        expect(f('\\dfrac{a_0}{\\sqrt{150}}')).toBe('(a₀ / (√(150)))'.replace('(√(150))', '√(150)'));
        expect(f('\\tfrac{1}{2}')).toBe('(1 / 2)');
        expect(f('\\frac{\\frac{1}{2}}{3}')).toBe('((1 / 2) / 3)');
        expect(f('\\frac12')).toBe('(1 / 2)');
        expect(f('E = \\frac{1}{2}mv^2')).toBe('E = (1 / 2)mv²');
    });

    test('greek letters and symbols directly before a subscript or digit are converted', () => {
        expect(f('\\nu_0')).toBe('ν₀');
        expect(f('2\\nu_0')).toBe('2ν₀');
        expect(f('\\dfrac{\\nu_0}{2}')).toBe('(ν₀ / 2)');
        expect(f('\\alpha_{12}+\\beta^2')).toBe('α₁₂+β²');
        expect(f('x \\times 10^{-3} \\, m')).toContain('× 10⁻³');
    });

    test('ordinal superscripts', () => {
        expect(f('The 1^st line of H_2')).toBe('The 1ˢᵗ line of H₂');
        expect(f('the 2^{nd} orbit')).toBe('the 2ⁿᵈ orbit');
    });

    test('no raw LaTeX commands or dollar signs survive', () => {
        const out = f('$\\dfrac{\\sigma}{2\\epsilon_0} \\leq \\sqrt{\\dfrac{a}{b}}$');
        expect(out).not.toMatch(/\\|\$/);
    });
});

describe('Word export: question text cleanup', () => {
    const { cleanQuestionText } = require('../services/wordExport');
    test('markdown bold markers are removed', () => {
        expect(cleanQuestionText('Match List-I with List-II.\n**Column I**\nx')).toBe('Match List-I with List-II.\nColumn I\nx');
    });
    test('a lone pair of asterisks across lines is left alone', () => {
        expect(cleanQuestionText('a ** b\nc ** d')).toBe('a ** b\nc ** d');
    });
});
