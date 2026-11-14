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

describe('match questions with blank stored columns', () => {
    test('blank entries make the mapper ignore the stored columns (the question text is parsed instead)', () => {
        const row = { id: 'm1', q_type: 'mcq', question: 'Match the following.\n\nColumn I\nElectronic Conductor\nElectrolytic Conductor\nNon-electrolyte\nWeak electrolyte\n\nColumn II\nAcetic acid\nSolid salts\nSucrose\nMolten salts',
            column_a: ['', '', 'Non-electrolyte', 'Weak electrolyte'], column_b: ['Acetic acid', 'Solid salts', 'Sucrose', 'Molten salts'], chapter: 'c', exams: ['NEET'], klass: '12' };
        const q = mapSupabaseToQuestion(row);
        expect(q.column_a).toEqual([]);
        expect(q.matchPairs).toEqual([]);
        expect(q.questionText).toMatch(/Electronic Conductor/);
    });

    test('complete columns are kept', () => {
        const q = mapSupabaseToQuestion({ id: 'm2', q_type: 'mcq', question: 'Match the following.', column_a: ['Acetic acid', 'Benzene'], column_b: ['Weak acid', 'Hydrocarbon'], chapter: 'c', exams: ['NEET'], klass: '12' });
        expect(q.matchPairs).toEqual([{ left: 'Acetic acid', right: 'Weak acid' }, { left: 'Benzene', right: 'Hydrocarbon' }]);
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

describe('question mapper: match-the-following questions', () => {
    const colA = ["A. Newton's First Law", "B. Newton's Second Law", "C. Newton's Third Law", 'D. Conservation of Momentum'];
    const colB = ['1. Momentum stays constant', '2. F = ma', '3. Action and reaction', '4. A body stays at rest or in uniform motion'];
    const qbp = Buffer.from(JSON.stringify({ columnA: colA, columnB: colB, matchOptions: { A: ['4'], B: ['2'], C: ['3'], D: ['1'] } })).toString('base64');
    const matchRow = {
        ...base, id: '4da7bf96-cd86-4d08-9065-4277a721b956', q_type: 'mcq',
        question: 'The statements correspond to laws.\nMatch the laws in Column I with Column II.\nA. First\nB. Second\nC. Third\nD. Momentum',
        correct_option: 'A → 4; B → 2; C → 3; D → 1',
        solution_text: `Explanation.\n[QBP_TYPE:match]\n[QBP_DATA:${qbp}]`,
    };

    test('is typed MATCH_FOLLOWING (not statement-based) and gets real match codes with the right key', () => {
        const q = mapSupabaseToQuestion(matchRow);
        expect(q.type).toBe('MATCH_FOLLOWING');
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options.some(o => /Statement/i.test(o))).toBe(false);
        expect(q.answer).toBe('A-(4), B-(2), C-(3), D-(1)');
        expect(q.options['ABCD'.indexOf(q.correct_option)]).toBe('A-(4), B-(2), C-(3), D-(1)');
        expect(q.keyProblem).toBeNull();
    });

    test('column items no longer carry their own "A." / "1." label', () => {
        const q = mapSupabaseToQuestion(matchRow);
        expect(q.columnA[0]).toBe("Newton's First Law");
        expect(q.columnB[1]).toBe('F = ma');
        expect(q.questionText).not.toMatch(/\(a\)\s*A\./i);
    });

    test('roman / p-q-r keys are turned into numbers; the key position is stable per question', () => {
        const a = mapSupabaseToQuestion({ ...matchRow, correct_option: 'A → iv; B → ii; C → iii; D → i' });
        expect(a.answer).toBe('A-(4), B-(2), C-(3), D-(1)');
        expect(mapSupabaseToQuestion(matchRow).correct_option).toBe(mapSupabaseToQuestion(matchRow).correct_option);
    });

    test('an unreadable key is flagged instead of guessed', () => {
        const q = mapSupabaseToQuestion({ ...matchRow, correct_option: 'A', solution_text: '[QBP_TYPE:match]' });
        expect(q.keyProblem).toBe('MATCH_KEY_UNKNOWN');
    });

    test('a genuine two-statement question is still statement-based', () => {
        const q = mapSupabaseToQuestion({ ...base, q_type: 'statement_based', question: 'Statement I: Heat is energy.\nStatement II: Work is energy.\nChoose the correct answer.', opt_a: 'a', opt_b: 'b', opt_c: 'c', opt_d: 'd', correct_option: 'A' });
        expect(q.type).toBe('STATEMENT_BASED');
    });
});

describe('question mapper: duplicate options', () => {
    test('two options that read the same are flagged', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_a: '$7,6$', opt_b: '$7,6$', opt_c: '$6,4$', opt_d: '$7,4$', correct_option: 'A' });
        expect(q.keyProblem).toBe('DUPLICATE_OPTIONS');
    });
});
