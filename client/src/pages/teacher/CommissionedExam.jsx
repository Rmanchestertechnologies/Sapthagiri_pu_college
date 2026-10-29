import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import A4AnswerKey from '../../components/A4AnswerKey';
import A4SolutionKey from '../../components/A4SolutionKey';
import Loader from '../../components/Loader';
import { getQuestionOptionLabels, optionLabel, cleanOptionText, extractOptionsIfMissing } from '../../utils/sanitize';

const EXAM_PATTERNS = {
    NEET: {
        id: 'NEET',
        title: 'NEET (National Eligibility Entrance Test)',
        badge: 'Medical UG',
        subjects: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
        defaultTotal: 45,
        marksPerQ: 4,
        supportsNumerical: false,
    },
    JEE: {
        id: 'JEE',
        title: 'JEE Main (Joint Entrance Examination)',
        badge: 'Engineering',
        subjects: ['Physics', 'Chemistry', 'Mathematics'],
        defaultTotal: 25,
        marksPerQ: 4,
        supportsNumerical: true,
    },
    CET: {
        id: 'CET',
        title: 'KCET (Karnataka Common Entrance Test)',
        badge: 'State Entrance',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
        defaultTotal: 60,
        marksPerQ: 1,
        supportsNumerical: false,
    },
    CUSTOM: {
        id: 'CUSTOM',
        title: 'Custom Single / Multi-Subject Assessment',
        badge: 'Freeform / Custom',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology'],
        defaultTotal: 50,
        marksPerQ: 1,
        supportsNumerical: true,
    }
};

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

