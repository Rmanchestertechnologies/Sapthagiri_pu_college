import React from 'react';
import MathRenderer from '../MathRenderer';
import ResizableDiagram from '../ResizableDiagram';
import { getQuestionOptionLabels, extractOptionsIfMissing } from '../../utils/sanitize';
import { Q, cleanOptionText, getOptionLabelText, harmonizeMatchCode, isOptionSelectedCorrect } from './layout';
import { cleanQuestionText, extractDiagramFromText, parseMatchFromText } from './parsing';

/**
 * Match the Following Body
 */
export function BodyMatchFollowing({
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
    const { introText, pairs: parsedPairs } = parseMatchFromText(q);
    let pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) ? q.matchPairs : parsedPairs;
    pairs = pairs.filter(p => p && ((p.left && p.left.trim()) || (p.right && p.right.trim())));
    if (pairs.length < 2 && parsedPairs.length >= 2) {
        pairs = parsedPairs.filter(p => p && ((p.left && p.left.trim()) || (p.right && p.right.trim())));
    }

    const optGapPx = optionSpacing === 'No Spacing' ? '0px' :
                     optionSpacing === '5' ? '5px' :
                     optionSpacing === '10' ? '10px' :
                     optionSpacing === '15' ? '15px' : '3px';
    const shouldHideOptions = hideOptions || displayMode === '5. Only Questions with No Options';

    const effectivePerLine = Number(optionsPerLine) || (optionsLayout === '4' ? 4 : (optionsLayout === '2col' ? 2 : (optionsLayout === 'stacked' ? 1 : (isTwoCol ? 2 : 4))));
    const gridColsClass = effectivePerLine === 4 ? 'grid-cols-4' : (effectivePerLine === 2 ? 'grid-cols-2' : 'grid-cols-1');

    // 1. Recover candidate options
    let rawCandidateOpts = [];
    if (Array.isArray(q.options) && q.options.length > 0) {
        rawCandidateOpts = q.options;
    } else if (q.match_options && typeof q.match_options === 'object') {
        const moArr = [q.match_options.A, q.match_options.B, q.match_options.C, q.match_options.D].filter(Boolean);
        if (moArr.length >= 2) rawCandidateOpts = moArr;
    }
    if (rawCandidateOpts.length < 2) {
        const extracted = extractOptionsIfMissing(q);
        if (extracted.length >= 2) rawCandidateOpts = extracted;
    }

    let opts = rawCandidateOpts.filter(opt => {
        const raw = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
        return raw.trim().length > 0;
    });

    const romanLabels = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
    const hasRomanOpts = opts.some(o => /[\-\s\(](?:i|ii|iii|iv|v|vi)\b/i.test(typeof o === 'object' ? (o.text || '') : String(o)));

    // 2. Validate if options are authentic combination mappings (e.g. A-P, A-(i), (a)-(iv), A \to 2)
    // If options are bogus single variables (e.g. ['x', 'x', 'x x', 'x^2']) or empty, synthesize authentic 4 combinations!
    const isAuthenticCombo = opts.length >= 2 && opts.some(opt => {
        const str = String(typeof opt === 'object' ? (opt.text || opt.option || '') : opt);
        return /[-–—:->\\]|\b(?:i{1,4}|iv|v|vi|p|q|r|s)\b/i.test(str);
    });

    if (!isAuthenticCombo && pairs.length >= 2) {
        const pairCount = pairs.length;
        const leftKeys = Array.from({ length: pairCount }, (_, idx) => String.fromCharCode(65 + idx));
        opts = [
            leftKeys.map((k, i) => `${k}-(${i + 1})`).join(', '),
            leftKeys.map((k, i) => `${k}-(${(i + 1) % pairCount + 1})`).join(', '),
            leftKeys.map((k, i) => `${k}-(${(i + 2) % pairCount + 1})`).join(', '),
            leftKeys.map((k, i) => `${k}-(${(i + 3) % pairCount + 1})`).join(', '),
        ];
    }
    const rawQText = cleanQuestionText(pairs.length > 0 ? (introText || '') : (q.questionText || q.question || ''))
        .replace(/(?:\*\*|\b)(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[\s\S]*$/i, '')
        .trim();
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const labels = getQuestionOptionLabels(q, optionFormat);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={qText.endsWith(':') || qText.endsWith('.') ? qText : `${qText}:`}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {imageUrl && (
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
            {pairs.length > 0 && (
                <div
                    className="match-grid-container grid grid-cols-2"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        margin: '4px 0 6px',
                        backgroundColor: '#ffffff'
                    }}
                >
                    {/* Header Row */}
                    <div style={{ borderRight: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', fontWeight: 800, padding: '4px 8px', fontSize: '11px', color: '#001f6d' }}>
                        Column I
                    </div>
                    <div style={{ backgroundColor: '#f1f5f9', fontWeight: 800, padding: '4px 8px', fontSize: '11px', color: '#001f6d' }}>
                        Column II
                    </div>

                    {/* Pair Rows */}
                    {pairs.map((pair, pi) => {
                        const leftVal = (pair.left || '').trim();
                        const rightVal = (pair.right || '').trim();
                        const letterLabel = String.fromCharCode(65 + pi);
                        const numberLabel = pi + 1;

                        return (
                            <React.Fragment key={pi}>
                                <div style={{
                                    padding: '4px 8px',
                                    borderTop: '1px solid #e2e8f0',
                                    borderRight: '1px solid #cbd5e1',
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: '6px',
                                    fontSize: '11px',
                                    lineHeight: 1.35
                                }}>
                                    {leftVal ? (
                                        <>
                                            <strong style={{ color: '#001f6d', minWidth: '22px' }}>({letterLabel})</strong>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <MathRenderer inline text={pair.left} />
                                            </span>
                                        </>
                                    ) : null}
                                </div>
                                <div style={{
                                    padding: '4px 8px',
                                    borderTop: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: '6px',
                                    fontSize: '11px',
                                    lineHeight: 1.35
                                }}>
                                    {rightVal ? (
                                        <>
                                            <strong style={{ color: '#001f6d', minWidth: '22px' }}>({numberLabel})</strong>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <MathRenderer inline text={pair.right} />
                                            </span>
                                        </>
                                    ) : null}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
            {!shouldHideOptions && opts.length > 0 && (
                <div
                    className={`options-container grid ${gridColsClass}`}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isTwoCol
                            ? 'repeat(2, minmax(0, 1fr))'
                            : (effectivePerLine === 1 ? 'minmax(0, 1fr)' : `repeat(${effectivePerLine}, minmax(0, 1fr))`),
                        gap: isTwoCol ? `${optGapPx} 6px` : `${optGapPx} 12px`,
                        marginTop: '4px',
                        alignItems: 'start',
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
                                    text={harmonizeMatchCode(cleanOptionText(typeof opt === 'object' ? (opt.text || opt.option || '') : opt))}
                                    questionId={qId}
                                    isOption={true}
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
