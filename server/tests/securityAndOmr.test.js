/**
 * Unit tests: access rules, image-proxy allow-list, CORS parsing, OMR evaluation, PQRS series keys.
 * No database required. Run: npm run test:unit
 */
const rules = require('../services/accessRules');
const { evaluateSheet, parseMarks } = require('../services/omrEvaluator');
const { buildSeriesKey, SERIES } = require('../services/pqrsKeys');

describe('paper access', () => {
    const teacherA = { id: '5', role: 'teacher' };
    const teacherB = { id: '6', role: 'teacher' };
    const admin = { id: '000000000000000000000000', role: 'admin' };
    const paper = { id: 1, teacherId: 5 };

    test('owner and admin may use a paper; another teacher may not', () => {
        expect(rules.canAccessPaper(teacherA, paper)).toBe(true);
        expect(rules.canAccessPaper(admin, paper)).toBe(true);
        expect(rules.canAccessPaper(teacherB, paper)).toBe(false);
        expect(rules.canAccessPaper(null, paper)).toBe(false);
        expect(rules.canAccessPaper(teacherA, null)).toBe(false);
    });

    test('ids compare as strings across number / string shapes and legacy field names', () => {
        expect(rules.canAccessPaper(teacherA, { teacher_id: '5' })).toBe(true);
        expect(rules.canAccessPaper(teacherA, { created_by: 5 })).toBe(true);
        expect(rules.canAccessPaper(teacherB, { teacherId: undefined })).toBe(false);
        expect(rules.canAccessPaper({ id: undefined, role: 'teacher' }, { teacherId: undefined })).toBe(false);
    });

    test('a teacher assigned a subject of the linked exam can read/edit but not delete', () => {
        const exam = { subjectAssignments: [{ subject: 'Physics', teacherId: '6' }] };
        expect(rules.canAccessPaper(teacherB, paper, exam)).toBe(true);
        expect(rules.canDeletePaper(teacherB, paper)).toBe(false);
        expect(rules.canDeletePaper(teacherA, paper)).toBe(true);
        expect(rules.canDeletePaper(admin, paper)).toBe(true);
        expect(rules.canAccessPaper({ id: '9', role: 'teacher' }, paper, exam)).toBe(false);
    });

    test('OMR: own papers and approved/submitted papers only', () => {
        expect(rules.canUseOmrPaper(teacherA, { teacher_id: 5, status: 'Draft' })).toBe(true);
        expect(rules.canUseOmrPaper(teacherB, { teacher_id: 5, status: 'Draft' })).toBe(false);
        expect(rules.canUseOmrPaper(teacherB, { teacher_id: 5, status: 'Approved' })).toBe(true);
        expect(rules.canUseOmrPaper(teacherB, { teacher_id: 5, status: 'Submitted' })).toBe(true);
        expect(rules.canUseOmrPaper(admin, { teacher_id: 5, status: 'Draft' })).toBe(true);
    });
});

describe('image proxy allow-list (SSRF)', () => {
    const ok = u => rules.isAllowedImageUrl(u);
    test('allows Cloudinary and Supabase storage over https', () => {
        expect(ok('https://res.cloudinary.com/demo/image/upload/a.png')).toBe(true);
        expect(ok('https://vukxgqkrersxcasdklda.supabase.co/storage/v1/object/public/x.png')).toBe(true);
        expect(rules.isAllowedImageUrl('https://cdn.school.example/a.png', ['cdn.school.example'])).toBe(true);
    });
    test('blocks internal addresses, other hosts, plain http, odd ports, credentials and look-alikes', () => {
        for (const u of [
            'http://127.0.0.1:5000/api/admin', 'http://localhost/x', 'http://169.254.169.254/latest/meta-data/',
            'https://169.254.169.254/', 'https://[::1]/', 'https://evil.example/a.png',
            'http://res.cloudinary.com/a.png', 'https://res.cloudinary.com:8443/a.png',
            'https://user:pw@res.cloudinary.com/a.png', 'https://res.cloudinary.com.evil.example/a.png',
            'https://evilsupabase.co/a.png', 'https://supabase.co.evil.example/a.png',
            'file:///etc/passwd', 'ftp://res.cloudinary.com/a.png', 'not a url', '', undefined
        ]) expect(ok(u)).toBe(false);
    });
});

