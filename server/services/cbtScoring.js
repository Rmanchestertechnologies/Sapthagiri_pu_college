/**
 * CBT scoring and timing rules (pure, no database access).
 *
 * The exam routes use this module for submission scoring AND for the scorecard
 * breakdown, so the per-question verdict shown to a student always agrees with
 * the score that was stored.
 */

const SUBMIT_GRACE_MS = 2 * 60 * 1000; // network slack allowed after the deadline

/** Stable id of a question inside an exam; must match what /take sends to the client. */
const questionKey = (q, idx) => String((q && (q._id || q.id || q.questionId)) ?? idx);

const optionText = o => (typeof o === 'object' && o ? (o.text || o.optionText || o.value || '') : String(o ?? ''));
const normText = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/[$\s\\{}]/g, '').toLowerCase();

const letterOrDigitToIndex = (token) => {
    const t = String(token).trim().replace(/[()[\].]/g, '');
    if (/^[1-4]$/.test(t)) return parseInt(t, 10) - 1;
    if (/^[A-Da-d]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 65;
    return -1;
};

/**
 * Resolve an answer ("B", "2", "A, C", or the option's own text) to option positions.
 * The option's own text is checked first: a key such as "Both A and B" that is literally
 * one of the options must resolve to that option, not to options A and B.
 */
function resolveOptionIndices(raw, options = []) {
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) {
        const set = new Set();
        raw.forEach(r => resolveOptionIndices(r, options).forEach(i => set.add(i)));
        return [...set].sort((a, b) => a - b);
    }
    const str = String(raw).trim();
    if (!str) return [];

    const single = letterOrDigitToIndex(str);
    if (single >= 0) return [single];

    const target = normText(str);
    if (target && Array.isArray(options)) {
        const exact = options.findIndex(o => normText(optionText(o)) === target);
        if (exact !== -1) return [exact];
    }

    // Compact or delimited lists of labels: "AB", "13", "A, C", "1 & 2", "A or B"
    if (/^[1-4]{2,4}$/.test(str) || /^[A-Da-d]{2,4}$/.test(str)) {
        return [...new Set(str.split('').map(letterOrDigitToIndex))].sort((a, b) => a - b);
    }
    const tokens = str.replace(/^both\s+/i, '').split(/[,;&/|\s]+|\band\b|\bor\b/i).map(t => t.trim()).filter(Boolean);
    if (tokens.length > 1) {
        const idx = tokens.map(letterOrDigitToIndex);
        if (idx.every(i => i >= 0)) return [...new Set(idx)].sort((a, b) => a - b);
    }
    return [];
}

const isNumericalQuestion = (q) => {
    const type = String(q?.type || '').toUpperCase();
    const hasOptions = Array.isArray(q?.options) && q.options.filter(o => normText(optionText(o))).length >= 2;
    return type.includes('NUMERICAL') || type.includes('INTEGER') || !hasOptions;
};

/**
 * Is the student's response correct for this question?
 *
 *  - Numerical questions are compared as numbers (or as text when not numeric). They are
 *    never interpreted as option labels: with the old shared comparison a typed "21"
 *    matched a key of "12" because both were read as "options 1 and 2".
 *  - Option questions are compared by option position. A key listing several options means
 *    any one of them is accepted, because the exam screen allows a single choice.
 */
function isAnswerCorrect(q, selected) {
    if (selected === null || selected === undefined || String(selected).trim() === '') return false;
    const key = q?.answer ?? q?.correct_option ?? q?.correctAnswer ?? q?.num_answer;
    if (key === null || key === undefined || String(key).trim() === '') return false;

    const sel = String(selected).trim();
    const ans = String(key).trim();

    if (isNumericalQuestion(q)) {
        const a = Number(sel), b = Number(ans);
        if (sel !== '' && ans !== '' && Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) <= 1e-9;
        return sel.toLowerCase() === ans.toLowerCase();
    }

    const selIdx = resolveOptionIndices(sel, q.options);
    const ansIdx = resolveOptionIndices(ans, q.options);
    if (selIdx.length > 0 && ansIdx.length > 0) return selIdx.some(i => ansIdx.includes(i));
    // Neither side maps to an option position (e.g. True/False): fall back to text equality.
    return sel.toLowerCase() === ans.toLowerCase();
}

