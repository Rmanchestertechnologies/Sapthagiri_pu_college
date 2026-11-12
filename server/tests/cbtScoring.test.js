/**
 * Unit tests for CBT scoring and timing (no database required).
 * Run: npm run test:unit
 */
const cbt = require('../services/cbtScoring');

const mcq = (id, answer, over = {}) => ({
    _id: id, type: 'MCQ', subject: 'Physics', chapter: 'Atoms',
    options: ['alpha', 'beta', 'gamma', 'delta'], answer, ...over
});
const numerical = (id, answer) => ({ _id: id, type: 'NUMERICAL', subject: 'Physics', chapter: 'Nuclei', options: [], answer });
const ans = (questionId, selectedOption, over = {}) => ({ questionId, selectedOption, ...over });

describe('isAnswerCorrect - option questions', () => {
    test('letter key vs letter / digit / option-text responses', () => {
        const q = mcq('q1', 'B');
        expect(cbt.isAnswerCorrect(q, 'B')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'b')).toBe(true);
        expect(cbt.isAnswerCorrect(q, '2')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'beta')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'A')).toBe(false);
        expect(cbt.isAnswerCorrect(q, 'gamma')).toBe(false);
    });

    test('digit key and option-text key', () => {
        expect(cbt.isAnswerCorrect(mcq('q', '3'), 'C')).toBe(true);
        expect(cbt.isAnswerCorrect(mcq('q', '3'), 'B')).toBe(false);
        expect(cbt.isAnswerCorrect(mcq('q', 'delta'), 'D')).toBe(true);
        expect(cbt.isAnswerCorrect(mcq('q', 'delta'), 'A')).toBe(false);
    });

    test('REGRESSION: a key that is literally the option "Both A and B" means that option, not A or B', () => {
        const q = mcq('q', 'Both A and B', { options: ['x', 'y', 'Both A and B', 'Neither'] });
        expect(cbt.isAnswerCorrect(q, 'C')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'A')).toBe(false);
        expect(cbt.isAnswerCorrect(q, 'B')).toBe(false);
    });

    test('options whose text is a digit are still matched by position, not by value', () => {
        const q = mcq('q', 'B', { options: ['1', '4', '2', '3'] }); // correct option text is "4"
        expect(cbt.isAnswerCorrect(q, 'B')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'D')).toBe(false); // option D is "3"
    });

    test('a key listing several options accepts any one of them (single-choice screen)', () => {
        const q = mcq('q', 'A, C');
        expect(cbt.isAnswerCorrect(q, 'A')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'C')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'B')).toBe(false);
    });

    test('blank response or missing key is never correct', () => {
        expect(cbt.isAnswerCorrect(mcq('q', 'A'), null)).toBe(false);
        expect(cbt.isAnswerCorrect(mcq('q', 'A'), '')).toBe(false);
        expect(cbt.isAnswerCorrect(mcq('q', 'A'), '   ')).toBe(false);
        expect(cbt.isAnswerCorrect(mcq('q', null), 'A')).toBe(false);
        expect(cbt.isAnswerCorrect(mcq('q', ''), 'A')).toBe(false);
    });

    test('true / false questions compare by text', () => {
        const q = { _id: 't', type: 'TRUE_FALSE', options: ['True', 'False'], answer: 'False' };
        expect(cbt.isAnswerCorrect(q, 'False')).toBe(true);
        expect(cbt.isAnswerCorrect(q, 'True')).toBe(false);
    });
});

describe('isAnswerCorrect - question-bank shaped questions', () => {
    // mapSupabaseToQuestion sets answer = the option TEXT and correct_option = the option LETTER
    const bank = (over = {}) => ({ type: 'MCQ', options: ['10 m/s', '20 m/s', '20 m/s', '40 m/s'], answer: '20 m/s', correct_option: 'C', ...over });

    test('REGRESSION: the letter decides, so a duplicated option text cannot be matched to the wrong option', () => {
        expect(cbt.isAnswerCorrect(bank(), 'C')).toBe(true);
        expect(cbt.isAnswerCorrect(bank(), 'B')).toBe(false); // same text as C, but the key says C
    });
    test('digit letters and missing correct_option fall back to answer', () => {
        expect(cbt.isAnswerCorrect(bank({ correct_option: '4', answer: '40 m/s' }), 'D')).toBe(true);
        expect(cbt.isAnswerCorrect(bank({ correct_option: '', answer: 'A' }), 'A')).toBe(true);
        expect(cbt.isAnswerCorrect(bank({ correct_option: undefined, answer: '10 m/s' }), 'A')).toBe(true);
    });
    test('numerical bank questions use num_answer first', () => {
        const n = { type: 'NUMERICAL', options: [], answer: '12', correct_option: '12', num_answer: '12' };
        expect(cbt.isAnswerCorrect(n, '12')).toBe(true);
        expect(cbt.isAnswerCorrect(n, '21')).toBe(false);
    });
});

