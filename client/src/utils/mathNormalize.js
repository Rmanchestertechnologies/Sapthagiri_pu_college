/**
 * STEP 4: Equation Normalization before passing to KaTeX
 * - convert ^([0-9]+[+-]) to ^{$1} (e.g. Li^2+ -> Li^{2+}, Fe^3+ -> Fe^{3+})
 * - replace √ with \surd
 * - replace × with \times
 * - replace ° with ^{\circ}
 */
export function normalizeEquation(rawMath) {
    if (!rawMath) return '';
    let eq = String(rawMath).trim();

    // Strip leading / trailing quotes or stray punctuation that break math mode
    eq = eq.replace(/^[\$'"`,;:]+/, '').replace(/[\$'"`,;:]+$/, '').trim();

    // Fix exponent charges: ^([0-9]+[+-]) -> ^{$1}
    eq = eq.replace(/\^([0-9]+[+-])/g, '^{$1}');

    // \tag only works in display maths; in inline maths show the equation number as plain "(1)" instead of failing
    eq = eq.replace(/\\tag\*?\s*\{([^{}]*)\}/g, '\\quad(\\text{$1})');

    // A command typed inside \text{...} (e.g. \text{ \mu T}) is not allowed by KaTeX: step out of the text for it
    eq = eq.replace(/\\text\{([^{}]*)\}/g, (whole, inner) => {
        if (!/\\[a-zA-Z]+/.test(inner)) return whole;
        return inner.split(/(\\[a-zA-Z]+)/).map(part => (/^\\[a-zA-Z]+$/.test(part) ? `${part} ` : (part ? `\\text{${part}}` : ''))).join('');
    });

    // Convert unicode symbols to LaTeX
    eq = eq.replace(/√/g, '\\surd ');
    eq = eq.replace(/×/g, '\\times ');
    eq = eq.replace(/°/g, '^{\\circ}');

    // Clean unmatched closing braces
    const openB = (eq.match(/\{/g) || []).length;
    const closeB = (eq.match(/\}/g) || []).length;
    if (closeB > openB) {
        eq = eq.replace(/([0-9a-zA-Z\s\.,\\_]+)\}\s*$/, '$1');
        if ((eq.match(/\}/g) || []).length > openB) {
            eq = eq.replace(/\}\s*$/, '');
        }
    }

    return eq;
}

/**
 * STEP 1: ensureMathDelimiters(text)
 * - Fix broken LaTeX boundaries
 * - Convert \( and \) to standard $, and \[ and \] to standard $$...$$
 * - Wrap naked \begin{...} \end{...} blocks in $$...$$
 */
export function ensureMathDelimiters(text) {
    if (!text || typeof text !== 'string') return '';
    let res = text;
    // Wrap naked \begin{...}...\end{...} blocks in $$...$$ - but only blocks that are NOT already inside $...$ / $$...$$ maths
    // (a matrix written as "$$ f(x) = \begin{vmatrix} ... \end{vmatrix} $$" used to get wrapped a second time and broke)
    res = res.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g).map((part, i) => (
        i % 2 === 1 ? part : part.replace(/\\begin\{(matrix|pmatrix|bmatrix|vmatrix|aligned|align|array|cases)\}([\s\S]*?)\\end\{\1\}/g, '$$\\begin{$1}$2\\end{$1}$$')
    )).join('');
    // Convert \[...\] to $$...$$
    res = res.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
    // Convert \(...\) to $...$
    res = res.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
    return res;
}
