const { validateFixFields, buildFixUpdate, mapSupabaseToQuestion } = require('../services/supabaseQuestions');

const qbpData = Buffer.from(JSON.stringify({ columnA: ['A. First', 'B. Second'], columnB: ['1. one', '2. two'], matchOptions: { A: ['2'], B: ['1'] } })).toString('base64');
const matchRow = {
    id: '4da7bf96-cd86-4d08-9065-4277a721b956', subject: 'Physics', klass: '11', chapter: 'Laws of Motion', exams: ['JEE'], q_type: 'mcq_single',
    question: 'Match the laws in Column I with Column II.', correct_option: 'A → 2; B → 1',
    solution_text: `Explanation.\n[QBP_TYPE:match]\n[QBP_DATA:${qbpData}]\n[QBP_DIFFICULTY:Medium]`,
};

// applies the SET list the way Postgres would, so the result can be mapped again
function applyUpdate(row, update) {
    const out = { ...row };
    update.sets.forEach((s, i) => { out[/^(\w+) = /.exec(s)[1]] = update.params[i]; });
    return out;
}

describe('fix question: what may be changed', () => {
    test('only whitelisted text fields pass; unknown fields (type, subject, id ...) are ignored', () => {
        const r = validateFixFields({ question: 'New text', q_type: 'numerical', subject: 'Chemistry', id: 'x', klass: '12' });
        expect(r.values).toEqual({ question: 'New text' });
    });

    test('nothing to change, empty question, wrong types and oversized text are refused', () => {
        expect(validateFixFields({}).error).toBeTruthy();
        expect(validateFixFields({ question: '   ' }).error).toMatch(/empty/);
        expect(validateFixFields({ opt_a: 5 }).error).toMatch(/text/);
        expect(validateFixFields({ question: 'x'.repeat(20001) }).error).toMatch(/too long/);
    });

    test('answer keys: letters, combinations and match pairs are accepted; anything else is refused', () => {
        for (const k of ['A', 'd', 'A, C', 'B & D', '2', 'A → 4; B → 2; C → 3; D → 1', 'A-(4), B-(2)']) expect(validateFixFields({ correct_option: k }).error).toBeUndefined();
        for (const k of ['Z', 'E', '90 apples', '<script>']) expect(validateFixFields({ correct_option: k }).error).toBeTruthy();
        expect(validateFixFields({ correct_option: '' }).values).toEqual({ correct_option: '' });
    });
});

describe('fix question: the UPDATE it builds', () => {
    test('touches only the submitted columns plus the audit columns', () => {
        const u = buildFixUpdate({ opt_b: '$x^2$', correct_option: 'b' }, '', 'not-a-uuid', 'Teacher');
        const cols = u.sets.map(s => /^(\w+) =/.exec(s)[1]);
        expect(cols).toEqual(['opt_b', 'correct_option', 'updated_by', 'updated_at'.replace('updated_at', 'updated_by_name'), 'updated_at']);
        expect(u.params[1]).toBe('B');            // answer letter is stored upper case
        expect(u.params[2]).toBeNull();           // a non-uuid user id is not stored
        expect(u.params[3]).toBe('Teacher');
    });

    test('a corrected solution keeps the hidden type / match / difficulty lines', () => {
        const u = buildFixUpdate({ solution_text: 'New explanation with $x$.' }, matchRow.solution_text, null, 'T');
        const stored = u.params[0];
        expect(stored.startsWith('New explanation with')).toBe(true);
        expect(stored).toContain('[QBP_TYPE:match]');
        expect(stored).toContain('[QBP_DATA:');
        expect(stored).toContain('[QBP_DIFFICULTY:Medium]');
    });

    test('a match question stays a match question, with its columns and key, after its question text is fixed', () => {
        const before = mapSupabaseToQuestion(matchRow);
        const after = mapSupabaseToQuestion(applyUpdate(matchRow, buildFixUpdate({ question: 'Match the laws in Column I with their descriptions in Column II.' }, matchRow.solution_text, null, 'T')));
        expect(before.type).toBe('MATCH_FOLLOWING');
        expect(after.type).toBe('MATCH_FOLLOWING');
        expect(after.columnA).toEqual(before.columnA);
        expect(after.answer).toBe(before.answer);
        expect(after.questionText).toContain('descriptions');
    });

    test('fixing options and the answer of an ordinary question changes just those', () => {
        const row = { id: 'q-1', subject: 'Mathematics', klass: '11', chapter: 'Sets', exams: ['JEE'], q_type: 'mcq_single', question: 'Find x.', opt_a: '1', opt_b: '1', opt_c: '3', opt_d: '4', correct_option: 'A', solution_text: 'S\n[QBP_DIFFICULTY:Easy]' };
        expect(mapSupabaseToQuestion(row).keyProblem).toBe('DUPLICATE_OPTIONS');
        const fixed = mapSupabaseToQuestion(applyUpdate(row, buildFixUpdate({ opt_b: '2' }, row.solution_text, null, 'T')));
        expect(fixed.keyProblem).toBeNull();
        expect(fixed.options).toEqual(['1', '2', '3', '4']);
        expect(fixed.answer).toBe('1');
        expect(fixed.chapter).toBe('Sets');
        expect(fixed.level).toBe('easy');
    });
});
