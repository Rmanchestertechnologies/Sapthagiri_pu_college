import React from 'react';
import MathRenderer from '../MathRenderer';
import ResizableDiagram from '../ResizableDiagram';
import { getQuestionOptionLabels, extractOptionsIfMissing } from '../../utils/sanitize';
import { Q, cleanOptionText, getOptionLabelText, isOptionSelectedCorrect } from './layout';
import { cleanQuestionText, extractDiagramFromText, parseStatementsFromText } from './parsing';

/**
 * Statement-Based Body
 */
export function BodyStatementBased({
    q,
    classes,
    isTwoCol,
    diagramMaxHeight = '180px',
    onDiagramResize,
    displayNum,
    optionFormat = 'numeric',
    imageAlignment = null,
    optionsPerLine = null,
    sizeScale = null,
    optionSpacing = 'Default',
    displayMode = '1. Questions',
    hideOptions = false,
    imageBelowQuestion = false,
    optionsLayout = 'line',
}) {
    const { introText, statements, outroText } = parseStatementsFromText(q);

    const rawOptions = extractOptionsIfMissing(q);
    let opts = (rawOptions && rawOptions.length >= 2) ? rawOptions : (q.options || []);
    opts = opts.filter(opt => {
        const raw = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
        return raw.trim().length > 0;
    });
    if (opts.length < 2) {
        const directOpts = [q.opt_a, q.opt_b, q.opt_c, q.opt_d, q.option_a, q.option_b, q.option_c, q.option_d].filter(o => o && String(o).trim().length > 0);
        if (directOpts.length >= 2) {
            opts = directOpts;
        }
    }
    const hasStatementPreamble = Boolean(introText && !/(?:^|\r?\n|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?I|\(?1|\(?A\)?)\s*[:.\-)–—]?/i.test(introText));
    const rawQText = cleanQuestionText(hasStatementPreamble ? introText : '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const labels = getQuestionOptionLabels(q, optionFormat);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    const optGapPx = optionSpacing === 'No Spacing' ? '0px' :
                     optionSpacing === '5' ? '5px' :
                     optionSpacing === '10' ? '10px' :
                     optionSpacing === '15' ? '15px' : '3px';
    const shouldHideOptions = hideOptions || displayMode === '5. Only Questions with No Options';

    const effectivePerLine = Number(optionsPerLine) || (optionsLayout === '4' ? 4 : (optionsLayout === '2col' ? 2 : (optionsLayout === 'stacked' ? 1 : (isTwoCol ? 1 : 4))));
    const gridColsClass = effectivePerLine === 4 ? 'grid-cols-4' : (effectivePerLine === 2 ? 'grid-cols-2' : 'grid-cols-1');

    const hasEmbeddedDiagInStmts = (statements || []).some(s => {
        const txt = typeof s === 'object' ? (s.text || s.statement || '') : String(s);
        return /\{\{IMG::|!\[|<img|https?:\/\/res\.cloudinary\.com\//i.test(txt);
    });

    return (
        <>
            {qText && hasStatementPreamble && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px', display: 'block' }}>
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
                        <div key={si} style={{ lineHeight: '1.42', fontWeight: 400, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <strong style={{ color: '#000', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {stmt.label || `(${String.fromCharCode(65 + si)})`}
                            </strong>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <MathRenderer inline text={stmt.text || (typeof stmt === 'string' ? stmt : '')} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {outroText && (
                <div style={{ ...Q.qTextBold, marginTop: '2px', marginBottom: '3px', display: 'block' }}>
                    <MathRenderer inline text={outroText} />
                </div>
            )}
            {imageUrl && !hasEmbeddedDiagInStmts && (
                <div style={{ textAlign: 'center', margin: '2px auto 4px', clear: 'both', maxWidth: sizeScale ? `${sizeScale}%` : '100%', display: 'block' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        sizeScale={sizeScale}
                        maxWidth="100%"
                    />
                </div>
            )}
            {!shouldHideOptions && opts.length > 0 && (
                <div
                    className={`options-container grid ${gridColsClass}`}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isTwoCol
                            ? (effectivePerLine === 1 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))')
                            : (effectivePerLine === 1 ? 'minmax(0, 1fr)' : `repeat(${effectivePerLine}, minmax(0, 1fr))`),
                        gap: isTwoCol ? `${optGapPx} 6px` : `${optGapPx} 12px`,
                        marginTop: '4px',
                        alignItems: 'start'
                    }}
                >
                    {opts.map((opt, i) => {
                        const isAnswersMode = displayMode === '2. Questions with Answers' || displayMode === '3. Questions with Answers & Solutions';
                        const isCorrect = isAnswersMode && isOptionSelectedCorrect(i, q);
                        return (
                        <div key={i} style={{
                            ...Q.optRow,
                            ...(isCorrect ? {
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                fontWeight: 700,
                            } : {})
                        }}>
                            <span style={{ ...Q.optLbl, ...(isCorrect ? { color: '#15803d', fontWeight: 800 } : {}) }}>
                                ({getOptionLabelText(i, optionFormat, labels, classes)}){isCorrect ? ' ✓' : ''}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: isCorrect ? 700 : 400 }}>
                                <MathRenderer
                                    inline
                                    text={cleanOptionText(typeof opt === 'object' ? (opt.text || opt.option || '') : opt)}
                                    questionId={qId}
                                    isOption={true}
                                    sizeScale={sizeScale}
                                    optionIndex={i}
                                />
                            </span>
                        </div>
                    );})}
                </div>
            )}
        </>
    );
}

/**
 * Main QuestionBlock Component
 */
/**
 * SECTION B / NUMERICAL / INTEGER VALUE QUESTION RENDERER
 * Strictly adheres to JEE Main / Advanced standards:
 * - NO (A), (B), (C), (D) choices rendered.
 * - Renders question text, LaTeX equations, diagrams.
 * - Renders a clean standardized numerical answer blank / box.
 */
