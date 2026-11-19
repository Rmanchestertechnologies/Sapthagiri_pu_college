// The text -> HTML maths pipeline of the paper (no React, no DOM), so it can be run in Node tests and in `npm run check:bank`.
import katex from 'katex';
import { normalizeEquation, ensureMathDelimiters } from './mathNormalize.js';

/**
 * Fallback to clean Unicode math if KaTeX encounters an unrecoverable syntax issue.
 */
function formatCleanUnicodeMath(str) {
    if (!str) return '';
    return str
        .replace(/\\(?:frac|dfrac|cfrac)\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$1/$2')
        .replace(/\\(?:frac|dfrac|cfrac)\s+([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, '$1/$2')
        .replace(/\\times/g, '×')
        .replace(/\\pm/g, '±')
        .replace(/\\mp/g, '∓')
        .replace(/\\div/g, '÷')
        .replace(/\\cdot/g, '·')
        .replace(/\\sqrt\s*\{([^}]+)\}/g, '√($1)')
        .replace(/\\pi/g, 'π')
        .replace(/\\omega/g, 'ω')
        .replace(/\\nu/g, 'ν')
        .replace(/\\lambda/g, 'λ')
        .replace(/\\mu/g, 'μ')
        .replace(/\\theta/g, 'θ')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\epsilon/g, 'ε')
        .replace(/\\Delta/g, 'Δ')
        .replace(/\\phi/g, 'φ')
        .replace(/\\(?:sin|cos|tan|log|ln)\b/g, (m) => m.slice(1))
        .replace(/\\(?:mathrm|mathbf|text|mathit)\s*\{([^}]+)\}/g, '$1')
        .replace(/\\([a-zA-Z]+)/g, '$1')
        .replace(/[{}]/g, '')
        .trim();
}

/**
 * STEP 2: smartConvertRaw(text)
 * - Auto-convert plain-text chemistry to LaTeX (e.g. H2SO4 -> H_{2}SO_{4}, Fe^3+ -> Fe^{3+})
 * - Convert Greek words to symbols (alpha -> \alpha)
 * - Convert plain text fractions and unicode superscripts/subscripts
 */
export function smartConvertRaw(text) {
    if (!text || typeof text !== 'string') return '';
    let res = text;

    // Unicode fractions
    const fracMap = { '½': '\\frac{1}{2}', '¼': '\\frac{1}{4}', '¾': '\\frac{3}{4}', '⅓': '\\frac{1}{3}', '⅔': '\\frac{2}{3}' };
    res = res.replace(/[½¼¾⅓⅔]/g, (m) => fracMap[m]);

    // Unicode superscripts & subscripts ("10⁻³⁴", "Fe²⁺", "H₂SO₄"). A whole RUN of them is one power / index: inside maths it
    // becomes ^{-34} / _{2}; in plain text it is printed as <sup>/<sub> by processMathOnly. Converting each character on its
    // own ("^-^3^4") outside maths used to print that code on the paper, and inside maths was a "double superscript" error.
    res = convertUnicodeScripts(res, 'math');

    return res;
}

const SUPER_CHARS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ⁱ': 'i', 'ˣ': 'x' };
const SUB_CHARS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')', 'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₙ': 'n', 'ₘ': 'm' };
const SUPER_RUN = new RegExp(`[${Object.keys(SUPER_CHARS).join('')}]+`, 'g');
const SUB_RUN = new RegExp(`[${Object.keys(SUB_CHARS).join('')}]+`, 'g');
const MATH_SPAN = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;

/**
 * Turns runs of Unicode super/subscript characters into a form that prints. Inside $...$ / $$...$$ they become ^{..} / _{..}.
 * Outside maths, mode 'math' leaves them alone (the plain-text pass happens later) and mode 'html' gives <sup>..</sup> / <sub>..</sub>.
 */
