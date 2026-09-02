import React from 'react';
import MathRenderer from './MathRenderer';
import { getResolvedAnswerLabel, getQuestionOptionLabels, isOptionCorrect } from '../utils/sanitize';

export default function A4SolutionKey({
    paper = {},
    questions = [],
    startQNo = 1,
    setName = 'P',
    onClose,
}) {
    const paperTitle = paper.title || `${paper.subject || 'Academic'} Assessment`;
    const resolvedQuestions = questions.length > 0 ? questions : (paper.questions || []);

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
                <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-200 no-print">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-gold uppercase tracking-widest bg-navy px-3 py-1 rounded-full">
                            A4 Print & Export View
                        </span>
                        <h3 className="text-base font-black text-navy uppercase tracking-tight">
                            Detailed Solutions & Explanations ({resolvedQuestions.length} Questions)
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🖨️</span> Print Solutions (A4)
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
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
                            }}
                        >
                            {/* Official Sapthagiri PU College Crest Watermark */}
                            <div 
                                className="a4-watermark-print"
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '380px',
                                    height: '380px',
                                    backgroundImage: "url('/SapthagiriLogo.jpg')",
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    backgroundSize: 'contain',
                                    borderRadius: '50%',
                                    opacity: 0.13,
                                    mixBlendMode: 'multiply',
                                    pointerEvents: 'none',
                                    zIndex: 0
                                }}
                            />

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
                                        {setName && <span>SET: <strong>{setName}</strong></span>}
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
                                        const explanation = q.solutionText || q.solution || q.explanation || '';
                                        const options = Array.isArray(q.options) ? q.options : [];

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
                                                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-md border border-emerald-200">
                                                        Correct Answer: ({answerLabel})
                                                    </span>
                                                </div>

                                                {/* Question Text */}
                                                <div className="text-xs text-slate-800 font-normal leading-relaxed">
                                                    <MathRenderer inline text={qText} />
                                                </div>

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

                                                {/* Options summary */}
                                                {options.length > 0 && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-600">
                                                        {options.map((opt, oi) => {
                                                            const isCorrect = isOptionCorrect(q, oi);
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
                                                                        <MathRenderer inline text={typeof opt === 'object' ? (opt.text || '') : String(opt)} />
                                                                    </div>
                                                                    {isCorrect && <span className="text-emerald-700 font-bold">✓</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Explanation Box with full KaTeX Math Rendering */}
                                                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                                                    <span className="font-bold text-navy block">Explanation:</span>
                                                    {explanation ? (
                                                        <div className="leading-relaxed">
                                                            <MathRenderer inline text={explanation} />
                                                        </div>
                                                    ) : (
                                                        <p className="text-slate-400 italic text-[11px]">
                                                            Option ({answerLabel}) is the verified correct answer.
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
                        }
                        body.printing-solution-key #print-target-solution-key > div {
                            break-inside: auto !important;
                        }
                        body.printing-solution-key #print-target-solution-key .border-slate-300 {
                            break-inside: avoid !important;
                            page-break-inside: avoid !important;
                            margin-bottom: 8px !important;
                            padding: 8px !important;
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