export default function CommissionedExam() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Query params
    const paramExamType = searchParams.get('examType');
    const paramSubject = searchParams.get('subject');
    const paramExamId = searchParams.get('examId');
    const paramPaperId = searchParams.get('paperId');

    // ── STEP FLOW STRICTLY DEFINED BY USER:
    // Step 1: Subject Selection (NEET: PCBZ, JEE: PCM, CET: PCMB, Custom)
    // Step 2: Chapter Selection
    // Step 3: Concept Selection
    // Step 4: No of questions from each chapter how many questions (UNLIMITED)
    // Step 5: From each type how many questions (Dynamic Balancing Engine)
    // Step 6: Method (Auto Fetch vs Manual Fetch)
    // Step 7: Preview, Alignment & Save (Fixed bottom-right Save & Merge)
    const [currentStep, setCurrentStep] = useState(paramPaperId ? 7 : (paramExamType && paramSubject ? 2 : 1));
    const [selectedExamPattern, setSelectedExamPattern] = useState(paramExamType || 'NEET');
    const [selectedSubject, setSelectedSubject] = useState(paramSubject || user?.subject || 'Physics');
    const [selectedClass, setSelectedClass] = useState('Both'); // '11' | '12' | 'Both'
    const [examTitle, setExamTitle] = useState('');

    // Transition Loader state
    const [stepLoading, setStepLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Step 2: Chapter Selection
    const [availableChapters, setAvailableChapters] = useState([]);
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [chapterSearch, setChapterSearch] = useState('');

    // Step 3: Concept Selection (normalized to { chapter, name })
    const [availableConcepts, setAvailableConcepts] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [conceptSearch, setConceptSearch] = useState('');

    // Step 4: Questions from each chapter how many questions (UNLIMITED CAPACITY)
    // chapterQuotas: { [chapterName]: number }
    const [chapterQuotas, setChapterQuotas] = useState({});

    // Step 5: From each type how many questions
    // typeAllocations: { mcq: number, ar: number, match: number, diag: number, stmt: number, numerical: number }
    const [typeAllocations, setTypeAllocations] = useState({
        mcq: 20,
        ar: 5,
        match: 5,
        diag: 5,
        stmt: 5,
        numerical: 0,
    });

    // Step 6: Method (Fetch Mode)
    const [fetchMode, setFetchMode] = useState('auto'); // 'auto' | 'manual'
    const [manualTab, setManualTab] = useState('non_numerical'); // 'non_numerical' | 'numerical' (JEE only)
    const [fetchedQuestions, setFetchedQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [manualSearch, setManualSearch] = useState('');

    // Step 7: Preview & Alignment Settings
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        optionFormat: 'numeric', // 1, 2, 3, 4 default
    });
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [showAnswerKey, setShowAnswerKey] = useState(false);
    const [showSolutionGuide, setShowSolutionGuide] = useState(false);
    const [savingPaper, setSavingPaper] = useState(false);

    // Merge Exam Modal
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [existingDrafts, setExistingDrafts] = useState([]);
    const [selectedDraftIdsToMerge, setSelectedDraftIdsToMerge] = useState([]);

    const patternConfig = EXAM_PATTERNS[selectedExamPattern] || EXAM_PATTERNS.NEET;

    // Sum of questions from all chapters (UNLIMITED CAPACITY)
    const totalChapterQuestions = useMemo(() => {
        return Object.values(chapterQuotas).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
    }, [chapterQuotas]);

    // Sum of questions from all types
    const totalTypeQuestions = useMemo(() => {
        return Object.values(typeAllocations).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
    }, [typeAllocations]);

    // Initial Load: templates, exam params, existing paper params
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const res = await api.get('/api/templates');
                if (res.data && res.data.length > 0) {
                    setActiveTemplate(res.data[0]);
                }

                if (paramExamId) {
                    const examRes = await api.get(`/api/exams/${paramExamId}`);
                    const exam = examRes.data;
                    if (exam) {
                        if (exam.title) setExamTitle(exam.title);
                        if (exam.examType) setSelectedExamPattern(exam.examType);
                    }
                }

                if (paramPaperId) {
                    const paperRes = await api.get(`/api/papers/${paramPaperId}`);
                    const p = paperRes.data;
                    if (p) {
                        if (p.title) setExamTitle(p.title);
                        if (p.subject) setSelectedSubject(p.subject);
                        if (p.examType) setSelectedExamPattern(p.examType);
                        if (Array.isArray(p.questions) && p.questions.length > 0) {
                            setSelectedQuestions(p.questions);
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading initial data:', err);
            }
        };
        loadInitialData();
    }, [paramExamId, paramPaperId]);

    // Fetch chapters and concepts for selected subject
    const fetchMetadata = async (subj) => {
        const normSub = normalizeSubjectName(subj);
        setStepLoading(true);
        setLoadingMessage(`Loading ${normSub} repository...`);
        try {
            const res = await api.get(`/api/questions/meta?subject=${encodeURIComponent(normSub)}&classes=${encodeURIComponent(selectedClass === 'Both' ? '' : selectedClass)}`);
            const chs = Array.isArray(res.data?.chapters) ? res.data.chapters : [];
            
            // Normalize concepts safely to { chapter: string, name: string } to prevent any React child object crashes
            const rawConcepts = Array.isArray(res.data?.concepts) ? res.data.concepts : [];
            const normalizedConcepts = rawConcepts.map(c => {
                if (typeof c === 'string') return { chapter: '', name: c };
                return {
                    chapter: c.chapter || c.chapter_name || '',
                    name: c.name || c.concept || c.concept_name || String(c)
                };
            }).filter(c => c.name && c.name.trim().length > 0);

            setAvailableChapters(chs);
            setAvailableConcepts(normalizedConcepts);
        } catch (err) {
            console.error('Error fetching metadata:', err);
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    // When subject is picked in Step 1
    const handleSelectSubjectBlock = async (sub) => {
        const norm = normalizeSubjectName(sub);
        setSelectedSubject(norm);
        await fetchMetadata(norm);
        setCurrentStep(2); // Goes to Step 2: Chapter Selection
    };

    // Step 4: Auto-distribute evenly across selected chapters (defaults to 10 per chapter or custom)
    const handleDistributeEvenly = (targetTotal = null) => {
        if (selectedChapters.length === 0) return;
        const total = targetTotal || (patternConfig.defaultTotal || 50);
        const count = selectedChapters.length;
        const base = Math.floor(total / count);
        const remainder = total % count;

        const newQuotas = {};
        selectedChapters.forEach((ch, idx) => {
            newQuotas[ch] = base + (idx < remainder ? 1 : 0);
        });
        setChapterQuotas(newQuotas);
    };

    // Sync Step 5 type allocations to match the Step 4 chapter total
    const syncTypesToChapterTotal = () => {
        const target = totalChapterQuestions > 0 ? totalChapterQuestions : 45;
        const isJEE = selectedExamPattern === 'JEE';
        
        let numQs = isJEE ? Math.min(5, Math.floor(target * 0.2)) : 0;
        let remaining = target - numQs;

        const mcqQs = Math.max(0, Math.round(remaining * 0.7));
        const arQs = Math.max(0, Math.round(remaining * 0.1));
        const matchQs = Math.max(0, Math.round(remaining * 0.08));
        const diagQs = Math.max(0, Math.round(remaining * 0.06));
        const stmtQs = Math.max(0, target - (mcqQs + arQs + matchQs + diagQs + numQs));

        setTypeAllocations({
            mcq: mcqQs,
            ar: arQs,
            match: matchQs,
            diag: diagQs,
            stmt: stmtQs,
            numerical: numQs,
        });
    };

    // Step 5: Dynamic Balancing Logic
    // If a user increments one type, automatically decrement the largest category so sum = totalChapterQuestions
    const handleTypeCountChange = (typeKey, delta) => {
        setTypeAllocations(prev => {
            const currentVal = prev[typeKey] || 0;
            const newVal = Math.max(0, currentVal + delta);
            if (newVal === currentVal) return prev;

            const change = newVal - currentVal;
            const updated = { ...prev, [typeKey]: newVal };

            const target = totalChapterQuestions > 0 ? totalChapterQuestions : 50;
            const otherKeys = Object.keys(updated).filter(k => k !== typeKey && (patternConfig.supportsNumerical || k !== 'numerical'));
            otherKeys.sort((a, b) => updated[b] - updated[a]);

            let remainingChange = change;
            for (const key of otherKeys) {
                if (remainingChange === 0) break;
                if (remainingChange > 0) {
                    const availableToDec = updated[key];
                    const dec = Math.min(availableToDec, remainingChange);
                    updated[key] -= dec;
                    remainingChange -= dec;
                } else {
                    const inc = Math.abs(remainingChange);
                    updated[key] += inc;
                    remainingChange = 0;
                }
            }

            return updated;
        });
    };

    // Step 6: Execute Question Fetch
    const executeFetch = async () => {
        setStepLoading(true);
        setLoadingMessage('Fetching questions from question repository...');
        try {
            const queryParams = new URLSearchParams({
                subject: selectedSubject,
                limit: '1000',
            });
            if (selectedClass !== 'Both') queryParams.append('classes', selectedClass);

            const res = await api.get(`/api/questions?${queryParams.toString()}`);
            const pool = Array.isArray(res.data?.questions) ? res.data.questions : (Array.isArray(res.data) ? res.data : []);

            const matched = pool.filter(q => {
                const qCh = q.chapter || '';
                const qCpt = q.concept || '';
                const chMatch = selectedChapters.length === 0 || selectedChapters.some(c => c.toLowerCase() === qCh.toLowerCase());
                const cptMatch = selectedConcepts.length === 0 || selectedConcepts.some(c => c.toLowerCase() === qCpt.toLowerCase());
                return chMatch && cptMatch;
            });

            const candidatePool = matched.length >= 10 ? matched : pool;
            setFetchedQuestions(candidatePool);

            if (fetchMode === 'auto') {
                const picked = [];
                const poolCopy = [...candidatePool];

                if (patternConfig.supportsNumerical && typeAllocations.numerical > 0) {
                    const nums = poolCopy.filter(q => (q.type || '').toUpperCase() === 'NUMERICAL');
                    picked.push(...nums.slice(0, typeAllocations.numerical));
                }

                const nonNums = poolCopy.filter(q => (q.type || '').toUpperCase() !== 'NUMERICAL');
                const needed = (totalChapterQuestions > 0 ? totalChapterQuestions : 45) - picked.length;
                picked.push(...nonNums.slice(0, Math.max(0, needed)));

                setSelectedQuestions(picked);
                setCurrentStep(7); // Proceed to Step 7: Preview & Save
            }
        } catch (err) {
            console.error('Error fetching questions:', err);
            alert('Failed to fetch questions. Please check connection and try again.');
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    // Step 7: Save Paper Draft
    const handleSaveDraft = async () => {
        setSavingPaper(true);
        try {
            const paperData = {
                title: examTitle || `${selectedSubject} - ${selectedExamPattern} Examination`,
                subject: selectedSubject,
                examType: selectedExamPattern,
                classes: selectedClass === 'Both' ? ['11', '12'] : [selectedClass],
                questions: selectedQuestions.map((q, idx) => ({ ...q, questionNumber: idx + 1 })),
                totalQuestions: selectedQuestions.length,
                totalMarks: selectedQuestions.length * patternConfig.marksPerQ,
                status: 'Draft',
                settings,
            };

            const res = await api.post('/api/papers', paperData);
            alert(`Paper saved successfully! Document ID: ${res.data?._id || 'Saved'}`);
        } catch (err) {
            console.error('Error saving paper:', err);
            alert('Failed to save paper. Please verify details and try again.');
        } finally {
            setSavingPaper(false);
        }
    };

    // Step 7: Merge Exam Engine
    const handleOpenMergeModal = async () => {
        try {
            const res = await api.get('/api/papers');
            const list = Array.isArray(res.data) ? res.data : [];
            setExistingDrafts(list.filter(p => p.status === 'Draft' || p.status === 'Completed'));
            setShowMergeModal(true);
        } catch (err) {
            console.error('Error loading drafts:', err);
        }
    };

    const handleExecuteMerge = async () => {
        if (selectedDraftIdsToMerge.length < 2) {
            alert('Please select at least 2 subject papers to merge.');
            return;
        }

        try {
            setStepLoading(true);
            setLoadingMessage('Merging subject papers into Master Exam with synchronized Answer Keys...');

            const papersToMerge = existingDrafts.filter(d => selectedDraftIdsToMerge.includes(d._id));
            const mergedQuestions = [];
            let currentQNo = 1;

            papersToMerge.forEach(p => {
                const sub = p.subject || 'General';
                (p.questions || []).forEach(q => {
                    mergedQuestions.push({
                        ...q,
                        sectionSubject: sub,
                        questionNumber: currentQNo++,
                    });
                });
            });

            const masterPaper = {
                title: `Master ${selectedExamPattern} Composite Exam (${papersToMerge.map(p => p.subject).join(', ')})`,
                subject: papersToMerge.map(p => p.subject).join(', '),
                examType: selectedExamPattern,
                classes: ['11', '12'],
                questions: mergedQuestions,
                totalQuestions: mergedQuestions.length,
                totalMarks: mergedQuestions.reduce((sum, q) => sum + (q.marks || patternConfig.marksPerQ), 0),
                status: 'Completed',
                settings,
            };

            await api.post('/api/papers', masterPaper);
            setShowMergeModal(false);
            alert(`Master Exam compiled successfully with ${mergedQuestions.length} questions across ${papersToMerge.length} subjects!`);
            navigate(`/teacher/dashboard/saved-papers`);
        } catch (err) {
            console.error('Error merging exam:', err);
            alert('Failed to merge exam papers.');
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    const currentPaperObject = useMemo(() => ({
        title: examTitle || `${selectedSubject} - ${selectedExamPattern} Assessment`,
        subject: selectedSubject,
        examType: selectedExamPattern,
        classes: selectedClass === 'Both' ? ['11', '12'] : [selectedClass],
        questions: selectedQuestions.map((q, idx) => ({ ...q, questionNumber: idx + 1 })),
        totalMarks: selectedQuestions.length * patternConfig.marksPerQ,
        duration: selectedExamPattern === 'NEET' ? '200 Minutes' : (selectedExamPattern === 'JEE' ? '180 Minutes' : '80 Minutes'),
        institutionName: 'SAPTHAGIRI PU COLLEGE',
        subHeader: 'DEPARTMENT OF PRE-UNIVERSITY EDUCATION, KARNATAKA',
    }), [examTitle, selectedSubject, selectedExamPattern, selectedClass, selectedQuestions, patternConfig]);

    // Filter concepts belonging strictly to selected chapters
    const scopedConcepts = useMemo(() => {
        if (selectedChapters.length === 0) return availableConcepts;
        return availableConcepts.filter(c => {
            if (!c.chapter) return true;
            return selectedChapters.some(ch => ch.toLowerCase() === c.chapter.toLowerCase());
        });
    }, [availableConcepts, selectedChapters]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Top Navigation Bar with Step Pill Indicators */}
            <header className="bg-navy text-white px-6 py-4 shadow-lg border-b-2 border-gold flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => currentStep > 1 ? setCurrentStep(prev => prev - 1) : navigate('/teacher/dashboard')}
                        className="bg-white/10 hover:bg-white/20 text-gold px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                    >
                        <span>←</span> Back
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-gold text-navy text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                Exam Generator
                            </span>
                            <h1 className="text-base font-black text-white uppercase tracking-tight">
                                {selectedExamPattern} &bull; {selectedSubject}
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Progress Step Indicators */}
                <div className="hidden lg:flex items-center gap-1.5">
                    {[
                        { step: 1, label: '1. Subject' },
                        { step: 2, label: '2. Chapters' },
                        { step: 3, label: '3. Concepts' },
                        { step: 4, label: '4. Questions per Chapter' },
                        { step: 5, label: '5. Questions per Type' },
                        { step: 6, label: '6. Method' },
                        { step: 7, label: '7. Preview & Save' },
                    ].map(st => (
                        <div
                            key={st.step}
                            onClick={() => st.step < currentStep && setCurrentStep(st.step)}
                            className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1 ${
                                currentStep === st.step
                                    ? 'bg-gold text-navy shadow-md ring-2 ring-gold/40 scale-105'
                                    : (st.step < currentStep ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/5 text-slate-400 opacity-50')
                            }`}
                        >
                            <span>{st.label}</span>
                        </div>
                    ))}
                </div>
            </header>

            {/* Centered Step-Transition Loader (Centered on screen, never persists after load) */}
            {stepLoading && <Loader fullPage={true} text={loadingMessage || 'Loading...'} />}

            <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-6">

                {/* ══════════════════════════════════════════════════════════════
                    STEP 1: SUBJECT SELECTION (NEET: PCBZ, JEE: PCM, CET: PCMB, CUSTOM)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="text-center max-w-2xl mx-auto space-y-2">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Step 1 of 7
                            </span>
                            <h2 className="text-3xl font-black text-navy uppercase tracking-tight">
                                Exam Pattern & Subject Selection
                            </h2>
                            <p className="text-xs text-slate-500 font-semibold">
                                Select exam blueprint and click your subject block to proceed with chapter selection.
                            </p>
                        </div>

                        {/* Title & Pattern Selector */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">
                                    Assessment Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Grand Mock Test #1"
                                    value={examTitle}
                                    onChange={(e) => setExamTitle(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">
                                    Target Class
                                </label>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold bg-white"
                                >
                                    <option value="Both">Both (Class 11 / PUC-I + Class 12 / PUC-II)</option>
                                    <option value="11">Class 11 / PUC-I</option>
                                    <option value="12">Class 12 / PUC-II</option>
                                </select>
                            </div>
                        </div>

                        {/* Exam Pattern & Subject Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {['NEET', 'JEE', 'CET'].map(patternKey => {
                                const pattern = EXAM_PATTERNS[patternKey];
                                const isSelected = selectedExamPattern === pattern.id;
                                return (
                                    <div
                                        key={pattern.id}
                                        onClick={() => setSelectedExamPattern(pattern.id)}
                                        className={`bg-white rounded-3xl p-6 border-2 transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-xl ${
                                            isSelected ? 'border-gold ring-4 ring-gold/20 scale-[1.02]' : 'border-slate-200 hover:border-navy'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="bg-navy text-gold text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                                    {pattern.badge}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400">
                                                    {pattern.subjects.length} Blocks
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-black text-navy mb-1">{pattern.id}</h3>
                                            <p className="text-xs text-slate-500 font-medium mb-4">{pattern.title}</p>
                                        </div>

                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                                                Click Subject Block to Open:
                                            </span>
                                            <div className="grid grid-cols-2 gap-2">
                                                {pattern.subjects.map(sub => (
                                                    <button
                                                        key={sub}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedExamPattern(pattern.id);
                                                            handleSelectSubjectBlock(sub);
                                                        }}
                                                        className="bg-navy/5 hover:bg-navy hover:text-gold text-navy text-xs font-black py-2.5 px-3 rounded-xl transition text-center border border-navy/10 shadow-2xs cursor-pointer"
                                                    >
                                                        {sub}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 2: CHAPTER SELECTION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Step 2 of 7
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Chapter Selection &bull; {selectedSubject}
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Select syllabus chapters strictly belonging to {selectedSubject}. ({selectedChapters.length} Selected)
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedChapters([...availableChapters])}
                                    className="bg-navy text-gold text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-navy/90 transition cursor-pointer"
                                >
                                    Select All ({availableChapters.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedChapters([])}
                                    className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder={`Search ${availableChapters.length} ${selectedSubject} chapters...`}
                                value={chapterSearch}
                                onChange={(e) => setChapterSearch(e.target.value)}
                                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-2">
                            {availableChapters
                                .filter(ch => ch.toLowerCase().includes(chapterSearch.toLowerCase()))
                                .map((ch, idx) => {
                                    const isChecked = selectedChapters.includes(ch);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (isChecked) {
                                                    setSelectedChapters(prev => prev.filter(c => c !== ch));
                                                } else {
                                                    setSelectedChapters(prev => [...prev, ch]);
                                                }
                                            }}
                                            className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                                                isChecked
                                                    ? 'bg-navy text-gold border-gold shadow-md'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                                            }`}
                                        >
                                            <span className="text-xs font-black line-clamp-1">{ch}</span>
                                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black ${
                                                isChecked ? 'bg-gold text-navy' : 'border border-slate-300 text-transparent'
                                            }`}>
                                                ✓
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(1)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Subjects
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (selectedChapters.length === 0) {
                                        alert('Please select at least one chapter before proceeding.');
                                        return;
                                    }
                                    setCurrentStep(3); // Proceed to Step 3: Concepts
                                }}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Concepts (Step 3) →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 3: CONCEPT / SUB-TOPIC SELECTION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Step 3 of 7
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Concept & Sub-Topic Selection
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Displaying concepts strictly belonging to {selectedChapters.length} chosen chapters. ({selectedConcepts.length} Selected)
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedConcepts(scopedConcepts.map(c => c.name))}
                                    className="bg-navy text-gold text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-navy/90 transition cursor-pointer"
                                >
                                    Select All ({scopedConcepts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedConcepts([])}
                                    className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search target concepts..."
                                value={conceptSearch}
                                onChange={(e) => setConceptSearch(e.target.value)}
                                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-2">
                            {scopedConcepts
                                .filter(cpt => cpt.name.toLowerCase().includes(conceptSearch.toLowerCase()))
                                .map((cpt, idx) => {
                                    const isChecked = selectedConcepts.includes(cpt.name);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (isChecked) {
                                                    setSelectedConcepts(prev => prev.filter(c => c !== cpt.name));
                                                } else {
                                                    setSelectedConcepts(prev => [...prev, cpt.name]);
                                                }
                                            }}
                                            className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                                                isChecked
                                                    ? 'bg-navy text-gold border-gold shadow-md'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className="text-xs font-black line-clamp-1">{cpt.name}</span>
                                                {cpt.chapter && (
                                                    <span className="text-[9px] text-slate-400 font-bold block truncate">{cpt.chapter}</span>
                                                )}
                                            </div>
                                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                                isChecked ? 'bg-gold text-navy' : 'border border-slate-300 text-transparent'
                                            }`}>
                                                ✓
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(2)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Chapters
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleDistributeEvenly();
                                    setCurrentStep(4); // Proceed to Step 4: Questions per Chapter
                                }}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Questions per Chapter (Step 4) →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 4: NUMBER OF QUESTIONS FROM EACH CHAPTER (UNLIMITED)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 4 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Step 4 of 7
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Questions From Each Chapter
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Specify how many questions required from each chosen chapter. Add any question count — not limited to 60 questions.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDistributeEvenly(45)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                                >
                                    Preset 45
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDistributeEvenly(60)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                                >
                                    Preset 60
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDistributeEvenly(100)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                                >
                                    Preset 100
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
                            {selectedChapters.map((ch, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div>
                                        <h4 className="text-xs font-black text-navy">{ch}</h4>
                                        <span className="text-[10px] font-semibold text-slate-400">Questions from this chapter</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setChapterQuotas(prev => ({ ...prev, [ch]: Math.max(0, (parseInt(prev[ch]) || 0) - 1) }))}
                                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-black text-xs hover:bg-slate-100 cursor-pointer"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            value={chapterQuotas[ch] ?? 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                setChapterQuotas(prev => ({ ...prev, [ch]: Math.max(0, val) }));
                                            }}
                                            className="w-16 text-center font-black text-sm py-1 border border-slate-300 rounded-lg bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setChapterQuotas(prev => ({ ...prev, [ch]: (parseInt(prev[ch]) || 0) + 1 }))}
                                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-black text-xs hover:bg-slate-100 cursor-pointer"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Chapter Sum Display */}
                        <div className="bg-navy text-white p-4 rounded-2xl flex items-center justify-between shadow-md">
                            <span className="text-xs font-bold text-gold">Total Questions Across Chapters:</span>
                            <span className="text-base font-black text-white">
                                {totalChapterQuestions} Questions (Unlimited Support)
                            </span>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(3)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Concepts
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (totalChapterQuestions === 0) {
                                        alert('Please allocate at least 1 question across chapters.');
                                        return;
                                    }
                                    syncTypesToChapterTotal();
                                    setCurrentStep(5); // Proceed to Step 5: Questions per Type
                                }}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Question Types (Step 5) →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 5: FROM EACH TYPE HOW MANY QUESTIONS (DYNAMIC BALANCING)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 5 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="border-b border-slate-100 pb-5">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Step 5 of 7
                            </span>
                            <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                Questions From Each Question Type
                            </h2>
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                Allocate how many questions for each type. Dynamic balancing engine balances categories to match your {totalChapterQuestions} chapter question total.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { key: 'mcq', label: 'Single Correct MCQ', desc: 'Standard 4-option multiple choice' },
                                { key: 'ar', label: 'Assertion & Reasoning', desc: 'Assertion (A) and Reason (R)' },
                                { key: 'match', label: 'Match the Following', desc: 'Column I with Column II pairs' },
                                { key: 'diag', label: 'Diagrammatic Questions', desc: 'Circuits, graphs, and ray diagrams' },
                                { key: 'stmt', label: 'Statement-Based Questions', desc: 'Statement I and Statement II' },
                                ...(patternConfig.supportsNumerical ? [
                                    { key: 'numerical', label: 'Numerical Questions (JEE Sec B)', desc: 'Integer value input questions strictly for JEE' }
                                ] : []),
                            ].map(item => (
                                <div key={item.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-black text-navy">{item.label}</h4>
                                        <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleTypeCountChange(item.key, -1)}
                                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-black text-xs hover:bg-slate-100 cursor-pointer"
                                        >
                                            -
                                        </button>
                                        <span className="w-10 text-center font-black text-sm text-navy">
                                            {typeAllocations[item.key] || 0}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleTypeCountChange(item.key, 1)}
                                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-black text-xs hover:bg-slate-100 cursor-pointer"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Balancing Summary Bar */}
                        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex items-center justify-between text-emerald-900 shadow-2xs">
                            <span className="text-xs font-bold">Question Type Allocation vs Chapter Total:</span>
                            <span className="text-sm font-black">
                                {totalTypeQuestions} / {totalChapterQuestions} Questions Allocated
                            </span>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(4)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Questions per Chapter
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(6)} // Proceed to Step 6: Method
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Method (Step 6) →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 6: METHOD (AUTO FETCH VS MANUAL QUESTION SELECTOR)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 6 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="border-b border-slate-100 pb-5">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Step 6 of 7
                            </span>
                            <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                Acquisition Method
                            </h2>
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                Choose Auto Fetch Engine (1-click sampling) or Manual Question Inspector.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div
                                onClick={() => setFetchMode('auto')}
                                className={`p-6 rounded-3xl border-2 transition cursor-pointer ${
                                    fetchMode === 'auto' ? 'border-gold bg-amber-50/40 ring-4 ring-gold/20 shadow-md' : 'border-slate-200 hover:border-navy'
                                }`}
                            >
                                <div className="text-2xl mb-2">⚡</div>
                                <h3 className="text-base font-black text-navy mb-1">Auto Fetch Mode</h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Instant 1-click question generation sampling exactly {totalChapterQuestions} questions matching your chapter quotas and type breakdown.
                                </p>
                            </div>

                            <div
                                onClick={() => {
                                    setFetchMode('manual');
                                    executeFetch();
                                }}
                                className={`p-6 rounded-3xl border-2 transition cursor-pointer ${
                                    fetchMode === 'manual' ? 'border-gold bg-amber-50/40 ring-4 ring-gold/20 shadow-md' : 'border-slate-200 hover:border-navy'
                                }`}
                            >
                                <div className="text-2xl mb-2">✍️</div>
                                <h3 className="text-base font-black text-navy mb-1">Manual Fetch Mode</h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Hand-pick questions with search, filters, and segregated Section A vs Section B tabs for JEE.
                                </p>
                            </div>
                        </div>

                        {/* Manual Fetch List */}
                        {fetchMode === 'manual' && (
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                                {patternConfig.supportsNumerical && (
                                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                                        <button
                                            type="button"
                                            onClick={() => setManualTab('non_numerical')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                                                manualTab === 'non_numerical' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:text-navy'
                                            }`}
                                        >
                                            Tab 1: Non-Numerical Section
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setManualTab('numerical')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                                                manualTab === 'numerical' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:text-navy'
                                            }`}
                                        >
                                            Tab 2: Numerical Section (JEE Sec B)
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <input
                                        type="text"
                                        placeholder="Search question pool..."
                                        value={manualSearch}
                                        onChange={(e) => setManualSearch(e.target.value)}
                                        className="w-72 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                    />
                                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl">
                                        {selectedQuestions.length} Questions Selected (Unlimited Capacity)
                                    </span>
                                </div>

                                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
                                    {fetchedQuestions
                                        .filter(q => {
                                            const isNum = (q.type || '').toUpperCase() === 'NUMERICAL';
                                            if (patternConfig.supportsNumerical) {
                                                if (manualTab === 'numerical') return isNum;
                                                return !isNum;
                                            }
                                            return !isNum; // Hide numericals completely for NEET and CET
                                        })
                                        .filter(q => (q.questionText || q.question || '').toLowerCase().includes(manualSearch.toLowerCase()))
                                        .map((q, idx) => {
                                            const isSelected = selectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => {
                                                        setSelectedQuestions(prev => {
                                                            const exists = prev.some(sq => (sq._id || sq.id) === (q._id || q.id));
                                                            if (exists) return prev.filter(sq => (sq._id || sq.id) !== (q._id || q.id));
                                                            return [...prev, q];
                                                        });
                                                    }}
                                                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start justify-between gap-4 ${
                                                        isSelected ? 'bg-amber-50/50 border-gold shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="bg-navy text-gold text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                                                                {q.type || 'MCQ'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-bold">
                                                                {q.chapter}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs font-semibold text-slate-900 leading-relaxed">
                                                            <MathRenderer inline text={q.questionText || q.question || ''} />
                                                        </div>
                                                    </div>
                                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                                        isSelected ? 'bg-gold text-navy shadow-xs' : 'border border-slate-300'
                                                    }`}>
                                                        {isSelected ? '✓' : '+'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(5)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Question Types
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (fetchMode === 'auto') {
                                        executeFetch();
                                    } else {
                                        if (selectedQuestions.length === 0) {
                                            alert('Please select at least one question before proceeding to preview.');
                                            return;
                                        }
                                        setCurrentStep(7); // Proceed to Step 7: Preview & Alignment
                                    }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-8 py-3 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
                            >
                                <span>🚀</span>
                                <span>{fetchMode === 'auto' ? 'Execute Auto Fetch & Preview' : 'Proceed to Preview & Save (Step 7)'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 7: PREVIEW, ALIGNMENT & MERGE EXAM
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 7 && (
                    <div className="space-y-6 animate-fade-in relative pb-28">
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm no-print">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(6)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer"
                                >
                                    ← Edit Method
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAnswerKey(true)}
                                    className="bg-navy text-gold hover:bg-navy/90 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                    <span>🔑</span> Answer Key
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSolutionGuide(true)}
                                    className="bg-navy text-gold hover:bg-navy/90 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                    <span>💡</span> Solutions Guide
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleOpenMergeModal}
                                    className="bg-gold text-navy hover:bg-amber-400 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>🔀</span> Merge Exam
                                </button>
                            </div>
                        </div>

                        {/* Paginated Paper Renderer */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                activeTemplate={activeTemplate}
                                settings={settings}
                                setSettings={setSettings}
                                showSettingsPanel={true}
                                onProceedToFinalize={handleSaveDraft}
                            />
                        </div>

                        {/* FIXED PRIMARY SAVE BUTTON STRICTLY IN BOTTOM-RIGHT CORNER */}
                        <div className="fixed bottom-6 right-6 z-50">
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={savingPaper}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border-2 border-emerald-400 hover:scale-105 transition-all cursor-pointer"
                            >
                                <span className="text-lg">💾</span>
                                <span>{savingPaper ? 'Saving Paper...' : `Save ${selectedSubject} Exam Paper`}</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* ── MODAL: ANSWER KEY ── */}
            {showAnswerKey && (
                <A4AnswerKey
                    paper={currentPaperObject}
                    questions={currentPaperObject.questions}
                    onClose={() => setShowAnswerKey(false)}
                />
            )}

            {/* ── MODAL: SOLUTION GUIDE ── */}
            {showSolutionGuide && (
                <A4SolutionKey
                    paper={currentPaperObject}
                    questions={currentPaperObject.questions}
                    onClose={() => setShowSolutionGuide(false)}
                />
            )}

            {/* ── MODAL: MERGE EXAM ENGINE ── */}
            {showMergeModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border-2 border-gold space-y-5 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-black text-navy uppercase tracking-tight">Merge Exam Engine</h3>
                                <p className="text-xs text-slate-500 font-semibold">
                                    Combine individual completed subject papers into one Master Exam document.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowMergeModal(false)}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {existingDrafts.length === 0 ? (
                                <p className="text-xs text-slate-400 font-bold text-center py-6">No saved subject drafts found.</p>
                            ) : (
                                existingDrafts.map(d => {
                                    const isSel = selectedDraftIdsToMerge.includes(d._id);
                                    return (
                                        <div
                                            key={d._id}
                                            onClick={() => {
                                                setSelectedDraftIdsToMerge(prev =>
                                                    isSel ? prev.filter(id => id !== d._id) : [...prev, d._id]
                                                );
                                            }}
                                            className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between ${
                                                isSel ? 'border-gold bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div>
                                                <h4 className="text-xs font-black text-navy">{d.title}</h4>
                                                <span className="text-[10px] font-bold text-slate-400">{d.subject} &bull; {d.totalQuestions || d.questions?.length} Qs</span>
                                            </div>
                                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black ${
                                                isSel ? 'bg-gold text-navy' : 'border border-slate-300'
                                            }`}>
                                                {isSel ? '✓' : ''}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <span className="text-xs font-black text-navy">
                                {selectedDraftIdsToMerge.length} Subject Papers Selected
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowMergeModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExecuteMerge}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md cursor-pointer"
                                >
                                    Compile Master Exam
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
