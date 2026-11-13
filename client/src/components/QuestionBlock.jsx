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
import { BodyAssertionReason } from './question/BodyAssertionReason';
import { BodyMCQ } from './question/BodyMCQ';
import { BodyMatchFollowing } from './question/BodyMatchFollowing';
import { BodyNumerical } from './question/BodyNumerical';
import { BodyStatementBased } from './question/BodyStatementBased';
import { BodyTrueFalse } from './question/BodyTrueFalse';
import { QuestionGearPopup } from './question/QuestionGearPopup';
import { Q, formatOptionKey } from './question/layout';
import { parseMatchFromText, parseStatementsFromText } from './question/parsing';

export { cleanOptionText, getOptionLabelText, formatOptionKey, isOptionSelectedCorrect } from './question/layout';
export { cleanQuestionText, repairBrokenLatexFraction, mergeContinuationItems } from './question/parsing';
export { QuestionGearPopup } from './question/QuestionGearPopup';

function QuestionBlockInner({
    q,
    displayNum = 1,
    classes = [],
    showMarks = false,
    singleColMode = false,
    isTwoCol = false,
    fontSize = '13px',
    lineHeight = '1.42',
    optionFormat = '(1) (2) (3) (4)',
    formatMarks,
    extraStyle = {},
    diagramMaxHeight = '180px',
    onDiagramResize,
    examType = 'NEET',
    onEdit,
    onSwap,
    showQuestionNumbers = true,
    imageBelowQuestion = false,
    paper2ColumnQuestionBreak = true,
    displayMode = '1. Questions',
    optionsLayout = 'line',
    optionSpacing = 'Default',
    questionSpacing = 'Default',
    onLayoutChange,
}) {
    const [showGearPopup, setShowGearPopup] = React.useState(false);
    const [localAlignment, setLocalAlignment] = React.useState(
        imageBelowQuestion ? 'Below' : (q.imageAlignment || null)
    );
    const [localOptionsPerLine, setLocalOptionsPerLine] = React.useState(q.optionsPerLine || null);
    const [localSizeScale, setLocalSizeScale] = React.useState(q.sizeScale || 100);
    const [localDiagramHeight, setLocalDiagramHeight] = React.useState(
        parseInt(q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight || 180, 10)
    );

    React.useEffect(() => {
        if (imageBelowQuestion) {
            setLocalAlignment('Below');
        } else {
            setLocalAlignment(q.imageAlignment || null);
        }
    }, [imageBelowQuestion, q.imageAlignment]);

    React.useEffect(() => {
        if (diagramMaxHeight && !q.customDiagramSizes?.['main'] && !q.customDiagramHeight) {
            setLocalDiagramHeight(parseInt(diagramMaxHeight, 10));
        }
    }, [diagramMaxHeight, q.customDiagramSizes, q.customDiagramHeight]);

    React.useEffect(() => {
        if (q.optionsPerLine) setLocalOptionsPerLine(q.optionsPerLine);
    }, [q.optionsPerLine]);

    React.useEffect(() => {
        if (q.sizeScale) setLocalSizeScale(q.sizeScale);
    }, [q.sizeScale]);

    const handleAlignmentChange = (newAlign) => {
        setLocalAlignment(newAlign);
        if (onLayoutChange) {
            onLayoutChange({ imageAlignment: newAlign });
        }
    };

    const handleOptionsPerLineChange = (num) => {
        setLocalOptionsPerLine(num);
        if (onLayoutChange) {
            onLayoutChange({ optionsPerLine: num });
        }
    };

    const handleSizeScaleChange = (scale) => {
        setLocalSizeScale(scale);
        if (onLayoutChange) {
            onLayoutChange({ sizeScale: scale });
        }
    };

    const handleDiagramSizeDelta = (delta) => {
        const nextH = Math.min(800, Math.max(50, localDiagramHeight + delta));
        setLocalDiagramHeight(nextH);
        const qId = q._id || q.id || displayNum;
        if (onDiagramResize) {
            onDiagramResize(nextH, 'main');
        }
        if (onLayoutChange) {
            onLayoutChange({ customDiagramHeight: nextH });
        }
    };

    // back to the defaults the paper settings give (no per-question override)
    const handleResetLayout = () => {
        setLocalAlignment(imageBelowQuestion ? 'Below' : null);
        setLocalOptionsPerLine(null);
        setLocalSizeScale(100);
        setLocalDiagramHeight(parseInt(diagramMaxHeight || 180, 10));
        if (onLayoutChange) {
            onLayoutChange({ imageAlignment: null, optionsPerLine: null, sizeScale: 100, customDiagramHeight: null });
        }
        if (onDiagramResize) onDiagramResize(parseInt(diagramMaxHeight || 180, 10), 'main');
    };

    const activeFontSize = q.fontSize || fontSize;
    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
    const qTextRaw = q.questionText || q.question || '';
    const effectiveIsTwoCol = Boolean(isTwoCol);

    const matchData = parseMatchFromText(q);
    const hasMatchPairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) || (matchData.pairs && matchData.pairs.length >= 2);
    const isMatch = qType.includes('MATCH') || hasMatchPairs || /(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[\s\S]*(?:Column|List)\s*[-:]?\s*(?:II|2|B)\b/i.test(qTextRaw);

    const isAssertion = qType.includes('ASSERTION') || (/Assertion\s*(?:\(A\))?/i.test(qTextRaw) && /Reason\s*(?:\(R\))?/i.test(qTextRaw));

    const stmtData = parseStatementsFromText(q);
    const hasStatements = (Array.isArray(q.statements) && q.statements.length > 0) || (stmtData.statements && stmtData.statements.length >= 2);
    const isStatement = qType.includes('STATEMENT') || hasStatements;
    const isTF = qType.includes('TRUE_FALSE') || qType === 'TF';

    const isJeeExam = (examType || q.examType || '').toUpperCase().includes('JEE');
    const isNumerical = isJeeExam && (
        qType.includes('NUMERICAL') ||
        qType.includes('INTEGER') ||
        Boolean(q.isNumerical) ||
        (q.part && q.part.toUpperCase().includes('NUMERICAL')) ||
        (q.part && q.part.toUpperCase().includes('SECTION B')) ||
        (q.sectionName && q.sectionName.toUpperCase().includes('SECTION B'))
    );

    const renderBody = () => {
        if (isTF) {
            return <BodyTrueFalse q={q} displayNum={displayNum} displayMode={displayMode} />;
        }
        if (isNumerical) {
            return (
                <BodyNumerical
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={localDiagramHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isAssertion) {
            return (
                <BodyAssertionReason
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={localDiagramHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                    optionFormat={optionFormat}
                    imageAlignment={localAlignment}
                    optionsPerLine={localOptionsPerLine}
                    sizeScale={localSizeScale}
                    optionSpacing={optionSpacing}
                    displayMode={displayMode}
                    hideOptions={displayMode === '5. Only Questions with No Options'}
                    imageBelowQuestion={imageBelowQuestion}
                    optionsLayout={optionsLayout}
                />
            );
        }
        if (isMatch) {
            return (
                <BodyMatchFollowing
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={localDiagramHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                    optionFormat={optionFormat}
                    imageAlignment={localAlignment}
                    optionsPerLine={localOptionsPerLine}
                    sizeScale={localSizeScale}
                    optionSpacing={optionSpacing}
                    displayMode={displayMode}
                    hideOptions={displayMode === '5. Only Questions with No Options'}
                    imageBelowQuestion={imageBelowQuestion}
                    optionsLayout={optionsLayout}
                />
            );
        }
        if (isStatement && hasStatements) {
            return (
                <BodyStatementBased
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={localDiagramHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                    optionFormat={optionFormat}
                    imageAlignment={localAlignment}
                    optionsPerLine={localOptionsPerLine}
                    sizeScale={localSizeScale}
                    optionSpacing={optionSpacing}
                    displayMode={displayMode}
                    hideOptions={displayMode === '5. Only Questions with No Options'}
                    imageBelowQuestion={imageBelowQuestion}
                    optionsLayout={optionsLayout}
                />
            );
        }
        return (
            <BodyMCQ
                q={q}
                classes={classes}
                isTwoCol={effectiveIsTwoCol}
                diagramMaxHeight={localDiagramHeight}
                onDiagramResize={onDiagramResize}
                displayNum={displayNum}
                optionFormat={optionFormat}
                imageAlignment={localAlignment}
                optionsPerLine={localOptionsPerLine}
                sizeScale={localSizeScale}
                displayMode={displayMode}
                optionSpacing={optionSpacing}
                imageBelowQuestion={imageBelowQuestion}
                optionsLayout={optionsLayout}
            />
        );
    };

    const renderAnswerAndSolution = () => {
        const showAns = displayMode === '2. Questions with Answers' || displayMode === '3. Questions with Answers & Solutions';
        const showSol = displayMode === '3. Questions with Answers & Solutions';
        if (!showAns && !showSol) return null;

        const isTF = (q.type || q.q_type || '').toUpperCase().includes('TRUE_FALSE') || (q.type || q.q_type || '').toUpperCase() === 'TF';
        const isNum = (q.type || q.q_type || '').toUpperCase().includes('NUMERICAL') || Boolean(q.num_answer);
        const ansKey = formatOptionKey(q, optionFormat);
        const solText = q.solutionText || q.solution_text || q.solution;

        let ansDisplay = 'Option (' + ansKey + ')';
        if (isTF) {
            const isTrue = /^[Aa]$/.test(String(q.correct_option).trim()) || /^true$/i.test(String(q.answer).trim());
            ansDisplay = isTrue ? 'True' : 'False';
        } else if (isNum) {
            ansDisplay = 'Value: ' + (q.num_answer || q.answer || ansKey);
        }

        return (
            <div style={{ marginTop: '5px', clear: 'both' }}>
                {showAns && (
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#dcfce7',
                            border: '1px solid #86efac',
                            color: '#15803d',
                            fontWeight: 800,
                            fontSize: '11px',
                        }}
                    >
                        <span>✓ Answer:</span>
                        <span>{ansDisplay}</span>
                    </div>
                )}
                {showSol && (
                    <div
                        style={{
                            marginTop: '5px',
                            padding: '6px 10px',
                            backgroundColor: '#f0fdf4',
                            border: '1.5px solid #86efac',
                            borderRadius: '6px',
                            fontSize: '11px',
                            lineHeight: '1.45',
                            color: '#1e293b',
                        }}
                    >
                        <div style={{ fontWeight: 800, color: '#166534', marginBottom: '2px' }}>
                            Solution:
                        </div>
                        <MathRenderer inline text={solText || 'Step-by-step verified solution.'} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            ...Q.wrap,
            fontSize: activeFontSize,
            lineHeight,
            breakInside: paper2ColumnQuestionBreak !== false ? 'avoid' : 'auto',
            WebkitColumnBreakInside: paper2ColumnQuestionBreak !== false ? 'avoid' : 'auto',
            pageBreakInside: paper2ColumnQuestionBreak !== false ? 'avoid' : 'auto',
            ...extraStyle,
            position: 'relative'
        }} className="question-block group">
            <div
                className={'no-print ' + (showGearPopup ? 'opacity-100' : 'opacity-0 group-hover:opacity-100') + ' transition-opacity duration-150'}
                style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '0px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    zIndex: 20,
                    backgroundColor: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                }}
            >
                {/* ⚙️ Gear Button */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowGearPopup(prev => !prev); }}
                    style={{
                        border: 'none',
                        background: showGearPopup ? '#001f6d' : 'transparent',
                        color: showGearPopup ? '#ffd700' : '#475569',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                    }}
                    title="Question Alignment, Options per Line & Diagram Size"
                >
                    <span>⚙️</span>
                </button>

                {onEdit && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(q, displayNum); }}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#1d4ed8',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 4px',
                        }}
                        title="Edit Question & LaTeX Formulas"
                    >
                        <span>✏️</span> Edit
                    </button>
                )}
                {onSwap && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSwap(q, displayNum); }}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#b45309',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 4px',
                        }}
                        title="Swap with another Question from Question Bank"
                    >
                        <span>🔀</span> Swap
                    </button>
                )}
            </div>

            {showGearPopup && (
                <QuestionGearPopup
                    displayNum={displayNum}
                    imageAlignment={localAlignment}
                    optionsPerLine={localOptionsPerLine}
                    sizeScale={localSizeScale}
                    currentDiagramHeight={localDiagramHeight}
                    onAlignmentChange={handleAlignmentChange}
                    onOptionsPerLineChange={handleOptionsPerLineChange}
                    onSizeScaleChange={handleSizeScaleChange}
                    onDiagramSizeDelta={handleDiagramSizeDelta}
                    onReset={handleResetLayout}
                    onClose={() => setShowGearPopup(false)}
                />
            )}

            <div style={Q.row}>
                {showQuestionNumbers && (
                    <span style={Q.num}>{displayNum}.</span>
                )}
                <div style={Q.body}>
                    {renderBody()}
                    {renderAnswerAndSolution()}
                </div>
                {showMarks && (
                    <span style={Q.marks}>[{q.marks ? `${q.marks}M` : (formatMarks ? formatMarks(q.type, classes) : '1M')}]</span>
                )}
            </div>
        </div>
    );
}

// QuestionBlockInner uses hooks, so the missing-question guard lives in this wrapper (see EditQuestionModal).
export default function QuestionBlock(props) {
    if (!props.q) return null;
    return <QuestionBlockInner {...props} />;
}