describe('isAnswerCorrect - numerical questions', () => {
    test('numeric equality including decimals and negative values', () => {
        expect(cbt.isAnswerCorrect(numerical('n', '12'), '12')).toBe(true);
        expect(cbt.isAnswerCorrect(numerical('n', '12'), '12.0')).toBe(true);
        expect(cbt.isAnswerCorrect(numerical('n', '-2.5'), '-2.50')).toBe(true);
        expect(cbt.isAnswerCorrect(numerical('n', 4), '4')).toBe(true);
        expect(cbt.isAnswerCorrect(numerical('n', '12'), '13')).toBe(false);
    });

    test('REGRESSION: typed digits are not read as option labels ("21" used to match a key of "12")', () => {
        expect(cbt.isAnswerCorrect(numerical('n', '12'), '21')).toBe(false);
        expect(cbt.isAnswerCorrect(numerical('n', '3'), '13')).toBe(false);
        expect(cbt.isAnswerCorrect(numerical('n', '2'), 'B')).toBe(false);
        expect(cbt.isAnswerCorrect(numerical('n', '1'), 'A')).toBe(false);
    });
});

describe('scoreExam', () => {
    const exam = (examType) => ({
        examType,
        questions: [mcq('q1', 'A'), mcq('q2', 'B'), mcq('q3', 'C', { chapter: 'Nuclei' }), mcq('q4', 'D'), numerical('q5', '7')]
    });
    const responses = [ans('q1', 'A'), ans('q2', 'A'), ans('q3', 'D'), ans('q4', null), ans('q5', '7')];

    test('NEET/JEE marking: +4 correct, -1 incorrect, 0 unattempted', () => {
        const r = cbt.scoreExam(exam('NEET'), responses);
        expect(r).toMatchObject({ correct: 2, incorrect: 2, unattempted: 1, attempted: 4, totalQuestions: 5, score: 6 });
    });

    test('CET marking: +1 correct, no negative marking', () => {
        const r = cbt.scoreExam(exam('CET'), responses);
        expect(r).toMatchObject({ correct: 2, incorrect: 2, unattempted: 1, score: 2 });
        expect(cbt.scoreExam(exam('KCET'), responses).score).toBe(2);
    });

    test('counts always add up to the number of questions', () => {
        const r = cbt.scoreExam(exam('NEET'), responses);
        expect(r.correct + r.incorrect + r.unattempted).toBe(r.totalQuestions);
        expect(r.answers).toHaveLength(5);
    });

    test('weak areas group incorrect answers by subject and chapter, worst first', () => {
        const r = cbt.scoreExam(exam('NEET'), [ans('q1', 'B'), ans('q2', 'A'), ans('q3', 'D')]);
        expect(r.weakAreas).toEqual([
            { subject: 'Physics', chapter: 'Atoms', incorrect: 2 },
            { subject: 'Physics', chapter: 'Nuclei', incorrect: 1 }
        ]);
    });

    test('answers for questions not in the exam are ignored; unanswered exam is all unattempted', () => {
        const r = cbt.scoreExam(exam('NEET'), [ans('zzz', 'A')]);
        expect(r).toMatchObject({ correct: 0, incorrect: 0, unattempted: 5, score: 0 });
        expect(cbt.scoreExam(exam('NEET'), []).unattempted).toBe(5);
        expect(cbt.scoreExam({ examType: 'NEET', questions: [] }, []).totalQuestions).toBe(0);
    });

    test('per-question verdicts agree with the totals (scorecard uses the same rule)', () => {
        const e = exam('NEET');
        const r = cbt.scoreExam(e, responses);
        const recount = e.questions.filter((q, i) => cbt.isAnswerCorrect(q, responses.find(a => a.questionId === cbt.questionKey(q, i))?.selectedOption)).length;
        expect(recount).toBe(r.correct);
        expect(r.answers.filter(a => a.isCorrect)).toHaveLength(r.correct);
    });

    test('questions without ids fall back to their position', () => {
        const e = { examType: 'CET', questions: [{ options: ['a', 'b'], answer: 'A' }, { options: ['a', 'b'], answer: 'B' }] };
        expect(cbt.scoreExam(e, [ans('0', 'A'), ans('1', 'B')]).score).toBe(2);
    });
});

