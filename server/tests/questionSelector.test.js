/**
 * Unit tests for the question selection engine (no database required).
 * Run: npx jest tests/questionSelector.test.js --setupFilesAfterEnv ./tests/noop.setup.js
 * (or simply `npm test`, which also runs the DB-backed integration suite).
 */
const { assembleByQuotas, apportion, getQuestionCategory, createRng } = require('../services/questionSelector');

let uid = 0;
const makeQ = (chapter, over = {}) => {
    uid += 1;
    return {
        _id: `q-${uid}`,
        chapter,
        level: 'medium',
        type: 'MCQ',
        questionText: `Plain question ${uid}`,
        options: ['a', 'b', 'c', 'd'],
        answer: 'A',
        ...over
    };
};
const pool = (chapter, n, over = {}) => Array.from({ length: n }, (_, i) => makeQ(chapter, typeof over === 'function' ? over(i) : over));
const countBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const ids = qs => qs.map(q => q._id);

describe('assembleByQuotas - chapter distribution', () => {
    test('three chapters x 10 questions each = 30, exactly 10 per chapter', () => {
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 40), B: pool('B', 40), C: pool('C', 40) },
            chapterQuotas: { A: 10, B: 10, C: 10 }
        });
        expect(r.total).toBe(30);
        expect(r.complete).toBe(true);
        expect(countBy(r.questions, q => q.chapter)).toEqual({ A: 10, B: 10, C: 10 });
        expect(r.warnings).toEqual([]);
    });

    test('five chapters with different quotas', () => {
        const quotas = { A: 3, B: 7, C: 12, D: 1, E: 9 };
        const pools = Object.fromEntries(Object.keys(quotas).map(c => [c, pool(c, 50)]));
        const r = assembleByQuotas({ chapterPools: pools, chapterQuotas: quotas });
        expect(countBy(r.questions, q => q.chapter)).toEqual(quotas);
        expect(r.total).toBe(32);
    });

    test('REGRESSION: an empty/failed chapter is never backfilled from another chapter', () => {
        // Old behaviour: B and C empty -> all 30 questions came from A.
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 100), B: [], C: [] },
            chapterQuotas: { A: 10, B: 10, C: 10 }
        });
        expect(countBy(r.questions, q => q.chapter)).toEqual({ A: 10 });
        expect(r.total).toBe(10);
        expect(r.complete).toBe(false);
        expect(r.distributionReport.B).toEqual({ requested: 10, delivered: 0, available: 0, shortfall: 10 });
        expect(r.warnings.some(w => w.includes('"B"'))).toBe(true);
        expect(r.warnings.some(w => w.includes('"C"'))).toBe(true);
    });

    test('insufficient chapter availability is reported, other chapters unaffected', () => {
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 4), B: pool('B', 40) },
            chapterQuotas: { A: 10, B: 10 },
            chapterAvailable: { A: 4, B: 400 }
        });
        expect(r.distributionReport.A).toEqual({ requested: 10, delivered: 4, available: 4, shortfall: 6 });
        expect(r.distributionReport.B.delivered).toBe(10);
        expect(r.distributionReport.B.available).toBe(400);
        expect(r.total).toBe(14);
        expect(r.complete).toBe(false);
    });

    test('duplicate prevention: no id is used twice, even if listed in two chapters or twice in a pool', () => {
        const shared = pool('A', 5);
        const r = assembleByQuotas({
            chapterPools: { A: [...shared, ...shared, ...pool('A', 3)], B: [...shared, ...pool('B', 10)] },
            chapterQuotas: { A: 8, B: 8 }
        });
        expect(new Set(ids(r.questions)).size).toBe(r.questions.length);
        expect(r.distributionReport.A.delivered).toBe(8);
        expect(r.distributionReport.B.delivered).toBe(8);
    });

    test('empty chapter selection yields an empty, incomplete-free result', () => {
        const r = assembleByQuotas({ chapterPools: {}, chapterQuotas: {} });
        expect(r.total).toBe(0);
        expect(r.requestedTotal).toBe(0);
        expect(r.questions).toEqual([]);
    });

    test('zero / negative / non-numeric quotas are ignored', () => {
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 10), B: pool('B', 10), C: pool('C', 10) },
            chapterQuotas: { A: 0, B: -3, C: 'abc', D: '' }
        });
        expect(r.total).toBe(0);
    });

    test('questions from a pool keyed to another chapter are not pulled in (wrong subject/chapter isolation)', () => {
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 20), Z: pool('Z', 20) },
            chapterQuotas: { A: 5 }
        });
        expect(r.questions.every(q => q.chapter === 'A')).toBe(true);
    });
});

