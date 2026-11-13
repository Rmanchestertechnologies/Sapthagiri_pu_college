import React from 'react';
import MathRenderer from '../MathRenderer';
import ResizableDiagram from '../ResizableDiagram';
import { getQuestionOptionLabels, extractOptionsIfMissing } from '../../utils/sanitize';
import { Q, cleanOptionText, getOptionLabelText, isOptionSelectedCorrect, shouldRenderSideBySide } from './layout';
import { cleanQuestionText, extractDiagramFromText } from './parsing';

/**
 * MCQ Body with Intelligent Diagram Placement & Resizing
 */
export function BodyMCQ({
    q,
    classes,
    isTwoCol,
    diagramMaxHeight = '180px',
    onDiagramResize,
    displayNum,
    optionFormat = '(1) (2) (3) (4)',
    imageAlignment = null,
    optionsPerLine = null,
    sizeScale = null,
    displayMode = '1. Questions',
    optionSpacing = 'Default',
    imageBelowQuestion = false,
    optionsLayout = 'line',
}) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const rawOptions = extractOptionsIfMissing(q);
    let options = rawOptions.filter(opt => {
        const raw = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
        return raw.trim().length > 0;
    });
    if (options.length < 2) {
        const directOpts = [q.opt_a, q.opt_b, q.opt_c, q.opt_d, q.option_a, q.option_b, q.option_c, q.option_d].filter(o => o && String(o).trim().length > 0);
        if (directOpts.length >= 2) {
            options = directOpts;
        }
    }
    const labels = getQuestionOptionLabels(q, optionFormat);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    const hasAnyOptionImage = options.some(opt => {
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : (opt || ''));
        return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
    });

    const optGapPx = optionSpacing === 'No Spacing' ? '0px' :
                     optionSpacing === '5' ? '5px' :
                     optionSpacing === '10' ? '10px' :
                     optionSpacing === '15' ? '15px' : '3px';

    const effectivePerLine = Number(optionsPerLine) || (optionsLayout === '4' ? 4 : (optionsLayout === '2col' ? 2 : (optionsLayout === 'stacked' ? 1 : null)));
    const gridColsClass = effectivePerLine === 4 ? 'grid-cols-4' : effectivePerLine === 2 ? 'grid-cols-2' : (effectivePerLine === 1 ? 'grid-cols-1' : '');

    const getOptionsGridStyle = (forceSingle = false, isSide = false) => {
        if (effectivePerLine === 1 || forceSingle || optionsLayout === 'stacked') {
            return { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: optGapPx + ' 6px', marginTop: '3px', alignItems: 'start' };
        }
        if (effectivePerLine === 2 || optionsLayout === '2col') {
            return { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isTwoCol ? optGapPx + ' 6px' : optGapPx + ' 12px', marginTop: '3px', alignItems: 'start' };
        }
        if (effectivePerLine === 4) {
            return { display: 'grid', gridTemplateColumns: `repeat(${options.length || 4}, minmax(0, 1fr))`, gap: optGapPx + ' 8px', marginTop: '3px', alignItems: 'start' };
        }

        // Check if options are Match-the-Following mappings e.g. "p → (iv), q → (iii), r → (ii), s → (i)"
        const isMatchOptions = (options || []).some(opt => {
            const str = String(typeof opt === 'object' ? (opt.text || opt.option || '') : opt);
            return /(?:[p-sP-S]|[a-dA-D1-4])\s*[-–—:→\\]\s*\(?[0-9ivxIVX]+\)?/i.test(str);
        });

        if (isMatchOptions) {
            // In Single Column Paper (~720px width): 2x2 grid allows full mapping to fit on 1 clean unbroken line
            if (!isTwoCol && !isSide) {
                return { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: optGapPx + ' 16px', marginTop: '4px', alignItems: 'start' };
            }
            // In Double Column Paper or Side-by-Side: 1 column stacked ensures options never wrap awkwardly
            return { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: optGapPx + ' 4px', marginTop: '4px', alignItems: 'start' };
        }

        // Measure options
        const parsed = (options || []).map(opt => {
            const raw = String(typeof opt === 'object' ? (opt.text || opt.option || '') : opt).trim();
            const clean = raw.replace(/<[^>]+>/g, '').trim();
            const hasMath = /(\$|\\\(|\\\[|\\|\^|_)/i.test(clean);
            const isComplex = /\\(frac|dfrac|int|sum|matrix|begin|sqrt)/i.test(clean);
            return { len: clean.length, hasMath, isComplex };
        });
        const maxLen = Math.max(...parsed.map(p => p.len), 0);
        const hasComplex = parsed.some(p => p.isComplex);

        // When side-by-side with diagram: format short choices into 2 columns (saves 50% vertical space!)
        if (isSide) {
            if (maxLen <= 25 && !hasComplex && options.length <= 4) {
                return { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: optGapPx + ' 8px', marginTop: '3px', alignItems: 'start' };
            }
            return { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: optGapPx + ' 6px', marginTop: '3px', alignItems: 'start' };
        }

        // Strict conformance to Reference Image 5 (Double Column) & Image 4 (Single Column)
        if (!isTwoCol) {
            // SINGLE COLUMN PAPER (~720px width - Image 4 Reference):
            // Numbers, units, phrases up to 36 chars fit in 1 line (4 across) (Image 4 Q4, Q5, Q7)
            if (maxLen <= 36 && !hasComplex && options.length <= 4) {
                return { display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: optGapPx + ' 12px', marginTop: '3px', alignItems: 'start' };
            }
            // Long statements (> 36 chars) format in 2x2 grid (Image 4 Q2)
            return { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: optGapPx + ' 14px', marginTop: '3px', alignItems: 'start' };
        } else {
            // DOUBLE COLUMN PAPER (~340px column width - Image 5 Reference):
            // 1. Short scalar choices / numbers / years (<= 5 chars, e.g. 1961, 1971, 1, 2) -> 4 across in 1 line (Image 5 Q3, Q10, Q11)
            if (maxLen <= 5 && !hasComplex && options.length <= 4) {
                return { display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: optGapPx + ' 6px', marginTop: '3px', alignItems: 'start' };
            }
            // 2. Short / medium options (6-25 chars, e.g. diaphragm, copper-T, IVF-ET, Copper T-IUD) -> 2x2 grid (Image 5 Q1, Q9, Q12)
            if (maxLen <= 25 && !hasComplex && options.length <= 4) {
                return { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: optGapPx + ' 8px', marginTop: '3px', alignItems: 'start' };
            }
            // 3. Long statements / sentences (> 25 chars, e.g. Statement-A is correct...) -> 1 column stacked (Image 5 Q2, Q13)
            return { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: optGapPx + ' 6px', marginTop: '3px', alignItems: 'start' };
        }
    };

    const renderOptions = (forceSingle = false, isSide = false) => {
        if (displayMode === '5. Only Questions with No Options' || options.length === 0) return null;
        const isMatchOptions = (options || []).some(opt => {
            const str = String(typeof opt === 'object' ? (opt.text || opt.option || '') : opt);
            return /(?:[p-sP-S]|[a-dA-D1-4])\s*[-–—:→\\]\s*\(?[0-9ivxIVX]+\)?/i.test(str);
        });

        return (
            <div
                className={`options-container grid ${gridColsClass}`}
                style={getOptionsGridStyle(forceSingle, isSide)}
            >
                {options.map((opt, i) => {
                    const rawOpt = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
                    let optText = cleanOptionText(rawOpt);
                    if (isMatchOptions) {
                        // Prevent broken line breaks between pair mappings e.g. "r →" and "(ii)"
                        optText = optText.replace(/([p-sP-Sa-dA-D1-4\)])\s*([→\-–—\\])\s*(\(?[0-9ivxIVX]+\)?)/g, '$1\u00A0$2\u00A0$3');
                    }
                    const optHeight = q.customDiagramSizes?.['opt_' + i] || q.customOptionDiagramHeight || '60px';

                    const isAnswersMode = displayMode === '2. Questions with Answers' || displayMode === '3. Questions with Answers & Solutions';
                    const isCorrect = isAnswersMode && isOptionSelectedCorrect(i, q);
                    return (
                        <div
                            key={i}
                            style={{
                                ...Q.optRow,
                                flexDirection: 'row',
                                alignItems: hasAnyOptionImage ? 'center' : 'baseline',
                                textAlign: 'left',
                                gap: '4px',
                                ...(isCorrect ? {
                                    backgroundColor: '#dcfce7',
                                    color: '#15803d',
                                    borderRadius: '4px',
                                    padding: '1px 5px',
                                    fontWeight: 700,
                                } : {}),
                            }}
                        >
                            <span style={{ ...Q.optLbl, ...(isCorrect ? { color: '#15803d', fontWeight: 800 } : {}) }}>
                                ({getOptionLabelText(i, optionFormat, labels, classes)}){isCorrect ? ' ✓' : ''}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: isCorrect ? 700 : 400 }}>
                                <MathRenderer
                                    inline
                                    text={optText}
                                    questionId={qId}
                                    initialHeight={optHeight}
                                    customDiagramSizes={q.customDiagramSizes}
                                    isOption={true}
                                    sizeScale={sizeScale}
                                    optionIndex={i}
                                    onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || ('opt_' + i)) : undefined}
                                />
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderAnswerAndSolution = () => null;

    const effectiveAlign = String(imageBelowQuestion ? 'Below' : (imageAlignment || (shouldRenderSideBySide(q, isTwoCol, imageUrl) ? 'Right' : 'Below'))).toLowerCase();

    // 1. TOP ALIGNMENT (Diagram first, then Question Text, then Options)
    if (imageUrl && effectiveAlign === 'top') {
        return (
            <>
                <div style={{ textAlign: 'center', margin: '2px auto 6px', clear: 'both', maxWidth: sizeScale ? `${sizeScale}%` : '100%', display: 'block' }}>
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
                {renderOptions(false)}
                {renderAnswerAndSolution()}
            </>
        );
    }

    // 2. LEFT ALIGNMENT (Diagram on Left, Question + Options on Right)
    if (imageUrl && effectiveAlign === 'left') {
        return (
            <div>
                <div style={{ float: 'left', margin: '0 14px 8px 0', display: 'block', maxWidth: sizeScale ? `${sizeScale}%` : '45%' }}>
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
                <div>
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
                    {renderOptions(false, true)}
                    {renderAnswerAndSolution()}
                </div>
                <div style={{ clear: 'both' }} />
            </div>
        );
    }

    // 3. RIGHT ALIGNMENT (Question + Options on Left, Diagram on Right)
    if (imageUrl && effectiveAlign === 'right') {
        return (
            <div>
                <div style={{ float: 'right', margin: '0 0 8px 14px', display: 'block', maxWidth: sizeScale ? `${sizeScale}%` : '45%' }}>
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
                <div>
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
                    {renderOptions(false, true)}
                    {renderAnswerAndSolution()}
                </div>
                <div style={{ clear: 'both' }} />
            </div>
        );
    }

    // 4. BELOW / CENTER / DEFAULT
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
            {renderOptions(false)}
            {renderAnswerAndSolution()}
        </>
    );
}
