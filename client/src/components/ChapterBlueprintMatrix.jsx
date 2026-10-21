import React, { useState, useMemo, useEffect } from 'react';

/**
 * ChapterBlueprintMatrix.jsx
 *
 * Professional Objective & Competitive Exam Blueprint & Chapter-by-Chapter Dropdown Manager
 * Designed for Sapthagiri PU College (JEE, NEET, CET, and Competitive Formats).
 *
 * Features:
 *  - 📂 Chapter Dropdown Cards: Expandable dropdown for EVERY chapter with type-by-type count selectors (+ / - / input)
 *  - 📊 Matrix Table View: Full spreadsheet table for rapid entry
 *  - ⚡ 1-Click Competitive Presets:
 *      * JEE Main: Exactly 20 MCQs (Section A) + 5 Numericals (Section B) = 25 Qs (100M)
 *      * NEET: 35 Section A + 10 Section B = 45 Qs (180M)
 *      * KCET: 60 MCQs = 60 Qs (60M)
 *      * Even Distribution across selected chapters
 *  - Real-time Target Validation with Section A vs Section B breakdown
 */

const QUESTION_TYPE_CONFIG = [
    { key: 'mcq', label: 'Single Correct MCQ', short: 'MCQ', color: 'emerald', section: 'A' },
    { key: 'ar', label: 'Assertion & Reason', short: 'A/R', color: 'purple', section: 'A' },
    { key: 'stmt', label: 'Statement Based', short: 'Stmt', color: 'blue', section: 'A' },
    { key: 'num', label: 'Numerical / Integer', short: 'Numerical (Sec B)', color: 'amber', section: 'B' },
    { key: 'diag', label: 'Diagram / Image', short: 'Diag', color: 'indigo', section: 'A' },
    { key: 'match', label: 'Match the Following', short: 'Match', color: 'teal', section: 'A' },
];

