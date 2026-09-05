/**
 * CreatePaper.jsx
 *
 * Ultra-Fast & High-Quality Assessment & Assignment Generation Suite
 *
 * Workflow:
 *  Step 1: Scope & Setup (Instant Meta Loading, Multi-Select Chapters & Concepts, Manual Timing)
 *  Step 2: Acquisition Method (Manual Pick vs Auto Fetch)
 *  Step 3: Question Selection & Full Quality Inspection:
 *          - Full Question Stem with Math/Latex & Chem
 *          - Diagrams & Circuits Preview
 *          - All Options (A, B, C, D) Grid Layout
 *          - Inline Solution / Answer Key Toggle
 *          - Swap / Replace Mode & Selected Basket Review
 *  Step 4: True A4 Paginated Preview (Analysis, Answer Key, Solutions Guide)
 *  Step 5: Alignment & Fine-tuning
 *  Step 6: Finalize & Save to Department Archives
 */
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import A4AnswerKey from '../../components/A4AnswerKey';
import A4SolutionKey from '../../components/A4SolutionKey';
import { validatePaperQuestions } from '../../utils/questionValidator';
import { optionLabel, getResolvedAnswerLabel, getQuestionOptionLabels } from '../../utils/sanitize';

// Reference UI QuestionCardOptions with crisp white contrast
const QuestionCardOptions = ({ q, options = [], answer = '', showAnswer = true }) => {
    if (!options || options.length === 0) return null;
    const labels = getQuestionOptionLabels(q);
    const resolvedAnswer = getResolvedAnswerLabel(q);

    return (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100 font-normal text-xs">
            {options.map((opt, oIdx) => {
                const optText = typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '');
                const label = labels[oIdx] || optionLabel(oIdx);
                const isCorrect = (
                    resolvedAnswer === label || 
                    answer === optText || 
                    answer === label || 
                    answer === String(oIdx + 1)
                );

                return (
                    <div
                        key={oIdx}
                        className={`flex items-start gap-2 py-1.5 px-3 rounded-xl transition ${
                            isCorrect
                                ? 'text-emerald-900 font-semibold bg-emerald-50/90 border border-emerald-300 shadow-2xs'
                                : 'text-slate-800 hover:bg-gray-50'
                        }`}
                    >
                        <span className={`font-bold min-w-[22px] ${isCorrect ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {label}:
                        </span>
                        <div className="flex-1 min-w-0 font-normal leading-relaxed text-slate-800">
                            <MathRenderer inline text={optText} />
                        </div>
                        {isCorrect && (
                            <span className="text-emerald-600 font-black ml-1 text-sm">✓</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default function CreatePaper() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Query params
    const examId = searchParams.get('examId');
    const paperId = searchParams.get('paperId');
    const initialCategory = searchParams.get('category') === 'assignment' ? 'assignment' : 'test';

    // Wizard Step: 1 (Configure) -> 2 (Method) -> 3 (Questions) -> 4 (Preview) -> 5 (Alignment)
    // If editing existing paper, default directly to Step 3 (Questions)
    const [currentStep, setCurrentStep] = useState(paperId ? 3 : 1);

    // Step 1: Mode & Academic Metadata
    const [paperCategory, setPaperCategory] = useState(initialCategory);
    const [subject, setSubject] = useState(user?.subject || 'Physics');
    const [selectedClass, setSelectedClass] = useState('12');
    const [examType, setExamType] = useState('CET');
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState('180 Minutes');
    const [targetCount, setTargetCount] = useState(60);

    // Assignment custom question numbering
    const [startQNo, setStartQNo] = useState(1);
    const [endQNo, setEndQNo] = useState(null);

    // Multi-Select Checkbox States for Chapters & Concepts
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);

    // Fast Meta state (loaded in < 50ms)
    const [metaData, setMetaData] = useState({ total: 0, chapters: [], concepts: [] });
    const [loadingMeta, setLoadingMeta] = useState(false);

    // Step 2: Method selection ('manual' | 'auto')
    const [method, setMethod] = useState('manual');

    // Questions Pool & Selection
    const [availableQuestions, setAvailableQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState(null);

    // In-memory Questions Cache by subject + chapter
    const questionsCache = useRef({});

    // Question Swap Mode State
    const [swappingQuestionIndex, setSwappingQuestionIndex] = useState(null);
    const [revealedSolutions, setRevealedSolutions] = useState({});

    // Manual Selection Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [filterType, setFilterType] = useState('');
    const [singleFilterChapter, setSingleFilterChapter] = useState('');
    const [singleFilterConcept, setSingleFilterConcept] = useState('');
    const [pageNumber, setPageNumber] = useState(1);
    const pageSize = 40;

    // Auto Fetch Configuration
    const [autoQty, setAutoQty] = useState(60);
    const [autoDist, setAutoDist] = useState({ easy: 40, medium: 40, hard: 20 });

    // Alignment Settings
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        showCoverPage: false,
        startQNo: 1,
    });

    // Modals & Panels
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
    const [showSolutionsModal, setShowSolutionsModal] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showReviewSelectedModal, setShowReviewSelectedModal] = useState(false);
    const [showLimitReachedModal, setShowLimitReachedModal] = useState(false);
    const [editingQuestionModal, setEditingQuestionModal] = useState(null);

    // Target limit
    const targetLimit = useMemo(() => {
        return targetCount || autoQty || 60;
    }, [targetCount, autoQty]);

    // Target classes array
    const targetClasses = useMemo(() => {
        if (!selectedClass) return [];
        if (selectedClass === 'Both') return ['11', '12', 'Class 11', 'Class 12', 'I PUC', 'II PUC'];
        return [selectedClass, `Class ${selectedClass}`, `${selectedClass}th`, `PUC ${selectedClass}`];
    }, [selectedClass]);

    // Auto default title
    useEffect(() => {
        if (!title || title.includes('Assessment') || title.includes('Assignment') || title.includes('Paper')) {
            if (paperCategory === 'assignment') {
                setTitle(`${subject} Assignment`);
            } else {
                setTitle(`${subject} Assessment`);
            }
        }
    }, [paperCategory, subject]);

    // ── 1. FAST METADATA FETCH (Instant Step 1 Rendering in 30ms) ──
    useEffect(() => {
        const fetchMeta = async () => {
            if (!subject) return;
            setLoadingMeta(true);
            try {
                const cleanClass = selectedClass === 'Both' ? '' : selectedClass;
                let url = `/api/questions/meta?subject=${encodeURIComponent(subject)}`;
                if (cleanClass) {
                    url += `&class=${encodeURIComponent(cleanClass)}`;
                }
                const res = await api.get(url);
                if (res.data) {
                    setMetaData({
                        total: res.data.total || 0,
                        chapters: Array.isArray(res.data.chapters) ? res.data.chapters : [],
                        concepts: Array.isArray(res.data.concepts) ? res.data.concepts : []
                    });
                }
            } catch (err) {
                console.error('Error loading metadata:', err);
            } finally {
                setLoadingMeta(false);
            }
        };

        const fetchTemplates = async () => {
            try {
                const res = await api.get('/api/templates');
                if (res.data && res.data.length > 0) {
                    setActiveTemplate(res.data[0]);
                }
            } catch (e) {
                console.error('Error loading template:', e);
            }
        };

        fetchMeta();
        fetchTemplates();
    }, [subject, selectedClass]);

    // Load Admin Commissioned Exam metadata if examId is present
    useEffect(() => {
        const fetchExamDetails = async () => {
            if (!examId) return;
            try {
                const res = await api.get(`/api/exams/${examId}`);
                const exam = res.data;
                if (exam) {
                    setTitle(exam.title || '');
                    setExamType(exam.examType || 'CET');
                    if (exam.classes && exam.classes.length > 0) setSelectedClass(exam.classes[0]);
                    const myAssignment = (exam.subjectAssignments || []).find(
                        sa => (sa.subject || '').toLowerCase() === (user?.subject || '').toLowerCase()
                    );
                    if (myAssignment) {
                        setTargetCount(myAssignment.targetQuestions || 60);
                        setAutoQty(myAssignment.targetQuestions || 60);
                        if (myAssignment.difficultyDistribution) setAutoDist(myAssignment.difficultyDistribution);
                        if (myAssignment.subject) setSubject(myAssignment.subject);
                    }
                }
            } catch (err) {
                console.error('Error fetching exam metadata:', err);
            }
        };
        fetchExamDetails();
    }, [examId, user]);

    // Load Existing Paper if paperId is present (for Editing)
    useEffect(() => {
        const fetchPaperDetails = async () => {
            if (!paperId) return;
            try {
                const res = await api.get(`/api/papers/${paperId}`);
                const p = res.data;
                if (p) {
                    if (p.title) setTitle(p.title);
                    if (p.subject) setSubject(p.subject);
                    if (p.isAssignment !== undefined) setPaperCategory(p.isAssignment ? 'assignment' : 'test');
                    if (p.classes && p.classes.length > 0) setSelectedClass(p.classes[0]);
                    if (p.duration) setDuration(p.duration);
                    if (p.startQNo) setStartQNo(p.startQNo);
                    if (p.endQNo) setEndQNo(p.endQNo);
                    if (p.difficultyDistribution) setAutoDist(p.difficultyDistribution);
                    if (Array.isArray(p.questions) && p.questions.length > 0) {
                        setSelectedQuestions(p.questions);
                        setTargetCount(p.questions.length);
                        setAutoQty(p.questions.length);
                        setCurrentStep(3); // Jump straight to Questions step
                    }
                }
            } catch (err) {
                console.error('Error fetching paper for editing:', err);
            }
        };
        fetchPaperDetails();
    }, [paperId]);

    // ── 2. HIGH-SPEED QUESTIONS POOL FETCH WITH IN-MEMORY CACHE ──
    const fetchQuestionsPool = async (forceSubject = subject, forceClass = selectedClass) => {
        if (!forceSubject) return;

        const cleanClass = forceClass === 'Both' ? '' : forceClass;
        const cacheKey = `${forceSubject.trim().toLowerCase()}_${cleanClass || 'all'}`;
        if (questionsCache.current[cacheKey] && questionsCache.current[cacheKey].length > 0) {
            setAvailableQuestions(questionsCache.current[cacheKey]);
            return;
        }

        setLoadingQuestions(true);
        try {
            let url = `/api/questions?subject=${encodeURIComponent(forceSubject)}&limit=20000`;
            if (cleanClass) {
                url += `&classes=${encodeURIComponent(cleanClass)}`;
            }
            const res = await api.get(url);
            const qs = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
            questionsCache.current[cacheKey] = qs;
            setAvailableQuestions(qs);
        } catch (err) {
            console.error('Error fetching questions pool:', err);
        } finally {
            setLoadingQuestions(false);
        }
    };

    // Fetch questions pool immediately when subject or selectedClass changes
    useEffect(() => {
        if (subject) {
            fetchQuestionsPool(subject, selectedClass);
        }
    }, [subject, selectedClass]);

    // Distinct chapters and concepts map (Scoped strictly to selected class)
    const { distinctChapters, chapterConceptsMap } = useMemo(() => {
        const chaptersSet = new Set((metaData.chapters || []).filter(Boolean));
        const map = {};

        // Also add from available questions matching this class
        availableQuestions.forEach(q => {
            if (selectedClass && selectedClass !== 'Both' && q.classes && q.classes.length > 0) {
                const cleanTarget = String(selectedClass).replace(/^(class|grade|puc)\s*/i, '').trim().toLowerCase();
                const matches = q.classes.some(c => {
                    const cleanC = String(c).replace(/^(class|grade|puc)\s*/i, '').trim().toLowerCase();
                    return cleanC === cleanTarget || (cleanTarget === '12' && (cleanC === 'ii' || cleanC === '2')) || (cleanTarget === '11' && (cleanC === 'i' || cleanC === '1'));
                });
                if (!matches) return;
            }

            const ch = q.chapter || 'General';
            // Only include chapters in current class syllabus
            if (metaData.chapters && metaData.chapters.length > 0 && !metaData.chapters.includes(ch) && ch !== 'General') {
                return;
            }

            chaptersSet.add(ch);
            if (!map[ch]) map[ch] = new Set();
            const cpt = q.concept || q.topic;
            if (cpt && cpt !== 'General' && cpt !== ch) {
                map[ch].add(cpt);
            }
        });

        // Add meta concepts
        (metaData.concepts || []).forEach(c => {
            if (c && typeof c === 'object' && c.chapter && c.name) {
                chaptersSet.add(c.chapter);
                if (!map[c.chapter]) map[c.chapter] = new Set();
                map[c.chapter].add(c.name);
            }
        });

        const sorted = Array.from(chaptersSet).filter(Boolean).sort();
        const cleanMap = {};
        sorted.forEach(ch => {
            cleanMap[ch] = Array.from(map[ch] || []).sort();
        });

        return { distinctChapters: sorted, chapterConceptsMap: cleanMap };
    }, [metaData, availableQuestions, selectedClass]);

    // Available concepts for checked chapters
    const availableConceptsForSelectedChapters = useMemo(() => {
        if (selectedChapters.length === 0) return [];
        const list = [];
        selectedChapters.forEach(ch => {
            const cList = chapterConceptsMap[ch] || [];
            cList.forEach(c => {
                if (!list.some(item => item.concept === c && item.chapter === ch)) {
                    list.push({ concept: c, chapter: ch });
                }
            });
        });
        return list;
    }, [selectedChapters, chapterConceptsMap]);

    // ── Checkbox Toggle Handlers ──
    const toggleChapter = (ch) => {
        setSelectedChapters(prev => {
            if (prev.includes(ch)) {
                const cList = chapterConceptsMap[ch] || [];
                setSelectedConcepts(cPrev => cPrev.filter(c => !cList.includes(c)));
                return prev.filter(item => item !== ch);
            } else {
                return [...prev, ch];
            }
        });
    };

    const selectAllChapters = () => {
        setSelectedChapters([...distinctChapters]);
    };

    const deselectAllChapters = () => {
        setSelectedChapters([]);
        setSelectedConcepts([]);
    };

    const toggleConcept = (cpt) => {
        setSelectedConcepts(prev => 
            prev.includes(cpt) ? prev.filter(c => c !== cpt) : [...prev, cpt]
        );
    };

    const selectAllConcepts = () => {
        const allCpts = availableConceptsForSelectedChapters.map(i => i.concept);
        setSelectedConcepts([...new Set(allCpts)]);
    };

    const deselectAllConcepts = () => {
        setSelectedConcepts([]);
    };

    // Scoped Question Pool (Ensure all questions load reliably)
    const scopedQuestionPool = useMemo(() => {
        return availableQuestions.filter(q => {
            // If already in selected questions, always preserve it
            const isAlreadySelected = selectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
            if (isAlreadySelected) return true;

            // Class check (permissive: JEE/NEET/CET entrance questions match all high school classes)
            if (selectedClass && selectedClass !== 'Both' && q.classes && q.classes.length > 0) {
                const isGeneralOrEntrance = q.classes.some(c => {
                    const str = String(c).toLowerCase();
                    return str.includes('jee') || str.includes('neet') || str.includes('cet') || str.includes('general');
                });

                if (!isGeneralOrEntrance) {
                    const cleanTarget = String(selectedClass).replace(/^(class|grade|puc)\s*/i, '').trim().toLowerCase();
                    const matchesClass = q.classes.some(qc => {
                        const cleanQC = String(qc).replace(/^(class|grade|puc)\s*/i, '').trim().toLowerCase();
                        return cleanQC === cleanTarget || cleanQC.includes(cleanTarget);
                    });
                    if (!matchesClass) return false;
                }
            }

            // Chapter check
            if (selectedChapters.length > 0) {
                if (!selectedChapters.includes(q.chapter) && q.chapter !== 'General') return false;
            }

            // Concept check
            if (selectedConcepts.length > 0) {
                const qConcept = q.concept || q.topic;
                if (qConcept && qConcept !== 'General' && !selectedConcepts.includes(qConcept)) return false;
            }

            return true;
        });
    }, [availableQuestions, selectedQuestions, selectedChapters, selectedConcepts, selectedClass]);

    // Filtered questions for Manual Selection
    const filteredQuestions = useMemo(() => {
        return scopedQuestionPool.filter(q => {
            const matchesSearch = !searchTerm ||
                (q.questionText || q.question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.chapter || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.concept || q.topic || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesSingleChapter = !singleFilterChapter || q.chapter === singleFilterChapter;
            const matchesSingleConcept = !singleFilterConcept || (q.concept === singleFilterConcept || q.topic === singleFilterConcept);
            const matchesDifficulty = !filterDifficulty || (q.level || 'medium').toLowerCase() === filterDifficulty.toLowerCase();
            const matchesType = !filterType || (q.type || 'MCQ').toUpperCase() === filterType.toUpperCase();

            return matchesSearch && matchesSingleChapter && matchesSingleConcept && matchesDifficulty && matchesType;
        });
    }, [scopedQuestionPool, searchTerm, singleFilterChapter, singleFilterConcept, filterDifficulty, filterType]);

    // Paginated subset for fast browser DOM rendering
    const paginatedQuestions = useMemo(() => {
        return filteredQuestions.slice(0, pageNumber * pageSize);
    }, [filteredQuestions, pageNumber]);

    // Handle Question Click or Swap
    const handleQuestionClick = (question) => {
        const qId = question._id || question.id;

        // If Swap Mode is active
        if (swappingQuestionIndex !== null) {
            setSelectedQuestions(prev => {
                const next = [...prev];
                next[swappingQuestionIndex] = question;
                return next;
            });
            setSwappingQuestionIndex(null);
            return;
        }

        // Standard Toggle
        setSelectedQuestions(prev => {
            const exists = prev.some(q => (q._id || q.id) === qId);
            if (exists) {
                return prev.filter(q => (q._id || q.id) !== qId);
            } else {
                if (prev.length >= targetLimit) {
                    setShowLimitReachedModal(true);
                    return prev;
                }
                return [...prev, question];
            }
        });
    };

    const removeQuestionByIndex = (index) => {
        setSelectedQuestions(prev => prev.filter((_, idx) => idx !== index));
    };

    const toggleSolutionPreview = (idx, e) => {
        e.stopPropagation();
        setRevealedSolutions(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const selectAllMatching = () => {
        setSelectedQuestions(prev => {
            const prevIds = new Set(prev.map(q => q._id || q.id));
            const newToAdd = filteredQuestions.filter(q => !prevIds.has(q._id || q.id));
            const availableSlots = Math.max(0, targetLimit - prev.length);
            if (availableSlots <= 0) {
                setShowLimitReachedModal(true);
                return prev;
            }
            if (newToAdd.length > availableSlots) {
                setShowLimitReachedModal(true);
                return [...prev, ...newToAdd.slice(0, availableSlots)];
            }
            return [...prev, ...newToAdd];
        });
    };

    const deselectAllMatching = () => {
        const matchingIds = new Set(filteredQuestions.map(q => q._id || q.id));
        setSelectedQuestions(prev => prev.filter(q => !matchingIds.has(q._id || q.id)));
    };

    // ── In-Place Question Text & Options Editor ──
    const handleOpenEditQuestion = (question, index) => {
        const idx = index !== undefined ? index : selectedQuestions.findIndex(q => (q._id || q.id) === (question._id || question.id));
        
        let optA = '', optB = '', optC = '', optD = '';
        if (question.options && question.options.length > 0) {
            optA = typeof question.options[0] === 'object' ? (question.options[0].text || question.options[0].optionText || '') : String(question.options[0] || '');
            optB = typeof question.options[1] === 'object' ? (question.options[1].text || question.options[1].optionText || '') : String(question.options[1] || '');
            optC = typeof question.options[2] === 'object' ? (question.options[2].text || question.options[2].optionText || '') : String(question.options[2] || '');
            optD = typeof question.options[3] === 'object' ? (question.options[3].text || question.options[3].optionText || '') : String(question.options[3] || '');
        } else {
            optA = question.opt_a || question.option_a || '';
            optB = question.opt_b || question.option_b || '';
            optC = question.opt_c || question.option_c || '';
            optD = question.opt_d || question.option_d || '';
        }

        setEditingQuestionModal({
            index: idx,
            question,
            form: {
                questionText: question.questionText || question.question || '',
                opt_a: optA,
                opt_b: optB,
                opt_c: optC,
                opt_d: optD,
                answer: question.answer || question.correct_option || 'A',
                solutionText: question.solutionText || question.solution_text || '',
                imageUrl: question.imageUrl || question.image_url || '',
            }
        });
    };

    const handleSaveQuestionEdit = () => {
        if (!editingQuestionModal) return;
        const { index, question, form } = editingQuestionModal;

        const updatedOptions = [
            { label: 'A', text: form.opt_a },
            { label: 'B', text: form.opt_b },
            { label: 'C', text: form.opt_c },
            { label: 'D', text: form.opt_d },
        ];

        const updatedQuestion = {
            ...question,
            questionText: form.questionText,
            question: form.questionText,
            options: updatedOptions,
            opt_a: form.opt_a,
            opt_b: form.opt_b,
            opt_c: form.opt_c,
            opt_d: form.opt_d,
            answer: form.answer,
            correct_option: form.answer,
            solutionText: form.solutionText,
            solution_text: form.solutionText,
            imageUrl: form.imageUrl,
            image_url: form.imageUrl,
        };

        if (index >= 0 && index < selectedQuestions.length) {
            setSelectedQuestions(prev => {
                const next = [...prev];
                next[index] = updatedQuestion;
                return next;
            });
        }

        // Also update in pool cache
        setAvailableQuestions(prev => prev.map(q => (q._id || q.id) === (question._id || question.id) ? updatedQuestion : q));
        setEditingQuestionModal(null);
    };

    // Auto Fetch Generator
    const handleGenerateAuto = () => {
        if (scopedQuestionPool.length === 0) {
            return alert('No questions found matching the selected syllabus chapters & concepts.');
        }

        const count = Math.min(targetLimit, scopedQuestionPool.length);
        const easyTarget = Math.round(count * (autoDist.easy / 100));
        const medTarget = Math.round(count * (autoDist.medium / 100));
        const hardTarget = count - easyTarget - medTarget;

        const easyPool = scopedQuestionPool.filter(q => (q.level || 'medium').toLowerCase() === 'easy');
        const medPool = scopedQuestionPool.filter(q => (q.level || 'medium').toLowerCase() === 'medium');
        const hardPool = scopedQuestionPool.filter(q => (q.level || 'medium').toLowerCase() === 'hard');

        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

        const pickedEasy = shuffle(easyPool).slice(0, easyTarget);
        const pickedMed = shuffle(medPool).slice(0, medTarget);
        const pickedHard = shuffle(hardPool).slice(0, hardTarget);

        let combined = [...pickedEasy, ...pickedMed, ...pickedHard];
        const usedIds = new Set(combined.map(q => q._id || q.id));

        if (combined.length < count) {
            const remainder = scopedQuestionPool.filter(q => !usedIds.has(q._id || q.id));
            combined.push(...shuffle(remainder).slice(0, count - combined.length));
        }

        setSelectedQuestions(combined);
        setMethod('manual'); // Crucial: automatically set method to manual so editing shows questions!
        setCurrentStep(4); // Move to Preview
    };

    // Pre-finalize check
    const handlePreFinalizeCheck = () => {
        if (selectedQuestions.length === 0) {
            alert('Please select at least 1 question before proceeding.');
            return;
        }
        const validation = validatePaperQuestions(selectedQuestions);
        setValidationResult(validation);
        setCurrentStep(4); // Move to Preview
    };

    // Finalize and Save Paper
    const handleFinalizeAndSave = async () => {
        if (selectedQuestions.length === 0) return alert('No questions selected.');
        setSaving(true);

        try {
            const payload = {
                title: title || (paperCategory === 'assignment' ? `${subject} Assignment` : `${subject} Assessment`),
                subject,
                classes: [selectedClass],
                examId: examId || undefined,
                duration: duration || (paperCategory === 'assignment' ? null : '180 Minutes'),
                isAssignment: paperCategory === 'assignment',
                startQNo: startQNo || 1,
                endQNo: endQNo || (startQNo + selectedQuestions.length - 1),
                questions: selectedQuestions.map(q => q._id || q.id),
                questionObjects: selectedQuestions,
                difficultyDistribution: autoDist,
                status: user?.role === 'admin' ? 'Approved' : 'Pending Approval',
            };

            let res;
            if (paperId) {
                res = await api.put(`/api/papers/${paperId}`, payload);
            } else {
                res = await api.post('/api/papers', payload);
            }

            alert(`✓ ${paperCategory === 'assignment' ? 'Assignment' : 'Question Paper'} successfully saved! It is now saved in Department Archives.`);
            if (user?.role === 'admin') {
                navigate(`/admin/dashboard/preview/${res.data._id || paperId}`);
            } else {
                navigate('/teacher/dashboard/saved-papers');
            }
        } catch (err) {
            console.error('Error saving paper:', err);
            alert('Failed to save paper. Please verify details and try again.');
        } finally {
            setSaving(false);
        }
    };

    // Diagram resizing handler (interactive per-diagram scaling)
    const handleDiagramResize = (qIdOrNum, newHeight, diagramKey = 'main') => {
        setSelectedQuestions(prev => prev.map((q, idx) => {
            const isMatch = (q._id && String(q._id) === String(qIdOrNum)) ||
                            (q.id && String(q.id) === String(qIdOrNum)) ||
                            (idx + startQNo === Number(qIdOrNum)) ||
                            (String(idx) === String(qIdOrNum));
            if (!isMatch) return q;
            const nextSizes = {
                ...(q.customDiagramSizes || {}),
                [diagramKey]: newHeight,
            };
            return {
                ...q,
                ...(diagramKey === 'main' ? { customDiagramHeight: newHeight } : {}),
                customDiagramSizes: nextSizes,
            };
        }));
    };

    // Prepared paper object for preview renderer
    const currentPaperObject = useMemo(() => {
        const effectiveEnd = endQNo || (startQNo + selectedQuestions.length - 1);
        const requiredCount = Math.max(0, effectiveEnd - startQNo + 1);
        const displayQuestions = selectedQuestions.slice(0, requiredCount || selectedQuestions.length);

        return {
            _id: paperId || 'new-paper',
            title: title || (paperCategory === 'assignment' ? `${subject} Assignment` : `${subject} Assessment`),
            subject,
            classes: [selectedClass],
            duration: duration || null,
            questions: displayQuestions,
            examType: paperCategory === 'assignment' ? 'ASSIGNMENT' : examType,
            isAssignment: paperCategory === 'assignment',
        };
    }, [paperId, title, paperCategory, subject, selectedClass, duration, selectedQuestions, examType, startQNo, endQNo]);

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            
            {/* ── TOP HEADER / STEP WIZARD BAR ── */}
            <header className="bg-navy p-4 text-white flex justify-between items-center shadow-xl border-b-4 border-gold sticky top-0 z-30">
                <div className="flex items-center gap-4 ml-4">
                    <button
                        onClick={() => navigate('/teacher/dashboard')}
                        className="bg-white/10 hover:bg-white/20 text-gold px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        ← Exit Wizard
                    </button>
                    <div>
                        <h1 className="text-base font-black uppercase tracking-tight leading-none text-white">
                            {paperCategory === 'assignment' ? 'Assignment Generator' : 'Question Paper Generator'}
                        </h1>
                        <span className="text-[10px] text-gold font-bold uppercase tracking-widest mt-0.5 block">
                            {title || `${subject} Assessment`}
                        </span>
                    </div>
                </div>

                {/* Step Indicators - Always freely clickable */}
                <div className="hidden md:flex items-center gap-2 mr-4">
                    {[
                        { num: 1, label: 'Scope & Setup' },
                        { num: 2, label: 'Method' },
                        { num: 3, label: 'Questions' },
                        { num: 4, label: 'Preview' },
                        { num: 5, label: 'Alignment' },
                    ].map((st) => (
                        <button
                            key={st.num}
                            type="button"
                            onClick={() => setCurrentStep(st.num)}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                currentStep === st.num
                                    ? 'bg-gold text-navy shadow-lg scale-105 ring-2 ring-gold/40'
                                    : 'bg-white/10 hover:bg-white/20 text-white/90'
                            }`}
                        >
                            <span>{currentStep > st.num ? '✓' : `${st.num}.`}</span>
                            <span>{st.label}</span>
                        </button>
                    ))}
                </div>
            </header>

            {/* ── STEP CONTENT CONTAINER ── */}
            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
                
                {/* ══════════════════════════════════════════════════════════════
                    STEP 1: SCOPE, MODE & MULTI-SELECT CHAPTERS / CONCEPTS
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 animate-fade-in space-y-8">
                        <div className="border-b border-gray-100 pb-4">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 1 of 5</span>
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Academic Scope & Syllabus Setup</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                Choose mode, specify details, and check multiple chapters and concepts to customize your question pool.
                            </p>
                        </div>

                        {/* ── MODE SELECTION: TEST VS ASSIGNMENT ── */}
                        <div>
                            <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Paper Type</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div
                                    onClick={() => setPaperCategory('test')}
                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-4 ${
                                        paperCategory === 'test'
                                            ? 'border-navy bg-blue-50/50 shadow-md ring-2 ring-navy/10'
                                            : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-navy text-gold flex items-center justify-center text-xl font-bold">
                                        🎓
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-navy uppercase">Standard Assessment / Test</h4>
                                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                            Formal examination paper with manual timing, cover page, and institutional headers.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setPaperCategory('assignment')}
                                    className={`p-5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-4 ${
                                        paperCategory === 'assignment'
                                            ? 'border-gold bg-amber-50/50 shadow-md ring-2 ring-gold/20'
                                            : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gold text-navy flex items-center justify-center text-xl font-bold">
                                        📝
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-navy uppercase">Practice Assignment / Homework</h4>
                                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                            Subject-focused practice sheet with custom question ranges and direct layout.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── METADATA INPUTS ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            {/* Title */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    {paperCategory === 'assignment' ? 'Assignment Title' : 'Paper Title'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={paperCategory === 'assignment' ? "e.g. Chemistry Assignment or Organic Practice Sheet" : "e.g. Physics Midterm Assessment"}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                />
                            </div>

                            {/* Format (Only for Tests) */}
                            {paperCategory === 'test' ? (
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Exam Format</label>
                                    <select
                                        value={examType}
                                        onChange={e => setExamType(e.target.value)}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="CET">CET Standard</option>
                                        <option value="NEET">NEET Standard</option>
                                        <option value="JEE">JEE Standard</option>
                                        <option value="BOARD">PUC Board Standard</option>
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Questions Count</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={targetCount}
                                        onChange={e => {
                                            const v = parseInt(e.target.value) || 10;
                                            setTargetCount(v);
                                            setAutoQty(v);
                                        }}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                    />
                                </div>
                            )}

                            {/* Class */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Class</label>
                                <select
                                    value={selectedClass}
                                    onChange={e => {
                                        setSelectedClass(e.target.value);
                                        setSelectedChapters([]);
                                        setSelectedConcepts([]);
                                    }}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                >
                                    <option value="12">Class 12 (II PUC)</option>
                                    <option value="11">Class 11 (I PUC)</option>
                                    <option value="Both">Both (11th & 12th)</option>
                                </select>
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Academic Subject</label>
                                {user?.role === 'teacher' && !['biology', 'botany', 'zoology'].includes((user?.subject || '').toLowerCase()) ? (
                                    <input
                                        type="text"
                                        value={subject}
                                        disabled
                                        className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-navy bg-gray-100"
                                    />
                                ) : (
                                    <select
                                        value={subject}
                                        onChange={e => {
                                            setSubject(e.target.value);
                                            setSelectedChapters([]);
                                            setSelectedConcepts([]);
                                        }}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        {user?.role === 'teacher' ? (
                                            examType === 'NEET' ? (
                                                <>
                                                    <option value="Botany">Botany (NEET)</option>
                                                    <option value="Zoology">Zoology (NEET)</option>
                                                    <option value="Biology">Biology (All Chapters)</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Biology">Biology (CET / General)</option>
                                                    <option value="Botany">Botany</option>
                                                    <option value="Zoology">Zoology</option>
                                                </>
                                            )
                                        ) : (
                                            <>
                                                <option value="Physics">Physics</option>
                                                <option value="Chemistry">Chemistry</option>
                                                <option value="Mathematics">Mathematics</option>
                                                {examType === 'NEET' ? (
                                                    <>
                                                        <option value="Botany">Botany (NEET)</option>
                                                        <option value="Zoology">Zoology (NEET)</option>
                                                        <option value="Biology">Biology (All Chapters)</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="Biology">Biology</option>
                                                        <option value="Botany">Botany</option>
                                                        <option value="Zoology">Zoology</option>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </select>
                                )}
                            </div>

                            {/* Duration (Manual Input Only) */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Duration (Manual Entry)
                                </label>
                                <input
                                    type="text"
                                    value={duration}
                                    onChange={e => setDuration(e.target.value)}
                                    placeholder="e.g. 180 Minutes, 45 Mins, 1 Hour 30 Mins"
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                />
                            </div>

                            {/* Assignment Question Range */}
                            {paperCategory === 'assignment' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Start Question No.</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={startQNo}
                                            onChange={e => setStartQNo(parseInt(e.target.value) || 1)}
                                            className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">End Question No. (Optional)</label>
                                        <input
                                            type="number"
                                            min={startQNo}
                                            placeholder={`Default: ${startQNo + targetCount - 1}`}
                                            value={endQNo || ''}
                                            onChange={e => setEndQNo(e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ── MULTI-SELECT CHAPTERS (CHECKBOX BOX GRID) ── */}
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                <div>
                                    <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                        <span>📚</span> Select Chapters ({selectedChapters.length} of {distinctChapters.length} Selected)
                                    </h3>
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        Check one or multiple chapters to include in the question pool.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllChapters}
                                        className="text-[11px] font-bold text-navy bg-navy/10 hover:bg-navy hover:text-gold px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deselectAllChapters}
                                        className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {loadingMeta ? (
                                <div className="p-8 text-center text-xs font-bold text-gray-400">Loading syllabus chapters...</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-1">
                                    {distinctChapters.map(ch => {
                                        const isChecked = selectedChapters.includes(ch);
                                        const cCount = (chapterConceptsMap[ch] || []).length;
                                        return (
                                            <div
                                                key={ch}
                                                onClick={() => toggleChapter(ch)}
                                                className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-center gap-3 ${
                                                    isChecked
                                                        ? 'border-navy bg-blue-50/60 shadow-xs'
                                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 text-navy rounded border-gray-300 cursor-pointer"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-bold text-navy block truncate" title={ch}>
                                                        {ch}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                        {cCount} {cCount === 1 ? 'Concept' : 'Concepts'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── MULTI-SELECT CONCEPTS ── */}
                        {selectedChapters.length > 0 ? (
                            <div className="space-y-3 animate-fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                    <div>
                                        <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                            <span>💡</span> Select Concepts & Topics ({selectedConcepts.length} of {availableConceptsForSelectedChapters.length} Selected)
                                        </h3>
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            Available concepts under the {selectedChapters.length} selected chapter(s).
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllConcepts}
                                            className="text-[11px] font-bold text-navy bg-navy/10 hover:bg-navy hover:text-gold px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={deselectAllConcepts}
                                            className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {availableConceptsForSelectedChapters.length === 0 ? (
                                    <div className="p-6 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                        Questions will be drawn from all topics under the selected chapters.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                                        {availableConceptsForSelectedChapters.map(({ concept: cpt, chapter: ch }) => {
                                            const isChecked = selectedConcepts.includes(cpt);
                                            return (
                                                <div
                                                    key={`${ch}-${cpt}`}
                                                    onClick={() => toggleConcept(cpt)}
                                                    className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-center gap-3 ${
                                                        isChecked
                                                            ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-bold text-navy block truncate" title={cpt}>
                                                            {cpt}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500 font-medium block truncate" title={ch}>
                                                            📖 {ch}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center gap-3">
                                <span className="text-lg">💡</span>
                                <span className="text-xs font-bold text-navy">
                                    Select one or more chapters above to view and filter specific concepts & topics.
                                </span>
                            </div>
                        )}

                        {/* ── SCOPE SUMMARY BAR ── */}
                        <div className="bg-navy text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Active Scope</span>
                                <div className="text-sm font-black mt-0.5">
                                    {selectedChapters.length > 0 ? `${selectedChapters.length} Chapters Selected` : 'All Chapters Included'}
                                    {selectedConcepts.length > 0 ? ` • ${selectedConcepts.length} Concepts Selected` : ''}
                                </div>
                            </div>
                            <button
                                onClick={() => setCurrentStep(2)}
                                className="bg-gold text-navy hover:scale-105 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Proceed to Method</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 2: CHOOSE METHOD (MANUAL PICK VS AUTO FETCH)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 animate-fade-in space-y-8">
                        <div className="border-b border-gray-100 pb-4">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 2 of 5</span>
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Choose Acquisition Method</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                Pick questions individually from your selected topics or auto-generate a balanced set.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Manual Pick Card */}
                            <div
                                onClick={() => {
                                    setMethod('manual');
                                    setCurrentStep(3);
                                }}
                                className="border-3 border-gray-200 hover:border-navy hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col justify-between group bg-surface"
                            >
                                <div>
                                    <div className="w-16 h-16 rounded-2xl bg-navy text-gold flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                                        ✍️
                                    </div>
                                    <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">Manual Question Pick</h3>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                        Browse full question texts, formulas, diagrams, and options. Inspect quality and select or swap exactly what you want.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Browse Questions Repository</span>
                                    <span>→</span>
                                </div>
                            </div>

                            {/* Auto Fetch Card */}
                            <div
                                onClick={() => {
                                    setMethod('auto');
                                    setCurrentStep(3);
                                }}
                                className="border-3 border-gray-200 hover:border-gold hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col justify-between group bg-surface"
                            >
                                <div>
                                    <div className="w-16 h-16 rounded-2xl bg-gold text-navy flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                                        ⚡
                                    </div>
                                    <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">Auto Fetch Generator</h3>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                        Automatically assemble questions across all your checked chapters and concepts with customized difficulty distribution.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Configure & Auto-Generate</span>
                                    <span>→</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-start pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setCurrentStep(1)}
                                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                ← Back to Scope Setup
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 3: QUESTION SELECTION / AUTO GENERATION (FULL QUALITY INSPECTION)
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        {/* ── STEP 3 MODE TABS (Allows toggling between Questions Basket and Auto Engine anytime) ── */}
                        <div className="flex items-center gap-2 bg-gray-200/70 p-1.5 rounded-2xl w-fit">
                            <button
                                type="button"
                                onClick={() => setMethod('manual')}
                                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                    method === 'manual'
                                        ? 'bg-navy text-gold shadow-md'
                                        : 'text-gray-600 hover:text-navy hover:bg-gray-100'
                                }`}
                            >
                                <span>✍️ Review & Edit Selected Questions</span>
                                <span className="bg-gold/20 text-gold px-2 py-0.5 rounded-full text-[10px]">
                                    {selectedQuestions.length}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('auto')}
                                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                    method === 'auto'
                                        ? 'bg-navy text-gold shadow-md'
                                        : 'text-gray-600 hover:text-navy hover:bg-gray-100'
                                }`}
                            >
                                <span>⚡ Auto Generator Engine</span>
                            </button>
                        </div>

                        {method === 'auto' ? (
                            /* ── AUTO FETCH CONFIGURATION SCREEN ── */
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-6 max-w-3xl mx-auto">
                                <div className="border-b border-gray-100 pb-4">
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Auto Engine</span>
                                    <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Auto Fetch Configuration</h2>
                                    <p className="text-xs text-gray-500 font-medium mt-1">
                                        Assembling from {scopedQuestionPool.length} available questions across {selectedChapters.length || 'All'} chapters and {selectedConcepts.length || 'All'} concepts.
                                    </p>
                                </div>

                                <div className="space-y-5">
                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Question Quantity</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min={1}
                                                max={scopedQuestionPool.length || 100}
                                                value={autoQty}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value) || 0;
                                                    setAutoQty(v);
                                                    setTargetCount(v);
                                                }}
                                                className="w-32 border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-lg font-black text-navy text-center outline-none"
                                            />
                                            {[15, 30, 45, 60].map(cnt => (
                                                <button
                                                    key={cnt}
                                                    type="button"
                                                    onClick={() => {
                                                        setAutoQty(cnt);
                                                        setTargetCount(cnt);
                                                    }}
                                                    className="px-3.5 py-2.5 rounded-xl font-black text-xs bg-navy/5 hover:bg-navy hover:text-gold text-navy transition cursor-pointer"
                                                >
                                                    {cnt} Qs
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Difficulty Split */}
                                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-navy uppercase tracking-wider">Difficulty Distribution Split</label>
                                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                {autoDist.easy + autoDist.medium + autoDist.hard}% Total
                                            </span>
                                        </div>

                                        <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-200 shadow-inner">
                                            <div style={{ width: `${autoDist.easy}%` }} className="bg-emerald-500 transition-all"></div>
                                            <div style={{ width: `${autoDist.medium}%` }} className="bg-amber-400 transition-all"></div>
                                            <div style={{ width: `${autoDist.hard}%` }} className="bg-rose-500 transition-all"></div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center">
                                                <span className="text-[10px] font-black text-emerald-700 uppercase">🟢 Easy</span>
                                                <input
                                                    type="number"
                                                    value={autoDist.easy}
                                                    onChange={e => setAutoDist({ ...autoDist, easy: parseInt(e.target.value) || 0 })}
                                                    className="w-full text-center font-black text-base text-emerald-800 outline-none mt-1"
                                                />
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-amber-200 text-center">
                                                <span className="text-[10px] font-black text-amber-700 uppercase">🟡 Medium</span>
                                                <input
                                                    type="number"
                                                    value={autoDist.medium}
                                                    onChange={e => setAutoDist({ ...autoDist, medium: parseInt(e.target.value) || 0 })}
                                                    className="w-full text-center font-black text-base text-amber-800 outline-none mt-1"
                                                />
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-rose-200 text-center">
                                                <span className="text-[10px] font-black text-rose-700 uppercase">🔴 Hard</span>
                                                <input
                                                    type="number"
                                                    value={autoDist.hard}
                                                    onChange={e => setAutoDist({ ...autoDist, hard: parseInt(e.target.value) || 0 })}
                                                    className="w-full text-center font-black text-base text-rose-800 outline-none mt-1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={handleGenerateAuto}
                                        className="bg-navy text-gold hover:scale-105 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-xl flex items-center gap-2 cursor-pointer"
                                    >
                                        <span>⚡ Generate & Proceed to Preview</span>
                                        <span>→</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── MANUAL SELECTION SCREEN (FULL QUALITY QUESTION CARDS) ── */
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-200 space-y-6">
                                
                                {/* Active Swap Mode Banner */}
                                {swappingQuestionIndex !== null && (
                                    <div className="bg-amber-500 text-navy p-4 rounded-2xl shadow-lg border-2 border-gold flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">🔄</span>
                                            <div>
                                                <h4 className="font-black text-xs uppercase tracking-wider text-navy">
                                                    Swap Mode Active: Replacing Question #{startQNo + swappingQuestionIndex}
                                                </h4>
                                                <p className="text-[11px] font-bold text-navy/80">
                                                    Click any question below in the repository to replace this question.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSwappingQuestionIndex(null)}
                                            className="bg-navy text-gold px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-navy/90 transition cursor-pointer"
                                        >
                                            ✕ Cancel Swap
                                        </button>
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                                {paperId ? 'Edit Mode' : 'Question Quality View'}
                                            </span>
                                            {paperId && (
                                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                    Saved Paper #{paperId.slice(-6)}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                            {paperId ? `Editing: ${title || 'Saved Paper'}` : 'Select & Quality Check Questions'} ({filteredQuestions.length} in Pool)
                                        </h2>
                                        <p className="text-xs text-gray-500 font-bold">
                                            {selectedQuestions.length} of {targetLimit} Questions Selected
                                        </p>
                                    </div>

                                    {/* Action Bar with clear Back and Forward buttons */}
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                                        >
                                            <span>←</span> Setup (Step 1)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowReviewSelectedModal(true)}
                                            className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer border border-gold/50 shadow-sm flex items-center gap-1.5"
                                        >
                                            <span>👁 Review Basket</span>
                                            <span className="bg-navy text-gold px-2 py-0.5 rounded-full text-[10px] font-black">
                                                {selectedQuestions.length}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePreFinalizeCheck}
                                            disabled={selectedQuestions.length === 0}
                                            className="bg-navy text-gold hover:scale-105 disabled:opacity-30 disabled:pointer-events-none px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>Preview Paper (Step 4)</span>
                                            <span>→</span>
                                        </button>
                                        {paperId && (
                                            <button
                                                type="button"
                                                onClick={handleFinalizeAndSave}
                                                disabled={saving || selectedQuestions.length === 0}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>💾</span> {saving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Filters & Search */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                    <input
                                        type="text"
                                        placeholder="🔍 Search in pool..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setPageNumber(1); }}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    />
                                    <select
                                        value={singleFilterChapter}
                                        onChange={e => { setSingleFilterChapter(e.target.value); setPageNumber(1); }}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Scoped Chapters ({selectedChapters.length || distinctChapters.length})</option>
                                        {(selectedChapters.length > 0 ? selectedChapters : distinctChapters).map(ch => (
                                            <option key={ch} value={ch}>{ch}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={filterDifficulty}
                                        onChange={e => { setFilterDifficulty(e.target.value); setPageNumber(1); }}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Difficulties</option>
                                        <option value="easy">🟢 Easy</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="hard">🔴 Hard</option>
                                    </select>
                                    <select
                                        value={filterType}
                                        onChange={e => { setFilterType(e.target.value); setPageNumber(1); }}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value="">All Question Types</option>
                                        <option value="MCQ">MCQ</option>
                                        <option value="ASSERTION_REASON">Assertion & Reason</option>
                                        <option value="MATCH_FOLLOWING">Match the Column</option>
                                        <option value="STATEMENT_BASED">Statement Based</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={selectAllMatching}
                                            className="flex-1 bg-navy text-gold text-[11px] font-bold py-2 rounded-xl cursor-pointer hover:bg-navy/90"
                                        >
                                            Select All ({filteredQuestions.length})
                                        </button>
                                        <button
                                            onClick={deselectAllMatching}
                                            className="bg-gray-200 text-gray-700 text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-300"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {/* Questions List (Full Question & Option Rendering) */}
                                {loadingQuestions ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400">Loading questions pool...</div>
                                ) : filteredQuestions.length === 0 ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                        No questions match the active filters in this pool.
                                    </div>
                                ) : (
                                    <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
                                        {paginatedQuestions.map((q, idx) => {
                                            const isSelected = selectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
                                            const conceptName = q.concept || q.topic;
                                            const diagramImg = q.imageUrl || q.image_url;
                                            const isSolutionOpen = revealedSolutions[q._id || idx];

                                            return (
                                                <div
                                                    key={q._id || idx}
                                                    className={`p-6 rounded-2xl border transition-all flex flex-col gap-3 ${
                                                        swappingQuestionIndex !== null
                                                            ? 'border-amber-400 bg-amber-50/40 shadow-lg'
                                                            : isSelected
                                                            ? 'border-2 border-emerald-500 bg-emerald-50/20 shadow-md ring-1 ring-emerald-400/30'
                                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md shadow-xs'
                                                    }`}
                                                >
                                                    {/* ── Top Breadcrumbs & Selection Bar ── */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap font-medium">
                                                            <span className="text-navy font-bold uppercase tracking-wider">{q.subject || subject}</span>
                                                            <span>•</span>
                                                            <span>Class {q.classes?.[0] || selectedClass}</span>
                                                            <span>•</span>
                                                            <span>{q.chapter || 'General'}</span>
                                                            <span>•</span>
                                                            <span>{q.type || 'MCQ'}</span>
                                                            <span>•</span>
                                                            <span className={
                                                                (q.level || 'medium').toLowerCase() === 'easy' ? 'text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold' :
                                                                (q.level || 'medium').toLowerCase() === 'hard' ? 'text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-bold' :
                                                                'text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold'
                                                            }>
                                                                {q.level || 'Medium'}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuestionClick(q)}
                                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                                                    isSelected
                                                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                                                        : 'bg-white hover:bg-navy hover:text-gold text-navy border-2 border-navy/20 hover:border-navy'
                                                                }`}
                                                            >
                                                                {isSelected ? '✓ Added' : '+ Add to Paper'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Concept line */}
                                                    {conceptName && conceptName !== 'General' && (
                                                        <div className="text-xs text-slate-500 font-normal">
                                                            Concept: <span className="text-slate-800 font-bold">{conceptName}</span>
                                                        </div>
                                                    )}

                                                    {/* Question Stem (Normal weight, clean typography, zero unwanted bold) */}
                                                    <div className="text-sm font-normal text-slate-900 leading-relaxed">
                                                        <MathRenderer inline text={q.questionText || q.question} />
                                                    </div>

                                                    {/* Centered Diagram / Circuit / Graph */}
                                                    {diagramImg && (
                                                        <div className="my-2 p-2 bg-white rounded-xl border border-gray-200 max-w-sm mx-auto shadow-xs">
                                                            <img
                                                                src={diagramImg}
                                                                alt="Question Diagram"
                                                                className="max-h-48 object-contain mx-auto"
                                                                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Match the Following Two-Column Table */}
                                                    {q.matchPairs && q.matchPairs.length > 0 && (
                                                        <div className="my-2 overflow-x-auto">
                                                            <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                                                                <thead className="bg-gray-50 text-navy text-left font-black">
                                                                    <tr>
                                                                        <th className="p-2.5 border-b border-r border-gray-200">Column A</th>
                                                                        <th className="p-2.5 border-b border-gray-200">Column B</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 text-slate-800">
                                                                    {q.matchPairs.map((pair, pIdx) => (
                                                                        <tr key={pIdx} className="hover:bg-gray-50/60">
                                                                            <td className="p-2.5 border-r border-gray-200">
                                                                                <span className="text-slate-500 font-bold mr-1.5">({String.fromCharCode(97 + pIdx)})</span>
                                                                                <MathRenderer inline text={pair.left || ''} />
                                                                            </td>
                                                                            <td className="p-2.5">
                                                                                <span className="text-slate-500 font-bold mr-1.5">({['i', 'ii', 'iii', 'iv', 'v'][pIdx] || (pIdx + 1)})</span>
                                                                                <MathRenderer inline text={pair.right || ''} />
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}

                                                    {/* Options with Green checkmark on correct answer */}
                                                    {q.options && q.options.length > 0 && (
                                                        <QuestionCardOptions
                                                            q={q}
                                                            options={q.options}
                                                            answer={q.answer || q.correct_option}
                                                            showAnswer={true}
                                                        />
                                                    )}

                                                    {/* Badges & Actions Row */}
                                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-gray-100 text-slate-600 border border-gray-200 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                                                NEET/JEE
                                                            </span>
                                                            {swappingQuestionIndex !== null && (
                                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded animate-pulse">
                                                                    Click to Swap with Q#{startQNo + swappingQuestionIndex}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {(q.answer || q.solutionText || q.solution) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleSolutionPreview(q._id || idx, e);
                                                                    }}
                                                                    className="text-xs font-black text-navy hover:text-gold bg-navy/5 hover:bg-navy border border-navy/20 px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                                                >
                                                                    <span>{isSolutionOpen ? '💡 Hide Solution' : '👁️ View Detailed Answer'}</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Expanded Solution Preview with KaTeX Math Rendering */}
                                                    {isSolutionOpen && (
                                                        <div className="mt-2 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-2 animate-fade-in">
                                                            {q.solutionText || q.solution ? (
                                                                <div className="leading-relaxed">
                                                                    <MathRenderer inline text={q.solutionText || q.solution} />
                                                                </div>
                                                            ) : null}
                                                            <div className="text-emerald-700 font-bold pt-1.5 border-t border-slate-200">
                                                                Therefore, option {getResolvedAnswerLabel(q)} is correct.
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Footer Attribution */}
                                                    <div className="text-[10px] text-slate-400 font-normal pt-1">
                                                        Added by {q.author || q.created_by || 'Faculty'}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Load More Button if pool has more */}
                                        {paginatedQuestions.length < filteredQuestions.length && (
                                            <div className="text-center pt-4 pb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPageNumber(p => p + 1)}
                                                    className="bg-navy text-gold px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider hover:scale-105 transition shadow cursor-pointer"
                                                >
                                                    Load More ({filteredQuestions.length - paginatedQuestions.length} remaining)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── MODAL: REVIEW & EDIT SELECTED BASKET ── */}
                {showReviewSelectedModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                        Selected Questions Management
                                    </span>
                                    <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                        Selected Basket ({selectedQuestions.length} Questions)
                                    </h3>
                                    <p className="text-xs text-gray-500 font-bold">
                                        Review full questions, diagrams, options, and swap or remove any question.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowReviewSelectedModal(false)}
                                    className="text-slate/30 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-4">
                                {selectedQuestions.length === 0 ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400">
                                        No questions selected yet.
                                    </div>
                                ) : (
                                    selectedQuestions.map((q, idx) => {
                                        const diagramImg = q.imageUrl || q.image_url;

                                        return (
                                            <div key={idx} className="border border-gray-200 p-5 rounded-2xl bg-gray-50/50 hover:bg-white hover:border-navy transition flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <span className="text-[10px] font-black bg-navy text-gold px-2 py-0.5 rounded">
                                                            Q.{startQNo + idx}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-navy bg-blue-50 px-2 py-0.5 rounded">
                                                            📖 {q.chapter || 'General'}
                                                        </span>
                                                        {(q.concept || q.topic) && (
                                                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                                                                💡 {q.concept || q.topic}
                                                            </span>
                                                        )}
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                            (q.level || 'medium').toLowerCase() === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                                                            (q.level || 'medium').toLowerCase() === 'hard' ? 'bg-rose-100 text-rose-800' :
                                                            'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {q.level || 'Medium'}
                                                        </span>
                                                        {q.answer && (
                                                            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                                                Answer: ({q.answer})
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Full Question Text */}
                                                    <div className="text-xs font-bold text-navy leading-relaxed">
                                                        <MathRenderer inline text={q.questionText || q.question} />
                                                    </div>

                                                    {/* Diagram */}
                                                    {diagramImg && (
                                                        <div className="mt-2.5 max-w-xs border border-gray-200 rounded-xl overflow-hidden bg-white p-1">
                                                            <img
                                                                src={diagramImg}
                                                                alt="Question Diagram"
                                                                className="max-h-32 object-contain mx-auto"
                                                                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Options */}
                                                    {q.options && q.options.length > 0 && (
                                                        <QuestionCardOptions
                                                            options={q.options}
                                                            answer={q.answer}
                                                            showAnswer={true}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0 sm:self-start">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleOpenEditQuestion(q, idx);
                                                            setShowReviewSelectedModal(false);
                                                        }}
                                                        className="bg-blue-50 text-navy hover:bg-blue-100 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 border border-blue-200"
                                                        title="Edit text, options, or solution of this question"
                                                    >
                                                        <span>✏️</span> Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSwappingQuestionIndex(idx);
                                                            setShowReviewSelectedModal(false);
                                                        }}
                                                        className="bg-amber-100 text-amber-900 hover:bg-amber-200 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-xs"
                                                        title="Swap this question with another"
                                                    >
                                                        <span>🔄</span> Swap
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeQuestionByIndex(idx)}
                                                        className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border border-rose-200"
                                                        title="Remove this question"
                                                    >
                                                        ✕ Remove
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-600">
                                    Total: {selectedQuestions.length} of {targetLimit} Questions
                                </span>
                                <button
                                    onClick={() => setShowReviewSelectedModal(false)}
                                    className="bg-navy text-gold px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Done Reviewing
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MODAL: MAX QUESTIONS REACHED POPUP ── */}
                {showLimitReachedModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-xs p-4 animate-fade-in">
                        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center space-y-4 animate-scale-up">
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mx-auto font-black shadow-inner">
                                ⚠️
                            </div>
                            <h3 className="text-xl font-black text-navy uppercase tracking-tight">
                                Maximum Questions Reached!
                            </h3>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                You have reached the maximum quota of <strong>{targetLimit} questions</strong> for this {paperCategory === 'assignment' ? 'assignment' : 'question paper'}. Extra questions cannot be added.
                            </p>
                            <p className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100 text-left">
                                💡 <strong>Tip:</strong> If you want to change or swap questions, click <strong>"Review Selected"</strong> and use the <strong>Swap</strong> or <strong>Remove</strong> option.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowLimitReachedModal(false)}
                                className="w-full bg-navy hover:bg-navy/90 text-gold py-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                            >
                                Understood & Close
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 4: TRUE A4 PAGE-BY-PAGE PREVIEW + TOOLS
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 4 && (
                    <div className="space-y-6 animate-fade-in">
                        {validationResult && validationResult.issues.length > 0 && (
                            <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl text-xs font-bold text-amber-900 no-print flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{validationResult.issues.length} validation advisory note(s) found in selected questions.</span>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-amber-700">Validated</span>
                            </div>
                        )}

                        {/* Preview Top Toolbar with Edit, Analysis, Key, Solutions */}
                        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm gap-3 no-print">
                            <button
                                type="button"
                                onClick={() => {
                                    setMethod('manual');
                                    setCurrentStep(3);
                                }}
                                className="bg-navy text-gold hover:scale-105 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-2"
                            >
                                <span>←</span> ✏️ Edit / Change Questions
                            </button>

                            <div className="flex items-center gap-2.5 flex-wrap">
                                <button
                                    onClick={() => setShowAnalysisModal(true)}
                                    className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>📊</span> View Analysis
                                </button>
                                <button
                                    onClick={() => setShowAnswerKeyModal(true)}
                                    className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>🔑</span> Answer Key
                                </button>
                                <button
                                    onClick={() => setShowSolutionsModal(true)}
                                    className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>💡</span> Solutions Guide
                                </button>
                                <button
                                    onClick={() => setCurrentStep(5)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition border border-gray-300 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>⚙️</span> Alignment Controls →
                                </button>
                                <button
                                    onClick={handleFinalizeAndSave}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>✓</span> {saving ? 'Saving...' : `Save ${paperCategory === 'assignment' ? 'Assignment' : 'Paper'}`}
                                </button>
                            </div>
                        </div>

                        {/* A4 Paper Renderer */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                isAssignment={paperCategory === 'assignment'}
                                activeTemplate={activeTemplate}
                                settings={{ ...settings, startQNo, endQNo }}
                                setSettings={setSettings}
                                showSettingsPanel={false}
                                onProceedToAlignment={() => setCurrentStep(5)}
                                onProceedToFinalize={handleFinalizeAndSave}
                                onDiagramResize={handleDiagramResize}
                            />
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 5: ALIGNMENT & FINE-TUNING
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 5 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm gap-3 no-print">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentStep(4)}
                                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                >
                                    ← Back to Preview
                                </button>
                                <button
                                    onClick={() => setCurrentStep(3)}
                                    className="bg-gray-100 text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                >
                                    ✏️ Edit Questions
                                </button>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap">
                                <button
                                    onClick={() => setShowAnalysisModal(true)}
                                    className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>📊</span> View Analysis
                                </button>
                                <button
                                    onClick={() => setShowAnswerKeyModal(true)}
                                    className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>🔑</span> Answer Key
                                </button>
                                <button
                                    onClick={() => setShowSolutionsModal(true)}
                                    className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>💡</span> Solutions Guide
                                </button>
                                <button
                                    onClick={handleFinalizeAndSave}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center gap-2 cursor-pointer"
                                >
                                    <span>✓</span> {saving ? 'Finalizing...' : `Save ${paperCategory === 'assignment' ? 'Assignment' : 'Paper'}`}
                                </button>
                            </div>
                        </div>

                        {/* Renderer with Alignment panel open */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                isAssignment={paperCategory === 'assignment'}
                                activeTemplate={activeTemplate}
                                settings={{ ...settings, startQNo, endQNo }}
                                setSettings={setSettings}
                                showSettingsPanel={true}
                                onProceedToFinalize={handleFinalizeAndSave}
                                onDiagramResize={handleDiagramResize}
                            />
                        </div>
                    </div>
                )}

                {/* ── MODAL: ANSWER KEY (TRUE A4 VIEW, DYNAMIC LABELS, INDEPENDENT PRINT & DOWNLOAD) ── */}
                {showAnswerKeyModal && (
                    <A4AnswerKey
                        paper={{ title, subject, classes: [selectedClass, examType], _id: paperId }}
                        questions={selectedQuestions}
                        startQNo={startQNo}
                        onClose={() => setShowAnswerKeyModal(false)}
                        onQuestionsUpdated={(updatedQs) => {
                            setSelectedQuestions(updatedQs);
                        }}
                    />
                )}

                {/* ── MODAL: SOLUTIONS GUIDE (TRUE A4 VIEW, KATEX MATH, INDEPENDENT PRINT & DOWNLOAD) ── */}
                {showSolutionsModal && (
                    <A4SolutionKey
                        paper={{ title, subject, classes: [selectedClass, examType] }}
                        questions={selectedQuestions}
                        startQNo={startQNo}
                        onClose={() => setShowSolutionsModal(false)}
                    />
                )}

                {/* ── MODAL: IN-PLACE QUESTION & OPTIONS EDITOR ── */}
                {editingQuestionModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/90">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                        Question Content Editor
                                    </span>
                                    <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                        {editingQuestionModal.index >= 0 ? `Edit Question #${startQNo + editingQuestionModal.index}` : 'Edit Question Details'}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-bold">
                                        Modify the statement, options, correct answer, and explanation directly.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingQuestionModal(null)}
                                    className="text-slate/30 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5">
                                {/* Question Statement */}
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-1.5">
                                        Question Statement / Text <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={editingQuestionModal.form.questionText}
                                        onChange={e => setEditingQuestionModal(prev => ({
                                            ...prev,
                                            form: { ...prev.form, questionText: e.target.value }
                                        }))}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl p-3.5 text-xs font-bold text-navy outline-none leading-relaxed"
                                        placeholder="Enter full question statement (supports LaTeX math like $E=mc^2$ or chemistry formulas)"
                                    />
                                    {/* Live Preview */}
                                    <div className="mt-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-navy">
                                        <span className="text-[10px] font-black text-gray-400 block mb-1 uppercase tracking-wider">Live Preview:</span>
                                        <MathRenderer inline text={editingQuestionModal.form.questionText || '(Question text preview)'} />
                                    </div>
                                </div>

                                {/* Options (A, B, C, D) */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider">
                                        Answer Options (A, B, C, D)
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {[
                                            { key: 'opt_a', label: 'A' },
                                            { key: 'opt_b', label: 'B' },
                                            { key: 'opt_c', label: 'C' },
                                            { key: 'opt_d', label: 'D' },
                                        ].map(({ key, label }) => (
                                            <div key={key} className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-navy rounded-2xl p-2 bg-white">
                                                <span className="w-7 h-7 rounded-xl bg-navy text-gold flex items-center justify-center text-xs font-black flex-shrink-0">
                                                    {label}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={editingQuestionModal.form[key]}
                                                    onChange={e => setEditingQuestionModal(prev => ({
                                                        ...prev,
                                                        form: { ...prev.form, [key]: e.target.value }
                                                    }))}
                                                    placeholder={`Option ${label}`}
                                                    className="w-full text-xs font-bold text-navy outline-none"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Correct Option & Diagram */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-1.5">
                                            Correct Option
                                        </label>
                                        <select
                                            value={editingQuestionModal.form.answer}
                                            onChange={e => setEditingQuestionModal(prev => ({
                                                ...prev,
                                                form: { ...prev.form, answer: e.target.value }
                                            }))}
                                            className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-black text-navy outline-none bg-white cursor-pointer"
                                        >
                                            <option value="A">Option A</option>
                                            <option value="B">Option B</option>
                                            <option value="C">Option C</option>
                                            <option value="D">Option D</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-1.5">
                                            Diagram Image URL (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={editingQuestionModal.form.imageUrl}
                                            onChange={e => setEditingQuestionModal(prev => ({
                                                ...prev,
                                                form: { ...prev.form, imageUrl: e.target.value }
                                            }))}
                                            placeholder="https://... or diagram link"
                                            className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Solution / Explanation */}
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-1.5">
                                        Solution & Step-by-Step Explanation
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={editingQuestionModal.form.solutionText}
                                        onChange={e => setEditingQuestionModal(prev => ({
                                            ...prev,
                                            form: { ...prev.form, solutionText: e.target.value }
                                        }))}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl p-3 text-xs font-bold text-navy outline-none"
                                        placeholder="Detailed solution explanation"
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingQuestionModal(null)}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveQuestionEdit}
                                    className="bg-navy hover:bg-navy/90 text-gold px-7 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>💾</span> Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MODAL: ANALYSIS DASHBOARD ── */}
                <PaperAnalysisModal
                    isOpen={showAnalysisModal}
                    onClose={() => setShowAnalysisModal(false)}
                    paperTitle={title || `${subject} Assessment`}
                    questions={selectedQuestions}
                    examType={paperCategory === 'assignment' ? 'CET' : examType}
                />
            </main>
        </div>
    );
}