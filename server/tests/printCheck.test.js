const { textIsBroken, questionPrintIsBroken } = require('../services/printCheck');
const { mapSupabaseToQuestion } = require('../services/supabaseQuestions');

const R = String.raw;
const base = { id: 'pc-1', question: 'Find the value.', q_type: 'mcq_single', chapter: 'Algebra', exams: ['JEE'], klass: '11', opt_a: '1', opt_b: '2', opt_c: '3', opt_d: '4', correct_option: 'A' };

describe('print check: maths that cannot be typeset', () => {
    test('good maths and plain text are fine', () => {
        for (const t of ['Which is prime?', R`If $x^2=4$ then $x=2$`, R`$$\frac{a}{b}$$ and $\sqrt{2}$`, R`$C_2H_4 \xrightarrow{B_2H_6} A \xrightarrow[\mathrm{NaOH}]{H_2O} Z$`,
            R`$24\text{ \mu T}$`, R`\(A=\{1,2\}\)`, R`$2f(x)=x.\tag{1}$`, '', null]) {
            expect(textIsBroken(t)).toBe(false);
        }
    });

    test('cut-off equations, empty fractions and an unknown command are broken', () => {
        for (const t of [R`$\frac{1}{2$`, R`$$\left(\right$$`, R`$\lim_{x\to} \frac{\sin x}{$ then`,R`$\notacommand{x}$`, R`$\mathrm{{[NiCl_{4}]^{2-}}$`]) {
            expect(textIsBroken(t)).toBe(true);
        }
    });

    test('an unpaired $ is broken unless what follows is clearly maths (the paper repairs that case)', () => {
        expect(textIsBroken('It costs $5 each')).toBe(true);
        expect(textIsBroken(R`for some $c\in(0,5),`)).toBe(false);
        expect(textIsBroken('Reason: $$')).toBe(true);
    });

    // Rule since 19 Nov 2026 (requested by the college): a fault in ANY part hides the question, the solution included, because
    // the solution prints in the answer key.
    test('a question is broken when any part is, the solution included', () => {
        const q = { type: 'MCQ', questionText: 'Q', options: ['1', R`$\frac{1}{2$`, '3', '4'] };
        expect(questionPrintIsBroken(q)).toBe(true);
        expect(questionPrintIsBroken({ type: 'MCQ', questionText: 'Q', options: ['1', '2', '3', '4'], solutionText: R`$\frac{1}{2$` })).toBe(true);
        expect(questionPrintIsBroken({ type: 'MCQ', questionText: 'Q', options: ['1', '2', '3', '4'], solutionText: R`$\frac{1}{2}$` })).toBe(false);
    });
});

describe('print check: the mapper flags such questions so papers never get them', () => {
    test('a question with a cut-off equation in an option is flagged PRINT_BROKEN', () => {
        const q = mapSupabaseToQuestion({ ...base, opt_b: R`$\frac{1}{2$` });
        expect(q.keyProblem).toBe('PRINT_BROKEN');
    });

    test('a broken statement, assertion or match column is flagged too', () => {
        const stmt = mapSupabaseToQuestion({ ...base, q_type: 'statement_based', question: R`Statement I: $\frac{1}{2$ is half.` + '\nStatement II: Two is even.\nChoose the correct answer.' });
        expect(stmt.keyProblem).toBe('PRINT_BROKEN');
    });

    test('a good question stays usable', () => {
        const q = mapSupabaseToQuestion({ ...base, question: R`If $x^2=4$ and $x>0$, find $x$.`, opt_a: R`$\sqrt{2}$`, opt_b: R`$2$` });
        expect(q.keyProblem).toBeNull();
    });
});
