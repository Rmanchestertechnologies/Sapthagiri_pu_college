/**
 * Proposes (never applies) corrections for rows flagged by questionQuality. Pure functions.
 *
 * Only one class of problem has an unambiguous machine fix: `correct_option` is missing/invalid but the `answer` column holds
 * the text of exactly ONE option. Everything else is listed for a person to decide, with a reason.
 */
const { checkRow, optionsOf } = require('./questionQuality');

const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[$\s]+/g, ' ').trim();

/** Letter of the single option whose text equals the answer text, or null when none / more than one matches. */
function letterFromAnswerText(row) {
    const ans = norm(row.answer);
    if (!ans) return null;
    const hits = optionsOf(row).filter(o => norm(o.text) === ans);
    return hits.length === 1 ? hits[0].letter : null;
}

/**
 * @returns {Array<{issue, action, field, current, proposed, confidence, note}>}
 * action: 'SET' (a concrete proposed value) or 'REVIEW' (a person must decide)
 */
function proposeFixes(row, seenTexts = null) {
    const issues = checkRow(row, seenTexts);
    const out = [];
    for (const issue of issues) {
        if (issue === 'BAD_CORRECT_OPTION') {
            const letter = letterFromAnswerText(row);
            if (letter) {
                out.push({ issue, action: 'SET', field: 'correct_option', current: row.correct_option ?? '', proposed: letter, confidence: 'high', note: 'answer text equals exactly one option' });
            } else {
                out.push({ issue, action: 'REVIEW', field: 'correct_option', current: row.correct_option ?? '', proposed: '', confidence: 'none', note: 'answer text does not identify exactly one option' });
            }
        } else if (issue === 'NO_OPTIONS' || issue === 'EMPTY_QUESTION') {
            out.push({ issue, action: 'REVIEW', field: 'row', current: '', proposed: '', confidence: 'none', note: 'cannot be used in a paper; fill in the missing content or retire the row (the selector already skips it)' });
        } else if (issue === 'DUPLICATE_QUESTION') {
            out.push({ issue, action: 'REVIEW', field: 'row', current: '', proposed: '', confidence: 'none', note: 'identical text exists elsewhere in this database; keep one' });
        } else {
            out.push({ issue, action: 'REVIEW', field: 'row', current: '', proposed: '', confidence: 'none', note: 'needs a person to correct the text' });
        }
    }
    return out;
}

module.exports = { proposeFixes, letterFromAnswerText };
