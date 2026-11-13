const { mapSupabaseToQuestion } = require('../services/supabaseQuestions');
const { assembleByQuotas } = require('../services/questionSelector');

const base = { id: 'q1', question: 'A body of mass 2 kg moves with speed 3 m/s. Find its kinetic energy.', q_type: 'mcq', chapter: 'Work', exams: ['NEET'], klass: '11' };

describe('question mapper: the marked answer is looked up in its own option slot', () => {
    test('normal question: answer text and no problem', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '3 J', opt_b: '6 J', opt_c: '9 J', opt_d: '12 J', correct_option: 'C' });
        expect(q.answer).toBe('9 J');
        expect(q.keyProblem).toBeNull();
        expect(q.options).toHaveLength(4);
    });

    test('digit keys (1-4) use the same slots', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '3 J', opt_b: '6 J', opt_c: '9 J', opt_d: '12 J', correct_option: '2' });
        expect(q.answer).toBe('6 J');
        expect(q.keyProblem).toBeNull();
    });

    test('marked option is empty (the commonest bank defect): flagged, not silently wrong', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '3 J', opt_b: '6 J', opt_c: '9 J', opt_d: '', correct_option: 'D' });
        expect(q.keyProblem).toBe('KEY_EMPTY_OPTION');
    });

    test('a gap between options is flagged, and the answer is still the right slot (it used to shift by one)', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '3 J', opt_b: '', opt_c: '9 J', opt_d: '12 J', correct_option: 'C' });
        expect(q.keyProblem).toBe('OPTION_GAP');
        expect(q.answer).toBe('9 J');   // before the fix this was "12 J"
    });

    test('true/false questions are not affected', () => {
        const q = mapSupabaseToQuestion({ ...base, q_type: 'true_false', opt_a: '', opt_b: '', correct_option: 'false' });
        expect(q.answer).toBe('False');
        expect(q.keyProblem).toBeNull();
    });

    test('numerical questions without options are not flagged', () => {
        const q = mapSupabaseToQuestion({ ...base, q_type: 'numerical', correct_option: '', num_answer: '18' });
        expect(q.keyProblem).toBeNull();
    });
});

describe('assertion-reason questions cut off after "Reason:"', () => {
    const ar = text => mapSupabaseToQuestion({ id: 'a1', q_type: 'assertion_reason', question: text, opt_a: 'Both true and R explains A', opt_b: 'Both true, R does not explain A', opt_c: 'A true, R false', opt_d: 'A false, R true', correct_option: 'A', chapter: 'Atoms', exams: ['NEET'], klass: '12' });

    test('a missing reason is flagged', () => {
        expect(ar('Assertion: In any triangle ABC,\nReason: ').keyProblem).toBe('AR_INCOMPLETE');
        expect(ar('Assertion: Let alpha satisfy 0 < alpha and\nReason: ').keyProblem).toBe('AR_INCOMPLETE');
    });

    test('a complete one is not', () => {
        expect(ar('Assertion: Balmer lines are visible.\nReason: they end on the second orbit.').keyProblem).toBeNull();
    });
});

describe('paper generation skips questions with a bad key and says so', () => {
    const good = i => ({ _id: `g${i}`, id: `g${i}`, chapter: 'Work', type: 'MCQ', level: 'medium', questionText: `Good question number ${i} about work and energy`, options: ['a', 'b', 'c', 'd'], correct_option: 'A', keyProblem: null });
    const bad = i => ({ ...good(100 + i), _id: `b${i}`, id: `b${i}`, correct_option: 'D', keyProblem: 'KEY_EMPTY_OPTION' });

    test('bad questions are never selected and a warning is reported', () => {
        const pool = [...Array.from({ length: 6 }, (_, i) => good(i)), bad(1), bad(2)];
        const res = assembleByQuotas({ chapterPools: { Work: pool }, chapterQuotas: { Work: 6 } });
        expect(res.questions).toHaveLength(6);
        expect(res.questions.every(q => !q.keyProblem)).toBe(true);
        expect(res.warnings.join(' ')).toMatch(/2 bank question\(s\) whose marked correct option is empty/);
    });
});
