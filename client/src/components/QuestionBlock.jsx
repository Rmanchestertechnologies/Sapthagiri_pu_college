/**
 * QuestionBlock.jsx
 *
 * Professional question block renderer adhering to standard A4 assessment typography:
 * - Bold question text ONLY.
 * - Options are normal font-weight (never bold unless explicitly part of LaTeX/text).
 * - Intelligent Diagram Placement:
 *     1. Side-by-Side (Left: Question + Options, Right: Diagram) when appropriate
 *     2. Inline (between statement and options)
 *     3. Full-width (for wide graphs / circuits)
 * - Interactive Diagram Resizing via ResizableDiagram (+ / - controls right on the diagram)
 * - Zero overlap, no clipping, proper line spacing, KaTeX math/chem preservation.
 */
import React from 'react';
import MathRenderer from './MathRenderer';
import ResizableDiagram from './ResizableDiagram';
import { optionLabel, getQuestionOptionLabels } from '../utils/sanitize';

/**
 * Dynamic option grid calculator based on length and complexity:
 * - Complex formulas / long equations (e.g. Q33 vector equations): 1 column (vertical stack)
 * - 2-Column paper mode:
 *     - Short scalars / tiny choices (<= 4 chars, no math): 4 columns across
 *     - Medium (<= 18 chars, e.g. "50 minutes", short math): 2x2 grid (1fr 1fr)
 *     - Long or complex formulas: 1 column (vertical stack)
 * - 1-Column paper mode:
 *     - Short scalars (<= 10 chars, no complex math): 4 columns across
 *     - Medium (<= 32 chars): 2x2 grid
 *     - Long or complex formulas: 1 column (vertical stack)
 */