describe('CORS origin list', () => {
    test('unset or "*" means unrestricted; a list restricts', () => {
        expect(rules.parseAllowedOrigins('')).toBeNull();
        expect(rules.parseAllowedOrigins('*')).toBeNull();
        expect(rules.parseAllowedOrigins(undefined)).toBeNull();
        const list = rules.parseAllowedOrigins('https://a.example/, https://b.example');
        expect(list).toEqual(['https://a.example', 'https://b.example']);
        expect(rules.isOriginAllowed('https://a.example', list)).toBe(true);
        expect(rules.isOriginAllowed('https://evil.example', list)).toBe(false);
        expect(rules.isOriginAllowed(undefined, list)).toBe(true);
        expect(rules.isOriginAllowed('https://anything', null)).toBe(true);
    });
});

describe('OMR evaluation', () => {
    const key = [
        { number: 1, id: 'a', subject: 'Physics', concept: 'Optics', correctIndices: [0], correctAnswer: '1' },
        { number: 2, id: 'b', subject: 'Physics', concept: 'Optics', correctIndices: [2], correctAnswer: '3' },
        { number: 3, id: 'c', subject: 'Chemistry', concept: 'Bonding', correctIndices: [1], correctAnswer: '2' },
        { number: 4, id: 'd', subject: 'Chemistry', concept: 'Bonding', correctIndices: [3], correctAnswer: '4' }
    ];
    const marks = { correctM: 4, wrongM: -1, blankM: 0 };
    const run = (detected, flags = { seriesKnown: true, gradedSeries: 'P' }) => evaluateSheet({ key, detectedAnswers: detected, marks, flags });

    test('letters and digits are accepted; score = 4 per correct, -1 per wrong', () => {
        const r = run({ 1: 'A', 2: '3', 3: 'D', 4: 'BLANK' });
        expect(r).toMatchObject({ correctCount: 2, wrongCount: 1, blankCount: 1, totalScore: 7 });
        expect(r.reviewReasons).toEqual([]);
    });

    test('REGRESSION: MULTIPLE is scored wrong (existing rule) and flagged for review, not silently accepted', () => {
        const r = run({ 1: 'MULTIPLE', 2: 'C', 3: 'B', 4: 'D' });
        expect(r.multipleCount).toBe(1);
        expect(r.questionEvaluations[0]).toMatchObject({ status: 'wrong', review: 'multiple_marks', marks: -1 });
        expect(r.reviewReasons.some(x => /more than one bubble/.test(x))).toBe(true);
    });

    test('missing questions count as blank; an all-blank sheet is flagged', () => {
        const r = run({});
        expect(r.blankCount).toBe(4);
        expect(r.reviewReasons.some(x => /blank/.test(x))).toBe(true);
    });

    test('unknown series, inferred roll number and duplicate roll are flagged', () => {
        const r = run({ 1: 'A' }, { seriesKnown: false, rawSeries: 'Z', gradedSeries: 'P', rollInferred: true, duplicateRollInBatch: true });
        expect(r.reviewReasons).toHaveLength(3);
    });

    test('UNCERTAIN (faint / partial mark) is left unscored and flagged, not penalised', () => {
        const r = run({ 1: 'UNCERTAIN', 2: 'C', 3: 'B', 4: 'D' });
        expect(r.questionEvaluations[0]).toMatchObject({ status: 'not_attempted', marks: 0, review: 'uncertain_mark' });
        expect(r.uncertainCount).toBe(1);
        expect(r.totalScore).toBe(12); // three correct, the uncertain one costs nothing
        expect(r.reviewReasons.some(x => /faint or partial/.test(x))).toBe(true);
    });

    test('low engine confidence flags an answer but never changes its marks', () => {
        const details = { 1: { confidence_gap: 0.04 }, 2: { confidence_gap: 0.6 }, 3: { confidence_gap: 0.14 }, 4: {} };
        const r = evaluateSheet({ key, detectedAnswers: { 1: 'A', 2: 'C', 3: 'B', 4: 'D' }, marks, flags: { seriesKnown: true, gradedSeries: 'P' }, details });
        expect(r.totalScore).toBe(16);
        expect(r.lowConfidenceCount).toBe(2); // questions 1 and 3 (< 0.15); 2 is clear; 4 has no data
        expect(r.questionEvaluations.map(e => e.review)).toEqual(['low_confidence', undefined, 'low_confidence', undefined]);
        // a configurable threshold
        const strict = evaluateSheet({ key, detectedAnswers: { 1: 'A', 2: 'C' }, marks, details, reviewGap: 0.9 });
        expect(strict.lowConfidenceCount).toBe(2);
    });

    test('blank answers never get a low-confidence flag', () => {
        const r = evaluateSheet({ key, detectedAnswers: { 1: 'BLANK' }, marks, details: { 1: { confidence_gap: 0 } } });
        expect(r.lowConfidenceCount).toBe(0);
    });

    test('garbled marks are wrong and flagged', () => {
        const r = run({ 1: '??', 2: 'C', 3: 'B', 4: 'D' });
        expect(r.questionEvaluations[0]).toMatchObject({ status: 'wrong', review: 'unrecognised_mark' });
    });

    test('subject totals add up to the sheet total', () => {
        const r = run({ 1: 'A', 2: 'A', 3: 'B', 4: 'BLANK' });
        const sum = Object.values(r.subjectStats).reduce((s, x) => s + x.score, 0);
        expect(sum).toBe(r.totalScore);
    });

    test('marking scheme defaults and validation', () => {
        expect(parseMarks({}, false)).toEqual({ correctM: 4, wrongM: -1, blankM: 0 });
        expect(parseMarks({}, true)).toEqual({ correctM: 1, wrongM: 0, blankM: 0 });
        expect(parseMarks({ correctM: 5, correctMarks: '2', wrongMarks: '-0.5' }, false)).toEqual({ correctM: 2, wrongM: -0.5, blankM: 0 });
        expect(parseMarks({ correctMarks: 'abc' }).error).toMatch(/correct/);
        expect(parseMarks({ wrongMarks: '1e9' }).error).toMatch(/wrong/);
        expect(parseMarks({ blankMarks: 'NaN' }).error).toMatch(/unattempted/);
    });
});