describe('scoreExam - section marking rules', () => {
    const e = {
        examType: 'NEET',
        sections: [
            { sectionName: 'Physics - Section A', markingRules: { correct: 4, incorrect: -1, unattempted: 0 } },
            { sectionName: 'Maths - Section A', markingRules: { correct: 2, incorrect: 0, unattempted: 0 } },
        ],
        questions: [mcq('p1', 'A', { sectionName: 'Physics - Section A' }), mcq('m1', 'A', { sectionName: 'Maths - Section A' }), mcq('m2', 'A', { sectionName: 'Maths - Section A' }), mcq('x1', 'A')],
    };
    test('REGRESSION: a section rule overrides the exam-type rule (merged exams used to ignore it)', () => {
        const r = cbt.scoreExam(e, [ans('p1', 'A'), ans('m1', 'A'), ans('m2', 'B'), ans('x1', 'B')]);
        // p1 +4, m1 +2, m2 wrong 0 (maths has no negative marking), x1 has no section -> exam-type rule -1
        expect(r.score).toBe(4 + 2 + 0 - 1);
    });
    test('malformed rules fall back to the exam-type rule', () => {
        const bad = { ...e, sections: [{ sectionName: 'Physics - Section A', markingRules: { correct: 'x' } }] };
        expect(cbt.scoreExam(bad, [ans('p1', 'A')]).score).toBe(4);
    });
});

describe('mergeAnswers - autosave recovery', () => {
    const saved = [ans('q1', 'A'), ans('q2', 'B'), ans('q3', 'C')];

    test('REGRESSION: an empty submit payload keeps the autosaved answers', () => {
        const e = { examType: 'CET', questions: [mcq('q1', 'A'), mcq('q2', 'B'), mcq('q3', 'C')] };
        expect(cbt.scoreExam(e, cbt.mergeAnswers(saved, [])).score).toBe(3);
        expect(cbt.scoreExam(e, cbt.mergeAnswers(saved, undefined)).score).toBe(3);
    });

    test('submitted answers override saved ones, including an explicit clear', () => {
        const m = cbt.mergeAnswers(saved, [ans('q1', 'D'), ans('q2', null)]);
        expect(m.get('q1').selectedOption).toBe('D');
        expect(m.get('q2').selectedOption).toBeNull();
        expect(m.get('q3').selectedOption).toBe('C');
    });

    test('a partial payload does not drop the other questions', () => {
        expect([...cbt.mergeAnswers(saved, [ans('q2', 'A')]).keys()].sort()).toEqual(['q1', 'q2', 'q3']);
    });
});

describe('timing', () => {
    const T0 = Date.parse('2026-11-11T09:00:00Z');
    const session = { start_time: new Date(T0).toISOString() };
    const exam = { duration_minutes: 60 };
    const min = n => n * 60000;

    test('remaining time counts down from the session start on the server clock', () => {
        expect(cbt.remainingSeconds(exam, session, T0)).toBe(3600);
        expect(cbt.remainingSeconds(exam, session, T0 + min(15))).toBe(2700);
        expect(cbt.remainingSeconds(exam, session, T0 + min(61))).toBe(0);
    });

    test('a resumed session (page refresh / reconnection) keeps its original deadline', () => {
        const before = cbt.sessionDeadline(exam, session);
        const resumed = { ...session, answers: [ans('q1', 'A')] };
        expect(cbt.sessionDeadline(exam, resumed)).toBe(before);
    });

    test('scheduled end time caps a late starter', () => {
        const capped = { duration_minutes: 60, end_time: new Date(T0 + min(40)).toISOString() };
        expect(cbt.remainingSeconds(capped, session, T0)).toBe(2400);
    });

    test('session rows using startTime or only created_at are supported; missing data gives null', () => {
        expect(cbt.remainingSeconds(exam, { startTime: new Date(T0) }, T0)).toBe(3600);
        expect(cbt.remainingSeconds(exam, { created_at: new Date(T0) }, T0)).toBe(3600);
        expect(cbt.remainingSeconds({}, {}, T0)).toBeNull();
        expect(Number.isNaN(cbt.remainingSeconds(exam, { start_time: 'garbage' }, T0))).toBe(false);
    });

    test('deadline has a two-minute network grace, then submissions are late', () => {
        expect(cbt.isPastDeadline(exam, session, T0 + min(59))).toBe(false);
        expect(cbt.isPastDeadline(exam, session, T0 + min(61))).toBe(false); // inside grace
        expect(cbt.isPastDeadline(exam, session, T0 + min(63))).toBe(true);
        expect(cbt.isPastDeadline({}, {}, T0)).toBe(false); // no timing configured: never late
    });

    test('start window: before start, during, after end, and unscheduled', () => {
        const scheduled = { start_time: new Date(T0).toISOString(), end_time: new Date(T0 + min(60)).toISOString() };
        expect(cbt.startWindowError(scheduled, T0 - 1000)).toMatch(/not started/);
        expect(cbt.startWindowError(scheduled, T0 + min(10))).toBeNull();
        expect(cbt.startWindowError(scheduled, T0 + min(61))).toMatch(/ended/);
        expect(cbt.startWindowError({}, T0)).toBeNull();
    });
});
