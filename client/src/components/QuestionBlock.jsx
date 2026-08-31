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
 * - Zero overlap, no clipping, proper line spacing, KaTeX math/chem preservation.
 */
import React from 'react';
import MathRenderer from './MathRenderer';
import { optionLabel } from '../utils/sanitize';

// Dynamic option grid calculator based on length:
// - Very Short (<= 20 chars): all 4 in one line
// - Medium (<= 52 chars): 2 on left, 2 on right (2x2 grid)
// - Long (> 52 chars): 1 below one (vertical stack)
function getDynamicOptGrid(options = [], singleColMode = false) {
    if (!options || options.length === 0) return { display: 'none' };

    const maxLen = Math.max(...options.map(opt => {
        if (!opt) return 0;
        const plain = String(opt)
            .replace(/<[^>]+>/g, '')
            .replace(/\$\$[\s\S]*?\$\$/g, 'formula')
            .replace(/\$[^$]*\$/g, 'm')
            .replace(/\\\[[\s\S]*?\\\]/g, 'formula')
            .replace(/\\\([\s\S]*?\\\)/g, 'm')
            .trim();
        return plain.length;
    }));

    if (singleColMode) {
        // Two-column paper mode
        if (maxLen <= 12 && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: `repeat(${options.length}, 1fr)`,
                gap: '2px 8px',
                marginTop: '4px',
                alignItems: 'start',
            };
        }
        if (maxLen <= 35 && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2px 10px',
                marginTop: '4px',
                alignItems: 'start',
            };
        }
        return {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '2px 6px',
            marginTop: '4px',
            alignItems: 'start',
        };
    }

    // Full width Single Column mode
    if (maxLen <= 20 && options.length <= 4) {
        // Very short: all in 1 line
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${options.length}, 1fr)`,
            gap: '2px 16px',
            marginTop: '4px',
            alignItems: 'start',
        };
    }
    if (maxLen <= 52 && options.length <= 4) {
        // Medium: 2 on left, 2 on right (2x2)
        return {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2px 16px',
            marginTop: '4px',
            alignItems: 'start',
        };
    }
    // Very long: 1 below another
    return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '2px 6px',
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
        lineHeight: '1.38',
        boxSizing: 'border-box',
        verticalAlign: 'top',
    },
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '6px',
    },
    num: {
        fontWeight: 700,
        whiteSpace: 'nowrap',
        minWidth: '24px',
        fontSize: '1em',
        lineHeight: '1.38',
        color: '#000',
    },
    body: {
        flex: 1,
        minWidth: 0,
    },
    qTextBold: {
        fontWeight: 700,
        color: '#000',
        display: 'inline',
        lineHeight: '1.38',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    marks: {
        fontWeight: 700,
        whiteSpace: 'nowrap',
        fontSize: '0.85em',
        alignSelf: 'flex-start',
        marginLeft: '6px',
        color: '#444',
    },
    optRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '5px',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        minWidth: 0,
        fontSize: '0.96em',
        fontWeight: 400,
        color: '#111',
    },
    optLbl: {
        fontWeight: 700,
        whiteSpace: 'nowrap',
        minWidth: '20px',
        lineHeight: '1.45',
        color: '#222',
    },
    // Standardized diagram image wrapper
    diagramImg: (maxH = '135px', maxW = '240px') => ({
        display: 'block',
        maxWidth: maxW,
        maxHeight: maxH,
        width: 'auto',
        height: 'auto',
        objectFit: 'contain',
        borderRadius: '4px',
        backgroundColor: '#fff',
        boxSizing: 'border-box',
        margin: '4px auto',
    }),
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
        fontSize: '0.92em',
        tableLayout: 'fixed',
    },
    matchTh: {
        border: '1px solid #999',
        padding: '3px 6px',
        background: '#f5f5f5',
        fontWeight: 700,
        textAlign: 'left',
        width: '50%',
        color: '#111',
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
    },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '4px',
        alignItems: 'flex-start',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    assertLabel: {
        fontWeight: 700,
        whiteSpace: 'nowrap',
        color: '#000',
    },
    assertText: {
        flex: 1,
        fontWeight: 400,
        color: '#111',
    },
};

/**
 * Intelligent Layout Decision:
 * Decides whether diagram should be rendered side-by-side on the right, or inline/full-width
 */
function shouldRenderSideBySide(q, singleColMode = false) {
    if (!q.imageUrl && !q.image_url) return false;
    // In 2-column paper mode, column width is narrower, so inline is cleaner
    if (singleColMode) return false;

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
    // Strip redundant leading question numbers like "6. ", "Q6: ", "6) " that might be in raw database text
    return String(text).replace(/^(\s*(?:Q\.?\s*)?\d+[\.\)\-:]\s*)+/i, '').trim();
}

/**
 * MCQ Body with Intelligent Diagram Placement
 */
function BodyMCQ({ q, classes, singleColMode, diagramMaxHeight = '150px' }) {
    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;
    const options = Array.isArray(q.options) ? q.options : [];
    const isSideBySide = shouldRenderSideBySide(q, singleColMode);

    // Render Options List
    const renderOptions = (forceSingle = false) => {
        if (options.length === 0) return null;
        return (
            <div style={forceSingle ? { display: 'grid', gridTemplateColumns: '1fr', gap: '2px 6px', marginTop: '4px' } : getDynamicOptGrid(options, singleColMode)}>
                {options.map((opt, i) => (
                    <div key={i} style={Q.optRow}>
                        <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 400 }}>
                            <MathRenderer inline text={opt} />
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    if (imageUrl && isSideBySide) {
        // SIDE-BY-SIDE: Left (Question Text + Options), Right (Diagram)
        return (
            <div style={Q.sideBySideContainer}>
                <div style={Q.sideLeftContent}>
                    <div style={Q.qTextBold}>
                        <MathRenderer inline text={qText} />
                    </div>
                    {renderOptions(true)}
                </div>
                <div style={Q.sideRightDiagram}>
                    <img
                        src={imageUrl}
                        alt="Diagram"
                        style={Q.diagramImg(diagramMaxHeight, '100%')}
                        loading="lazy"
                    />
                </div>
            </div>
        );
    }

    // INLINE / STANDARD LAYOUT
    return (
        <>
            <div style={Q.qTextBold}>
                <MathRenderer inline text={qText} />
            </div>
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '6px 0' }}>
                    <img
                        src={imageUrl}
                        alt="Diagram"
                        style={{ ...Q.diagramImg(diagramMaxHeight, '240px'), margin: '0 auto' }}
                        loading="lazy"
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
function BodyAssertionReason({ q, classes, singleColMode, diagramMaxHeight }) {
    const { assertion, reason } = parseAssertionReason(q);
    const opts = q.options && q.options.length > 0 ? q.options : AR_OPTIONS;
    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;

    return (
        <>
            {qText && !q.assertion && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px' }}>
                    <MathRenderer inline text={qText} />
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
                <div style={{ textAlign: 'center', margin: '6px 0' }}>
                    <img
                        src={imageUrl}
                        alt="Diagram"
                        style={{ ...Q.diagramImg(diagramMaxHeight, '220px'), margin: '0 auto' }}
                        loading="lazy"
                    />
                </div>
            )}
            <div style={{ marginTop: '5px', ...getDynamicOptGrid(opts, singleColMode) }}>
                {opts.map((opt, i) => (
                    <div key={i} style={{ ...Q.optRow, marginBottom: '2px' }}>
                        <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 400 }}>
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
function BodyMatchFollowing({ q, classes, singleColMode, diagramMaxHeight }) {
    const pairs = q.matchPairs || [];
    const opts = q.options || [];
    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px' }}>
                    <MathRenderer inline text={qText} />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '6px 0' }}>
                    <img
                        src={imageUrl}
                        alt="Diagram"
                        style={{ ...Q.diagramImg(diagramMaxHeight, '220px'), margin: '0 auto' }}
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
                <div style={getDynamicOptGrid(opts, true)}>
                    {opts.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, fontWeight: 400 }}>
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
 * Statement-Based Body
 */
function BodyStatementBased({ q, classes, singleColMode, diagramMaxHeight }) {
    const statements = q.statements || [];
    const opts = q.options || [];
    const qText = cleanQuestionText(q.questionText || q.question || '');
    const imageUrl = q.imageUrl || q.image_url;

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px' }}>
                    <MathRenderer inline text={qText} />
                </div>
            )}
            {statements.length > 0 && (
                <div style={{ borderLeft: '2px solid #666', paddingLeft: '8px', margin: '4px 0 6px' }}>
                    {statements.map((stmt, si) => (
                        <div key={si} style={{ marginBottom: '2px', fontWeight: 400 }}>
                            <strong>Statement {si + 1}:</strong> <MathRenderer inline text={stmt} />
                        </div>
                    ))}
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '6px 0' }}>
                    <img
                        src={imageUrl}
                        alt="Diagram"
                        style={{ ...Q.diagramImg(diagramMaxHeight, '220px'), margin: '0 auto' }}
                    />
                </div>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, singleColMode)}>
                    {opts.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, fontWeight: 400 }}>
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
    fontSize = '13px',
    lineHeight = '1.45',
    formatMarks,
    extraStyle = {},
    diagramMaxHeight = '150px',
}) {
    if (!q) return null;

    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();

    const renderBody = () => {
        if (qType.includes('ASSERTION')) {
            return (
                <BodyAssertionReason
                    q={q}
                    classes={classes}
                    singleColMode={singleColMode}
                    diagramMaxHeight={diagramMaxHeight}
                />
            );
        }
        if (qType.includes('MATCH')) {
            return (
                <BodyMatchFollowing
                    q={q}
                    classes={classes}
                    singleColMode={singleColMode}
                    diagramMaxHeight={diagramMaxHeight}
                />
            );
        }
        if (qType.includes('STATEMENT') || qType.includes('MULTIPLE_STATEMENT')) {
            return (
                <BodyStatementBased
                    q={q}
                    classes={classes}
                    singleColMode={singleColMode}
                    diagramMaxHeight={diagramMaxHeight}
                />
            );
        }
        // Default MCQ & Diagram-Based
        return (
            <BodyMCQ
                q={q}
                classes={classes}
                singleColMode={singleColMode}
                diagramMaxHeight={diagramMaxHeight}
            />
        );
    };

    return (
        <div style={{ ...Q.wrap, fontSize, lineHeight, ...extraStyle }} className="question-block">
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
