const { proposeFixes, letterFromAnswerText } = require('../services/questionFixPlan');

const base = {
    question: 'A particle of mass m moves in a circle of radius r with speed v. Find the centripetal force.',
    q_type: 'mcq', opt_a: 'mv^2/r', opt_b: 'mvr', opt_c: 'm v r^2', opt_d: 'zero'
};

describe('question fix plan', () => {
    test('a missing correct_option is proposed from the answer text when exactly one option matches', () => {
        const fixes = proposeFixes({ ...base, correct_option: '', answer: 'mvr' });
        expect(fixes).toEqual([expect.objectContaining({ issue: 'BAD_CORRECT_OPTION', action: 'SET', proposed: 'B', confidence: 'high' })]);
    });

    test('no proposal when the answer matches none or several options', () => {
        expect(proposeFixes({ ...base, correct_option: '', answer: 'something else' })[0]).toMatchObject({ action: 'REVIEW', proposed: '' });
        expect(letterFromAnswerText({ ...base, opt_b: 'zero', answer: 'zero' })).toBeNull();
    });

    test('a valid row proposes nothing', () => {
        expect(proposeFixes({ ...base, correct_option: 'A', answer: 'mv^2/r' })).toEqual([]);
    });

    test('rows that cannot be fixed by machine are REVIEW only', () => {
        const fixes = proposeFixes({ ...base, opt_c: '', opt_d: '', opt_b: '', correct_option: 'A' });
        expect(fixes.every(f => f.action === 'REVIEW')).toBe(true);
    });
});
