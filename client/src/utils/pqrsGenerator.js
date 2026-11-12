/**
 * pqrsGenerator.js
 * 
 * Generates 4 distinct paper sets (P, Q, R, S) from a single pool of questions:
 * - P Set: Normal original question and option order.
 * - Q Set: Shuffled questions, original option order.
 * - R Set: Shuffled questions, shuffled options with recalculated answer keys.
 * - S Set: Maximum shuffle (shuffled questions, shuffled options) with recalculated answer keys.
 */

import { getResolvedAnswerLabel, getQuestionOptionLabels, parseAnswerIndices } from './sanitize.js';

// Seeded pseudo-random number generator for deterministic shuffling per paper ID + set name
function createSeededRandom(seedStr) {
    let hash = 0;
    const str = String(seedStr || 'default-seed');
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return function () {
        // Absolute value prevents negative remainder in JS % operator
        hash = Math.abs((hash * 9301 + 49297) % 233280);
        return hash / 233280;
    };
}

function shuffleArray(arr, randomFn) {
    if (!Array.isArray(arr) || arr.length <= 1) return [...(arr || [])];
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const rnd = Math.abs(randomFn());
        const j = Math.floor(rnd * (i + 1));
        if (j >= 0 && j < copy.length) {
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
    }
    return copy;
}

/**
 * Standard option letter index helper: 0 -> A, 1 -> B, 2 -> C, 3 -> D
 */
export function getOptionLetter(index) {
    return String.fromCharCode(65 + index);
}

/**
 * Convert answer representation ('A', 'B', 1, 2, or raw option text) to original option index 0-3
 */
export function getAnswerIndex(answer, options = []) {
    const indices = parseAnswerIndices(answer, options);
    return indices.length > 0 ? indices[0] : -1;
}

/**
 * Shuffle options of a single question and compute the new correct answer letter
 */
// Options whose wording refers to other options by position ("Both 1 and 2", "All of the above",
// "None of these") stop making sense once the options move, so such questions keep their order.
const optionText = (opt) => (typeof opt === 'object' && opt ? (opt.text || opt.optionText || opt.value || '') : String(opt ?? ''));
const POSITIONAL_OPTION_RE = /\b(all|none|both|either|neither)\b[^.]{0,40}\b(above|these|those|the\s+following|[A-Da-d1-4]\s*(?:\)|and|&|or|,))|\b(?:\(?[A-Da-d1-4]\)?)\s*(?:and|&)\s*(?:\(?[A-Da-d1-4]\)?)\s*(?:only|both|are|is)?\s*$/i;
export function hasPositionalOptions(options = []) {
    return options.some(o => POSITIONAL_OPTION_RE.test(optionText(o).replace(/<[^>]+>/g, ' ').trim()));
}

