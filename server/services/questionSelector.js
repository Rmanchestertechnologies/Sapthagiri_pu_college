/**
 * Question selection engine (pure, no database access).
 *
 * Assembles a paper from per-chapter candidate pools while honoring, in this
 * priority order:
 *   1. Chapter quotas      - a chapter never receives questions from another chapter.
 *   2. Duplicate prevention - a question id is used at most once.
 *   3. Type allocations    - special types (numerical/diagram/AR/match/statement) first.
 *   4. Difficulty targets  - best effort, steered by remaining deficit per level.
 *
 * Anything that cannot be satisfied is REPORTED, never silently substituted
 * across chapters. The caller decides how to present a partial result.
 */

const CATEGORY_KEYS = ['mcq', 'ar', 'match', 'diag', 'stmt', 'numerical'];
const LEVEL_KEYS = ['easy', 'medium', 'hard'];
const IMG_RE = /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/res\.cloudinary\.com\//i;

/** Deterministic PRNG (mulberry32). Same seed => same sequence. */
function createRng(seed) {
    if (seed === undefined || seed === null || seed === '') return Math.random;
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) {
        h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function rng() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(arr, rng) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const qId = q => String(q._id || q.id || q.questionId || '');

/**
 * Category of a question. Mirrors getQCategory in
 * client/src/pages/teacher/CommissionedExam.jsx - keep the two in sync.
 */
function getQuestionCategory(q, isJee = false) {
    if (!q) return 'mcq';
    const t = String(q.type || q.q_type || '').toUpperCase();
    const txt = `${q.questionText || q.question || ''}`;
    const hasOpts = (Array.isArray(q.options) && q.options.length > 0) || q.opt_a || q.opt_b;
    if (isJee && (t === 'NUMERICAL' || (!hasOpts && q.num_answer))) return 'numerical';
    if (t === 'ASSERTION_REASON' || /Assertion\s*(?:\(A\))?[:-]/i.test(txt)) return 'ar';
    if (t === 'MATCH_FOLLOWING' || t.includes('MATCH') || /Column\s*(?:I|1|A)\b/i.test(txt) || /Match the following/i.test(txt)) return 'match';
    if (t === 'STATEMENT_BASED' || /Statement\s*(?:I|1|A)\b/i.test(txt)) return 'stmt';

    const optStrings = [q.opt_a, q.opt_b, q.opt_c, q.opt_d, ...(Array.isArray(q.options) ? q.options : [])].filter(Boolean);
    const hasOptionDiag = optStrings.some(o => IMG_RE.test(typeof o === 'object' ? (o.text || o.value || '') : String(o)));
    const hasDiagram = t === 'DIAGRAM_BASED'
        || Boolean(q.imageUrl || q.image_url)
        || (Array.isArray(q.diagram_urls) && q.diagram_urls.length > 0)
        || (Array.isArray(q.diagramUrls) && q.diagramUrls.length > 0)
        || IMG_RE.test(txt)
        || hasOptionDiag;
    return hasDiagram ? 'diag' : 'mcq';
}

const levelOf = q => {
    const l = String(q.level || 'medium').toLowerCase();
    return LEVEL_KEYS.includes(l) ? l : 'medium';
};

/** Split `total` by percentage weights using the largest-remainder method (sums exactly to total). */
function apportion(total, weights) {
    const keys = Object.keys(weights);
    const sum = keys.reduce((s, k) => s + Math.max(0, Number(weights[k]) || 0), 0);
    const out = {};
    if (total <= 0 || sum <= 0) { keys.forEach(k => { out[k] = 0; }); return out; }
    const exact = keys.map(k => ({ k, v: (Math.max(0, Number(weights[k]) || 0) / sum) * total }));
    let used = 0;
    exact.forEach(e => { out[e.k] = Math.floor(e.v); used += out[e.k]; });
    exact.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
    for (let i = 0; used < total; i++, used++) out[exact[i % exact.length].k] += 1;
    return out;
}

function normalizeQuotas(chapterQuotas) {
    const out = [];
    for (const [chapter, raw] of Object.entries(chapterQuotas || {})) {
        const n = Math.floor(Number(raw));
        if (chapter && Number.isFinite(n) && n > 0) out.push({ chapter, quota: n });
    }
    return out;
}

/**
 * @param {Object} args
 * @param {Object<string, Array>} args.chapterPools   candidate questions keyed by chapter name
 * @param {Object<string, number>} args.chapterQuotas requested count per chapter
 * @param {Object} [args.typeAllocations]             { mcq, ar, match, diag, stmt, numerical }; omitted/all-zero = unconstrained
 * @param {Object} [args.difficultyDistribution]      { easy, medium, hard } percentages; omitted = unconstrained
 * @param {Object<string, number>} [args.chapterAvailable] total matching rows in DB per chapter (for reporting)
 * @param {string[]} [args.preferredConcepts]         concepts to prefer (soft preference, not a filter)
 * @param {boolean} [args.isJee]
 * @param {string|number} [args.seed]                 makes the selection reproducible for a given pool
 */
function assembleByQuotas({
    chapterPools = {},
    chapterQuotas = {},
    typeAllocations = null,
    difficultyDistribution = null,
    chapterAvailable = {},
    preferredConcepts = [],
    isJee = false,
    seed
} = {}) {
    const rng = createRng(seed);
    const quotas = normalizeQuotas(chapterQuotas);
    const requestedTotal = quotas.reduce((s, c) => s + c.quota, 0);
    const warnings = [];

    // ---- Type targets -------------------------------------------------------
    const typeTargets = {};
    CATEGORY_KEYS.forEach(k => { typeTargets[k] = Math.max(0, Math.floor(Number(typeAllocations?.[k]) || 0)); });
    if (!isJee) typeTargets.numerical = 0;
    const typeSum = CATEGORY_KEYS.reduce((s, k) => s + typeTargets[k], 0);
    const typeConstrained = typeSum > 0;
    if (typeConstrained && typeSum !== requestedTotal) {
        warnings.push(`Type allocation total (${typeSum}) does not match chapter quota total (${requestedTotal}). Chapter quotas take priority; the difference is filled with MCQs.`);
    }

    // ---- Difficulty targets -------------------------------------------------
    const diffSum = LEVEL_KEYS.reduce((s, k) => s + Math.max(0, Number(difficultyDistribution?.[k]) || 0), 0);
    const difficultyConstrained = diffSum > 0;
    const levelTargets = difficultyConstrained
        ? apportion(requestedTotal, { easy: difficultyDistribution.easy, medium: difficultyDistribution.medium, hard: difficultyDistribution.hard })
        : { easy: 0, medium: 0, hard: 0 };
    const levelPicked = { easy: 0, medium: 0, hard: 0 };

    // ---- Build de-duplicated, shuffled buckets per chapter -------------------
    const prefSet = new Set((preferredConcepts || []).map(c => String(c).toLowerCase()));
    const seenIds = new Set();
    const buckets = {};
    const poolSize = {};
    for (const { chapter } of quotas) {
        buckets[chapter] = {};
        CATEGORY_KEYS.forEach(k => { buckets[chapter][k] = []; });
        const unique = [];
        for (const q of (chapterPools[chapter] || [])) {
            const id = qId(q);
            if (!id || seenIds.has(id)) continue; // same question listed under two chapters is used once
            seenIds.add(id);
            unique.push(q);
        }
        poolSize[chapter] = unique.length;
        let ordered = shuffle(unique, rng);
        if (prefSet.size > 0) {
            const pref = ordered.filter(q => prefSet.has(String(q.concept || '').toLowerCase()));
            const rest = ordered.filter(q => !prefSet.has(String(q.concept || '').toLowerCase()));
            ordered = [...pref, ...rest];
        }
        ordered.forEach(q => {
            let cat = getQuestionCategory(q, isJee);
            if (!isJee && cat === 'numerical') cat = 'mcq';
            buckets[chapter][cat].push(q);
        });
    }

    const picked = {};
    quotas.forEach(({ chapter }) => { picked[chapter] = []; });
    const typePicked = {};
    CATEGORY_KEYS.forEach(k => { typePicked[k] = 0; });
    const remaining = ch => quotas.find(c => c.chapter === ch).quota - picked[ch].length;

    /** Take one question from a bucket, preferring the difficulty level furthest below its target. */
    const takeFrom = (chapter, cat) => {
        const bucket = buckets[chapter][cat];
        if (!bucket || bucket.length === 0) return null;
        let idx = 0;
        if (difficultyConstrained) {
            let best = -Infinity;
            for (let i = 0; i < bucket.length; i++) {
                const lvl = levelOf(bucket[i]);
                const deficit = levelTargets[lvl] - levelPicked[lvl];
                // strict ">" keeps the earliest (shuffled) candidate among equals
                if (deficit > best) { best = deficit; idx = i; }
            }
        }
        const [q] = bucket.splice(idx, 1);
        picked[chapter].push(q);
        typePicked[cat] += 1;
        levelPicked[levelOf(q)] += 1;
        return q;
    };

    // ---- Phase 1: special types, spread round-robin over chapters with room --
    if (typeConstrained) {
        for (const cat of ['numerical', 'diag', 'ar', 'match', 'stmt']) {
            let need = typeTargets[cat];
            while (need > 0) {
                // chapters with room AND stock, most remaining room first => balanced spread
                const eligible = quotas
                    .map(c => c.chapter)
                    .filter(ch => remaining(ch) > 0 && buckets[ch][cat].length > 0)
                    .sort((a, b) => remaining(b) - remaining(a));
                if (eligible.length === 0) break;
                for (const ch of eligible) {
                    if (need <= 0) break;
                    if (remaining(ch) > 0 && takeFrom(ch, cat)) need--;
                }
            }
        }
    }

    // ---- Phase 2: fill each chapter's remaining quota from ITS OWN pool ------
    const typeSubstitutions = {};
    for (const { chapter } of quotas) {
        // Unconstrained => any category in shuffled proportion; constrained => MCQ first.
        const order = typeConstrained ? ['mcq'] : CATEGORY_KEYS;
        if (typeConstrained) {
            while (remaining(chapter) > 0 && takeFrom(chapter, 'mcq')) { /* fill */ }
        } else {
            // merge all buckets back in a fair shuffled order
            const merged = shuffle(order.flatMap(k => buckets[chapter][k].map(q => ({ q, k }))), rng);
            order.forEach(k => { buckets[chapter][k] = []; });
            merged.forEach(({ q, k }) => buckets[chapter][k].push(q));
            while (remaining(chapter) > 0) {
                const cats = order.filter(k => buckets[chapter][k].length > 0);
                if (cats.length === 0) break;
                // weight category choice by stock so the mix reflects the bank
                const total = cats.reduce((s, k) => s + buckets[chapter][k].length, 0);
                let r = rng() * total;
                let chosen = cats[0];
                for (const k of cats) { r -= buckets[chapter][k].length; if (r < 0) { chosen = k; break; } }
                takeFrom(chapter, chosen);
            }
        }
        // Chapter is short of MCQs: stay inside the chapter and use other types, but say so.
        if (typeConstrained && remaining(chapter) > 0) {
            for (const cat of ['stmt', 'ar', 'match', 'diag', 'numerical']) {
                while (remaining(chapter) > 0 && takeFrom(chapter, cat)) {
                    typeSubstitutions[chapter] = (typeSubstitutions[chapter] || 0) + 1;
                }
            }
        }
    }

    // ---- Reports ------------------------------------------------------------
    const chapterReport = {};
    for (const { chapter, quota } of quotas) {
        const delivered = picked[chapter].length;
        const available = Number.isFinite(Number(chapterAvailable[chapter])) ? Number(chapterAvailable[chapter]) : poolSize[chapter];
        chapterReport[chapter] = { requested: quota, delivered, available, shortfall: quota - delivered };
        if (delivered < quota) {
            warnings.push(available === 0
                ? `"${chapter}": no questions available for the selected subject/class/exam (requested ${quota}).`
                : `"${chapter}": only ${delivered} of ${quota} requested questions could be supplied (${available} available).`);
        }
        if (typeSubstitutions[chapter]) {
            warnings.push(`"${chapter}": ${typeSubstitutions[chapter]} question(s) are not plain MCQs because the chapter ran out of MCQs.`);
        }
    }

    const typeReport = {};
    CATEGORY_KEYS.forEach(k => {
        typeReport[k] = { requested: typeConstrained ? typeTargets[k] : null, delivered: typePicked[k] };
        if (typeConstrained && k !== 'mcq' && typePicked[k] < typeTargets[k]) {
            warnings.push(`Type "${k}": only ${typePicked[k]} of ${typeTargets[k]} requested could be supplied from the selected chapters.`);
        }
    });

    const difficultyReport = {};
    LEVEL_KEYS.forEach(k => {
        difficultyReport[k] = { requested: difficultyConstrained ? levelTargets[k] : null, delivered: levelPicked[k] };
    });
    if (difficultyConstrained && LEVEL_KEYS.some(k => levelPicked[k] !== levelTargets[k])) {
        const fmt = o => LEVEL_KEYS.map(k => `${k} ${o[k]}`).join(', ');
        warnings.push(`Difficulty mix differs from the request (requested: ${fmt(levelTargets)}; delivered: ${fmt(levelPicked)}) because the selected chapters do not hold enough questions at every level.`);
    }

    const questions = quotas.flatMap(({ chapter }) => picked[chapter]);

    return {
        questions,
        total: questions.length,
        requestedTotal,
        complete: questions.length === requestedTotal,
        distributionReport: chapterReport,
        typeReport,
        difficultyReport,
        warnings
    };
}

module.exports = {
    CATEGORY_KEYS,
    LEVEL_KEYS,
    createRng,
    apportion,
    getQuestionCategory,
    assembleByQuotas
};
