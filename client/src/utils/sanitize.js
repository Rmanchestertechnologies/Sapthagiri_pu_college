/**
 * client/src/utils/sanitize.js
 * Client-side HTML sanitization using DOMPurify.
 * Apply to ALL dangerouslySetInnerHTML content to prevent XSS.
 */
import DOMPurify from 'dompurify';

// Allowed tags for mathematical/scientific question rendering
const CONFIG = {
    ALLOWED_TAGS: [
        'b', 'i', 'u', 'em', 'strong', 'sup', 'sub', 'br', 'span', 'p',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'math', 'mrow', 'mi', 'mn', 'mo', 'mfrac', 'msup', 'msub', 'mspace',
        'mtext', 'mover', 'munder', 'munderover', 'msqrt', 'mroot', 'mfenced',
        'annotation', 'semantics', 'img'
    ],
    ALLOWED_ATTR: ['class', 'style', 'colspan', 'rowspan', 'mathvariant', 'display', 'src', 'alt'],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    FORCE_BODY: false,
};

/**
 * Sanitize HTML for safe rendering in dangerouslySetInnerHTML.
 * @param {string} dirty - Raw HTML string from database
 * @returns {string} - Sanitized HTML safe for rendering
 */
export function sanitize(dirty) {
    if (!dirty || typeof dirty !== 'string') return '';
    return DOMPurify.sanitize(dirty, CONFIG);
}

/**
 * Returns an object ready for dangerouslySetInnerHTML.
 * Usage: <div {...safeHtml(content)} />
 */
export function safeHtml(dirty) {
    return { __html: sanitize(dirty) };
}

/**
 * Returns the option label for a given index based on exam type.
 * JEE → A, B, C, D   |   NEET / CET → 1, 2, 3, 4
 * @param {number} idx - 0-based option index
 * @param {string[]} classes - array of exam classes on the question (e.g. ['JEE'] or ['NEET'])
 * @returns {string} - label string like 'A' or '1'
 */
export function optionLabel(idx, classes = []) {
    const isJEE = Array.isArray(classes) && classes.some(c => String(c).toUpperCase() === 'JEE');
    return isJEE ? String.fromCharCode(65 + idx) : String(idx + 1);
}

/**
 * Detects the exact option labels used by a question (e.g. ['A', 'B', 'C', 'D'] vs ['1', '2', '3', '4'])
 */
export function getQuestionOptionLabels(q) {
    if (!q) return ['A', 'B', 'C', 'D'];
    const options = Array.isArray(q.options) ? q.options : [];
    const count = options.length || 4;

    // 1. If options array contains objects with explicit label property (e.g. { label: '1', text: '...' })
    const explicitLabels = options
        .map(opt => (typeof opt === 'object' && opt && opt.label ? String(opt.label).trim() : null))
        .filter(Boolean);
    if (explicitLabels.length === count && count > 0) {
        return explicitLabels;
    }

    // 2. Explicit question-level format flag
    const fmt = String(q.optionFormat || q.optionLabelFormat || q.optionType || '').toUpperCase();
    if (fmt.includes('1234') || fmt === 'NUMERIC' || fmt === '1') {
        return Array.from({ length: count }, (_, i) => String(i + 1));
    }
    if (fmt.includes('ABCD') || fmt === 'ALPHA' || fmt === 'A') {
        return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
    }

    // 3. Detect from answer format: if answer is explicitly a number '1', '2', '3', '4', use numeric
    const rawAns = String(q.answer ?? q.correct_option ?? q.correctAnswer ?? '').trim();
    if (/^[1-9]$/.test(rawAns)) {
        return Array.from({ length: count }, (_, i) => String(i + 1));
    }
    if (/^[A-Da-d]$/.test(rawAns)) {
        return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
    }

    // 4. Fall back to exam type convention:
    const isJEE = Array.isArray(q.classes) && q.classes.some(c => String(c).toUpperCase() === 'JEE');
    return Array.from({ length: count }, (_, i) => isJEE ? String.fromCharCode(65 + i) : String(i + 1));
}

/**
 * Returns the exact option label for a question's correct answer.
 * Preserves whether the question used 1, 2, 3, 4 or A, B, C, D.
 * Resolves full option text strings (e.g. "$\propto(1/C)$", "0.281 V") to the exact option label.
 */
export function getResolvedAnswerLabel(q) {
    if (!q) return 'N/A';
    const rawAns = q.answer ?? q.correct_option ?? q.correctAnswer ?? '';
    const options = Array.isArray(q.options) ? q.options : [];
    const labels = getQuestionOptionLabels(q);

    const cleanRaw = String(rawAns).trim();
    if (!cleanRaw) return 'N/A';

    // 1. Check if rawAns is an exact numeric index
    if (typeof rawAns === 'number') {
        const idx = rawAns >= 1 && rawAns <= options.length ? rawAns - 1 : rawAns;
        if (idx >= 0 && idx < labels.length) return labels[idx];
    }
    if (/^[1-9]$/.test(cleanRaw)) {
        const num = parseInt(cleanRaw, 10);
        const idx = num - 1;
        if (idx >= 0 && idx < labels.length) return labels[idx];
    }

    // 2. Check if rawAns is a letter 'A', 'B', 'C', 'D' (or '(A)', 'A.')
    const letterMatch = cleanRaw.match(/^[\(]?([A-Da-d])[\)\.]?$/);
    if (letterMatch) {
        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < labels.length) return labels[idx];
    }

    // 3. Match against explicit label in labels array
    const exactLabelIdx = labels.findIndex(lbl => lbl.toUpperCase() === cleanRaw.toUpperCase());
    if (exactLabelIdx !== -1) return labels[exactLabelIdx];

    // 4. Match against option text (for questions where answer was stored as full text string)
    const cleanStr = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/[\$\s\\{}]/g, '').toLowerCase();
    const targetStr = cleanStr(cleanRaw);

    if (targetStr && options.length > 0) {
        const matchedOptIdx = options.findIndex((opt) => {
            const optText = typeof opt === 'object' && opt ? (opt.text || opt.optionText || '') : String(opt || '');
            const candidate = cleanStr(optText);
            if (!candidate) return false;
            if (candidate === targetStr) return true;
            if (targetStr.length > 4 && (candidate.includes(targetStr) || targetStr.includes(candidate))) return true;
            return false;
        });

        if (matchedOptIdx !== -1 && matchedOptIdx < labels.length) {
            return labels[matchedOptIdx];
        }
    }

    // Return clean raw string if numerical or open-ended
    return cleanRaw;
}

/**
 * Strips QPV, QBP, and internal metadata difficulty tags before display.
 * Removes patterns like [QPV_DIFFICULTY:Easy], [QBP_DIFFICULTY:Medium], [DIFFICULTY:Hard], etc.
 * @param {string} text
 * @returns {string}
 */
export function stripQBPTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();
}

