import React from 'react';
import { optionLabel, cleanOptionText } from '../../utils/sanitize.js';

// one implementation for every renderer (see utils/sanitize.js)
export { cleanOptionText };

/**
 * Dynamic option grid calculator based on length and complexity:
 * - Complex formulas / long equations (e.g. Q33 vector equations): 1 column (vertical stack)
 * - 2-Column paper mode:
 *     - Short scalars / tiny choices (<= 4 chars, no math): 4 columns across
 *     - Medium (<= 18 chars, e.g. "50 minutes", short math): 2x2 grid (1fr 1fr)
 *     - Long or complex formulas: 1 column (vertical stack)
 * - 1-Column paper mode:
 *     - Short scalars (<= 10 chars, no complex math): 4 columns across
 *     - Medium (<= 32 chars): 2x2 grid
 *     - Long or complex formulas: 1 column (vertical stack)
 */
export function getDynamicOptGrid(options = [], isTwoColMode = false) {
    if (!options || options.length === 0) return { display: 'none' };

    let hasComplexFormula = false;
    let hasAnyMath = false;

    const parsedOptions = options.map((opt) => {
        if (!opt) return { text: '', len: 0, hasMath: false, isComplex: false, hasImage: false };
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : opt).trim();
        const hasImage = /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
        const clean = str.replace(/<[^>]+>/g, '').trim();

        // Detect math / LaTeX commands / symbols
        const mathMatch = /(\$|\\\(|\\\[|\\|\^|_)/i.test(clean);
        if (mathMatch) hasAnyMath = true;

        // Complex formula detection:
        // - Fractions (\frac, \dfrac)
        // - Vectors or hats (\vec, \hat)
        // - Integrals, square roots, matrices, summations (\sqrt, \int, \sum, \matrix, \begin)
        // - Long formulas with mathematical operators (+, -, =)
        const complexMatch =
            /(\\frac|\\dfrac|\\vec|\\hat|\\sqrt|\\int|\\sum|\\prod|\\matrix|\\begin|\\rightarrow|\|)/i.test(clean) ||
            (mathMatch && (clean.length > 14 || /(=|\+.*\-|\-.*\+|\^\{?\d+\}?.*_)/.test(clean)));

        if (complexMatch) {
            hasComplexFormula = true;
        }

        return {
            text: str,
            len: clean.length,
            hasMath: mathMatch,
            isComplex: complexMatch,
            hasImage,
        };
    });

    // ── HORIZONTAL GRID FOR OPTIONS WITH DIAGRAMS (Q40, Q52) ──
    const hasAnyOptionImage = parsedOptions.some((o) => o.hasImage);
    if (hasAnyOptionImage) {
        if (isTwoColMode) {
            // In 2-column mode: 2x2 grid
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '3px 6px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }
        // In 1-column mode: All 4 options laid out horizontally side-by-side!
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(4, options.length)}, minmax(0, 1fr))`,
            gap: '3px 10px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    const maxLen = Math.max(...parsedOptions.map((o) => o.len), 0);

    // ── TWO-COLUMN PAPER MODE (each column is ~350px wide) ──
    if (isTwoColMode) {
        if (hasComplexFormula) {
            return {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: '2px 6px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Short scalar choices (e.g. 0, 1, 2, 3 or A, B, C, D)
        if (maxLen <= 5 && !hasAnyMath && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Medium options (e.g. up to 22 chars): 2x2 grid
        if (maxLen <= 22 && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Long text or formulas: 1 column vertical stack
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '2px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    // ── SINGLE-COLUMN PAPER MODE (full A4 width ~730px) ──
    if (hasComplexFormula && maxLen > 28) {
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '3px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 16 && !hasComplexFormula && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
            gap: '2px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 36 && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '3px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    return {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '3px 6px',
        marginTop: '3px',
        alignItems: 'start',
    };
}

export const Q = {
    wrap: {
        display: 'inline-block',
        width: '100%',
        breakInside: 'avoid',
        WebkitColumnBreakInside: 'avoid',
        pageBreakInside: 'avoid',
        marginBottom: '0px',
        color: '#111',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        fontStyle: 'normal',
        lineHeight: '1.42',
        boxSizing: 'border-box',
        verticalAlign: 'top',
    },
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '6px',
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    num: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '24px',
        fontSize: '1em',
        lineHeight: '1.42',
        color: '#000',
    },
    body: {
        flex: 1,
        minWidth: 0,
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    qTextBold: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#000',
        display: 'inline',
        lineHeight: '1.42',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'pre-line',
    },
    marks: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        fontSize: '1em',
        alignSelf: 'flex-start',
        marginLeft: '6px',
        color: '#444',
    },
    optRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        minWidth: 0,
        maxWidth: '100%',
        fontSize: '1em',
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#111',
    },
    optLbl: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '22px',
        flexShrink: 0,
        lineHeight: '1.42',
        color: '#222',
        fontSize: '1em',
    },
    sideBySideContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '3px',
    },
    sideLeftContent: {
        flex: '1 1 auto',
        minWidth: 0,
    },
    sideRightDiagram: {
        flex: '0 0 auto',
        maxWidth: '42%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '2px',
    },
    matchTable: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '4px 0 6px',
        fontSize: '0.94em',
        tableLayout: 'auto',
        fontWeight: 400,
    },
    matchTh: {
        border: '1px solid #cbd5e1',
        padding: '3px 6px',
        background: '#f8fafc',
        fontWeight: 700,
        textAlign: 'left',
        width: '50%',
        color: '#001f6d',
        fontSize: '0.94em',
    },
    matchTd: {
        border: '1px solid #cbd5e1',
        padding: '3px 6px',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        width: '50%',
        fontWeight: 400,
        color: '#1e293b',
        fontSize: '0.94em',
        lineHeight: '1.35',
    },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '3px',
        alignItems: 'baseline',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: '1em',
        fontWeight: 400,
        lineHeight: '1.46',
    },
    assertLabel: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: '#000',
        fontSize: '1em',
        minWidth: '105px',
        flexShrink: 0,
        lineHeight: '1.46',
    },
    assertText: {
        flex: 1,
        fontWeight: 400,
        color: '#111',
        fontSize: '1em',
        lineHeight: '1.46',
    },
};

/**
 * Intelligent Layout Decision:
 * Decides whether diagram should be rendered side-by-side on the right, or inline/full-width
 */
export function shouldRenderSideBySide(q, isTwoCol = false, resolvedImageUrl = null) {
    const img = resolvedImageUrl || q.imageUrl || q.image_url;
    if (!img) return false;
    // In 2-column paper mode, column width is narrower, so inline/balanced is cleaner
    if (isTwoCol) return false;

    // Check options: if 2 to 4 options and options don't have images themselves
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length >= 2 && options.length <= 4) {
        const hasOptImg = options.some(opt => {
            const str = String(typeof opt === 'object' ? (opt.text || opt.option || '') : (opt || ''));
            return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
        });
        if (hasOptImg) return false; // Options with diagrams use horizontal grid

        const totalOptLength = options.reduce((sum, opt) => sum + String(typeof opt === 'object' ? (opt.text || opt.option || '') : (opt || '')).length, 0);
        return totalOptLength < 280; // Side-by-side works cleanly when options fit neatly on the left
    }
    return false;
}

/** Standard 4 assertion-reason options (NEET/CET format) */
export const AR_OPTIONS = [
    'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
    'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
    'Assertion is correct but Reason is incorrect.',
    'Assertion is incorrect but Reason is correct.',
];

export function getOptionLabelText(idx, optionFormat = '(1) (2) (3) (4)', customLabels = null, classes = []) {
    const fmt = String(optionFormat || '').toLowerCase();
    if (fmt.includes('1') || fmt === 'numeric' || fmt === '1234') {
        return String(idx + 1);
    }
    if (fmt.includes('(a) (b) (c) (d)') || fmt === 'lower' || fmt === 'abcd_lower') {
        return String.fromCharCode(97 + idx); // 'a', 'b', 'c', 'd'
    }
    if (fmt.includes('a') || fmt === 'alpha' || fmt === 'abcd') {
        return String.fromCharCode(65 + idx); // 'A', 'B', 'C', 'D'
    }
    if (customLabels && customLabels[idx]) {
        return customLabels[idx];
    }
    return optionLabel(idx, classes, optionFormat);
}

export function formatOptionKey(q, optionFormat = '(1) (2) (3) (4)') {
    if (!q) return '1';
    if (q.num_answer || q.type === 'NUMERICAL') {
        return String(q.num_answer || 'Numerical');
    }
    const raw = String(q.correct_option || q.answer || q.key || '1').trim();
    let idx = 0;
    if (/^[1-4]$/.test(raw)) {
        idx = parseInt(raw, 10) - 1;
    } else if (/^[A-Da-d]$/.test(raw)) {
        idx = raw.toUpperCase().charCodeAt(0) - 65;
    } else {
        const opts = q.options || [];
        const found = opts.findIndex(o => {
            const str = typeof o === 'object' ? (o.text || o.option || '') : String(o);
            return str.trim() === raw;
        });
        if (found >= 0) idx = found;
    }
    return getOptionLabelText(idx, optionFormat);
}

export function isOptionSelectedCorrect(optIdx, q) {
    if (!q) return false;
    const raw = String(q.correct_option || q.answer || '').trim();
    if (!raw) return false;

    const optLetter = String.fromCharCode(65 + optIdx);
    const optNum = String(optIdx + 1);
    const cleaned = raw.replace(/^Option\s*/i, '').replace(/[()\[\]]/g, '').trim().toUpperCase();

    if (/^[1-4]$/.test(cleaned)) {
        return parseInt(cleaned, 10) - 1 === optIdx;
    }
    if (/^[A-D]$/.test(cleaned)) {
        return cleaned === optLetter;
    }
    const romanMap = { 'I': 0, 'II': 1, 'III': 2, 'IV': 3 };
    if (romanMap[cleaned] !== undefined) {
        return romanMap[cleaned] === optIdx;
    }
    if (/[A-D]/.test(cleaned)) {
        const letters = cleaned.replace(/[^A-D]/g, '').split('');
        if (letters.includes(optLetter)) return true;
    }
    if (/[1-4]/.test(cleaned)) {
        const nums = cleaned.replace(/[^1-4]/g, '').split('');
        if (nums.includes(optNum)) return true;
    }
    const opts = q.options || [];
    if (opts[optIdx]) {
        const str = typeof opts[optIdx] === 'object' ? (opts[optIdx].text || opts[optIdx].option || '') : String(opts[optIdx]);
        if (str.trim().toLowerCase() === raw.toLowerCase()) return true;
    }
    return false;
}

const ROMAN_TO_NUMBER = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
const PQRS_TO_NUMBER = { p: 1, q: 2, r: 3, s: 4, t: 5 };
const MAPPING_PART = /^\s*\(?\s*([a-hA-H])\s*\)?\s*(?:[-\u2013\u2014:\u2192]|\\to|\\rightarrow|->)\s*\(?\s*(viii|vii|vi|iv|iii|ii|i|v|[1-8]|[p-tP-T])\s*\)?\s*\.?\s*$/i;

/**
 * Match-the-following answer options such as "a-(iii), b-(iv), c-(i), d-(ii)" are shown with the same labels the two columns use:
 * capital letters for Column I and numbers for Column II, e.g. "A-(3), B-(4), C-(1), D-(2)". Anything that is not a plain list of
 * letter-to-item mappings is returned unchanged.
 */
export function harmonizeMatchCode(text) {
    if (typeof text !== 'string') return text;
    const cleaned = text.replace(/\$/g, '').trim();
    if (!cleaned) return text;
    const parts = cleaned.split(/\s*[,;]\s*/).filter(Boolean);
    if (parts.length < 2) {
        if (!MAPPING_PART.test(cleaned)) return text;
    }
    const out = [];
    for (const part of parts) {
        const m = MAPPING_PART.exec(part);
        if (!m) return text;
        const word = m[2].toLowerCase();
        const number = /^[1-8]$/.test(word) ? Number(word) : (ROMAN_TO_NUMBER[word] || PQRS_TO_NUMBER[word]);
        if (!number) return text;
        out.push(`${m[1].toUpperCase()}-(${number})`);
    }
    return out.join(', ');
}