describe('assembleByQuotas - question types', () => {
    const mixedPool = ch => [
        ...pool(ch, 30),
        ...pool(ch, 6, { type: 'ASSERTION_REASON' }),
        ...pool(ch, 6, { type: 'MATCH_FOLLOWING' }),
        ...pool(ch, 6, { type: 'STATEMENT_BASED' }),
        ...pool(ch, 6, { type: 'DIAGRAM_BASED' })
    ];

    test('mixed type allocation is honoured exactly and chapter quotas still hold', () => {
        const r = assembleByQuotas({
            chapterPools: { A: mixedPool('A'), B: mixedPool('B'), C: mixedPool('C') },
            chapterQuotas: { A: 10, B: 10, C: 10 },
            typeAllocations: { mcq: 18, ar: 4, match: 3, stmt: 3, diag: 2 }
        });
        expect(countBy(r.questions, q => q.chapter)).toEqual({ A: 10, B: 10, C: 10 });
        expect(countBy(r.questions, q => getQuestionCategory(q))).toEqual({ mcq: 18, ar: 4, match: 3, stmt: 3, diag: 2 });
        expect(r.warnings).toEqual([]);
    });

    test('special types are spread across chapters rather than drained from the first', () => {
        const r = assembleByQuotas({
            chapterPools: { A: mixedPool('A'), B: mixedPool('B'), C: mixedPool('C') },
            chapterQuotas: { A: 10, B: 10, C: 10 },
            typeAllocations: { mcq: 24, ar: 6 }
        });
        const arByCh = countBy(r.questions.filter(q => getQuestionCategory(q) === 'ar'), q => q.chapter);
        expect(arByCh).toEqual({ A: 2, B: 2, C: 2 });
    });

    test('unavailable special type is reported and the slot is filled with an MCQ of the same chapter', () => {
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 30), B: pool('B', 30) },
            chapterQuotas: { A: 5, B: 5 },
            typeAllocations: { mcq: 6, match: 4 }
        });
        expect(r.total).toBe(10);
        expect(r.typeReport.match).toEqual({ requested: 4, delivered: 0 });
        expect(r.warnings.some(w => w.includes('Type "match"'))).toBe(true);
        expect(countBy(r.questions, q => q.chapter)).toEqual({ A: 5, B: 5 });
    });

    test('numerical questions are only used for JEE', () => {
        const numericals = ch => pool(ch, 10, { type: 'NUMERICAL', options: [], num_answer: '4' });
        const pools = { A: [...pool('A', 20), ...numericals('A')] };
        const jee = assembleByQuotas({ chapterPools: pools, chapterQuotas: { A: 10 }, typeAllocations: { mcq: 7, numerical: 3 }, isJee: true });
        expect(jee.typeReport.numerical.delivered).toBe(3);
        const neet = assembleByQuotas({ chapterPools: pools, chapterQuotas: { A: 10 }, typeAllocations: { mcq: 7, numerical: 3 }, isJee: false });
        expect(neet.typeReport.numerical.requested).toBe(0);
    });

    test('type total mismatching chapter total raises a warning; chapter quotas win', () => {
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 30) },
            chapterQuotas: { A: 10 },
            typeAllocations: { mcq: 45 }
        });
        expect(r.total).toBe(10);
        expect(r.warnings[0]).toMatch(/does not match chapter quota total/);
    });
});