export default function ChapterBlueprintMatrix({
    chapters = [],
    subject = 'Physics',
    examType = 'JEE_PCM',
    onGenerate,
    onCancel,
    initialBlueprint = null,
    defaultTargetMarks = null,
    isGenerating = false,
}) {
    // Determine default target questions & marks per question based on examType and subject
    const defaultSettings = useMemo(() => {
        const upperExam = (examType || '').toUpperCase();
        if (upperExam.includes('JEE')) {
            return { targetQs: 25, marksPerQ: 4, targetMarks: 100 };
        }
        if (upperExam.includes('CET')) {
            return { targetQs: 60, marksPerQ: 1, targetMarks: 60 };
        }
        // Default to NEET pattern (45 questions per subject x 4 marks = 180 marks)
        return { targetQs: 45, marksPerQ: 4, targetMarks: 180 };
    }, [examType]);

    const [targetQs, setTargetQs] = useState(defaultSettings.targetQs);
    const [marksPerQ, setMarksPerQ] = useState(defaultSettings.marksPerQ);
    const [searchFilter, setSearchFilter] = useState('');
    const [viewMode, setViewMode] = useState('dropdown'); // 'dropdown' | 'table'
    const [openDropdowns, setOpenDropdowns] = useState(() => {
        // Initially keep all or first 5 open
        const initial = {};
        chapters.forEach((ch, idx) => {
            initial[ch] = idx < 8;
        });
        return initial;
    });

    // Auto-calculate target marks
    const targetMarks = useMemo(() => targetQs * marksPerQ, [targetQs, marksPerQ]);

    // Matrix state: { [chapterName]: { mcq: number, ar: number, stmt: number, num: number, diag: number, match: number } }
    const [matrix, setMatrix] = useState(() => {
        if (initialBlueprint && Object.keys(initialBlueprint).length > 0) {
            return { ...initialBlueprint };
        }
        const initial = {};
        chapters.forEach(ch => {
            initial[ch] = { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 };
        });
        return initial;
    });

    // Ensure all chapters exist in matrix
    useEffect(() => {
        setMatrix(prev => {
            const next = { ...prev };
            let changed = false;
            chapters.forEach(ch => {
                if (!next[ch]) {
                    next[ch] = { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [chapters]);

    // Handle single cell input change
    const handleCellChange = (chapter, typeKey, value) => {
        const numVal = Math.max(0, parseInt(value, 10) || 0);
        setMatrix(prev => ({
            ...prev,
            [chapter]: {
                ...(prev[chapter] || { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 }),
                [typeKey]: numVal,
            }
        }));
    };

    // Increment / Decrement helper
    const handleStepChange = (chapter, typeKey, delta) => {
        setMatrix(prev => {
            const current = prev[chapter]?.[typeKey] || 0;
            const nextVal = Math.max(0, current + delta);
            return {
                ...prev,
                [chapter]: {
                    ...(prev[chapter] || { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 }),
                    [typeKey]: nextVal,
                }
            };
        });
    };

    // Toggle single chapter dropdown
    const toggleChapterDropdown = (chapter) => {
        setOpenDropdowns(prev => ({
            ...prev,
            [chapter]: !prev[chapter]
        }));
    };

    // Expand All / Collapse All
    const expandAll = () => {
        const allOpen = {};
        chapters.forEach(ch => { allOpen[ch] = true; });
        setOpenDropdowns(allOpen);
    };

    const collapseAll = () => {
        const allClosed = {};
        chapters.forEach(ch => { allClosed[ch] = false; });
        setOpenDropdowns(allClosed);
    };

    // Filtered chapters for table search
    const visibleChapters = useMemo(() => {
        if (!searchFilter.trim()) return chapters;
        const q = searchFilter.toLowerCase();
        return chapters.filter(ch => ch.toLowerCase().includes(q));
    }, [chapters, searchFilter]);

    // Totals calculation
    const {
        chapterStats,
        totalMCQ,
        totalAR,
        totalStmt,
        totalNum,
        totalDiag,
        totalMatch,
        secATotal,
        secBTotal,
        grandTotalQs,
        grandTotalMarks,
    } = useMemo(() => {
        let tMCQ = 0, tAR = 0, tStmt = 0, tNum = 0, tDiag = 0, tMatch = 0;
        const stats = {};

        chapters.forEach(ch => {
            const row = matrix[ch] || { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 };
            const mcq = row.mcq || 0;
            const ar = row.ar || 0;
            const stmt = row.stmt || 0;
            const num = row.num || 0;
            const diag = row.diag || 0;
            const match = row.match || 0;

            tMCQ += mcq;
            tAR += ar;
            tStmt += stmt;
            tNum += num;
            tDiag += diag;
            tMatch += match;

            const qCount = mcq + ar + stmt + num + diag + match;
            const markCount = qCount * marksPerQ;
            const secA = mcq + ar + stmt + diag + match;
            const secB = num;
            stats[ch] = { qCount, markCount, secA, secB };
        });

        const totalQs = tMCQ + tAR + tStmt + tNum + tDiag + tMatch;
        const totalMarksSum = totalQs * marksPerQ;
        const sA = tMCQ + tAR + tStmt + tDiag + tMatch;
        const sB = tNum;

        return {
            chapterStats: stats,
            totalMCQ: tMCQ,
            totalAR: tAR,
            totalStmt: tStmt,
            totalNum: tNum,
            totalDiag: tDiag,
            totalMatch: tMatch,
            secATotal: sA,
            secBTotal: sB,
            grandTotalQs: totalQs,
            grandTotalMarks: totalMarksSum,
        };
    }, [chapters, matrix, marksPerQ]);

    // Target comparison difference
    const qsDifference = grandTotalQs - targetQs;
    const marksDifference = grandTotalMarks - targetMarks;

    // Apply NEET Preset (45 Questions / 180 Marks: 35 Sec A + 10 Sec B)
    const applyNEETPreset = () => {
        if (chapters.length === 0) return;
        setTargetQs(45);
        setMarksPerQ(4);
        const next = {};
        const chCount = chapters.length;

        chapters.forEach((ch, idx) => {
            const mcqShare = Math.floor(30 / chCount) + (idx < (30 % chCount) ? 1 : 0);
            const arShare = idx < Math.min(5, chCount) ? 1 : 0;
            const stmtShare = idx >= 5 && idx < 10 ? 1 : 0;
            const diagShare = idx < Math.min(5, chCount) ? 1 : 0;

            next[ch] = {
                mcq: mcqShare,
                ar: arShare,
                stmt: stmtShare,
                num: 0,
                diag: diagShare,
                match: 0,
            };
        });
        setMatrix(next);
    };

    // Apply JEE Main Preset: EXACTLY 20 Section A MCQs/Diag/AR + 5 Section B Numericals = 25 Questions
    const applyJEEPreset = () => {
        if (chapters.length === 0) return;
        setTargetQs(25);
        setMarksPerQ(4);
        const next = {};
        const chCount = chapters.length;

        // Exactly 20 MCQs/Diagrams in Section A, 5 Numericals in Section B
        chapters.forEach((ch, idx) => {
            const mcqShare = Math.floor(18 / chCount) + (idx < (18 % chCount) ? 1 : 0);
            const diagShare = idx < Math.min(2, chCount) ? 1 : 0;
            const numShare = Math.floor(5 / chCount) + (idx < (5 % chCount) ? 1 : 0);

            next[ch] = {
                mcq: mcqShare,
                ar: 0,
                stmt: 0,
                num: numShare,
                diag: diagShare,
                match: 0,
            };
        });
        setMatrix(next);
    };

    // Apply KCET Preset: 60 MCQs = 60 Marks
    const applyCETPreset = () => {
        if (chapters.length === 0) return;
        setTargetQs(60);
        setMarksPerQ(1);
        const next = {};
        const chCount = chapters.length;

        chapters.forEach((ch, idx) => {
            const mcqShare = Math.floor(60 / chCount) + (idx < (60 % chCount) ? 1 : 0);
            next[ch] = {
                mcq: mcqShare,
                ar: 0,
                stmt: 0,
                num: 0,
                diag: 0,
                match: 0,
            };
        });
        setMatrix(next);
    };

    // Apply Even Distribution Preset
    const applyEvenDistribution = () => {
        if (chapters.length === 0) return;
        const next = {};
        const chCount = chapters.length;
        const perChapter = Math.floor(targetQs / chCount);
        const remainder = targetQs % chCount;

        chapters.forEach((ch, idx) => {
            const alloc = perChapter + (idx < remainder ? 1 : 0);
            next[ch] = {
                mcq: alloc,
                ar: 0,
                stmt: 0,
                num: 0,
                diag: 0,
                match: 0,
            };
        });
        setMatrix(next);
    };

    const clearMatrix = () => {
        const next = {};
        chapters.forEach(ch => {
            next[ch] = { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 };
        });
        setMatrix(next);
    };

    const handleFormSubmit = (e) => {
        e?.preventDefault();
        if (grandTotalQs === 0) {
            alert('Please allocate at least 1 question in the chapter blueprint.');
            return;
        }
        if (onGenerate) {
            onGenerate(matrix, targetMarks, targetQs, marksPerQ);
        }
    };

    const isJEE = (examType || '').toUpperCase().includes('JEE');

    return (
        <div className="bg-white rounded-3xl border-2 border-navy/20 shadow-xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-navy via-navy/95 to-slate-900 text-white p-6 border-b-4 border-gold">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-navy uppercase tracking-[0.2em] bg-gold px-3 py-0.5 rounded-full">
                                Chapter Blueprint & Question Type Matrix
                            </span>
                            <span className="text-xs text-white/70 font-semibold">• {subject}</span>
                            <span className="text-xs text-gold/90 font-mono">[{examType}]</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-white mt-1 uppercase tracking-tight flex items-center gap-2">
                            <span>📐</span>
                            <span>Chapter-Wise Question Type Allocation</span>
                        </h2>
                        <p className="text-xs text-slate-300 font-medium mt-1">
                            Configure exact question counts per chapter for MCQs, Assertion & Reason, Statement Based, Numericals (Section B), Diagrams, and Matrix Match.
                        </p>
                    </div>

                    {/* Target Controls */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Target Questions Input */}
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20">
                            <span className="text-[10px] font-black text-gold uppercase tracking-widest block">
                                Target Questions
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <input
                                    type="number"
                                    min="1"
                                    max="200"
                                    value={targetQs}
                                    onChange={(e) => setTargetQs(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className="w-16 bg-white text-navy font-black text-center text-base rounded-xl px-1.5 py-1 outline-none border border-gold"
                                />
                                <span className="text-xs font-bold text-white/80">Qs</span>
                            </div>
                        </div>

                        {/* Marks Per Question Selector */}
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20">
                            <span className="text-[10px] font-black text-gold uppercase tracking-widest block">
                                Marks / Q
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <select
                                    value={marksPerQ}
                                    onChange={(e) => setMarksPerQ(Math.max(1, parseInt(e.target.value, 10) || 4))}
                                    className="bg-white text-navy font-black text-xs rounded-xl px-2 py-1.5 outline-none border border-gold cursor-pointer"
                                >
                                    <option value={4}>4 Marks (JEE/NEET)</option>
                                    <option value={1}>1 Mark (KCET)</option>
                                    <option value={2}>2 Marks</option>
                                    <option value={3}>3 Marks</option>
                                    <option value={5}>5 Marks</option>
                                </select>
                            </div>
                        </div>

                        {/* Target Total Marks Display */}
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-center">
                            <span className="text-[10px] font-black text-gold uppercase tracking-widest block">
                                Target Marks
                            </span>
                            <div className="text-lg font-black text-white mt-0.5">
                                {targetMarks} <span className="text-xs text-white/70 font-normal">M</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preset Buttons Bar */}
                <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-white/10 text-xs">
                    <span className="text-[11px] font-bold text-white/60 mr-1">Fast Presets:</span>
                    <button
                        type="button"
                        onClick={applyJEEPreset}
                        className="bg-white/15 hover:bg-gold hover:text-navy text-white px-3 py-1.5 rounded-xl font-black transition text-xs flex items-center gap-1.5 cursor-pointer ring-1 ring-gold/40"
                    >
                        <span>⚡</span> JEE Main (20 MCQs Sec A + 5 Numericals Sec B)
                    </button>
                    <button
                        type="button"
                        onClick={applyNEETPreset}
                        className="bg-white/15 hover:bg-gold hover:text-navy text-white px-3 py-1.5 rounded-xl font-bold transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                        <span>🩺</span> NEET (45 Qs • 180M)
                    </button>
                    <button
                        type="button"
                        onClick={applyCETPreset}
                        className="bg-white/15 hover:bg-gold hover:text-navy text-white px-3 py-1.5 rounded-xl font-bold transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                        <span>🏆</span> KCET (60 Qs • 60M)
                    </button>
                    <button
                        type="button"
                        onClick={applyEvenDistribution}
                        className="bg-white/15 hover:bg-gold hover:text-navy text-white px-3 py-1.5 rounded-xl font-bold transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                        <span>📊</span> Even Distribute ({targetQs} Qs)
                    </button>
                    <button
                        type="button"
                        onClick={clearMatrix}
                        className="bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white px-3 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ml-auto"
                    >
                        ✕ Clear All
                    </button>
                </div>
            </div>

            {/* Target Comparison & Validation Banner */}
            <div className="p-4 border-b border-gray-200 bg-slate-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Live Metric Pills */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="bg-white px-3.5 py-1.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-gray-500">Allocated Qs:</span>
                            <span className={`font-black text-sm ${qsDifference === 0 ? 'text-emerald-600' : qsDifference > 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                {grandTotalQs} / {targetQs}
                            </span>
                        </div>

                        {/* JEE Section A & Section B Badges */}
                        {isJEE && (
                            <>
                                <div className="bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-xl flex items-center gap-1.5 text-xs font-black text-emerald-800">
                                    <span>Section A (MCQs/AR/Diag):</span>
                                    <span className="bg-emerald-200 px-2 py-0.5 rounded-full">{secATotal} / 20</span>
                                </div>
                                <div className="bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl flex items-center gap-1.5 text-xs font-black text-amber-900">
                                    <span>Section B (Numericals):</span>
                                    <span className="bg-amber-200 px-2 py-0.5 rounded-full">{secBTotal} / 5</span>
                                </div>
                            </>
                        )}

                        <div className="bg-white px-3.5 py-1.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-gray-500">Allocated Marks:</span>
                            <span className={`font-black text-sm ${marksDifference === 0 ? 'text-emerald-600' : marksDifference > 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                {grandTotalMarks} / {targetMarks} M
                            </span>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                        {grandTotalQs === 0 ? (
                            <span className="bg-gray-200 text-gray-700 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                                ℹ️ Select Question Counts in Chapter Dropdowns Below
                            </span>
                        ) : qsDifference === 0 ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
                                <span>✓</span> Target Match: Exactly {targetQs} Questions ({targetMarks} Marks) Allocated!
                            </span>
                        ) : qsDifference < 0 ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
                                <span>⚠️</span> Under Target: {Math.abs(qsDifference)} Questions Remaining ({grandTotalQs}/{targetQs} Qs)
                            </span>
                        ) : (
                            <span className="bg-rose-100 text-rose-900 border border-rose-300 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
                                <span>⚠️</span> Over Target: {qsDifference} Questions Over Limit ({grandTotalQs}/{targetQs} Qs)
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* View Mode Switcher & Filter Controls */}
            <div className="p-4 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    {/* View Switcher */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
                        <button
                            type="button"
                            onClick={() => setViewMode('dropdown')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                                viewMode === 'dropdown'
                                    ? 'bg-navy text-gold shadow-sm'
                                    : 'text-gray-600 hover:text-navy'
                            }`}
                        >
                            <span>📁 Chapter Dropdowns</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                                viewMode === 'table'
                                    ? 'bg-navy text-gold shadow-sm'
                                    : 'text-gray-600 hover:text-navy'
                            }`}
                        >
                            <span>📊 Matrix Table</span>
                        </button>
                    </div>

                    {viewMode === 'dropdown' && (
                        <div className="flex items-center gap-2 ml-2">
                            <button
                                type="button"
                                onClick={expandAll}
                                className="text-[11px] font-bold text-navy hover:underline cursor-pointer"
                            >
                                Expand All
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={collapseAll}
                                className="text-[11px] font-bold text-gray-500 hover:underline cursor-pointer"
                            >
                                Collapse All
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative max-w-xs">
                        <input
                            type="text"
                            placeholder="Filter chapters..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="bg-slate-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-navy outline-none focus:ring-2 focus:ring-navy w-52"
                        />
                        <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                    </div>
                    <span className="text-xs font-bold text-gray-500">
                        {visibleChapters.length} Chapters
                    </span>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                VIEW 1: CHAPTER DROPDOWNS (ACCORDION CARDS)
            ══════════════════════════════════════════════════════════════ */}
            {viewMode === 'dropdown' && (
                <div className="p-4 md:p-6 space-y-3 max-h-[520px] overflow-y-auto bg-slate-50/50">
                    {visibleChapters.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-xs">
                            No chapters match "{searchFilter}". Check spelling or clear filter.
                        </div>
                    ) : (
                        visibleChapters.map((ch, idx) => {
                            const isOpen = Boolean(openDropdowns[ch]);
                            const stats = chapterStats[ch] || { qCount: 0, markCount: 0, secA: 0, secB: 0 };
                            const row = matrix[ch] || { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 };

                            return (
                                <div
                                    key={ch}
                                    className={`bg-white rounded-2xl border-2 transition-all duration-200 shadow-xs overflow-hidden ${
                                        stats.qCount > 0 ? 'border-navy/30 ring-1 ring-navy/10' : 'border-gray-200'
                                    }`}
                                >
                                    {/* Dropdown Header Bar */}
                                    <div
                                        onClick={() => toggleChapterDropdown(ch)}
                                        className="p-3.5 md:px-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 select-none transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-transform duration-200 ${
                                                isOpen ? 'rotate-90 bg-navy text-gold' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                ▶
                                            </span>
                                            <div>
                                                <span className="text-[10px] font-black uppercase text-gold bg-navy px-2 py-0.5 rounded-md mr-2">
                                                    Ch {idx + 1}
                                                </span>
                                                <span className="text-xs md:text-sm font-black text-navy uppercase tracking-tight">
                                                    {ch}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {stats.qCount > 0 && (
                                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-xl">
                                                    {stats.qCount} Qs • {stats.markCount} M
                                                </span>
                                            )}
                                            {isJEE && stats.secB > 0 && (
                                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-1 rounded-xl">
                                                    {stats.secB} Num (Sec B)
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400 font-bold ml-1">
                                                {isOpen ? '▲' : '▼'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Dropdown Expanded Question Types Content */}
                                    {isOpen && (
                                        <div className="p-4 pt-2 border-t border-gray-100 bg-slate-50/70">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                                {QUESTION_TYPE_CONFIG.map(t => {
                                                    const val = row[t.key] || 0;
                                                    return (
                                                        <div
                                                            key={t.key}
                                                            className={`bg-white p-2.5 rounded-xl border-2 transition ${
                                                                val > 0 ? 'border-navy shadow-xs' : 'border-gray-200'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-tight text-navy truncate" title={t.label}>
                                                                    {t.short}
                                                                </span>
                                                                {isJEE && (
                                                                    <span className={`text-[8px] font-black px-1.5 py-0.2 rounded ${
                                                                        t.section === 'B' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                                                                    }`}>
                                                                        Sec {t.section}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* - / Input / + Controls */}
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStepChange(ch, t.key, -1)}
                                                                    disabled={val <= 0}
                                                                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:pointer-events-none text-navy font-black text-xs flex items-center justify-center cursor-pointer"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="99"
                                                                    value={val === 0 ? '' : val}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(ch, t.key, e.target.value)}
                                                                    className="w-full text-center font-black text-xs text-navy py-1 rounded-lg border border-gray-200 outline-none focus:border-navy bg-white"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStepChange(ch, t.key, 1)}
                                                                    className="w-7 h-7 rounded-lg bg-navy hover:bg-gold hover:text-navy text-gold font-black text-xs flex items-center justify-center cursor-pointer transition shadow-xs"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                VIEW 2: SPREADSHEET MATRIX TABLE VIEW
            ══════════════════════════════════════════════════════════════ */}
            {viewMode === 'table' && (
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 sticky top-0 z-10 border-b border-gray-200 shadow-xs">
                            <tr>
                                <th className="p-3 font-black text-navy uppercase tracking-wider text-[11px] w-60">
                                    Chapter Name
                                </th>
                                <th className="p-2.5 font-black text-center text-emerald-800 text-[10px] uppercase tracking-wider bg-emerald-50/50">
                                    MCQ (Single)
                                </th>
                                <th className="p-2.5 font-black text-center text-purple-800 text-[10px] uppercase tracking-wider bg-purple-50/50">
                                    A/R (Assertion)
                                </th>
                                <th className="p-2.5 font-black text-center text-blue-800 text-[10px] uppercase tracking-wider bg-blue-50/50">
                                    Statement I&II
                                </th>
                                <th className="p-2.5 font-black text-center text-amber-900 text-[10px] uppercase tracking-wider bg-amber-50">
                                    Numerical (Sec B)
                                </th>
                                <th className="p-2.5 font-black text-center text-indigo-800 text-[10px] uppercase tracking-wider bg-indigo-50/50">
                                    Diagrammatic
                                </th>
                                <th className="p-2.5 font-black text-center text-teal-800 text-[10px] uppercase tracking-wider bg-teal-50/50">
                                    Matrix Match
                                </th>
                                <th className="p-3 font-black text-center text-navy text-[10px] uppercase tracking-wider bg-slate-200">
                                    Total Qs
                                </th>
                                <th className="p-3 font-black text-center text-gold bg-navy text-[10px] uppercase tracking-wider">
                                    Total Marks
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleChapters.map((ch, idx) => {
                                const row = matrix[ch] || { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 };
                                const stats = chapterStats[ch] || { qCount: 0, markCount: 0 };

                                return (
                                    <tr key={ch} className="hover:bg-slate-50 transition">
                                        <td className="p-3 font-bold text-navy text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-400">{idx + 1}.</span>
                                                <span className="truncate max-w-xs" title={ch}>{ch}</span>
                                            </div>
                                        </td>
                                        {['mcq', 'ar', 'stmt', 'num', 'diag', 'match'].map(tKey => (
                                            <td key={tKey} className="p-1.5 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="50"
                                                    value={row[tKey] === 0 ? '' : row[tKey]}
                                                    placeholder="0"
                                                    onChange={(e) => handleCellChange(ch, tKey, e.target.value)}
                                                    className="w-12 text-center font-bold text-navy py-1 rounded-lg border border-gray-200 outline-none focus:border-navy focus:ring-1 focus:ring-navy"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-3 text-center font-black text-navy bg-slate-50 text-xs">
                                            {stats.qCount}
                                        </td>
                                        <td className="p-3 text-center font-black text-navy bg-gold/10 text-xs">
                                            {stats.markCount} M
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white font-black sticky bottom-0 z-10 border-t-2 border-gold text-xs">
                            <tr>
                                <td className="p-3 uppercase tracking-wider text-[11px] text-gold">Grand Totals</td>
                                <td className="p-2 text-center">{totalMCQ}</td>
                                <td className="p-2 text-center">{totalAR}</td>
                                <td className="p-2 text-center">{totalStmt}</td>
                                <td className="p-2 text-center text-amber-300">{totalNum}</td>
                                <td className="p-2 text-center">{totalDiag}</td>
                                <td className="p-2 text-center">{totalMatch}</td>
                                <td className="p-3 text-center bg-gold text-navy text-sm font-black">{grandTotalQs}</td>
                                <td className="p-3 text-center bg-gold text-navy text-sm font-black">{grandTotalMarks} M</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="p-5 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-gray-600 font-medium">
                    {grandTotalQs === targetQs ? (
                        <span className="text-emerald-700 font-black flex items-center gap-1">
                            <span>✓</span> Exactly {grandTotalQs} Questions ({grandTotalMarks} Marks) allocated according to blueprint.
                        </span>
                    ) : (
                        <span className="text-amber-800 font-semibold">
                            Target is {targetQs} Qs ({targetMarks} M). Currently {grandTotalQs} Qs allocated.
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleFormSubmit}
                        disabled={isGenerating || grandTotalQs === 0}
                        className="bg-navy hover:scale-105 disabled:opacity-40 disabled:pointer-events-none text-gold border-2 border-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-xl flex items-center gap-2 cursor-pointer"
                    >
                        <span>⚡</span>
                        <span>{isGenerating ? 'Extracting Questions...' : `Generate ${grandTotalQs} Questions from Blueprint`}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