export function convertUnicodeScripts(text, mode = 'html') {
    if (!text || typeof text !== 'string' || !/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₙₘ]/.test(text)) return text;
    const plain = (run, map) => [...run].map(c => map[c]).join('');
    return text.split(MATH_SPAN).map((part, i) => {
        if (i % 2 === 1) {
            return part.replace(SUPER_RUN, run => `^{${plain(run, SUPER_CHARS)}}`).replace(SUB_RUN, run => `_{${plain(run, SUB_CHARS)}}`);
        }
        if (mode !== 'html') return part;
        // a printed minus sign (U+2212), as KaTeX draws it, rather than a short hyphen
        return part.replace(SUPER_RUN, run => `<sup>${plain(run, SUPER_CHARS).replace(/-/g, '−')}</sup>`).replace(SUB_RUN, run => `<sub>${plain(run, SUB_CHARS).replace(/-/g, '−')}</sub>`);
    }).join('');
}

/**
 * STEP 3: tokenizeMarkdown(text)
 * - Convert **bold text** to <strong>bold text</strong>
 */
export function tokenizeMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}


/**
 * Safely render math with KaTeX, intercepting any errors so red katex-error spans never leak onto papers.
 */
function safeRenderKatex(rawMath, displayMode = false) {
    if (!rawMath) return '';
    const math = normalizeEquation(rawMath);

    try {
        const rendered = katex.renderToString(math, {
            displayMode,
            throwOnError: false,
            output: 'html'
        });
        // If KaTeX produced a parse error span, suppress it and return clean fallback text
        if (rendered.includes('class="katex-error"') || rendered.includes('color:#cc0000')) {
            return `<span class="inline-math font-medium">${formatCleanUnicodeMath(math)}</span>`;
        }
        return rendered;
    } catch {
        return `<span class="inline-math font-medium">${formatCleanUnicodeMath(math)}</span>`;
    }
}

/**
 * Converts a raw text string with LaTeX math delimiters into rendered HTML
 * following the exact 4-step pipeline:
 * 1. ensureMathDelimiters(text)
 * 2. smartConvertRaw(text)
 * 3. tokenizeMarkdown(text)
 * 4. KaTeX Equation Rendering with normalizeEquation
 */
