import React, { useState, useEffect, useMemo } from 'react';
import MathRenderer from './MathRenderer';
import api from '../api';
import { optionLabel, isOptionCorrect } from '../utils/sanitize';

/**
 * Quick Math / LaTeX Symbol Inserter Toolbar
 */
function LatexToolbar({ onInsert }) {
    const symbols = [
        { label: '$\\frac{a}{b}$', insert: '\\frac{a}{b}' },
        { label: '$x^2$', insert: '^{2}' },
        { label: '$x_i$', insert: '_{i}' },
        { label: '$\\sqrt{x}$', insert: '\\sqrt{x}' },
        { label: '$\\alpha$', insert: '\\alpha' },
        { label: '$\\beta$', insert: '\\beta' },
        { label: '$\\theta$', insert: '\\theta' },
        { label: '$\\pi$', insert: '\\pi' },
        { label: '$\\Delta$', insert: '\\Delta' },
        { label: '$\\lambda$', insert: '\\lambda' },
        { label: '$\\mu$', insert: '\\mu' },
        { label: '$\\Omega$', insert: '\\Omega' },
        { label: '$\\pm$', insert: '\\pm' },
        { label: '$\\times$', insert: '\\times' },
        { label: '$\\rightarrow$', insert: '\\rightarrow' },
        { label: '$\\infty$', insert: '\\infty' },
        { label: '$\\approx$', insert: '\\approx' },
        { label: '$\\le$', insert: '\\le' },
        { label: '$\\ge$', insert: '\\ge' },
        { label: '$\\vec{F}$', insert: '\\vec{F}' },
        { label: '$...$', insert: '$ $' },
    ];

    return (
        <div className="flex items-center gap-1.5 flex-wrap p-2 bg-slate-100 rounded-xl border border-slate-200 mb-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider mr-1">
                Quick LaTeX:
            </span>
            {symbols.map((sym, idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => onInsert(sym.insert)}
                    className="px-2 py-0.5 bg-white hover:bg-navy hover:text-gold text-slate-800 rounded-lg text-xs font-mono font-bold border border-slate-300 transition shadow-2xs cursor-pointer"
                    title={`Insert ${sym.insert}`}
                >
                    <MathRenderer inline text={sym.label} />
                </button>
            ))}
        </div>
    );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EDIT QUESTION MODAL (Full LaTeX Editing + Real-Time Live Preview)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function EditQuestionModal({
    isOpen,
    question,
    questionIndex,
    displayNum,
    onClose,
    onSave,
    onDelete,
}) {
    if (!isOpen || !question) return null;

    const initialQText = question.questionText || question.question || '';
    const initialSolText = question.solutionText || question.solution_text || question.solution || '';
    const initialOptions = useMemo(() => {
        if (Array.isArray(question.options) && question.options.length > 0) {
            return question.options.map(opt => typeof opt === 'object' ? (opt.text || opt.value || '') : String(opt));
        }
        const fallback = [question.opt_a, question.opt_b, question.opt_c, question.opt_d].filter(Boolean);
        return fallback.length > 0 ? fallback : ['', '', '', ''];
    }, [question]);

    const [qText, setQText] = useState(initialQText);
    const [solText, setSolText] = useState(initialSolText);
    const [options, setOptions] = useState(initialOptions);
    const [correctOption, setCorrectOption] = useState(
        question.correct_option || question.answer || '1'
    );
    const [numAnswer, setNumAnswer] = useState(question.num_answer || '');
    const [qType, setQType] = useState(question.type || question.q_type || 'MCQ');
    const [imageUrl, setImageUrl] = useState(question.imageUrl || question.image_url || '');
    const [difficulty, setDifficulty] = useState(question.difficulty || 'Medium');
    const [topic, setTopic] = useState(question.topic || question.chapter || 'Core Syllabus');

    // Reset when question prop changes
    useEffect(() => {
        setQText(question.questionText || question.question || '');
        setSolText(question.solutionText || question.solution_text || question.solution || '');
        if (Array.isArray(question.options) && question.options.length > 0) {
            setOptions(question.options.map(opt => typeof opt === 'object' ? (opt.text || opt.value || '') : String(opt)));
        } else {
            const fallback = [question.opt_a, question.opt_b, question.opt_c, question.opt_d].filter(Boolean);
            setOptions(fallback.length > 0 ? fallback : ['', '', '', '']);
        }
        setCorrectOption(question.correct_option || question.answer || '1');
        setNumAnswer(question.num_answer || '');
        setQType(question.type || question.q_type || 'MCQ');
        setImageUrl(question.imageUrl || question.image_url || '');
        setDifficulty(question.difficulty || 'Medium');
        setTopic(question.topic || question.chapter || 'Core Syllabus');
    }, [question]);

    const handleOptionChange = (idx, val) => {
        const next = [...options];
        next[idx] = val;
        setOptions(next);
    };

    const handleInsertIntoQText = (snippet) => {
        setQText(prev => prev + (snippet.startsWith(' ') ? '' : ' ') + snippet);
    };

    const handleInsertIntoSolText = (snippet) => {
        setSolText(prev => prev + (snippet.startsWith(' ') ? '' : ' ') + snippet);
    };

    const handleSave = () => {
        const updated = {
            ...question,
            questionText: qText,
            question: qText,
            solutionText: solText,
            solution_text: solText,
            solution: solText,
            options: options,
            opt_a: options[0] || '',
            opt_b: options[1] || '',
            opt_c: options[2] || '',
            opt_d: options[3] || '',
            correct_option: correctOption,
            answer: correctOption,
            num_answer: numAnswer,
            type: qType,
            q_type: qType,
            imageUrl: imageUrl || null,
            image_url: imageUrl || null,
            difficulty: difficulty,
            topic: topic,
            chapter: topic,
        };
        onSave(updated, questionIndex);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in no-print">
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-navy/20 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header matching Image 2 */}
                <div className="px-6 py-4 bg-navy text-white flex items-center justify-between border-b-2 border-gold flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">✏️</span>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-wider text-white">
                                Edit Question #{displayNum}
                            </h3>
                            <p className="text-[11px] font-bold text-gold/80">
                                Full LaTeX Math / KaTeX Support • Real-Time Interactive Preview
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black flex items-center justify-center transition cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Top Bar of Question Card matching Image 2 */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        {/* Left: Level Badge (Image 2 style) */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase text-amber-900 bg-amber-100 border border-amber-300 px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                                <span className="text-amber-500">●</span> Level: {difficulty}
                            </span>
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                                {['Easy', 'Medium', 'Hard'].map((lvl) => (
                                    <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => setDifficulty(lvl)}
                                        className={'px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ' + (difficulty === lvl ? 'bg-navy text-gold shadow-xs' : 'text-slate-600 hover:text-navy')}
                                    >
                                        {lvl}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right: Red Delete & Blue Edit Buttons matching Image 2 */}
                        <div className="flex items-center gap-2">
                            {onDelete && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to delete Question #' + displayNum + ' from this paper?')) {
                                            onDelete(questionIndex);
                                            onClose();
                                        }
                                    }}
                                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                                    title="Delete this question from paper"
                                >
                                    <span>🗑️</span> Delete
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                                title="Apply and save edits"
                            >
                                <span>✏️</span> Edit
                            </button>
                        </div>
                    </div>

                    {/* Quick LaTeX Toolbar */}
                    <LatexToolbar onInsert={handleInsertIntoQText} />

                    {/* Question Stem with Pencil Icon matching Image 2 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-1.5">
                                <span>✏️</span> Question Text (LaTeX Supported)
                            </label>
                            <span className="text-[10px] font-bold text-slate-500">
                                Tip: Enclose formulas in <code className="bg-slate-100 px-1 py-0.5 rounded text-navy">$...$</code>
                            </span>
                        </div>
                        <textarea
                            value={qText}
                            onChange={e => setQText(e.target.value)}
                            rows={4}
                            className="w-full p-3 text-xs font-mono bg-slate-900 text-emerald-300 rounded-xl border border-slate-700 focus:border-gold focus:ring-1 focus:ring-gold outline-none leading-relaxed"
                            placeholder="Type question stem in raw text or LaTeX..."
                        />
                        {/* Live LaTeX Preview */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                                👁️ Live Rendered Question Preview:
                            </span>
                            <div className="text-xs text-slate-900 leading-relaxed min-h-[28px] font-medium">
                                <MathRenderer text={qText || '(Live LaTeX preview will appear here)'} />
                            </div>
                        </div>
                    </div>

                    {/* Diagram Image URL (Optional) */}
                    <div>
                        <label className="text-xs font-black text-navy uppercase tracking-wider block mb-1">
                            Diagram Image URL (Optional)
                        </label>
                        <input
                            type="text"
                            value={imageUrl}
                            onChange={e => setImageUrl(e.target.value)}
                            placeholder="https://... or data:image/..."
                            className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-xl outline-none focus:border-navy"
                        />
                        {imageUrl && (
                            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase text-slate-500">Diagram:</span>
                                <img
                                    src={imageUrl}
                                    alt="Diagram preview"
                                    className="max-h-20 object-contain border border-slate-200 bg-white p-1 rounded-lg"
                                    onError={e => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Options Area matching Image 2 */}
                    {qType !== 'NUMERICAL' ? (
                        <div className="space-y-3">
                            <label className="text-xs font-black text-navy uppercase tracking-wider block">
                                Options & Correct Answer Key (Click letter circle to set correct answer)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {options.map((opt, idx) => {
                                    const optChar = String.fromCharCode(65 + idx); // A, B, C, D
                                    const optNum = String(idx + 1); // 1, 2, 3, 4
                                    const isCorrect = String(correctOption) === optChar || String(correctOption) === optNum || String(correctOption).toUpperCase() === optChar;

                                    return (
                                        <div
                                            key={idx}
                                            className={'p-3 rounded-2xl border-2 transition ' + (isCorrect ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200 bg-white hover:border-slate-300')}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                {/* Circular Badge matching Image 2 */}
                                                <button
                                                    type="button"
                                                    onClick={() => setCorrectOption(optNum)}
                                                    className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition cursor-pointer ' + (isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300')}
                                                    title={'Click to set Option ' + optChar + ' as correct key'}
                                                >
                                                    {optChar}
                                                </button>
                                                <span className="text-xs font-black text-slate-700">
                                                    Option ({optNum}) {isCorrect && <span className="text-emerald-700 font-bold ml-1 text-[11px]">(Correct Answer)</span>}
                                                </span>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={e => handleOptionChange(idx, e.target.value)}
                                                    placeholder={'Option ' + optChar + ' text / LaTeX...'}
                                                    className="w-full p-2 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none focus:border-navy mb-1 pr-7"
                                                />
                                                <span className="absolute right-2 top-2 text-xs text-slate-400">✏️</span>
                                            </div>

                                            {/* Live option LaTeX preview */}
                                            <div className="text-[11px] text-slate-800 bg-white/90 p-1.5 rounded-md border border-slate-100 min-h-[22px]">
                                                <MathRenderer inline text={opt || '—'} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-amber-50/60 border-2 border-amber-300 rounded-2xl space-y-2">
                            <label className="text-xs font-black text-amber-950 uppercase tracking-wider block">
                                Correct Numerical Answer Value
                            </label>
                            <input
                                type="text"
                                value={numAnswer}
                                onChange={e => setNumAnswer(e.target.value)}
                                placeholder="Enter numerical answer, e.g. 25, 4.5, -10"
                                className="w-full sm:w-64 p-2.5 text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl outline-none focus:border-amber-600"
                            />
                        </div>
                    )}

                    {/* Green-tinted Solution Box matching Image 2 */}
                    <div className="p-4 bg-[#f0fdf4] border-2 border-[#86efac] rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                <span>✏️</span> Solution:
                            </label>
                            <button
                                type="button"
                                onClick={() => handleInsertIntoSolText('\\therefore ')}
                                className="text-[10px] font-bold text-emerald-800 hover:underline cursor-pointer"
                            >
                                + Insert $\therefore$
                            </button>
                        </div>
                        <textarea
                            value={solText}
                            onChange={e => setSolText(e.target.value)}
                            rows={3}
                            className="w-full p-2.5 text-xs font-mono bg-white text-slate-900 rounded-xl border border-emerald-300 focus:border-emerald-600 outline-none leading-relaxed"
                            placeholder="Type step-by-step solution / hints in raw text or LaTeX..."
                        />
                        {/* Live Solution Preview */}
                        <div className="p-2.5 bg-white border border-emerald-200 rounded-xl space-y-1">
                            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                                👁️ Rendered Solution:
                            </span>
                            <div className="text-xs text-slate-800 leading-relaxed min-h-[24px]">
                                <MathRenderer text={solText || '(Solution preview will appear here)'} />
                            </div>
                        </div>
                    </div>

                    {/* Select Topic Pills matching Image 2 */}
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-navy uppercase tracking-wider">
                                Select Topic:
                            </span>
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                Current: {topic}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                question.topic || question.chapter || 'Topic 1',
                                'Mechanics',
                                'Thermodynamics',
                                'Electrodynamics',
                                'Optics & Modern Physics',
                                'Organic Chemistry',
                                'Inorganic Chemistry',
                                'Physical Chemistry',
                                'Calculus & Vectors',
                                'Algebra & Coordinate Geometry',
                                'Genetics & Evolution',
                                'Human Physiology',
                            ].filter((v, i, a) => v && a.indexOf(v) === i).map((tItem, tIdx) => (
                                <button
                                    key={tIdx}
                                    type="button"
                                    onClick={() => setTopic(tItem)}
                                    className={'px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ' + (topic === tItem ? 'bg-navy text-gold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}
                                >
                                    {tItem}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-300 transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:scale-102 transition cursor-pointer flex items-center gap-1.5"
                    >
                        <span>💾</span> Apply Changes to Paper
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAP QUESTION MODAL (Database Repository Search & Direct Replacement)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function SwapQuestionModal({
    isOpen,
    oldQuestion,
    questionIndex,
    displayNum,
    paperSubject,
    paperExamType,
    onClose,
    onSelectSwap,
}) {
    if (!isOpen || !oldQuestion) return null;

    const subject = oldQuestion.subject || paperSubject || 'Physics';
    const initialChapter = oldQuestion.chapter || '';

    const [chapter, setChapter] = useState(initialChapter);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchCandidates = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const queryParams = new URLSearchParams({
                subject,
                limit: '50',
                paginated: 'true',
            });
            if (paperExamType) queryParams.append('examType', paperExamType);
            if (chapter && chapter !== 'All') queryParams.append('chapter', chapter);
            if (searchKeyword.trim()) queryParams.append('search', searchKeyword.trim());
            if (levelFilter) queryParams.append('level', levelFilter);

            const res = await api.get(`/api/questions?${queryParams.toString()}`);
            const list = Array.isArray(res.data?.questions)
                ? res.data.questions
                : (Array.isArray(res.data) ? res.data : []);

            // Filter out the current question ID so user doesn't swap with same question
            const oldId = String(oldQuestion._id || oldQuestion.id || '');
            const filtered = list.filter(q => String(q._id || q.id || '') !== oldId);
            setCandidates(filtered);
        } catch (err) {
            console.error('Fetch swap candidates error:', err);
            setErrorMsg('Failed to load replacement questions. Please try a different search.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCandidates();
    }, [chapter, levelFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchCandidates();
    };

    const handleSelectQuestion = (chosenQ) => {
        onSelectSwap(questionIndex, chosenQ);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in no-print">
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-navy/20 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-navy text-white flex items-center justify-between border-b-2 border-gold flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🔄</span>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-wider text-white">
                                Swap Question #{displayNum}
                            </h3>
                            <p className="text-[11px] font-bold text-gold/80">
                                Select a replacement question from verified JEE & NEET repositories
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black flex items-center justify-center transition cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Currently In Paper Preview */}
                    <div className="p-4 bg-amber-50/70 border-2 border-amber-300 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                                Currently in Paper (Q#{displayNum})
                            </span>
                            <span className="text-[11px] font-bold text-amber-800">
                                Chapter: {oldQuestion.chapter || 'General'}
                            </span>
                        </div>
                        <div className="text-xs text-slate-900 font-medium leading-relaxed">
                            <MathRenderer text={oldQuestion.questionText || oldQuestion.question || ''} />
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <form onSubmit={handleSearchSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                            <input
                                type="text"
                                value={searchKeyword}
                                onChange={e => setSearchKeyword(e.target.value)}
                                placeholder="Search keyword, formula, or topic..."
                                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-navy"
                            />
                        </div>

                        {initialChapter && (
                            <button
                                type="button"
                                onClick={() => setChapter(c => c === 'All' ? initialChapter : 'All')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                    chapter !== 'All'
                                        ? 'bg-navy text-gold border-navy'
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                            >
                                {chapter !== 'All' ? `Same Chapter (${initialChapter})` : 'All Chapters'}
                            </button>
                        )}

                        <select
                            value={levelFilter}
                            onChange={e => setLevelFilter(e.target.value)}
                            className="p-2.5 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-navy"
                        >
                            <option value="">All Difficulties</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>

                        <button
                            type="submit"
                            className="px-4 py-2.5 bg-navy hover:bg-navy/90 text-gold rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition cursor-pointer"
                        >
                            🔍 Search
                        </button>
                    </form>

                    {/* Error Message */}
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200">
                            {errorMsg}
                        </div>
                    )}

                    {/* Candidates List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-black text-navy uppercase tracking-wider">
                            <span>Available Replacement Questions ({candidates.length})</span>
                            {loading && <span className="text-slate-400 font-bold lowercase">loading questions...</span>}
                        </div>

                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                                <div className="w-8 h-8 border-3 border-navy/20 border-t-navy rounded-full animate-spin" />
                                <span className="text-xs font-bold text-slate-400">Querying Question Bank...</span>
                            </div>
                        ) : candidates.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                No questions found matching this search criteria.<br />
                                Try searching "All Chapters" or clear the search keywords.
                            </div>
                        ) : (
                            candidates.map((cand, idx) => {
                                const candId = cand._id || cand.id;
                                const candOptions = Array.isArray(cand.options) && cand.options.length > 0
                                    ? cand.options
                                    : [cand.opt_a, cand.opt_b, cand.opt_c, cand.opt_d].filter(Boolean);

                                return (
                                    <div
                                        key={candId || idx}
                                        className="p-4 bg-white hover:bg-blue-50/40 border-2 border-slate-200 hover:border-navy rounded-2xl transition space-y-3 shadow-2xs"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-navy bg-slate-100 px-2 py-0.5 rounded">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                                    {cand.chapter || 'General'}
                                                </span>
                                                {cand.level && (
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        cand.level.toLowerCase() === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                                                        cand.level.toLowerCase() === 'hard' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {cand.level}
                                                    </span>
                                                )}
                                                {cand.sourceExam && (
                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                        {cand.sourceExam}
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectQuestion(cand)}
                                                className="px-4 py-1.5 bg-gold hover:bg-amber-400 text-navy font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition hover:scale-105 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                                            >
                                                <span>✓</span> Select & Swap
                                            </button>
                                        </div>

                                        {/* Question Text */}
                                        <div className="text-xs text-slate-900 font-medium leading-relaxed">
                                            <MathRenderer text={cand.questionText || cand.question || ''} />
                                        </div>

                                        {/* Diagram if present */}
                                        {(cand.imageUrl || cand.image_url) && (
                                            <div className="max-w-xs p-1 bg-slate-50 border border-slate-200 rounded-lg">
                                                <img
                                                    src={cand.imageUrl || cand.image_url}
                                                    alt="Diagram"
                                                    className="max-h-24 object-contain rounded"
                                                    onError={e => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}

                                        {/* Options Grid */}
                                        {candOptions.length > 0 && (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-700">
                                                {candOptions.slice(0, 4).map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex items-start gap-1 truncate">
                                                        <span className="font-bold text-navy">
                                                            ({String.fromCharCode(65 + oIdx)})
                                                        </span>
                                                        <span className="truncate">
                                                            <MathRenderer inline text={typeof opt === 'object' ? (opt.text || opt.value || '') : String(opt)} />
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500">
                        Replacing Question #{displayNum} in active paper
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-300 transition cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