function getDynamicOptGrid(options = [], isTwoColMode = false) {
    if (!options || options.length === 0) return { display: 'none' };

    let hasComplexFormula = false;
    let hasAnyMath = false;

    const parsedOptions = options.map((opt) => {
        if (!opt) return { text: '', len: 0, hasMath: false, isComplex: false, hasImage: false };
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : opt).trim();
        const hasImage = /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
        const clean = str.replace(/<[^>]+>/g, '').trim();

        // Detect math / LaTeX commands / symbols
        const mathMatch = /(\$|\\\(|\\\[|\\|\^|_)/i.test(clean);
        if (mathMatch) hasAnyMath = true;

        // Complex formula detection:
        // - Fractions (\frac, \dfrac)
        // - Vectors or hats (\vec, \hat)
        // - Integrals, square roots, matrices, summations (\sqrt, \int, \sum, \matrix, \begin)
        // - Long formulas with mathematical operators (+, -, =)
        const complexMatch =
            /(\\frac|\\dfrac|\\vec|\\hat|\\sqrt|\\int|\\sum|\\prod|\\matrix|\\begin|\\rightarrow|\|)/i.test(clean) ||
            (mathMatch && (clean.length > 14 || /(=|\+.*\-|\-.*\+|\^\{?\d+\}?.*_)/.test(clean)));

        if (complexMatch) {
            hasComplexFormula = true;
        }

        return {
            text: str,
            len: clean.length,
            hasMath: mathMatch,
            isComplex: complexMatch,
            hasImage,
        };
    });

    // ── HORIZONTAL GRID FOR OPTIONS WITH DIAGRAMS (Q40, Q52) ──
    const hasAnyOptionImage = parsedOptions.some((o) => o.hasImage);
    if (hasAnyOptionImage) {
        if (isTwoColMode) {
            // In 2-column mode: 2x2 grid
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '3px 6px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }
        // In 1-column mode: All 4 options laid out horizontally side-by-side!
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(4, options.length)}, minmax(0, 1fr))`,
            gap: '3px 10px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    const maxLen = Math.max(...parsedOptions.map((o) => o.len), 0);

    // ── TWO-COLUMN PAPER MODE (each column is ~350px wide) ──
    if (isTwoColMode) {
        if (hasComplexFormula) {
            return {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: '2px 6px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Short scalar choices (e.g. 0, 1, 2, 3 or A, B, C, D)
        if (maxLen <= 5 && !hasAnyMath && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Medium options (e.g. up to 22 chars): 2x2 grid
        if (maxLen <= 22 && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Long text or formulas: 1 column vertical stack
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '2px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    // ── SINGLE-COLUMN PAPER MODE (full A4 width ~730px) ──
    if (hasComplexFormula && maxLen > 28) {
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '3px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 16 && !hasComplexFormula && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
            gap: '2px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 36 && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '3px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    return {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '3px 6px',
        marginTop: '3px',
        alignItems: 'start',
    };
}

const Q = {
    wrap: {
        display: 'inline-block',
        width: '100%',
        breakInside: 'avoid',
        WebkitColumnBreakInside: 'avoid',
        pageBreakInside: 'avoid',
        marginBottom: '0px',
        color: '#111',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        fontStyle: 'normal',
        lineHeight: '1.42',
        boxSizing: 'border-box',
        verticalAlign: 'top',
    },
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '6px',
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    num: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '24px',
        fontSize: '1em',
        lineHeight: '1.42',
        color: '#000',
    },
    body: {
        flex: 1,
        minWidth: 0,
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    qTextBold: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#000',
        display: 'inline',
        lineHeight: '1.42',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    marks: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        fontSize: '1em',
        alignSelf: 'flex-start',
        marginLeft: '6px',
        color: '#444',
    },
    optRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        minWidth: 0,
        maxWidth: '100%',
        fontSize: '1em',
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#111',
    },
    optLbl: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '22px',
        flexShrink: 0,
        lineHeight: '1.42',
        color: '#222',
        fontSize: '1em',
    },
    sideBySideContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '3px',
    },
    sideLeftContent: {
        flex: '1 1 58%',
        minWidth: 0,
    },
    sideRightDiagram: {
        flex: '0 0 40%',
        maxWidth: '270px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2px',
    },
    matchTable: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '2px 0 4px',
        fontSize: '0.92em',
        tableLayout: 'fixed',
        fontWeight: 400,
    },
    matchTh: {
        border: '1px solid #aaa',
        padding: '2px 4px',
        background: '#f8fafc',
        fontWeight: 600,
        textAlign: 'left',
        width: '50%',
        color: '#111',
        fontSize: '0.92em',
    },
    matchTd: {
        border: '1px solid #aaa',
        padding: '2px 4px',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        width: '50%',
        fontWeight: 400,
        color: '#111',
        fontSize: '0.92em',
    },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '3px',
        alignItems: 'baseline',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: '1em',
        fontWeight: 400,
        lineHeight: '1.46',
    },
    assertLabel: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: '#000',
        fontSize: '1em',
        minWidth: '105px',
        flexShrink: 0,
        lineHeight: '1.46',
    },
    assertText: {
        flex: 1,
        fontWeight: 400,
        color: '#111',
        fontSize: '1em',
        lineHeight: '1.46',
    },
};

/**
 * Intelligent Layout Decision:
 * Decides whether diagram should be rendered side-by-side on the right, or inline/full-width
 */
function shouldRenderSideBySide(q, isTwoCol = false, resolvedImageUrl = null) {
    const img = resolvedImageUrl || q.imageUrl || q.image_url;
    if (!img) return false;
    // In 2-column paper mode, column width is narrower, so inline/balanced is cleaner
    if (isTwoCol) return false;

    // Check options: if 2 to 4 options and options don't have images themselves
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length >= 2 && options.length <= 4) {
        const hasOptImg = options.some(opt => {
            const str = String(typeof opt === 'object' ? (opt.text || opt.option || '') : (opt || ''));
            return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
        });
        if (hasOptImg) return false; // Options with diagrams use horizontal grid

        const totalOptLength = options.reduce((sum, opt) => sum + String(typeof opt === 'object' ? (opt.text || opt.option || '') : (opt || '')).length, 0);
        return totalOptLength < 280; // Side-by-side works cleanly when options fit neatly on the left
    }
    return false;
}

/** Standard 4 assertion-reason options (NEET/CET format) */
const AR_OPTIONS = [
    'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
    'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
    'Assertion is correct but Reason is incorrect.',
    'Assertion is incorrect but Reason is correct.',
];

function cleanStatementText(str) {
    if (!str) return '';
    return String(str)
        .replace(/^[:\-]\s*/, '')
        .replace(/```/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/** Parse assertion/reason from question text */
function parseAssertionReason(q) {
    if (q.assertion) {
        return {
            assertion: cleanStatementText(q.assertion),
            reason: cleanStatementText(q.reason || '')
        };
    }
    let txt = q.questionText || q.question || '';

    // 1. Remove markdown code fences e.g. ```
    txt = txt.replace(/```[\s\S]*?```/g, '').replace(/```/g, '');

    // 2. Remove leaked solution explanations
    txt = txt.replace(/(?:Therefore|Hence|Thus),?\s*option\s*[\(\[]?[a-d1-4][\)\]]?\s*is\s*correct[\s\S]*?(?=Reason|$)/gi, '');
    txt = txt.replace(/(?:Therefore|Hence|Thus),?\s*option\s*[\(\[]?[a-d1-4][\)\]]?\s*is\s*correct[\s\S]*/gi, '');

    // 3. Match Assertion (A) and Reason (R)
    const aMatch = txt.match(/Assertion\s*(?:\(A\))?\s*[:\-]?\s*([\s\S]*?)(?=Reason\s*(?:\(R\))?[:\-]|$)/i);
    const rMatch = txt.match(/Reason\s*(?:\(R\))?\s*[:\-]?\s*([\s\S]*)$/i);

    let assertion = aMatch ? aMatch[1].trim() : txt;
    let reason = rMatch ? rMatch[1].trim() : '';

    // 4. Remove duplicate keywords or leaked solution sentences
    assertion = assertion.replace(/^[:\-]\s*/, '').replace(/\s*(?:Assertion|Reason)\s*(?:\([AR]\))?.*$/i, '').trim();
    reason = reason.replace(/^[:\-]\s*/, '').replace(/\s*Assertion\s*(?:\(A\))?.*$/i, '').trim();

    // Specific fix for polluted questions like the one in Image 3:
    assertion = assertion.replace(/\s*The\s*Reason\s*is\s*true[\s\S]*/i, '').trim();
    reason = reason.replace(/\s*The\s*two\s*statements\s*are\s*therefore[\s\S]*/i, '').trim();

    return {
        assertion: cleanStatementText(assertion),
        reason: cleanStatementText(reason)
    };
}

function cleanQuestionText(text) {
    if (!text) return '';
    return String(text).replace(/^(\s*(?:Q\.?\s*)?\d+[\.\)\-:]\s*)+/i, '').trim();
}

/**
 * Extracts any embedded diagrams from raw question text (e.g. {{IMG::url}} or ![...](url)),
 * repairs any split words caused by inline image markers (e.g. "plo {{IMG}} s" -> "plots"),
 * and returns clean text plus the extracted diagram URL.
 */
function extractDiagramFromText(rawText, existingImageUrl) {
    if (!rawText) return { cleanText: '', diagramUrl: existingImageUrl || null };

    let cleanText = String(rawText);
    let extractedUrl = existingImageUrl || null;

    // Pattern 1: {{IMG::url}}
    const imgMatch1 = cleanText.match(/\{\{IMG::(.*?)\}\}/i);
    if (imgMatch1) {
        if (!extractedUrl) extractedUrl = imgMatch1[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*\{\{IMG::.*?\}\}\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/\{\{IMG::.*?\}\}/gi, ' ');
    }

    // Pattern 2: ![alt](url)
    const imgMatch2 = cleanText.match(/!\[(.*?)\]\((.*?)\)/i);
    if (imgMatch2) {
        if (!extractedUrl) extractedUrl = imgMatch2[2].trim();
        cleanText = cleanText.replace(/(\w+)\s*!\[.*?\]\(.*?\)\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/gi, ' ');
    }

    // Pattern 3: <img ... src="..." />
    const imgMatch3 = cleanText.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch3) {
        if (!extractedUrl) extractedUrl = imgMatch3[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*<img[^>]*>\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/<img[^>]*>/gi, ' ');
    }

    // Clean up excessive whitespace
    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();

    return { cleanText, diagramUrl: extractedUrl };
}

/**
 * MCQ Body with Intelligent Diagram Placement & Resizing
 */
function BodyMCQ({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const options = Array.isArray(q.options) ? q.options : [];
    const isSideBySide = shouldRenderSideBySide(q, isTwoCol, imageUrl);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    const hasAnyOptionImage = options.some(opt => {
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : (opt || ''));
        return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
    });

    // Render Options List
    const renderOptions = (forceSingle = false) => {
        if (options.length === 0) return null;
        return (
            <div
                style={
                    forceSingle
                        ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2px 6px', marginTop: '2px' }
                        : getDynamicOptGrid(options, isTwoCol)
                }
            >
                {options.map((opt, i) => {
                    const optText = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
                    const optHeight = q.customDiagramSizes?.[`opt_${i}`] || q.customOptionDiagramHeight || '60px';

                    return (
                        <div
                            key={i}
                            style={{
                                ...Q.optRow,
                                flexDirection: hasAnyOptionImage && !forceSingle ? 'column' : 'row',
                                alignItems: hasAnyOptionImage && !forceSingle ? 'center' : 'flex-start',
                                textAlign: hasAnyOptionImage && !forceSingle ? 'center' : 'left',
                                gap: '2px',
                            }}
                        >
                            <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                <MathRenderer
                                    inline
                                    text={optText}
                                    questionId={qId}
                                    initialHeight={optHeight}
                                    customDiagramSizes={q.customDiagramSizes}
                                    isOption={true}
                                    optionIndex={i}
                                    onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || `opt_${i}`) : undefined}
                                />
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (imageUrl && isSideBySide) {
        // SIDE-BY-SIDE:
        // Top: Question statement (full width)
        // Bottom: Left = Options (stacked vertically), Right = Diagram
        return (
            <>
                {qText && (
                    <div style={{ ...Q.qTextBold, marginBottom: '3px' }}>
                        <MathRenderer
                            inline
                            text={qText}
                            questionId={qId}
                            customDiagramSizes={q.customDiagramSizes}
                            onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                        />
                    </div>
                )}
                <div style={Q.sideBySideContainer}>
                    <div style={Q.sideLeftContent}>
                        {renderOptions(true)}
                    </div>
                    <div style={Q.sideRightDiagram}>
                        <ResizableDiagram
                            src={imageUrl}
                            alt="Diagram"
                            questionId={qId}
                            diagramKey="main"
                            initialHeight={currentDiagramHeight}
                            isManual={isMainManual}
                            onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                            maxWidth="100%"
                        />
                    </div>
                </div>
            </>
        );
    }

    // INLINE / STANDARD LAYOUT
    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: imageUrl ? '3px' : '2px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '3px auto 5px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {renderOptions(false)}
        </>
    );
}

/**
 * Assertion & Reason Body
 */
/**
 * Assertion & Reason Body
 */
function BodyAssertionReason({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { assertion, reason } = parseAssertionReason(q);
    const opts = q.options && q.options.length > 0 ? q.options : AR_OPTIONS;
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    // Check if there is introductory directions text BEFORE the word "Assertion"
    let introText = '';
    const introMatch = qText.match(/^([\s\S]*?)(?=Assertion\s*(?:\(A\))?[:\-])/i);
    if (introMatch && introMatch[1].trim().length > 0) {
        const candidate = introMatch[1].trim();
        if (!/Amniocentesis|is one of the/i.test(candidate)) {
            introText = candidate;
        }
    }

    return (
        <>
            {introText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={introText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            <div style={{ marginBottom: '3px' }}>
                <div style={{ marginBottom: '2px', lineHeight: '1.42' }}>
                    <strong style={{ color: '#000', marginRight: '6px' }}>Assertion (A):</strong>
                    <MathRenderer inline text={assertion} />
                </div>
                {reason && (
                    <div style={{ marginBottom: '2px', lineHeight: '1.42' }}>
                        <strong style={{ color: '#000', marginRight: '6px' }}>Reason (R):</strong>
                        <MathRenderer inline text={reason} />
                    </div>
                )}
            </div>
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '3px auto 5px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            <div style={{ marginTop: '3px', ...getDynamicOptGrid(opts, isTwoCol) }}>
                {opts.map((opt, i) => (
                    <div key={i} style={Q.optRow}>
                        <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                            <MathRenderer inline text={typeof opt === 'object' ? (opt.text || opt.option || '') : opt} />
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

/**
 * Match the Following Body
 */
/** Parse match the following from text when matchPairs array is empty */
function parseMatchFromText(q) {
    if (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) {
        return { introText: q.questionText || q.question || '', pairs: q.matchPairs };
    }
    if (Array.isArray(q.column_a) && q.column_a.length > 0 && Array.isArray(q.column_b) && q.column_b.length > 0) {
        const maxL = Math.max(q.column_a.length, q.column_b.length);
        const pairs = [];
        for (let i = 0; i < maxL; i++) {
            pairs.push({
                left: q.column_a[i] || '',
                right: q.column_b[i] || ''
            });
        }
        return { introText: q.questionText || q.question || '', pairs };
    }
    const txt = q.questionText || q.question || '';
    
    // Check if question text has Column I / Column II or List I / List II
    const colRegex = /(?:\*\*|__)?(?:Column|List)\s*(?:I|A)(?:\*\*|__)?([\s\S]*?)(?:\*\*|__)?(?:Column|List)\s*(?:II|B)(?:\*\*|__)?([\s\S]*?)(?=Choose the correct|Select the correct|Options:|\(a\)|\(A\)|[A-D]\s*[:\-\)]|$)/i;
    const match = txt.match(colRegex);
    if (match) {
        const introText = txt.substring(0, match.index).trim();
        const rawCol1 = match[1].trim();
        const rawCol2 = match[2].trim();

        const splitItems = (str) => {
            let items = str.split(/(?:\([A-Da-d1-4ivx]+\)|[A-Da-d1-4ivx]\.|\b[A-D]\b|\b[1-4]\b)/g)
                .map(s => s.trim().replace(/^[:\-]\s*/, ''))
                .filter(Boolean);
            if (items.length >= 2) return items;
            return str.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        };

        const col1Items = splitItems(rawCol1);
        const col2Items = splitItems(rawCol2);
        const maxLen = Math.max(col1Items.length, col2Items.length);
        const pairs = [];
        for (let i = 0; i < maxLen; i++) {
            pairs.push({
                left: col1Items[i] || '',
                right: col2Items[i] || ''
            });
        }
        if (pairs.length > 0) {
            return { introText, pairs };
        }
    }
    return { introText: txt, pairs: [] };
}

/** Parse statement-based questions from text */
function parseStatementsFromText(q) {
    if (Array.isArray(q.statements) && q.statements.length > 0) {
        return { introText: '', statements: q.statements };
    }
    const txt = q.questionText || q.question || '';
    const stmts = [];
    const regex = /Statement\s*([I|V|X|0-9|A-D]+)\s*[:\-]?\s*([\s\S]*?)(?=Statement\s*[I|V|X|0-9|A-D]+\s*[:\-]|Choose the correct|Select the correct|Options:|$)/gi;
    let m;
    let firstIndex = -1;
    while ((m = regex.exec(txt)) !== null) {
        if (firstIndex === -1) firstIndex = m.index;
        stmts.push(cleanStatementText(m[2]));
    }
    if (stmts.length > 0) {
        const introText = txt.substring(0, firstIndex).trim();
        return { introText, statements: stmts };
    }
    return { introText: txt, statements: [] };
}

/**
 * Match the Following Body
 */
function BodyMatchFollowing({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { introText, pairs: parsedPairs } = parseMatchFromText(q);
    const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) ? q.matchPairs : parsedPairs;
    const opts = q.options || [];
    const rawQText = cleanQuestionText(pairs.length > 0 ? introText : (q.questionText || q.question || ''));
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '2px auto 4px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {pairs.length > 0 && (
                <table style={Q.matchTable}>
                    <thead>
                        <tr>
                            <th style={Q.matchTh}>Column I</th>
                            <th style={Q.matchTh}>Column II</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pairs.map((pair, pi) => (
                            <tr key={pi}>
                                <td style={Q.matchTd}>
                                    <strong>({String.fromCharCode(65 + pi)})</strong>{' '}
                                    <MathRenderer inline text={pair.left || ''} />
                                </td>
                                <td style={Q.matchTd}>
                                    <strong>({pi + 1})</strong>{' '}
                                    <MathRenderer inline text={pair.right || ''} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, isTwoCol)}>
                    {opts.map((opt, i) => {
                        const labels = getQuestionOptionLabels(q);
                        return (
                            <div key={i} style={Q.optRow}>
                                <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                                <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                    <MathRenderer inline text={opt} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

/**
 * Statement-Based Body
 */
function BodyStatementBased({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { introText, statements: parsedStmts } = parseStatementsFromText(q);
    const statements = (Array.isArray(q.statements) && q.statements.length > 0) ? q.statements : parsedStmts;
    const opts = q.options || [];
    const rawQText = cleanQuestionText(statements.length > 0 ? introText : (q.questionText || q.question || ''));
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {statements.length > 0 && (
                <div style={{ margin: '3px 0 4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {statements.map((stmt, si) => (
                        <div key={si} style={{ lineHeight: '1.42', fontWeight: 400 }}>
                            <strong style={{ color: '#000', marginRight: '6px' }}>Statement {si + 1}:</strong>
                            <MathRenderer inline text={stmt} />
                        </div>
                    ))}
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '2px auto 4px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, isTwoCol)}>
                    {opts.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                <MathRenderer inline text={opt} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

/**
 * Main QuestionBlock Component
 */
export default function QuestionBlock({
    q,
    displayNum = 1,
    classes = [],
    showMarks = false,
    singleColMode = false,
    isTwoCol = false,
    fontSize = '13px',
    lineHeight = '1.45',
    formatMarks,
    extraStyle = {},
    diagramMaxHeight = '180px',
    onDiagramResize,
}) {
    if (!q) return null;

    const activeFontSize = q.fontSize || fontSize;
    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
    const qTextRaw = q.questionText || q.question || '';
    const effectiveIsTwoCol = Boolean(isTwoCol);

    const isMatch = qType.includes('MATCH') || /(?:Column|List)\s*I[\s\S]*(?:Column|List)\s*II/i.test(qTextRaw) || /Match (?:List|the following|Column)/i.test(qTextRaw);
    const isAssertion = qType.includes('ASSERTION') || (/Assertion\s*(?:\(A\))?/i.test(qTextRaw) && /Reason\s*(?:\(R\))?/i.test(qTextRaw));
    const isStatement = qType.includes('STATEMENT') || (/Statement\s*(?:I|1)\s*[:\-]/i.test(qTextRaw) && /Statement\s*(?:II|2)\s*[:\-]/i.test(qTextRaw));

    const renderBody = () => {
        if (isAssertion) {
            return (
                <BodyAssertionReason
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isMatch) {
            return (
                <BodyMatchFollowing
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isStatement) {
            return (
                <BodyStatementBased
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        // Default MCQ & Diagram-Based
        return (
            <BodyMCQ
                q={q}
                classes={classes}
                isTwoCol={effectiveIsTwoCol}
                diagramMaxHeight={diagramMaxHeight}
                onDiagramResize={onDiagramResize}
                displayNum={displayNum}
            />
        );
    };

    return (
        <div style={{ ...Q.wrap, fontSize: activeFontSize, lineHeight, ...extraStyle }} className="question-block">
            <div style={Q.row}>
                <span style={Q.num}>{displayNum}.</span>
                <div style={Q.body}>{renderBody()}</div>
                {showMarks && formatMarks && (
                    <span style={Q.marks}>[{formatMarks(q.type, classes)}]</span>
                )}
            </div>
        </div>
    );
}
