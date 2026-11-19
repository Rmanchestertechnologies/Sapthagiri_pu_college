// Finds what is wrong with a bank question the way the paper would show it: parts whose maths cannot be typeset or leaves raw
// LaTeX behind (checked with the paper's own text -> HTML steps), plus the problems the server already flags (keyProblem).
// Used by the Question Bank ("Needs fixing" badge, list and the fix dialog) and mirrored by `npm run check:bank` on the server.
import { processMathOnly } from './mathPipeline.js';
import { cleanOptionText } from './sanitize.js';
import { cleanQuestionText } from '../components/question/parsing.js';

export const KEY_PROBLEM_TEXT = {
    PRINT_BROKEN: 'A printed part has maths that cannot be typeset. It is kept out of papers until corrected.',
    DUPLICATE_OPTIONS: 'Two or more options read exactly the same.',
    AR_INCOMPLETE: 'The Reason (or Assertion) is missing.',
    KEY_NOT_AN_OPTION: 'The marked answer is a value that matches none of the options.',
    KEY_EMPTY_OPTION: 'The marked answer points at an empty option.',
    OPTION_GAP: 'An option is missing between two others.',
    MATCH_KEY_UNKNOWN: 'Only a letter key and no options, so the right match is unknown.',
    QUESTION_TEXT_MISSING: 'The question has no text (and no diagram), so only a number and the options would print.',
    STATEMENTS_MISSING: 'The statements are empty ("Statement I:" with nothing after it).',
    MATCH_COLUMNS_INCOMPLETE: 'A match column is cut short (e.g. Column II has fewer items than the answer codes name), so it would print with empty rows.',
    NUMERICAL_NO_ANSWER: 'A numerical question with no answer.',
    DIAGRAM_MISSING: 'Needs a diagram that was never added ("[DIAGRAM REQUIRED]").',
};

/** Rendered HTML with every KaTeX block cut out, so only the plain text the reader would see is left. */
function visibleText(html) {
    let out = ''; let i = 0;
    while (i < html.length) {
        const k = html.indexOf('<span class="katex', i);
        if (k < 0) { out += html.slice(i); break; }
        out += html.slice(i, k);
        let depth = 0; let j = html.length;
        const re = /<span\b|<\/span>/g; re.lastIndex = k;
        let m;
        while ((m = re.exec(html)) !== null) { depth += m[0] === '</span>' ? -1 : 1; if (depth === 0) { j = re.lastIndex; break; } }
        i = j;
    }
    return out.replace(/<[^>]+>/g, ' ');
}

/** What is wrong with one piece of text ('' when it is fine). */
export function textProblem(raw) {
    if (raw == null || String(raw).trim() === '') return '';
    const html = processMathOnly(String(raw));
    if (html.includes('katex-error') || html.includes('inline-math font-medium')) return 'The equation cannot be typeset (cut off, unbalanced braces or an unknown command), so it prints as plain text.';
    if (/\$|\\[a-zA-Z]{2,}|[A-Za-z0-9]_\{|\^\{|\\\\/.test(visibleText(html))) return 'Raw LaTeX or a stray $ is left on the paper (an unpaired $ or a cut-off equation).';
    return '';
}

/**
 * All problems of a question as [{ part, problem }]. `q` is a question as the API delivers it.
 * Parts: question, option 1-4, statement n, assertion, reason, column items, solution.
 */
export function findQuestionProblems(q) {
    if (!q) return [];
    const found = [];
    if (q.keyProblem) found.push({ part: 'question', problem: KEY_PROBLEM_TEXT[q.keyProblem] || String(q.keyProblem) });
    const check = (part, raw) => { const problem = textProblem(raw); if (problem) found.push({ part, problem }); };
    check('question', cleanQuestionText(q.questionText || ''));
    (q.options || []).forEach((o, i) => check(`option ${i + 1}`, cleanOptionText(String(typeof o === 'object' ? (o.text || o.option || '') : (o == null ? '' : o)))));
    if (q.type === 'STATEMENT_BASED') (q.statements || []).forEach((s, i) => check(`statement ${i + 1}`, typeof s === 'object' ? s.text : s));
    if (q.type === 'ASSERTION_REASON') { check('assertion', q.assertion); check('reason', q.reason); }
    if (q.type === 'MATCH_FOLLOWING') { (q.columnA || []).forEach((c, i) => check(`column I item ${i + 1}`, c)); (q.columnB || []).forEach((c, i) => check(`column II item ${i + 1}`, c)); }
    check('solution', q.solutionText);
    return found;
}
