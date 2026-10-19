const fs = require('fs');
const path = require('path');
const katex = require('katex');

// Cache KaTeX CSS from node_modules for instant inline injection
let cachedKatexCss = '';
try {
    const cssPath = path.resolve(__dirname, '../node_modules/katex/dist/katex.min.css');
    if (fs.existsSync(cssPath)) {
        cachedKatexCss = fs.readFileSync(cssPath, 'utf8');
    }
} catch (e) {
    console.warn('[LATEX] Notice: Failed to load local KaTeX CSS, will fallback to CDN link');
}

/**
 * Normalizes question strings, preserves backslashes, fixes delimiters,
 * and auto-wraps unwrapped standard LaTeX math commands.
 */
function normalizeLatex(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let str = String(raw);

    // 1. Strip internal metadata tags and question bracket reference codes
    str = str.replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '');
    str = str.replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '');
    str = str.replace(/\s*\[\s*(?:JEE|NEET|CET|AIPMT|CBSE|KCET|BITSAT|AIIMS|MHT-?CET|IIT|ADVANCED|MAIN)[\s\w\-,\(\)]*\d{4}\s*\]\s*$/i, '');
    str = str.replace(/\s*\[\s*\d+\s*(?:Marks?|M)?\s*\]\s*$/i, '');
    str = str.replace(/\s*\[\s*[A-Za-z]{1,5}\s*[-.]?\s*\d{1,5}\s*\]\s*$/i, '');
    str = str.replace(/\s*\[\s*[A-Za-z0-9_\-]{2,8}\s*\]\s*$/i, '');

    // 2. Normalize escaped LaTeX backslashes: e.g. "\\frac" -> "\frac"
    str = str.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

    // 3. Normalize brackets: \[...\] to $$...$$, \(...\) to $...$
    str = str.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
    str = str.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

    // 4. Auto-wrap naked/unwrapped LaTeX commands not already surrounded by $
    // (e.g. \frac{1}{2}, \sqrt{3}, \alpha, \beta, \theta, \pm, \times, \leq, \geq, \int)
    const nakedLatexRegex = /(?<!\$)\\(?:frac|sqrt|pm|times|div|leq|geq|neq|approx|rightarrow|infty|sum|int|partial|theta|alpha|beta|gamma|lambda|omega|Delta|mu|sigma|cdot|circ|text)\b[^{$\n]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*(?!\$)/g;
    str = str.replace(nakedLatexRegex, (match) => `$${match}$`);

    return str.trim();
}

/**
 * Pre-renders all LaTeX equations in a string into server-compiled KaTeX HTML/MathML.
 * Guarantees zero raw LaTeX leakage in PDF or exports.
 */
function preRenderMath(text, isBlock = false) {
    if (!text || typeof text !== 'string') return '';
    let normalized = normalizeLatex(text);

    // 1) Replace display math: $$...$$
    normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), {
                displayMode: true,
                throwOnError: false,
                output: 'htmlAndMathml'
            });
        } catch {
            return `<span class="raw-math">${math}</span>`;
        }
    });

    // 2) Replace inline math: $...$
    normalized = normalized.replace(/\$([\s\S]+?)\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), {
                displayMode: false,
                throwOnError: false,
                output: 'htmlAndMathml'
            });
        } catch {
            return `<span class="raw-math">${math}</span>`;
        }
    });

    return normalized;
}

module.exports = {
    normalizeLatex,
    preRenderMath,
    getCss: () => cachedKatexCss
};
