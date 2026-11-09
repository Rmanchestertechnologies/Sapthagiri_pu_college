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
import QuestionBlock, { formatOptionKey } from './QuestionBlock';
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
    onEditQuestion,
    onSwapQuestion,
    onQuestionLayoutChange,
}) {
    const examTypeStr = String(paper?.examType || paper?.exam_type || paper?.title || '').toUpperCase();
    const isExplicitNonJEE = examTypeStr.includes('NEET') ||
                             examTypeStr.includes('CET') ||
                             examTypeStr.includes('KCET') ||
                             String(paper?.subject || '').toUpperCase().includes('BOTANY') ||
                             String(paper?.subject || '').toUpperCase().includes('ZOOLOGY') ||
                             (paper?.questions && paper.questions.length !== 75);

    const isJEEPaper = !isExplicitNonJEE && Boolean(
        examTypeStr.includes('JEE') && (paper?.questions && paper.questions.length === 75)
    );

    const questions = useMemo(() => {
        const rawQs = paper?.questions || [];
        // Never slice or drop questions for ANY paper - if there are 60 questions, preserve all 60!
        if (!isJEEPaper) return rawQs;

        // Strictly enforce JEE Main PCM structure only when exactly 75 questions across 3 subjects exist
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

        const hasPCM = pcmBySub.Physics.length > 0 && pcmBySub.Chemistry.length > 0 && pcmBySub.Mathematics.length > 0;
        if (!hasPCM) return rawQs;

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

        return clamped.length === 75 ? clamped : rawQs;
    }, [paper, isJEEPaper]);
    const classes = useMemo(() => paper?.classes || [], [paper]);
    const totalMarks = useMemo(() => {
        // 1. Explicit user-defined Total Marks override takes highest priority across all paper types
        if (settings?.totalMarks !== undefined && settings?.totalMarks !== null && !isNaN(Number(settings.totalMarks))) {
            return Number(settings.totalMarks);
        }
        if (paper?.totalMarks !== undefined && paper?.totalMarks !== null && !isNaN(Number(paper.totalMarks))) {
            return Number(paper.totalMarks);
        }
        if (paper?.total_marks !== undefined && paper?.total_marks !== null && !isNaN(Number(paper.total_marks))) {
            return Number(paper.total_marks);
        }
        if (settings?.marksPerQuestion && !isNaN(Number(settings.marksPerQuestion))) {
            return questions.length * Number(settings.marksPerQuestion);
        }
        if (paper?.marksPerQuestion && !isNaN(Number(paper.marksPerQuestion))) {
            return questions.length * Number(paper.marksPerQuestion);
        }
        const rawType = String(paper?.examType || paper?.exam_type || '').toUpperCase();
        if (rawType.includes('CET')) return questions.length * 1;
        if (rawType.includes('NEET') || rawType.includes('JEE')) return questions.length * 4;
        if (paper?.pattern?.length) return paper.pattern.reduce((s, sec) => s + (sec.marks || 0), 0);
        return calcTotal(questions, classes, rawType);
    }, [paper, questions, classes, settings?.marksPerQuestion, settings?.totalMarks]);

    const isAssignmentPaper = isAssignment || paper?.category === 'assignment' || (paper?.title && /assignment/i.test(paper.title));
    const showCover = !isAssignmentPaper && settings.showCoverPage === true;
    const startQNo = settings.startQNo || 1;
    const endQNo = settings.endQNo ?? (startQNo + questions.length - 1);
    const rawVisibleCount = Math.max(0, endQNo - startQNo + 1);
    const visibleCount = (isJEEPaper && questions.length === 75) ? Math.min(75, rawVisibleCount) : rawVisibleCount;
    const visibleQuestions = useMemo(() => questions.slice(0, visibleCount), [questions, visibleCount]);

    const zoomScale = (zoom || 100) / 100;
    const isTwoCol = settings.columns === 2 || Boolean(settings.paper2Column);

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
                                duration={settings?.duration || (settings?.durationMinutes ? `${settings.durationMinutes} Minutes` : (paper?.duration || (paper?.duration_minutes ? `${paper.duration_minutes} Minutes` : '3 Hours 15 Minutes')))}
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
                            style={isTwoCol && settings.displayMode !== '6. Only Answers & Solutions' && settings.displayMode !== '7. Only Answers' ? {
                                columnCount: 2,
                                columnGap: settings.columnGap || '20px',
                                columnRule: '1px solid #e0e0e0',
                            } : {}}
                        >
                            {/* Mode 6: Only Answers & Solutions */}
                            {settings.displayMode === '6. Only Answers & Solutions' ? (
                                <div className="a4-only-solutions-flow" style={{ marginTop: '12px' }}>
                                    <div style={{ textAlign: 'center', borderBottom: '2px solid #001f6d', paddingBottom: '6px', marginBottom: '14px' }}>
                                        <h2 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', color: '#001f6d', margin: 0 }}>
                                            Answers & Detailed Solutions
                                        </h2>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>
                                            {paper?.title || 'Examination'} • Solutions Guide
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {visibleQuestions.map((q, idx) => (
                                            <div key={q._id || idx} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', breakInside: 'avoid' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                                    <span style={{ fontWeight: 900, color: '#001f6d', fontSize: '12px' }}>Q.{startQNo + idx}.</span>
                                                    <span style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                                                        Answer: Option ({formatOptionKey(q, settings.optionFormat)})
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11.5px', color: '#1e293b', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px 10px' }}>
                                                    <div style={{ fontWeight: 800, color: '#15803d', fontSize: '11px', marginBottom: '2px' }}>Solution:</div>
                                                    <MathRenderer inline text={q.solutionText || q.solution_text || q.solution || 'Detailed step-by-step verified solution.'} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : settings.displayMode === '7. Only Answers' ? (
                                /* Mode 7: Only Answers Grid */
                                <div className="a4-only-answers-flow" style={{ marginTop: '14px' }}>
                                    <div style={{ textAlign: 'center', borderBottom: '2px solid #001f6d', paddingBottom: '6px', marginBottom: '14px' }}>
                                        <h2 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', color: '#001f6d', margin: 0 }}>
                                            Answer Key Sheet
                                        </h2>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>
                                            {paper?.title || 'Examination'} • Final Answer Key
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', border: '1.5px solid #cbd5e1', padding: '10px', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                                        {visibleQuestions.map((q, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px' }}>
                                                <span style={{ fontWeight: 800, color: '#001f6d' }}>Q.{startQNo + idx}</span>
                                                <span style={{ fontWeight: 900, color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #86efac', padding: '1px 8px', borderRadius: '4px' }}>
                                                    ({formatOptionKey(q, settings.optionFormat)})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Standard Questions Flow (Modes 1, 2, 3, 4, 5) */
                                (() => {
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

                                    const qGap = settings.questionSpacing === 'No Spacing' ? '0px' :
                                                 settings.questionSpacing === '5' ? '5px' :
                                                 settings.questionSpacing === '10' ? '10px' :
                                                 settings.questionSpacing === '15' ? '15px' :
                                                 (isTwoCol ? '8px' : '10px');

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

                                        const isNumQ = (item) => {
                                            const t = (item?.type || item?.q_type || '').toUpperCase();
                                            return Boolean(item?.isNumerical) || t.includes('NUMERICAL') || t.includes('INTEGER') || t === 'NUM';
                                        };

                                        if (isJEE && questions.length === 75) {
                                            if (isSubjectChange) {
                                                showHeader = true;
                                                headerTitle = curSubject ? (curSubject.toUpperCase() + ' • PART A (SECTION A)') : 'PART A (SECTION A)';
                                                directiveText = 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.';
                                            } else if (subQIdx === 20) {
                                                showHeader = true;
                                                headerTitle = curSubject ? (curSubject.toUpperCase() + ' • PART B (SECTION B - NUMERICALS)') : 'PART B (SECTION B - NUMERICALS)';
                                                directiveText = 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.';
                                            }
                                        } else {
                                            if (isSubjectChange) {
                                                showHeader = true;
                                                headerTitle = 'SUBJECT: ' + curSubject.toUpperCase();
                                                directiveText = null;
                                            }
                                        }

                                        const effectiveQ = (isJEE && isNumQ(q)) ? {
                                            ...q,
                                            isNumerical: true,
                                            type: 'NUMERICAL',
                                            options: [],
                                            part: 'SECTION B - NUMERICAL VALUE QUESTIONS'
                                        } : {
                                            ...q,
                                            isNumerical: false,
                                            num_answer: null,
                                            type: (q.type === 'NUMERICAL' || q.q_type === 'numerical') ? (isJEE ? 'NUMERICAL' : 'MCQ') : (q.type || 'MCQ')
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
                                                        breakInside: settings.paper2ColumnQuestionBreak !== false ? 'avoid' : 'auto',
                                                        WebkitColumnBreakInside: settings.paper2ColumnQuestionBreak !== false ? 'avoid' : 'auto',
                                                        pageBreakInside: settings.paper2ColumnQuestionBreak !== false ? 'avoid' : 'auto',
                                                        marginBottom: qGap,
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
                                                        optionFormat={settings.optionFormat || '(1) (2) (3) (4)'}
                                                        formatMarks={formatMarks}
                                                        extraStyle={{ marginBottom: '0px' }}
                                                        diagramMaxHeight={settings.diagramMaxHeight}
                                                        onDiagramResize={onDiagramResize}
                                                        examType={paper?.examType || 'NEET'}
                                                        onEdit={onEditQuestion ? () => onEditQuestion(effectiveQ, idx, displayNum) : undefined}
                                                        onSwap={onSwapQuestion ? () => onSwapQuestion(effectiveQ, idx, displayNum) : undefined}
                                                        showQuestionNumbers={settings.showQuestionNumbers !== false}
                                                        imageBelowQuestion={Boolean(settings.imageBelowQuestion)}
                                                        paper2ColumnQuestionBreak={settings.paper2ColumnQuestionBreak !== false}
                                                        displayMode={settings.displayMode || '1. Questions'}
                                                        optionsLayout={settings.optionsLayout || 'line'}
                                                        optionSpacing={settings.optionSpacing || 'Default'}
                                                        questionSpacing={settings.questionSpacing || 'Default'}
                                                        onLayoutChange={onQuestionLayoutChange ? (changes) => onQuestionLayoutChange(idx, changes) : undefined}
                                                    />
                                                </div>
                                            </React.Fragment>
                                        );
                                    });
                                })()
                            )}
                        </div>

                        {/* End of Paper Marker */}
                        <div className="a4-end-paper-marker">
                            *** End of {paper?.title || (isAssignment ? 'Assignment' : 'Question Paper')} ***
                        </div>
                    </div>
                </div>

                {/* Mode 4: Questions after Answers & Solutions Sheet */}
                {settings.displayMode === '4. Questions after Answers & Solutions' && (
                    <div className="a4-sheet-page a4-solutions-page" style={{ position: 'relative', pageBreakBefore: 'always', breakBefore: 'page', marginTop: '28px' }}>
                        <div className="a4-page-content" style={{ fontFamily: settings.fontFamily, fontSize: '11px', lineHeight: '1.4', padding: '12mm' }}>
                            <div style={{ textAlign: 'center', borderBottom: '2px solid #001f6d', paddingBottom: '6px', marginBottom: '14px' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', color: '#001f6d', margin: 0 }}>
                                    Answers & Detailed Solutions
                                </h2>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>
                                    {paper?.title || 'Examination'} • Answer Key & Step-by-Step Solutions
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {visibleQuestions.map((q, idx) => (
                                    <div key={q._id || idx} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', breakInside: 'avoid' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                            <span style={{ fontWeight: 900, color: '#001f6d', fontSize: '12px' }}>Q.{startQNo + idx}.</span>
                                            <span style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                                                Answer: Option ({formatOptionKey(q, settings.optionFormat)})
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#1e293b', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px 10px' }}>
                                            <div style={{ fontWeight: 800, color: '#15803d', fontSize: '11px', marginBottom: '2px' }}>Solution:</div>
                                            <MathRenderer inline text={q.solutionText || q.solution_text || q.solution || 'Detailed step-by-step verified solution.'} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

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
                    padding: ${settings.marginTop || '5mm'} ${settings.marginRight || '8mm'} ${settings.marginBottom || '6mm'} ${settings.marginLeft || '8mm'};
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
                .math-renderer:has(.resizable-diagram-wrap:not(.is-option-diagram)) {
                    display: block !important;
                }
                .math-renderer:has(.resizable-diagram-wrap.is-option-diagram) {
                    display: inline-block !important;
                }
                .resizable-diagram-wrap:not(.is-option-diagram) {
                    width: 100% !important;
                    text-align: center !important;
                    margin: 2px 0 !important;
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                    position: relative;
                    z-index: 2;
                }
                .resizable-diagram-wrap.is-option-diagram {
                    display: inline-block !important;
                    max-width: 100% !important;
                    width: auto !important;
                    text-align: center !important;
                    margin: 2px auto !important;
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
                    /* 1. COMPLETELY COLLAPSE APP CHROME, BARS & SETTINGS */
                    header,
                    nav,
                    footer,
                    aside,
                    .no-print,
                    button,
                    .diagram-resize-toolbar,
                    [class*="SettingsPanel"],
                    [class*="action-bar"] {
                        display: none !important;
                        height: 0 !important;
                        max-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }

                    /* 2. RESET PAGE GEOMETRY & VIEWPORT */
                    @page {
                        size: A4 portrait;
                        margin: 5mm 8mm 6mm 8mm;
                    }

                    html, body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* 3. ZERO OUT ALL ANCESTORS BETWEEN BODY AND PRINT DOCUMENT */
                    #root,
                    #root > div,
                    .min-h-screen,
                    main,
                    main > div,
                    div[class*="space-y"],
                    div[class*="animate-fade-in"],
                    div[class*="flex justify-center"],
                    .paper-renderer-wrapper,
                    .a4-engine-wrapper {
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        position: static !important;
                        display: block !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        float: none !important;
                        clear: both !important;
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

                    body * {
                        visibility: hidden !important;
                    }

                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-print-document,
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-print-document * {
                        visibility: visible !important;
                    }

                    /* STATIC POSITIONING FOR A4 PRINT DOCUMENT - SITS CRISPLY AT (0,0) OF PAGE 1 */
                    body:not(.printing-answer-key):not(.printing-solution-key) .a4-print-document {
                        position: static !important;
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        transform: none !important;
                        overflow: visible !important;
                        visibility: visible !important;
                    }

                    .a4-sheet-page {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: auto !important;
                        height: auto !important;
                        overflow: visible !important;
                        background: transparent !important;
                    }

                    .a4-page-content {
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        position: static !important;
                        font-family: var(--paper-font-family) !important;
                        font-size: var(--paper-font-size) !important;
                        line-height: var(--paper-line-height) !important;
                    }

                    .a4-primary-header-wrap {
                        margin-top: 0 !important;
                        padding-top: 0 !important;
                    }

                    .a4-primary-header-wrap > div {
                        margin-top: 0 !important;
                        padding-top: 0 !important;
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
