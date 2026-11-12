/**
 * OMR sheet evaluation (pure, no database or file access).
 *
 * Takes what the scanner read from one sheet and the answer key of the series that student sat,
 * and produces the score, the per-question verdicts and a list of reasons a person should look at
 * the sheet. It does not claim the reading is right: the image engine's own confidence is not
 * passed through by scan_cli.py, so the flags here cover only what this layer can know
 * (multiple marks, unreadable series or roll number, duplicate roll numbers).
 */
const { parseAnswerIndices } = require('./pqrsKeys');

const BLANKS = new Set(['', 'BLANK', 'UNATTEMPTED', 'NONE', 'NULL']);

/** Marks per outcome from the request body, or an error message. */
function parseMarks(body = {}, isKcet = false) {
    const read = (value, fallback, label) => {
        if (value === undefined || value === null || value === '') return { value: fallback };
        const n = Number(value);
        if (!Number.isFinite(n) || Math.abs(n) > 100) return { error: `${label} must be a number between -100 and 100.` };
        return { value: n };
    };
    const c = read(body.correctMarks, isKcet ? 1 : 4, 'Marks for a correct answer');
    if (c.error) return { error: c.error };
    const w = read(body.wrongMarks, isKcet ? 0 : -1, 'Marks for a wrong answer');
    if (w.error) return { error: w.error };
    const b = read(body.blankMarks, 0, 'Marks for an unattempted question');
    if (b.error) return { error: b.error };
    return { correctM: c.value, wrongM: w.value, blankM: b.value };
}

/**
 * @param {Object} args
 * @param {Array<{number:number,id:string,subject:string,concept:string,correctIndices:number[],correctAnswer:string}>} args.key
 * @param {Object<string,string>} args.detectedAnswers  question number -> "A".."D", "1".."4", "BLANK", "MULTIPLE"
 * @param {{correctM:number,wrongM:number,blankM:number}} args.marks
 * @param {Object} args.flags  rollInferred, duplicateRollInBatch, seriesKnown, rawSeries, gradedSeries
 */
function evaluateSheet({ key, detectedAnswers = {}, marks, flags = {} }) {
    const { correctM, wrongM, blankM } = marks;
    let totalScore = 0, correctCount = 0, wrongCount = 0, blankCount = 0, multipleCount = 0;
    const subjectStats = {};
    const conceptStats = {};
    const questionEvaluations = [];

    for (const q of key) {
        const raw = detectedAnswers[String(q.number)];
        const detected = String(raw === null || raw === undefined ? 'BLANK' : raw).trim().toUpperCase();

        let status;
        let earned;
        let review = null;

        if (BLANKS.has(detected)) {
            status = 'not_attempted';
            earned = blankM;
            blankCount++;
        } else if (detected === 'MULTIPLE') {
            // More than one bubble is filled. Scored as a wrong answer (existing rule) but surfaced for checking.
            status = 'wrong';
            earned = wrongM;
            wrongCount++;
            multipleCount++;
            review = 'multiple_marks';
        } else {
            const studentIdx = parseAnswerIndices(detected);
            const correctIdx = q.correctIndices || [];
            const match = studentIdx.length > 0 && correctIdx.length > 0 && studentIdx.some(i => correctIdx.includes(i));
            const sameText = detected.replace(/[\s,]/g, '') === String(q.correctAnswer || '').toUpperCase().replace(/[\s,]/g, '');
            if (match || sameText) {
                status = 'correct';
                earned = correctM;
                correctCount++;
            } else {
                status = 'wrong';
                earned = wrongM;
                wrongCount++;
                if (studentIdx.length === 0) review = 'unrecognised_mark';
            }
        }

        totalScore += earned;

        const subj = q.subject || 'General';
        if (!subjectStats[subj]) subjectStats[subj] = { correct: 0, wrong: 0, notAttempted: 0, total: 0, score: 0 };
        subjectStats[subj].total++;
        subjectStats[subj].score += earned;
        if (status === 'correct') subjectStats[subj].correct++;
        else if (status === 'wrong') subjectStats[subj].wrong++;
        else subjectStats[subj].notAttempted++;

        const conc = q.concept || 'General';
        if (!conceptStats[conc]) conceptStats[conc] = { concept: conc, subject: subj, correct: 0, wrong: 0, notAttempted: 0, total: 0 };
        conceptStats[conc].total++;
        if (status === 'correct') conceptStats[conc].correct++;
        else if (status === 'wrong') conceptStats[conc].wrong++;
        else conceptStats[conc].notAttempted++;

        questionEvaluations.push({
            questionNumber: q.number,
            questionId: q.id,
            subject: subj,
            concept: conc,
            detectedAnswer: detected,
            correctAnswer: q.correctAnswer,
            status,
            marks: earned,
            ...(review ? { review } : {})
        });
    }

    const reviewReasons = [];
    if (flags.rollInferred) reviewReasons.push('Roll number could not be read from the sheet; a number from the file name (or a placeholder) was used. Confirm the student.');
    if (flags.duplicateRollInBatch) reviewReasons.push('Another sheet in this batch has the same roll number.');
    if (flags.seriesKnown === false) {
        reviewReasons.push(flags.rawSeries
            ? `Series "${flags.rawSeries}" is not one of P/Q/R/S; the sheet was graded against series ${flags.gradedSeries}. Confirm the series.`
            : `The series could not be read; the sheet was graded against series ${flags.gradedSeries}. Confirm the series.`);
    }
    if (multipleCount > 0) reviewReasons.push(`${multipleCount} question(s) have more than one bubble filled and were scored as wrong. Check the sheet.`);
    const unrecognised = questionEvaluations.filter(e => e.review === 'unrecognised_mark').length;
    if (unrecognised > 0) reviewReasons.push(`${unrecognised} answer(s) could not be interpreted and were scored as wrong.`);
    if (key.length > 0 && blankCount === key.length) reviewReasons.push('Every question was read as blank. The sheet may be unreadable or empty.');

    return {
        totalScore, correctCount, wrongCount, blankCount, multipleCount,
        subjectStats, conceptStats, questionEvaluations, reviewReasons
    };
}

module.exports = { parseMarks, evaluateSheet };
