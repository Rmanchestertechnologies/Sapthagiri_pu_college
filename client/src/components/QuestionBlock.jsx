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
        if (!opt) return { text: '', len: 0, hasMath: false, isComplex: false };
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : opt).trim();
        const hasImage = /\{\{IMG::|!\[/i.test(str);
        const clean = str.replace(/<[^>]+>/g, '').trim();

        // Detect math / LaTeX commands / symbols
        const mathMatch = /(\$|\\\(|\\\[|\\|\^|_)/i.test(clean);
        if (mathMatch) hasAnyMath = true;

        // Complex formula detection:
        // - Fractions (\frac, \dfrac)
        // - Vectors or hats (\vec, \hat)
        // - Integrals, square roots, matrices, summations (\sqrt, \int, \sum, \matrix, \begin)
        // - Long formulas with mathematical operators (+, -, =)
        // - Images
        const complexMatch =
            hasImage ||
            /(\\frac|\\dfrac|\\vec|\\hat|\\sqrt|\\int|\\sum|\\prod|\\matrix|\\begin|\\rightarrow|\|)/i.test(clean) ||
            (mathMatch && (clean.length > 12 || /(=|\+.*\-|\-.*\+|\^\{?\d+\}?.*_)/.test(clean)));

        if (complexMatch) {
            hasComplexFormula = true;
        }

        return {
            text: str,
            len: clean.length,
            hasMath: mathMatch,
            isComplex: complexMatch,
        };
    });

    const maxLen = Math.max(...parsedOptions.map((o) => o.len), 0);

    // ── TWO-COLUMN PAPER MODE (each column is ~350px wide) ──
    if (isTwoColMode) {
        // If any option has a complex formula (vectors, fractions, etc.), ALWAYS stack 1-below-another
        if (hasComplexFormula) {
            return {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: '3px 6px',
                marginTop: '4px',
                alignItems: 'start',
            };
        }

        // Extremely short scalar choices only (e.g. 0, 1, 2, 3 or A, B, C, D)
        if (maxLen <= 4 && !hasAnyMath && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                gap: '2px 8px',
                marginTop: '4px',
                alignItems: 'start',
            };
        }

        // Medium options (e.g. "50 minutes", short expressions up to 18 chars): 2x2 grid
        if (maxLen <= 18 && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '2px 10px',
                marginTop: '4px',
                alignItems: 'start',
            };
        }

        // Long text or formulas: 1 column vertical stack
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '2px 6px',
            marginTop: '4px',
            alignItems: 'start',
        };
    }

    // ── SINGLE-COLUMN PAPER MODE (full A4 width ~730px) ──
    if (hasComplexFormula && maxLen > 24) {
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '3px 6px',
            marginTop: '4px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 10 && !hasComplexFormula && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
            gap: '2px 16px',
            marginTop: '4px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 28 && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '2px 16px',
            marginTop: '4px',
            alignItems: 'start',
        };
    }

    return {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '3px 6px',
        marginTop: '4px',
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
        marginBottom: '10px',
        color: '#111',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        fontStyle: 'normal',
        lineHeight: '1.38',
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
        lineHeight: '1.38',
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
        lineHeight: '1.38',
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
        gap: '5px',
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
        lineHeight: '1.45',
        color: '#222',
        fontSize: '1em',
    },
    sideBySideContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: '12px',
        marginTop: '4px',
    },
    sideLeftContent: {
        flex: '1 1 65%',
        minWidth: 0,
    },
    sideRightDiagram: {
        flex: '0 0 35%',
        maxWidth: '220px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2px',
    },
    matchTable: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '6px 0 8px',
        fontSize: '1em',
        tableLayout: 'fixed',
        fontWeight: 400,
    },
    matchTh: {
        border: '1px solid #999',
        padding: '3px 6px',
        background: '#f5f5f5',
        fontWeight: 400,
        textAlign: 'left',
        width: '50%',
        color: '#111',
        fontSize: '1em',
    },
    matchTd: {
        border: '1px solid #999',
        padding: '3px 6px',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        width: '50%',
        fontWeight: 400,
        color: '#111',
        fontSize: '1em',
    },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '4px',
        alignItems: 'flex-start',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: '1em',
        fontWeight: 400,
    },
    assertLabel: {
        fontWeight: 400,
        whiteSpace: 'nowrap',
        color: '#000',
        fontSize: '1em',
    },
    assertText: {
        flex: 1,
        fontWeight: 400,
        color: '#111',
        fontSize: '1em',
    },
};

/**
 * Intelligent Layout Decision:
 * Decides whether diagram should be rendered side-by-side on the right, or inline/full-width
 */
