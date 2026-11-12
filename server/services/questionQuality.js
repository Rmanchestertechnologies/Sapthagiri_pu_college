/**
 * Data-quality rules for rows of a question-bank table (public.questions). Pure functions: nothing here reads or writes a
 * database. scripts/question_bank_quality_report.js feeds rows through checkRow() and prints a report; nothing is changed.
 *
 * Each check returns a short code. The codes are deliberately conservative: a flagged row is a candidate for a human to look
 * at, not a proven error.
 */

const ISSUES = {
    EMPTY_QUESTION: 'Question text is empty or shorter than 10 characters',
    NO_OPTIONS: 'Option-based question with fewer than two options',
    DUPLICATE_OPTIONS: 'Two options have identical text',
    BAD_CORRECT_OPTION: 'correct_option is missing, not A-D, or points at an empty option',
    NUMERICAL_TEXT_ANSWER: 'Numerical question whose answer is not a number',
    UNBALANCED_MATH: 'Odd number of $ delimiters (a math span is not closed)',
    BROKEN_FRACTION: 'Garbled LaTeX such as "\\sigma}2" (a fraction that lost its opening)',
    UNCLEAR_MARKER: 'Contains an [UNCLEAR] placeholder',
    LEAKED_MARKER: 'Contains an internal marker (QBP_ / QPV_ / "Reference case") in visible text',
    AR_WITHOUT_REASON: 'Assertion-Reason question with no Reason',
    DUPLICATE_QUESTION: 'Same question text appears more than once in this database'
};

const text = v => (v == null ? '' : String(v));

function optionsOf(row) {
    const out = [];
    for (const k of ['opt_a', 'opt_b', 'opt_c', 'opt_d']) if (text(row[k]).trim()) out.push({ letter: k.slice(-1).toUpperCase(), text: text(row[k]).trim() });
    if (out.length === 0) {
        for (const k of ['option_a', 'option_b', 'option_c', 'option_d']) if (text(row[k]).trim()) out.push({ letter: k.slice(-1).toUpperCase(), text: text(row[k]).trim() });
    }
    if (out.length === 0 && Array.isArray(row.options)) {
        row.options.forEach((o, i) => {
            const t = typeof o === 'object' && o ? text(o.text || o.optionText) : text(o);
            if (t.trim()) out.push({ letter: String.fromCharCode(65 + i), text: t.trim() });
        });
    }
    return out;
}

function isNumerical(row) {
    return /numer|integer/i.test(text(row.q_type) || text(row.type));
}

function isOptionless(row) {
    // numerical, and the two types that carry their content in other columns, do not need A-D options to be valid
    return isNumerical(row);
}

function dollarCount(s) {
    return (text(s).replace(/\\\$/g, '').match(/\$/g) || []).length;
}

/** Returns the list of issue codes found on one row. `seenTexts` (a Set) enables the duplicate-question check. */
function checkRow(row, seenTexts = null) {
    const issues = [];
    const q = text(row.question || row.questionText);
    const opts = optionsOf(row);
    const qType = text(row.q_type || row.type).toLowerCase();

    if (q.trim().length < 10) issues.push('EMPTY_QUESTION');

    if (!isOptionless(row)) {
        if (opts.length < 2) issues.push('NO_OPTIONS');
        const seen = new Set();
        for (const o of opts) {
            const key = o.text.toLowerCase().replace(/\s+/g, ' ');
            if (seen.has(key)) { issues.push('DUPLICATE_OPTIONS'); break; }
            seen.add(key);
        }
        if (opts.length >= 2) {
            const raw = text(row.correct_option).trim().toUpperCase();
            const letter = /^[A-D]$/.test(raw) ? raw : (/^[1-4]$/.test(raw) ? String.fromCharCode(64 + Number(raw)) : '');
            if (!letter || !opts.some(o => o.letter === letter)) issues.push('BAD_CORRECT_OPTION');
        }
    } else {
        const ans = text(row.answer).trim();
        if (ans && !/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(ans.replace(/,/g, '').replace(/\s+/g, ''))) issues.push('NUMERICAL_TEXT_ANSWER');
    }

    const visible = [q, ...opts.map(o => o.text), text(row.solution_text), text(row.assertion), text(row.reason)];
    if (visible.some(s => dollarCount(s) % 2 === 1)) issues.push('UNBALANCED_MATH');
    // a garbled fraction closes a brace it never opened, e.g. "\sigma}2\epsilon_0": more "}" than "{" (escaped braces ignored)
    const braceDeficit = s => {
        const t = s.replace(/\\[{}]/g, '');
        return (t.match(/\}/g) || []).length - (t.match(/\{/g) || []).length;
    };
    if (visible.some(s => braceDeficit(s) > 0)) issues.push('BROKEN_FRACTION');
    if ([text(row.concept), text(row.topic), q, text(row.solution_text)].some(s => /\[\s*UNCLEAR\s*\]/i.test(s))) issues.push('UNCLEAR_MARKER');
    if ([q, ...opts.map(o => o.text)].some(s => /\[(?:QBP|QPV)_[A-Z_]+:|Reference\s+case/i.test(s))) issues.push('LEAKED_MARKER');
    if (/assertion/.test(qType) && !/reason/i.test(q) && !text(row.reason).trim()) issues.push('AR_WITHOUT_REASON');

    if (seenTexts) {
        const key = q.toLowerCase().replace(/\s+/g, ' ').trim();
        if (key.length >= 25) {
            if (seenTexts.has(key)) issues.push('DUPLICATE_QUESTION');
            else seenTexts.add(key);
        }
    }
    return issues;
}

module.exports = { ISSUES, checkRow, optionsOf };