export function processMathOnly(text) {
    if (!text || typeof text !== 'string') return '';

    // 0) Strip HTML entities and internal metadata tags
    let result = text
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/<span\s+class=["']katex-error["'][^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .replace(/\s*\[\s*(?:JEE|NEET|CET|AIPMT|CBSE|KCET|BITSAT|AIIMS|MHT-?CET|IIT|ADVANCED|MAIN)[\s\w\-,\(\)]*\d{4}\s*\]\s*$/i, '')
        .replace(/\s*\[\s*\d+\s*(?:Marks?|M)?\s*\]\s*$/i, '')
        .replace(/\s*\[\s*[A-Za-z]{1,5}\s*[-.]?\s*\d{1,5}\s*\]\s*$/i, '')
        .replace(/\s*\[\s*[A-Za-z0-9_\-]{2,8}\s*\]\s*$/i, '')
        .replace(/\s*Reference\s+case\s+R_?\{?[0-9a-zA-Z_\s]+\}?[0-9a-zA-Z_\s]*\.?/gi, '')
        .replace(/\s*Reference\s+case\b[^\.\n]*\.?/gi, '')
        .trim();

    // 0b. A text that is one bare formula with no $ and no words ("-\frac{x}{y}+\tan x+c", typical for an option) is typeset as a
    // whole; otherwise only the part starting at a known command was typeset and the rest ("+\tan x+c") stayed as code.
    const bare = result.replace(/\\[a-zA-Z]+/g, '');
    if (!result.includes('$') && !/\\[()[\]]/.test(result) && /\\(?!text\b|mathrm\b)[a-zA-Z]{2,}/.test(result)
        && !/[A-Za-z]{5,}/.test(bare) && !/[A-Za-z]{3,}\s+[A-Za-z]{2,}/.test(bare)) {
        result = `$${result}$`;
    }

    // 1. Step 1: Ensure math delimiters
    result = ensureMathDelimiters(result);

    // 2. Step 2: Smart convert raw text
    result = smartConvertRaw(result);

    // 3. Step 3: Tokenize markdown (**bold**)
    result = tokenizeMarkdown(result);

    // 4. Step 4: KaTeX Equation Rendering
    const mathBlocks = [];
    const saveMath = (math, isDisplay) => {
        const id = `___MATH_BLOCK_${mathBlocks.length}___`;
        mathBlocks.push(safeRenderKatex(math, isDisplay));
        return id;
    };

    // Render display math: $$...$$
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => saveMath(math, true));

    // A single "$" left unclosed (a typo in the source, e.g. "for some $c\in(0,5)," with no closing $) used to pair with a "$" in a
    // LATER equation, so the inline maths swallowed the display blocks already rendered and the whole text fell back to plain
    // text with "___MATH_BLOCK_n___" showing. Look at each stretch of text between rendered blocks on its own: if it has an odd
    // number of "$" and the text after the last one looks like maths, close it at the end of the stretch.
    const BLOCK = /(___MATH_BLOCK_\d+___)/;
    result = result.split(BLOCK).map((chunk, i) => {
        if (i % 2 === 1) return chunk;
        if ((chunk.match(/\$/g) || []).length % 2 === 0) return chunk;
        const last = chunk.lastIndexOf('$');
        return /[\\^_=]/.test(chunk.slice(last + 1)) ? chunk.replace(/\s*$/, (tail) => '$' + tail) : chunk;
    }).join('');

    // Render inline math: $...$ (never across a block that was already rendered)
    result = result.replace(/\$((?:(?!___MATH_BLOCK_)[\s\S])+?)\$/g, (_match, math) => saveMath(math, false));

    // Maths typed without any $ ("3^{x-1} + 3^{-x-1}", "(-b)^{1/(n+1)}", "H_{2}O", and plain "x^2+k", "27c^3", "e^x", "I_n"):
    // wrap each power / subscript term. A bare ^ / _ takes a number or ONE letter, as LaTeX does ("x^ny" is x to the n, then y).
    result = result.split(BLOCK).map((chunk, i) => (i % 2 === 1 ? chunk : chunk.replace(
        /(?:\((?:[^()]|\([^()]*\)){1,40}\)|[A-Za-z0-9.Ͱ-Ͽ√°]+)(?:[\^_](?:\{(?:[^{}]|\{[^{}]*\})+\}|-?[0-9]+(?:\.[0-9]+)?(?![A-Za-z_])|[A-Za-z](?![A-Za-z0-9_])|[+-](?![A-Za-z0-9({\\])))+/g,
        (term) => saveMath(term, false),
    ))).join('');

    // Render naked LaTeX math commands only in remaining plain text
    const nakedLatexRegex = /\\(?:dfrac|cfrac|frac|sqrt|pm|times|div|leq|geq|neq|approx|rightarrow|infty|sum|int|partial|theta|alpha|beta|gamma|lambda|omega|Delta|mu|sigma|epsilon|varepsilon|rho|phi|pi|tau|psi|eta|nu|xi|cdot|circ|text|mathrm|mathbf|textit|textsf|textrm|emph|mathit|underline|overline|ldots|cdots)\b(?:(?!___MATH_BLOCK_)[^{$\n])*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*/g;
    result = result.replace(nakedLatexRegex, (match) => saveMath(match, false));

    // Unicode powers / indices left in plain text ("10⁻³⁴ m", "Fe²⁺", "H₂O") print as real superscripts / subscripts
    result = convertUnicodeScripts(result, 'html');

    // Restore protected math blocks
    mathBlocks.forEach((rendered, idx) => {
        result = result.replace(`___MATH_BLOCK_${idx}___`, () => rendered);
    });

    return result;
}
