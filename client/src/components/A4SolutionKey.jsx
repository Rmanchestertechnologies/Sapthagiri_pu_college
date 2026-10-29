import React, { useState, useMemo } from 'react';
import MathRenderer from './MathRenderer';
import { getResolvedAnswerLabel, getQuestionOptionLabels, isOptionCorrect, cleanOptionText } from '../utils/sanitize';
import { generatePaperSet } from '../utils/pqrsGenerator';

export default function A4SolutionKey({
    paper = {},
    questions = [],
    startQNo = 1,
    setName = 'P',
    onClose,
}) {
    const [activeSet, setActiveSet] = useState(setName || paper?.setName || 'P');
    const [zoom, setZoom] = useState(100);

    // Sync activeSet if setName prop changes
    React.useEffect(() => {
        if (setName) setActiveSet(setName);
    }, [setName]);

    const baseQuestions = useMemo(() => {
        return (questions && questions.length > 0) ? questions : (paper?.questions || []);
    }, [questions, paper]);

    const activePaper = useMemo(() => {
        const effectivePaper = {
            ...paper,
            _id: paper?._id || paper?.id || 'qp-default',
            questions: baseQuestions
        };
        if (!effectivePaper.questions || effectivePaper.questions.length === 0) return effectivePaper;
        return generatePaperSet(effectivePaper, activeSet);
    }, [paper, baseQuestions, activeSet]);

    const resolvedQuestions = useMemo(() => {
        const baseList = (activePaper?.questions && activePaper.questions.length > 0)
            ? activePaper.questions
            : baseQuestions;
        const examTypeStr = String(paper?.examType || paper?.exam_type || paper?.title || '').toUpperCase();
        const isExplicitNonJEE = examTypeStr.includes('NEET') ||
                                 examTypeStr.includes('CET') ||
                                 examTypeStr.includes('KCET') ||
                                 String(paper?.subject || '').toUpperCase().includes('BOTANY') ||
                                 String(paper?.subject || '').toUpperCase().includes('ZOOLOGY') ||
                                 (baseList.length > 85);

        const isJEE = !isExplicitNonJEE && Boolean(
            examTypeStr.includes('JEE') ||
            (Array.isArray(paper?.classes) && paper.classes.some(c => String(c).toUpperCase().includes('JEE'))) ||
            (baseList.length >= 70 && baseList.length <= 85)
        );
        return isJEE ? baseList.slice(0, 75) : baseList;
    }, [activePaper, baseQuestions, paper]);

    const paperTitle = activePaper?.title || paper.title || `${paper.subject || 'Academic'} Assessment`;

    const handlePrint = () => {
        document.body.classList.add('printing-solution-key');
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('printing-solution-key');
            }, 300);
        }, 150);
    };

    return (
        <div className="a4-solution-key-modal fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="a4-solution-key-card bg-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto border border-slate-200 animate-fade-in">
                
                {/* ── Action Toolbar (Hidden during print) ── */}
                <div className="flex flex-wrap justify-between items-center px-6 py-4 bg-white border-b border-gray-200 gap-3 no-print">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-gold uppercase tracking-widest bg-navy px-3 py-1 rounded-full">
                            A4 Print & Export View
                        </span>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                            <span className="text-[10px] font-black text-navy uppercase px-1.5">Set:</span>
                            {['P', 'Q', 'R', 'S'].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setActiveSet(s)}
                                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black transition cursor-pointer ${
                                        activeSet === s
                                            ? 'bg-navy text-gold shadow-sm'
                                            : 'bg-white text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <h3 className="text-sm font-black text-navy uppercase tracking-tight">
                            SET {activeSet} Detailed Solutions ({resolvedQuestions.length} Qs)
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Zoom Controls */}
                        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                            <button
                                onClick={() => setZoom(z => Math.max(60, z - 15))}
                                className="px-2 py-0.5 text-xs font-black text-gray-700 hover:bg-white rounded-lg transition"
                                title="Zoom Out"
                            >
                                −
                            </button>
                            <span className="text-xs font-bold text-navy px-1">{zoom}%</span>
                            <button
                                onClick={() => setZoom(z => Math.min(150, z + 15))}
                                className="px-2 py-0.5 text-xs font-black text-gray-700 hover:bg-white rounded-lg transition"
                                title="Zoom In"
                            >
                                +
                            </button>
                            <button
                                onClick={() => setZoom(100)}
                                className="px-2 py-0.5 text-[10px] font-bold bg-white text-gray-700 rounded-lg shadow-sm cursor-pointer"
                            >
                                Reset
                            </button>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🖨️</span> Print Set {activeSet} Solutions
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            title="Open print dialog and choose Save as PDF"
                        >
                            <span>📥</span> Download PDF
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-red-500 bg-gray-100 hover:bg-gray-200 rounded-xl w-9 h-9 flex items-center justify-center text-sm font-black transition cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* ── A4 Sheet Preview Area (Expands seamlessly to enclose 100% of questions) ── */}
                <div className="a4-solution-key-body flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-300/80 min-h-0">
                    <div className="mx-auto w-full max-w-[794px]">
                        <div
                            id="print-target-solution-key"
                            className="a4-solution-key-sheet bg-white shadow-2xl rounded-2xl p-6 sm:p-10 w-full text-slate-800 space-y-6 border border-slate-300 relative"
                            style={{
                                minHeight: 'auto',
                                boxSizing: 'border-box',
                                fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                                transform: zoom === 100 ? 'none' : `scale(${zoom / 100})`,
                                transformOrigin: 'top center',
                            }}
                        >
                            {/* Official Sapthagiri PU College Crest Watermark - Non-intrusive background layer */}
                            <div 
                                className="a4-watermark-wrapper pointer-events-none select-none"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    overflow: 'hidden',
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
                                        width: '340px',
                                        height: '340px',
                                        objectFit: 'contain',
                                        borderRadius: '50%',
                                        opacity: 0.045,
                                        filter: 'grayscale(100%)',
                                        display: 'block',
                                        pointerEvents: 'none',
                                    }}
                                />
                            </div>

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                {/* ── College Header ── */}
                                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <img
                                            src="/SapthagiriLogo.jpg"
                                            alt="Sapthagiri PU College"
                                            className="w-14 h-14 object-contain rounded-full border border-slate-200 shadow-xs"
                                            onError={e => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <div className="text-left">
                                            <h1 className="text-xl sm:text-2xl font-black text-navy uppercase tracking-tight leading-tight">
                                                Sapthagiri Pre University College
                                            </h1>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                                Davanagere • The Land of Opportunity
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs font-semibold text-slate-700">
                                        <span className="font-bold text-navy">{paperTitle}</span>
                                        <span>SET: <strong>{activeSet}</strong></span>
                                        {paper.subject && <span>Subject: <strong>{paper.subject}</strong></span>}
                                        <span>Total Questions: <strong>{resolvedQuestions.length}</strong></span>
                                    </div>
                                    <div className="mt-1 text-center">
                                        <span className="inline-block bg-slate-900 text-amber-400 font-bold text-[11px] uppercase tracking-widest px-4 py-0.5 rounded-full">
                                            Detailed Solutions Guide
                                        </span>
                                    </div>
                                </div>

                                {/* ── Questions & Explanations Flow ── */}
                                <div className="space-y-6">
                                    {resolvedQuestions.map((q, idx) => {
                                        const currentQNo = q.setQNo || (startQNo + idx);
                                        const answerLabel = getResolvedAnswerLabel(q);
                                        const labels = getQuestionOptionLabels(q);
                                        const qText = q.questionText || q.question || '';
                                        const diagramImg = q.imageUrl || q.image_url;
                                        const explanation = q.solutionText || q.solution_text || q.solution || q.explanation || '';
                                        const options = Array.isArray(q.options) ? q.options : [];
                                        const qType = String(q.type || q.q_type || '').toUpperCase();
                                        const isNumerical = qType.includes('NUMERICAL') || qType.includes('INTEGER') || Boolean(q.isNumerical) || (q.num_answer !== undefined && q.num_answer !== null && q.num_answer !== '');
                                        const isAssertion = qType.includes('ASSERTION') || (/Assertion\s*(?:\(A\))?/i.test(qText) && /Reason\s*(?:\(R\))?/i.test(qText));

                                        // Extract assertion / reason if applicable
                                        let assertion = '';
                                        let reason = '';
                                        if (isAssertion) {
                                            const aMatch = qText.match(/Assertion\s*(?:\(A\))?\s*[:\-]?\s*([\s\S]*?)(?=Reason\s*(?:\(R\))?[:\-]|$)/i);
                                            const rMatch = qText.match(/Reason\s*(?:\(R\))?\s*[:\-]?\s*([\s\S]*)$/i);
                                            assertion = aMatch ? aMatch[1].trim() : qText;
                                            reason = rMatch ? rMatch[1].trim() : '';
                                        }

                                        // Match the following pairs if applicable
                                        const matchPairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0)
                                            ? q.matchPairs
                                            : (Array.isArray(q.column_a) && Array.isArray(q.column_b) && q.column_a.length > 0)
                                                ? q.column_a.map((left, pi) => ({ left, right: q.column_b[pi] || '' }))
                                                : [];

                                        return (
                                            <div
                                                key={idx}
                                                className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-3"
                                                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                            >
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="font-bold text-sm text-navy">
                                                        Question {currentQNo}
                                                    </span>
                                                    {isNumerical ? (
                                                        <span className="bg-blue-100 text-blue-900 text-xs font-black px-3 py-1 rounded-md border border-blue-200">
                                                            Correct Value: {q.num_answer ?? q.answer ?? 'N/A'}
                                                        </span>
                                                    ) : (
                                                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-md border border-emerald-200">
                                                            Correct Answer: ({answerLabel})
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Question Text / Assertion-Reason Structure */}
                                                {isAssertion && assertion ? (
                                                    <div className="space-y-1.5 text-xs text-slate-800">
                                                        <div className="line-relaxed">
                                                            <strong className="text-navy mr-1.5">Assertion (A):</strong>
                                                            <MathRenderer inline text={assertion} />
                                                        </div>
                                                        {reason && (
                                                            <div className="line-relaxed">
                                                                <strong className="text-navy mr-1.5">Reason (R):</strong>
                                                                <MathRenderer inline text={reason} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-800 font-normal leading-relaxed">
                                                        <MathRenderer inline text={qText} />
                                                    </div>
                                                )}

                                                {/* Match the Following Pairs Table if present */}
                                                {matchPairs.length > 0 && (
                                                    <div className="my-2 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                                                        <div className="grid grid-cols-2 bg-slate-100 font-black text-[11px] text-navy px-3 py-1.5 border-b border-slate-200 uppercase">
                                                            <span>Column I</span>
                                                            <span>Column II</span>
                                                        </div>
                                                        <div className="divide-y divide-slate-100">
                                                            {matchPairs.map((p, pi) => (
                                                                <div key={pi} className="grid grid-cols-2 px-3 py-1.5 text-[11px]">
                                                                    <div className="pr-2 flex items-start gap-1.5">
                                                                        <strong className="text-navy">({String.fromCharCode(65 + pi)})</strong>
                                                                        <MathRenderer inline text={typeof p === 'object' ? (p.left || '') : String(p)} />
                                                                    </div>
                                                                    <div className="pl-2 border-l border-slate-100 flex items-start gap-1.5">
                                                                        <strong className="text-navy">({pi + 1})</strong>
                                                                        <MathRenderer inline text={typeof p === 'object' ? (p.right || '') : ''} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Diagram if present */}
                                                {diagramImg && (
                                                    <div className="my-2 max-w-xs mx-auto border border-slate-200 rounded-lg p-1 bg-white">
                                                        <img
                                                            src={diagramImg}
                                                            alt={`Q${currentQNo} Diagram`}
                                                            className="max-h-36 object-contain mx-auto"
                                                            onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Options summary (only for non-numerical) */}
                                                {!isNumerical && options.length > 0 && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-600">
                                                        {options.map((opt, oi) => {
                                                            const isCorrect = isOptionCorrect(q, oi);
                                                            const optText = cleanOptionText(typeof opt === 'object' ? (opt.text || opt.option || '') : String(opt || ''));
                                                            return (
                                                                <div
                                                                    key={oi}
                                                                    className={`p-1.5 rounded flex items-start gap-1.5 ${
                                                                        isCorrect
                                                                            ? 'bg-emerald-50 text-emerald-900 font-medium border border-emerald-200'
                                                                            : 'bg-white border border-slate-100'
                                                                    }`}
                                                                >
                                                                    <span className="font-semibold">({labels[oi] || String.fromCharCode(65 + oi)})</span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <MathRenderer inline text={optText} />
                                                                    </div>
                                                                    {isCorrect && <span className="text-emerald-700 font-bold">✓</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Explanation Box with full KaTeX Math Rendering & Step-by-Step line breaks */}
                                                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                                                    <span className="font-bold text-navy block uppercase text-[10px] tracking-wider">Step-by-Step Solution & Explanation:</span>
                                                    {explanation ? (
                                                        <div className="leading-relaxed text-slate-800" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                            <MathRenderer text={explanation} />
                                                        </div>
                                                    ) : (
                                                        <p className="text-slate-400 italic text-[11px]">
                                                            {isNumerical ? `The verified answer is ${q.num_answer ?? q.answer}.` : `Option (${answerLabel}) is the verified correct answer.`}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ── Document Footer ── */}
                                <div className="mt-12 pt-4 border-t border-slate-300 text-center text-[11px] text-slate-500 flex justify-between items-center">
                                    <span>Sapthagiri PU College Examination Authority</span>
                                    <span>Comprehensive Solutions Guide</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Self-Contained Print Styles ── */}
                <style>{`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 10mm 12mm;
                        }
                        html, body {
                            background: #ffffff !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            height: auto !important;
                            min-height: 0 !important;
                            overflow: visible !important;
                        }
                        .no-print, nav, header, button, .diagram-resize-toolbar {
                            display: none !important;
                        }
                        /* ── CRITICAL: Completely hide background question paper so it creates 0 extra pages ── */
                        .a4-engine-wrapper,
                        .a4-print-document,
                        .paper-renderer-wrapper,
                        .paper-preview-container {
                            display: none !important;
                            height: 0 !important;
                            max-height: 0 !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: hidden !important;
                        }
                        body * {
                            visibility: hidden !important;
                        }
                        /* ── Make modal wrappers static so they NEVER repeat as fixed page elements ── */
                        .a4-solution-key-modal,
                        body.printing-solution-key .a4-solution-key-modal {
                            position: static !important;
                            display: block !important;
                            background: transparent !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            height: auto !important;
                            min-height: 0 !important;
                            inset: auto !important;
                            overflow: visible !important;
                            z-index: auto !important;
                        }
                        .a4-solution-key-card,
                        body.printing-solution-key .a4-solution-key-card {
                            position: static !important;
                            display: block !important;
                            background: transparent !important;
                            box-shadow: none !important;
                            border: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            max-height: none !important;
                            max-width: 100% !important;
                            overflow: visible !important;
                        }
                        .a4-solution-key-body,
                        body.printing-solution-key .a4-solution-key-body {
                            position: static !important;
                            display: block !important;
                            background: transparent !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            overflow: visible !important;
                        }
                        /* Watermark in print: Fixed viewport background layer on every page */
                        body.printing-solution-key .a4-watermark-wrapper,
                        body.printing-solution-key .a4-watermark-wrapper * {
                            visibility: visible !important;
                        }
                        body.printing-solution-key .a4-watermark-wrapper {
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
                        body.printing-solution-key .a4-watermark-logo {
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

                        body.printing-solution-key #print-target-solution-key,
                        body.printing-solution-key #print-target-solution-key * {
                            visibility: visible !important;
                        }
                        body.printing-solution-key #print-target-solution-key {
                            position: static !important;
                            top: auto !important;
                            left: auto !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            min-height: 0 !important;
                            margin: 0 auto !important;
                            padding: 4mm 6mm !important;
                            box-shadow: none !important;
                            border: none !important;
                            display: block !important;
                            overflow: visible !important;
                            background: #ffffff !important;
                            break-inside: auto !important;
                            page-break-after: auto !important;
                            position: relative !important;
                            z-index: 1 !important;
                        }
                        body.printing-solution-key #print-target-solution-key > div {
                            break-inside: auto !important;
                        }
                        body.printing-solution-key #print-target-solution-key .border-slate-200 {
                            break-inside: avoid !important;
                            page-break-inside: avoid !important;
                            margin-bottom: 6px !important;
                            padding: 8px !important;
                            position: relative !important;
                            z-index: 1 !important;
                        }
                    }
                `}</style>

                {/* ── Bottom Modal Footer (Hidden during print) ── */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center no-print">
                    <p className="text-xs text-slate-500 font-medium">
                        Standard A4 printable format with scientific formulas rendered in high-resolution KaTeX.
                    </p>
                    <button
                        onClick={onClose}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
