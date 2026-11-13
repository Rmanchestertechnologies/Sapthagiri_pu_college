import React from 'react';
import MathRenderer from '../MathRenderer';
import ResizableDiagram from '../ResizableDiagram';
import { getQuestionOptionLabels } from '../../utils/sanitize';
import { AR_OPTIONS, Q, cleanOptionText, getOptionLabelText, isOptionSelectedCorrect } from './layout';
import { cleanQuestionText, extractDiagramFromText, parseAssertionReason } from './parsing';

/**
 * Assertion & Reason Body
 */
/**
 * Assertion & Reason Body
 */
export function BodyAssertionReason({
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
    const { assertion, reason } = parseAssertionReason(q);
    const validOpts = (q.options || []).filter(opt => {
        const raw = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
        return raw.trim().length > 0;
    });
    const opts = validOpts.length >= 4 ? validOpts : AR_OPTIONS;
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const labels = getQuestionOptionLabels(q, optionFormat);
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    const optGapPx = optionSpacing === 'No Spacing' ? '0px' :
                     optionSpacing === '5' ? '5px' :
                     optionSpacing === '10' ? '10px' :
                     optionSpacing === '15' ? '15px' : '3px';
    const shouldHideOptions = hideOptions || displayMode === '5. Only Questions with No Options';

    const effectivePerLine = Number(optionsPerLine) || (optionsLayout === '4' ? 4 : (optionsLayout === '2col' ? 2 : (optionsLayout === 'stacked' ? 1 : (isTwoCol ? 1 : 2))));
    const gridColsClass = effectivePerLine === 4 ? 'grid-cols-4' : (effectivePerLine === 2 ? 'grid-cols-2' : 'grid-cols-1');

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
        <div style={{ width: '100%' }}>
            {introText && (
                <div style={{ ...Q.qTextBold, marginBottom: '3px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={introText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            <div style={{ marginBottom: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'block', lineHeight: '1.42', color: '#111' }}>
                    <strong style={{ color: '#000', marginRight: '6px' }}>Assertion (A):</strong>
                    <MathRenderer inline text={assertion} />
                </div>
                {reason && (
                    <div style={{ display: 'block', lineHeight: '1.42', color: '#111' }}>
                        <strong style={{ color: '#000', marginRight: '6px' }}>Reason (R):</strong>
                        <MathRenderer inline text={reason} />
                    </div>
                )}
            </div>
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '3px auto 5px', clear: 'both', maxWidth: sizeScale ? `${sizeScale}%` : '100%', display: 'block' }}>
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
            {/* Assertion-Reason Options: Stacked or 2x2 grid, never collapsed inline */}
            {!shouldHideOptions && (
                <div
                    className={`grid ${gridColsClass}`}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: effectivePerLine === 1 ? 'minmax(0, 1fr)' : `repeat(${effectivePerLine}, minmax(0, 1fr))`,
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
        </div>
    );
}