function shuffleQuestionOptions(question, randomFn) {
    const originalOptions = Array.isArray(question.options) ? question.options : [];
    // Same precedence as getResolvedAnswerLabel, so the key printed for a set is derived
    // from the same field the option shuffle used.
    const rawAns = question.correct_option ?? question.answer ?? question.correctAnswer;
    const origAnsIndices = parseAnswerIndices(rawAns, originalOptions);

    // Leave options untouched when shuffling could silently change the correct answer:
    //  - fewer than two options (numerical / subjective),
    //  - the stored answer cannot be resolved to an option position,
    //  - options reference each other by position.
    if (originalOptions.length <= 1 || origAnsIndices.length === 0 || hasPositionalOptions(originalOptions)) {
        return { ...question, options: originalOptions, optionsShuffled: false };
    }
    const origAnsContent = originalOptions[origAnsIndices[0]];

    // Create array of indexed options to track original positions
    const indexed = originalOptions.map((opt, i) => ({ opt, origIdx: i }));
    const shuffledIndexed = shuffleArray(indexed, randomFn);

    // Options that carry their own label ({ label: '1', text }) are relabelled by new position,
    // otherwise the paper would print labels in scrambled order.
    const positionalLabels = originalOptions.map(o => (typeof o === 'object' && o && o.label !== undefined ? o.label : undefined));
    const newOptions = shuffledIndexed
        .filter(item => item && item.opt !== undefined)
        .map((item, pos) => (typeof item.opt === 'object' && item.opt && positionalLabels[pos] !== undefined
            ? { ...item.opt, label: positionalLabels[pos] }
            : item.opt));

    // Map the old indices to their new positions in shuffledIndexed
    const newAnsIndices = origAnsIndices
        .map(oldIdx => shuffledIndexed.findIndex(item => item.origIdx === oldIdx))
        .filter(idx => idx >= 0)
        .sort((a, b) => a - b);

    // Get current option labels for this question (e.g. ['A', 'B', 'C', 'D'] or ['1', '2', '3', '4'])
    const labels = getQuestionOptionLabels({ ...question, options: newOptions });
    let newAnsLetter = rawAns;

    if (newAnsIndices.length > 0) {
        const mappedLabels = newAnsIndices.map(idx => labels[idx] || getOptionLetter(idx));
        newAnsLetter = mappedLabels.join(', ');
    }

    return {
        ...question,
        options: newOptions,
        // Everything needed to undo this shuffle (see restoreBaseQuestions)
        pqrsBase: {
            options: originalOptions,
            answer: question.answer,
            correctAnswer: question.correctAnswer,
            correct_option: question.correct_option,
        },
        originalAnswer: rawAns,
        originalAnswerContent: origAnsContent,
        answer: newAnsLetter,
        correctAnswer: newAnsLetter,
        correct_option: newAnsIndices.length === 1 ? String(newAnsIndices[0] + 1) : newAnsIndices.map(i => i + 1).join(','),
        optionsShuffled: true,
    };
}

/**
 * Helper to group questions by section/subject and apply permutation within each section
 */
function applySectionAwareTransform(baseQuestions, transformFn, startQNo = 1) {
    if (!Array.isArray(baseQuestions) || baseQuestions.length === 0) return [];
    const offset = Number(startQNo) || 1;

    // Identify sections / subjects in order
    const sectionMap = new Map();
    baseQuestions.forEach((q, idx) => {
        const key = q.part ? `${q.sectionSubject || q.subject || ''}-${q.part}` : (q.sectionName || q.subject || 'Default');
        if (!sectionMap.has(key)) {
            sectionMap.set(key, []);
        }
        sectionMap.get(key).push({
            ...q,
            originalQNo: offset + idx
        });
    });

    // If only 1 section, just transform all
    if (sectionMap.size <= 1) {
        const transformed = transformFn(baseQuestions.map((q, idx) => ({
            ...q,
            originalQNo: offset + idx
        })));
        return transformed.map((q, idx) => ({
            ...q,
            setQNo: offset + idx
        }));
    }

    // Multiple sections: transform within each section and maintain section order
    let runningIdx = offset;
    const finalQuestions = [];

    for (const [secKey, secQuestions] of sectionMap.entries()) {
        const transformedSec = transformFn(secQuestions);
        transformedSec.forEach(q => {
            finalQuestions.push({
                ...q,
                sectionName: q.sectionName || secKey,
                setQNo: runningIdx++
            });
        });
    }

    return finalQuestions;
}

/**
 * Undo a previous generatePaperSet: restore master question order and original options/answers.
 * Only meaningful for questions produced by generatePaperSet (paper.pqrsApplied === true).
 */
export function restoreBaseQuestions(questions = []) {
    return [...questions]
        .map((q, idx) => ({ q, idx }))
        .sort((a, b) => ((a.q.originalQNo ?? a.idx) - (b.q.originalQNo ?? b.idx)) || (a.idx - b.idx))
        .map(({ q }) => {
            const { pqrsBase, setQNo, originalQNo, optionsShuffled, originalAnswer, originalAnswerContent, ...rest } = q;
            if (!pqrsBase) return rest;
            const restored = { ...rest, options: pqrsBase.options };
            ['answer', 'correctAnswer', 'correct_option'].forEach(k => {
                if (pqrsBase[k] === undefined) delete restored[k];
                else restored[k] = pqrsBase[k];
            });
            return restored;
        });
}

