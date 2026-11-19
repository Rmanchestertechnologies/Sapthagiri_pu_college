// Questions that cannot be shown whole are flagged (kept out of papers and listed under "Needs fixing") instead of printing with
// an empty Column II, empty statements or no question text. Shapes taken from real bank rows.
const { mapSupabaseToQuestion, matchColumnsIncomplete } = require('../services/supabaseQuestions');

const base = { id: 'm1', chapter: 'Structure of Atom', exams: ['NEET'], klass: '11', q_type: 'mcq_single' };
const qbp = (data) => `\n[QBP_TYPE:match]\n[QBP_DATA:${Buffer.from(JSON.stringify(data)).toString('base64')}]`;

describe('match columns that are cut short', () => {
    test('Column II holds one item while the codes name a, b, c, d: flagged', () => {
        const q = mapSupabaseToQuestion({
            ...base,
            question: 'Match species given in column I with the electronic configuration given in Column II.\n\n**Column I**\nCr⁺\nFe²⁺\nNi³⁺\nCu⁺\n\n**Column II**\n[Ar]3d⁷4s⁰',
            opt_a: 'i→b, ii→d, iii→c, iv→a', opt_b: 'i→a, ii→b, iii→c, iv→d', opt_c: 'i→d, ii→c, iii→a, iv→b', opt_d: 'i→d, ii→b, iii→a, iv→c',
            correct_option: 'C',
            solution_text: 'x' + qbp({ columnA: ['Cr⁺', 'Fe²⁺', 'Ni³⁺', 'Cu⁺'], columnB: ['[Ar]3d⁷4s⁰'] }),
        });
        expect(q.keyProblem).toBe('MATCH_COLUMNS_INCOMPLETE');
    });

    test('complete columns are fine, whatever the label style', () => {
        expect(matchColumnsIncomplete(['a', 'b', 'c', 'd'], ['1', '2', '3', '4'], ['A-(Q); B-(P); C-(S); D-(R)', 'A-(S); B-(Q); C-(P); D-(R)'])).toBe(false);
        expect(matchColumnsIncomplete(['a', 'b', 'c', 'd'], ['1', '2', '3', '4'], ['i→b, ii→d, iii→c, iv→a'])).toBe(false);
        // Column II lettered e-h after Column I a-d
        expect(matchColumnsIncomplete(['a', 'b', 'c', 'd'], ['1', '2', '3', '4'], ['a-e, b-g, c-h, d-f', 'a-f, b-e, c-g, d-h'])).toBe(false);
        // no stored columns: left to the paper's text parsing
        expect(matchColumnsIncomplete([], [], ['A-(1), B-(2)'])).toBe(false);
    });

    test('codes naming a fifth Column I item that the column does not have: flagged', () => {
        expect(matchColumnsIncomplete(['a', 'b', 'c', 'd'], ['1', '2', '3', '4', '5'], ['A-(i), B-(ii), C-(iii), D-(iv), E-(v)'])).toBe(true);
    });

    test('a fifth item glued onto the fourth ("Vexillary (e) United sepals") is split back into its own row', () => {
        const q = mapSupabaseToQuestion({
            ...base, id: 'm2',
            question: 'Match the following.',
            opt_a: 'a-(ii), b-(iii), c-(i), d-(v), e-(iv)', opt_b: 'a-(i), b-(iii), c-(ii), d-(v), e-(iv)', opt_c: 'a-(iv), b-(iii), c-(i), d-(v), e-(ii)', opt_d: 'a-(ii), b-(v), c-(i), d-(iii), e-(iv)',
            correct_option: 'A',
            solution_text: 'x' + qbp({ columnA: ['Valvate', 'Twisted', 'Imbricate', 'Vexillary (e) United sepals'], columnB: ['Gulmohar', 'Calotropis', 'Cotton', 'Gamosepalous', 'Bean'] }),
        });
        expect(q.columnA).toEqual(['Valvate', 'Twisted', 'Imbricate', 'Vexillary', 'United sepals']);
        expect(q.keyProblem).toBeNull();
    });
});

describe('nothing to read', () => {
    test('statements that are only labels are flagged', () => {
        const q = mapSupabaseToQuestion({ ...base, id: 's1', question: 'Statement I: \nStatement II: ', opt_a: 'Statement I is true but Statement II is false', opt_b: 'Both true', opt_c: 'Both false', opt_d: 'Statement I is false but Statement II is true', correct_option: 'A' });
        expect(q.keyProblem).toBe('STATEMENTS_MISSING');
    });

    test('an image-only question is fine', () => {
        const q = mapSupabaseToQuestion({ ...base, id: 'i1', question: '{{IMG::https://res.cloudinary.com/x/image/upload/a.jpg}}', opt_a: 'A-5, B-4', opt_b: 'A-3, B-4', opt_c: 'A-5, B-2', opt_d: 'A-5, B-1', correct_option: 'A' });
        expect(q.keyProblem).not.toBe('QUESTION_TEXT_MISSING');
    });

    test('statements pulled out of the text leave the question readable', () => {
        const q = mapSupabaseToQuestion({ ...base, id: 's2', question: 'Statement-I: $\\int_0^1 x\\,dx=\\frac12$.\nStatement-II: $\\int_0^1 1\\,dx=1$.', opt_a: 'Statement-I and Statement-II are both true', opt_b: 'Statement-I and Statement-II are both false', opt_c: 'Statement-I is true but Statement-II is false', opt_d: 'Statement-I is false but Statement-II is true', correct_option: 'A' });
        expect(q.questionText).toBe(''); // the statements were taken out of the text ...
        expect(q.statements).toHaveLength(2); // ... and are delivered here, so the card and the paper still show them
        expect(q.keyProblem).toBeNull();
    });
});

describe('a statement that lost its text is flagged (it printed as a bare "Statement I:")', () => {
    const { hasEmptyStatementLabel } = require('../services/supabaseQuestions');
    test('detects an empty label', () => {
        expect(hasEmptyStatementLabel('Statement I: \nStatement II: Urea is an ionic compound.')).toBe(true);
        expect(hasEmptyStatementLabel('Statement I: \nStatement II: ')).toBe(true);
        expect(hasEmptyStatementLabel('Two statements:\nStatement I: X is true.\nStatement II:')).toBe(true);
    });
    test('leaves complete statements alone', () => {
        expect(hasEmptyStatementLabel('Statement I: A is true.\nStatement II: B is true.')).toBe(false);
        expect(hasEmptyStatementLabel('Statement I:\nOxygen is paramagnetic.\nStatement II: Nitrogen is diamagnetic.')).toBe(false);
    });
    test('the phy_11 question from the paper photo (options 2, 3, 4, 1) is kept out of papers', () => {
        const q = mapSupabaseToQuestion({ id: 'x', subject: 'Physics', klass: '11', chapter: 'Units', q_type: 'mcq_single', question: 'Statement I: \nStatement II: ', opt_a: '2', opt_b: '3', opt_c: '4', opt_d: '1', correct_option: 'A' });
        expect(q.keyProblem).toBe('STATEMENTS_MISSING');
    });
    test('only Statement I empty is kept out of papers too', () => {
        const q = mapSupabaseToQuestion({ id: 'y', subject: 'Chemistry', klass: '11', chapter: 'Basic', q_type: 'mcq_single', question: 'Statement I: \nStatement II: Urea is an ionic compound.', opt_a: 'Both correct', opt_b: 'Both incorrect', opt_c: 'I correct', opt_d: 'II correct', correct_option: 'D' });
        expect(q.keyProblem).toBe('STATEMENTS_MISSING');
    });
});
