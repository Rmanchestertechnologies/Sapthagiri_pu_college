import { useState, useEffect, useMemo } from 'react';
import MathRenderer from './MathRenderer';
import { resolveImageUrl } from './QuestionImage';
import { QuestionPreviewBody } from './question/QuestionPreviewCard';
import { buildQuestionPreview, previewKind } from './question/previewModel';
import api from '../api';


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
 * EDIT QUESTION MODAL - "Update question" form with a live preview of exactly what prints
 * ─────────────────────────────────────────────────────────────────────────────
 * Every part of the question is a field of its own: the question text, the statements (statement questions), both columns
 * (match the following), Assertion and Reason, the four options, the answer and the solution. The preview on the right is the
 * same card the selection lists use, built with the paper's parsing, so what you see there is what the paper prints.
 */
const ROMAN_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const LABEL = 'mb-1 block text-[12px] font-semibold text-slate-600';

function FormField({ label, required = false, children, className = '' }) {
    return (
        <div className={className}>
            <label className={LABEL}>{label}{required && <span className="text-rose-500"> *</span>}</label>
            {children}
        </div>
    );
}

function initialEditState(question) {
    const kind = previewKind(question);
    const model = buildQuestionPreview(question) || {};
    const rawText = question.questionText || question.question || '';
    const opts = (Array.isArray(question.options) && question.options.length > 0)
        ? question.options.map(opt => (typeof opt === 'object' ? (opt.text || opt.value || '') : String(opt)))
        : [question.opt_a, question.opt_b, question.opt_c, question.opt_d].filter(Boolean);
    while (opts.length < 4) opts.push('');
    return {
        kind: model.kind || kind,
        // an ordinary question keeps its text exactly as stored; the structured kinds edit only the sentence around their parts
        stem: (model.kind || kind) === 'mcq' || (model.kind || kind) === 'numerical' || (model.kind || kind) === 'truefalse' ? rawText : (model.stem || ''),
        statements: (model.statements || []).map(s => ({ label: s.label, text: s.text })),
        outro: model.outro || '',
        assertion: model.assertion || '',
        reason: model.reason || '',
        left: model.columns ? model.columns.left.map(c => c.text) : [],
        right: model.columns ? model.columns.right.map(c => c.text) : [],
        options: opts,
        correctOption: String(question.correct_option || question.answer || '1'),
        numAnswer: question.num_answer || '',
        imageUrl: question.imageUrl || question.image_url || '',
        solution: question.solutionText || question.solution_text || question.solution || '',
        difficulty: question.difficulty || (question.level ? question.level[0].toUpperCase() + question.level.slice(1) : 'Medium'),
        topic: question.topic || question.concept || question.chapter || '',
    };
}

/** The edited question in the shape the paper reads (statements / matchPairs / assertion+reason as their own fields). */
function buildEditedQuestion(question, s) {
    const options = s.options.map(o => String(o || ''));
    const image = resolveImageUrl(s.imageUrl) || null;
    const q = {
        ...question,
        solutionText: s.solution, solution_text: s.solution, solution: s.solution,
        options, opt_a: options[0] || '', opt_b: options[1] || '', opt_c: options[2] || '', opt_d: options[3] || '',
        correct_option: s.correctOption, answer: s.correctOption, num_answer: s.numAnswer,
        imageUrl: image, image_url: image,
        difficulty: s.difficulty, level: String(s.difficulty || '').toLowerCase(),
        topic: s.topic, concept: s.topic,
    };
    let text = s.stem;
    if (s.kind === 'statement') {
        q.statements = s.statements.filter(st => String(st.text).trim()).map((st, i) => ({ label: st.label || `Statement ${ROMAN_LABELS[i] || i + 1}:`, text: st.text }));
        q.outroText = s.outro || null;
    } else if (s.kind === 'assertion') {
        q.assertion = s.assertion; q.reason = s.reason;
        text = `${s.stem ? `${s.stem}\n` : ''}Assertion: ${s.assertion}\nReason: ${s.reason}`;
    } else if (s.kind === 'match') {
        const rows = Math.max(s.left.length, s.right.length);
        const left = s.left.map(t => String(t || '').trim()).filter(Boolean);
        const right = s.right.map(t => String(t || '').trim()).filter(Boolean);
        q.matchPairs = Array.from({ length: rows }, (_, i) => ({ left: left[i] || '', right: right[i] || '' })).filter(p => p.left || p.right);
        q.column_a = left; q.column_b = right; q.columnA = left; q.columnB = right;
    }
    q.questionText = text; q.question = text;
    return q;
}

