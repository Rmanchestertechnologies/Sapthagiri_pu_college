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
import MathRenderer from './MathRenderer';
import { InstructionCoverPage, PaperHeader, formatMarks, calcTotal } from './PaperRenderer';

// Canonical subject normalizer (strictly maps variations of Maths/Phy/Chem/Bio to canonical names)
const normalizeSubjectName = (sub) => {
    if (!sub) return 'General';
    const s = String(sub).trim().toLowerCase();
    if (s.includes('math')) return 'Mathematics';
    if (s.includes('physic') || s === 'phy') return 'Physics';
    if (s.includes('chem')) return 'Chemistry';
    if (s.includes('botan')) return 'Botany';
    if (s.includes('zool')) return 'Zoology';
    if (s.includes('bio')) return 'Biology';
    return sub.trim();
};

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
    const examTypeStr = String(paper?.examType || paper?.exam_type || paper?.title || '').toUpperCase();
    const isExplicitNonJEE = examTypeStr.includes('NEET') ||
                             examTypeStr.includes('CET') ||
                             examTypeStr.includes('KCET') ||
                             String(paper?.subject || '').toUpperCase().includes('BOTANY') ||
                             String(paper?.subject || '').toUpperCase().includes('ZOOLOGY') ||
                             (paper?.questions && paper.questions.length > 85);

    const isJEEPaper = !isExplicitNonJEE && Boolean(
        examTypeStr.includes('JEE') ||
        (Array.isArray(paper?.classes) && paper.classes.some(c => String(c).toUpperCase().includes('JEE'))) ||
        (paper?.questions && paper.questions.length >= 70 && paper.questions.length <= 85)
    );

    const questions = useMemo(() => {
        const rawQs = paper?.questions || [];
        if (!isJEEPaper) return rawQs;

        // Strictly enforce JEE Main PCM structure: exactly max 20 Section A + max 5 Section B per subject (Physics, Chemistry, Mathematics)
        const pcmBySub = {
            Physics: [],
            Chemistry: [],
            Mathematics: []
        };
        rawQs.forEach(q => {
            const norm = normalizeSubjectName(q.sectionSubject || q.subject || '');
            if (pcmBySub[norm]) {
                pcmBySub[norm].push(q);
            } else {
                pcmBySub['Mathematics'].push(q);
            }
        });

        const clamped = [];
        ['Physics', 'Chemistry', 'Mathematics'].forEach(s => {
            const list = pcmBySub[s] || [];
            const isNum = (q) => {
                const t = (q.type || q.q_type || '').toUpperCase();
                return Boolean(q.isNumerical) || t.includes('NUMERICAL') || t.includes('INTEGER') || t === 'NUM' ||
                       (q.part && q.part.toUpperCase().includes('NUMERICAL')) ||
                       (q.part && q.part.toUpperCase().includes('SECTION B')) ||
                       (q.part && q.part.toUpperCase().includes('SECTION-B'));
            };
            const secA = list.filter(q => !isNum(q)).slice(0, 20).map(q => ({
                ...q,
                subject: s,
                sectionSubject: s,
                isNumerical: false,
                part: 'SECTION A - MULTIPLE CHOICE QUESTIONS'
            }));
            const secB = list.filter(q => isNum(q)).slice(0, 5).map(q => ({
                ...q,
                subject: s,
                sectionSubject: s,
                isNumerical: true,
                type: 'NUMERICAL',
                options: [],
                part: 'SECTION B - NUMERICAL VALUE QUESTIONS'
            }));
            clamped.push(...secA, ...secB);
        });

        const finalClamped = clamped.slice(0, 75);
        return finalClamped.length > 0 ? finalClamped : rawQs.slice(0, 75);
    }, [paper, isJEEPaper]);
    const classes = useMemo(() => paper?.classes || [], [paper]);
    const totalMarks = useMemo(() => {
        if (paper?.pattern?.length) return paper.pattern.reduce((s, sec) => s + (sec.marks || 0), 0);
        return calcTotal(questions, classes);
    }, [paper, questions, classes]);

    const isAssignmentPaper = isAssignment || paper?.category === 'assignment' || (paper?.title && /assignment/i.test(paper.title));
    const showCover = !isAssignmentPaper && settings.showCoverPage === true;
    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + questions.length - 1);
    const rawVisibleCount = Math.max(0, endQNo - startQNo + 1);
    const visibleCount = isJEEPaper ? Math.min(75, rawVisibleCount) : rawVisibleCount;
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
                    {/* Official Sapthagiri PU College Circular Emblem Watermark - Fixed across all pages */}
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
                            alt="Sapthagiri PU College Crest Watermark" 
                            className="a4-watermark-logo"
                            style={{
                                width: '380px',
                                height: 'auto',
                                maxHeight: '380px',
                                objectFit: 'contain',
                                opacity: 0.08,
                                filter: 'grayscale(100%)',
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
                                setName={paper?.setName || 'P'}
                                headerConfig={paper?.headerConfig}
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
                            {(() => {
                                // Precalculate index within subject for each question
                                let runningSub = '';
                                let subQuestionIndex = 0;
                                const subjectQuestionIndices = visibleQuestions.map((q) => {
                                    const s = normalizeSubjectName(q.sectionSubject || q.subject || '').toLowerCase();
                                    if (s !== runningSub) {
                                        runningSub = s;
                                        subQuestionIndex = 0;
                                    } else {
                                        subQuestionIndex++;
                                    }
                                    return subQuestionIndex;
                                });

                                return visibleQuestions.map((q, idx) => {
                                    const displayNum = startQNo + idx;
                                    const isJEE = isJEEPaper;
                                    const subQIdx = subjectQuestionIndices[idx];

                                    const curSubject = normalizeSubjectName(q.sectionSubject || q.subject || '');
                                    const prevSubject = idx > 0 ? normalizeSubjectName(visibleQuestions[idx - 1].sectionSubject || visibleQuestions[idx - 1].subject || '') : '';
                                    const isSubjectChange = Boolean(curSubject && prevSubject && curSubject.toLowerCase() !== prevSubject.toLowerCase());

                                    let showHeader = false;
                                    let headerTitle = '';
                                    let directiveText = null;

                                    if (isJEE) {
                                        if (isSubjectChange || idx === 0) {
                                            showHeader = true;
                                            headerTitle = curSubject ? `${curSubject.toUpperCase()} • PART A (SECTION A)` : 'PART A (SECTION A)';
                                            directiveText = 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.';
                                        } else if (subQIdx === 20) {
                                            showHeader = true;
                                            headerTitle = curSubject ? `${curSubject.toUpperCase()} • PART B (SECTION B - NUMERICALS)` : 'PART B (SECTION B - NUMERICALS)';
                                            directiveText = 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.';
                                        }
                                    } else {
                                        // Multi-subject exam (NEET, CET, KCET, Composite):
                                        const isMultiSubject = Boolean(
                                            (paper?.subject && (paper.subject.includes('•') || paper.subject.includes(','))) ||
                                            (paper?.questions && paper.questions.length > 50)
                                        );
                                        if (isSubjectChange || (idx === 0 && isMultiSubject && curSubject)) {
                                            showHeader = true;
                                            headerTitle = `SUBJECT: ${curSubject.toUpperCase()}`;
                                            directiveText = null;
                                        }
                                    }

                                    const effectiveQ = isJEE ? {
                                        ...q,
                                        isNumerical: subQIdx >= 20,
                                        type: (subQIdx >= 20) ? 'NUMERICAL' : (q.type || 'MCQ'),
                                        options: (subQIdx >= 20) ? [] : (q.options || []),
                                        part: (subQIdx >= 20) ? 'SECTION B - NUMERICAL VALUE QUESTIONS' : 'SECTION A - MULTIPLE CHOICE QUESTIONS'
                                    } : {
                                        ...q,
                                        isNumerical: false,
                                        num_answer: null,
                                        type: (q.type === 'NUMERICAL' || q.q_type === 'numerical') ? 'MCQ' : (q.type || 'MCQ')
                                    };

                                    return (
                                        <React.Fragment key={q._id || displayNum}>
                                            {showHeader && (
                                                <div
                                                    className="part-header-directive-block"
                                                    style={{
                                                        margin: idx === 0 ? '4px 0 10px 0' : '16px 0 10px 0',
                                                        padding: '6px 12px',
                                                        backgroundColor: '#f8fafc',
                                                        borderLeft: '4px solid #001f6d',
                                                        borderTop: '1px solid #cbd5e1',
                                                        borderBottom: '1px solid #cbd5e1',
                                                        breakInside: 'avoid',
                                                        pageBreakInside: 'avoid',
                                                        breakAfter: 'avoid',
                                                        columnSpan: isTwoCol ? 'all' : 'none',
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', color: '#001f6d', letterSpacing: '0.04em' }}>
                                                        {headerTitle}
                                                    </div>
                                                    {directiveText && (
                                                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#334155', marginTop: '2px', fontStyle: 'italic', whiteSpace: 'pre-line' }}>
                                                            {directiveText}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div
                                                className="question-print-item"
                                                style={{
                                                    breakInside: 'avoid',
                                                    WebkitColumnBreakInside: 'avoid',
                                                    pageBreakInside: 'avoid',
                                                    marginBottom: settings.questionSpacing || (isTwoCol ? '8px' : '10px'),
                                                }}
                                            >
                                                <QuestionBlock
                                                    q={effectiveQ}
                                                    displayNum={displayNum}
                                                    classes={classes}
                                                    showMarks={settings.showMarks}
                                                    singleColMode={!isTwoCol}
                                                    isTwoCol={isTwoCol}
                                                    fontSize={settings.fontSize}
                                                    lineHeight={settings.lineHeight}
                                                    optionFormat={settings.optionFormat || 'numeric'}
                                                    formatMarks={formatMarks}
                                                    extraStyle={{ marginBottom: '0px' }}
                                                    diagramMaxHeight={settings.diagramMaxHeight}
                                                    onDiagramResize={onDiagramResize}
                                                    examType={paper?.examType || 'NEET'}
                                                />
                                            </div>
                                        </React.Fragment>
                                    );
                                });
                            })()}
                        </div>

                        {/* End of Paper Marker */}
                        <div className="a4-end-paper-marker">
                            *** End of {paper?.title || (isAssignment ? 'Assignment' : 'Question Paper')} ***
                        </div>
                    </div>
                </div>

                {/* Optional Scheme of Valuation Sheet on Last Page */}
                {(paper?.includeSchemeOnLastPage || settings?.includeSchemeOnLastPage) && (
                    <div className="a4-sheet-page a4-scheme-page" style={{ position: 'relative', pageBreakBefore: 'always', breakBefore: 'page', marginTop: '28px' }}>
                        <div className="a4-page-content" style={{ fontFamily: settings.fontFamily, fontSize: '11px', lineHeight: '1.4', padding: '12mm' }}>
                            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '14px' }}>
                                <div style={{ fontSize: '17px', fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>
                                    {paper?.headerConfig?.collegeName || 'SAPTHAGIRI PU COLLEGE'}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#001f6d', marginTop: '2px' }}>
                                    SCHEME OF VALUATION & ANSWER KEY
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#333', marginTop: '2px' }}>
                                    {paper?.title || 'EXAMINATION'} • Subject: {paper?.subject} • Max Marks: {totalMarks}
                                </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000' }}>
                                        <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', width: '50px', textAlign: 'center', fontWeight: 800 }}>Q.No</th>
                                        <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', width: '90px', textAlign: 'center', fontWeight: 800 }}>Part / Key</th>
                                        <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', fontWeight: 800 }}>Valuation Criteria / Steps / Key Solution</th>
                                        <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', width: '60px', textAlign: 'center', fontWeight: 800 }}>Marks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleQuestions.map((q, qIdx) => {
                                        const num = startQNo + qIdx;
                                        const key = q.answer || q.correct_option || '-';
                                        const m = q.marks || (formatMarks(q.type, classes).replace(/\D+/g, '') || '1');
                                        return (
                                            <tr key={q._id || num} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>
                                                    {num}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 800, color: '#001f6d' }}>
                                                    {q.part ? `${q.part} (${key})` : key}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>
                                                    {q.solutionText ? (
                                                        <MathRenderer text={q.solutionText} />
                                                    ) : (
                                                        <span>Correct Option / Standard step marks ({key})</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 800 }}>
                                                    {m}M
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ── CSS STYLES FOR ON-SCREEN AND PRINT ── */}
            <style>{`
                :root {
                    --paper-font-family: ${settings.fontFamily || '"Times New Roman", Times, Georgia, serif'};
                    --paper-font-size: ${settings.fontSize || '13px'};
                    --paper-line-height: ${settings.lineHeight || '1.42'};
                }
                .a4-sheet-page {
                    width: 794px;
                    min-height: 1123px;
                    background: #ffffff;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                    margin: 0 auto 28px auto;
                    box-sizing: border-box;
                    position: relative;
                    font-family: var(--paper-font-family) !important;
                    font-size: var(--paper-font-size) !important;
                    line-height: var(--paper-line-height) !important;
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
                    font-family: var(--paper-font-family) !important;
                    font-size: var(--paper-font-size) !important;
                    line-height: var(--paper-line-height) !important;
                }
                .question-block {
                    font-size: var(--paper-font-size) !important;
                    font-family: var(--paper-font-family) !important;
                    line-height: var(--paper-line-height) !important;
                }
                .question-block .math-renderer {
                    font-size: 1em !important;
                }
                .question-block strong,
                .question-block b {
                    font-family: inherit;
                    color: #000000;
                }
                /* Ensure digits/numbers don't turn italic, while preserving scientific/biological nomenclature */
                .katex .mord:not(.mathnormal) {
                    font-style: normal !important;
                }
                i.scientific-name, em.scientific-name,
                i.binomial-name, em.binomial-name,
                .scientific-name, .binomial-name {
                    font-style: italic !important;
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
                    background-color: transparent !important;
                    mix-blend-mode: multiply !important;
                    position: relative !important;
                    z-index: 2 !important;
                }
                .diagram-resize-toolbar {
                    display: flex !important;
                }
                .katex-display, .katex, .math-renderer {
                    display: inline-block !important;
                    overflow: visible !important;
                    max-width: 100% !important;
                    margin: 1px 4px !important;
                    text-align: left !important;
                    vertical-align: middle !important;
                    scrollbar-width: none !important;
                    -ms-overflow-style: none !important;
                }
                .katex-display::-webkit-scrollbar,
                .katex::-webkit-scrollbar,
                .math-renderer::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                }
                .katex-display > .katex {
                    text-align: left !important;
                }
                .katex {
                    text-rendering: auto !important;
                    font-size: 1em !important;
                }
                /* Suppress formula extender handles or slider widgets */
                .formula-extender,
                .formula-handle,
                .math-extender,
                .katex-extender,
                .math-slider-handle {
                    display: none !important;
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
                        width: 360px !important;
                        height: auto !important;
                        max-height: 360px !important;
                        object-fit: contain !important;
                        opacity: 0.075 !important;
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
                        font-family: var(--paper-font-family) !important;
                        font-size: var(--paper-font-size) !important;
                        line-height: var(--paper-line-height) !important;
                    }
                    .question-block {
                        font-size: var(--paper-font-size) !important;
                        font-family: var(--paper-font-family) !important;
                        line-height: var(--paper-line-height) !important;
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
                        background-color: transparent !important;
                        mix-blend-mode: multiply !important;
                        position: relative !important;
                        z-index: 2 !important;
                    }
                    .question-print-item {
                        display: block !important;
                        width: 100% !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-column-break-inside: avoid !important;
                        orphans: 3 !important;
                        widows: 3 !important;
                        position: relative !important;
                        z-index: 1 !important;
                    }
                    .part-header-directive-block {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        break-after: avoid !important;
                    }
                    .a4-scheme-page {
                        page-break-before: always !important;
                        break-before: page !important;
                        box-shadow: none !important;
                        border: none !important;
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