describe('assembleByQuotas - difficulty', () => {
    const leveled = ch => [
        ...pool(ch, 30, { level: 'easy' }),
        ...pool(ch, 30, { level: 'medium' }),
        ...pool(ch, 30, { level: 'hard' })
    ];

    test('30/50/20 over 30 questions gives 9/15/6 when the bank can supply it', () => {
        const r = assembleByQuotas({
            chapterPools: { A: leveled('A'), B: leveled('B'), C: leveled('C') },
            chapterQuotas: { A: 10, B: 10, C: 10 },
            difficultyDistribution: { easy: 30, medium: 50, hard: 20 }
        });
        expect(countBy(r.questions, q => q.level)).toEqual({ easy: 9, medium: 15, hard: 6 });
        expect(countBy(r.questions, q => q.chapter)).toEqual({ A: 10, B: 10, C: 10 });
        expect(r.warnings).toEqual([]);
    });

    test('missing difficulty level never reduces the question count; mismatch is reported', () => {
        const r = assembleByQuotas({
            chapterPools: { A: pool('A', 30, { level: 'easy' }) },
            chapterQuotas: { A: 10 },
            difficultyDistribution: { easy: 30, medium: 50, hard: 20 }
        });
        expect(r.total).toBe(10);
        expect(r.warnings.some(w => w.startsWith('Difficulty mix differs'))).toBe(true);
    });

    test('apportion always sums to the total', () => {
        for (const total of [1, 7, 10, 33, 45, 90, 180]) {
            const a = apportion(total, { easy: 30, medium: 50, hard: 20 });
            expect(a.easy + a.medium + a.hard).toBe(total);
        }
        expect(apportion(10, { easy: 0, medium: 0, hard: 0 })).toEqual({ easy: 0, medium: 0, hard: 0 });
    });
});

describe('assembleByQuotas - determinism', () => {
    test('same seed and pool => identical selection; different seed => different selection', () => {
        const pools = { A: pool('A', 80), B: pool('B', 80) };
        const args = { chapterPools: pools, chapterQuotas: { A: 10, B: 10 } };
        const a = ids(assembleByQuotas({ ...args, seed: 'exam-42' }).questions);
        const b = ids(assembleByQuotas({ ...args, seed: 'exam-42' }).questions);
        const c = ids(assembleByQuotas({ ...args, seed: 'exam-43' }).questions);
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
    });

    test('createRng is reproducible and in [0, 1)', () => {
        const r1 = createRng('s'); const r2 = createRng('s');
        for (let i = 0; i < 50; i++) {
            const v = r1();
            expect(v).toBe(r2());
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    test('input pools are not mutated', () => {
        const a = pool('A', 20);
        const snapshot = ids(a);
        assembleByQuotas({ chapterPools: { A: a }, chapterQuotas: { A: 10 }, seed: 1 });
        expect(ids(a)).toEqual(snapshot);
    });
});

describe('getQuestionCategory', () => {
    test('classifies by type and by text pattern', () => {
        expect(getQuestionCategory({ type: 'MCQ', questionText: 'x', options: ['a'] })).toBe('mcq');
        expect(getQuestionCategory({ questionText: 'Assertion (A): x Reason (R): y' })).toBe('ar');
        expect(getQuestionCategory({ questionText: 'Match the following: Column I ...' })).toBe('match');
        expect(getQuestionCategory({ questionText: 'Statement I: x. Statement II: y' })).toBe('stmt');
        expect(getQuestionCategory({ questionText: 'See {{IMG::abc}}', options: ['a'] })).toBe('diag');
        expect(getQuestionCategory({ type: 'NUMERICAL', num_answer: '2' }, true)).toBe('numerical');
        expect(getQuestionCategory(null)).toBe('mcq');
    });
});
