/**
 * pqrsGenerator.js
 * 
 * Generates 4 distinct paper sets (P, Q, R, S) from a single pool of questions:
 * - P Set: Normal original question and option order.
 * - Q Set: Shuffled questions, original option order.
 * - R Set: Shuffled questions, shuffled options with recalculated answer keys.
 * - S Set: Maximum shuffle (shuffled questions, shuffled options) with recalculated answer keys.
 */

import { getResolvedAnswerLabel } from './sanitize.js';

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
    if (answer === null || answer === undefined || answer === '') return -1;
    const ansStr = String(answer).trim().toUpperCase();

    // Check letter 'A', 'B', 'C', 'D'
    if (/^[A-D]$/.test(ansStr)) {
        return ansStr.charCodeAt(0) - 65;
    }
    // Check 1-based number '1', '2', '3', '4'
    if (/^[1-4]$/.test(ansStr)) {
        return parseInt(ansStr, 10) - 1;
    }
    // Check option match by string content
    const matchIdx = options.findIndex(opt => {
        if (!opt) return false;
        const cleanOpt = String(opt).trim().toLowerCase();
        const cleanAns = String(answer).trim().toLowerCase();
        return cleanOpt === cleanAns || cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt);
    });
    return matchIdx;
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
            originalAnswer: question.answer,
            answer: question.answer,
        };
    }

    const origAnsIdx = getAnswerIndex(question.answer, originalOptions);
    const origAnsContent = origAnsIdx >= 0 ? originalOptions[origAnsIdx] : null;

    // Create array of indexed options to track original positions
    const indexed = originalOptions.map((opt, i) => ({ opt, origIdx: i }));
    const shuffledIndexed = shuffleArray(indexed, randomFn);

    const newOptions = shuffledIndexed
        .filter(item => item && item.opt !== undefined)
        .map(item => item.opt);
    let newAnsLetter = question.answer;

    if (origAnsIdx >= 0) {
        const newAnsIdx = shuffledIndexed.findIndex(item => item.origIdx === origAnsIdx);
        if (newAnsIdx >= 0) {
            newAnsLetter = getOptionLetter(newAnsIdx);
        }
    }

    return {
        ...question,
        options: newOptions,
        originalAnswer: question.answer,
        originalAnswerContent: origAnsContent,
        answer: newAnsLetter,
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
    const seed = `${paperId}-${setName}`;
    const random = createSeededRandom(seed);

    let processedQuestions = [];

    switch (setName.toUpperCase()) {
        case 'P':
            // P Set: Normal original question and option order
            processedQuestions = baseQuestions.map((q, idx) => ({
                ...q,
                setQNo: idx + 1,
                originalQNo: idx + 1,
            }));
            break;

        case 'Q':
            // Q Set: Shuffle questions only, keep options original
            {
                const indexed = baseQuestions.map((q, idx) => ({ ...q, originalQNo: idx + 1 }));
                const shuffled = shuffleArray(indexed, random);
                processedQuestions = shuffled.map((q, idx) => ({
                    ...q,
                    setQNo: idx + 1,
                }));
            }
            break;

        case 'R':
            // R Set: Shuffle questions AND shuffle options inside each question (recalculate answers)
            {
                const indexed = baseQuestions.map((q, idx) => ({ ...q, originalQNo: idx + 1 }));
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
            // S Set: Maximum shuffle (second pass random seed)
            {
                const sRandom = createSeededRandom(`${seed}-max-shuffle`);
                const indexed = baseQuestions.map((q, idx) => ({ ...q, originalQNo: idx + 1 }));
                const shuffledQs = shuffleArray(indexed, sRandom);
                processedQuestions = shuffledQs.map((q, idx) => {
                    const qWithShuffledOpts = shuffleQuestionOptions(q, sRandom);
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
        setName: setName.toUpperCase(),
        title: `${paper.title || 'Question Paper'} - SET ${setName.toUpperCase()}`,
        questions: processedQuestions,
        answerKey: generateAnswerKey(processedQuestions, setName.toUpperCase()),
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