function EditQuestionModalInner({
    isOpen,
    question,
    questionIndex,
    displayNum,
    onClose,
    onSave,
    onDelete,
}) {
    const [s, setS] = useState(() => initialEditState(question));
    useEffect(() => { setS(initialEditState(question)); }, [question]);
    const set = (patch) => setS(prev => ({ ...prev, ...patch }));
    const setListItem = (key, idx, val) => setS(prev => ({ ...prev, [key]: prev[key].map((v, i) => (i === idx ? val : v)) }));
    const draft = useMemo(() => buildEditedQuestion(question, s), [question, s]);

    const handleSave = () => {
        onSave(draft, questionIndex);
        onClose();
    };
    if (!isOpen) return null;
    const typeName = { mcq: 'MCQ Question', statement: 'Statement Based', match: 'Match the Following', assertion: 'Assertion & Reason', numerical: 'Numerical', truefalse: 'True / False' }[s.kind] || 'MCQ Question';
    const optionCount = s.options.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm animate-fade-in no-print">
            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* header */}
                <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
                    <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-800">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] text-white">Q</span>
                        Update Question #{displayNum}
                    </h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    {/* form */}
                    <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField label="Question Type">
                                <div className={`${FIELD} bg-slate-100 text-slate-600`}>{typeName}</div>
                            </FormField>
                            <FormField label="Level">
                                <select value={s.difficulty} onChange={e => set({ difficulty: e.target.value })} className={`${FIELD} cursor-pointer`}>
                                    <option value="Easy">L1 - Easy</option>
                                    <option value="Medium">L2 - Medium</option>
                                    <option value="Hard">L3 - Hard</option>
                                </select>
                            </FormField>
                            <FormField label="Topic" className="sm:col-span-2">
                                <input value={s.topic} onChange={e => set({ topic: e.target.value })} className={FIELD} placeholder="Topic / concept" />
                            </FormField>
                        </div>

                        <LatexToolbar onInsert={(snippet) => set({ stem: `${s.stem}${snippet.startsWith(' ') ? '' : ' '}${snippet}` })} />

                        <FormField label={s.kind === 'mcq' || s.kind === 'numerical' ? 'Question' : 'Question (the sentence before the parts below)'} required={s.kind === 'mcq'}>
                            <textarea value={s.stem} onChange={e => set({ stem: e.target.value })} rows={3} className={`${FIELD} leading-relaxed`} placeholder="Type the question. Put maths in $...$" />
                        </FormField>

                        {/* statements */}
                        {s.kind === 'statement' && (
                            <div className="space-y-2">
                                <label className={LABEL}>Statements</label>
                                {s.statements.map((st, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="mt-2 w-24 shrink-0 text-[12px] font-bold text-slate-700">{st.label || `Statement ${ROMAN_LABELS[i] || i + 1}:`}</span>
                                        <textarea value={st.text} rows={2} onChange={e => setS(prev => ({ ...prev, statements: prev.statements.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} className={`${FIELD} leading-relaxed`} />
                                        <button type="button" onClick={() => setS(prev => ({ ...prev, statements: prev.statements.filter((_, j) => j !== i) }))} className="mt-2 cursor-pointer text-[12px] font-bold text-rose-500 hover:text-rose-700" aria-label="Remove statement">✕</button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setS(prev => ({ ...prev, statements: [...prev.statements, { label: `Statement ${ROMAN_LABELS[prev.statements.length] || prev.statements.length + 1}:`, text: '' }] }))} className="cursor-pointer text-[12px] font-bold text-blue-600 hover:underline">+ Add statement</button>
                                <FormField label="Line after the statements (optional)">
                                    <input value={s.outro} onChange={e => set({ outro: e.target.value })} className={FIELD} placeholder="e.g. Choose the correct answer from the options given below." />
                                </FormField>
                            </div>
                        )}

                        {/* assertion & reason */}
                        {s.kind === 'assertion' && (
                            <div className="grid grid-cols-1 gap-3">
                                <FormField label="Assertion (A)" required><textarea value={s.assertion} rows={2} onChange={e => set({ assertion: e.target.value })} className={FIELD} /></FormField>
                                <FormField label="Reason (R)" required><textarea value={s.reason} rows={2} onChange={e => set({ reason: e.target.value })} className={FIELD} /></FormField>
                            </div>
                        )}

                        {/* match the following */}
                        {s.kind === 'match' && (
                            <div>
                                <label className={LABEL}>Columns</label>
                                <div className="overflow-hidden rounded-lg border border-slate-300">
                                    <div className="grid grid-cols-2 bg-slate-100 text-[12px] font-bold text-slate-700">
                                        <div className="border-r border-slate-300 px-3 py-1.5">Column I</div>
                                        <div className="px-3 py-1.5">Column II</div>
                                    </div>
                                    {Array.from({ length: Math.max(s.left.length, s.right.length, 2) }).map((_, i) => (
                                        <div key={i} className="grid grid-cols-2 border-t border-slate-200">
                                            <div className="flex items-center gap-2 border-r border-slate-300 px-2 py-1.5">
                                                <span className="w-5 shrink-0 text-center text-[12px] font-bold">{String.fromCharCode(65 + i)}</span>
                                                <input value={s.left[i] || ''} onChange={e => setS(prev => { const left = [...prev.left]; left[i] = e.target.value; return { ...prev, left }; })} className={`${FIELD} py-1.5`} />
                                            </div>
                                            <div className="flex items-center gap-2 px-2 py-1.5">
                                                <span className="w-6 shrink-0 text-center text-[12px] font-bold">({i + 1})</span>
                                                <input value={s.right[i] || ''} onChange={e => setS(prev => { const right = [...prev.right]; right[i] = e.target.value; return { ...prev, right }; })} className={`${FIELD} py-1.5`} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={() => setS(prev => ({ ...prev, left: [...prev.left, ''], right: [...prev.right, ''] }))} className="mt-1.5 cursor-pointer text-[12px] font-bold text-blue-600 hover:underline">+ Add row</button>
                                <p className="mt-1 text-[11px] text-slate-500">Options are codes in these labels, e.g. A-(2), B-(4), C-(1), D-(3).</p>
                            </div>
                        )}

                        <FormField label="Question Image (URL)">
                            <input value={s.imageUrl} onChange={e => set({ imageUrl: e.target.value })} className={`${FIELD} font-mono text-[12px]`} placeholder="https://..." />
                        </FormField>

                        {/* options */}
                        {s.kind !== 'numerical' ? (
                            <>
                                {s.options.map((opt, i) => (
                                    <FormField key={i} label={`Option ${i + 1}`} required>
                                        <textarea value={opt} rows={opt.length > 60 ? 2 : 1} onChange={e => setListItem('options', i, e.target.value)} className={`${FIELD} leading-relaxed`} />
                                    </FormField>
                                ))}
                                <FormField label="Answer" required>
                                    <select value={(() => { const c = s.correctOption.trim().toUpperCase(); return /^[A-H]$/.test(c) ? String(c.charCodeAt(0) - 64) : c; })()} onChange={e => set({ correctOption: e.target.value })} className={`${FIELD} cursor-pointer`}>
                                        {Array.from({ length: optionCount }).map((_, i) => <option key={i} value={String(i + 1)}>Option {i + 1}</option>)}
                                    </select>
                                </FormField>
                            </>
                        ) : (
                            <FormField label="Answer (numerical value)" required>
                                <input value={s.numAnswer} onChange={e => set({ numAnswer: e.target.value })} className={`${FIELD} sm:w-64`} placeholder="e.g. 25, 4.5, -10" />
                            </FormField>
                        )}

                        <FormField label="Solution">
                            <textarea value={s.solution} rows={3} onChange={e => set({ solution: e.target.value })} className={`${FIELD} leading-relaxed`} placeholder="Step-by-step solution (maths in $...$)" />
                        </FormField>
                    </div>

                    {/* live preview */}
                    <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50 px-5 py-4 lg:border-l lg:border-t-0">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">Level: {s.difficulty}</span>
                            <span className="text-[11px] font-semibold text-slate-500">Preview - exactly as it prints</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <QuestionPreviewBody q={draft} number={displayNum} showAnswer showSolution />
                        </div>
                    </div>
                </div>

                {/* footer */}
                <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="cursor-pointer rounded-lg bg-slate-400 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-500">Close</button>
                        {onDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to delete Question #' + displayNum + ' from this paper?')) {
                                        onDelete(questionIndex);
                                        onClose();
                                    }
                                }}
                                className="cursor-pointer rounded-lg bg-rose-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-600"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                    <button type="button" onClick={handleSave} className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white shadow hover:bg-blue-700">
                        Update Question
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
function SwapQuestionModalInner({
    isOpen,
    oldQuestion,
    questionIndex,
    displayNum,
    paperSubject,
    paperExamType,
    onClose,
    onSelectSwap,
    onSwap,
}) {
    const subject = oldQuestion.subject || paperSubject || 'Physics';
    const initialChapter = oldQuestion.chapter || '';

    // Cascading Filter States
    const [chaptersList, setChaptersList] = useState([]);
    const [conceptsList, setConceptsList] = useState([]);
    const [selectedChapter, setSelectedChapter] = useState(initialChapter);
    const [selectedConcept, setSelectedConcept] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedLevel, setSelectedLevel] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [swappedSuccess, setSwappedSuccess] = useState(false);

    // Fetch Subject Taxonomy (Chapters & Concepts)
    useEffect(() => {
        let isMounted = true;
        const fetchMeta = async () => {
            try {
                const res = await api.get(`/api/questions/meta?subject=${encodeURIComponent(subject)}`);
                if (!isMounted) return;
                const chs = Array.isArray(res.data?.chapters) ? res.data.chapters : [];
                const cpts = Array.isArray(res.data?.concepts) ? res.data.concepts : [];
                setChaptersList(chs);
                setConceptsList(cpts);
            } catch (err) {
                console.warn('Failed to load subject metadata for swap:', err.message);
            }
        };
        fetchMeta();
        return () => { isMounted = false; };
    }, [subject]);

    // Compute concepts filtered by selected chapter
    const filteredConcepts = useMemo(() => {
        if (!selectedChapter || selectedChapter === 'All') {
            // Distinct list of all concept names
            const allNames = conceptsList.map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
            return Array.from(new Set(allNames)).sort();
        }
        const relevant = conceptsList
            .filter(c => {
                if (typeof c === 'string') return true;
                return c?.chapter && c.chapter.trim().toLowerCase() === selectedChapter.trim().toLowerCase();
            })
            .map(c => (typeof c === 'string' ? c : c?.name))
            .filter(Boolean);
        return Array.from(new Set(relevant)).sort();
    }, [conceptsList, selectedChapter]);

    // Fetch Candidates from API
    const fetchCandidates = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const queryParams = new URLSearchParams({
                subject,
                limit: '60',
                paginated: 'true',
            });
            if (paperExamType) queryParams.append('examType', paperExamType);
            if (selectedChapter && selectedChapter !== 'All') queryParams.append('chapter', selectedChapter);
            if (selectedConcept && selectedConcept !== 'All') queryParams.append('concept', selectedConcept);
            if (selectedType && selectedType !== 'All') queryParams.append('type', selectedType);
            if (selectedLevel && selectedLevel !== 'All') queryParams.append('level', selectedLevel);
            if (searchKeyword.trim()) queryParams.append('search', searchKeyword.trim());

            const res = await api.get(`/api/questions?${queryParams.toString()}`);
            const list = Array.isArray(res.data?.questions)
                ? res.data.questions
                : (Array.isArray(res.data) ? res.data : []);

            // Filter out the current question ID so teacher does not swap with the identical item
            const oldId = String(oldQuestion._id || oldQuestion.id || '');
            const filtered = list.filter(q => String(q._id || q.id || '') !== oldId);
            setCandidates(filtered);
        } catch (err) {
            console.error('Fetch swap candidates error:', err);
            setErrorMsg('Failed to load replacement questions. Please adjust your filters or search.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when cascading filters change
    useEffect(() => {
        fetchCandidates();
    }, [selectedChapter, selectedConcept, selectedType, selectedLevel]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchCandidates();
    };

    const handleResetFilters = () => {
        setSelectedChapter('');
        setSelectedConcept('');
        setSelectedType('');
        setSelectedLevel('');
        setSearchKeyword('');
    };

    const handleSelectQuestion = (cand) => {
        setSwappedSuccess(true);
        // Ensure all column structure, table headers, diagram references, and sub-options remain fully intact
        const img = resolveImageUrl(cand.imageUrl || cand.image_url);
        const chosenQ = {
            ...cand,
            _id: cand._id || cand.id,
            id: cand.id || cand._id,
            imageUrl: img || null,
            image_url: img || null,
            matchPairs: cand.matchPairs || (cand.column_a && cand.column_b ? cand.column_a.map((left, i) => ({ left, right: cand.column_b[i] || '' })) : null),
            column_a: cand.column_a || null,
            column_b: cand.column_b || null,
            columnA: cand.columnA || cand.column_a || null,
            columnB: cand.columnB || cand.column_b || null,
            options: Array.isArray(cand.options) && cand.options.length > 0 ? cand.options : [cand.opt_a, cand.opt_b, cand.opt_c, cand.opt_d].filter(Boolean),
        };
        const swapFn = onSelectSwap || onSwap;
        if (typeof swapFn === 'function') {
            swapFn(questionIndex, chosenQ);
        }
        setTimeout(() => {
            onClose();
        }, 900);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy/60 backdrop-blur-sm animate-fade-in no-print">
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-navy/20 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-navy text-white flex items-center justify-between border-b-2 border-gold flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🔄</span>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-wider text-white">
                                Swap Question #{displayNum}
                            </h3>
                            <p className="text-[11px] font-bold text-gold/80">
                                Filter by Chapter, Concept, Type & Level to find the perfect replacement
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={swappedSuccess}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black flex items-center justify-center transition cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Success Banner */}
                {swappedSuccess && (
                    <div className="px-6 py-3 bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-inner animate-pulse">
                        <span className="text-lg">✓</span>
                        <span>Swapped successfully! Updating your paper...</span>
                    </div>
                )}

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {/* Currently In Paper Preview */}
                    <div className="p-4 bg-amber-50/70 border-2 border-indigo-300 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                                Currently in Paper (Q#{displayNum})
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-amber-800">
                                    Subject: <span className="font-black">{subject}</span>
                                </span>
                                {oldQuestion.chapter && (
                                    <span className="text-[11px] font-bold text-amber-800">
                                        • Chapter: <span className="font-black">{oldQuestion.chapter}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-xs text-slate-900 font-medium leading-relaxed">
                            <MathRenderer text={oldQuestion.questionText || oldQuestion.question || ''} />
                        </div>
                    </div>

                    {/* Cascading Filter Bar */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-navy">
                                🔍 Cascading Question Filter
                            </span>
                            {(selectedChapter || selectedConcept || selectedType || selectedLevel || searchKeyword) && (
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {/* 1. Chapter Dropdown */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    1. Chapter
                                </label>
                                <select
                                    value={selectedChapter}
                                    onChange={e => {
                                        setSelectedChapter(e.target.value);
                                        setSelectedConcept(''); // reset concept when chapter changes
                                    }}
                                    className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-navy text-slate-800"
                                >
                                    <option value="">All Chapters</option>
                                    {chaptersList.map((ch, idx) => (
                                        <option key={idx} value={ch}>
                                            {ch}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Concept Dropdown (Filtered by Chapter) */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    2. Concept / Topic
                                </label>
                                <select
                                    value={selectedConcept}
                                    onChange={e => setSelectedConcept(e.target.value)}
                                    className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-navy text-slate-800"
                                >
                                    <option value="">All Concepts</option>
                                    {filteredConcepts.map((cpt, idx) => (
                                        <option key={idx} value={cpt}>
                                            {cpt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Question Type Dropdown */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    3. Question Type
                                </label>
                                <select
                                    value={selectedType}
                                    onChange={e => setSelectedType(e.target.value)}
                                    className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-navy text-slate-800"
                                >
                                    <option value="">All Types</option>
                                    <option value="MCQ">MCQ (Single Choice)</option>
                                    <option value="ASSERTION_REASON">Assertion - Reason</option>
                                    <option value="STATEMENT_BASED">Statement Based</option>
                                    <option value="MATCH_FOLLOWING">Match the Following</option>
                                    <option value="NUMERICAL">Numerical / Integer</option>
                                    <option value="DIAGRAM_BASED">Diagram Based</option>
                                </select>
                            </div>

                            {/* 4. Level Dropdown */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    4. Level / Difficulty
                                </label>
                                <select
                                    value={selectedLevel}
                                    onChange={e => setSelectedLevel(e.target.value)}
                                    className="w-full p-2 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-navy text-slate-800"
                                >
                                    <option value="">All Levels</option>
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                        </div>

                        {/* Keyword Search Input Bar */}
                        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 pt-1">
                            <input
                                type="text"
                                value={searchKeyword}
                                onChange={e => setSearchKeyword(e.target.value)}
                                placeholder="Optional search keyword, formula, or phrase..."
                                className="flex-1 p-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-navy"
                            />
                            <button
                                type="submit"
                                className="px-4 py-2 bg-navy hover:bg-navy/90 text-gold rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition cursor-pointer"
                            >
                                Search
                            </button>
                        </form>
                    </div>

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
                                No questions found matching this filter criteria.<br />
                                Try selecting "All Chapters" or "All Concepts", or clear your search term.
                            </div>
                        ) : (
                            candidates.map((cand, idx) => {
                                const candId = cand._id || cand.id;
                                const candOptions = Array.isArray(cand.options) && cand.options.length > 0
                                    ? cand.options
                                    : [
                                        cand.opt_a || cand.option_a,
                                        cand.opt_b || cand.option_b,
                                        cand.opt_c || cand.option_c,
                                        cand.opt_d || cand.option_d
                                    ].filter(Boolean);

                                const candImg = resolveImageUrl(cand.imageUrl || cand.image_url);

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
                                                {cand.topic && (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                        {cand.topic}
                                                    </span>
                                                )}
                                                {cand.level && (
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        cand.level.toLowerCase() === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                                                        cand.level.toLowerCase() === 'hard' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {cand.level}
                                                    </span>
                                                )}
                                                {cand.type && (
                                                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                                        {cand.type}
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
                                                disabled={swappedSuccess}
                                                className="px-4 py-1.5 bg-gold hover:bg-indigo-400 text-navy font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition hover:scale-105 cursor-pointer flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                                            >
                                                <span>✓</span> Select & Swap
                                            </button>
                                        </div>

                                        {/* Question Text */}
                                        <div className="text-xs text-slate-900 font-medium leading-relaxed">
                                            <MathRenderer text={cand.questionText || cand.question || ''} />
                                        </div>

                                        {/* Question Diagram if present */}
                                        {candImg && (
                                            <div className="inline-block p-1 bg-slate-50 border border-slate-200 rounded-lg">
                                                <img
                                                    src={candImg}
                                                    alt="Question Diagram"
                                                    crossOrigin="anonymous"
                                                    className="max-h-36 object-contain rounded"
                                                    onError={e => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}

                                        {/* Options Grid */}
                                        {candOptions.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-700">
                                                {candOptions.slice(0, 4).map((opt, oIdx) => {
                                                    const optText = typeof opt === 'object' ? (opt.text || opt.value || '') : String(opt);
                                                    return (
                                                        <div key={oIdx} className="flex items-start gap-1 p-1 bg-slate-50/50 rounded border border-slate-100">
                                                            <span className="font-black text-navy text-[11px]">
                                                                ({String.fromCharCode(65 + oIdx)})
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <MathRenderer isOption inline text={optText} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
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
                        disabled={swappedSuccess}
                        className="px-5 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-300 transition cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// Hooks must run on every render of a component. The modals used to `return null` before their hooks
// while closed, so opening one changed the hook count and React threw. The wrappers do the closed-state
// check and only mount the stateful component while a question is actually being edited / swapped.
export function EditQuestionModal(props) {
    if (!props.isOpen || !props.question) return null;
    return <EditQuestionModalInner {...props} />;
}

export function SwapQuestionModal(props) {
    if (!props.isOpen || !props.oldQuestion) return null;
    return <SwapQuestionModalInner {...props} />;
}
