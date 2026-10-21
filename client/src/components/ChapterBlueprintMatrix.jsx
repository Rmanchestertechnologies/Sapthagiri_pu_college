import React, { useState, useMemo, useEffect } from 'react';

/**
 * ChapterBlueprintMatrix.jsx
 *
 * Professional Objective & Competitive Exam Blueprint Matrix
 * Designed for Sapthagiri PU College (JEE, NEET, CET, and Competitive Formats).
 *
 * Question Types strictly aligned with Database:
 *  1. MCQ (Single Correct Multiple Choice)
 *  2. Assertion & Reason (A/R)
 *  3. Statement Based (Statement I & II)
 *  4. Numerical / Integer Type
 *  5. Diagrammatic / Image Based
 *  6. Matrix Match (Match the Following)
 *
 * Features:
 *  - Real-time auto-calculation of:
 *      * Total questions allocated per chapter
 *      * Total marks allocated per chapter
 *      * Column totals for each question type
 *      * Grand total questions & Grand total marks
 *  - Target Questions and Marks Configuration with instant validation banner
 *  - Fast standard presets (NEET 45 Qs/180M, JEE 25 Qs/100M, CET 60 Qs/60M, Even Distribution)
 *  - Non-destructive and fully reactive
 */

export default function ChapterBlueprintMatrix({
    chapters = [],
    subject = 'Physics',
    examType = 'NEET_PCB',
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
            stats[ch] = { qCount, markCount };
        });

        const totalQs = tMCQ + tAR + tStmt + tNum + tDiag + tMatch;
        const totalMarksSum = totalQs * marksPerQ;

        return {
            chapterStats: stats,
            totalMCQ: tMCQ,
            totalAR: tAR,
            totalStmt: tStmt,
            totalNum: tNum,
            totalDiag: tDiag,
            totalMatch: tMatch,
            grandTotalQs: totalQs,
            grandTotalMarks: totalMarksSum,
        };
    }, [chapters, matrix, marksPerQ]);

    // Target comparison difference
    const qsDifference = grandTotalQs - targetQs;
    const marksDifference = grandTotalMarks - targetMarks;

    // Apply NEET Preset (45 Questions / 180 Marks: e.g. 30 MCQs, 5 A/R, 5 Statement, 5 Diagram)
    const applyNEETPreset = () => {
        if (chapters.length === 0) return;
        setTargetQs(45);
        setMarksPerQ(4);
        const next = {};
        const chCount = chapters.length;

        // Distribute 30 MCQs, 5 AR, 5 Stmt, 5 Diag round-robin across chapters
        chapters.forEach((ch, idx) => {
            const mcqShare = Math.floor(30 / chCount) + (idx < (30 % chCount) ? 1 : 0);
            const arShare = idx < 5 ? 1 : 0;
            const stmtShare = idx >= 5 && idx < 10 ? 1 : (idx === 0 && chCount < 5 ? 1 : 0);
            const diagShare = idx >= 10 && idx < 15 ? 1 : (idx === 1 && chCount < 5 ? 1 : 0);

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

    // Apply JEE Main Preset (25 Questions / 100 Marks: 20 MCQs/Diagrams + 5 Numericals)
    const applyJEEPreset = () => {
        if (chapters.length === 0) return;
        setTargetQs(25);
        setMarksPerQ(4);
        const next = {};
        const chCount = chapters.length;

        chapters.forEach((ch, idx) => {
            const mcqShare = Math.floor(18 / chCount) + (idx < (18 % chCount) ? 1 : 0);
            const diagShare = idx < 2 ? 1 : 0;
            const numShare = idx < 5 ? 1 : 0;

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

    // Apply KCET Preset (60 Questions / 60 Marks: 60 MCQs)
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
            alert('Please allocate at least 1 question in the blueprint matrix.');
            return;
        }
        if (onGenerate) {
            onGenerate(matrix, targetMarks, targetQs, marksPerQ);
        }
    };

    return (
        <div className="bg-white rounded-3xl border-2 border-navy/20 shadow-xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-navy via-navy/95 to-slate-900 text-white p-6 border-b-4 border-gold">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-navy uppercase tracking-[0.2em] bg-gold px-3 py-0.5 rounded-full">
                                Objective & Competitive Matrix
                            </span>
                            <span className="text-xs text-white/70 font-semibold">• {subject}</span>
                            <span className="text-xs text-gold/90 font-mono">[{examType}]</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-white mt-1 uppercase tracking-tight flex items-center gap-2">
                            <span>📐</span>
                            <span>Chapter Weightage & Question Type Matrix</span>
                        </h2>
                        <p className="text-xs text-slate-300 font-medium mt-1">
                            Allocate exact question counts per chapter across competitive exam types: MCQs, Assertion-Reason, Statement-Based, Numericals, Diagrams, and Matrix Match.
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
                    <span className="text-[11px] font-bold text-white/60 mr-1">Exam Presets:</span>
                    <button
                        type="button"
                        onClick={applyNEETPreset}
                        className="bg-white/15 hover:bg-gold hover:text-navy text-white px-3 py-1.5 rounded-xl font-bold transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                        <span>🩺</span> NEET (45 Qs • 180M)
                    </button>
                    <button
                        type="button"
                        onClick={applyJEEPreset}
                        className="bg-white/15 hover:bg-gold hover:text-navy text-white px-3 py-1.5 rounded-xl font-bold transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                        <span>⚡</span> JEE Main (25 Qs • 100M)
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
                                ℹ️ Enter Question Counts Below
                            </span>
                        ) : qsDifference === 0 ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
                                <span>✓</span> Target Match: Exactly {targetQs} Questions ({targetMarks} Marks) Allocated!
                            </span>
                        ) : qsDifference < 0 ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
                                <span>⚠️</span> Under Target: {Math.abs(qsDifference)} Questions Remaining ({grandTotalQs}/{targetQs} Qs • {grandTotalMarks}/{targetMarks} M)
                            </span>
                        ) : (
                            <span className="bg-rose-100 text-rose-900 border border-rose-300 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
                                <span>⚠️</span> Over Target: {qsDifference} Questions Over Limit ({grandTotalQs}/{targetQs} Qs • {grandTotalMarks}/{targetMarks} M)
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Chapter Table Filter */}
            <div className="p-4 border-b border-gray-100 bg-white flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <input
                        type="text"
                        placeholder="Search chapter in blueprint..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-navy outline-none focus:ring-2 focus:ring-navy"
                    />
                    <span className="absolute left-3 top-2 text-gray-400 text-xs">🔍</span>
                </div>
                <span className="text-xs font-bold text-gray-500">
                    Showing {visibleChapters.length} of {chapters.length} Chapters
                </span>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                    <thead className="bg-navy text-white sticky top-0 z-10 shadow-xs">
                        <tr>
                            <th className="p-3 pl-4 font-black uppercase tracking-wider text-[11px] w-4/12">
                                Chapter Name
                            </th>
                            <th className="p-2.5 font-black uppercase tracking-wider text-[10px] text-center w-[9%] bg-navy/90" title="Single Correct Multiple Choice">
                                MCQ<br/><span className="text-[9px] text-gold font-bold">Single</span>
                            </th>
                            <th className="p-2.5 font-black uppercase tracking-wider text-[10px] text-center w-[9%] bg-navy/90" title="Assertion & Reason Statements">
                                A / R<br/><span className="text-[9px] text-gold font-bold">Assertion</span>
                            </th>
                            <th className="p-2.5 font-black uppercase tracking-wider text-[10px] text-center w-[9%] bg-navy/90" title="Statement I & Statement II Questions">
                                Stmt<br/><span className="text-[9px] text-gold font-bold">Statement</span>
                            </th>
                            <th className="p-2.5 font-black uppercase tracking-wider text-[10px] text-center w-[9%] bg-navy/90" title="Numerical / Integer Answer">
                                Num<br/><span className="text-[9px] text-gold font-bold">Integer</span>
                            </th>
                            <th className="p-2.5 font-black uppercase tracking-wider text-[10px] text-center w-[9%] bg-navy/90" title="Diagrammatic / Image Based">
                                Diag<br/><span className="text-[9px] text-gold font-bold">Diagram</span>
                            </th>
                            <th className="p-2.5 font-black uppercase tracking-wider text-[10px] text-center w-[9%] bg-navy/90" title="Match the Following / Matrix Match">
                                Match<br/><span className="text-[9px] text-gold font-bold">Matrix</span>
                            </th>
                            <th className="p-2.5 font-black uppercase tracking-wider text-[10px] text-center w-[10%] bg-slate-800">
                                Total Qs
                            </th>
                            <th className="p-2.5 pr-4 font-black uppercase tracking-wider text-[10px] text-center w-[10%] bg-slate-800 text-gold">
                                Total Marks
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {visibleChapters.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-8 text-center text-gray-400 font-bold">
                                    No chapters match your search filter.
                                </td>
                            </tr>
                        ) : (
                            visibleChapters.map((ch, idx) => {
                                const row = matrix[ch] || { mcq: 0, ar: 0, stmt: 0, num: 0, diag: 0, match: 0 };
                                const stats = chapterStats[ch] || { qCount: 0, markCount: 0 };
                                const hasAlloc = stats.qCount > 0;

                                return (
                                    <tr
                                        key={ch}
                                        className={`hover:bg-blue-50/50 transition-colors ${
                                            hasAlloc ? 'bg-amber-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                                        }`}
                                    >
                                        <td className="p-3 pl-4 font-bold text-navy">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
                                                <span className="truncate max-w-xs block" title={ch}>{ch}</span>
                                            </div>
                                        </td>
                                        {/* MCQ input */}
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={row.mcq || ''}
                                                placeholder="0"
                                                onChange={(e) => handleCellChange(ch, 'mcq', e.target.value)}
                                                className={`w-12 text-center font-bold text-xs py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-navy transition ${
                                                    row.mcq > 0 ? 'bg-navy text-gold border-navy font-black shadow-xs' : 'bg-white border-gray-300 text-gray-700'
                                                }`}
                                            />
                                        </td>
                                        {/* A/R input */}
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={row.ar || ''}
                                                placeholder="0"
                                                onChange={(e) => handleCellChange(ch, 'ar', e.target.value)}
                                                className={`w-12 text-center font-bold text-xs py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-navy transition ${
                                                    row.ar > 0 ? 'bg-navy text-gold border-navy font-black shadow-xs' : 'bg-white border-gray-300 text-gray-700'
                                                }`}
                                            />
                                        </td>
                                        {/* Stmt input */}
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={row.stmt || ''}
                                                placeholder="0"
                                                onChange={(e) => handleCellChange(ch, 'stmt', e.target.value)}
                                                className={`w-12 text-center font-bold text-xs py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-navy transition ${
                                                    row.stmt > 0 ? 'bg-navy text-gold border-navy font-black shadow-xs' : 'bg-white border-gray-300 text-gray-700'
                                                }`}
                                            />
                                        </td>
                                        {/* Num input */}
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={row.num || ''}
                                                placeholder="0"
                                                onChange={(e) => handleCellChange(ch, 'num', e.target.value)}
                                                className={`w-12 text-center font-bold text-xs py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-navy transition ${
                                                    row.num > 0 ? 'bg-navy text-gold border-navy font-black shadow-xs' : 'bg-white border-gray-300 text-gray-700'
                                                }`}
                                            />
                                        </td>
                                        {/* Diag input */}
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={row.diag || ''}
                                                placeholder="0"
                                                onChange={(e) => handleCellChange(ch, 'diag', e.target.value)}
                                                className={`w-12 text-center font-bold text-xs py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-navy transition ${
                                                    row.diag > 0 ? 'bg-navy text-gold border-navy font-black shadow-xs' : 'bg-white border-gray-300 text-gray-700'
                                                }`}
                                            />
                                        </td>
                                        {/* Match input */}
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={row.match || ''}
                                                placeholder="0"
                                                onChange={(e) => handleCellChange(ch, 'match', e.target.value)}
                                                className={`w-12 text-center font-bold text-xs py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-navy transition ${
                                                    row.match > 0 ? 'bg-navy text-gold border-navy font-black shadow-xs' : 'bg-white border-gray-300 text-gray-700'
                                                }`}
                                            />
                                        </td>
                                        {/* Chapter Total Qs */}
                                        <td className="p-2 text-center font-black text-navy bg-slate-100/60">
                                            {stats.qCount}
                                        </td>
                                        {/* Chapter Total Marks */}
                                        <td className="p-2 pr-4 text-center font-black text-navy bg-slate-100/60">
                                            <span className={stats.markCount > 0 ? 'text-navy font-black' : 'text-gray-400'}>
                                                {stats.markCount} M
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                    {/* Summary Footer Row */}
                    <tfoot className="bg-slate-900 text-white font-black sticky bottom-0 z-10 border-t-2 border-gold shadow-lg">
                        <tr>
                            <td className="p-3 pl-4 uppercase tracking-wider text-xs">
                                Grand Type Totals
                            </td>
                            <td className="p-2 text-center text-gold text-xs">
                                {totalMCQ} <span className="text-[9px] text-white/70 block font-normal">MCQ</span>
                            </td>
                            <td className="p-2 text-center text-gold text-xs">
                                {totalAR} <span className="text-[9px] text-white/70 block font-normal">A/R</span>
                            </td>
                            <td className="p-2 text-center text-gold text-xs">
                                {totalStmt} <span className="text-[9px] text-white/70 block font-normal">Stmt</span>
                            </td>
                            <td className="p-2 text-center text-gold text-xs">
                                {totalNum} <span className="text-[9px] text-white/70 block font-normal">Num</span>
                            </td>
                            <td className="p-2 text-center text-gold text-xs">
                                {totalDiag} <span className="text-[9px] text-white/70 block font-normal">Diag</span>
                            </td>
                            <td className="p-2 text-center text-gold text-xs">
                                {totalMatch} <span className="text-[9px] text-white/70 block font-normal">Match</span>
                            </td>
                            <td className="p-2 text-center bg-slate-950 text-white text-xs font-black">
                                {grandTotalQs} Qs
                            </td>
                            <td className="p-2 pr-4 text-center bg-slate-950 text-gold text-sm font-black">
                                {grandTotalMarks} M
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-6 bg-slate-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                            Cancel
                        </button>
                    )}
                    <span className="text-xs text-gray-500 font-medium">
                        {grandTotalQs} questions allocated totaling {grandTotalMarks} marks (@ {marksPerQ} M/Q).
                    </span>
                </div>

                <button
                    type="button"
                    onClick={handleFormSubmit}
                    disabled={grandTotalQs === 0 || isGenerating}
                    className="bg-gold text-navy hover:scale-105 disabled:opacity-40 disabled:pointer-events-none px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                    <span>⚡</span>
                    <span>{isGenerating ? 'Sampling Questions Pool...' : `Generate Paper (${grandTotalQs} Qs • ${grandTotalMarks} M)`}</span>
                </button>
            </div>
        </div>
    );
}
