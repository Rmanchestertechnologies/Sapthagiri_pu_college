import React, { useState, useMemo, useEffect } from 'react';
import api from '../api';
import MathRenderer from './MathRenderer';
import { getResolvedAnswerLabel } from '../utils/sanitize';
import { generatePaperSet } from '../utils/pqrsGenerator';

export default function A4AnswerKey({
    paper = {},
    questions = [],
    startQNo = 1,
    setName = 'P',
    onClose,
    onQuestionsUpdated,
}) {
    const [activeSet, setActiveSet] = useState(setName || paper?.setName || 'P');
    const [isEditing, setIsEditing] = useState(false);
    const [localQuestions, setLocalQuestions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState({ type: '', msg: '' });

    // Initialize localQuestions with questions passed or paper questions
    useEffect(() => {
        const baseQs = (questions && questions.length > 0) ? questions : (paper?.questions || []);
        setLocalQuestions(JSON.parse(JSON.stringify(baseQs)));
    }, [paper, questions]);

    const activePaper = useMemo(() => {
        const effectivePaper = { ...paper, questions: localQuestions };
        if (!effectivePaper.questions || effectivePaper.questions.length === 0) return effectivePaper;
        return generatePaperSet(effectivePaper, activeSet);
    }, [paper, localQuestions, activeSet]);

    const resolvedQuestions = useMemo(() => {
        if (activePaper?.questions && activePaper.questions.length > 0) return activePaper.questions;
        return localQuestions.length > 0 ? localQuestions : (paper.questions || []);
    }, [activePaper, localQuestions, paper]);

    const paperTitle = activePaper?.title || paper.title || `${paper.subject || 'Academic'} Assessment`;

    // Handle editing a specific question's answer in localQuestions
    const handleAnswerChange = (qIndex, newAnswer) => {
        setLocalQuestions(prev => {
            const copy = [...prev];
            const target = copy[qIndex];
            if (target) {
                copy[qIndex] = {
                    ...target,
                    answer: newAnswer,
                    correctAnswer: newAnswer,
                };
            }
            return copy;
        });
        setSaveStatus({ type: 'info', msg: 'Unsaved edits. Click "Save Changes" when finished.' });
    };

    // Save edited answer key to database
    const handleSaveKey = async () => {
        const paperId = paper?._id || paper?.id;
        if (!paperId) {
            setSaveStatus({ type: 'error', msg: 'No paper ID found to save.' });
            return;
        }

        setSaving(true);
        setSaveStatus({ type: 'info', msg: 'Saving updated answer key...' });
        try {
            await api.put(`/api/papers/${paperId}`, {
                questions: localQuestions,
            });
            setSaveStatus({ type: 'success', msg: '✅ Answer key saved successfully!' });
            setIsEditing(false);
            if (onQuestionsUpdated) {
                onQuestionsUpdated(localQuestions);
            }
            setTimeout(() => {
                setSaveStatus({ type: '', msg: '' });
            }, 3000);
        } catch (err) {
            console.error('Error saving answer key:', err);
            setSaveStatus({ type: 'error', msg: '❌ Failed to save: ' + (err.response?.data?.msg || err.message) });
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        document.body.classList.add('printing-answer-key');
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('printing-answer-key');
            }, 300);
        }, 150);
    };

    // Determine if question has a multi-line or descriptive answer
    const isDescriptiveAnswer = (answerText) => {
        if (!answerText) return false;
        const str = String(answerText).trim();
        return str.length > 5 || str.includes('\n') || str.includes(' ');
    };

    const descriptiveQuestions = useMemo(() => {
        return resolvedQuestions
            .map((q, idx) => ({ q, idx, qNo: q.setQNo || (startQNo + idx) }))
            .filter(item => isDescriptiveAnswer(item.q.answer || getResolvedAnswerLabel(item.q)));
    }, [resolvedQuestions, startQNo]);

    return (
        <div className="a4-answer-key-modal fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="a4-answer-key-card bg-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden my-auto border border-slate-200 animate-fade-in">
                
                {/* ── Action Toolbar (Hidden during print) ── */}
                <div className="flex flex-wrap justify-between items-center px-6 py-4 bg-white border-b border-gray-200 gap-3 no-print">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-black text-gold uppercase tracking-widest bg-navy px-3 py-1 rounded-full">
                            Official Answer Key
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
                                            ? 'bg-navy text-gold shadow-sm scale-105'
                                            : 'bg-white text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <h3 className="text-sm font-black text-navy uppercase tracking-tight">
                            SET {activeSet} ({resolvedQuestions.length} Questions)
                        </h3>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Edit Mode Toggle */}
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleSaveKey}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <span>💾</span> {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setLocalQuestions(JSON.parse(JSON.stringify(questions || paper?.questions || [])));
                                        setSaveStatus({ type: '', msg: '' });
                                    }}
                                    className="bg-gray-200 hover:bg-gray-300 text-slate-700 px-3 py-2 rounded-xl font-bold text-xs uppercase transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                                title="Edit wrong answers or customize 1-2 line answers"
                            >
                                <span>✏️</span> Edit Answer Key
                            </button>
                        )}

                        <button
                            onClick={handlePrint}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🖨️</span> Print Key
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-slate-800 text-white hover:bg-black px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            title="Open print dialog and choose Save as PDF"
                        >
                            <span>📥</span> PDF
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

                {/* Status Bar */}
                {saveStatus.msg && (
                    <div className={`px-6 py-2 text-xs font-bold flex items-center justify-between no-print ${
                        saveStatus.type === 'success' ? 'bg-emerald-100 text-emerald-900 border-b border-emerald-200' :
                        saveStatus.type === 'error' ? 'bg-red-100 text-red-900 border-b border-red-200' :
                        'bg-blue-50 text-blue-900 border-b border-blue-200'
                    }`}>
                        <span>{saveStatus.msg}</span>
                        {saveStatus.type === 'info' && isEditing && (
                            <button onClick={handleSaveKey} className="underline font-black cursor-pointer">Save Now</button>
                        )}
                    </div>
                )}

                {/* ── A4 Sheet Preview Area ── */}
                <div className="a4-answer-key-body flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-300/80 min-h-0">
                    <div className="mx-auto w-full max-w-[794px]">
                        <div
                            id="print-target-answer-key"
                            className="a4-answer-key-sheet bg-white shadow-2xl rounded-2xl p-6 sm:p-10 w-full text-slate-800 border border-slate-300 relative"
                            style={{
                                minHeight: 'auto',
                                boxSizing: 'border-box',
                                fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                            }}
                        >
                            {/* Official Sapthagiri PU College Crest Watermark - Non-intrusive background layer */}
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
                                        <span>Total Qs: <strong>{resolvedQuestions.length}</strong></span>
                                    </div>
                                    <div className="mt-1 text-center">
                                        <span className="inline-block bg-slate-900 text-amber-400 font-bold text-[11px] uppercase tracking-widest px-4 py-0.5 rounded-full">
                                            Official Answer Key
                                        </span>
                                    </div>
                                </div>

                                {/* ── Edit Instructions Banner (when editing) ── */}
                                {isEditing && (
                                    <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl mb-4 text-xs text-amber-900 font-semibold no-print">
                                        ✏️ <strong>Edit Mode Active:</strong> Click the option (A, B, C, D) or type custom 1-2 line answers below for any question. When finished, click <strong>"Save Changes"</strong> on the top right.
                                    </div>
                                )}

                                {/* ── Primary Answer Key Grid (5 columns on desktop, clean balanced cards) ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3 text-xs">
                                    {resolvedQuestions.map((q, idx) => {
                                        const currentQNo = q.setQNo || (startQNo + idx);
                                        const answerLabel = getResolvedAnswerLabel(q);
                                        const isLong = isDescriptiveAnswer(q.answer || answerLabel);

                                        return (
                                            <div
                                                key={idx}
                                                className={`border rounded-xl p-2.5 flex flex-col justify-between transition ${
                                                    isEditing 
                                                        ? 'bg-amber-50/40 border-amber-300 shadow-xs' 
                                                        : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100'
                                                }`}
                                                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                            >
                                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                                    <span className="font-black text-slate-700 text-xs">
                                                        Q.{currentQNo}
                                                    </span>
                                                    {!isEditing && (
                                                        <span className={`font-black px-2.5 py-0.5 rounded text-xs text-center shadow-2xs ${
                                                            isLong
                                                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                                : 'bg-navy text-amber-400 min-w-[26px]'
                                                        }`}>
                                                            {isLong ? 'See Below' : answerLabel}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Edit Mode Controls */}
                                                {isEditing ? (
                                                    <div className="space-y-1.5 pt-1">
                                                        {/* Quick option pills for MCQ */}
                                                        <div className="flex items-center gap-1 justify-between">
                                                            {['A', 'B', 'C', 'D'].map(optKey => (
                                                                <button
                                                                    key={optKey}
                                                                    type="button"
                                                                    onClick={() => handleAnswerChange(idx, optKey)}
                                                                    className={`flex-1 py-1 rounded text-[11px] font-black transition cursor-pointer ${
                                                                        answerLabel === optKey
                                                                            ? 'bg-navy text-gold shadow-sm ring-1 ring-gold'
                                                                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                                                                    }`}
                                                                >
                                                                    {optKey}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {/* Custom answer text input for numerical or 1-line answer */}
                                                        <input
                                                            type="text"
                                                            value={q.answer || ''}
                                                            onChange={e => handleAnswerChange(idx, e.target.value)}
                                                            placeholder="Or type answer..."
                                                            className="w-full text-[11px] font-bold px-2 py-1 border border-slate-300 rounded bg-white text-navy outline-none focus:border-navy"
                                                        />
                                                    </div>
                                                ) : (
                                                    // In view mode, show small preview if it's a short text answer
                                                    !isLong && q.answer && q.answer !== answerLabel && (
                                                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                                            {String(q.answer).slice(0, 20)}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ── Descriptive / 1-Line / 2-Line Formatted Answers Section (If Any) ── */}
                                {descriptiveQuestions.length > 0 && (
                                    <div className="mt-8 pt-6 border-t-2 border-slate-300">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-navy text-gold text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                                Section B
                                            </span>
                                            <h4 className="text-xs font-black text-navy uppercase tracking-wider">
                                                Descriptive & Numerical Answer Explanations
                                            </h4>
                                        </div>

                                        <div className="space-y-3">
                                            {descriptiveQuestions.map(({ q, qNo, idx }) => (
                                                <div 
                                                    key={idx}
                                                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-start gap-3"
                                                    style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                                >
                                                    <div className="flex items-center gap-2 sm:min-w-[70px]">
                                                        <span className="font-black text-navy text-xs">Q.{qNo}:</span>
                                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                            Answer
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 text-xs text-slate-800 leading-relaxed font-medium">
                                                        <MathRenderer inline text={String(q.answer || getResolvedAnswerLabel(q))} />
                                                        {q.solution && (
                                                            <div className="text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-200">
                                                                <span className="font-bold text-slate-700">Note: </span>
                                                                <MathRenderer inline text={q.solution} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Document Footer ── */}
                                <div className="mt-12 pt-4 border-t border-slate-300 text-center text-[11px] text-slate-500 flex justify-between items-center">
                                    <span>Sapthagiri PU College Examination Authority</span>
                                    <span>Official Answer Key • Set {activeSet}</span>
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
                            margin: 8mm 10mm;
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
                        .a4-answer-key-modal,
                        body.printing-answer-key .a4-answer-key-modal {
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
                        .a4-answer-key-card,
                        body.printing-answer-key .a4-answer-key-card {
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
                        .a4-answer-key-body,
                        body.printing-answer-key .a4-answer-key-body {
                            position: static !important;
                            display: block !important;
                            background: transparent !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            overflow: visible !important;
                        }
                        body.printing-answer-key .a4-watermark-wrapper,
                        body.printing-answer-key .a4-watermark-wrapper * {
                            visibility: visible !important;
                        }
                        body.printing-answer-key .a4-watermark-wrapper {
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
                        body.printing-answer-key .a4-watermark-logo {
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

                        body.printing-answer-key #print-target-answer-key,
                        body.printing-answer-key #print-target-answer-key * {
                            visibility: visible !important;
                        }
                        body.printing-answer-key #print-target-answer-key {
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
                    }
                `}</style>

                {/* ── Bottom Modal Footer (Hidden during print) ── */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center no-print">
                    <p className="text-xs text-slate-500 font-medium">
                        Standard A4 printable format. Click "Edit Answer Key" to override incorrect answers.
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