/**
 * Generate a specific set ('P', 'Q', 'R', 'S') from a base paper.
 *
 * Safe to call on a paper that is already a generated set: the master order is restored
 * first, so the result always equals generatePaperSet(masterPaper, setName). Previously a
 * second call re-shuffled the shuffled paper, so the preview, the Word export and the
 * answer key could each show a different order for the same set.
 */
export function generatePaperSet(paper, setName = 'P', startQNo = 1) {
    if (!paper) return null;
    const rawQuestions = Array.isArray(paper.questions) ? paper.questions : [];
    const baseQuestions = paper.pqrsApplied ? restoreBaseQuestions(rawQuestions) : rawQuestions;
    // A paper made after this change carries its own pqrsSeed (created with the paper and saved in metadata), so its
    // P/Q/R/S sets are identical in the wizard preview, after saving, on the saved-papers screen and in OMR grading.
    // Older papers have no seed and keep using their id, so sets that were already printed do not change.
    const paperId = paper.pqrsSeed || paper.metadata?.pqrsSeed || paper._id || paper.id || 'qp-default';
    const cleanSet = String(setName || 'P').toUpperCase();
    const seed = `${paperId}-${cleanSet}`;
    const random = createSeededRandom(seed);
    const offset = Number(startQNo || paper.startQNo || 1);

    let processedQuestions = [];

    switch (cleanSet) {
        case 'P':
            // P Set: Normal original question and option order
            processedQuestions = applySectionAwareTransform(baseQuestions, (qs) => qs, offset);
            break;

        case 'Q':
            // Q Set: Deterministic question permutation (seed Q) within each section, original options
            processedQuestions = applySectionAwareTransform(baseQuestions, (qs) => {
                return shuffleArray(qs, random);
            }, offset);
            break;

        case 'R':
            // R Set: Question permutation (seed R) within section + option shuffling with recalculated answers
            processedQuestions = applySectionAwareTransform(baseQuestions, (qs) => {
                const shuffledQs = shuffleArray(qs, random);
                return shuffledQs.map(q => shuffleQuestionOptions(q, random));
            }, offset);
            break;

        case 'S':
        default:
            // S Set: Maximum shuffle: distinct question permutation (seed S) within section + distinct option permutation (answers recalculated)
            processedQuestions = applySectionAwareTransform(baseQuestions, (qs) => {
                const shuffledQs = shuffleArray(qs, random);
                return shuffledQs.map(q => shuffleQuestionOptions(q, random));
            }, offset);
            break;
    }

    const baseTitle = paper.pqrsApplied && paper.pqrsBaseTitle !== undefined ? paper.pqrsBaseTitle : paper.title;

    return {
        ...paper,
        setName: cleanSet,
        pqrsApplied: true,
        pqrsBaseTitle: baseTitle,
        title: `${baseTitle || 'Question Paper'} - SET ${cleanSet}`,
        questions: processedQuestions,
        answerKey: generateAnswerKey(processedQuestions, cleanSet),
    };
}

/**
 * Generate Answer Key for a question list
 */
export function generateAnswerKey(questions = [], setName = 'P') {
    return questions.map((q, idx) => {
        const qNum = q.setQNo || (idx + 1);
        const ans = getResolvedAnswerLabel(q);
        return {
            qNo: qNum,
            originalQNo: q.originalQNo || qNum,
            answer: ans,
            type: q.type || 'MCQ',
            subject: q.subject || '',
            chapter: q.chapter || '',
            solutionText: q.solutionText || q.solution || '',
        };
    });
}

/**
 * Generate all 4 sets (P, Q, R, S) simultaneously
 */
export function generateAllPQRS(paper, startQNo = 1) {
    if (!paper) return {};
    return {
        P: generatePaperSet(paper, 'P', startQNo),
        Q: generatePaperSet(paper, 'Q', startQNo),
        R: generatePaperSet(paper, 'R', startQNo),
        S: generatePaperSet(paper, 'S', startQNo),
    };
}
