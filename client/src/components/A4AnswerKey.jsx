import React, { useState, useMemo, useEffect } from 'react';
import api from '../api';
import MathRenderer from './MathRenderer';
import { getResolvedAnswerLabel } from '../utils/sanitize';
import { generatePaperSet } from '../utils/pqrsGenerator';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper: map full subject name to 3-4 letter uppercase standard abbreviation
function getSubjectAbbr(sub = '') {
    if (!sub) return 'GEN';
    const s = String(sub).trim().toLowerCase();
    if (s.includes('physic') || s === 'phy') return 'PHY';
    if (s.includes('chem')) return 'CHEM';
    if (s.includes('math')) return 'MATH';
    if (s.includes('botan')) return 'BOT';
    if (s.includes('zool')) return 'ZOO';
    if (s.includes('bio')) return 'BIO';
    return s.slice(0, 4).toUpperCase();
}

// Subject resolution for each 15-question chunk
function getSubjectAbbrForChunk(chunkIdx, totalChunks, paper, firstQ) {
    const title = String(paper?.title || '').toUpperCase();
    const paperSub = String(paper?.subject || '').toUpperCase();
    const examType = String(paper?.examType || paper?.exam_type || '').toUpperCase();

    const isPCMB = paperSub.includes('PCMB') || title.includes('PCMB') || (examType.includes('CET') && totalChunks === 4);

    if (isPCMB && totalChunks === 4) {
        const pcmbSubs = ['PHY', 'CHEM', 'MATH', 'BIO'];
        return pcmbSubs[chunkIdx] || 'GEN';
    }

    const qSub = firstQ?.sectionSubject || firstQ?.subject;
    if (qSub && getSubjectAbbr(qSub) !== 'GEN') {
        return getSubjectAbbr(qSub);
    }

    return getSubjectAbbr(paper?.subject || 'GEN');
}

// Convert any answer representation (A, B, C, D, 1, 2, 3, 4, etc.) to 1, 2, 3, 4
function toNumericKey(val) {
    if (val === undefined || val === null || val === '') return '-';
    const s = String(val).trim().toUpperCase();
    if (s === '1' || s === '(1)' || s === '[1]' || s === '1.') return '1';
    if (s === '2' || s === '(2)' || s === '[2]' || s === '2.') return '2';
    if (s === '3' || s === '(3)' || s === '[3]' || s === '3.') return '3';
    if (s === '4' || s === '(4)' || s === '[4]' || s === '4.') return '4';
    if (s === 'A' || s === '(A)' || s === '[A]' || s === 'A.') return '1';
    if (s === 'B' || s === '(B)' || s === '[B]' || s === 'B.') return '2';
    if (s === 'C' || s === '(C)' || s === '[C]' || s === 'C.') return '3';
    if (s === 'D' || s === '(D)' || s === '[D]' || s === 'D.') return '4';
    const numMatch = s.match(/(?:^|\b|\(|\[)([1-4])(?:\)|\b|\]|\.)/);
    if (numMatch) return numMatch[1];
    const alphaMatch = s.match(/(?:^|\b|\(|\[)([A-D])(?:\)|\b|\]|\.)/);
    if (alphaMatch) return String(alphaMatch[1].charCodeAt(0) - 64);
    return s || '-';
}

