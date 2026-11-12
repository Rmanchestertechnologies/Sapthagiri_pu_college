/**
 * Server-side P/Q/R/S answer keys.
 *
 * A server port of client/src/utils/pqrsGenerator.js (same seeded PRNG, same section-aware
 * permutation, same option shuffle). It lets the OMR evaluator grade a sheet against the key of
 * the series the student actually sat, instead of the master order.
 *
 * It MUST stay in step with the client generator. client/tests/pqrsServerParity.test.mjs runs
 * both implementations on the same papers and fails if they ever disagree.
 */

const SERIES = ['P', 'Q', 'R', 'S'];

// ── answer parsing (identical rules to client/src/utils/sanitize.js parseAnswerIndices) ──────────
function parseAnswerIndices(rawAns, options = []) {
    if (rawAns === null || rawAns === undefined) return [];
    if (Array.isArray(rawAns)) {
        const set = new Set();
        rawAns.forEach(item => parseAnswerIndices(item, options).forEach(idx => set.add(idx)));
        return Array.from(set).sort((a, b) => a - b);
    }
    if (typeof rawAns === 'number') {
        if (rawAns >= 1 && rawAns <= 4) return [rawAns - 1];
        rawAns = String(rawAns);
    }
    const str = String(rawAns).trim();
    if (!str) return [];

    const indicesSet = new Set();

    const bothMatch = str.match(/both\s*(?:\()?\s*([A-D1-4])\s*(?:\))?\s*(?:and|&|\/|,)\s*(?:\()?\s*([A-D1-4])\s*(?:\))?/i);
    if (bothMatch) {
        const toIdx = (char) => {
            const c = char.toUpperCase();
            if (/[1-4]/.test(c)) return parseInt(c, 10) - 1;
            return c.charCodeAt(0) - 65;
        };
        indicesSet.add(toIdx(bothMatch[1]));
        indicesSet.add(toIdx(bothMatch[2]));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }
    if (/^[1-4]{2,4}$/.test(str)) {
        str.split('').forEach(d => indicesSet.add(parseInt(d, 10) - 1));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }
    if (/^[A-Da-d]{2,4}$/.test(str)) {
        str.toUpperCase().split('').forEach(ch => indicesSet.add(ch.charCodeAt(0) - 65));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }
    const splitTokens = str
        .split(/[,;&/|\s]+|\band\b|\bor\b/i)
        .map(t => t.trim().replace(/[()[\].]/g, ''))
        .filter(Boolean);
    if (splitTokens.length > 1) {
        let allRecognized = true;
        const tempIndices = [];
        for (const token of splitTokens) {
            if (/^[1-4]$/.test(token)) tempIndices.push(parseInt(token, 10) - 1);
            else if (/^[A-Da-d]$/.test(token)) tempIndices.push(token.toUpperCase().charCodeAt(0) - 65);
            else { allRecognized = false; break; }
        }
        if (allRecognized && tempIndices.length > 0) {
            tempIndices.forEach(idx => indicesSet.add(idx));
            return Array.from(indicesSet).sort((a, b) => a - b);
        }
    }
    if (/^[1-4]$/.test(str)) return [parseInt(str, 10) - 1];
    const singleLetter = str.match(/^[(]?([A-Da-d])[).]?$/);
    if (singleLetter) return [singleLetter[1].toUpperCase().charCodeAt(0) - 65];

    const cleanStr = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/[$\s\\{}]/g, '').toLowerCase();
    const targetStr = cleanStr(str);
    if (targetStr && options.length > 0) {
        const matchedIdx = options.findIndex((opt) => {
            const optText = typeof opt === 'object' && opt ? (opt.text || opt.optionText || '') : String(opt || '');
            const candidate = cleanStr(optText);
            if (!candidate) return false;
            if (candidate === targetStr) return true;
            if (targetStr.length > 4 && (candidate.includes(targetStr) || targetStr.includes(candidate))) return true;
            return false;
        });
        if (matchedIdx !== -1) return [matchedIdx];
    }
    return [];
}

// ── permutation (identical to client/src/utils/pqrsGenerator.js) ─────────────────────────────────
function createSeededRandom(seedStr) {
    let hash = 0;
    const str = String(seedStr || 'default-seed');
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return function () {
        hash = Math.abs((hash * 9301 + 49297) % 233280);
        return hash / 233280;
    };
}

