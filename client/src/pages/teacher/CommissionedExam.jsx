import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import A4AnswerKey from '../../components/A4AnswerKey';
import A4SolutionKey from '../../components/A4SolutionKey';
import Loader from '../../components/Loader';
import { getQuestionOptionLabels, optionLabel, cleanOptionText } from '../../utils/sanitize';

const EXAM_PATTERNS = {
    NEET: {
        id: 'NEET',
        title: 'NEET (National Eligibility Entrance Test)',
        badge: 'Medical UG',
        subjects: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
        defaultQuotaPerSubject: 45,
        totalQuestions: 180,
        marksPerQ: 4,
        supportsNumerical: false,
    },
    JEE: {
        id: 'JEE',
        title: 'JEE Main (Joint Entrance Examination)',
        badge: 'Engineering',
        subjects: ['Physics', 'Chemistry', 'Mathematics'],
        defaultQuotaPerSubject: 25, // 20 MCQs + 5 Numericals
        totalQuestions: 75,
        marksPerQ: 4,
        supportsNumerical: true,
        secAQuota: 20,
        secBQuota: 5,
    },
    CET: {
        id: 'CET',
        title: 'KCET (Karnataka Common Entrance Test)',
        badge: 'State Entrance',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
        defaultQuotaPerSubject: 60,
        totalQuestions: 240,
        marksPerQ: 1,
        supportsNumerical: false,
    },
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

    // Query params if launched from an existing commissioned exam or assignment
    const paramExamType = searchParams.get('examType');
    const paramSubject = searchParams.get('subject');
    const paramExamId = searchParams.get('examId');

    // Stepper State:
    // 0: Exam Type Selection & Subject Block Split
    // 1: Chapter Selection
    // 2: Concept / Sub-Topic Selection
    // 3: Question Count per Chapter
    // 4: Question Type Distribution & Dynamic Balancing Engine
    // 5: Fetch Mode Selection (Auto Fetch vs Manual Fetch)
    // 6: Alignment & Preview (with Bottom-Right Fixed Save Button & Merge Exam)
    const [currentStep, setCurrentStep] = useState(paramExamType && paramSubject ? 1 : 0);
    const [selectedExamPattern, setSelectedExamPattern] = useState(paramExamType || 'NEET');
    const [selectedSubject, setSelectedSubject] = useState(paramSubject || user?.subject || 'Physics');
    const [selectedClass, setSelectedClass] = useState('Both'); // '11' | '12' | 'Both'
    const [examTitle, setExamTitle] = useState('');

    // Transition Loader state
    const [stepLoading, setStepLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Page 1: Chapter Selection
    const [availableChapters, setAvailableChapters] = useState([]);
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [chapterSearch, setChapterSearch] = useState('');

    // Page 2: Concept Selection
    const [availableConcepts, setAvailableConcepts] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [conceptSearch, setConceptSearch] = useState('');

    // Page 3: Question Count per Chapter
    const [chapterQuotas, setChapterQuotas] = useState({});

    // Page 4: Question Type Distribution & Dynamic Balancing Engine
    // types: mcq, ar, match, diag, stmt, numerical
    const [typeAllocations, setTypeAllocations] = useState({
        mcq: 35,
        ar: 4,
        match: 2,
        diag: 2,
        stmt: 2,
        numerical: 0,
    });

    // Page 5: Fetch Mode
    const [fetchMode, setFetchMode] = useState('auto'); // 'auto' | 'manual'
    const [manualTab, setManualTab] = useState('non_numerical'); // 'non_numerical' | 'numerical' (JEE only)
    const [fetchedQuestions, setFetchedQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [manualSearch, setManualSearch] = useState('');
    const [manualTypeFilter, setManualTypeFilter] = useState('ALL');

    // Page 6: Preview & Alignment Settings
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        optionFormat: 'numeric', // 1, 2, 3, 4 by default
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
    const targetSubjectTotal = patternConfig.defaultQuotaPerSubject;

    // Load templates
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const res = await api.get('/api/templates');
                if (res.data && res.data.length > 0) {
                    setActiveTemplate(res.data[0]);
                }
            } catch (err) {
                console.error('Error fetching templates:', err);
            }
        };
        loadTemplates();
    }, []);

    // Load chapters & concepts when subject changes or entering Step 1
    const fetchMetadata = async (subj) => {
        const normSub = normalizeSubjectName(subj);
        setStepLoading(true);
        setLoadingMessage(`Fetching ${normSub} chapter repository...`);
        try {
            const res = await api.get(`/api/questions/meta?subject=${encodeURIComponent(normSub)}&classes=${encodeURIComponent(selectedClass === 'Both' ? '' : selectedClass)}`);
            const chs = Array.isArray(res.data?.chapters) ? res.data.chapters : [];
            const cpts = Array.isArray(res.data?.concepts) ? res.data.concepts : [];
            setAvailableChapters(chs);
            setAvailableConcepts(cpts);
        } catch (err) {
            console.error('Error fetching meta:', err);
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    // Auto-update default allocations when pattern changes
    useEffect(() => {
        if (selectedExamPattern === 'JEE') {
            setTypeAllocations({
                mcq: 15,
                ar: 2,
                match: 1,
                diag: 1,
                stmt: 1,
                numerical: 5, // Exactly 5 numericals for JEE Section B
            });
        } else if (selectedExamPattern === 'CET') {
            setTypeAllocations({
                mcq: 48,
                ar: 4,
                match: 2,
                diag: 3,
                stmt: 3,
                numerical: 0, // Zero numericals for CET
            });
        } else {
            // NEET
            setTypeAllocations({
                mcq: 35,
                ar: 4,
                match: 2,
                diag: 2,
                stmt: 2,
                numerical: 0, // Zero numericals for NEET
            });
        }
    }, [selectedExamPattern]);

    // Handle Subject Selection in Step 0
    const handleSelectSubjectBlock = async (sub) => {
        const norm = normalizeSubjectName(sub);
        setSelectedSubject(norm);
        await fetchMetadata(norm);
        // Pre-select all chapters or leave open
        setCurrentStep(1);
    };

    // Step 3: Auto-distribute question counts evenly across selected chapters
    const handleDistributeEvenly = () => {
        if (selectedChapters.length === 0) return;
        const total = targetSubjectTotal;
        const count = selectedChapters.length;
        const base = Math.floor(total / count);
        const remainder = total % count;

        const newQuotas = {};
        selectedChapters.forEach((ch, idx) => {
            newQuotas[ch] = base + (idx < remainder ? 1 : 0);
        });
        setChapterQuotas(newQuotas);
    };

    // Page 4 Dynamic Balancing Logic:
    // If user changes a type, automatically adjust the largest category (MCQ) so the sum equals targetSubjectTotal
    const handleTypeCountChange = (typeKey, delta) => {
        setTypeAllocations(prev => {
            const currentVal = prev[typeKey] || 0;
            const newVal = Math.max(0, currentVal + delta);
            if (newVal === currentVal) return prev;

            const change = newVal - currentVal;
            const updated = { ...prev, [typeKey]: newVal };

            // Find other categories that can absorb the change
            const otherKeys = Object.keys(updated).filter(k => k !== typeKey && (patternConfig.supportsNumerical || k !== 'numerical'));
            // Sort by highest value to decrement from largest category
            otherKeys.sort((a, b) => updated[b] - updated[a]);

            let remainingChange = change;
            for (const key of otherKeys) {
                if (remainingChange === 0) break;
                if (remainingChange > 0) {
                    // We increased typeKey, so decrement from other keys
                    const availableToDec = updated[key];
                    const dec = Math.min(availableToDec, remainingChange);
                    updated[key] -= dec;
                    remainingChange -= dec;
                } else {
                    // We decreased typeKey, so increment other keys (add to largest category)
                    const inc = Math.abs(remainingChange);
                    updated[key] += inc;
                    remainingChange = 0;
                }
            }

            return updated;
        });
    };

    // Fetch Questions (Auto or Manual)
    const executeFetch = async () => {
        setStepLoading(true);
        setLoadingMessage('Fetching questions from Supabase repository...');
        try {
            // Build query params
            const queryParams = new URLSearchParams({
                subject: selectedSubject,
                limit: '250',
            });
            if (selectedClass !== 'Both') queryParams.append('classes', selectedClass);

            const res = await api.get(`/api/questions?${queryParams.toString()}`);
            const pool = Array.isArray(res.data?.questions) ? res.data.questions : (Array.isArray(res.data) ? res.data : []);

            // Filter strictly by selected chapters & concepts
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
                // Auto-pick questions matching typeAllocations and chapterQuotas
                const picked = [];
                const poolCopy = [...candidatePool];

                // Pick numericals if JEE
                if (patternConfig.supportsNumerical && typeAllocations.numerical > 0) {
                    const nums = poolCopy.filter(q => (q.type || '').toUpperCase() === 'NUMERICAL');
                    picked.push(...nums.slice(0, typeAllocations.numerical));
                }

                // Pick other types
                const nonNums = poolCopy.filter(q => (q.type || '').toUpperCase() !== 'NUMERICAL');
                const needed = targetSubjectTotal - picked.length;
                picked.push(...nonNums.slice(0, needed));

                setSelectedQuestions(picked);
                setCurrentStep(6); // Proceed to preview
            }
        } catch (err) {
            console.error('Error fetching questions:', err);
            alert('Failed to fetch questions. Please check connection and try again.');
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    // Save persistent draft to backend
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

    // Load existing drafts for Merge Exam
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

    // Merge Exam Engine: Combines completed subject papers into one master exam
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

            const res = await api.post('/api/papers', masterPaper);
            setShowMergeModal(false);
            alert(`Master Exam successfully compiled and saved with ${mergedQuestions.length} questions across ${papersToMerge.length} subjects!`);
            navigate(`/teacher/dashboard/saved-papers`);
        } catch (err) {
            console.error('Error merging exam:', err);
            alert('Failed to merge exam papers.');
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    // Build current paper object for PaperRenderer
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

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="bg-navy text-white px-6 py-4 shadow-lg border-b-2 border-gold flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => currentStep > 0 ? setCurrentStep(prev => prev - 1) : navigate('/teacher/dashboard')}
                        className="bg-white/10 hover:bg-white/20 text-gold px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                    >
                        <span>←</span> Back
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-gold text-navy text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                Commissioned Exam
                            </span>
                            <h1 className="text-base font-black text-white uppercase tracking-tight">
                                {selectedExamPattern} &bull; {selectedSubject}
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Progress Indicators */}
                <div className="hidden lg:flex items-center gap-2">
                    {['Exam & Subject', 'Chapters', 'Concepts', 'Quotas', 'Distribution', 'Fetch', 'Preview & Save'].map((stepLabel, idx) => (
                        <div
                            key={idx}
                            onClick={() => idx < currentStep && setCurrentStep(idx)}
                            className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1 ${
                                currentStep === idx
                                    ? 'bg-gold text-navy shadow-md ring-2 ring-gold/40'
                                    : (idx < currentStep ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/5 text-slate-400 opacity-60')
                            }`}
                        >
                            <span>{idx + 1}.</span>
                            <span>{stepLabel}</span>
                        </div>
                    ))}
                </div>
            </header>

            {/* Transition Loader */}
            {stepLoading && <Loader fullPage={true} text={loadingMessage || 'Loading Repository...'} />}

            {/* Main Stepper Body */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-6">

                {/* ══════════════════════════════════════════════════════════════
                    STEP 0: EXAM TYPE SELECTION & SUBJECT BLOCK SPLIT
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 0 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="text-center max-w-2xl mx-auto space-y-2">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Institutional Blueprint
                            </span>
                            <h2 className="text-3xl font-black text-navy uppercase tracking-tight">
                                Commissioned Examination Workflow
                            </h2>
                            <p className="text-xs text-slate-500 font-semibold">
                                Select target exam blueprint and choose your subject block to commence standardized chapter allocation.
                            </p>
                        </div>

                        {/* Exam Pattern Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {Object.values(EXAM_PATTERNS).map(pattern => {
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
                                                    {pattern.totalQuestions} Qs Total
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-black text-navy mb-1">{pattern.id}</h3>
                                            <p className="text-xs text-slate-500 font-medium mb-4">{pattern.title}</p>
                                        </div>

                                        {/* Subject Blocks for this Exam */}
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                                                Select Subject Block ({pattern.subjects.length} Blocks):
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
                    PAGE 1: CHAPTER SELECTION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Page 1 of 5
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Chapter Selection &bull; {selectedSubject}
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Select the syllabus chapters strictly belonging to {selectedSubject}. ({selectedChapters.length} Selected)
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

                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={`Search ${availableChapters.length} ${selectedSubject} chapters...`}
                                value={chapterSearch}
                                onChange={(e) => setChapterSearch(e.target.value)}
                                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold"
                            />
                        </div>

                        {/* Chapters Grid */}
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

                        {/* Navigation Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(0)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Change Subject
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (selectedChapters.length === 0) {
                                        alert('Please select at least one chapter before proceeding.');
                                        return;
                                    }
                                    setCurrentStep(2);
                                }}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Concepts →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    PAGE 2: CONCEPT / SUB-TOPIC SELECTION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Page 2 of 5
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Concept & Sub-Topic Selection
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Narrow syllabus scope to target concepts within {selectedChapters.length} chosen chapters. ({selectedConcepts.length} Selected)
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedConcepts([...availableConcepts])}
                                    className="bg-navy text-gold text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-navy/90 transition cursor-pointer"
                                >
                                    Select All
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

                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search target concepts..."
                                value={conceptSearch}
                                onChange={(e) => setConceptSearch(e.target.value)}
                                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold"
                            />
                        </div>

                        {/* Concepts Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-2">
                            {availableConcepts
                                .filter(cpt => cpt.toLowerCase().includes(conceptSearch.toLowerCase()))
                                .map((cpt, idx) => {
                                    const isChecked = selectedConcepts.includes(cpt);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (isChecked) {
                                                    setSelectedConcepts(prev => prev.filter(c => c !== cpt));
                                                } else {
                                                    setSelectedConcepts(prev => [...prev, cpt]);
                                                }
                                            }}
                                            className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                                                isChecked
                                                    ? 'bg-navy text-gold border-gold shadow-md'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                                            }`}
                                        >
                                            <span className="text-xs font-black line-clamp-1">{cpt}</span>
                                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black ${
                                                isChecked ? 'bg-gold text-navy' : 'border border-slate-300 text-transparent'
                                            }`}>
                                                ✓
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Navigation Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(1)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Chapters
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleDistributeEvenly();
                                    setCurrentStep(3);
                                }}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Question Count →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    PAGE 3: QUESTION COUNT PER CHAPTER
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Page 3 of 5
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Question Count per Chapter
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Specify the exact number of questions required from each chosen chapter.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleDistributeEvenly}
                                    className="bg-gold text-navy text-xs font-black px-4 py-2 rounded-xl shadow-xs hover:bg-amber-400 transition cursor-pointer"
                                >
                                    ⚡ Auto Distribute ({targetSubjectTotal} Total)
                                </button>
                            </div>
                        </div>

                        {/* Chapters Quota Table */}
                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
                            {selectedChapters.map((ch, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div>
                                        <h4 className="text-xs font-black text-navy">{ch}</h4>
                                        <span className="text-[10px] font-semibold text-slate-400">Target allocation</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setChapterQuotas(prev => ({ ...prev, [ch]: Math.max(0, (prev[ch] || 0) - 1) }))}
                                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-black text-xs hover:bg-slate-100"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={chapterQuotas[ch] ?? 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                setChapterQuotas(prev => ({ ...prev, [ch]: Math.max(0, val) }));
                                            }}
                                            className="w-16 text-center font-black text-sm py-1 border border-slate-300 rounded-lg bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setChapterQuotas(prev => ({ ...prev, [ch]: (prev[ch] || 0) + 1 }))}
                                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-black text-xs hover:bg-slate-100"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Summary Bar */}
                        <div className="bg-navy text-white p-4 rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-bold text-gold">Total Subject Allocation:</span>
                            <span className="text-base font-black">
                                {Object.values(chapterQuotas).reduce((a, b) => a + b, 0)} / {targetSubjectTotal} Questions
                            </span>
                        </div>

                        {/* Navigation Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(2)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Concepts
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(4)}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Question Types →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    PAGE 4: QUESTION TYPE DISTRIBUTION & DYNAMIC BALANCING ENGINE
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 4 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="border-b border-slate-100 pb-5">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Page 4 of 5
                            </span>
                            <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                Question Type Distribution & Dynamic Balancing Engine
                            </h2>
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                Adjust question type distribution. When one type is increased, the engine automatically balances other categories to maintain exact target count.
                            </p>
                        </div>

                        {/* Types Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { key: 'mcq', label: 'Single Correct MCQ', desc: 'Standard 4-choice multiple choice' },
                                { key: 'ar', label: 'Assertion & Reasoning', desc: 'Statement (A) and Reason (R)' },
                                { key: 'match', label: 'Match the Following', desc: 'Column I with Column II pairs' },
                                { key: 'diag', label: 'Diagrammatic Questions', desc: 'Circuit, graph, or ray diagrams' },
                                { key: 'stmt', label: 'Statement-Based Questions', desc: 'Statement I and Statement II' },
                                ...(patternConfig.supportsNumerical ? [
                                    { key: 'numerical', label: 'Numerical Questions (JEE Sec B)', desc: 'Integer value questions strictly for JEE' }
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
                        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex items-center justify-between text-emerald-900">
                            <span className="text-xs font-bold">Dynamic Balance Engine Active:</span>
                            <span className="text-sm font-black">
                                Total: {Object.values(typeAllocations).reduce((a, b) => a + b, 0)} / {targetSubjectTotal} Qs
                            </span>
                        </div>

                        {/* Navigation Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(3)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Quotas
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(5)}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                            >
                                Proceed to Fetch Mode →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    PAGE 5: FETCH MODE SELECTION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 5 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="border-b border-slate-100 pb-5">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Page 5 of 5
                            </span>
                            <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                Fetch Mode Selection
                            </h2>
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                Choose between 1-Click Auto Fetch Generator or Manual Question Inspector.
                            </p>
                        </div>

                        {/* Mode Choice Cards */}
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
                                    Instant 1-click question generation adhering to the configured blueprint, question types, and chapter quotas.
                                </p>
                            </div>

                            <div
                                onClick={() => setFetchMode('manual')}
                                className={`p-6 rounded-3xl border-2 transition cursor-pointer ${
                                    fetchMode === 'manual' ? 'border-gold bg-amber-50/40 ring-4 ring-gold/20 shadow-md' : 'border-slate-200 hover:border-navy'
                                }`}
                            >
                                <div className="text-2xl mb-2">✍️</div>
                                <h3 className="text-base font-black text-navy mb-1">Manual Fetch Mode</h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Hand-pick each question with interactive filters, search bar, and segregated Numerical vs Non-Numerical tabs for JEE.
                                </p>
                            </div>
                        </div>

                        {/* Manual Mode Inspector Sub-view */}
                        {fetchMode === 'manual' && (
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                                {/* JEE Sub-Tabs Exception */}
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
                                            Tab 2: Numerical Section (Sec B)
                                        </button>
                                    </div>
                                )}

                                <p className="text-xs font-bold text-slate-500">
                                    Click questions to toggle selection into this paper. ({selectedQuestions.length} / {targetSubjectTotal} selected)
                                </p>
                            </div>
                        )}

                        {/* Navigation Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(4)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                            >
                                ← Back to Types
                            </button>
                            <button
                                type="button"
                                onClick={executeFetch}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-8 py-3 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
                            >
                                <span>🚀</span>
                                <span>{fetchMode === 'auto' ? 'Execute Auto Fetch & Preview' : 'Load Manual Questions'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    PAGE 6: ALIGNMENT & PREVIEW (WITH BOTTOM-RIGHT FIXED SAVE & MERGE)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 6 && (
                    <div className="space-y-6 animate-fade-in relative pb-24">
                        {/* Top Alignment & Auxiliary Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm no-print">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(5)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy px-3.5 py-1.5 rounded-xl font-bold text-xs"
                                >
                                    ← Back to Setup
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAnswerKey(true)}
                                    className="bg-navy text-gold hover:bg-navy/90 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-xs flex items-center gap-1"
                                >
                                    <span>🔑</span> Answer Key
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSolutionGuide(true)}
                                    className="bg-navy text-gold hover:bg-navy/90 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-xs flex items-center gap-1"
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

                        {/* Paginated Paper Preview */}
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

                        {/* PRIMARY SAVE BUTTON FIXED STRICTLY IN BOTTOM-RIGHT CORNER */}
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
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* List of drafts */}
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
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
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