describe('series keys used for OMR grading', () => {
    const questions = Array.from({ length: 24 }, (_, i) => ({
        _id: `q${i}`, subject: i < 12 ? 'Physics' : 'Chemistry',
        options: ['a', 'b', 'c', 'd'], answer: 'ABCD'[i % 4]
    }));
    const paper = { id: 77 };

    test('P is the master order; Q/R/S are permutations of the same questions', () => {
        const p = buildSeriesKey(paper, questions, 'P');
        expect(p.map(k => k.masterIndex)).toEqual(questions.map((_, i) => i));
        for (const s of ['Q', 'R', 'S']) {
            const k = buildSeriesKey(paper, questions, s);
            expect(k.map(x => x.masterIndex).sort((a, b) => a - b)).toEqual(questions.map((_, i) => i));
            expect(k.map(x => x.masterIndex)).not.toEqual(p.map(x => x.masterIndex));
        }
        expect(SERIES).toEqual(['P', 'Q', 'R', 'S']);
    });

    test('REGRESSION: grading a Q-series sheet against the master key gives a different (wrong) result', () => {
        const q = buildSeriesKey(paper, questions, 'R');
        // a student who answered every question of set R correctly...
        const detected = Object.fromEntries(q.map(k => [String(k.position), 'ABCD'[k.correctIndices[0]]]));
        const keyR = q.map(k => ({ number: k.position, id: k.questionId, subject: 'x', concept: 'x', correctIndices: k.correctIndices, correctAnswer: '' }));
        const master = buildSeriesKey(paper, questions, 'P').map(k => ({ number: k.position, id: k.questionId, subject: 'x', concept: 'x', correctIndices: k.correctIndices, correctAnswer: '' }));
        const marks = { correctM: 4, wrongM: -1, blankM: 0 };
        expect(evaluateSheet({ key: keyR, detectedAnswers: detected, marks }).correctCount).toBe(24);
        expect(evaluateSheet({ key: master, detectedAnswers: detected, marks }).correctCount).toBeLessThan(24);
    });

    test('sections stay in order', () => {
        for (const s of SERIES) {
            const subjects = buildSeriesKey(paper, questions, s).map(k => questions[k.masterIndex].subject);
            expect(subjects).toEqual([...Array(12).fill('Physics'), ...Array(12).fill('Chemistry')]);
        }
    });
});

describe('subject areas (question edit permissions)', () => {
    test('REGRESSION: "Maths" covers Mathematics; Biology covers Botany and Zoology; other subjects stay separate', () => {
        expect(rules.sameSubjectArea('Maths', 'Mathematics')).toBe(true);
        expect(rules.sameSubjectArea('mathematics', 'Maths')).toBe(true);
        expect(rules.sameSubjectArea('Biology', 'Botany')).toBe(true);
        expect(rules.sameSubjectArea('Zoology', 'Biology')).toBe(true);
        expect(rules.sameSubjectArea('Physics', 'Chemistry')).toBe(false);
        expect(rules.sameSubjectArea('Physics', 'Mathematics')).toBe(false);
        expect(rules.sameSubjectArea('', '')).toBe(false);
        expect(rules.sameSubjectArea(undefined, 'Physics')).toBe(false);
    });
});
