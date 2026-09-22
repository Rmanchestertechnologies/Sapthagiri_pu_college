/**
 * CreatePaper.jsx
 *
 * Ultra-Fast & High-Quality Assessment & Multi-Subject Exam Paper Generation Suite
 *
 * Features:
 *  - Full 100% question retrieval for chapters and concepts (1,042+ for Units & Measurements, 809 for Animal Kingdom, etc.)
 *  - Dedicated Multi-Subject Flow for NEET (Physics, Chemistry, Botany, Zoology - 45 Qs each), JEE (PCM), CET (PCMB), and Mixed
 *  - ⚡ Auto Fetch Generator Engine with difficulty sliders (Easy/Medium/Hard), chapter quotas, and 1-click multi-subject generation
 *  - ✍️ Manual Question Selection with instant search, chapter/concept filters, swap mode, and full LaTeX math/diagram inspection
 *  - True A4 Paginated Preview with Section Dividers (SECTION 1: PHYSICS, SECTION 2: CHEMISTRY, etc.)
 *  - 4-Set Generation (P, Q, R, S) with Section-Aware Question Permutation & 100% Accurate Answer Keys & Solution Guides
 *  - 77,987 Questions Grand Total in Database
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

// Robust chapter normalizer for flawless matching (handles singular/plural, whitespace, punctuation)
const normalizeChapterKey = (str) => {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/s$/, '')
        .replace(/ies$/, 'y');
};

const CANONICAL_LIST = [
    'The Living World',
    'Biological Classification',
    'Plant Kingdom',
    'Morphology of Flowering Plants',
    'Anatomy of Flowering Plants',
    'Cell: The Unit of Life',
    'Cell Cycle and Cell Division',
    'Photosynthesis in Higher Plants',
    'Respiration in Plants',
    'Plant Growth and Development',
    'Animal Kingdom',
    'Structural Organisation in Animals',
    'Biomolecules',
    'Breathing and Exchange of Gases',
    'Body Fluids and Circulation',
    'Excretory Products and Their Elimination',
    'Locomotion and Movement',
    'Neural Control and Coordination',
    'Chemical Coordination and Integration',
    'Sexual Reproduction in Flowering Plants',
    'Principles of Inheritance and Variation',
    'Molecular Basis of Inheritance',
    'Microbes in Human Welfare',
    'Biotechnology: Principles and Processes',
    'Biotechnology and Its Applications',
    'Organisms and Populations',
    'Ecosystem',
    'Biodiversity and Conservation',
    'Human Reproduction',
    'Reproductive Health',
    'Evolution',
    'Human Health and Disease',
    'Units and Measurements',
    'Motion in a Straight Line',
    'Motion in a Plane',
    'Laws of Motion',
    'Work, Energy and Power',
    'System of Particles and Rotational Motion',
    'Gravitation',
    'Mechanical Properties of Solids',
    'Mechanical Properties of Fluids',
    'Thermal Properties of Matter',
    'Thermodynamics',
    'Kinetic Theory',
    'Oscillations',
    'Waves',
    'Electric Charges and Fields',
    'Electrostatic Potential and Capacitance',
    'Current Electricity',
    'Moving Charges and Magnetism',
    'Magnetism and Matter',
    'Electromagnetic Induction',
    'Alternating Current',
    'Electromagnetic Waves',
    'Ray Optics and Optical Instruments',
    'Wave Optics',
    'Dual Nature of Radiation and Matter',
    'Atoms',
    'Nuclei',
    'Semiconductor Electronics: Materials, Devices and Simple Circuits',
    'Communication Systems'
];

const canonicalizeChapterName = (name) => {
    if (!name || typeof name !== 'string') return '';
    const clean = name.trim();
    const targetKey = normalizeChapterKey(clean);
    for (const c of CANONICAL_LIST) {
        if (normalizeChapterKey(c) === targetKey) {
            return c;
        }
    }
    return clean;
};

export default function CreatePaper() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Query params
    const examId = searchParams.get('examId');
    const paperId = searchParams.get('paperId');
    const initialCategory = searchParams.get('category') === 'assignment' ? 'assignment' : 'test';

    // Wizard Step: 1 (Configure) -> 2 (Method) -> 3 (Questions / Auto Engine) -> 4 (Preview) -> 5 (Alignment)
    const [currentStep, setCurrentStep] = useState(paperId ? 3 : 1);

    // Step 1: Mode & Academic Metadata
    const [paperCategory, setPaperCategory] = useState(initialCategory);
    const [subject, setSubject] = useState(user?.subject || 'Physics');
    const [selectedClass, setSelectedClass] = useState('Both');
    const [examType, setExamType] = useState('NEET');
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState('180 Minutes');
    const [targetCount, setTargetCount] = useState(60);

    // Multi-Subject Exam Configuration (NEET: Physics, Chemistry, Botany, Zoology; JEE: Physics, Chemistry, Maths; CET: Physics, Chemistry, Maths, Biology)
    const examSubjects = useMemo(() => {
        if (paperCategory === 'assignment') return [subject || 'Physics'];
        const upperExam = (examType || '').toUpperCase();
        if (upperExam === 'NEET') {
            return ['Physics', 'Chemistry', 'Botany', 'Zoology'];
        }
        if (upperExam === 'JEE') {
            return ['Physics', 'Chemistry', 'Mathematics'];
        }
        if (upperExam === 'CET') {
            return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
        }
        if (subject === 'PCM') return ['Physics', 'Chemistry', 'Mathematics'];
        if (subject === 'PCB') return ['Physics', 'Chemistry', 'Biology'];
        if (subject === 'PCMB') return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
        if (subject && subject.includes(',')) return subject.split(',').map(s => s.trim()).filter(Boolean);
        return [subject || 'Physics'];
    }, [examType, subject, paperCategory]);

    // Active Subject Tab for multi-subject workflow
    const [activeSubjectTab, setActiveSubjectTab] = useState('Physics');

    // Make sure activeSubjectTab is always one of examSubjects
    useEffect(() => {
        if (!examSubjects.includes(activeSubjectTab)) {
            setActiveSubjectTab(examSubjects[0] || 'Physics');
        }
    }, [examSubjects, activeSubjectTab]);

    // Target per subject defaults
    const defaultQuotaForSubject = useMemo(() => {
        const upperExam = (examType || '').toUpperCase();
        if (upperExam === 'NEET') return 45;
        if (upperExam === 'JEE') return 25;
        if (upperExam === 'CET') return 60;
        return Math.max(15, Math.round((targetCount || 60) / Math.max(1, examSubjects.length)));
    }, [examType, targetCount, examSubjects]);

    // Assignment custom question numbering
    const [startQNo, setStartQNo] = useState(1);
    const [endQNo, setEndQNo] = useState(null);

    // Multi-Select Checkbox States per Subject: { [subject]: { chapters: [], concepts: [], quotas: {} } }
    const [subjectSelections, setSubjectSelections] = useState({});

    const currentSubjectSelection = useMemo(() => {
        return subjectSelections[activeSubjectTab] || { chapters: [], concepts: [], quotas: {} };
    }, [subjectSelections, activeSubjectTab]);

    const selectedChapters = currentSubjectSelection.chapters || [];
    const selectedConcepts = currentSubjectSelection.concepts || [];

    const setSelectedChaptersForCurrentSubject = (chArr) => {
        setSubjectSelections(prev => ({
            ...prev,
            [activeSubjectTab]: {
                ...(prev[activeSubjectTab] || {}),
                chapters: typeof chArr === 'function' ? chArr(prev[activeSubjectTab]?.chapters || []) : chArr,
            }
        }));
    };

    const setSelectedConceptsForCurrentSubject = (cptArr) => {
        setSubjectSelections(prev => ({
            ...prev,
            [activeSubjectTab]: {
                ...(prev[activeSubjectTab] || {}),
                concepts: typeof cptArr === 'function' ? cptArr(prev[activeSubjectTab]?.concepts || []) : cptArr,
            }
        }));
    };

    // Question Source Repositories
    const [selectedSources, setSelectedSources] = useState(['subject', 'qbp_control']);

    // Fast Meta state per subject
    const [metaDataCache, setMetaDataCache] = useState({});
    const [loadingMeta, setLoadingMeta] = useState(false);

    const metaData = useMemo(() => {
        return metaDataCache[activeSubjectTab] || { total: 0, chapters: [], concepts: [] };
    }, [metaDataCache, activeSubjectTab]);

    // Step 2/3: Method selection ('auto' | 'manual')
    const [method, setMethod] = useState('auto');

    // Questions Pool & Selection (cached by subject)
    const [questionsPoolCache, setQuestionsPoolCache] = useState({});
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState(null);

    const availableQuestions = useMemo(() => {
        return questionsPoolCache[activeSubjectTab] || [];
    }, [questionsPoolCache, activeSubjectTab]);

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
    const [pageSize, setPageSize] = useState(100); // 40, 100, 250, 500, 'All'

    // Auto Fetch Configuration
    const [autoQtyPerSubject, setAutoQtyPerSubject] = useState(defaultQuotaForSubject);
    const [autoDist, setAutoDist] = useState({ easy: 40, medium: 40, hard: 20 });
    const [autoGenerating, setAutoGenerating] = useState(false);

    useEffect(() => {
        setAutoQtyPerSubject(defaultQuotaForSubject);
    }, [defaultQuotaForSubject]);

    // Alignment Settings
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        showCoverPage: false,
        startQNo: 1,
    });

    // Preview Section Filter (for Step 4 multi-subject review)
    const [previewSectionFilter, setPreviewSectionFilter] = useState('all');

    // Modals & Panels
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
    const [showSolutionsModal, setShowSolutionsModal] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showReviewSelectedModal, setShowReviewSelectedModal] = useState(false);
    const [editingQuestionModal, setEditingQuestionModal] = useState(null);

    // Selected questions grouped by subject
    const selectedQuestionsBySubject = useMemo(() => {
        const groups = {};
        examSubjects.forEach(sub => { groups[sub] = []; });
        selectedQuestions.forEach(q => {
            const sub = q.sectionSubject || q.subject || 'General';
            const matched = examSubjects.find(s => s.toLowerCase() === sub.toLowerCase()) || sub;
            if (!groups[matched]) groups[matched] = [];
            groups[matched].push(q);
        });
        return groups;
    }, [selectedQuestions, examSubjects]);

    // Target Limit for active subject
    const targetLimit = defaultQuotaForSubject;

    // ── 1. LOAD META & TEMPLATES ──
    const fetchMetaForSubject = async (subToFetch) => {
        if (!subToFetch) return;
        setLoadingMeta(true);
        try {
            const res = await api.get(`/api/questions/meta?subject=${encodeURIComponent(subToFetch)}&classes=${encodeURIComponent(selectedClass === 'Both' ? '' : selectedClass)}`);
            setMetaDataCache(prev => ({
                ...prev,
                [subToFetch]: res.data || { total: 0, chapters: [], concepts: [] }
            }));
        } catch (err) {
            console.error('Error loading meta for', subToFetch, err);
        } finally {
            setLoadingMeta(false);
        }
    };

    useEffect(() => {
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

        if (activeSubjectTab && !metaDataCache[activeSubjectTab]) {
            fetchMetaForSubject(activeSubjectTab);
        }
        fetchTemplates();
    }, [activeSubjectTab, selectedClass]);

    // Load Admin Commissioned Exam metadata if examId is present
    useEffect(() => {
        const fetchExamDetails = async () => {
            if (!examId) return;
            try {
                const res = await api.get(`/api/exams/${examId}`);
                const exam = res.data;
                if (exam) {
                    setTitle(exam.title || '');
                    setExamType(exam.examType || 'NEET');
                    if (exam.classes && exam.classes.length > 0) setSelectedClass(exam.classes[0]);
                }
            } catch (err) {
                console.error('Error fetching exam metadata:', err);
            }
        };
        fetchExamDetails();
    }, [examId]);

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
                        setCurrentStep(3);
                    }
                }
            } catch (err) {
                console.error('Error fetching paper for editing:', err);
            }
        };
        fetchPaperDetails();
    }, [paperId]);

    // ── 2. HIGH-SPEED QUESTIONS POOL FETCH ──
    const fetchQuestionsPoolForSubject = async (subToFetch, forceClass = selectedClass, forceSources = selectedSources) => {
        if (!subToFetch) return [];
        const cleanClass = forceClass === 'Both' ? '' : forceClass;

        setLoadingQuestions(true);
        try {
            let url = `/api/questions?subject=${encodeURIComponent(subToFetch)}&limit=25000`;
            if (cleanClass) {
                url += `&classes=${encodeURIComponent(cleanClass)}`;
            }
            if (forceSources && forceSources.length > 0) {
                url += `&source=${encodeURIComponent(forceSources.join(','))}`;
            }
            const res = await api.get(url);
            const rawQs = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
            const qs = rawQs.filter(q => {
                if (!q) return false;
                const typeStr = (q.type || q.q_type || '').toLowerCase();
                if (typeStr === 'true_false' || typeStr === 'true/false' || typeStr === 'tf') return false;
                const opts = Array.isArray(q.options) ? q.options : [];
                if (opts.length === 2 && opts.every(o => /^(true|false)$/i.test(String(typeof o === 'object' ? (o.text || o.option || '') : o).trim()))) return false;
                return true;
            }).map(q => ({
                ...q,
                sectionSubject: subToFetch,
                subject: q.subject || subToFetch,
            }));

            setQuestionsPoolCache(prev => ({
                ...prev,
                [subToFetch]: qs
            }));
            return qs;
        } catch (err) {
            console.error('Error fetching questions pool for', subToFetch, err);
            return [];
        } finally {
            setLoadingQuestions(false);
        }
    };

    // Fetch questions whenever activeSubjectTab or class changes
    useEffect(() => {
        if (activeSubjectTab && !questionsPoolCache[activeSubjectTab]) {
            fetchQuestionsPoolForSubject(activeSubjectTab, selectedClass, selectedSources);
        }
    }, [activeSubjectTab, selectedClass, selectedSources]);

    // Distinct chapters and concepts map (Robust & inclusive of all database questions)
    const { distinctChapters, chapterConceptsMap } = useMemo(() => {
        const chaptersSet = new Set();
        const map = {};

        // 1. Add meta chapters
        (metaData.chapters || []).forEach(ch => {
            if (ch) {
                const canonCh = canonicalizeChapterName(ch);
                chaptersSet.add(canonCh);
                if (!map[canonCh]) map[canonCh] = new Set();
            }
        });

        // 2. Add meta concepts
        (metaData.concepts || []).forEach(c => {
            if (c && typeof c === 'object' && c.chapter && c.name) {
                const canonCh = canonicalizeChapterName(c.chapter);
                chaptersSet.add(canonCh);
                if (!map[canonCh]) map[canonCh] = new Set();
                map[canonCh].add(c.name.trim());
            }
        });

        // 3. Add from available questions
        availableQuestions.forEach(q => {
            const rawCh = q.chapter || 'General';
            const ch = canonicalizeChapterName(rawCh);
            chaptersSet.add(ch);
            if (!map[ch]) map[ch] = new Set();
            const cpt = q.concept || q.topic;
            if (cpt && cpt !== 'General' && cpt !== ch) {
                map[ch].add(cpt.trim());
            }
        });

        const sorted = Array.from(chaptersSet).filter(Boolean).sort();
        const cleanMap = {};
        sorted.forEach(ch => {
            cleanMap[ch] = Array.from(map[ch] || []).sort();
        });

        return { distinctChapters: sorted, chapterConceptsMap: cleanMap };
    }, [metaData, availableQuestions]);

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
        setSelectedChaptersForCurrentSubject(prev => {
            if (prev.includes(ch)) {
                const cList = chapterConceptsMap[ch] || [];
                setSelectedConceptsForCurrentSubject(cPrev => cPrev.filter(c => !cList.includes(c)));
                return prev.filter(item => item !== ch);
            } else {
                return [...prev, ch];
            }
        });
    };

    const selectAllChapters = () => {
        setSelectedChaptersForCurrentSubject([...distinctChapters]);
    };

    const deselectAllChapters = () => {
        setSelectedChaptersForCurrentSubject([]);
        setSelectedConceptsForCurrentSubject([]);
    };

    const toggleConcept = (cpt) => {
        setSelectedConceptsForCurrentSubject(prev => 
            prev.includes(cpt) ? prev.filter(c => c !== cpt) : [...prev, cpt]
        );
    };

    const selectAllConcepts = () => {
        const allCpts = availableConceptsForSelectedChapters.map(i => i.concept);
        setSelectedConceptsForCurrentSubject([...new Set(allCpts)]);
    };

    const deselectAllConcepts = () => {
        setSelectedConceptsForCurrentSubject([]);
    };

    // Scoped Question Pool (Ensure 100% of questions load reliably and match flexibly)
    const scopedQuestionPool = useMemo(() => {
        const canonicalSelectedChapters = selectedChapters.map(canonicalizeChapterName);
        const selectedNormKeys = new Set(selectedChapters.map(normalizeChapterKey));
        const allSelectedConcepts = new Set(selectedConcepts);

        return availableQuestions.filter(q => {
            const isAlreadySelected = selectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
            if (isAlreadySelected) return true;

            const rawCh = q.chapter || 'General';
            const canonCh = canonicalizeChapterName(rawCh);
            const normKey = normalizeChapterKey(rawCh);

            // Chapter check
            if (selectedChapters.length > 0) {
                const matchesChapter = selectedChapters.includes(rawCh) || 
                                       canonicalSelectedChapters.includes(canonCh) || 
                                       selectedNormKeys.has(normKey) ||
                                       rawCh.toLowerCase() === 'general';
                if (!matchesChapter) return false;
            }

            // Concept check
            if (selectedConcepts.length > 0) {
                const qConcept = q.concept || q.topic;
                if (qConcept && qConcept !== 'General' && !allSelectedConcepts.has(qConcept)) {
                    // If no explicit concept match, only accept if all concepts of chapter were checked
                    const chConcepts = chapterConceptsMap[canonCh] || [];
                    const allChConceptsChecked = chConcepts.length > 0 && chConcepts.every(c => allSelectedConcepts.has(c));
                    if (!allChConceptsChecked) return false;
                }
            }

            return true;
        });
    }, [availableQuestions, selectedQuestions, selectedChapters, selectedConcepts, chapterConceptsMap]);

    // Filtered questions for Manual Selection
    const filteredQuestions = useMemo(() => {
        return scopedQuestionPool.filter(q => {
            const matchesSearch = !searchTerm ||
                (q.questionText || q.question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.chapter || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.concept || q.topic || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesSingleChapter = !singleFilterChapter || 
                normalizeChapterKey(q.chapter) === normalizeChapterKey(singleFilterChapter) ||
                canonicalizeChapterName(q.chapter) === canonicalizeChapterName(singleFilterChapter);

            const matchesSingleConcept = !singleFilterConcept || (q.concept === singleFilterConcept || q.topic === singleFilterConcept);
            const matchesDifficulty = !filterDifficulty || (q.level || 'medium').toLowerCase() === filterDifficulty.toLowerCase();
            const matchesType = !filterType || (q.type || 'MCQ').toUpperCase() === filterType.toUpperCase();

            return matchesSearch && matchesSingleChapter && matchesSingleConcept && matchesDifficulty && matchesType;
        });
    }, [scopedQuestionPool, searchTerm, singleFilterChapter, singleFilterConcept, filterDifficulty, filterType]);

    // Paginated subset for browser DOM rendering
    const paginatedQuestions = useMemo(() => {
        if (pageSize === 'All') return filteredQuestions;
        const size = parseInt(pageSize, 10) || 100;
        return filteredQuestions.slice(0, pageNumber * size);
    }, [filteredQuestions, pageNumber, pageSize]);

    // ── 3. AUTO FETCH GENERATOR ALGORITHM ──
    const generateBalancedSetForSubject = (subName, pool, targetQuota, dist, chaptersSelected, conceptsSelected) => {
        if (!pool || pool.length === 0 || targetQuota <= 0) return [];

        const selectedNormKeys = new Set((chaptersSelected || []).map(normalizeChapterKey));
        const allSelectedConcepts = new Set(conceptsSelected || []);

        // Filter pool by chosen chapters/concepts (if any were chosen)
        let candidates = pool.filter(q => {
            const rawCh = q.chapter || 'General';
            const normKey = normalizeChapterKey(rawCh);
            if (chaptersSelected && chaptersSelected.length > 0) {
                const matchesCh = selectedNormKeys.has(normKey) || rawCh.toLowerCase() === 'general';
                if (!matchesCh) return false;
            }
            if (conceptsSelected && conceptsSelected.length > 0) {
                const qCpt = q.concept || q.topic;
                if (qCpt && qCpt !== 'General' && !allSelectedConcepts.has(qCpt)) return false;
            }
            return true;
        });

        if (candidates.length === 0) {
            candidates = [...pool]; // Fallback to full pool if filters yield 0
        }

        // Shuffle candidates thoroughly
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);

        // Calculate distribution quotas
        const easyPct = Number(dist?.easy || 40);
        const medPct = Number(dist?.medium || 40);
        const hardPct = Number(dist?.hard || 20);
        const totalPct = easyPct + medPct + hardPct || 100;

        const targetEasy = Math.round(targetQuota * (easyPct / totalPct));
        const targetMed = Math.round(targetQuota * (medPct / totalPct));
        const targetHard = Math.max(0, targetQuota - targetEasy - targetMed);

        // Group into buckets
        const easyBucket = [];
        const medBucket = [];
        const hardBucket = [];

        shuffled.forEach(q => {
            const lvl = (q.level || 'medium').toLowerCase();
            if (lvl === 'easy') easyBucket.push(q);
            else if (lvl === 'hard') hardBucket.push(q);
            else medBucket.push(q);
        });

        const picked = [];
        const pickedIds = new Set();

        const pickFromBucket = (bucket, count) => {
            let added = 0;
            for (const q of bucket) {
                const id = q._id || q.id;
                if (!pickedIds.has(id) && added < count) {
                    picked.push({
                        ...q,
                        sectionSubject: subName,
                        subject: q.subject || subName,
                    });
                    pickedIds.add(id);
                    added++;
                }
            }
            return added;
        };

        // Pick proportional from each bucket
        pickFromBucket(easyBucket, targetEasy);
        pickFromBucket(medBucket, targetMed);
        pickFromBucket(hardBucket, targetHard);

        // Backfill if buckets fell short
        if (picked.length < targetQuota) {
            for (const q of shuffled) {
                const id = q._id || q.id;
                if (!pickedIds.has(id) && picked.length < targetQuota) {
                    picked.push({
                        ...q,
                        sectionSubject: subName,
                        subject: q.subject || subName,
                    });
                    pickedIds.add(id);
                }
            }
        }

        return picked.slice(0, targetQuota);
    };

    // Auto-Generate Active Subject
    const handleAutoGenerateActiveSubject = async () => {
        setAutoGenerating(true);
        try {
            let pool = questionsPoolCache[activeSubjectTab];
            if (!pool || pool.length === 0) {
                pool = await fetchQuestionsPoolForSubject(activeSubjectTab);
            }

            const quota = autoQtyPerSubject || defaultQuotaForSubject;
            const newQs = generateBalancedSetForSubject(
                activeSubjectTab,
                pool,
                quota,
                autoDist,
                selectedChapters,
                selectedConcepts
            );

            if (newQs.length === 0) {
                alert(`No questions found for ${activeSubjectTab}. Please check connection or selection.`);
                return;
            }

            // Replace questions for this subject in the global basket
            setSelectedQuestions(prev => {
                const others = prev.filter(q => (q.sectionSubject || q.subject || '').toLowerCase() !== activeSubjectTab.toLowerCase());
                return [...others, ...newQs];
            });

        } catch (err) {
            console.error('Error during auto generation:', err);
            alert('Error generating questions. Please try again.');
        } finally {
            setAutoGenerating(false);
        }
    };

    // Auto-Generate All Exam Subjects at once
    const handleAutoGenerateAllSubjects = async () => {
        setAutoGenerating(true);
        try {
            const allPicked = [];
            for (const sub of examSubjects) {
                let pool = questionsPoolCache[sub];
                if (!pool || pool.length === 0) {
                    pool = await fetchQuestionsPoolForSubject(sub);
                }
                const subSel = subjectSelections[sub] || { chapters: [], concepts: [] };
                const quota = defaultQuotaForSubject;
                const pickedForSub = generateBalancedSetForSubject(
                    sub,
                    pool,
                    quota,
                    autoDist,
                    subSel.chapters,
                    subSel.concepts
                );
                allPicked.push(...pickedForSub);
            }

            setSelectedQuestions(allPicked);
            alert(`✓ Successfully Auto-Generated ${allPicked.length} Questions across all ${examSubjects.length} subjects!`);
        } catch (err) {
            console.error('Error in multi-subject auto generation:', err);
            alert('Error generating all subjects. Please try again.');
        } finally {
            setAutoGenerating(false);
        }
    };

    // Clear active subject selection
    const handleClearActiveSubjectQuestions = () => {
        setSelectedQuestions(prev => prev.filter(q => (q.sectionSubject || q.subject || '').toLowerCase() !== activeSubjectTab.toLowerCase()));
    };

    // Handle Question Click or Swap in Manual Selection
    const handleQuestionClick = (question) => {
        const qId = question._id || question.id;
        const qWithSub = {
            ...question,
            sectionSubject: question.sectionSubject || activeSubjectTab,
            subject: question.subject || activeSubjectTab,
        };

        if (swappingQuestionIndex !== null) {
            setSelectedQuestions(prev => {
                const next = [...prev];
                next[swappingQuestionIndex] = qWithSub;
                return next;
            });
            setSwappingQuestionIndex(null);
            return;
        }

        setSelectedQuestions(prev => {
            const exists = prev.some(q => (q._id || q.id) === qId);
            if (exists) {
                return prev.filter(q => (q._id || q.id) !== qId);
            } else {
                return [...prev, qWithSub];
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
            const newToAdd = filteredQuestions
                .filter(q => !prevIds.has(q._id || q.id))
                .map(q => ({ ...q, sectionSubject: q.sectionSubject || activeSubjectTab, subject: q.subject || activeSubjectTab }));
            return [...prev, ...newToAdd];
        });
    };

    const deselectAllMatching = () => {
        const matchingIds = new Set(filteredQuestions.map(q => q._id || q.id));
        setSelectedQuestions(prev => prev.filter(q => !matchingIds.has(q._id || q.id)));
    };

    // In-Place Question Text & Options Editor
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

        setQuestionsPoolCache(prev => {
            const sub = updatedQuestion.sectionSubject || activeSubjectTab;
            const curList = prev[sub] || [];
            return {
                ...prev,
                [sub]: curList.map(q => (q._id || q.id) === (question._id || question.id) ? updatedQuestion : q)
            };
        });
        setEditingQuestionModal(null);
    };

    // Pre-finalize check
    const handlePreFinalizeCheck = () => {
        if (selectedQuestions.length === 0) {
            alert('Please select or auto-generate at least 1 question before proceeding.');
            return;
        }
        const validation = validatePaperQuestions(selectedQuestions);
        setValidationResult(validation);
        setCurrentStep(4);
    };

    // Finalize and Save Paper (supports unified multi-subject merged paper)
    const handleFinalizeAndSave = async () => {
        if (selectedQuestions.length === 0) return alert('No questions selected.');
        setSaving(true);

        try {
            // Organize questions into strict subject order with section headers
            const organizedQuestions = [];
            examSubjects.forEach((sub, sIdx) => {
                const subQuestions = (selectedQuestionsBySubject[sub] || []).map((q, qIdx) => ({
                    ...q,
                    sectionName: `Section ${sIdx + 1}: ${sub.toUpperCase()}`,
                    sectionIndex: sIdx + 1,
                    subject: sub,
                    sectionSubject: sub,
                }));
                organizedQuestions.push(...subQuestions);
            });

            const finalQuestionsList = organizedQuestions.length > 0 ? organizedQuestions : selectedQuestions;

            const payload = {
                title: title || `${examType} Examination (${examSubjects.join(' + ')})`,
                subject: examSubjects.length === 1 ? examSubjects[0] : (subject || examSubjects.join(', ')),
                classes: [selectedClass],
                examId: examId || undefined,
                duration: duration || (paperCategory === 'assignment' ? null : '180 Minutes'),
                isAssignment: paperCategory === 'assignment',
                startQNo: startQNo || 1,
                endQNo: endQNo || (startQNo + finalQuestionsList.length - 1),
                questions: finalQuestionsList.map(q => q._id || q.id),
                questionObjects: finalQuestionsList,
                difficultyDistribution: autoDist,
                status: user?.role === 'admin' ? 'Approved' : 'Pending Approval',
                examType: paperCategory === 'assignment' ? 'ASSIGNMENT' : examType,
            };

            let res;
            if (paperId) {
                res = await api.put(`/api/papers/${paperId}`, payload);
            } else {
                res = await api.post('/api/papers', payload);
            }

            alert(`✓ ${paperCategory === 'assignment' ? 'Assignment' : 'Master Multi-Subject Exam Paper'} successfully merged and saved!`);
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

    // Diagram resizing handler
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
        let displayList = selectedQuestions;

        if (previewSectionFilter !== 'all') {
            displayList = selectedQuestionsBySubject[previewSectionFilter] || [];
        } else {
            const organized = [];
            examSubjects.forEach((sub, sIdx) => {
                const subQs = (selectedQuestionsBySubject[sub] || []).map((q) => ({
                    ...q,
                    sectionName: `Section ${sIdx + 1}: ${sub.toUpperCase()}`,
                    sectionIndex: sIdx + 1,
                    subject: sub,
                }));
                organized.push(...subQs);
            });
            displayList = organized.length > 0 ? organized : selectedQuestions;
        }

        return {
            _id: paperId || 'new-paper',
            title: title || (paperCategory === 'assignment' ? `${subject} Assignment` : `${examType} Examination (${examSubjects.join(' + ')})`),
            subject: examSubjects.length === 1 ? examSubjects[0] : (subject || examSubjects.join(', ')),
            classes: [selectedClass],
            duration: duration || null,
            questions: displayList,
            examType: paperCategory === 'assignment' ? 'ASSIGNMENT' : examType,
            isAssignment: paperCategory === 'assignment',
        };
    }, [paperId, title, paperCategory, subject, selectedClass, duration, selectedQuestions, selectedQuestionsBySubject, previewSectionFilter, examSubjects, examType]);

    // Active subject questions in basket
    const activeSubSelected = selectedQuestionsBySubject[activeSubjectTab] || [];
    const activeSubEasy = activeSubSelected.filter(q => (q.level || 'medium').toLowerCase() === 'easy').length;
    const activeSubMed = activeSubSelected.filter(q => (q.level || 'medium').toLowerCase() === 'medium').length;
    const activeSubHard = activeSubSelected.filter(q => (q.level || 'medium').toLowerCase() === 'hard').length;

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            
            {/* ── TOP HEADER / STEP WIZARD BAR ── */}
            <header className="bg-navy p-4 text-white flex justify-between items-center shadow-xl border-b-4 border-gold sticky top-0 z-30">
                <div className="flex items-center gap-4 ml-4">
                    <button
                        onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard')}
                        className="bg-white/10 hover:bg-white/20 text-gold px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        ← Exit Wizard
                    </button>
                    <div>
                        <h1 className="text-base font-black uppercase tracking-tight leading-none text-white">
                            {paperCategory === 'assignment' ? 'Assignment Generator' : (examSubjects.length > 1 ? `${examType} Multi-Subject Exam Suite` : 'Question Paper Generator')}
                        </h1>
                        <span className="text-[10px] text-gold font-bold uppercase tracking-widest mt-0.5 block">
                            {title || `${subject} Assessment`} • 77,987 Questions in Database
                        </span>
                    </div>
                </div>

                {/* Step Indicators */}
                <div className="hidden md:flex items-center gap-2 mr-4">
                    {[
                        { num: 1, label: 'Scope & Setup' },
                        { num: 2, label: 'Method' },
                        { num: 3, label: 'Questions & Engine' },
                        { num: 4, label: 'Preview & Merge' },
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

            {/* ── MAIN CONTENT CONTAINER ── */}
            <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">

                {/* ══════════════════════════════════════════════════════════════
                    STEP 1: CONFIGURATION & CHAPTER/CONCEPT SELECTION
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-8 animate-fade-in">
                        
                        {/* Title & Mode */}
                        <div className="border-b border-gray-100 pb-4">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 1 of 5</span>
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Examination Scope & Blueprint</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                Configure assessment metadata and pick target chapters and concepts across subjects.
                            </p>
                        </div>

                        {/* Top Config Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">Exam Pattern</label>
                                <select
                                    value={examType}
                                    onChange={(e) => setExamType(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy outline-none bg-white focus:ring-2 focus:ring-gold"
                                >
                                    <option value="NEET">NEET (Physics, Chemistry, Botany, Zoology - 180 Qs)</option>
                                    <option value="JEE">JEE Main (Physics, Chemistry, Maths - 75 Qs)</option>
                                    <option value="CET">KCET (Physics, Chemistry, Maths, Biology - 240 Qs)</option>
                                    <option value="CUSTOM">Custom Single/Multi-Subject</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">Target Class / Stream</label>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy outline-none bg-white focus:ring-2 focus:ring-gold"
                                >
                                    <option value="Both">Both (Class 11 / PUC-I + Class 12 / PUC-II)</option>
                                    <option value="11">Class 11 / PUC-I</option>
                                    <option value="12">Class 12 / PUC-II</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">Assessment Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Grand Mock Test #1"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy outline-none bg-white focus:ring-2 focus:ring-gold"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">Duration</label>
                                <input
                                    type="text"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy outline-none bg-white focus:ring-2 focus:ring-gold"
                                />
                            </div>
                        </div>

                        {/* Subject Tabs Switcher for Chapter Scoping */}
                        {examSubjects.length > 1 && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-black text-navy uppercase tracking-wider">
                                        Select Subject to Configure Chapters & Concepts:
                                    </span>
                                    <span className="text-[11px] font-bold text-gold bg-navy px-3 py-1 rounded-full">
                                        {examSubjects.length} Exam Subjects Included
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {examSubjects.map((sub, sIdx) => {
                                        const isTabActive = activeSubjectTab === sub;
                                        const subSel = subjectSelections[sub] || { chapters: [], concepts: [] };
                                        const chCount = subSel.chapters.length;

                                        return (
                                            <button
                                                key={sub}
                                                type="button"
                                                onClick={() => setActiveSubjectTab(sub)}
                                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                                    isTabActive
                                                        ? 'bg-navy text-gold ring-2 ring-gold shadow-md scale-105'
                                                        : 'bg-white text-slate-700 border border-gray-300 hover:bg-slate-100'
                                                }`}
                                            >
                                                <span>Section {sIdx + 1}: {sub}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    chCount > 0 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                                                }`}>
                                                    {chCount > 0 ? `${chCount} Ch` : 'All Ch'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Chapter Multi-Select Grid for Active Subject */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                <div>
                                    <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                                        {activeSubjectTab} Chapters ({distinctChapters.length} Available)
                                    </h3>
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        Check chapters to focus questions. Leaving all unchecked includes all chapters.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllChapters}
                                        className="text-[11px] font-bold text-navy bg-gold/20 hover:bg-gold/40 px-3 py-1 rounded-xl transition cursor-pointer"
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

                            {loadingMeta || loadingQuestions ? (
                                <div className="p-8 text-center text-xs font-bold text-gray-400">Loading chapters for {activeSubjectTab}...</div>
                            ) : distinctChapters.length === 0 ? (
                                <div className="p-8 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                    No chapters found for {activeSubjectTab}. Questions from the general pool will be used.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
                                    {distinctChapters.map(ch => {
                                        const isChecked = selectedChapters.includes(ch);
                                        const cCount = (chapterConceptsMap[ch] || []).length;
                                        return (
                                            <div
                                                key={ch}
                                                onClick={() => toggleChapter(ch)}
                                                className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-center gap-3 ${
                                                    isChecked
                                                        ? 'border-navy bg-navy/5 shadow-xs'
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
                                                    {cCount > 0 && (
                                                        <span className="text-[10px] text-gray-500 font-medium">
                                                            {cCount} Concept(s)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Concept Multi-Select if Chapters are Selected */}
                        {selectedChapters.length > 0 && availableConceptsForSelectedChapters.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                                            Specific Concepts in Selected Chapters ({availableConceptsForSelectedChapters.length})
                                        </h3>
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            Optional: Select specific sub-concepts or leave blank to include full chapters.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllConcepts}
                                            className="text-[11px] font-bold text-navy bg-gold/20 hover:bg-gold/40 px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Select All Concepts
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
                            </div>
                        )}

                        {/* Bottom Scope Summary Bar */}
                        <div className="bg-navy text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                            <div>
                                <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Active Scope & Target</span>
                                <div className="text-sm font-black mt-0.5">
                                    {examSubjects.length > 1 ? `${examSubjects.length} Subjects (${examSubjects.join(' + ')}) • Target: ${defaultQuotaForSubject * examSubjects.length} Questions` : `${subject} • Target: ${targetLimit} Questions`}
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
                            <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Choose Question Acquisition Method</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                Auto-generate balanced questions with 1-click or manually pick questions with full quality checks.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                    <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">Auto Fetch Generator Engine</h3>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                        Automatically assemble questions across all your checked chapters and concepts with customized difficulty distribution (Easy / Medium / Hard) and 1-click generation for all subjects.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Open Auto Fetch Engine</span>
                                    <span>→</span>
                                </div>
                            </div>

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
                                    <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">Manual Question Selection</h3>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                        Browse full question stems, formulas, diagrams, and options. Inspect quality and select or swap exactly what you want.
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                    <span>Browse Questions Repository</span>
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
                    STEP 3: QUESTION SELECTION & AUTO FETCH GENERATOR ENGINE
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Multi-Subject Tabs Switcher */}
                        {examSubjects.length > 1 && (
                            <div className="bg-white p-4 rounded-2xl border-2 border-navy/20 shadow-md flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-navy uppercase tracking-wider mr-2">
                                        Exam Sections:
                                    </span>
                                    {examSubjects.map((sub, sIdx) => {
                                        const isTabActive = activeSubjectTab === sub;
                                        const count = (selectedQuestionsBySubject[sub] || []).length;
                                        const target = defaultQuotaForSubject;
                                        const isDone = count >= target;

                                        return (
                                            <button
                                                key={sub}
                                                type="button"
                                                onClick={() => {
                                                    setActiveSubjectTab(sub);
                                                    setPageNumber(1);
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow-xs ${
                                                    isTabActive
                                                        ? 'bg-navy text-gold ring-2 ring-gold/50 shadow-md scale-105'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                <span>Section {sIdx + 1}: {sub}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    isDone ? 'bg-emerald-600 text-white' : 'bg-gold/20 text-navy'
                                                }`}>
                                                    {count}/{target} {isDone ? '✓' : ''}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="text-xs font-black text-navy bg-gold/20 px-3 py-1.5 rounded-xl">
                                    Total Selected: {selectedQuestions.length} / {defaultQuotaForSubject * examSubjects.length} Questions
                                </div>
                            </div>
                        )}

                        {/* Top Mode Segmented Switcher (Auto Fetch vs Manual) */}
                        <div className="flex flex-wrap items-center justify-between bg-white p-3 rounded-2xl border border-gray-200 shadow-sm gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMethod('auto')}
                                    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                        method === 'auto'
                                            ? 'bg-gold text-navy shadow-md ring-2 ring-gold/40 scale-105'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <span>⚡ Auto Fetch Generator Engine</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMethod('manual')}
                                    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                        method === 'manual'
                                            ? 'bg-navy text-gold shadow-md ring-2 ring-navy/40 scale-105'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <span>✍️ Manual Question Selection</span>
                                    <span className="bg-gold/30 text-navy px-2 py-0.5 rounded-full text-[10px]">
                                        {filteredQuestions.length} in pool
                                    </span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReviewSelectedModal(true)}
                                    className="bg-gold/20 hover:bg-gold/40 text-navy px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer border border-gold/40 flex items-center gap-1.5"
                                >
                                    <span>👁 Basket: {selectedQuestions.length} Qs</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePreFinalizeCheck}
                                    disabled={selectedQuestions.length === 0}
                                    className="bg-navy text-gold hover:scale-105 disabled:opacity-30 disabled:pointer-events-none px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>Proceed to Preview (Step 4) →</span>
                                </button>
                            </div>
                        </div>

                        {/* ──────────────────────────────────────────────────────────
                            VIEW A: AUTO FETCH GENERATOR ENGINE
                        ────────────────────────────────────────────────────────── */}
                        {method === 'auto' && (
                            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-8 animate-fade-in">
                                
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                                {activeSubjectTab} Section
                                            </span>
                                            <span className="text-[10px] font-black text-navy bg-blue-100 px-2.5 py-0.5 rounded-full">
                                                {availableQuestions.length} Questions in Subject Pool
                                            </span>
                                        </div>
                                        <h2 className="text-2xl font-black text-navy mt-1 uppercase tracking-tight">
                                            Auto Fetch Generator Engine
                                        </h2>
                                        <p className="text-xs text-gray-500 font-medium">
                                            Instantly extract balanced questions for {activeSubjectTab} or generate all {examSubjects.length} subjects at once.
                                        </p>
                                    </div>

                                    {/* Multi-Subject 1-Click Action */}
                                    {examSubjects.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={handleAutoGenerateAllSubjects}
                                            disabled={autoGenerating}
                                            className="bg-gradient-to-r from-navy to-slate-900 text-gold hover:scale-105 border-2 border-gold px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition flex items-center gap-2 cursor-pointer"
                                        >
                                            <span>⚡</span>
                                            <span>{autoGenerating ? 'Generating All Subjects...' : `Auto-Generate All ${examSubjects.length} Subjects (${defaultQuotaForSubject * examSubjects.length} Qs)`}</span>
                                        </button>
                                    )}
                                </div>

                                {/* Controls: Target Count & Difficulty Distribution */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-gray-200">
                                    
                                    {/* 1. Target Quota for Active Subject */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-navy uppercase tracking-wider">
                                                {activeSubjectTab} Target Quota
                                            </label>
                                            <span className="text-sm font-black text-navy bg-white px-3 py-1 rounded-xl border border-gray-300">
                                                {autoQtyPerSubject} Questions
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={120}
                                            step={5}
                                            value={autoQtyPerSubject}
                                            onChange={(e) => setAutoQtyPerSubject(parseInt(e.target.value, 10))}
                                            className="w-full accent-navy cursor-pointer"
                                        />
                                        <div className="flex justify-between text-[10px] font-bold text-gray-400">
                                            <span>5 Qs</span>
                                            <span>Standard ({defaultQuotaForSubject})</span>
                                            <span>120 Qs</span>
                                        </div>
                                    </div>

                                    {/* 2. Difficulty Distribution Sliders */}
                                    <div className="space-y-3 md:col-span-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-navy uppercase tracking-wider">
                                                Difficulty Distribution
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setAutoDist({ easy: 40, medium: 40, hard: 20 })}
                                                    className="text-[10px] font-black text-navy bg-white px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100"
                                                >
                                                    Balanced (40/40/20)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAutoDist({ easy: 45, medium: 45, hard: 10 })}
                                                    className="text-[10px] font-black text-navy bg-white px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100"
                                                >
                                                    NEET/CET (45/45/10)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAutoDist({ easy: 25, medium: 50, hard: 25 })}
                                                    className="text-[10px] font-black text-navy bg-white px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100"
                                                >
                                                    JEE (25/50/25)
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white p-3 rounded-2xl border border-emerald-200">
                                                <div className="flex justify-between text-xs font-black text-emerald-800 mb-1">
                                                    <span>🟢 Easy</span>
                                                    <span>{autoDist.easy}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    value={autoDist.easy}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10);
                                                        const rem = Math.max(0, 100 - val);
                                                        setAutoDist({ easy: val, medium: Math.round(rem * 0.6), hard: rem - Math.round(rem * 0.6) });
                                                    }}
                                                    className="w-full accent-emerald-600 cursor-pointer"
                                                />
                                            </div>

                                            <div className="bg-white p-3 rounded-2xl border border-amber-200">
                                                <div className="flex justify-between text-xs font-black text-amber-800 mb-1">
                                                    <span>🟡 Medium</span>
                                                    <span>{autoDist.medium}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    value={autoDist.medium}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10);
                                                        const rem = Math.max(0, 100 - val);
                                                        setAutoDist(prev => ({ ...prev, medium: val, hard: rem - prev.easy < 0 ? 0 : 100 - prev.easy - val }));
                                                    }}
                                                    className="w-full accent-amber-500 cursor-pointer"
                                                />
                                            </div>

                                            <div className="bg-white p-3 rounded-2xl border border-rose-200">
                                                <div className="flex justify-between text-xs font-black text-rose-800 mb-1">
                                                    <span>🔴 Hard</span>
                                                    <span>{autoDist.hard}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    value={autoDist.hard}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10);
                                                        setAutoDist(prev => ({ ...prev, hard: val, medium: Math.max(0, 100 - prev.easy - val) }));
                                                    }}
                                                    className="w-full accent-rose-600 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Subject Chapter Scope Banner */}
                                <div className="border border-gray-200 rounded-2xl p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">📖</span>
                                        <div>
                                            <h4 className="text-xs font-black text-navy uppercase tracking-wider">
                                                Chapter Scope for {activeSubjectTab}
                                            </h4>
                                            <p className="text-[11px] text-gray-500 font-medium">
                                                {selectedChapters.length > 0 
                                                    ? `${selectedChapters.length} Chapters selected (${selectedChapters.slice(0, 3).join(', ')}${selectedChapters.length > 3 ? '...' : ''})` 
                                                    : `All ${distinctChapters.length || 'available'} chapters in ${activeSubjectTab} will be sampled equally`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(1)}
                                        className="text-xs font-black text-navy hover:text-gold bg-slate-100 hover:bg-navy px-3 py-1.5 rounded-xl transition cursor-pointer"
                                    >
                                        Edit Chapters in Step 1 ✏️
                                    </button>
                                </div>

                                {/* Auto-Generate Active Subject Action Button */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-navy rounded-2xl shadow-xl">
                                    <div className="text-white">
                                        <div className="text-xs font-black text-gold uppercase tracking-widest">
                                            Ready to Generate {activeSubjectTab}
                                        </div>
                                        <div className="text-sm font-black mt-0.5">
                                            {autoQtyPerSubject} Questions • {Math.round(autoQtyPerSubject * (autoDist.easy / 100))} Easy, {Math.round(autoQtyPerSubject * (autoDist.medium / 100))} Medium, {autoQtyPerSubject - Math.round(autoQtyPerSubject * (autoDist.easy / 100)) - Math.round(autoQtyPerSubject * (autoDist.medium / 100))} Hard
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {activeSubSelected.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleClearActiveSubjectQuestions}
                                                className="bg-white/10 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                            >
                                                Clear {activeSubjectTab}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleAutoGenerateActiveSubject}
                                            disabled={autoGenerating}
                                            className="bg-gold text-navy hover:scale-105 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <span>⚡</span>
                                            <span>{autoGenerating ? 'Generating...' : `Generate ${activeSubjectTab} Questions`}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Live Generated Basket Stats for this Subject */}
                                {activeSubSelected.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                                                Generated {activeSubjectTab} Questions ({activeSubSelected.length} Selected)
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                    🟢 {activeSubEasy} Easy
                                                </span>
                                                <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                                    🟡 {activeSubMed} Medium
                                                </span>
                                                <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full">
                                                    🔴 {activeSubHard} Hard
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                                            {activeSubSelected.map((q, idx) => (
                                                <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-2">
                                                    <span className="text-[10px] font-black bg-navy text-gold px-1.5 py-0.5 rounded mt-0.5">
                                                        Q.{idx + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[11px] font-bold text-navy block truncate">
                                                            {q.chapter || 'General'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 block truncate">
                                                            {q.questionText || q.question}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ──────────────────────────────────────────────────────────
                            VIEW B: MANUAL QUESTION SELECTION SCREEN
                        ────────────────────────────────────────────────────────── */}
                        {method === 'manual' && (
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-200 space-y-6 animate-fade-in">
                                
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
                                                {activeSubjectTab} Pool
                                            </span>
                                            <span className="text-[10px] font-black text-navy bg-blue-100 px-2.5 py-0.5 rounded-full">
                                                {filteredQuestions.length} Questions Available
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                            {activeSubjectTab}: Select & Quality Check Questions
                                        </h2>
                                        <p className="text-xs text-gray-500 font-bold">
                                            {(selectedQuestionsBySubject[activeSubjectTab] || []).length} of {defaultQuotaForSubject} Questions Selected for {activeSubjectTab}
                                        </p>
                                    </div>

                                    {/* Action Bar */}
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
                                    </div>
                                </div>

                                {/* Quick Filters, Search & Page Size */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                    <input
                                        type="text"
                                        placeholder="🔍 Search text or chapter..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setPageNumber(1); }}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white md:col-span-2"
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
                                        value={pageSize}
                                        onChange={e => { setPageSize(e.target.value === 'All' ? 'All' : parseInt(e.target.value, 10)); setPageNumber(1); }}
                                        className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                                    >
                                        <option value={40}>Show 40 / page</option>
                                        <option value={100}>Show 100 / page</option>
                                        <option value={250}>Show 250 / page</option>
                                        <option value={500}>Show 500 / page</option>
                                        <option value="All">Show All ({filteredQuestions.length})</option>
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

                                {/* Questions List */}
                                {loadingQuestions ? (
                                    <div className="p-12 text-center text-xs font-bold text-gray-400">Loading {activeSubjectTab} questions pool...</div>
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
                                                    {/* Top Breadcrumbs */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap font-medium">
                                                            <span className="text-navy font-bold uppercase tracking-wider">{q.sectionSubject || q.subject || activeSubjectTab}</span>
                                                            <span>•</span>
                                                            <span className="text-slate-800 font-bold">{q.chapter || 'General'}</span>
                                                            {conceptName && conceptName !== 'General' && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-slate-600 font-medium">🏷️ {conceptName}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                                (q.level || 'medium').toLowerCase() === 'easy'
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : (q.level || 'medium').toLowerCase() === 'hard'
                                                                    ? 'bg-rose-100 text-rose-800'
                                                                    : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {q.level || 'Medium'}
                                                            </span>

                                                            {/* Select / Deselect Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuestionClick(q)}
                                                                className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs ${
                                                                    swappingQuestionIndex !== null
                                                                        ? 'bg-amber-500 text-navy hover:scale-105'
                                                                        : isSelected
                                                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                                        : 'bg-navy text-gold hover:bg-navy/90'
                                                                }`}
                                                            >
                                                                {swappingQuestionIndex !== null
                                                                    ? '🔄 Select to Swap'
                                                                    : isSelected
                                                                    ? '✓ Selected'
                                                                    : '+ Add to Basket'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Question Body */}
                                                    <div className="text-sm font-medium text-slate-900 leading-relaxed">
                                                        <MathRenderer inline text={q.questionText || q.question} />
                                                    </div>

                                                    {/* Diagram */}
                                                    {diagramImg && (
                                                        <div className="my-2 max-w-sm border border-gray-200 rounded-xl overflow-hidden bg-white p-2">
                                                            <img
                                                                src={diagramImg}
                                                                alt="Question Diagram"
                                                                className="max-h-48 object-contain mx-auto"
                                                                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Options */}
                                                    {q.options && q.options.length > 0 && (
                                                        <QuestionCardOptions
                                                            q={q}
                                                            options={q.options}
                                                            answer={q.answer || q.correct_option}
                                                            showAnswer={true}
                                                        />
                                                    )}

                                                    {/* Badges & Actions */}
                                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-gray-100 text-slate-600 border border-gray-200 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                                                {activeSubjectTab}
                                                            </span>
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

                                                    {/* Solution Preview */}
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
                                                </div>
                                            );
                                        })}

                                        {/* Load More Button */}
                                        {pageSize !== 'All' && paginatedQuestions.length < filteredQuestions.length && (
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
                                </div>
                                <button
                                    onClick={() => setShowReviewSelectedModal(false)}
                                    className="text-slate-400 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition cursor-pointer"
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
                                                            {q.sectionSubject || q.subject || 'Subject'} • {q.chapter || 'General'}
                                                        </span>
                                                        {q.answer && (
                                                            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                                                Answer: ({q.answer})
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-xs font-bold text-navy leading-relaxed">
                                                        <MathRenderer inline text={q.questionText || q.question} />
                                                    </div>

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

                                                    {q.options && q.options.length > 0 && (
                                                        <QuestionCardOptions
                                                            q={q}
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
                                                    >
                                                        <span>🔄</span> Swap
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeQuestionByIndex(idx)}
                                                        className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border border-rose-200"
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
                                    Total: {selectedQuestions.length} Questions in Basket
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

                {/* ══════════════════════════════════════════════════════════════
                    STEP 4: TRUE A4 PAGE-BY-PAGE PREVIEW & MERGE
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

                        {/* Multi-Subject Preview Tabs */}
                        {examSubjects.length > 1 && (
                            <div className="bg-white p-3.5 rounded-2xl border-2 border-navy/20 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-navy uppercase tracking-wider mr-2">
                                        Preview Mode:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewSectionFilter('all')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow-xs ${
                                            previewSectionFilter === 'all'
                                                ? 'bg-navy text-gold ring-2 ring-gold/50 shadow-md scale-105'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                    >
                                        <span>📑 Master Merged Paper ({selectedQuestions.length} Qs)</span>
                                    </button>
                                    {examSubjects.map((sub, sIdx) => {
                                        const isTabActive = previewSectionFilter === sub;
                                        const subQs = selectedQuestionsBySubject[sub] || [];
                                        return (
                                            <button
                                                key={sub}
                                                type="button"
                                                onClick={() => setPreviewSectionFilter(sub)}
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow-xs ${
                                                    isTabActive
                                                        ? 'bg-navy text-gold ring-2 ring-gold/50 shadow-md scale-105'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                <span>Section {sIdx + 1}: {sub} ({subQs.length} Qs)</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Preview Toolbar */}
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
                                    <span>✓</span> {saving ? 'Saving...' : (examSubjects.length > 1 ? 'Merge & Finalize Exam Paper' : `Save ${paperCategory === 'assignment' ? 'Assignment' : 'Paper'}`)}
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
                                    <span>✓</span> {saving ? 'Finalizing...' : (examSubjects.length > 1 ? 'Merge & Finalize Exam Paper' : `Save ${paperCategory === 'assignment' ? 'Assignment' : 'Paper'}`)}
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

                {/* ── MODAL: ANSWER KEY ── */}
                {showAnswerKeyModal && (
                    <A4AnswerKey
                        paper={{ title, subject: examSubjects.join(', '), classes: [selectedClass, examType], _id: paperId }}
                        questions={selectedQuestions}
                        startQNo={startQNo}
                        onClose={() => setShowAnswerKeyModal(false)}
                        onQuestionsUpdated={(updatedQs) => {
                            setSelectedQuestions(updatedQs);
                        }}
                    />
                )}

                {/* ── MODAL: SOLUTIONS GUIDE ── */}
                {showSolutionsModal && (
                    <A4SolutionKey
                        paper={{ title, subject: examSubjects.join(', '), classes: [selectedClass, examType], _id: paperId }}
                        questions={selectedQuestions}
                        startQNo={startQNo}
                        onClose={() => setShowSolutionsModal(false)}
                        onQuestionsUpdated={(updatedQs) => {
                            setSelectedQuestions(updatedQs);
                        }}
                    />
                )}

                {/* ── MODAL: ANALYSIS ── */}
                {showAnalysisModal && (
                    <PaperAnalysisModal
                        paper={{ ...currentPaperObject, questions: selectedQuestions }}
                        onClose={() => setShowAnalysisModal(false)}
                    />
                )}

                {/* ── MODAL: EDIT QUESTION IN-PLACE ── */}
                {editingQuestionModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border-b-8 border-navy animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                        Question Editor
                                    </span>
                                    <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                        Edit Question Stem & Options
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setEditingQuestionModal(null)}
                                    className="text-slate-400 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase mb-1">Question Text</label>
                                    <textarea
                                        rows={3}
                                        value={editingQuestionModal.form.questionText}
                                        onChange={(e) => setEditingQuestionModal(prev => ({
                                            ...prev,
                                            form: { ...prev.form, questionText: e.target.value }
                                        }))}
                                        className="w-full border border-gray-300 rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-navy"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {['opt_a', 'opt_b', 'opt_c', 'opt_d'].map((optKey, idx) => {
                                        const label = ['A', 'B', 'C', 'D'][idx];
                                        return (
                                            <div key={optKey}>
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Option {label}</label>
                                                <input
                                                    type="text"
                                                    value={editingQuestionModal.form[optKey]}
                                                    onChange={(e) => setEditingQuestionModal(prev => ({
                                                        ...prev,
                                                        form: { ...prev.form, [optKey]: e.target.value }
                                                    }))}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-navy"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Correct Answer</label>
                                        <select
                                            value={editingQuestionModal.form.answer}
                                            onChange={(e) => setEditingQuestionModal(prev => ({
                                                ...prev,
                                                form: { ...prev.form, answer: e.target.value }
                                            }))}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                        >
                                            <option value="A">Option A</option>
                                            <option value="B">Option B</option>
                                            <option value="C">Option C</option>
                                            <option value="D">Option D</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Diagram Image URL</label>
                                        <input
                                            type="text"
                                            value={editingQuestionModal.form.imageUrl}
                                            onChange={(e) => setEditingQuestionModal(prev => ({
                                                ...prev,
                                                form: { ...prev.form, imageUrl: e.target.value }
                                            }))}
                                            placeholder="https://..."
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-navy uppercase mb-1">Solution / Explanation</label>
                                    <textarea
                                        rows={2}
                                        value={editingQuestionModal.form.solutionText}
                                        onChange={(e) => setEditingQuestionModal(prev => ({
                                            ...prev,
                                            form: { ...prev.form, solutionText: e.target.value }
                                        }))}
                                        className="w-full border border-gray-300 rounded-xl p-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                                <button
                                    onClick={() => setEditingQuestionModal(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveQuestionEdit}
                                    className="bg-navy text-gold px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-navy/90"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