function shuffleArray(arr, randomFn) {
    if (!Array.isArray(arr) || arr.length <= 1) return [...(arr || [])];
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const rnd = Math.abs(randomFn());
        const j = Math.floor(rnd * (i + 1));
        if (j >= 0 && j < copy.length) [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

const optionText = (opt) => (typeof opt === 'object' && opt ? (opt.text || opt.optionText || opt.value || '') : String(opt ?? ''));
const POSITIONAL_OPTION_RE = /\b(all|none|both|either|neither)\b[^.]{0,40}\b(above|these|those|the\s+following|[A-Da-d1-4]\s*(?:\)|and|&|or|,))|\b(?:\(?[A-Da-d1-4]\)?)\s*(?:and|&)\s*(?:\(?[A-Da-d1-4]\)?)\s*(?:only|both|are|is)?\s*$/i;
const hasPositionalOptions = (options = []) =>
    options.some(o => POSITIONAL_OPTION_RE.test(optionText(o).replace(/<[^>]+>/g, ' ').trim()));

/** The answer field the printed key reads first (getResolvedAnswerLabel precedence). */
const rawAnswerOf = q => q.correct_option ?? q.answer ?? q.correctAnswer ?? q.num_answer ?? '';

/**
 * Shuffle one question's options; returns the question's new correct option positions and the
 * permutation, mirroring shuffleQuestionOptions in the client.
 */
function shuffleOptions(q, randomFn) {
    const options = Array.isArray(q.options) ? q.options : [];
    const shuffleSource = q.correct_option ?? q.answer ?? q.correctAnswer;
    const origIdx = parseAnswerIndices(shuffleSource, options);
    if (options.length <= 1 || origIdx.length === 0 || hasPositionalOptions(options)) {
        return { correctIndices: parseAnswerIndices(rawAnswerOf(q), options), shuffled: false };
    }
    const indexed = options.map((opt, i) => ({ opt, origIdx: i }));
    const shuffledIndexed = shuffleArray(indexed, randomFn);
    const correctIndices = origIdx
        .map(oldIdx => shuffledIndexed.findIndex(item => item.origIdx === oldIdx))
        .filter(i => i >= 0)
        .sort((a, b) => a - b);
    return { correctIndices, shuffled: true };
}

function sectionKeyOf(q) {
    return q.part ? `${q.sectionSubject || q.subject || ''}-${q.part}` : (q.sectionName || q.subject || 'Default');
}

/**
 * Key of one series for a master question list.
 * @returns {Array<{ position:number, masterIndex:number, questionId:string, correctIndices:number[], optionsShuffled:boolean }>}
 *          position is 1-based in printed order; masterIndex is the 0-based index in the master list.
 */
function buildSeriesKey(paper, questions, series = 'P') {
    const set = String(series || 'P').toUpperCase();
    const list = Array.isArray(questions) ? questions : [];
    const paperId = paper?._id || paper?.id || 'qp-default';
    const random = createSeededRandom(`${paperId}-${set}`);

    // group by section, keeping first-seen order
    const sections = new Map();
    list.forEach((q, masterIndex) => {
        const key = sectionKeyOf(q);
        if (!sections.has(key)) sections.set(key, []);
        sections.get(key).push({ q, masterIndex });
    });

    const out = [];
    for (const items of sections.values()) {
        let ordered = items;
        if (set === 'Q' || set === 'R' || set === 'S') ordered = shuffleArray(items, random);
        ordered.forEach(({ q, masterIndex }) => {
            let correctIndices;
            let optionsShuffled = false;
            if (set === 'R' || set === 'S') {
                const r = shuffleOptions(q, random);
                correctIndices = r.correctIndices;
                optionsShuffled = r.shuffled;
            } else {
                correctIndices = parseAnswerIndices(rawAnswerOf(q), Array.isArray(q.options) ? q.options : []);
            }
            out.push({
                position: out.length + 1,
                masterIndex,
                questionId: String(q._id || q.id || q.questionId || masterIndex + 1),
                correctIndices,
                optionsShuffled
            });
        });
    }
    return out;
}

module.exports = { SERIES, parseAnswerIndices, createSeededRandom, shuffleArray, hasPositionalOptions, buildSeriesKey };
