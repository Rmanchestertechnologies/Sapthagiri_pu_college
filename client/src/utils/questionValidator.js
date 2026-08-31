/**
 * questionValidator.js
 * 
 * Validates questions prior to paper finalization:
 * - Checks for question text presence
 * - Checks for minimum 4 options in MCQs / single-choice questions
 * - Detects duplicate options
 * - Validates diagram presence if question references diagram / image
 * - Checks mathematical notation delimiters
 */

export function validateQuestion(q, index) {
    const issues = [];
    const qNum = index + 1;
    const text = q.questionText || q.question || '';
    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();

    // 1. Question text validation
    if (!text || text.trim().length === 0) {
        issues.push({
            qNum,
            type: 'error',
            field: 'questionText',
            message: `Question #${qNum} is missing question text.`,
        });
    }

    // 2. Options validation for MCQ / Multiple choice types
    if (qType.includes('MCQ') || qType === '1M' || qType === 'SINGLE_CHOICE') {
        const options = Array.isArray(q.options) ? q.options : [];
        if (options.length < 2) {
            issues.push({
                qNum,
                type: 'error',
                field: 'options',
                message: `Question #${qNum} requires at least 4 options (found ${options.length}).`,
            });
        } else {
            // Check for empty options
            options.forEach((opt, oIdx) => {
                if (!opt || String(opt).trim() === '') {
                    issues.push({
                        qNum,
                        type: 'warning',
                        field: `option_${oIdx}`,
                        message: `Question #${qNum} option (${String.fromCharCode(65 + oIdx)}) is empty.`,
                    });
                }
            });

            // Check for duplicate options
            const cleanOpts = options.map(o => String(o || '').trim().toLowerCase()).filter(Boolean);
            const uniqueOpts = new Set(cleanOpts);
            if (uniqueOpts.size < cleanOpts.length) {
                issues.push({
                    qNum,
                    type: 'warning',
                    field: 'duplicate_options',
                    message: `Question #${qNum} contains duplicate options.`,
                });
            }
        }
    }

    // 3. Diagram reference check
    const referencesDiagram = /(?:diagram|figure|graph|shown below|in the circuit|given figure|following structure)/i.test(text);
    if (referencesDiagram && !q.imageUrl && !q.image_url) {
        issues.push({
            qNum,
            type: 'warning',
            field: 'missing_diagram',
            message: `Question #${qNum} refers to a figure/diagram but has no image attached.`,
        });
    }

    // 4. LaTeX / Math delimiters validation (unclosed $ or $$)
    const dollarMatches = (text.match(/(?<!\\)\$/g) || []).length;
    if (dollarMatches % 2 !== 0) {
        issues.push({
            qNum,
            type: 'warning',
            field: 'math_syntax',
            message: `Question #${qNum} has unclosed LaTeX math delimiter ($).`,
        });
    }

    return issues;
}

export function validatePaperQuestions(questions = []) {
    const allIssues = [];
    questions.forEach((q, idx) => {
        const qIssues = validateQuestion(q, idx);
        if (qIssues.length > 0) {
            allIssues.push(...qIssues);
        }
    });

    const errors = allIssues.filter(i => i.type === 'error');
    const warnings = allIssues.filter(i => i.type === 'warning');

    return {
        isValid: errors.length === 0,
        issues: allIssues,
        errors,
        warnings,
        errorCount: errors.length,
        warningCount: warnings.length,
    };
}