/** Existing institutional rule: CET/KCET +1 / 0, every other pattern +4 / -1. */
function markingScheme(exam) {
    const type = String(exam?.examType || '').toUpperCase();
    const isKcet = type === 'CET' || type === 'KCET';
    return { correct: isKcet ? 1 : 4, incorrect: isKcet ? 0 : -1, unattempted: 0 };
}

/**
 * Combine autosaved answers with the answers sent at submission.
 * A question present in `submitted` wins (including an explicit "cleared" null); a question
 * missing from it keeps its autosaved value, so a truncated or empty submit payload can no
 * longer wipe out work that was already saved.
 */
function mergeAnswers(saved = [], submitted = []) {
    const map = new Map();
    (Array.isArray(saved) ? saved : []).forEach(a => { if (a && a.questionId !== undefined) map.set(String(a.questionId), a); });
    (Array.isArray(submitted) ? submitted : []).forEach(a => { if (a && a.questionId !== undefined) map.set(String(a.questionId), a); });
    return map;
}

function scoreExam(exam, answerMap) {
    const scheme = markingScheme(exam);
    const map = answerMap instanceof Map ? answerMap : mergeAnswers([], answerMap);
    let score = 0, correct = 0, incorrect = 0, unattempted = 0;
    const weakMap = {};

    const answers = (exam?.questions || []).map((q, idx) => {
        const id = questionKey(q, idx);
        const given = map.get(id);
        const raw = given?.selectedOption;
        const selected = (raw === null || raw === undefined || String(raw).trim() === '') ? null : String(raw);
        let isCorrect = false;

        if (selected === null) {
            unattempted++;
            score += scheme.unattempted;
        } else if (isAnswerCorrect(q, selected)) {
            isCorrect = true;
            correct++;
            score += scheme.correct;
        } else {
            incorrect++;
            score += scheme.incorrect;
            const k = `${q.subject || 'Subject'}::${q.chapter || 'Chapter'}`;
            if (!weakMap[k]) weakMap[k] = { subject: q.subject, chapter: q.chapter, incorrect: 0 };
            weakMap[k].incorrect++;
        }

        return {
            questionId: id,
            selectedOption: selected,
            markedForReview: Boolean(given?.markedForReview),
            visited: Boolean(given),
            timeTaken: Number(given?.timeTaken) || 0,
            isCorrect
        };
    });

    return {
        answers,
        score,
        correct,
        incorrect,
        unattempted,
        attempted: correct + incorrect,
        totalQuestions: answers.length,
        weakAreas: Object.values(weakMap).sort((a, b) => b.incorrect - a.incorrect)
    };
}

const toMs = (v) => {
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
};

/**
 * Server-side deadline of one sitting: the student's own start plus the exam duration,
 * capped by the exam's scheduled end time when one is set.
 */
function sessionDeadline(exam, session) {
    const started = toMs(session?.start_time || session?.startTime || session?.created_at);
    const minutes = Number(exam?.duration_minutes);
    const byDuration = started !== null && Number.isFinite(minutes) && minutes > 0 ? started + minutes * 60000 : null;
    const scheduledEnd = toMs(exam?.end_time);
    if (byDuration !== null && scheduledEnd !== null) return Math.min(byDuration, scheduledEnd);
    return byDuration !== null ? byDuration : scheduledEnd;
}

function remainingSeconds(exam, session, now = Date.now()) {
    const deadline = sessionDeadline(exam, session);
    if (deadline === null) return null;
    return Math.max(0, Math.floor((deadline - now) / 1000));
}

/** True when `now` is past the deadline plus the network grace period. */
function isPastDeadline(exam, session, now = Date.now(), graceMs = SUBMIT_GRACE_MS) {
    const deadline = sessionDeadline(exam, session);
    return deadline !== null && now > deadline + graceMs;
}

/** Why a student may not start now, or null when the scheduled window is open. */
function startWindowError(exam, now = Date.now()) {
    const start = toMs(exam?.start_time);
    const end = toMs(exam?.end_time);
    if (start !== null && now < start) return 'This exam has not started yet.';
    if (end !== null && now > end) return 'This exam has ended.';
    return null;
}

module.exports = {
    SUBMIT_GRACE_MS,
    questionKey,
    resolveOptionIndices,
    isNumericalQuestion,
    isAnswerCorrect,
    markingScheme,
    mergeAnswers,
    scoreExam,
    sessionDeadline,
    remainingSeconds,
    isPastDeadline,
    startWindowError
};
