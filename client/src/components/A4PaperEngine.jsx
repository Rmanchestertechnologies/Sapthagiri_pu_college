/**
 * A4PaperEngine.jsx
 *
 * Professional High-Fidelity A4 Assessment & Assignment Engine
 *
 * Provides:
 *  - Continuous 100% Capacity A4 Document Flow (no artificial early cuts or empty page gaps)
 *  - Native @media print pagination with break-inside: avoid on every question block
 *  - 1-Column and 2-Column (NEET/CET/JEE Exam standard) layouts
 *  - Instructions Cover Page support (optional / standard for large tests)
 *  - Zoom & View controls
 */
import React, { useMemo } from 'react';
import QuestionBlock from './QuestionBlock';
import { InstructionCoverPage, PaperHeader, formatMarks, calcTotal } from './PaperRenderer';

export default function A4PaperEngine({
    paper,
    activeTemplate,
    isAssignment = false,
    settings,
    currentPage = 1,
    onPageChange,
    zoom = 100,
    fitMode = 'actual',
    singlePageMode = false,
    onDiagramResize,
}) {
    const questions = useMemo(() => paper?.questions || [], [paper]);
    const classes = useMemo(() => paper?.classes || [], [paper]);
    const totalMarks = useMemo(() => {
        if (paper?.pattern?.length) return paper.pattern.reduce((s, sec) => s + (sec.marks || 0), 0);
        return calcTotal(questions, classes);
    }, [paper, questions, classes]);

    const isAssignmentPaper = isAssignment || paper?.category === 'assignment' || (paper?.title && /assignment/i.test(paper.title));
    const showCover = !isAssignmentPaper && settings.showCoverPage === true;
    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + questions.length - 1);
    const visibleCount = Math.max(0, endQNo - startQNo + 1);
    const visibleQuestions = useMemo(() => questions.slice(0, visibleCount), [questions, visibleCount]);

    const zoomScale = (zoom || 100) / 100;
    const isTwoCol = settings.columns === 2;

    return (
        <div className="a4-engine-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* ── Document Container ── */}
            <div
                className="a4-print-document"
                style={{
                    transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease',
                    marginBottom: zoomScale !== 1 ? `${(zoomScale - 1) * 900}px` : '0px',
                    width: '794px',
                    maxWidth: '100%',
                }}
            >
                {/* ── Single Unified Question Paper Sheet ── */}
                <div className="a4-sheet-page a4-questions-page" style={{ position: 'relative' }}>
                    {/* Official Sapthagiri PU College Crest Watermark - Fixed across all pages in print and screen */}
                    <div 
                        className="a4-watermark-wrapper"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            pointerEvents: 'none',
                            zIndex: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <img 
                            src="/SapthagiriLogo.jpg" 
                            alt="College Crest Watermark" 
                            className="a4-watermark-logo"
                            style={{
                                width: '360px',
                                height: '360px',
                                objectFit: 'contain',
                                borderRadius: '50%',
                                opacity: 0.08,
                                display: 'block',
                                pointerEvents: 'none',
                            }}
                        />
                    </div>
                    <div
                        className="a4-page-content"
                        style={{
                            fontFamily: settings.fontFamily,
                            fontSize: settings.fontSize,
                            lineHeight: settings.lineHeight,
                            position: 'relative',
                            zIndex: 1
                        }}
                    >
                        {/* Primary Header at top of Page 1 */}
                        <div className="a4-primary-header-wrap">
                            <PaperHeader
                                title={paper?.title}
                                subject={paper?.subject}
                                classes={classes}
                                duration={paper?.duration}
                                totalMarks={totalMarks}
                                templateUrl={activeTemplate?.fileUrl}
                                isAssignment={isAssignment}
                            />
                        </div>

                        {/* ── Questions Flow Immediately On Page 1 (1 Column or 2 Columns) ── */}
                        <div
                            className="a4-questions-flow"
                            style={isTwoCol ? {
                                columnCount: 2,
                                columnGap: settings.columnGap || '20px',
                                columnRule: '1px solid #e0e0e0',
                            } : {}}
                        >
                            {visibleQuestions.map((q, idx) => {
                                const displayNum = startQNo + idx;
                                return (
                                    <div
                                        key={q._id || displayNum}
                                        className="question-print-item"
                                        style={{
                                            breakInside: 'avoid',
                                            WebkitColumnBreakInside: 'avoid',
                                            pageBreakInside: 'avoid',
                                            marginBottom: settings.questionSpacing || (isTwoCol ? '8px' : '10px'),
                                        }}
                                    >
                                        <QuestionBlock
                                            q={q}
                                            displayNum={displayNum}
                                            classes={classes}
                                            showMarks={settings.showMarks}
                                            singleColMode={!isTwoCol}
                                            isTwoCol={isTwoCol}
                                            fontSize={settings.fontSize}
                                            lineHeight={settings.lineHeight}
                                            formatMarks={formatMarks}
                                            extraStyle={{ marginBottom: '0px' }}
                                            diagramMaxHeight={settings.diagramMaxHeight}
                                            onDiagramResize={onDiagramResize}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* End of Paper Marker */}
                        <div className="a4-end-paper-marker">
                            *** End of {paper?.title || (isAssignment ? 'Assignment' : 'Question Paper')} ***
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CSS STYLES FOR ON-SCREEN AND PRINT ── */}
            <style>{`
                .a4-sheet-page {
                    width: 794px;
                    min-height: 1123px;
                    background: #ffffff;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                    margin: 0 auto 28px auto;
                    box-sizing: border-box;
                    position: relative;
                }
                .a4-cover-page {
                    page-break-after: always;
                    break-after: page;
                    margin-bottom: 24px;
                }
                .a4-page-content {
                    padding: ${settings.marginTop || '10mm'} ${settings.marginRight || '12mm'} ${settings.marginBottom || '10mm'} ${settings.marginLeft || '12mm'};
                    box-sizing: border-box;
                    color: #000000;
                    position: relative;
                    z-index: 1;
                }
                .a4-subtle-running-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1.5px solid #000;
                    padding-bottom: 4px;
                    margin-bottom: 10px;
                }
                .a4-page-bottom-marker {
                    margin-top: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1.5px solid #000;
                    padding-top: 4px;
                    font-size: 11px;
                    color: #222;
                }
                .a4-end-paper-marker {
                    text-align: center;
                    font-weight: 700;
                    font-size: 12px;
                    padding: 6px 0;
                    border-top: 1px solid #bbb;
                    margin-top: 12px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .question-print-item {
                    display: block !important;
                    width: 100% !important;
                    box-sizing: border-box;
                    position: relative;
                    z-index: 1;
                    orphans: 2;
                    widows: 2;
                }
                .math-renderer.inline-math {
                    display: inline !important;
                }
                .math-renderer.block-math,
                .math-renderer:has(.resizable-diagram-wrap) {
                    display: block !important;
                }
                .resizable-diagram-wrap {
                    width: 100% !important;
                    text-align: center !important;
                    margin: 2px 0 !important;
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                    position: relative;
                    z-index: 2;
                }
                .resizable-diagram-wrap img {
                    max-width: 100% !important;
                    height: auto !important;
                    background-color: #ffffff !important;
                    position: relative !important;
                    z-index: 2 !important;
                }
                .diagram-resize-toolbar {
                    display: flex !important;
                }
                .katex-display {
                    display: inline-block !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    max-width: 100% !important;
                    margin: 1px 4px !important;
                    text-align: left !important;
                    vertical-align: middle !important;
                }
                .katex-display > .katex {
                    text-align: left !important;
                }
                .katex {
                    text-rendering: auto !important;
                    font-size: 1em !important;
                }

                @media print {
                    .diagram-resize-toolbar,
                    .no-print {
                        display: none !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 10mm 12mm 10mm 12mm;
                    }
                    html, body {
                        background: #fff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Watermark in print: Fixed viewport background layer on every page */
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-watermark-wrapper,
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-watermark-wrapper * {
                        visibility: visible !important;
                    }
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-watermark-wrapper {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        pointer-events: none !important;
                        z-index: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-watermark-logo {
                        width: 340px !important;
                        height: 340px !important;
                        object-fit: contain !important;
                        border-radius: 50% !important;
                        opacity: 0.045 !important;
                        filter: grayscale(100%) !important;
                        display: block !important;
                        visibility: visible !important;
                        pointer-events: none !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* ── Target 1: Answer Key Print ── */
                    body.printing-answer-key .a4-engine-wrapper,
                    body.printing-answer-key .a4-print-document,
                    body.printing-answer-key .paper-renderer-wrapper,
                    body.printing-solution-key .a4-engine-wrapper,
                    body.printing-solution-key .a4-print-document,
                    body.printing-solution-key .paper-renderer-wrapper {
                        display: none !important;
                        height: 0 !important;
                        max-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }

                    body.printing-answer-key #print-target-answer-key,
                    body.printing-answer-key #print-target-answer-key * {
                        visibility: visible !important;
                    }
                    body.printing-answer-key #print-target-answer-key {
                        position: static !important;
                        top: auto !important;
                        left: auto !important;
                        width: 100% !important;
                        display: block !important;
                        overflow: visible !important;
                    }

                    /* ── Target 2: Solution Key Print ── */
                    body.printing-solution-key #print-target-solution-key,
                    body.printing-solution-key #print-target-solution-key * {
                        visibility: visible !important;
                    }
                    body.printing-solution-key #print-target-solution-key {
                        position: static !important;
                        top: auto !important;
                        left: auto !important;
                        width: 100% !important;
                        display: block !important;
                        overflow: visible !important;
                    }

                    /* ── Target 3: Question Paper Print (Default) ── */
                    body:not(.printing-answer-key) .a4-answer-key-modal,
                    body:not(.printing-solution-key) .a4-solution-key-modal {
                        display: none !important;
                    }
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-print-document,
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-print-document * {
                        visibility: visible !important;
                    }
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-print-document {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        transform: none !important;
                        overflow: visible !important;
                    }

                    .a4-sheet-page {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-height: auto !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    .a4-questions-page {
                        overflow: visible !important;
                    }
                    .a4-cover-page {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .a4-page-content {
                        padding: 0 !important;
                        overflow: visible !important;
                        position: relative !important;
                        z-index: 1 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .resizable-diagram-wrap {
                        margin: 2px auto !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .resizable-diagram-wrap img {
                        box-shadow: none !important;
                        outline: none !important;
                        border: none !important;
                        background-color: #ffffff !important;
                        position: relative !important;
                        z-index: 2 !important;
                    }
                    .question-print-item {
                        display: block !important;
                        width: 100% !important;
                        break-inside: auto !important;
                        orphans: 2 !important;
                        widows: 2 !important;
                        position: relative !important;
                        z-index: 1 !important;
                    }
                    .a4-questions-flow {
                        orphans: 2 !important;
                        widows: 2 !important;
                    }
                }
            `}</style>
        </div>
    );
}
