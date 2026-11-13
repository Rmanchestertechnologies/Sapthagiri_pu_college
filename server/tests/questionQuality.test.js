const { checkRow } = require('../services/questionQuality');

const good = {
    question: 'A particle of mass m moves in a circle of radius r with speed v. Find the centripetal force.',
    q_type: 'mcq',
    opt_a: 'mv^2/r', opt_b: 'mvr', opt_c: 'm v r^2', opt_d: 'zero',
    correct_option: 'A',
    concept: 'Circular motion'
};

describe('question bank quality rules', () => {
    test('a well-formed MCQ has no issues', () => {
        expect(checkRow(good)).toEqual([]);
    });

    test('missing, duplicated and empty options', () => {
        expect(checkRow({ ...good, opt_c: '', opt_d: '', opt_b: '' })).toContain('NO_OPTIONS');
        expect(checkRow({ ...good, opt_b: 'MV^2/r' })).toContain('DUPLICATE_OPTIONS');
    });

    test('correct_option must exist and point at a real option', () => {
        expect(checkRow({ ...good, correct_option: '' })).toContain('BAD_CORRECT_OPTION');
        expect(checkRow({ ...good, correct_option: 'E' })).toContain('BAD_CORRECT_OPTION');
        expect(checkRow({ ...good, opt_d: '', correct_option: 'D' })).toContain('BAD_CORRECT_OPTION');
        expect(checkRow({ ...good, correct_option: '3' })).not.toContain('BAD_CORRECT_OPTION');
    });

    test('numerical questions need a numeric answer but not options', () => {
        const num = { question: 'Find the value of g at the surface of the earth in SI units.', q_type: 'numerical', answer: '9.8' };
        expect(checkRow(num)).toEqual([]);
        expect(checkRow({ ...num, answer: 'ten metres per second squared' })).toContain('NUMERICAL_TEXT_ANSWER');
        expect(checkRow({ ...num, answer: '1,200' })).toEqual([]);
    });

    test('math delimiters', () => {
        expect(checkRow({ ...good, question: good.question + ' Take $g = 10 m/s^2.' })).toContain('UNBALANCED_MATH');
        expect(checkRow({ ...good, question: good.question + ' Take $g = 10$ SI.' })).not.toContain('UNBALANCED_MATH');
        expect(checkRow({ ...good, question: good.question + ' It costs \\$5.' })).not.toContain('UNBALANCED_MATH');
    });

    test('garbled fractions and placeholders', () => {
        expect(checkRow({ ...good, opt_a: '\\sigma}2\\epsilon_0' })).toContain('BROKEN_FRACTION');
        expect(checkRow({ ...good, opt_a: '\\frac{\\sigma}{2\\epsilon_0}' })).not.toContain('BROKEN_FRACTION');
        expect(checkRow({ ...good, concept: '[UNCLEAR]' })).toContain('UNCLEAR_MARKER');
        expect(checkRow({ ...good, question: good.question + ' [QBP_DIFFICULTY:Easy]' })).toContain('LEAKED_MARKER');
    });

    test('assertion-reason questions need a reason', () => {
        const ar = { ...good, q_type: 'assertion_reason', question: 'Assertion: Balmer series lies in the visible region.' };
        expect(checkRow(ar)).toContain('AR_WITHOUT_REASON');
        expect(checkRow({ ...ar, reason: 'It is due to transitions to n = 2.' })).not.toContain('AR_WITHOUT_REASON');
        expect(checkRow({ ...ar, question: ar.question + '\nReason: transitions end at n = 2.' })).not.toContain('AR_WITHOUT_REASON');
        expect(checkRow({ ...ar, question: ar.question + '\nReason: ' })).toContain('AR_WITHOUT_REASON');   // label with nothing after it
    });

    test('duplicates are detected across rows', () => {
        const seen = new Set();
        expect(checkRow(good, seen)).toEqual([]);
        expect(checkRow({ ...good, question: good.question.toUpperCase() }, seen)).toContain('DUPLICATE_QUESTION');
    });
});
