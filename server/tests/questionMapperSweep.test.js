const { mapSupabaseToQuestion } = require('../services/supabaseQuestions');

const base = { id: 'sweep-1', question: 'Find the value of x if 2x = 6.', q_type: 'mcq_single', chapter: 'Algebra', exams: ['JEE'], klass: '11' };
const marker = type => `Solution text.\n[QBP_TYPE:${type}]`;

describe('mapper sweep: stray type markers', () => {
    test('a plain multiple-choice row with a stray statement_based marker stays MCQ', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '1', opt_b: '2', opt_c: '3', opt_d: '4', correct_option: 'C', solution_text: marker('statement_based') });
        expect(q.type).toBe('MCQ');
        expect(q.answer).toBe('3');
        expect(q.keyProblem).toBeNull();
    });

    test('the marker still counts when the question really has statements', () => {
        const q = mapSupabaseToQuestion({ ...base, question: 'Statement I: Heat is energy.\nStatement II: Work is energy.\nChoose the correct answer.', opt_a: 'a', opt_b: 'b', opt_c: 'c', opt_d: 'd', correct_option: 'A', solution_text: marker('statement_based') });
        expect(q.type).toBe('STATEMENT_BASED');
        expect(q.statements.length).toBe(2);
    });
});

describe('mapper sweep: keys that hold the answer value instead of a letter', () => {
    test('a value key is turned into the letter of the option that reads the same', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '84', opt_b: '29', opt_c: '$90$', opt_d: '60', correct_option: '90' });
        expect(q.correct_option).toBe('C');
        expect(q.answer).toBe('$90$');
        expect(q.keyProblem).toBeNull();
    });

    test('a value key that no option matches is flagged, never guessed', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '84', opt_b: '29', opt_c: '72', opt_d: '60', correct_option: '27720' });
        expect(q.keyProblem).toBe('KEY_NOT_AN_OPTION');
    });

    test('multi-answer keys such as "A, B, D" are left alone', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '1', opt_b: '2', opt_c: '3', opt_d: '4', correct_option: 'A, B, D' });
        expect(q.keyProblem).toBeNull();
        expect(q.correct_option).toBe('A, B, D');
    });

    test('digit keys 1-4 still work', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '1', opt_b: '2', opt_c: '3', opt_d: '4', correct_option: '2' });
        expect(q.answer).toBe('2');
        expect(q.keyProblem).toBeNull();
    });
});

describe('mapper sweep: items that cannot be printed correctly are flagged', () => {
    test('an unfilled diagram placeholder is flagged', () => {
        const q = mapSupabaseToQuestion({ ...base, question: 'Refer to the figure. [DIAGRAM REQUIRED] Find x.', opt_a: '1', opt_b: '2', opt_c: '3', opt_d: '4', correct_option: 'A' });
        expect(q.keyProblem).toBe('DIAGRAM_MISSING');
    });

    test('a numerical question with no answer is flagged', () => {
        const q = mapSupabaseToQuestion({ ...base, q_type: 'numerical', correct_option: '', num_answer: '' });
        expect(q.keyProblem).toBe('NUMERICAL_NO_ANSWER');
    });

    test('a numerical question with an answer is fine', () => {
        const q = mapSupabaseToQuestion({ ...base, q_type: 'numerical', correct_option: '', num_answer: '18' });
        expect(q.keyProblem).toBeNull();
    });
});
