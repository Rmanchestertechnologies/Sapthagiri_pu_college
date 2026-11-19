// What a question card shows, worked out once from a bank question with the SAME parsing the printed paper uses (statements,
// match columns, assertion/reason, diagram, options, key). The selection lists, the review basket and the question editor all
// draw from this, so a question can never look complete on the paper and half-empty on a card (or the other way round).
// No React in here: it runs in the Node tests that guard every question type.
import { cleanOptionText, extractOptionsIfMissing, isOptionCorrect } from '../../utils/sanitize.js';
import { AR_OPTIONS, harmonizeMatchCode } from './layout.js';
import { cleanQuestionText, extractDiagramFromText, parseAssertionReason, parseMatchFromText, parseStatementsFromText } from './parsing.js';

const optText = (o) => (o && typeof o === 'object' ? (o.text || o.optionText || o.option || o.value || '') : String(o == null ? '' : o));
const COLUMN_HEAD = /(?:^|\n)\s*(?:\*\*)?(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[\s\S]*$/i;
const STATEMENT_HEAD = /(?:^|\r?\n|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?I|\(?1|\(?A\)?)\s*[:.\-)–—]?[\s\S]*$/i;

/** 'match' | 'statement' | 'assertion' | 'numerical' | 'truefalse' | 'mcq' - the same decision QuestionBlock makes for the paper. */
export function previewKind(q) {
    const type = String(q.type || q.q_type || 'MCQ').toUpperCase();
    const raw = q.questionText || q.question || '';
    if (type.includes('TRUE_FALSE') || type === 'TF') return 'truefalse';
    if (type.includes('NUMERICAL') || type.includes('INTEGER')) return 'numerical';
    const hasPairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) || (Array.isArray(q.columnA) && q.columnA.length > 0);
    if (type.includes('MATCH') || hasPairs || /(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[\s\S]*(?:Column|List)\s*[-:]?\s*(?:II|2|B)\b/i.test(raw)) return 'match';
    if (type.includes('ASSERTION') || (/Assertion\s*(?:\(A\))?/i.test(raw) && /Reason\s*(?:\(R\))?/i.test(raw))) return 'assertion';
    if (type.includes('STATEMENT') || (Array.isArray(q.statements) && q.statements.length > 0)) return 'statement';
    return 'mcq';
}

/**
 * {
 *   kind, stem, statements: [{label, text}], outro, assertion, reason, columns: { left: [{label, text}], right: [...] },
 *   diagramUrl, options: [{ text, correct }], answerText (numerical / no options), solution
 * }
 */
export function buildQuestionPreview(q) {
    if (!q) return null;
    const kind = previewKind(q);
    const model = { kind, stem: '', statements: [], outro: '', assertion: '', reason: '', columns: null, diagramUrl: null, options: [], answerText: '', solution: q.solutionText || q.solution_text || '' };
    let stem = '';

    if (kind === 'statement') {
        const { introText, statements, outroText } = parseStatementsFromText(q);
        stem = introText && !/(?:^|\r?\n|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?I|\(?1|\(?A\)?)\s*[:.\-)–—]/i.test(introText) ? introText : String(introText || '').replace(STATEMENT_HEAD, '');
        model.statements = (statements || []).map((s, i) => ({ label: s.label || `(${String.fromCharCode(65 + i)})`, text: String(s.text || '') })).filter(s => s.text.trim());
        model.outro = outroText || '';
    } else if (kind === 'assertion') {
        const { assertion, reason } = parseAssertionReason(q);
        model.assertion = assertion; model.reason = reason;
        // directions written before "Assertion" (rare) stay as the stem
        const before = cleanQuestionText(q.questionText || q.question || '').match(/^([\s\S]*?)(?=Assertion\s*(?:\(A\))?\s*[:\-])/i);
        stem = before ? before[1] : '';
    } else if (kind === 'match') {
        const { introText, pairs } = parseMatchFromText(q);
        const rows = (pairs || []).filter(p => p && (String(p.left || '').trim() || String(p.right || '').trim()));
        if (rows.length > 0) {
            model.columns = {
                left: rows.map((p, i) => ({ label: String.fromCharCode(65 + i), text: String(p.left || '').trim() })).filter(c => c.text),
                right: rows.map((p, i) => ({ label: String(i + 1), text: String(p.right || '').trim() })).filter(c => c.text),
            };
        }
        // a question typed "match" whose text has no columns at all (a paragraph question, "Column A: ... Column B: ...") is
        // shown whole, like an ordinary MCQ, instead of losing its text to the column cut
        if (rows.length > 0) stem = String(introText || '').replace(COLUMN_HEAD, '');
        else { model.kind = 'mcq'; stem = q.questionText || q.question || ''; }
    } else {
        stem = q.questionText || q.question || '';
    }

    const { cleanText, diagramUrl } = extractDiagramFromText(cleanQuestionText(stem, q), q.imageUrl || q.image_url);
    model.stem = cleanText;
    model.diagramUrl = diagramUrl;

    if (kind === 'numerical') {
        model.answerText = String(q.num_answer || q.answer || q.correct_option || '');
        return model;
    }
    let opts = extractOptionsIfMissing(q).filter(o => optText(o).trim());
    if (kind === 'assertion' && opts.length < 4) opts = AR_OPTIONS;
    if (kind === 'truefalse' && opts.length < 2) opts = ['True', 'False'];
    model.options = opts.map((o, i) => {
        const text = cleanOptionText(optText(o));
        return { text: model.kind === 'match' ? harmonizeMatchCode(text) : text, correct: isOptionCorrect(q, i) };
    });
    if (model.options.length === 0) model.answerText = String(q.answer || q.num_answer || '');
    return model;
}

/** Every piece of text a card prints, with where it is shown (used by the tests that check nothing prints raw code). */
export function previewParts(model) {
    if (!model) return [];
    const parts = [];
    const add = (where, text) => { if (text != null && String(text).trim()) parts.push({ where, text: String(text) }); };
    add('stem', model.stem);
    model.statements.forEach((s, i) => add(`statement ${i + 1}`, s.text));
    add('outro', model.outro);
    add('assertion', model.assertion);
    add('reason', model.reason);
    if (model.columns) {
        model.columns.left.forEach((c, i) => add(`column I ${i + 1}`, c.text));
        model.columns.right.forEach((c, i) => add(`column II ${i + 1}`, c.text));
    }
    model.options.forEach((o, i) => add(`option ${i + 1}`, o.text));
    return parts;
}
