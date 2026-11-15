import test from 'node:test';
import assert from 'node:assert/strict';
import { findQuestionProblems, textProblem } from '../src/utils/questionProblems.js';

const R = String.raw;

test('a good question has no problems', () => {
    const q = { type: 'MCQ', questionText: R`If $x^2=4$ then $x$ is`, options: ['1', R`$\sqrt{2}$`, '2', R`$\frac12$`], solutionText: R`Since $$x^2=4$$ we get $x=2$.` };
    assert.deepEqual(findQuestionProblems(q), []);
});

test('cut-off maths and an unpaired $ are found, with the part that is wrong', () => {
    const q = { type: 'MCQ', questionText: 'Find the limit', options: [R`$\frac{1}{2$`, '2', '3', '4'], solutionText: R`Replace $x by something. $$y=1$$` };
    const parts = findQuestionProblems(q).map(p => p.part);
    assert.ok(parts.includes('option 1'));
});

test('a problem the server flagged is reported in plain words', () => {
    const [p] = findQuestionProblems({ type: 'MCQ', questionText: 'Q', options: ['1', '1', '3', '4'], keyProblem: 'DUPLICATE_OPTIONS' });
    assert.match(p.problem, /read exactly the same/);
});

test('textProblem is empty for fine text and for empty values', () => {
    assert.equal(textProblem(''), '');
    assert.equal(textProblem(null), '');
    assert.equal(textProblem('Which of these is a prime number?'), '');
    assert.equal(textProblem(R`$C_2H_4 \xrightarrow{B_2H_6} A$`), '');
});
