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
function shuffleQuestionOptions(question, randomFn) {
    const originalOptions = Array.isArray(question.options) ? question.options : [];
    if (originalOptions.length <= 1) {
        return {
            ...question,
            options: originalOptions,
            originalAnswer: question.answer ?? question.correct_option ?? question.correctAnswer,
            answer: question.answer ?? question.correct_option ?? question.correctAnswer,
        };
    }

    const rawAns = question.answer ?? question.correct_option ?? question.correctAnswer;
    const origAnsIndices = parseAnswerIndices(rawAns, originalOptions);
    const origAnsContent = origAnsIndices.length > 0 ? originalOptions[origAnsIndices[0]] : null;

    // Create array of indexed options to track original positions
    const indexed = originalOptions.map((opt, i) => ({ opt, origIdx: i }));
    const shuffledIndexed = shuffleArray(indexed, randomFn);

    const newOptions = shuffledIndexed
        .filter(item => item && item.opt !== undefined)
        .map(item => item.opt);

    // Map the old indices to their new positions in shuffledIndexed
    const newAnsIndices = origAnsIndices
        .map(oldIdx => shuffledIndexed.findIndex(item => item.origIdx === oldIdx))
        .filter(idx => idx >= 0)
        .sort((a, b) => a - b);

    // Get current option labels for this question (e.g. ['A', 'B', 'C', 'D'] or ['1', '2', '3', '4'])
    const labels = getQuestionOptionLabels(question);
    let newAnsLetter = rawAns;

    if (newAnsIndices.length > 0) {
        const mappedLabels = newAnsIndices.map(idx => labels[idx] || getOptionLetter(idx));
        newAnsLetter = mappedLabels.join(', ');
    }

    return {
        ...question,
        options: newOptions,
        originalAnswer: rawAns,
        originalAnswerContent: origAnsContent,
        answer: newAnsLetter,
        correctAnswer: newAnsLetter,
        correct_option: newAnsIndices.length === 1 ? String(newAnsIndices[0] + 1) : newAnsIndices.map(i => i + 1).join(','),
        optionsShuffled: true,
    };
}

/**
 * Generate a specific set ('P', 'Q', 'R', 'S') from a base paper
 */
export function generatePaperSet(paper, setName = 'P') {
    if (!paper) return null;
    const baseQuestions = Array.isArray(paper.questions) ? paper.questions : [];
    const paperId = paper._id || paper.id || 'qp-default';
    const cleanSet = String(setName || 'P').toUpperCase();
    const seed = `${paperId}-${cleanSet}`;
    const random = createSeededRandom(seed);

    let processedQuestions = [];

    switch (cleanSet) {
        case 'P':
            // P Set: Normal original question and option order
            processedQuestions = baseQuestions.map((q, idx) => ({
                ...q,
                setQNo: idx + 1,
                originalQNo: q.originalQNo || (idx + 1),
            }));
            break;

        case 'Q':
            // Q Set: Deterministic question permutation (seed Q), original options
            {
                const indexed = baseQuestions.map((q, idx) => ({
                    ...q,
                    originalQNo: q.originalQNo || (idx + 1)
                }));
                const shuffled = shuffleArray(indexed, random);
                processedQuestions = shuffled.map((q, idx) => ({
                    ...q,
                    setQNo: idx + 1,
                }));
            }
            break;

        case 'R':
            // R Set: Deterministic question permutation (seed R) + option shuffling with recalculated answers
            {
                const indexed = baseQuestions.map((q, idx) => ({
                    ...q,
                    originalQNo: q.originalQNo || (idx + 1)
                }));
                const shuffledQs = shuffleArray(indexed, random);
                processedQuestions = shuffledQs.map((q, idx) => {
                    const qWithShuffledOpts = shuffleQuestionOptions(q, random);
                    return {
                        ...qWithShuffledOpts,
                        setQNo: idx + 1,
                    };
                });
            }
            break;

        case 'S':
        default:
            // S Set: Maximum shuffle: distinct question permutation (seed S) + distinct option permutation (answers recalculated)
            {
                const indexed = baseQuestions.map((q, idx) => ({
                    ...q,
                    originalQNo: q.originalQNo || (idx + 1)
                }));
                const shuffledQs = shuffleArray(indexed, random);
                processedQuestions = shuffledQs.map((q, idx) => {
                    const qWithShuffledOpts = shuffleQuestionOptions(q, random);
                    return {
                        ...qWithShuffledOpts,
                        setQNo: idx + 1,
                    };
                });
            }
            break;
    }

    return {
        ...paper,
        setName: cleanSet,
        title: `${paper.title || 'Question Paper'} - SET ${cleanSet}`,
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
export function generateAllPQRS(paper) {
    if (!paper) return {};
    return {
        P: generatePaperSet(paper, 'P'),
        Q: generatePaperSet(paper, 'Q'),
        R: generatePaperSet(paper, 'R'),
        S: generatePaperSet(paper, 'S'),
    };
}