// Convert any answer representation to A, B, C, D
function toAlphaKey(val) {
    if (val === undefined || val === null || val === '') return '-';
    const s = String(val).trim().toUpperCase();
    if (s === '1' || s === '(1)' || s === '[1]' || s === '1.') return 'A';
    if (s === '2' || s === '(2)' || s === '[2]' || s === '2.') return 'B';
    if (s === '3' || s === '(3)' || s === '[3]' || s === '3.') return 'C';
    if (s === '4' || s === '(4)' || s === '[4]' || s === '4.') return 'D';
    if (s === 'A' || s === 'B' || s === 'C' || s === 'D') return s;
    const alphaMatch = s.match(/(?:^|\b|\(|\[)([A-D])(?:\)|\b|\]|\.)/);
    if (alphaMatch) return alphaMatch[1];
    const numMatch = s.match(/(?:^|\b|\(|\[)([1-4])(?:\)|\b|\]|\.)/);
    if (numMatch) return String.fromCharCode(64 + parseInt(numMatch[1], 10));
    return s || '-';
}

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
    // Default to numeric keys (1, 2, 3, 4) matching institutional CET / PUC standard
    const [useNumericKeys, setUseNumericKeys] = useState(true);

    // Sync activeSet if setName prop changes
    useEffect(() => {
        if (setName) setActiveSet(setName);
    }, [setName]);

    // Initialize localQuestions with questions passed or paper questions
    useEffect(() => {
        const baseQs = (questions && questions.length > 0) ? questions : (paper?.questions || []);
        setLocalQuestions(JSON.parse(JSON.stringify(baseQs)));
    }, [paper, questions]);

    const activePaper = useMemo(() => {
        const effectivePaper = { ...paper, questions: localQuestions };
        if (!effectivePaper.questions || effectivePaper.questions.length === 0) return effectivePaper;
        return generatePaperSet(effectivePaper, activeSet, Number(startQNo) || 1);
    }, [paper, localQuestions, activeSet, startQNo]);

    const resolvedQuestions = useMemo(() => {
        let baseList = [];
        if (activePaper?.questions && activePaper.questions.length > 0) baseList = activePaper.questions;
        else baseList = localQuestions.length > 0 ? localQuestions : (paper.questions || []);

        const examTypeStr = String(paper?.examType || paper?.exam_type || paper?.title || '').toUpperCase();
        const isExplicitNonJEE = examTypeStr.includes('NEET') ||
                                 examTypeStr.includes('CET') ||
                                 examTypeStr.includes('KCET') ||
                                 String(paper?.subject || '').toUpperCase().includes('BOTANY') ||
                                 String(paper?.subject || '').toUpperCase().includes('ZOOLOGY') ||
                                 (baseList.length !== 75);

        const isJEE = !isExplicitNonJEE && Boolean(
            examTypeStr.includes('JEE') && baseList.length === 75
        );
        return (isJEE && baseList.length === 75) ? baseList.slice(0, 75) : baseList;
    }, [activePaper, localQuestions, paper]);

    const paperTitle = activePaper?.title || paper.title || `${paper.subject || 'Academic'} Assessment`;

    // Formatted Exam Date for Title (DD.MM.YYYY)
    const formattedExamDate = useMemo(() => {
        const raw = paper?.examDate || paper?.createdAt || paper?.created_at || new Date();
        try {
            const d = new Date(raw);
            if (isNaN(d.getTime())) return '';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}.${month}.${year}`;
        } catch {
            return '';
        }
    }, [paper]);

    // Chunk questions into standardized blocks of 15 questions (as shown in official key template)
    const questionChunks = useMemo(() => {
        const chunks = [];
        const chunkSize = 15;
        for (let i = 0; i < resolvedQuestions.length; i += chunkSize) {
            chunks.push(resolvedQuestions.slice(i, i + chunkSize));
        }
        return chunks;
    }, [resolvedQuestions]);

    // Header Title matching Image 1: e.g. "II PUC (C ) CET DPT - 35 KEY ANS (PCMB) 07.11.2026"
    const headerTitleText = useMemo(() => {
        const subStr = paper?.subject || 'PCMB';
        return `${paperTitle} KEY ANS (${subStr}) ${formattedExamDate}`.trim();
    }, [paperTitle, paper?.subject, formattedExamDate]);

    // Handle editing a specific question's answer in localQuestions
    const handleAnswerChange = (qIndex, selectedVal) => {
        setLocalQuestions(prev => {
            const copy = [...prev];
            const target = copy[qIndex];
            if (target) {
                const numVal = toNumericKey(selectedVal);
                const alphaVal = toAlphaKey(selectedVal);
                copy[qIndex] = {
                    ...target,
                    answer: alphaVal,
                    correct_option: alphaVal,
                    correctAnswer: alphaVal,
                    num_answer: numVal,
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

    // Clean system print
    const handlePrint = () => {
        document.body.classList.add('printing-answer-key');
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('printing-answer-key');
            }, 300);
        }, 150);
    };

    // High-fidelity Vector PDF export matching user reference image exactly
    const handleDownloadPdf = () => {
        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Title at the top matching user image:
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(headerTitleText, 148.5, 14, { align: 'center' });

            // Build table data for autotable
            const tableBody = [];

            questionChunks.forEach((chunk, chunkIdx) => {
                const firstQ = chunk[0];
                const subAbbr = getSubjectAbbrForChunk(chunkIdx, questionChunks.length, paper, firstQ);

                // Row 1: Subject (rowSpan: 2), Q. NO, q numbers 1..15
                const qNoRow = [
                    { content: subAbbr, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 10, fillColor: [255, 255, 255] } },
                    { content: 'Q. NO', styles: { halign: 'center', fontStyle: 'bold', fontSize: 8.5, fillColor: [240, 240, 240] } }
                ];
                for (let i = 0; i < 15; i++) {
                    const q = chunk[i];
                    const qNo = q ? (q.setQNo || (startQNo + chunkIdx * 15 + i)) : '';
                    qNoRow.push({ content: String(qNo), styles: { halign: 'center', fontStyle: 'bold', fontSize: 9, fillColor: [240, 240, 240] } });
                }
                tableBody.push(qNoRow);

                // Row 2: KEY, display keys
                const keyRow = [
                    { content: 'KEY', styles: { halign: 'center', fontStyle: 'bold', fontSize: 8.5, fillColor: [255, 255, 255] } }
                ];
                for (let i = 0; i < 15; i++) {
                    const q = chunk[i];
                    let displayKey = '';
                    if (q) {
                        const rawAns = getResolvedAnswerLabel(q);
                        displayKey = useNumericKeys ? toNumericKey(rawAns) : toAlphaKey(rawAns);
                    }
                    keyRow.push({ content: String(displayKey), styles: { halign: 'center', fontStyle: 'bold', fontSize: 9.5, fillColor: [255, 255, 255] } });
                }
                tableBody.push(keyRow);
            });

            autoTable(doc, {
                startY: 19,
                margin: { left: 10, right: 10 },
                body: tableBody,
                theme: 'grid',
                styles: {
                    lineColor: [0, 0, 0],
                    lineWidth: 0.35,
                    textColor: [0, 0, 0],
                    cellPadding: 2,
                    font: 'helvetica'
                },
                columnStyles: {
                    0: { cellWidth: 16 },
                    1: { cellWidth: 14 },
                    // 15 questions columns:
                    ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 2, { cellWidth: 16.4 }]))
                }
            });

            const safeTitle = (paperTitle || 'KEY_ANS').replace(/[^a-zA-Z0-9_-]/g, '_');
            doc.save(`${safeTitle}_KEY_ANS_SET_${activeSet}.pdf`);
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Failed to generate PDF: ' + err.message);
        }
    };

    // Professional Excel (.xlsx) Answer Key Export matching user reference layout 100%
    const handleDownloadExcel = () => {
        try {
            const wb = XLSX.utils.book_new();
            const wsData = [];

            // Row 1: Merged Centered Title Header
            wsData.push([headerTitleText]);
            // Row 2: Empty spacer
            wsData.push([]);

            // Chunks of 15 questions per subject block
            questionChunks.forEach((chunk, chunkIdx) => {
                const firstQ = chunk[0];
                const subAbbr = getSubjectAbbrForChunk(chunkIdx, questionChunks.length, paper, firstQ);

                // Row A: [SUB], Q. NO, 1..15
                const qNoRow = [subAbbr, 'Q. NO'];
                chunk.forEach((q, idx) => {
                    const qNo = q.setQNo || (startQNo + chunkIdx * 15 + idx);
                    qNoRow.push(qNo);
                });
                while (qNoRow.length < 17) qNoRow.push('');
                wsData.push(qNoRow);

                // Row B: [SUB], KEY, k1..k15
                const keyRow = [subAbbr, 'KEY'];
                chunk.forEach((q) => {
                    const rawAns = getResolvedAnswerLabel(q);
                    const displayKey = useNumericKeys ? toNumericKey(rawAns) : toAlphaKey(rawAns);
                    keyRow.push(displayKey);
                });
                while (keyRow.length < 17) keyRow.push('');
                wsData.push(keyRow);

                // Row spacer between blocks
                wsData.push([]);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Merge Title across 17 columns (A1:Q1)
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }
            ];

            // Column widths: Col A: 10, Col B: 10, Cols C to Q: 6 each
            const colWidths = [{ wch: 10 }, { wch: 10 }];
            for (let c = 0; c < 15; c++) colWidths.push({ wch: 6 });
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, `KEY_ANS_SET_${activeSet}`);
            const safeTitle = (paperTitle || 'KEY_ANS').replace(/[^a-zA-Z0-9_-]/g, '_');
            XLSX.writeFile(wb, `${safeTitle}_KEY_ANS_SET_${activeSet}.xlsx`);
        } catch (err) {
            console.error('Error generating Excel file:', err);
            alert('Failed to generate Excel file: ' + err.message);
        }
    };

    return (
        <div className="a4-answer-key-modal fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="a4-answer-key-card bg-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden my-auto border border-slate-200 animate-fade-in">
                
                {/* ── Action Toolbar (Hidden during print) ── */}
                <div className="flex flex-wrap justify-between items-center px-6 py-4 bg-white border-b border-gray-200 gap-3 no-print">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-black text-gold uppercase tracking-widest bg-navy px-3 py-1 rounded-full shadow-xs">
                            Official Answer Key
                        </span>
                        
                        {/* Set Switcher */}
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

                        {/* Numeric vs Letter Key Segmented Toggle */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setUseNumericKeys(true)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                                    useNumericKeys ? 'bg-navy text-gold shadow-xs' : 'text-slate-600 hover:text-navy'
                                }`}
                                title="Show keys as 1, 2, 3, 4 (Standard for CET / PUC)"
                            >
                                1, 2, 3, 4 (CET)
                            </button>
                            <button
                                type="button"
                                onClick={() => setUseNumericKeys(false)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                                    !useNumericKeys ? 'bg-navy text-gold shadow-xs' : 'text-slate-600 hover:text-navy'
                                }`}
                                title="Show keys as A, B, C, D"
                            >
                                A, B, C, D
                            </button>
                        </div>
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
                                title="Edit answer keys"
                            >
                                <span>✏️</span> Edit Key
                            </button>
                        )}

                        <button
                            onClick={handlePrint}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🖨️</span> Print Key
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            className="bg-slate-800 text-white hover:bg-black px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            title="Direct PDF download formatted to institutional standard"
                        >
                            <span>📥</span> PDF
                        </button>
                        <button
                            onClick={handleDownloadExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            title="Download formatted Excel (.xlsx) answer key matching official format"
                        >
                            <span>📊</span> Excel
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

                {/* ── Official Answer Key Table Document (Matches user reference exactly) ── */}
                <div className="a4-answer-key-body flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-300/80 min-h-0">
                    <div className="mx-auto w-full max-w-[860px]">
                        <div
                            id="print-target-answer-key"
                            className="a4-answer-key-sheet bg-white shadow-2xl rounded-2xl p-6 sm:p-8 w-full text-slate-900 border border-slate-300 relative"
                            style={{
                                minHeight: 'auto',
                                boxSizing: 'border-box',
                                fontFamily: 'Calibri, Arial, sans-serif',
                            }}
                        >
                            {/* Official Table Header Title (as shown in user reference image) */}
                            <div className="text-center mb-4">
                                <h2 className="text-lg sm:text-xl font-black text-black tracking-wide uppercase">
                                    {headerTitleText}
                                </h2>
                            </div>

                            {/* Standardized 15-Question Institutional Grid Table */}
                            <div className="overflow-x-auto">
                                <table
                                    className="w-full border-collapse text-center select-none"
                                    style={{
                                        border: '2px solid #000',
                                        fontSize: '12.5px',
                                        fontFamily: 'Calibri, Arial, sans-serif',
                                    }}
                                >
                                    <tbody>
                                        {questionChunks.map((chunk, chunkIdx) => {
                                            const firstQ = chunk[0];
                                            const subAbbr = getSubjectAbbrForChunk(chunkIdx, questionChunks.length, paper, firstQ);

                                            return (
                                                <React.Fragment key={chunkIdx}>
                                                    {/* Row 1: Subject (spanning 2 rows), Q. NO, numbers 1..15 */}
                                                    <tr style={{ borderTop: chunkIdx > 0 ? '2px solid #000' : 'none' }}>
                                                        {/* Subject cell spanning both Q. NO and KEY rows */}
                                                        <td
                                                            rowSpan={2}
                                                            style={{
                                                                width: '60px',
                                                                fontWeight: 900,
                                                                fontSize: '13px',
                                                                letterSpacing: '0.05em',
                                                                borderRight: '2px solid #000',
                                                                borderBottom: '2px solid #000',
                                                                backgroundColor: '#ffffff',
                                                                padding: '6px 2px',
                                                                verticalAlign: 'middle',
                                                                color: '#000',
                                                            }}
                                                        >
                                                            {subAbbr}
                                                        </td>

                                                        {/* "Q. NO" label cell */}
                                                        <td
                                                            style={{
                                                                width: '54px',
                                                                fontWeight: 900,
                                                                fontSize: '11px',
                                                                borderRight: '1.5px solid #000',
                                                                borderBottom: '1.5px solid #000',
                                                                backgroundColor: '#e5e7eb',
                                                                padding: '6px 2px',
                                                                whiteSpace: 'nowrap',
                                                                color: '#000',
                                                            }}
                                                        >
                                                            Q. NO
                                                        </td>

                                                        {/* 15 Question Number Cells */}
                                                        {Array.from({ length: 15 }).map((_, colIdx) => {
                                                            const q = chunk[colIdx];
                                                            const qNo = q ? (q.setQNo || (startQNo + chunkIdx * 15 + colIdx)) : '';
                                                            return (
                                                                <td
                                                                    key={colIdx}
                                                                    style={{
                                                                        fontWeight: 800,
                                                                        borderRight: colIdx < 14 ? '1.5px solid #000' : 'none',
                                                                        borderBottom: '1.5px solid #000',
                                                                        backgroundColor: '#e5e7eb',
                                                                        padding: '6px 2px',
                                                                        minWidth: '32px',
                                                                        color: '#000',
                                                                    }}
                                                                >
                                                                    {qNo}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>

                                                    {/* Row 2: KEY label and answer keys */}
                                                    <tr style={{ borderBottom: '2px solid #000' }}>
                                                        {/* "KEY" label cell */}
                                                        <td
                                                            style={{
                                                                fontWeight: 900,
                                                                fontSize: '11px',
                                                                borderRight: '1.5px solid #000',
                                                                backgroundColor: '#ffffff',
                                                                padding: '6px 2px',
                                                                whiteSpace: 'nowrap',
                                                                color: '#000',
                                                            }}
                                                        >
                                                            KEY
                                                        </td>

                                                        {/* 15 Key Value Cells */}
                                                        {Array.from({ length: 15 }).map((_, colIdx) => {
                                                            const q = chunk[colIdx];
                                                            if (!q) {
                                                                return (
                                                                    <td
                                                                        key={colIdx}
                                                                        style={{
                                                                            borderRight: colIdx < 14 ? '1.5px solid #000' : 'none',
                                                                            backgroundColor: '#ffffff',
                                                                            padding: '6px 2px',
                                                                        }}
                                                                    ></td>
                                                                );
                                                            }

                                                            const rawAns = getResolvedAnswerLabel(q);
                                                            const currentKey = useNumericKeys ? toNumericKey(rawAns) : toAlphaKey(rawAns);
                                                            const qGlobalIdx = chunkIdx * 15 + colIdx;

                                                            return (
                                                                <td
                                                                    key={colIdx}
                                                                    style={{
                                                                        fontWeight: 800,
                                                                        fontSize: '13px',
                                                                        borderRight: colIdx < 14 ? '1.5px solid #000' : 'none',
                                                                        backgroundColor: isEditing ? '#fef3c7' : '#ffffff',
                                                                        padding: isEditing ? '2px' : '6px 2px',
                                                                        color: '#000',
                                                                    }}
                                                                >
                                                                    {isEditing ? (
                                                                        <select
                                                                            value={currentKey}
                                                                            onChange={(e) => handleAnswerChange(qGlobalIdx, e.target.value)}
                                                                            className="w-full text-xs font-black text-center bg-white border border-amber-400 rounded py-0.5 outline-none cursor-pointer"
                                                                        >
                                                                            {useNumericKeys ? (
                                                                                ['1', '2', '3', '4'].map(k => (
                                                                                    <option key={k} value={k}>{k}</option>
                                                                                ))
                                                                            ) : (
                                                                                ['A', 'B', 'C', 'D'].map(k => (
                                                                                    <option key={k} value={k}>{k}</option>
                                                                                ))
                                                                            )}
                                                                        </select>
                                                                    ) : (
                                                                        currentKey
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