function shouldRenderSideBySide(q, isTwoCol = false) {
    if (!q.imageUrl && !q.image_url) return false;
    // In 2-column paper mode, column width is narrower, so inline is cleaner
    if (isTwoCol) return false;

    // Check options length: if 4 standard short/medium options, side-by-side is optimal
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length >= 2 && options.length <= 4) {
        const totalOptLength = options.reduce((sum, opt) => sum + String(opt || '').length, 0);
        return totalOptLength < 250; // Side-by-side works cleanly when text isn't massive
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

/** Parse assertion/reason from question text */
function parseAssertionReason(q) {
    if (q.assertion) return { assertion: q.assertion, reason: q.reason || '' };
    const txt = q.questionText || q.question || '';
    const aMatch = txt.match(/Assertion\s*(?:\(A\))?\s*[:\-]?\s*([\s\S]*?)(?=Reason\s*(?:\(R\))?|$)/i);
    const rMatch = txt.match(/Reason\s*(?:\(R\))?\s*[:\-]?\s*([\s\S]*)$/i);
    return {
        assertion: aMatch ? aMatch[1].trim() : txt,
        reason: rMatch ? rMatch[1].trim() : '',
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
function BodyMCQ({ q, classes, isTwoCol, diagramMaxHeight = '260px', onDiagramResize, displayNum }) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const options = Array.isArray(q.options) ? q.options : [];
    const isSideBySide = shouldRenderSideBySide(q, isTwoCol);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramHeight || diagramMaxHeight;

    // Render Options List
    const renderOptions = (forceSingle = false) => {
        if (options.length === 0) return null;
        return (
            <div
                style={
                    forceSingle
                        ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2px 6px', marginTop: '4px' }
                        : getDynamicOptGrid(options, isTwoCol)
                }
            >
                {options.map((opt, i) => {
                    const optText = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
                    return (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                <MathRenderer
                                    inline
                                    text={optText}
                                    questionId={qId}
                                    initialHeight={q.customOptionDiagramHeight || '70px'}
                                    onSizeChange={onDiagramResize ? (h) => onDiagramResize(qId, h, `opt_${i}`) : undefined}
                                />
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (imageUrl && isSideBySide) {
        // SIDE-BY-SIDE: Left (Question Text + Options), Right (Diagram)
        return (
            <div style={Q.sideBySideContainer}>
                <div style={Q.sideLeftContent}>
                    {qText && (
                        <div style={Q.qTextBold}>
                            <MathRenderer
                                inline
                                text={qText}
                                questionId={qId}
                            />
                        </div>
                    )}
                    {renderOptions(true)}
                </div>
                <div style={Q.sideRightDiagram}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={Boolean(q.customDiagramHeight)}
                        onSizeChange={onDiagramResize ? (h) => onDiagramResize(qId, h, 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            </div>
        );
    }

    // INLINE / STANDARD LAYOUT
    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: imageUrl ? '4px' : '2px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '4px auto 6px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={Boolean(q.customDiagramHeight)}
                        onSizeChange={onDiagramResize ? (h) => onDiagramResize(qId, h, 'main') : undefined}
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
function BodyAssertionReason({ q, classes, isTwoCol, diagramMaxHeight = '260px', onDiagramResize, displayNum }) {
    const { assertion, reason } = parseAssertionReason(q);
    const opts = q.options && q.options.length > 0 ? q.options : AR_OPTIONS;
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramHeight || diagramMaxHeight;

    return (
        <>
            {qText && !q.assertion && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                    />
                </div>
            )}
            <div style={Q.assertRow}>
                <span style={Q.assertLabel}>Assertion (A):</span>
                <span style={Q.assertText}>
                    <MathRenderer inline text={assertion} />
                </span>
            </div>
            {reason && (
                <div style={Q.assertRow}>
                    <span style={Q.assertLabel}>Reason (R):</span>
                    <span style={Q.assertText}>
                        <MathRenderer inline text={reason} />
                    </span>
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '4px auto 6px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={Boolean(q.customDiagramHeight)}
                        onSizeChange={onDiagramResize ? (h) => onDiagramResize(qId, h, 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            <div style={{ marginTop: '5px', ...getDynamicOptGrid(opts, isTwoCol) }}>
                {opts.map((opt, i) => (
                    <div key={i} style={{ ...Q.optRow, marginBottom: '2px' }}>
                        <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                            <MathRenderer inline text={opt} />
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
function BodyMatchFollowing({ q, classes, isTwoCol, diagramMaxHeight = '260px', onDiagramResize, displayNum }) {
    const pairs = q.matchPairs || [];
    const opts = q.options || [];
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramHeight || diagramMaxHeight;

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '4px auto 6px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={Boolean(q.customDiagramHeight)}
                        onSizeChange={onDiagramResize ? (h) => onDiagramResize(qId, h, 'main') : undefined}
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
function BodyStatementBased({ q, classes, isTwoCol, diagramMaxHeight = '260px', onDiagramResize, displayNum }) {
    const statements = q.statements || [];
    const opts = q.options || [];
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramHeight || diagramMaxHeight;

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                    />
                </div>
            )}
            {statements.length > 0 && (
                <div style={{ borderLeft: '2px solid #666', paddingLeft: '8px', margin: '4px 0 6px' }}>
                    {statements.map((stmt, si) => (
                        <div key={si} style={{ marginBottom: '2px', fontWeight: 400 }}>
                            <span>Statement {si + 1}:</span> <MathRenderer inline text={stmt} />
                        </div>
                    ))}
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '4px auto 6px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={Boolean(q.customDiagramHeight)}
                        onSizeChange={onDiagramResize ? (h) => onDiagramResize(qId, h, 'main') : undefined}
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
    diagramMaxHeight = '260px',
    onDiagramResize,
}) {
    if (!q) return null;

    const activeFontSize = q.fontSize || fontSize;
    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
    const effectiveIsTwoCol = Boolean(isTwoCol || singleColMode);

    const renderBody = () => {
        if (qType.includes('ASSERTION')) {
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
        if (qType.includes('MATCH')) {
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
        if (qType.includes('STATEMENT') || qType.includes('MULTIPLE_STATEMENT')) {
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
