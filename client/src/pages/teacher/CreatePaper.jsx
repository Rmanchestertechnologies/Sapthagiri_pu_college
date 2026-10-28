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
import ChapterBlueprintMatrix from '../../components/ChapterBlueprintMatrix';
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

// Canonical subject normalizer (strictly maps variations of Maths/Phy/Chem/Bio to canonical names)
export const normalizeSubjectName = (sub) => {
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

// Helper to match question type filters strictly aligned with database question types
export const matchesQuestionType = (q, allowedType) => {
    if (!allowedType || allowedType === 'ALL') return true;
    const qType = (q.type || q.q_type || '').toUpperCase();
    const qText = q.questionText || q.question || q.text || '';

    if (allowedType === 'Single Correct MCQ' || allowedType === 'MCQ' || allowedType === 'mcq') {
        if (qType === 'DIAGRAM_BASED' || q.imageUrl || q.image_url || /\{\{IMG::|!\[|<img/i.test(qText)) return false;
        if (qType.includes('ASSERTION') || Boolean(q.assertion && q.reason) || (/Assertion/i.test(qText) && /Reason/i.test(qText))) return false;
        if (qType.includes('STATEMENT') || (/Statement\s*(?:I|1)\s*[:\-]/i.test(qText) && /Statement\s*(?:II|2)\s*[:\-]/i.test(qText))) return false;
        if (qType.includes('NUMERICAL') || (q.num_answer !== undefined && q.num_answer !== null && q.num_answer !== '')) return false;
        if (qType.includes('MATCH') || (q.column_a && q.column_a.length > 0)) return false;
        return qType === 'MCQ' || qType === 'MCQ_SINGLE' || (!q.type && (q.options?.length > 1));
    }

    if (allowedType === 'Assertion & Reason (A/R)' || allowedType === 'ASSERTION_REASON' || allowedType === 'ar') {
        return qType.includes('ASSERTION') || Boolean(q.assertion && q.reason) || (/Assertion\s*(?:\(A\))?/i.test(qText) && /Reason\s*(?:\(R\))?/i.test(qText));
    }

    if (allowedType === 'Statement Based' || allowedType === 'STATEMENT_BASED' || allowedType === 'stmt') {
        return qType.includes('STATEMENT') || (/Statement\s*(?:I|1)\s*[:\-]/i.test(qText) && /Statement\s*(?:II|2)\s*[:\-]/i.test(qText));
    }

    if (allowedType === 'Numerical / Integer Type' || allowedType === 'NUMERICAL' || allowedType === 'num') {
        if (qType.includes('ASSERTION') || Boolean(q.assertion && q.reason) || (/Assertion/i.test(qText) && /Reason/i.test(qText))) return false;
        if (qType.includes('STATEMENT') || (/Statement\s*(?:I|1)\s*[:\-]/i.test(qText) && /Statement\s*(?:II|2)\s*[:\-]/i.test(qText))) return false;
        if (qType.includes('MATCH') || (q.column_a && q.column_a.length > 0) || /(?:Column|List)\s*I[\s\S]*(?:Column|List)\s*II/i.test(qText)) return false;
        return qType.includes('NUMERICAL') || qType.includes('INTEGER') || (q.num_answer !== undefined && q.num_answer !== null && q.num_answer !== '') || (q.isNumerical === true) || (!q.options?.length && Boolean(q.correct_option) && !qType.includes('MCQ') && !qType.includes('ASSERTION'));
    }

    if (allowedType === 'Diagram Based' || allowedType === 'DIAGRAM_BASED' || allowedType === 'diag') {
        const hasDiag = Boolean(q.imageUrl || q.image_url || /\{\{IMG::|!\[|<img/i.test(qText));
        const opts = Array.isArray(q.options) ? q.options : [];
        const optHasImages = opts.some(opt => /\{\{IMG::|!\[|<img/i.test(String(typeof opt === 'object' ? (opt.text || '') : opt)));
        return qType === 'DIAGRAM_BASED' || hasDiag || optHasImages;
    }

    if (allowedType === 'Matrix Match' || allowedType === 'MATCH_FOLLOWING' || allowedType === 'match') {
        return qType.includes('MATCH') || qType.includes('MATRIX') || (q.column_a && q.column_a.length > 0) || /(?:Column|List)\s*I[\s\S]*(?:Column|List)\s*II/i.test(qText) || /Match (?:List|the following|Column)/i.test(qText);
    }

    return true;
};

export default function CreatePaper() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Query params
    const examId = searchParams.get('examId');
    const paperId = searchParams.get('paperId');
    const initialCategory = searchParams.get('category') === 'assignment' ? 'assignment' : 'test';
    const commissionedSubject = searchParams.get('subject');
    const commissionedExamType = searchParams.get('examType');
    const commissionedExamTitle = searchParams.get('examTitle');

    // Wizard Step: 1 (Configure) -> 2 (Method) -> 3 (Questions / Auto Engine) -> 4 (Preview) -> 5 (Alignment)
    const [currentStep, setCurrentStep] = useState((paperId || examId) ? 3 : 1);

    // Step 1: Mode & Academic Metadata
    const [paperCategory, setPaperCategory] = useState(initialCategory);
    const [subject, setSubject] = useState(commissionedSubject || user?.subject || 'Physics');
    const [selectedClass, setSelectedClass] = useState('Both');
    const [examType, setExamType] = useState(commissionedExamType || 'CET');
    const [title, setTitle] = useState(commissionedSubject && commissionedExamTitle ? `${commissionedSubject} - ${commissionedExamTitle}` : '');
    const [duration, setDuration] = useState('180 Minutes');
    const [targetCount, setTargetCount] = useState(60);

    // Question Type filter in Auto-Fetch
    const [selectedQuestionType, setSelectedQuestionType] = useState('ALL');
    // Section saving state
    const [savingSection, setSavingSection] = useState(false);
    // Active drafts available for multi-teacher collaboration
    const [availableDrafts, setAvailableDrafts] = useState([]);

    // Multi-Subject Exam Configuration (NEET: Physics, Chemistry, Botany, Zoology; JEE: Physics, Chemistry, Maths; CET: Physics, Chemistry, Maths, Biology)
    const examSubjects = useMemo(() => {
        if (paperCategory === 'assignment') return [normalizeSubjectName(subject || 'Physics')];
        const upperExam = (examType || '').toUpperCase();
        if (upperExam === 'NEET' || upperExam === 'NEET_PCB') {
            return ['Physics', 'Chemistry', 'Botany', 'Zoology'];
        }
        if (upperExam.includes('JEE') || upperExam === 'JEE' || upperExam === 'JEE_PCM') {
            return ['Physics', 'Chemistry', 'Mathematics'];
        }
        if (upperExam === 'CET' || upperExam === 'CET_PCMB') {
            return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
        }
        if (subject === 'PCM') return ['Physics', 'Chemistry', 'Mathematics'];
        if (subject === 'PCB') return ['Physics', 'Chemistry', 'Biology'];
        if (subject === 'PCMB') return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
        if (subject && subject.includes(',')) return subject.split(',').map(s => normalizeSubjectName(s.trim())).filter(Boolean);
        return [normalizeSubjectName(subject || 'Physics')];
    }, [examType, subject, paperCategory]);

    // Active Subject Tab for multi-subject workflow
    const [activeSubjectTab, setActiveSubjectTab] = useState(commissionedSubject || 'Physics');

    
    // Sync commissioned exam query params on load
    useEffect(() => {
        if (commissionedSubject) {
            setActiveSubjectTab(commissionedSubject);
            setSubject(commissionedSubject);
        }
        if (commissionedExamType) {
            setExamType(commissionedExamType);
        }
        if (commissionedSubject && commissionedExamTitle) {
            setTitle(`${commissionedSubject} - ${commissionedExamTitle}`);
        }
    }, [commissionedSubject, commissionedExamType, commissionedExamTitle]);

    // Make sure activeSubjectTab is always one of examSubjects
    useEffect(() => {
        if (!examSubjects.includes(activeSubjectTab)) {
            setActiveSubjectTab(examSubjects[0] || 'Physics');
        }
    }, [examSubjects, activeSubjectTab]);

    // Target per subject defaults
    const defaultQuotaForSubject = useMemo(() => {
        const upperExam = (examType || '').toUpperCase();
        if (upperExam.includes('NEET')) return 45;
        if (upperExam.includes('JEE')) return 25;
        if (upperExam.includes('CET')) return 60;
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

    // Chapter Quota Management
    const chapterQuotas = useMemo(() => {
        return currentSubjectSelection.quotas || {};
    }, [currentSubjectSelection]);

    const setChapterQuota = (ch, count) => {
        const val = Math.max(0, parseInt(count, 10) || 0);
        setSubjectSelections(prev => {
            const cur = prev[activeSubjectTab] || { chapters: [], concepts: [], quotas: {} };
            return {
                ...prev,
                [activeSubjectTab]: {
                    ...cur,
                    quotas: {
                        ...(cur.quotas || {}),
                        [ch]: val,
                    }
                }
            };
        });
    };

    const distributeChapterQuotasEvenly = () => {
        if (selectedChapters.length === 0) return;
        const target = defaultQuotaForSubject;
        const count = selectedChapters.length;
        const base = Math.floor(target / count);
        const remainder = target % count;

        const newQuotas = {};
        selectedChapters.forEach((ch, idx) => {
            newQuotas[ch] = base + (idx < remainder ? 1 : 0);
        });

        setSubjectSelections(prev => {
            const cur = prev[activeSubjectTab] || { chapters: [], concepts: [], quotas: {} };
            return {
                ...prev,
                [activeSubjectTab]: {
                    ...cur,
                    quotas: newQuotas,
                }
            };
        });
    };

    const totalAllocatedChapterQs = useMemo(() => {
        return selectedChapters.reduce((acc, ch) => acc + (chapterQuotas[ch] || 0), 0);
    }, [selectedChapters, chapterQuotas]);

    // Question Type Allocations per Subject
    const [subjectTypeAllocations, setSubjectTypeAllocations] = useState({});

    // Questions Pool & Selection (cached by subject)
    const [questionsPoolCache, setQuestionsPoolCache] = useState({});
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [autoFetchConfigOpen, setAutoFetchConfigOpen] = useState(false);

    const currentTypeAllocation = useMemo(() => {
        const isJEE = (examType || '').toUpperCase().includes('JEE');
        const isNEET = (examType || '').toUpperCase().includes('NEET');
        const isCET = (examType || '').toUpperCase().includes('CET');

        const defaultAlloc = isJEE
            ? { mcq: 18, stmt: 0, ar: 0, match: 0, diag: 2, num: 5 }
            : isNEET
            ? { mcq: 32, stmt: 4, ar: 4, match: 2, diag: 3, num: 0 }
            : isCET
            ? { mcq: 60, stmt: 0, ar: 0, match: 0, diag: 0, num: 0 }
            : { mcq: defaultQuotaForSubject, stmt: 0, ar: 0, match: 0, diag: 0, num: 0 };

        return subjectTypeAllocations[activeSubjectTab] || defaultAlloc;
    }, [subjectTypeAllocations, activeSubjectTab, examType, defaultQuotaForSubject]);

    const setTypeAllocationCount = (typeKey, val) => {
        const isJEE = (examType || '').toUpperCase().includes('JEE');
        let numVal = Math.max(0, parseInt(val, 10) || 0);

        setSubjectTypeAllocations(prev => {
            const cur = prev[activeSubjectTab] || { ...currentTypeAllocation };
            if (isJEE) {
                if (typeKey === 'num') {
                    numVal = 5; // Section B is strictly and always 5 numericals
                } else {
                    // Section A question types (mcq, stmt, ar, match, diag) sum must not exceed 20
                    const otherSecATotal = ['mcq', 'stmt', 'ar', 'match', 'diag']
                        .filter(k => k !== typeKey)
                        .reduce((sum, k) => sum + (cur[k] || 0), 0);
                    if (numVal + otherSecATotal > 20) {
                        numVal = Math.max(0, 20 - otherSecATotal);
                    }
                }
            }
            const updated = { ...cur, [typeKey]: numVal };
            if (isJEE) {
                updated.num = 5; // Enforce compulsory 5 numericals for JEE Section B
            }
            return {
                ...prev,
                [activeSubjectTab]: updated,
            };
        });
    };

    const totalAllocatedTypeQs = useMemo(() => {
        const alloc = currentTypeAllocation;
        return (alloc.mcq || 0) + (alloc.stmt || 0) + (alloc.ar || 0) + (alloc.match || 0) + (alloc.diag || 0) + (alloc.num || 0);
    }, [currentTypeAllocation]);

    const applyTypePreset = (presetName) => {
        const isJEE = (examType || '').toUpperCase().includes('JEE');
        const target = defaultQuotaForSubject;
        let nextAlloc = {};

        if (presetName === 'JEE' || (isJEE && presetName === 'STANDARD')) {
            nextAlloc = { mcq: 16, stmt: 1, ar: 1, match: 1, diag: 1, num: 5 };
        } else if (presetName === 'NEET' || presetName === 'STANDARD') {
            nextAlloc = { mcq: 32, stmt: 4, ar: 4, match: 2, diag: 3, num: 0 };
        } else if (presetName === 'ALL_MCQ') {
            if (isJEE) {
                nextAlloc = { mcq: 20, stmt: 0, ar: 0, match: 0, diag: 0, num: 5 };
            } else {
                nextAlloc = { mcq: target, stmt: 0, ar: 0, match: 0, diag: 0, num: 0 };
            }
        } else if (presetName === 'BALANCED') {
            if (isJEE) {
                nextAlloc = { mcq: 14, stmt: 2, ar: 2, match: 1, diag: 1, num: 5 };
            } else {
                const mcqCount = Math.max(0, target - 10);
                nextAlloc = { mcq: mcqCount, stmt: 2, ar: 3, match: 2, diag: 3, num: 0 };
            }
        }

        setSubjectTypeAllocations(prev => ({
            ...prev,
            [activeSubjectTab]: nextAlloc,
        }));
    };

    // Live counts of selected questions by type for active subject
    const activeSubjectSelectedQs = useMemo(() => {
        return selectedQuestions.filter(q => (q.sectionSubject || q.subject || '').toLowerCase() === activeSubjectTab.toLowerCase());
    }, [selectedQuestions, activeSubjectTab]);

    const typeBreakdownCurrent = useMemo(() => {
        let mcq = 0, stmt = 0, ar = 0, match = 0, diag = 0, num = 0;
        activeSubjectSelectedQs.forEach(q => {
            if (matchesQuestionType(q, 'Numerical / Integer Type') || q.isNumerical) num++;
            else if (matchesQuestionType(q, 'Assertion & Reason (A/R)')) ar++;
            else if (matchesQuestionType(q, 'Statement Based')) stmt++;
            else if (matchesQuestionType(q, 'Matrix Match')) match++;
            else if (matchesQuestionType(q, 'Diagram Based')) diag++;
            else mcq++;
        });
        return { mcq, stmt, ar, match, diag, num };
    }, [activeSubjectSelectedQs]);

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

    // Default Institutional Header & Part Directives
    const DEFAULT_HEADER_CONFIG = {
        collegeName: 'SAPTHAGIRI PU COLLEGE',
        subTitle: 'DAVANAGERE • THE LAND OF OPPORTUNITY',
        subject: '',
        subjectCode: '',
        streamClass: 'II PUC - SCIENCE',
        timeAllowed: '3 Hours 15 Minutes',
        maxMarks: '70',
        generalInstructions: [
            '1. All questions are compulsory.',
            '2. Each question carries marks as indicated.',
            '3. Read each question carefully before answering.',
            '4. Use of non-programmable scientific calculator and log tables is permitted.'
        ]
    };

    const DEFAULT_PART_DIRECTIVES = {
        'SECTION-A (MCQ)': 'Single Correct Multiple Choice Questions (+4 Marks for Correct, -1 for Incorrect).',
        'SECTION-A (DIAGRAM)': 'Diagram / Graph Based Multiple Choice Questions (+4 Marks for Correct, -1 for Incorrect).',
        'SECTION-B (ASSERTION & REASON)': 'Assertion and Reason Questions (+4 Marks for Correct, -1 for Incorrect).',
        'SECTION-B (STATEMENT)': 'Statement Based Questions (+4 Marks for Correct, -1 for Incorrect).',
        'SECTION-C (NUMERICAL)': 'Numerical / Integer Answer Questions (+4 Marks for Correct, 0 for Unattempted).',
        'SECTION-D (MATRIX MATCH)': 'Match the Following / Matrix Match Questions (+4 Marks for Correct, -1 for Incorrect).',
        'PART-A': 'Objective Multiple Choice Questions',
        'PART-B': 'Numerical / Assertion & Reason Questions',
    };

    const [headerConfig, setHeaderConfig] = useState(DEFAULT_HEADER_CONFIG);
    const [partDirectives, setPartDirectives] = useState(DEFAULT_PART_DIRECTIVES);
    const [showHeaderConfigModal, setShowHeaderConfigModal] = useState(false);

    // Swap Feedback State (Spinner, Flash animation, Toast & 5s Undo)
    const [swappingIndex, setSwappingIndex] = useState(null);
    const [justSwappedIndex, setJustSwappedIndex] = useState(null);
    const [swapToast, setSwapToast] = useState({ open: false, message: '', type: 'info', undoData: null });
    const undoTimeoutRef = useRef(null);

    // Blueprint Generator State
    const [generatingBlueprint, setGeneratingBlueprint] = useState(false);

    // LaTeX Editor State
    const [editorTab, setEditorTab] = useState('split'); // 'split' | 'edit' | 'preview'
    const [activeEditorField, setActiveEditorField] = useState('questionText');

    // Standard Step Wizard Navigation Handlers
    const handlePrevStep = () => {
        setCurrentStep(prev => Math.max(1, prev - 1));
    };

    const handleNextStep = () => {
        setCurrentStep(prev => Math.min(5, prev + 1));
    };

    // Toast notification helper with auto-dismiss
    const showToastNotification = (message, type = 'info', undoData = null) => {
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setSwapToast({ open: true, message, type, undoData });
        undoTimeoutRef.current = setTimeout(() => {
            setSwapToast(prev => ({ ...prev, open: false, undoData: null }));
        }, 5000);
    };

    // Quick LaTeX Math Symbol Inserter
    const insertSymbolToEditorField = (symbol) => {
        if (!editingQuestionModal) return;
        setEditingQuestionModal(prev => {
            const field = activeEditorField || 'questionText';
            const curVal = prev.form[field] || '';
            const addition = symbol.startsWith('\\') ? ` ${symbol} ` : symbol;
            return {
                ...prev,
                form: {
                    ...prev.form,
                    [field]: curVal + addition
                }
            };
        });
    };

    // LaTeX Syntax & Bracket Balance Validator
    const validateLaTeXInput = (text) => {
        if (!text) return null;
        let curly = 0, square = 0, round = 0, dollars = 0;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const prev = i > 0 ? text[i - 1] : '';
            if (ch === '$' && prev !== '\\') dollars++;
            else if (ch === '{' && prev !== '\\') curly++;
            else if (ch === '}' && prev !== '\\') curly--;
            else if (ch === '[' && prev !== '\\') square++;
            else if (ch === ']' && prev !== '\\') square--;
            else if (ch === '(' && prev !== '\\') round++;
            else if (ch === ')' && prev !== '\\') round--;
        }
        if (curly !== 0) return 'Unbalanced curly braces { } in LaTeX syntax';
        if (square !== 0) return 'Unbalanced square brackets [ ] in LaTeX syntax';
        if (round !== 0) return 'Unbalanced parentheses ( ) in LaTeX syntax';
        if (dollars % 2 !== 0) return 'Unclosed math delimiter $ in LaTeX syntax';
        return null;
    };

    // ── Persistent Draft Synchronization (localStorage) ──
    const DRAFT_STORAGE_KEY = 'sapthagiri_pu_wizard_draft_v3';

    // 1. Auto-restore draft on mount if not loading existing paperId
    useEffect(() => {
        if (paperId) return;
        try {
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (saved) {
                const draft = JSON.parse(saved);
                if (draft && typeof draft === 'object') {
                    if (draft.subject) setSubject(draft.subject);
                    if (draft.selectedClass) setSelectedClass(draft.selectedClass);
                    if (draft.examType) setExamType(draft.examType);
                    if (draft.title) setTitle(draft.title);
                    if (draft.duration) setDuration(draft.duration);
                    if (draft.paperCategory) setPaperCategory(draft.paperCategory);
                    if (draft.method) setMethod(draft.method);
                    if (draft.autoDist) setAutoDist(draft.autoDist);
                    if (draft.selectedChapters && Array.isArray(draft.selectedChapters)) setSelectedChapters(draft.selectedChapters);
                    if (draft.selectedConcepts && Array.isArray(draft.selectedConcepts)) setSelectedConcepts(draft.selectedConcepts);
                    if (draft.subjectSelections && typeof draft.subjectSelections === 'object') setSubjectSelections(draft.subjectSelections);
                    if (draft.selectedQuestions && Array.isArray(draft.selectedQuestions) && draft.selectedQuestions.length > 0) {
                        const isDraftJEE = Boolean(
                            String(draft.examType || draft.title || '').toUpperCase().includes('JEE') ||
                            (draft.selectedQuestions.length >= 70 && draft.selectedQuestions.length <= 85)
                        );
                        let qs = draft.selectedQuestions;
                        if (isDraftJEE) {
                            qs = qs.slice(0, 75);
                        }
                        setSelectedQuestions(qs);
                    }
                    if (draft.headerConfig) setHeaderConfig(draft.headerConfig);
                    if (draft.partDirectives) setPartDirectives(draft.partDirectives);
                    if (draft.currentStep && draft.currentStep >= 1 && draft.currentStep <= 5) {
                        setCurrentStep(draft.currentStep);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to restore draft from localStorage', e);
        }
    }, [paperId]);

    // 2. Auto-save draft on state updates
    useEffect(() => {
        if (paperId) return;
        try {
            const draftData = {
                currentStep,
                paperCategory,
                subject,
                selectedClass,
                examType,
                title,
                duration,
                targetCount,
                method,
                autoDist,
                selectedChapters,
                selectedConcepts,
                subjectSelections,
                selectedQuestions,
                headerConfig,
                partDirectives,
                timestamp: Date.now()
            };
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
        } catch (e) {
            console.warn('Failed to save draft to localStorage', e);
        }
    }, [
        paperId, currentStep, paperCategory, subject, selectedClass, examType,
        title, duration, targetCount, method, autoDist, selectedChapters,
        selectedConcepts, subjectSelections, selectedQuestions, headerConfig, partDirectives
    ]);

    // Selected questions grouped by subject
    const selectedQuestionsBySubject = useMemo(() => {
        const isJEE = (examType || '').toUpperCase().includes('JEE');
        const groups = {};
        examSubjects.forEach(sub => { groups[sub] = []; });
        selectedQuestions.forEach(q => {
            const rawSub = q.sectionSubject || q.subject || 'General';
            const normSub = normalizeSubjectName(rawSub);
            const matched = examSubjects.find(s => s.toLowerCase() === normSub.toLowerCase()) || 
                            examSubjects.find(s => normalizeSubjectName(s).toLowerCase() === normSub.toLowerCase()) || 
                            (isJEE ? 'Mathematics' : normSub);

            // For JEE Main, strictly discard questions that do not belong to Physics, Chemistry, or Mathematics
            if (isJEE && !['Physics', 'Chemistry', 'Mathematics'].includes(matched)) {
                return;
            }

            if (!groups[matched]) groups[matched] = [];
            groups[matched].push({
                ...q,
                subject: matched,
                sectionSubject: matched
            });
        });

        if (isJEE) {
            // In JEE Main: Enforce strictly max 20 Section A (non-numericals) + max 5 Section B (numericals) per subject: Physics, Chemistry, Mathematics
            ['Physics', 'Chemistry', 'Mathematics'].forEach(sub => {
                const list = groups[sub] || [];
                const isNum = (q) => {
                    const qType = (q.type || q.q_type || '').toUpperCase();
                    return Boolean(q.isNumerical) || matchesQuestionType(q, 'Numerical / Integer Type') || qType.includes('NUMERICAL') || qType.includes('INTEGER') || qType === 'NUM';
                };
                const secA = list.filter(q => !isNum(q))
                    .slice(0, 20)
                    .map(q => ({
                        ...q,
                        subject: sub,
                        sectionSubject: sub,
                        isNumerical: false,
                        part: 'SECTION A - MULTIPLE CHOICE QUESTIONS',
                        partDirective: 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.',
                    }));
                const secB = list.filter(q => isNum(q))
                    .slice(0, 5)
                    .map(q => ({
                        ...q,
                        subject: sub,
                        sectionSubject: sub,
                        isNumerical: true,
                        type: 'NUMERICAL',
                        options: [],
                        part: 'SECTION B - NUMERICAL VALUE QUESTIONS',
                        partDirective: 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.',
                    }));
                groups[sub] = [...secA, ...secB];
            });

            // Eradicate any non-PCM keys from groups
            Object.keys(groups).forEach(key => {
                if (!['Physics', 'Chemistry', 'Mathematics'].includes(key)) {
                    delete groups[key];
                }
            });
        }

        return groups;
    }, [selectedQuestions, examSubjects, examType]);

    // Auto-Sanitize selectedQuestions for JEE Main: Enforce hard ceiling of strictly max 20 Section A + max 5 Section B per subject (total <= 75)
    useEffect(() => {
        const isJEE = (examType || '').toUpperCase().includes('JEE');
        if (!isJEE || !Array.isArray(selectedQuestions) || selectedQuestions.length === 0) return;

        const pcm = {
            Physics: { secA: [], secB: [] },
            Chemistry: { secA: [], secB: [] },
            Mathematics: { secA: [], secB: [] }
        };
        let needsPrune = false;

        selectedQuestions.forEach(q => {
            const rawSub = q.sectionSubject || q.subject || 'General';
            const norm = normalizeSubjectName(rawSub);
            const targetSub = pcm[norm] ? norm : 'Mathematics';
            const qType = (q.type || q.q_type || '').toUpperCase();
            const isNum = Boolean(q.isNumerical) || matchesQuestionType(q, 'Numerical / Integer Type') || qType.includes('NUMERICAL') || qType.includes('INTEGER') || qType === 'NUM';

            if (isNum) {
                if (pcm[targetSub].secB.length < 5) {
                    pcm[targetSub].secB.push({
                        ...q,
                        subject: targetSub,
                        sectionSubject: targetSub,
                        isNumerical: true,
                        type: 'NUMERICAL',
                        options: [],
                        part: 'SECTION B - NUMERICAL VALUE QUESTIONS'
                    });
                } else {
                    needsPrune = true;
                }
            } else {
                if (pcm[targetSub].secA.length < 20) {
                    pcm[targetSub].secA.push({
                        ...q,
                        subject: targetSub,
                        sectionSubject: targetSub,
                        isNumerical: false,
                        part: 'SECTION A - MULTIPLE CHOICE QUESTIONS'
                    });
                } else {
                    needsPrune = true;
                }
            }
        });

        if (needsPrune || selectedQuestions.length > 75) {
            const pruned = [
                ...pcm.Physics.secA, ...pcm.Physics.secB,
                ...pcm.Chemistry.secA, ...pcm.Chemistry.secB,
                ...pcm.Mathematics.secA, ...pcm.Mathematics.secB
            ].slice(0, 75);
            setSelectedQuestions(pruned);
        }
    }, [selectedQuestions, examType]);

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

    // Load Active Drafts for Multi-Teacher Collaboration
    useEffect(() => {
        const fetchDrafts = async () => {
            try {
                const res = await api.get('/api/papers');
                const drafts = (res.data || []).filter(p => {
                    const st = (p.status || '').toUpperCase();
                    return st === 'DRAFT' || st === 'IN_PROGRESS' || st === 'IN PROGRESS';
                });
                setAvailableDrafts(drafts);
            } catch (e) {
                // Ignore background error
            }
        };
        fetchDrafts();
    }, []);

    // Load Existing Paper if paperId is present (for Editing)
    useEffect(() => {
        const fetchPaperDetails = async () => {
            if (!paperId) return;
            try {
                const res = await api.get(`/api/papers/${paperId}`);
                const p = res.data;
                if (p) {
                    if (p.title) setTitle(p.title);
                    if (p.exam_type || p.examType) {
                        const et = p.exam_type || p.examType;
                        setExamType(et);
                    }
                    if (p.subject) setSubject(p.subject);
                    if (p.isAssignment !== undefined) setPaperCategory(p.isAssignment ? 'assignment' : 'test');
                    if (p.classes && p.classes.length > 0) setSelectedClass(p.classes[0]);
                    if (p.duration) setDuration(p.duration);
                    if (p.startQNo) setStartQNo(p.startQNo);
                    if (p.endQNo) setEndQNo(p.endQNo);
                    if (p.difficultyDistribution) setAutoDist(p.difficultyDistribution);
                    if (Array.isArray(p.questions) && p.questions.length > 0) {
                        const isEditJEE = Boolean(
                            String(p.exam_type || p.examType || p.title || '').toUpperCase().includes('JEE') ||
                            (Array.isArray(p.classes) && p.classes.some(c => String(c).toUpperCase().includes('JEE'))) ||
                            (p.questions.length >= 70 && p.questions.length <= 85)
                        );
                        let qs = p.questions;
                        if (isEditJEE) {
                            qs = qs.slice(0, 75);
                        }
                        setSelectedQuestions(qs);
                        setTargetCount(qs.length);
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
    const fetchQuestionsPoolForSubject = async (subToFetch, forceClass = selectedClass, forceSources = selectedSources, forceChapters = null) => {
        if (!subToFetch) return [];
        const cleanClass = forceClass === 'Both' ? '' : forceClass;
        const currentChs = forceChapters !== null ? forceChapters : (subjectSelections[subToFetch]?.chapters || []);

        setLoadingQuestions(true);
        try {
            let url = `/api/questions?subject=${encodeURIComponent(subToFetch)}`;
            if (currentChs && currentChs.length > 0) {
                url += `&chapter=${encodeURIComponent(currentChs.join(','))}&limit=10000`;
            } else {
                url += `&limit=3000`;
            }
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
                sectionSubject: normalizeSubjectName(subToFetch),
                subject: normalizeSubjectName(q.subject || subToFetch),
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

    // Fetch questions whenever activeSubjectTab, class, or selectedChapters changes
    useEffect(() => {
        if (activeSubjectTab) {
            fetchQuestionsPoolForSubject(activeSubjectTab, selectedClass, selectedSources, selectedChapters);
        }
    }, [activeSubjectTab, selectedClass, selectedSources, selectedChapters]);

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
                setSubjectSelections(sPrev => {
                    const cur = sPrev[activeSubjectTab] || {};
                    const qCopy = { ...(cur.quotas || {}) };
                    delete qCopy[ch];
                    return { ...sPrev, [activeSubjectTab]: { ...cur, quotas: qCopy } };
                });
                return prev.filter(item => item !== ch);
            } else {
                setSubjectSelections(sPrev => {
                    const cur = sPrev[activeSubjectTab] || {};
                    return {
                        ...sPrev,
                        [activeSubjectTab]: {
                            ...cur,
                            quotas: { ...(cur.quotas || {}), [ch]: cur.quotas?.[ch] || 1 }
                        }
                    };
                });
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
                                       (rawCh && selectedChapters.some(sc => sc.toLowerCase() === rawCh.toLowerCase())) ||
                                       rawCh.toLowerCase() === 'general';
                if (!matchesChapter) return false;
            }

            // Concept check - only filter if concepts were selected for THIS question's chapter
            if (selectedConcepts.length > 0) {
                const chConcepts = chapterConceptsMap[canonCh] || chapterConceptsMap[rawCh] || [];
                const selectedInThisChapter = chConcepts.filter(c => allSelectedConcepts.has(c));

                if (selectedInThisChapter.length > 0) {
                    const qConcept = q.concept || q.topic;
                    if (qConcept && qConcept !== 'General') {
                        const matchesConcept = allSelectedConcepts.has(qConcept) ||
                            selectedInThisChapter.some(sc => sc.toLowerCase() === qConcept.toLowerCase());
                        const allChConceptsChecked = chConcepts.length > 0 && selectedInThisChapter.length === chConcepts.length;
                        if (!matchesConcept && !allChConceptsChecked) {
                            return false;
                        }
                    }
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
                canonicalizeChapterName(q.chapter) === canonicalizeChapterName(singleFilterChapter) ||
                (q.chapter || '').toLowerCase().includes(singleFilterChapter.toLowerCase()) ||
                singleFilterChapter.toLowerCase().includes((q.chapter || '').toLowerCase());

            const matchesSingleConcept = !singleFilterConcept || (q.concept === singleFilterConcept || q.topic === singleFilterConcept);
            const matchesDifficulty = !filterDifficulty || (q.level || 'medium').toLowerCase() === filterDifficulty.toLowerCase();
            const matchesType = !filterType || matchesQuestionType(q, filterType);

            return matchesSearch && matchesSingleChapter && matchesSingleConcept && matchesDifficulty && matchesType;
        });
    }, [scopedQuestionPool, searchTerm, singleFilterChapter, singleFilterConcept, filterDifficulty, filterType]);

    // Paginated subset for browser DOM rendering
    const paginatedQuestions = useMemo(() => {
        if (pageSize === 'All') return filteredQuestions;
        const size = parseInt(pageSize, 10) || 100;
        return filteredQuestions.slice(0, pageNumber * size);
    }, [filteredQuestions, pageNumber, pageSize]);

    // (matchesQuestionType is declared at module level)


    // ── 3. AUTO FETCH GENERATOR ALGORITHM WITH CONCEPT DE-DUPLICATION ──
    const generateBalancedSetForSubject = (
        subName,
        pool,
        targetQuota,
        dist,
        chaptersSelected,
        conceptsSelected,
        qTypeFilter = selectedQuestionType,
        typeAlloc = null,
        chQuotas = null
    ) => {
        if (!pool || pool.length === 0 || targetQuota <= 0) return [];
        const isJEE = (examType || '').toUpperCase().includes('JEE');

        const selectedNormKeys = new Set((chaptersSelected || []).map(normalizeChapterKey));
        const allSelectedConcepts = new Set(conceptsSelected || []);
        const normSub = normalizeSubjectName(subName).toLowerCase();
        const alreadyAddedIds = new Set(
            selectedQuestions
                .filter(q => normalizeSubjectName(q.sectionSubject || q.subject || '').toLowerCase() !== normSub)
                .map(q => String(q._id || q.id))
        );

        // If isJEE or typeAlloc is supplied, sample by question types and section structure!
        const effectiveTypeAlloc = typeAlloc || (isJEE ? { mcq: 18, stmt: 0, ar: 0, match: 0, diag: 2, num: 5 } : null);

        if (isJEE || (effectiveTypeAlloc && (effectiveTypeAlloc.mcq || effectiveTypeAlloc.stmt || effectiveTypeAlloc.ar || effectiveTypeAlloc.match || effectiveTypeAlloc.diag || effectiveTypeAlloc.num))) {
            const pickedByType = [];
            const pickedTypeIds = new Set(alreadyAddedIds);

            const sampleFromPool = (typeFilterName, count, isPartB = false) => {
                if (count <= 0) return;
                let chapterMatches = pool.filter(q => {
                    const id = String(q._id || q.id);
                    if (pickedTypeIds.has(id)) return false;
                    const rawCh = q.chapter || 'General';
                    const matchesCh = selectedNormKeys.size === 0 || selectedNormKeys.has(normalizeChapterKey(rawCh)) || rawCh.toLowerCase() === 'general';
                    return matchesCh && matchesQuestionType(q, typeFilterName);
                });

                let fullMatches = chapterMatches;
                if (chapterMatches.length < count) {
                    const more = pool.filter(q => {
                        const id = String(q._id || q.id);
                        return !pickedTypeIds.has(id) && matchesQuestionType(q, typeFilterName);
                    });
                    const diff = more.filter(q => !chapterMatches.includes(q));
                    fullMatches = [...chapterMatches, ...diff];
                }

                fullMatches.sort(() => Math.random() - 0.5);

                let added = 0;
                for (const q of fullMatches) {
                    if (added >= count) break;
                    const id = String(q._id || q.id);
                    pickedTypeIds.add(id);
                    pickedByType.push({
                        ...q,
                        sectionSubject: subName,
                        subject: q.subject || subName,
                        part: isJEE ? (isPartB ? 'SECTION B - NUMERICAL VALUE QUESTIONS' : 'SECTION A - MULTIPLE CHOICE QUESTIONS') : '',
                        partDirective: isJEE ? (isPartB ? 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.' : 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.') : '',
                        isNumerical: isPartB,
                        type: isPartB ? 'NUMERICAL' : (q.type || 'MCQ'),
                        options: isPartB ? [] : (q.options || []),
                    });
                    added++;
                }
            };

            if (isJEE) {
                // ══════════════════════════════════════════════════════════════
                // JEE MAIN STRICT QUOTA:
                // Section A: EXACTLY 20 Questions (MCQ, Diag, AR, Stmt, Match)
                // Section B: EXACTLY 5 Questions (Pure Numericals only)
                // Total Subject: STRICTLY 25 Questions. PCM Total: STRICTLY 75 Questions.
                // ══════════════════════════════════════════════════════════════
                const secAQuestions = [];
                const secBQuestions = [];
                const pickedSecAIds = new Set();
                const pickedSecBIds = new Set();

                // Helper to strictly identify true numerical questions (MUST NEVER BE ASSERTION/REASON OR STATEMENT)
                const isTrueNumerical = (q) => {
                    const qType = (q.type || q.q_type || '').toUpperCase();
                    const qText = q.questionText || q.question || q.text || '';
                    if (qType.includes('ASSERTION') || Boolean(q.assertion && q.reason) || (/Assertion/i.test(qText) && /Reason/i.test(qText))) return false;
                    if (qType.includes('STATEMENT') || (/Statement\s*(?:I|1)\s*[:\-]/i.test(qText) && /Statement\s*(?:II|2)\s*[:\-]/i.test(qText))) return false;
                    if (qType.includes('MATCH') || (q.column_a && q.column_a.length > 0) || /(?:Column|List)\s*I[\s\S]*(?:Column|List)\s*II/i.test(qText)) return false;
                    return matchesQuestionType(q, 'Numerical / Integer Type') || q.isNumerical === true || qType.includes('NUMERICAL') || qType.includes('INTEGER') || (q.num_answer !== undefined && q.num_answer !== null && q.num_answer !== '');
                };

                // Helper to check if a question is valid for Section A (MUST NEVER BE NUMERICAL)
                const isValidSecA = (q) => {
                    const qType = (q.type || q.q_type || '').toUpperCase();
                    if (isTrueNumerical(q) || q.isNumerical === true || qType.includes('NUMERICAL') || qType.includes('INTEGER')) return false;
                    return true;
                };

                // ─────────────────────────────────────────────────────────────
                // 1. Pick exactly 20 Section A questions (MCQs, Diag, AR, Stmt, Match)
                // ─────────────────────────────────────────────────────────────
                let reqStmt = effectiveTypeAlloc?.stmt != null ? Number(effectiveTypeAlloc.stmt) : 0;
                let reqAR = effectiveTypeAlloc?.ar != null ? Number(effectiveTypeAlloc.ar) : 0;
                let reqMatch = effectiveTypeAlloc?.match != null ? Number(effectiveTypeAlloc.match) : 0;
                let reqDiag = effectiveTypeAlloc?.diag != null ? Number(effectiveTypeAlloc.diag) : 2;
                let reqMCQ = effectiveTypeAlloc?.mcq != null ? Number(effectiveTypeAlloc.mcq) : 18;

                // Normalize Section A non-MCQ requests if they exceed 20
                const otherTotal = reqStmt + reqAR + reqMatch + reqDiag;
                if (otherTotal > 20) {
                    const factor = 20 / otherTotal;
                    reqStmt = Math.floor(reqStmt * factor);
                    reqAR = Math.floor(reqAR * factor);
                    reqMatch = Math.floor(reqMatch * factor);
                    reqDiag = Math.floor(reqDiag * factor);
                }
                reqMCQ = Math.max(0, 20 - (reqStmt + reqAR + reqMatch + reqDiag));

                const sampleSecA = (typeFilterName, count) => {
                    if (count <= 0) return 0;
                    let chapterMatches = pool.filter(q => {
                        const id = String(q._id || q.id);
                        if (alreadyAddedIds.has(id) || pickedSecAIds.has(id)) return false;
                        if (!isValidSecA(q)) return false;
                        const rawCh = q.chapter || 'General';
                        const matchesCh = selectedNormKeys.size === 0 || selectedNormKeys.has(normalizeChapterKey(rawCh)) || rawCh.toLowerCase() === 'general';
                        return matchesCh && matchesQuestionType(q, typeFilterName);
                    });

                    let fullMatches = chapterMatches;
                    if (chapterMatches.length < count) {
                        const more = pool.filter(q => {
                            const id = String(q._id || q.id);
                            if (alreadyAddedIds.has(id) || pickedSecAIds.has(id)) return false;
                            if (!isValidSecA(q)) return false;
                            return matchesQuestionType(q, typeFilterName);
                        });
                        const diff = more.filter(q => !chapterMatches.includes(q));
                        fullMatches = [...chapterMatches, ...diff];
                    }

                    fullMatches.sort(() => Math.random() - 0.5);

                    let added = 0;
                    for (const q of fullMatches) {
                        if (secAQuestions.length >= 20 || added >= count) break;
                        const id = String(q._id || q.id);
                        pickedSecAIds.add(id);
                        secAQuestions.push({
                            ...q,
                            sectionSubject: subName,
                            subject: q.subject || subName,
                            part: 'SECTION A - MULTIPLE CHOICE QUESTIONS',
                            partDirective: 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.',
                            isNumerical: false,
                            type: q.type || 'MCQ',
                        });
                        added++;
                    }
                    return added;
                };

                // Sample in order, capturing any deficit and rolling it into MCQ!
                let deficit = 0;
                if (reqStmt > 0) { const got = sampleSecA('Statement Based', reqStmt); deficit += (reqStmt - got); }
                if (reqAR > 0) { const got = sampleSecA('Assertion & Reason (A/R)', reqAR); deficit += (reqAR - got); }
                if (reqMatch > 0) { const got = sampleSecA('Matrix Match', reqMatch); deficit += (reqMatch - got); }
                if (reqDiag > 0) { const got = sampleSecA('Diagram Based', reqDiag); deficit += (reqDiag - got); }

                // MCQ fills its own quota PLUS any deficit from above!
                sampleSecA('Single Correct MCQ', reqMCQ + deficit);

                // Backfill Section A up to 20 with Single Correct MCQs if short
                if (secAQuestions.length < 20) {
                    sampleSecA('Single Correct MCQ', 20 - secAQuestions.length);
                }

                // If still short of 20, backfill with ANY valid non-numerical questions in pool
                if (secAQuestions.length < 20) {
                    const fallbackSecACandidates = pool.filter(q => {
                        const id = String(q._id || q.id);
                        return !alreadyAddedIds.has(id) && !pickedSecAIds.has(id) && isValidSecA(q);
                    });
                    fallbackSecACandidates.sort(() => Math.random() - 0.5);
                    for (const q of fallbackSecACandidates) {
                        if (secAQuestions.length >= 20) break;
                        const id = String(q._id || q.id);
                        pickedSecAIds.add(id);
                        secAQuestions.push({
                            ...q,
                            sectionSubject: subName,
                            subject: q.subject || subName,
                            part: 'SECTION A - MULTIPLE CHOICE QUESTIONS',
                            partDirective: 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.',
                            isNumerical: false,
                            type: q.type || 'MCQ',
                        });
                    }
                }

                // If pool itself had fewer than 20 non-numerical questions, clone from secAQuestions to strictly reach 20
                let secAClone = 0;
                while (secAQuestions.length < 20 && secAQuestions.length > 0) {
                    const base = secAQuestions[secAClone % secAQuestions.length];
                    secAClone++;
                    secAQuestions.push({
                        ...base,
                        _id: `${base._id || base.id}_cl_${secAClone}`,
                        id: `${base._id || base.id}_cl_${secAClone}`,
                    });
                }

                // ─────────────────────────────────────────────────────────────
                // 2. Pick exactly 5 Section B questions (Pure Numerical Value Questions)
                // ─────────────────────────────────────────────────────────────
                let numCandidates = pool.filter(q => {
                    const id = String(q._id || q.id);
                    if (alreadyAddedIds.has(id) || pickedSecAIds.has(id)) return false;
                    const rawCh = q.chapter || 'General';
                    const matchesCh = selectedNormKeys.size === 0 || selectedNormKeys.has(normalizeChapterKey(rawCh)) || rawCh.toLowerCase() === 'general';
                    return matchesCh && isTrueNumerical(q);
                });

                if (numCandidates.length < 5) {
                    const moreNums = pool.filter(q => {
                        const id = String(q._id || q.id);
                        if (alreadyAddedIds.has(id) || pickedSecAIds.has(id)) return false;
                        return isTrueNumerical(q);
                    });
                    const diff = moreNums.filter(q => !numCandidates.includes(q));
                    numCandidates = [...numCandidates, ...diff];
                }

                numCandidates.sort(() => Math.random() - 0.5);

                for (const q of numCandidates) {
                    if (secBQuestions.length >= 5) break;
                    const id = String(q._id || q.id);
                    pickedSecBIds.add(id);
                    secBQuestions.push({
                        ...q,
                        sectionSubject: subName,
                        subject: q.subject || subName,
                        part: 'SECTION B - NUMERICAL VALUE QUESTIONS',
                        partDirective: 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.',
                        isNumerical: true,
                        type: 'NUMERICAL',
                        options: [],
                    });
                }

                // If secBQuestions is short of 5, DO NOT pick Assertion & Reason or Statement questions!
                // Instead, clone existing true numerical questions with unique IDs
                let numClone = 0;
                while (secBQuestions.length < 5 && secBQuestions.length > 0) {
                    const base = secBQuestions[numClone % secBQuestions.length];
                    numClone++;
                    secBQuestions.push({
                        ...base,
                        _id: `${base._id || base.id}_num_${numClone}`,
                        id: `${base._id || base.id}_num_${numClone}`,
                        part: 'SECTION B - NUMERICAL VALUE QUESTIONS',
                        partDirective: 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.',
                        isNumerical: true,
                        type: 'NUMERICAL',
                        options: [],
                    });
                }

                // If truly 0 numericals were in pool (fallback only to plain calculation single-choice questions, NEVER AR/Stmt/Match)
                if (secBQuestions.length < 5) {
                    const safeCalcCandidates = pool.filter(q => {
                        const id = String(q._id || q.id);
                        if (alreadyAddedIds.has(id) || pickedSecAIds.has(id) || pickedSecBIds.has(id)) return false;
                        const qType = (q.type || q.q_type || '').toUpperCase();
                        const qText = q.questionText || q.question || q.text || '';
                        if (/assertion/i.test(qText) || /reason/i.test(qText) || qType.includes('ASSERTION')) return false;
                        if (/statement/i.test(qText) || qType.includes('STATEMENT')) return false;
                        if (/match/i.test(qText) || qType.includes('MATCH')) return false;
                        return true;
                    });
                    safeCalcCandidates.sort(() => Math.random() - 0.5);
                    for (const q of safeCalcCandidates) {
                        if (secBQuestions.length >= 5) break;
                        const id = String(q._id || q.id);
                        pickedSecBIds.add(id);
                        secBQuestions.push({
                            ...q,
                            sectionSubject: subName,
                            subject: q.subject || subName,
                            part: 'SECTION B - NUMERICAL VALUE QUESTIONS',
                            partDirective: 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.',
                            isNumerical: true,
                            type: 'NUMERICAL',
                            options: [],
                        });
                    }
                }

                const finalSecA = secAQuestions.slice(0, 20);
                const finalSecB = secBQuestions.slice(0, 5);

                return [...finalSecA, ...finalSecB];
            } else {
                // Non-JEE: Sample according to typeAlloc without section headers!
                if (effectiveTypeAlloc.diag > 0) sampleFromPool('Diagram Based', effectiveTypeAlloc.diag, false);
                if (effectiveTypeAlloc.ar > 0) sampleFromPool('Assertion & Reason (A/R)', effectiveTypeAlloc.ar, false);
                if (effectiveTypeAlloc.stmt > 0) sampleFromPool('Statement Based', effectiveTypeAlloc.stmt, false);
                if (effectiveTypeAlloc.match > 0) sampleFromPool('Matrix Match', effectiveTypeAlloc.match, false);
                if (effectiveTypeAlloc.num > 0) sampleFromPool('Numerical / Integer Type', effectiveTypeAlloc.num, true);
                if (effectiveTypeAlloc.mcq > 0) sampleFromPool('Single Correct MCQ', effectiveTypeAlloc.mcq, false);

                if (pickedByType.length < targetQuota) {
                    sampleFromPool('Single Correct MCQ', targetQuota - pickedByType.length, false);
                }

                return pickedByType.slice(0, targetQuota).map(q => ({
                    ...q,
                    part: '',
                    partDirective: '',
                }));
            }
        }

        // 1. Exclude questions already added to any section in the active paper (sets initialized above)

        // 2. Filter pool by chosen chapters/concepts and question types, excluding already present IDs
        let candidates = pool.filter(q => {
            const qId = String(q._id || q.id);
            if (alreadyAddedIds.has(qId)) return false;

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

            if (!matchesQuestionType(q, qTypeFilter)) return false;

            return true;
        });

        // Fallback: if candidates became empty due to alreadyAddedIds, allow pool questions matching type filter
        if (candidates.length === 0) {
            candidates = pool.filter(q => matchesQuestionType(q, qTypeFilter));
        }
        if (candidates.length === 0) {
            candidates = [...pool];
        }

        // 3. Concept De-duplication & Round-Robin Partitioning:
        // Group questions by unique concept / subtopic identifier
        const conceptGroups = {};
        candidates.forEach(q => {
            const cKey = q.concept_id || q.subtopic_code || q.concept || q.topic || q.chapter || 'General';
            if (!conceptGroups[cKey]) conceptGroups[cKey] = [];
            conceptGroups[cKey].push(q);
        });

        // Shuffle questions within each concept group
        Object.keys(conceptGroups).forEach(k => {
            conceptGroups[k] = [...conceptGroups[k]].sort(() => Math.random() - 0.5);
        });

        // Interleave / Round-Robin: take 1 question from each unique concept before taking a second question
        const roundRobinStream = [];
        const uniqueKeys = Object.keys(conceptGroups).sort(() => Math.random() - 0.5);
        const maxLen = Math.max(...uniqueKeys.map(k => conceptGroups[k].length));

        for (let round = 0; round < maxLen; round++) {
            for (const k of uniqueKeys) {
                if (round < conceptGroups[k].length) {
                    roundRobinStream.push(conceptGroups[k][round]);
                }
            }
        }

        // 4. Calculate distribution quotas (Easy / Medium / Hard)
        const easyPct = Number(dist?.easy || 40);
        const medPct = Number(dist?.medium || 40);
        const hardPct = Number(dist?.hard || 20);
        const totalPct = easyPct + medPct + hardPct || 100;

        const targetEasy = Math.round(targetQuota * (easyPct / totalPct));
        const targetMed = Math.round(targetQuota * (medPct / totalPct));
        const targetHard = Math.max(0, targetQuota - targetEasy - targetMed);

        // Group into buckets adhering to the round-robin concept spread
        const easyBucket = [];
        const medBucket = [];
        const hardBucket = [];

        roundRobinStream.forEach(q => {
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
                const id = String(q._id || q.id);
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

        // Backfill from round-robin stream if buckets fell short
        if (picked.length < targetQuota) {
            for (const q of roundRobinStream) {
                const id = String(q._id || q.id);
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
            const isJEE = (examType || '').toUpperCase().includes('JEE');
            let pool = questionsPoolCache[activeSubjectTab];
            if (!pool || pool.length === 0) {
                pool = await fetchQuestionsPoolForSubject(activeSubjectTab);
            }

            // Pool enrichment for JEE: ensure at least 5 numericals and 25 questions exist
            if (isJEE) {
                const existingNumCount = pool.filter(q => {
                    const qType = (q.type || q.q_type || '').toUpperCase();
                    const qText = q.questionText || q.question || q.text || '';
                    if (/assertion/i.test(qText) || /reason/i.test(qText) || qType.includes('ASSERTION')) return false;
                    if (/statement/i.test(qText) || qType.includes('STATEMENT')) return false;
                    return matchesQuestionType(q, 'Numerical / Integer Type') || q.isNumerical || qType.includes('NUMERICAL');
                }).length;

                if (existingNumCount < 5) {
                    try {
                        const numRes = await api.get(`/api/questions?subject=${encodeURIComponent(activeSubjectTab)}&type=numerical&limit=100`);
                        const extraNums = Array.isArray(numRes.data) ? numRes.data : (numRes.data?.questions || []);
                        const cleanNums = extraNums.map(q => ({
                            ...q,
                            sectionSubject: activeSubjectTab,
                            subject: q.subject || activeSubjectTab,
                            isNumerical: true,
                            type: 'NUMERICAL',
                            options: [],
                        }));
                        const poolIds = new Set(pool.map(q => String(q._id || q.id)));
                        for (const q of cleanNums) {
                            if (!poolIds.has(String(q._id || q.id))) {
                                pool.push(q);
                                poolIds.add(String(q._id || q.id));
                            }
                        }
                    } catch (e) {
                        console.warn('Could not fetch extra numericals for', activeSubjectTab, e);
                    }
                }

                if (pool.length < 25) {
                    try {
                        const broadRes = await api.get(`/api/questions?subject=${encodeURIComponent(activeSubjectTab)}&limit=3000`);
                        const extraBroad = Array.isArray(broadRes.data) ? broadRes.data : (broadRes.data?.questions || []);
                        const cleanBroad = extraBroad.map(q => ({
                            ...q,
                            sectionSubject: activeSubjectTab,
                            subject: q.subject || activeSubjectTab,
                        }));
                        const poolIds = new Set(pool.map(q => String(q._id || q.id)));
                        for (const q of cleanBroad) {
                            if (!poolIds.has(String(q._id || q.id))) {
                                pool.push(q);
                                poolIds.add(String(q._id || q.id));
                            }
                        }
                    } catch (e) {
                        console.warn('Could not fetch broad questions for', activeSubjectTab, e);
                    }
                }
                setQuestionsPoolCache(prev => ({ ...prev, [activeSubjectTab]: pool }));
            }

            const quota = autoQtyPerSubject || defaultQuotaForSubject;
            const newQs = generateBalancedSetForSubject(
                activeSubjectTab,
                pool,
                quota,
                autoDist,
                selectedChapters,
                selectedConcepts,
                selectedQuestionType,
                currentTypeAllocation,
                chapterQuotas
            );

            if (newQs.length === 0) {
                alert(`No questions found matching criteria for ${activeSubjectTab}. Please check connection or type selection.`);
                return;
            }

            const finalNewQs = isJEE ? newQs.slice(0, 25) : newQs;

            // Replace questions for this subject in the global basket
            setSelectedQuestions(prev => {
                const normActive = normalizeSubjectName(activeSubjectTab).toLowerCase();
                const others = prev.filter(q => {
                    const qNorm = normalizeSubjectName(q.sectionSubject || q.subject || '').toLowerCase();
                    return qNorm !== normActive;
                });
                const combined = [...others, ...finalNewQs];
                if (isJEE) {
                    return combined.slice(0, 75);
                }
                return combined;
            });
            setCurrentStep(4);

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
            const isJEE = (examType || '').toUpperCase().includes('JEE');
            const allPicked = [];
            for (const sub of examSubjects) {
                let pool = questionsPoolCache[sub];
                if (!pool || pool.length === 0) {
                    pool = await fetchQuestionsPoolForSubject(sub);
                }

                // Pool enrichment for JEE: ensure at least 5 numericals and 25 questions exist
                if (isJEE) {
                    const existingNumCount = pool.filter(q => {
                        const qType = (q.type || q.q_type || '').toUpperCase();
                        const qText = q.questionText || q.question || q.text || '';
                        if (/assertion/i.test(qText) || /reason/i.test(qText) || qType.includes('ASSERTION')) return false;
                        if (/statement/i.test(qText) || qType.includes('STATEMENT')) return false;
                        return matchesQuestionType(q, 'Numerical / Integer Type') || q.isNumerical || qType.includes('NUMERICAL');
                    }).length;

                    if (existingNumCount < 5) {
                        try {
                            const numRes = await api.get(`/api/questions?subject=${encodeURIComponent(sub)}&type=numerical&limit=100`);
                            const extraNums = Array.isArray(numRes.data) ? numRes.data : (numRes.data?.questions || []);
                            const cleanNums = extraNums.map(q => ({
                                ...q,
                                sectionSubject: normalizeSubjectName(sub),
                                subject: normalizeSubjectName(q.subject || sub),
                                isNumerical: true,
                                type: 'NUMERICAL',
                                options: [],
                            }));
                            const poolIds = new Set(pool.map(q => String(q._id || q.id)));
                            for (const q of cleanNums) {
                                if (!poolIds.has(String(q._id || q.id))) {
                                    pool.push(q);
                                    poolIds.add(String(q._id || q.id));
                                }
                            }
                        } catch (e) {
                            console.warn('Could not fetch extra numericals for', sub, e);
                        }
                    }

                    if (pool.length < 25) {
                        try {
                            const broadRes = await api.get(`/api/questions?subject=${encodeURIComponent(sub)}&limit=3000`);
                            const extraBroad = Array.isArray(broadRes.data) ? broadRes.data : (broadRes.data?.questions || []);
                            const cleanBroad = extraBroad.map(q => ({
                                ...q,
                                sectionSubject: normalizeSubjectName(sub),
                                subject: normalizeSubjectName(q.subject || sub),
                            }));
                            const poolIds = new Set(pool.map(q => String(q._id || q.id)));
                            for (const q of cleanBroad) {
                                if (!poolIds.has(String(q._id || q.id))) {
                                    pool.push(q);
                                    poolIds.add(String(q._id || q.id));
                                }
                            }
                        } catch (e) {
                            console.warn('Could not fetch broad questions for', sub, e);
                        }
                    }
                    setQuestionsPoolCache(prev => ({ ...prev, [sub]: pool }));
                }

                const subSel = subjectSelections[sub] || { chapters: [], concepts: [] };
                const quota = defaultQuotaForSubject;
                const pickedForSub = generateBalancedSetForSubject(
                    sub,
                    pool,
                    quota,
                    autoDist,
                    subSel.chapters,
                    subSel.concepts,
                    selectedQuestionType,
                    subjectTypeAllocations[sub] || currentTypeAllocation,
                    subSel.quotas || {}
                );
                const finalSub = isJEE ? pickedForSub.slice(0, 25) : pickedForSub;
                allPicked.push(...finalSub);
            }

            const cappedPicked = isJEE ? allPicked.slice(0, 75) : allPicked;
            setSelectedQuestions(cappedPicked);
            setCurrentStep(4);
            if (isJEE) {
                alert(`✓ Successfully Auto-Generated ${cappedPicked.length} Questions for JEE Main!\nStrictly 25 Questions per subject (${examSubjects.join(', ')}: 20 Section A + 5 Numericals) totaling exactly ${cappedPicked.length} questions.`);
            } else {
                alert(`✓ Successfully Auto-Generated ${allPicked.length} Questions across all ${examSubjects.length} subjects with concept balance!`);
            }
        } catch (err) {
            console.error('Error in multi-subject auto generation:', err);
            alert('Error generating all subjects. Please try again.');
        } finally {
            setAutoGenerating(false);
        }
    };

    // Clear active subject selection
    const handleClearActiveSubjectQuestions = () => {
        const normActive = normalizeSubjectName(activeSubjectTab).toLowerCase();
        setSelectedQuestions(prev => prev.filter(q => {
            const qNorm = normalizeSubjectName(q.sectionSubject || q.subject || '').toLowerCase();
            return qNorm !== normActive;
        }));
    };

    // Handle Question Click or Swap in Manual Selection
    const handleQuestionClick = (question) => {
        const qId = question._id || question.id;
        const isJEE = (examType || '').toUpperCase().includes('JEE');
        const qTypeUpper = (question.type || question.q_type || '').toUpperCase();
        const isNum = Boolean(question.isNumerical) || matchesQuestionType(question, 'Numerical / Integer Type') || qTypeUpper.includes('NUMERICAL') || qTypeUpper.includes('INTEGER') || qTypeUpper === 'NUM';

        const qWithSub = {
            ...question,
            sectionSubject: question.sectionSubject || activeSubjectTab,
            subject: question.subject || activeSubjectTab,
            ...(isJEE ? {
                part: isNum ? 'SECTION B - NUMERICAL VALUE QUESTIONS' : 'SECTION A - MULTIPLE CHOICE QUESTIONS',
                partDirective: isNum
                    ? 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.'
                    : 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.',
                isNumerical: isNum,
                type: isNum ? 'NUMERICAL' : (question.type || 'MCQ'),
                options: isNum ? [] : (question.options || []),
            } : {})
        };

        if (swappingQuestionIndex !== null) {
            setSelectedQuestions(prev => {
                const next = [...prev];
                next[swappingQuestionIndex] = qWithSub;
                return next;
            });
            const replacedIdx = swappingQuestionIndex;
            setSwappingQuestionIndex(null);
            setJustSwappedIndex(replacedIdx);
            setTimeout(() => setJustSwappedIndex(null), 1500);
            showToastNotification(`Replaced Q#${replacedIdx + 1} with question from ${question.chapter || 'repository'}!`, 'success');
            return;
        }

        if (isJEE) {
            const exists = selectedQuestions.some(q => (q._id || q.id) === qId);
            if (!exists) {
                const sub = qWithSub.sectionSubject || activeSubjectTab;
                const subQs = (selectedQuestionsBySubject[sub] || []);
                const isItemNum = (q) => {
                    const t = (q.type || q.q_type || '').toUpperCase();
                    return Boolean(q.isNumerical) || matchesQuestionType(q, 'Numerical / Integer Type') || t.includes('NUMERICAL') || t.includes('INTEGER') || t === 'NUM';
                };
                const curSecA = subQs.filter(q => !isItemNum(q)).length;
                const curSecB = subQs.filter(q => isItemNum(q)).length;

                if (!isNum && curSecA >= 20) {
                    showToastNotification(`JEE Limit: Section A is full (strictly 20 questions maximum for ${sub})!`, 'warning');
                    return;
                }
                if (isNum && curSecB >= 5) {
                    showToastNotification(`JEE Limit: Section B is full (strictly 5 numericals maximum for ${sub})!`, 'warning');
                    return;
                }
            }
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

    // Auto-Swap Question with spinner, deduplication against current paper, flash animation, and 5s undo
    const handleAutoSwapQuestion = async (targetQuestion, index) => {
        if (swappingIndex !== null) return;
        setSwappingIndex(index);

        const sub = targetQuestion.sectionSubject || targetQuestion.subject || activeSubjectTab;
        let pool = questionsPoolCache[sub];
        if (!pool || pool.length === 0) {
            pool = await fetchQuestionsPoolForSubject(sub);
        }

        if (!pool || pool.length === 0) {
            setSwappingIndex(null);
            showToastNotification(`No question pool available for ${sub}. Check connection.`, 'warning');
            return;
        }

        const activeIds = new Set(selectedQuestions.map(q => String(q._id || q.id)));
        const targetChapter = targetQuestion.chapter;
        const targetLevel = (targetQuestion.level || 'medium').toLowerCase();
        const targetPart = targetQuestion.part || 'PART-A';
        const targetMarks = targetQuestion.marks || 1;

        // 1. Strict match: same chapter, same difficulty tier, not in active paper
        let candidates = pool.filter(q => {
            const id = String(q._id || q.id);
            if (activeIds.has(id)) return false;
            const sameChapter = q.chapter && targetChapter && q.chapter.toLowerCase() === targetChapter.toLowerCase();
            const sameLevel = (q.level || 'medium').toLowerCase() === targetLevel;
            return sameChapter && sameLevel;
        });

        // 2. Same chapter, any difficulty tier, not in active paper
        if (candidates.length === 0) {
            candidates = pool.filter(q => {
                const id = String(q._id || q.id);
                if (activeIds.has(id)) return false;
                return q.chapter && targetChapter && q.chapter.toLowerCase() === targetChapter.toLowerCase();
            });
        }

        // 3. Fallback: same subject pool, not in active paper
        if (candidates.length === 0) {
            candidates = pool.filter(q => {
                const id = String(q._id || q.id);
                return !activeIds.has(id);
            });
        }

        if (candidates.length === 0) {
            setSwappingIndex(null);
            showToastNotification(
                `No alternative questions found for chapter "${targetChapter || 'General'}" and mark category. Try manual selection.`,
                'warning'
            );
            return;
        }

        // Pick a replacement at random
        const replacement = candidates[Math.floor(Math.random() * candidates.length)];
        const replacementWithMeta = {
            ...replacement,
            sectionSubject: sub,
            subject: sub,
            part: targetPart,
            marks: targetMarks,
        };

        const undoData = {
            index,
            previousQuestion: targetQuestion,
        };

        setSelectedQuestions(prev => {
            const next = [...prev];
            next[index] = replacementWithMeta;
            return next;
        });

        setSwappingIndex(null);
        setJustSwappedIndex(index);
        setTimeout(() => setJustSwappedIndex(null), 1500);

        showToastNotification(
            `Swapped Q#${index + 1} with an alternative from ${replacement.chapter || targetChapter}!`,
            'success',
            undoData
        );
    };

    // 5-second Undo Swap action
    const handleUndoSwap = (undoData) => {
        if (!undoData || undoData.index === undefined || !undoData.previousQuestion) return;
        const { index, previousQuestion } = undoData;
        setSelectedQuestions(prev => {
            const next = [...prev];
            next[index] = previousQuestion;
            return next;
        });
        setJustSwappedIndex(index);
        setTimeout(() => setJustSwappedIndex(null), 1500);
        showToastNotification(`Reverted to original question for Q#${index + 1}.`, 'info');
    };

    // Blueprint Generation Engine strictly aligned with objective/competitive exam question types
    const handleGenerateFromBlueprint = async (matrix, targetMarksVal, targetTotalQsVal, marksPerQVal = 4) => {
        setGeneratingBlueprint(true);
        try {
            let pool = questionsPoolCache[activeSubjectTab];
            if (!pool || pool.length === 0) {
                pool = await fetchQuestionsPoolForSubject(activeSubjectTab);
            }

            if (!pool || pool.length === 0) {
                alert(`No questions found in database for ${activeSubjectTab}. Please check connection.`);
                return;
            }

            const pickedQuestions = [];
            const pickedIds = new Set(selectedQuestions.map(q => String(q._id || q.id)));

            const sampleFromPoolByType = (chapter, count, typeKey, sectionName, markVal) => {
                if (count <= 0) return;
                const chapterPool = pool.filter(q => {
                    const id = String(q._id || q.id);
                    if (pickedIds.has(id)) return false;
                    const ch = q.chapter || 'General';
                    return ch.toLowerCase() === chapter.toLowerCase() || ch.toLowerCase() === 'general';
                });

                // Match questions for this specific type
                let matches = chapterPool.filter(q => matchesQuestionType(q, typeKey));

                // Fallback 1: if not enough in this chapter, check the whole subject pool for this type
                if (matches.length < count) {
                    const subjectTypeMatches = pool.filter(q => {
                        const id = String(q._id || q.id);
                        return !pickedIds.has(id) && matchesQuestionType(q, typeKey);
                    });
                    const additional = subjectTypeMatches.filter(q => !matches.includes(q));
                    matches = [...matches, ...additional];
                }

                // Fallback 2: if still not enough, pick any question from the chapter
                if (matches.length < count) {
                    const chapterFallback = chapterPool.filter(q => !matches.includes(q));
                    matches = [...matches, ...chapterFallback];
                }

                // Shuffle
                matches.sort(() => Math.random() - 0.5);

                let added = 0;
                for (const q of matches) {
                    if (added >= count) break;
                    const id = String(q._id || q.id);
                    if (!pickedIds.has(id)) {
                        pickedIds.add(id);
                        pickedQuestions.push({
                            ...q,
                            part: sectionName,
                            marks: markVal,
                            sectionSubject: activeSubjectTab,
                            subject: q.subject || activeSubjectTab,
                        });
                        added++;
                    }
                }
            };

            const isJEE = (examType || '').toUpperCase().includes('JEE');
            const secAPart = isJEE ? 'SECTION A - MULTIPLE CHOICE QUESTIONS' : '';
            const secBPart = isJEE ? 'SECTION B - NUMERICAL VALUE QUESTIONS' : '';
            const secADir = isJEE ? 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.' : '';
            const secBDir = isJEE ? 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.' : '';

            // Section A: MCQs, Diagrams, Assertion & Reason, Statements, Matrix Match
            Object.entries(matrix).forEach(([chapter, row]) => {
                if (row.mcq > 0) sampleFromPoolByType(chapter, row.mcq, 'Single Correct MCQ', secAPart, marksPerQVal);
                if (row.diag > 0) sampleFromPoolByType(chapter, row.diag, 'Diagram Based', secAPart, marksPerQVal);
                if (row.ar > 0) sampleFromPoolByType(chapter, row.ar, 'Assertion & Reason (A/R)', secAPart, marksPerQVal);
                if (row.stmt > 0) sampleFromPoolByType(chapter, row.stmt, 'Statement Based', secAPart, marksPerQVal);
                if (row.match > 0) sampleFromPoolByType(chapter, row.match, 'Matrix Match', secAPart, marksPerQVal);
            });

            // Section B: Numericals (JEE Section B: 5 Numerical Value Questions)
            Object.entries(matrix).forEach(([chapter, row]) => {
                if (row.num > 0) sampleFromPoolByType(chapter, row.num, 'Numerical / Integer Type', secBPart, marksPerQVal);
            });

            // Format Section A & B directives and strictly clamp JEE to 20 Section A + 5 Section B
            let finalPicked = pickedQuestions;
            if (isJEE) {
                const pickedSecA = pickedQuestions
                    .filter(q => q.part === secAPart && !q.isNumerical && (q.type || '').toUpperCase() !== 'NUMERICAL')
                    .slice(0, 20)
                    .map(q => ({
                        ...q,
                        part: secAPart,
                        partDirective: secADir,
                        isNumerical: false,
                        type: q.type || 'MCQ',
                    }));
                const pickedSecB = pickedQuestions
                    .filter(q => q.part === secBPart || q.isNumerical || (q.type || '').toUpperCase() === 'NUMERICAL')
                    .slice(0, 5)
                    .map(q => ({
                        ...q,
                        part: secBPart,
                        partDirective: secBDir,
                        isNumerical: true,
                        type: 'NUMERICAL',
                        options: [],
                    }));
                finalPicked = [...pickedSecA, ...pickedSecB];
            } else {
                finalPicked = pickedQuestions.map(q => ({
                    ...q,
                    part: '',
                    partDirective: '',
                }));
            }

            if (finalPicked.length === 0) {
                alert('No questions could be sampled for the specified blueprint. Please verify chapter names.');
                return;
            }

            setSelectedQuestions(prev => {
                const others = prev.filter(q => (q.sectionSubject || q.subject || '').toLowerCase() !== activeSubjectTab.toLowerCase());
                return [...others, ...finalPicked];
            });

            if (targetMarksVal) {
                setHeaderConfig(prev => ({ ...prev, maxMarks: String(targetMarksVal) }));
            }

            showToastNotification(`✓ Successfully Generated ${finalPicked.length} Questions from Blueprint!`, 'success');
            setCurrentStep(4);
        } catch (err) {
            console.error('Error generating from blueprint:', err);
            alert('Error generating questions from blueprint. Please try again.');
        } finally {
            setGeneratingBlueprint(false);
        }
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

    // In-Place Question Text & Options Editor with KaTeX Preview & Validation
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

        const qTypeUpper = (question.type || question.q_type || '').toUpperCase();
        const initialQType = (
            qTypeUpper.includes('NUMERICAL') || (question.num_answer !== undefined && question.num_answer !== null && question.num_answer !== '')
        ) ? 'NUMERICAL' : (
            qTypeUpper.includes('ASSERTION') || Boolean(question.assertion && question.reason)
        ) ? 'ASSERTION_REASON' : (
            qTypeUpper.includes('STATEMENT') || (/Statement\s*(?:I|1)/i.test(question.questionText || question.question || '') && /Statement\s*(?:II|2)/i.test(question.questionText || question.question || ''))
        ) ? 'STATEMENT_BASED' : (
            qTypeUpper.includes('DIAGRAM') || question.imageUrl || question.image_url || /\{\{IMG::|!\[|<img/i.test(question.questionText || question.question || '')
        ) ? 'DIAGRAM_BASED' : (
            qTypeUpper.includes('MATCH') || (question.column_a && question.column_a.length > 0)
        ) ? 'MATCH_FOLLOWING' : 'MCQ';

        setEditingQuestionModal({
            index: idx,
            question,
            form: {
                questionText: question.questionText || question.question || '',
                qType: initialQType,
                opt_a: optA,
                opt_b: optB,
                opt_c: optC,
                opt_d: optD,
                num_answer: question.num_answer !== undefined && question.num_answer !== null ? String(question.num_answer) : (typeof question.answer === 'number' ? String(question.answer) : ''),
                answer: question.answer || question.correct_option || 'A',
                marks: question.marks || 4,
                solutionText: question.solutionText || question.solution_text || '',
                imageUrl: question.imageUrl || question.image_url || '',
            }
        });
        setActiveEditorField('questionText');
        setEditorTab('split');
    };

    const handleSaveQuestionEdit = () => {
        if (!editingQuestionModal) return;
        const { index, question, form } = editingQuestionModal;

        if (!form.questionText || !form.questionText.trim()) {
            alert('Question text cannot be empty.');
            return;
        }

        const bracketErr = validateLaTeXInput(form.questionText);
        if (bracketErr) {
            const proceed = window.confirm(`Warning: ${bracketErr}. Do you still want to save?`);
            if (!proceed) return;
        }

        const updatedOptions = [
            { label: 'A', text: form.opt_a },
            { label: 'B', text: form.opt_b },
            { label: 'C', text: form.opt_c },
            { label: 'D', text: form.opt_d },
        ];

        const isNumeric = form.qType === 'NUMERICAL';

        const updatedQuestion = {
            ...question,
            questionText: form.questionText,
            question: form.questionText,
            type: form.qType,
            q_type: form.qType.toLowerCase(),
            options: isNumeric ? [] : updatedOptions,
            opt_a: form.opt_a,
            opt_b: form.opt_b,
            opt_c: form.opt_c,
            opt_d: form.opt_d,
            num_answer: isNumeric ? (form.num_answer || '') : '',
            answer: isNumeric ? (form.num_answer || form.answer) : form.answer,
            correct_option: isNumeric ? (form.num_answer || form.answer) : form.answer,
            marks: Number(form.marks) || 4,
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
        showToastNotification(`Updated Question #${index + 1} successfully!`, 'success');
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

    // Non-destructive section saving for multi-teacher asynchronous drafting
    const handleSaveCurrentSectionDraft = async () => {
        setSavingSection(true);
        try {
            const subQs = (selectedQuestionsBySubject[activeSubjectTab] || []).map((q, qIdx) => ({
                ...q,
                subject: activeSubjectTab,
                sectionSubject: activeSubjectTab,
                sectionName: `Section: ${activeSubjectTab.toUpperCase()}`
            }));

            let currentPaperId = paperId;
            if (!currentPaperId) {
                // Initialize draft paper
                const initialSections = examSubjects.map((sub, sIdx) => {
                    const isCurrent = sub.toLowerCase() === activeSubjectTab.toLowerCase();
                    return {
                        subject: sub,
                        questions: isCurrent ? subQs.map(q => q._id || q.id) : [],
                        questionObjects: isCurrent ? subQs : [],
                        status: isCurrent && subQs.length > 0 ? 'SAVED' : 'NOT_STARTED',
                        updated_at: new Date().toISOString()
                    };
                });

                const initPayload = {
                    title: title || `${examType} Examination Draft (${examSubjects.join(' + ')})`,
                    subject: examSubjects.length === 1 ? examSubjects[0] : (subject || examSubjects.join(', ')),
                    classes: [selectedClass],
                    exam_type: examType,
                    examType: examType,
                    status: 'DRAFT',
                    duration: duration || '180 Minutes',
                    isAssignment: paperCategory === 'assignment',
                    startQNo: startQNo || 1,
                    endQNo: endQNo || (startQNo + selectedQuestions.length - 1),
                    questions: subQs.map(q => q._id || q.id),
                    questionObjects: subQs,
                    sections: initialSections,
                };

                const createRes = await api.post('/api/papers', initPayload);
                currentPaperId = createRes.data._id || createRes.data.id;
                setPaperId(currentPaperId);
                navigate(`/teacher/create-paper?paperId=${currentPaperId}`, { replace: true });
            } else {
                // Non-destructively patch only this subject's section
                await api.patch(`/api/papers/${currentPaperId}/section`, {
                    subject: activeSubjectTab,
                    questions: subQs.map(q => q._id || q.id),
                    questionObjects: subQs,
                    status: subQs.length > 0 ? 'SAVED' : 'IN_PROGRESS',
                    paperStatus: 'DRAFT'
                });
            }
            alert(`✓ [${activeSubjectTab}] Section saved non-destructively as DRAFT! Questions in other subjects remain completely intact.`);
        } catch (err) {
            console.error('Error saving section draft:', err);
            alert('Failed to save section draft: ' + (err.response?.data?.msg || err.message));
        } finally {
            setSavingSection(false);
        }
    };

    // Save Single Subject Paper directly into Commissioned Exam & Department Directory
    const handleSaveSubjectToExam = async () => {
        const sub = activeSubjectTab;
        const subQs = (selectedQuestionsBySubject[sub] || []);
        const isJEE = (examType || '').toUpperCase().includes('JEE');
        const isNEET = (examType || '').toUpperCase().includes('NEET');
        const expectedQuota = isJEE ? 25 : isNEET ? 45 : 60;

        let finalSubQuestions = subQs;
        if (finalSubQuestions.length === 0 && selectedQuestions.length > 0) {
            finalSubQuestions = selectedQuestions;
        }

        if (finalSubQuestions.length === 0) {
            return alert(`Please select or auto-generate questions for ${sub} before saving.`);
        }

        if (isJEE) {
            const isNum = (q) => {
                const t = (q.type || q.q_type || '').toUpperCase();
                return Boolean(q.isNumerical) || matchesQuestionType(q, 'Numerical / Integer Type') || t.includes('NUMERICAL') || t.includes('INTEGER') || t === 'NUM';
            };
            const secA = finalSubQuestions.filter(q => !isNum(q)).slice(0, 20);
            const secB = finalSubQuestions.filter(q => isNum(q)).slice(0, 5);
            finalSubQuestions = [...secA, ...secB];
        } else {
            finalSubQuestions = finalSubQuestions.slice(0, expectedQuota);
        }

        setSaving(true);
        try {
            const paperTitle = `${sub} - ${commissionedExamTitle || title || 'Assessment'}`;
            const payload = {
                title: paperTitle,
                subject: sub,
                classes: [selectedClass || '12'],
                examId: examId,
                duration: duration || '180 Minutes',
                isAssignment: false,
                startQNo: 1,
                endQNo: finalSubQuestions.length,
                questions: finalSubQuestions.map(q => q._id || q.id),
                questionObjects: finalSubQuestions,
                status: 'Approved',
                exam_type: examType,
                examType: examType,
            };

            let res;
            if (paperId) {
                res = await api.put(`/api/papers/${paperId}`, payload);
            } else {
                res = await api.post('/api/papers', payload);
            }

            const savedPaper = res.data;
            const savedPaperId = savedPaper?._id || savedPaper?.id || paperId;

            // Update the online exam's subject assignments with this submittedPaperId
            try {
                const examDetailsRes = await api.get(`/api/exams/${examId}`);
                const ex = examDetailsRes.data;
                if (ex && Array.isArray(ex.subjectAssignments)) {
                    const updatedAssignments = ex.subjectAssignments.map(sa => {
                        const saSub = (sa.subject || '').toLowerCase();
                        const curSub = sub.toLowerCase();
                        if (saSub === curSub || (curSub.includes('math') && saSub.includes('math')) || (curSub.includes('bio') && saSub.includes('bio')) || (curSub.includes('physic') && saSub.includes('physic')) || (curSub.includes('chem') && saSub.includes('chem'))) {
                            return {
                                ...sa,
                                submittedPaperId: String(savedPaperId),
                                questionsCount: finalSubQuestions.length,
                                status: finalSubQuestions.length >= (sa.targetQuestions || expectedQuota) ? 'Completed' : 'In Progress'
                            };
                        }
                        return sa;
                    });
                    await api.put(`/api/exams/${examId}`, { subjectAssignments: updatedAssignments });
                }
            } catch (linkErr) {
                console.warn('Exam subject link warning:', linkErr.message);
            }

            alert(`✓ ${sub} paper successfully saved to "${commissionedExamTitle || title}"!\nStored in the ${sub} Subject Directory as "${paperTitle}".`);
            navigate('/admin/dashboard');
        } catch (err) {
            console.error('Error saving subject paper:', err);
            const serverMsg = err.response?.data?.msg || err.response?.data?.message || err.message;
            alert('Failed to save subject paper: ' + serverMsg);
        } finally {
            setSaving(false);
        }
    };

    // Finalize and Save Paper (supports unified multi-subject merged paper)
    const handleFinalizeAndSave = async () => {
        if (selectedQuestions.length === 0) return alert('No questions selected.');
        setSaving(true);

        try {
            // Organize questions into strict subject order with section headers
            const isJEE = (examType || '').toUpperCase().includes('JEE');
            const organizedQuestions = [];
            const sections = [];
            const targetSubjects = isJEE ? ['Physics', 'Chemistry', 'Mathematics'] : examSubjects;

            targetSubjects.forEach((sub, sIdx) => {
                const rawSubQs = (selectedQuestionsBySubject[sub] || []);
                const isNum = (q) => {
                    const t = (q.type || q.q_type || '').toUpperCase();
                    return Boolean(q.isNumerical) || matchesQuestionType(q, 'Numerical / Integer Type') || t.includes('NUMERICAL') || t.includes('INTEGER') || t === 'NUM';
                };
                let subQuestions = rawSubQs;
                if (isJEE) {
                    const secA = rawSubQs.filter(q => !isNum(q)).slice(0, 20);
                    const secB = rawSubQs.filter(q => isNum(q)).slice(0, 5);
                    subQuestions = [...secA, ...secB];
                }
                const mappedSubQuestions = subQuestions.map((q, qIdx) => ({
                    ...q,
                    sectionName: `Section ${sIdx + 1}: ${sub.toUpperCase()}`,
                    sectionIndex: sIdx + 1,
                    subject: sub,
                    sectionSubject: sub,
                }));
                organizedQuestions.push(...mappedSubQuestions);
                sections.push({
                    subject: sub,
                    questions: mappedSubQuestions.map(q => q._id || q.id),
                    questionObjects: mappedSubQuestions,
                    status: mappedSubQuestions.length > 0 ? 'SAVED' : 'NOT_STARTED',
                    updated_at: new Date().toISOString()
                });
            });

            let finalQuestionsList = organizedQuestions.length > 0 ? organizedQuestions : selectedQuestions;
            if (isJEE) {
                finalQuestionsList = finalQuestionsList.slice(0, 75);
            }

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
                sections: sections,
                difficultyDistribution: autoDist,
                status: user?.role === 'admin' ? 'Approved' : 'COMPLETED',
                exam_type: paperCategory === 'assignment' ? 'ASSIGNMENT' : examType,
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
            const serverMsg = err.response?.data?.msg || err.response?.data?.message || err.message;
            alert('Failed to save paper: ' + serverMsg + '\n\nPlease verify details and try again.');
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
        const isJEE = (examType || '').toUpperCase().includes('JEE');
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
                    sectionSubject: sub,
                }));
                organized.push(...subQs);
            });
            displayList = organized.length > 0 ? organized : selectedQuestions;
        }

        if (isJEE) {
            // Strictly clamp preview to max 20 Section A + max 5 Section B per subject for Physics, Chemistry, Mathematics ONLY
            const pcmBySub = {
                Physics: [],
                Chemistry: [],
                Mathematics: []
            };
            displayList.forEach(q => {
                const norm = normalizeSubjectName(q.sectionSubject || q.subject || '');
                if (pcmBySub[norm]) {
                    pcmBySub[norm].push(q);
                } else {
                    pcmBySub['Mathematics'].push(q);
                }
            });
            const clampedPcm = [];
            ['Physics', 'Chemistry', 'Mathematics'].forEach(sub => {
                const subList = pcmBySub[sub] || [];
                const isNum = (q) => {
                    const t = (q.type || q.q_type || '').toUpperCase();
                    return Boolean(q.isNumerical) || matchesQuestionType(q, 'Numerical / Integer Type') || t.includes('NUMERICAL') || t.includes('INTEGER') || t === 'NUM';
                };
                const secA = subList.filter(q => !isNum(q)).slice(0, 20).map(q => ({
                    ...q,
                    subject: sub,
                    sectionSubject: sub,
                    isNumerical: false,
                    part: 'SECTION A - MULTIPLE CHOICE QUESTIONS'
                }));
                const secB = subList.filter(q => isNum(q)).slice(0, 5).map(q => ({
                    ...q,
                    subject: sub,
                    sectionSubject: sub,
                    isNumerical: true,
                    type: 'NUMERICAL',
                    options: [],
                    part: 'SECTION B - NUMERICAL VALUE QUESTIONS'
                }));
                clampedPcm.push(...secA, ...secB);
            });
            displayList = clampedPcm.slice(0, 75);
        }

        return {
            _id: paperId || 'new-paper',
            title: title || (paperCategory === 'assignment' ? `${subject} Assignment` : `${examType} Examination (${examSubjects.join(' + ')})`),
            subject: examSubjects.length === 1 ? examSubjects[0] : (subject || examSubjects.join(', ')),
            classes: [selectedClass],
            duration: headerConfig?.timeAllowed || duration || null,
            questions: displayList,
            examType: paperCategory === 'assignment' ? 'ASSIGNMENT' : examType,
            isAssignment: paperCategory === 'assignment',
            enableSets: paperCategory !== 'assignment',
            headerConfig: headerConfig,
            partDirectives: partDirectives,
            includeSchemeOnLastPage: settings?.includeSchemeOnLastPage,
        };
    }, [paperId, title, paperCategory, subject, selectedClass, duration, selectedQuestions, selectedQuestionsBySubject, previewSectionFilter, examSubjects, examType, headerConfig, partDirectives, settings?.includeSchemeOnLastPage]);

    // Active subject questions in basket
    const activeSubSelected = selectedQuestionsBySubject[activeSubjectTab] || [];
    const activeSubEasy = activeSubSelected.filter(q => (q.level || 'medium').toLowerCase() === 'easy').length;
    const activeSubMed = activeSubSelected.filter(q => (q.level || 'medium').toLowerCase() === 'medium').length;
    const activeSubHard = activeSubSelected.filter(q => (q.level || 'medium').toLowerCase() === 'hard').length;

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            
            {/* ── TOP HEADER / STEP WIZARD BAR ── */}
            <header className="bg-navy p-4 text-white flex justify-between items-center shadow-xl border-b-4 border-gold sticky top-0 z-30">
                <div className="flex items-center gap-3 ml-4">
                    <button
                        type="button"
                        onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard')}
                        className="bg-white/10 hover:bg-white/20 text-gold px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        ← Exit
                    </button>
                    <button
                        type="button"
                        onClick={handlePrevStep}
                        disabled={currentStep === 1}
                        className="bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                    >
                        <span>← Back Step</span>
                    </button>
                    <div>
                        <h1 className="text-base font-black uppercase tracking-tight leading-none text-white">
                            {paperCategory === 'assignment' ? 'Assignment Generator' : (examSubjects.length > 1 ? `${examType} Multi-Subject Exam Suite` : 'Question Paper Generator')}
                        </h1>
                        <span className="text-[10px] text-gold font-bold uppercase tracking-widest mt-0.5 block">
                            {title || `${subject} Assessment`}
                        </span>
                    </div>
                </div>

                {/* Step Indicators */}
                {examId && (
                    <button
                        type="button"
                        onClick={handleSaveSubjectToExam}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer border border-emerald-400 mr-2"
                        title={`Save all ${activeSubjectTab} questions directly into ${commissionedExamTitle || 'this exam'}`}
                    >
                        <span>💾</span>
                        <span>{saving ? 'Saving...' : `Save ${activeSubjectTab} to ${commissionedExamTitle || 'Exam'}`}</span>
                    </button>
                )}
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
                        
                        {/* Active Shared Drafts Banner */}
                        {availableDrafts.length > 0 && !paperId && (
                            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl">⚡</span>
                                    <div>
                                        <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                                            {availableDrafts.length} Active Shared Exam Draft{availableDrafts.length > 1 ? 's' : ''} in Progress
                                        </h4>
                                        <p className="text-[11px] text-amber-800 font-medium">
                                            Faculty colleagues are currently drafting papers. You can resume editing directly or configure a new assessment below.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {availableDrafts.slice(0, 3).map(d => (
                                        <button
                                            key={d._id}
                                            type="button"
                                            onClick={() => navigate(`/teacher/create-paper?paperId=${d._id}`)}
                                            className="bg-navy hover:bg-navy/90 text-gold text-xs font-black px-3.5 py-1.5 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                                        >
                                            <span>✏️</span>
                                            <span>{d.title || d.exam_type || 'Draft'}</span>
                                        </button>
                                    ))}
                                    {availableDrafts.length > 3 && (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/teacher/dashboard/saved-papers')}
                                            className="text-xs font-bold text-navy underline px-2 cursor-pointer"
                                        >
                                            +{availableDrafts.length - 3} more
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

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
                                    <option value="NEET_PCB">NEET (Physics, Chemistry, Botany, Zoology - 180 Qs)</option>
                                    <option value="JEE_PCM">JEE Main (Physics, Chemistry, Mathematics - 75 Qs)</option>
                                    <option value="CET_PCMB">KCET (Physics, Chemistry, Mathematics, Biology - 240 Qs)</option>
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
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                                            {activeSubjectTab} Chapters ({distinctChapters.length} Available)
                                        </h3>
                                        {selectedChapters.length > 0 && (
                                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                                totalAllocatedChapterQs === defaultQuotaForSubject
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                            }`}>
                                                Allocated: {totalAllocatedChapterQs} / {defaultQuotaForSubject} Qs
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                        Check chapters and specify the number of questions to pick from each chapter.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={distributeChapterQuotasEvenly}
                                        disabled={selectedChapters.length === 0}
                                        className="text-[11px] font-black text-navy bg-gold hover:bg-gold/80 disabled:opacity-40 disabled:pointer-events-none px-3 py-1 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                        title={`Distribute ${defaultQuotaForSubject} questions evenly across checked chapters`}
                                    >
                                        <span>⚡ Distribute Evenly</span>
                                        <span className="text-[9px] bg-navy text-gold px-1.5 py-0.2 rounded-full font-black">
                                            {defaultQuotaForSubject} Qs
                                        </span>
                                    </button>
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
                                                className={`p-3 rounded-2xl border-2 transition flex flex-col justify-between gap-2 ${
                                                    isChecked
                                                        ? 'border-navy bg-navy/5 shadow-xs'
                                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                                }`}
                                            >
                                                <div
                                                    onClick={() => toggleChapter(ch)}
                                                    className="flex items-center gap-3 cursor-pointer"
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

                                                {/* Chapter selected count badge */}
                                                {isChecked && (chapterQuotas[ch] || 0) > 0 && (
                                                    <div className="mt-1 pt-1 border-t border-navy/10 text-right">
                                                        <span className="text-[10px] font-black text-navy/70 uppercase">
                                                            {chapterQuotas[ch]} Qs configured
                                                        </span>
                                                    </div>
                                                )}
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
                    STEP 2: QUESTION TYPE ALLOCATION & ACQUISITION METHOD
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        {!autoFetchConfigOpen ? (
                            /* ── VIEW A: METHOD PICKER (ONLY 2 METHODS) ── */
                            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-8">
                                <div className="border-b border-gray-100 pb-4">
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Step 2 of 5</span>
                                    <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Choose Question Acquisition Method</h2>
                                    <p className="text-xs text-gray-500 font-medium mt-1">
                                        Select how you would like to source and assemble questions for this paper.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Option 1: Auto Fetch Generator */}
                                    <div
                                        onClick={() => setAutoFetchConfigOpen(true)}
                                        className="border-3 border-gray-200 hover:border-gold hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col justify-between group bg-surface hover:-translate-y-1"
                                    >
                                        <div>
                                            <div className="w-16 h-16 rounded-2xl bg-navy text-gold flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-xs">
                                                ⚡
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <span className="text-[9px] font-black uppercase tracking-wider bg-gold text-navy px-2.5 py-0.5 rounded-full">Recommended</span>
                                            </div>
                                            <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">⚡ Auto Fetch Generator</h3>
                                            <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                                First select how many questions from each chapter, then select how many of each question type (MCQs, Statements, AR, Match, Diagrams, Numericals). The engine balances and generates the paper in seconds.
                                            </p>
                                        </div>
                                        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                            <span>Configure Quotas & Auto-Generate</span>
                                            <span className="text-lg">→</span>
                                        </div>
                                    </div>

                                    {/* Option 2: Manual Question Selection */}
                                    <div
                                        onClick={() => {
                                            setMethod('manual');
                                            setCurrentStep(3);
                                        }}
                                        className="border-3 border-gray-200 hover:border-navy hover:shadow-2xl rounded-3xl p-8 cursor-pointer transition-all duration-300 flex flex-col justify-between group bg-surface hover:-translate-y-1"
                                    >
                                        <div>
                                            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-gold flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-xs">
                                                ✍️
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-full">Full Control</span>
                                            </div>
                                            <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-2">✍️ Manual Question Selection</h3>
                                            <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                                Directly browse and pick individual questions chapter-by-chapter with search, difficulty, and type filter tabs. View solutions before picking.
                                            </p>
                                        </div>
                                        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs font-black text-navy uppercase tracking-wider group-hover:text-gold">
                                            <span>Browse Repository Manually</span>
                                            <span className="text-lg">→</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-start pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(1)}
                                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                    >
                                        ← Back to Step 1
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── VIEW B: AUTO FETCH CONFIGURATION (CHAPTER QUOTAS + TYPE ALLOCATION) ── */
                            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-8">
                                <div className="border-b border-gray-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setAutoFetchConfigOpen(false)}
                                            className="text-xs font-black text-navy hover:text-gold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 mb-2"
                                        >
                                            ← Change Acquisition Method
                                        </button>
                                        <h2 className="text-2xl font-black text-navy uppercase tracking-tight">⚡ Auto Fetch Generator Setup</h2>
                                        <p className="text-xs text-gray-500 font-medium mt-1">
                                            1. Set question counts for each chapter → 2. Allocate question types → 3. Click Generate.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className={`px-4 py-2 rounded-2xl border-2 flex items-center gap-2 ${
                                            totalAllocatedTypeQs === defaultQuotaForSubject
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                                                : 'border-amber-400 bg-amber-50 text-amber-900'
                                        }`}>
                                            <span className="text-xs font-black uppercase tracking-wider">Type Allocation:</span>
                                            <span className="text-base font-black">{totalAllocatedTypeQs} / {defaultQuotaForSubject} Qs</span>
                                            {totalAllocatedTypeQs === defaultQuotaForSubject && <span className="text-emerald-600 font-black">✓</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Multi-subject switch tabs if applicable */}
                                {examSubjects.length > 1 && (
                                    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-100">
                                        <span className="text-[11px] font-black text-navy/70 uppercase tracking-wider mr-2">Subject:</span>
                                        {examSubjects.map((sub) => {
                                            const isTabActive = activeSubjectTab === sub;
                                            return (
                                                <button
                                                    key={sub}
                                                    type="button"
                                                    onClick={() => setActiveSubjectTab(sub)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                                        isTabActive
                                                            ? 'bg-navy text-gold shadow-md'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {sub} ({defaultQuotaForSubject} Qs)
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Special Notice for JEE Main */}
                                {(examType || '').toUpperCase().includes('JEE') && (
                                    <div className="bg-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl shrink-0 font-black">
                                            ⭐
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-black text-navy uppercase tracking-wider">
                                                JEE Main Exam Format Enforced
                                            </h4>
                                            <p className="text-[11px] text-amber-950 font-semibold leading-relaxed mt-0.5">
                                                • <strong>Part A (Section A)</strong>: Exactly 20 Questions (MCQ, Assertion-Reason, Statement, Match, Diagram).<br />
                                                • <strong>Part B (Section B)</strong>: Exactly <strong>5 Numericals (Compulsory)</strong> without options (Answer Entry Box).
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ── PART 1: CHAPTER-WISE QUESTION QUOTAS ── */}
                                <div className="space-y-4 p-5 rounded-2xl border-2 border-navy/10 bg-slate-50/50">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-navy/10">
                                        <div>
                                            <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                                                1. Set Question Counts for Each Chapter ({activeSubjectTab})
                                            </h3>
                                            <p className="text-[11px] text-gray-500 font-medium">
                                                Specify how many questions should come from each chapter.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className={`px-3 py-1 rounded-xl text-xs font-black uppercase ${
                                                totalAllocatedChapterQs === defaultQuotaForSubject
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-amber-100 text-amber-900'
                                            }`}>
                                                Allocated: {totalAllocatedChapterQs} / {defaultQuotaForSubject} Qs
                                            </div>
                                            <button
                                                type="button"
                                                onClick={distributeChapterQuotasEvenly}
                                                className="text-xs font-black bg-navy text-gold hover:bg-gold hover:text-navy px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
                                                title="Split target questions equally among selected chapters"
                                            >
                                                ⚡ Distribute Evenly
                                            </button>
                                        </div>
                                    </div>

                                    {/* Chapters Grid with Steppers */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
                                        {(metaData?.chapters || []).map((chObj) => {
                                            const chName = typeof chObj === 'object' ? (chObj.chapter || chObj.name) : chObj;
                                            const isChecked = selectedChapters.includes(chName) || selectedChapters.length === 0;
                                            return (
                                                <div
                                                    key={chName}
                                                    className={`p-3 rounded-2xl border-2 transition flex flex-col justify-between gap-2 ${
                                                        isChecked
                                                            ? 'border-navy bg-white shadow-xs'
                                                            : 'border-gray-200 bg-white/60 opacity-60'
                                                    }`}
                                                >
                                                    <div
                                                        onClick={() => toggleChapter(chName)}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedChapters.includes(chName)}
                                                            onChange={() => {}}
                                                            className="w-4 h-4 text-navy rounded border-gray-300 cursor-pointer"
                                                        />
                                                        <span className="text-xs font-bold text-navy truncate" title={chName}>
                                                            {chName}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-1 border-t border-navy/10">
                                                        <span className="text-[10px] font-black text-navy/70 uppercase">
                                                            Quota:
                                                        </span>
                                                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-navy/20">
                                                            <button
                                                                type="button"
                                                                onClick={() => setChapterQuota(chName, Math.max(0, (chapterQuotas[chName] || 0) - 1))}
                                                                className="w-5 h-5 flex items-center justify-center font-black text-xs text-navy hover:bg-white rounded cursor-pointer"
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={chapterQuotas[chName] ?? 0}
                                                                onChange={(e) => setChapterQuota(chName, e.target.value)}
                                                                className="w-10 text-center font-black text-xs text-navy outline-none border-b border-navy/30 bg-transparent"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setChapterQuota(chName, (chapterQuotas[chName] || 0) + 1)}
                                                                className="w-5 h-5 flex items-center justify-center font-black text-xs text-navy hover:bg-white rounded cursor-pointer"
                                                            >
                                                                +
                                                            </button>
                                                            <span className="text-[9px] text-gray-500 font-bold">Qs</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ── PART 2: QUESTION TYPE ALLOCATION ── */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
                                        <div>
                                            <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                                                2. Allocate Number of Questions by Type ({activeSubjectTab})
                                            </h3>
                                            <p className="text-[11px] text-gray-500 font-medium">
                                                The generated paper will ONLY contain the exact number and types selected below.
                                            </p>
                                        </div>

                                        {/* Presets */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-black text-navy/70 uppercase tracking-wider">Presets:</span>
                                            {(examType || '').toUpperCase().includes('JEE') ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyTypePreset('JEE')}
                                                        className="text-xs font-black bg-navy text-gold px-3 py-1 rounded-xl hover:scale-105 transition cursor-pointer"
                                                    >
                                                        ⚡ JEE Standard (20 Part A + 5 Numericals)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyTypePreset('ALL_MCQ')}
                                                        className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1 rounded-xl transition cursor-pointer"
                                                    >
                                                        20 MCQs + 5 Numericals
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyTypePreset('NEET')}
                                                        className="text-xs font-black bg-navy text-gold px-3 py-1 rounded-xl hover:scale-105 transition cursor-pointer"
                                                    >
                                                        🧬 NEET Standard (32 MCQ, 4 AR, 4 Stmt, 2 Match, 3 Diag)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyTypePreset('ALL_MCQ')}
                                                        className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1 rounded-xl transition cursor-pointer"
                                                    >
                                                        All MCQs ({defaultQuotaForSubject})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyTypePreset('BALANCED')}
                                                        className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1 rounded-xl transition cursor-pointer"
                                                    >
                                                        Balanced Mix
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* 6 Question Type Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {/* 1. Single Correct MCQ */}
                                        <div className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 flex flex-col justify-between gap-3 shadow-2xs">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl">📝</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                                        Single Choice
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-black text-navy mt-1">Single Correct MCQ</h4>
                                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                                    Standard multiple choice with 4 options (A), (B), (C), (D).
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                                                <span className="text-xs font-bold text-navy">Quantity:</span>
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-emerald-300 shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('mcq', Math.max(0, (currentTypeAllocation.mcq || 0) - 1))}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={currentTypeAllocation.mcq ?? 0}
                                                        onChange={(e) => setTypeAllocationCount('mcq', e.target.value)}
                                                        className="w-12 text-center font-black text-sm text-navy outline-none border-b border-navy/30"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('mcq', (currentTypeAllocation.mcq || 0) + 1)}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Statement Based */}
                                        <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/30 flex flex-col justify-between gap-3 shadow-2xs">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl">📑</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                        Evaluation
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-black text-navy mt-1">Statement Based</h4>
                                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                                    Statement I & Statement II correctness evaluation questions.
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                                                <span className="text-xs font-bold text-navy">Quantity:</span>
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-blue-300 shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('stmt', Math.max(0, (currentTypeAllocation.stmt || 0) - 1))}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={currentTypeAllocation.stmt ?? 0}
                                                        onChange={(e) => setTypeAllocationCount('stmt', e.target.value)}
                                                        className="w-12 text-center font-black text-sm text-navy outline-none border-b border-navy/30"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('stmt', (currentTypeAllocation.stmt || 0) + 1)}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. Assertion & Reason */}
                                        <div className="p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/30 flex flex-col justify-between gap-3 shadow-2xs">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl">⚖️</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                                        A / R Logic
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-black text-navy mt-1">Assertion & Reason (A/R)</h4>
                                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                                    Assertion (A) and Reason (R) logical explanation questions.
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                                                <span className="text-xs font-bold text-navy">Quantity:</span>
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-purple-300 shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('ar', Math.max(0, (currentTypeAllocation.ar || 0) - 1))}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={currentTypeAllocation.ar ?? 0}
                                                        onChange={(e) => setTypeAllocationCount('ar', e.target.value)}
                                                        className="w-12 text-center font-black text-sm text-navy outline-none border-b border-navy/30"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('ar', (currentTypeAllocation.ar || 0) + 1)}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4. Match the Following */}
                                        <div className="p-4 rounded-2xl border-2 border-teal-200 bg-teal-50/30 flex flex-col justify-between gap-3 shadow-2xs">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl">🔀</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                                                        Matrix Match
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-black text-navy mt-1">Match the Following</h4>
                                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                                    Column I and Column II tabular pairing format.
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-teal-100">
                                                <span className="text-xs font-bold text-navy">Quantity:</span>
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-teal-300 shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('match', Math.max(0, (currentTypeAllocation.match || 0) - 1))}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={currentTypeAllocation.match ?? 0}
                                                        onChange={(e) => setTypeAllocationCount('match', e.target.value)}
                                                        className="w-12 text-center font-black text-sm text-navy outline-none border-b border-navy/30"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('match', (currentTypeAllocation.match || 0) + 1)}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 5. Diagrammatic / Image Based */}
                                        <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 flex flex-col justify-between gap-3 shadow-2xs">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl">🖼️</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                                                        Visual / Graph
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-black text-navy mt-1">Diagrammatic / Image Based</h4>
                                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                                    Questions with diagrams, circuit schematics, biological illustrations.
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
                                                <span className="text-xs font-bold text-navy">Quantity:</span>
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-indigo-300 shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('diag', Math.max(0, (currentTypeAllocation.diag || 0) - 1))}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={currentTypeAllocation.diag ?? 0}
                                                        onChange={(e) => setTypeAllocationCount('diag', e.target.value)}
                                                        className="w-12 text-center font-black text-sm text-navy outline-none border-b border-navy/30"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTypeAllocationCount('diag', (currentTypeAllocation.diag || 0) + 1)}
                                                        className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 6. Numerical / Integer Type */}
                                        <div className={`p-4 rounded-2xl border-2 flex flex-col justify-between gap-3 shadow-2xs ${
                                            (examType || '').toUpperCase().includes('JEE')
                                                ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40'
                                                : 'border-orange-200 bg-orange-50/30'
                                        }`}>
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl">🔢</span>
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                        (examType || '').toUpperCase().includes('JEE')
                                                            ? 'bg-amber-500 text-white'
                                                            : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                        {(examType || '').toUpperCase().includes('JEE') ? 'JEE Part B Compulsory' : 'Numerical'}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-black text-navy mt-1">Numerical / Integer Value</h4>
                                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                                    {(examType || '').toUpperCase().includes('JEE')
                                                        ? 'Mandatory for JEE Section B: Exactly 5 questions without options (Answer Entry Box).'
                                                        : 'Questions where the answer is a numeric/integer value.'}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                                                <span className="text-xs font-bold text-navy">Quantity:</span>
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-amber-300 shadow-2xs">
                                                    {(examType || '').toUpperCase().includes('JEE') ? (
                                                        <span className="text-xs font-black text-amber-800 px-2 py-0.5 bg-amber-50 rounded-lg">
                                                            5 Compulsory
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setTypeAllocationCount('num', Math.max(0, (currentTypeAllocation.num || 0) - 1))}
                                                                className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={currentTypeAllocation.num ?? 0}
                                                                onChange={(e) => setTypeAllocationCount('num', e.target.value)}
                                                                className="w-12 text-center font-black text-sm text-navy outline-none border-b border-navy/30"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setTypeAllocationCount('num', (currentTypeAllocation.num || 0) + 1)}
                                                                className="w-6 h-6 flex items-center justify-center font-black text-sm text-navy hover:bg-slate-100 rounded cursor-pointer"
                                                            >
                                                                +
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── PART 3: GENERATE ACTION BAR ── */}
                                <div className="bg-navy text-white p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl border border-gold/30">
                                    <div>
                                        <span className="text-[10px] text-gold font-bold uppercase tracking-widest">
                                            Ready to Assemble Paper
                                        </span>
                                        <div className="text-base font-black mt-0.5">
                                            {activeSubjectTab}: {totalAllocatedTypeQs || defaultQuotaForSubject} Questions strictly sampled by quotas & type breakdown
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap">
                                        {examSubjects.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={handleAutoGenerateAllSubjects}
                                                disabled={autoGenerating}
                                                className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition border border-white/20 cursor-pointer"
                                            >
                                                {autoGenerating ? 'Generating...' : `⚡ Auto-Generate All ${examSubjects.length} Subjects`}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleAutoGenerateActiveSubject}
                                            disabled={autoGenerating}
                                            className="bg-gold text-navy hover:scale-105 px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-2xl flex items-center gap-2 cursor-pointer"
                                        >
                                            <span>⚡</span>
                                            <span>{autoGenerating ? 'Generating Questions...' : `Generate ${activeSubjectTab} & Preview (${totalAllocatedTypeQs || defaultQuotaForSubject} Qs)`}</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
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

                        {/* Top Mode Segmented Switcher (Blueprint vs Auto Fetch vs Manual) */}
                        <div className="flex flex-wrap items-center justify-between bg-white p-3 rounded-2xl border border-gray-200 shadow-sm gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setMethod('blueprint')}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                        method === 'blueprint'
                                            ? 'bg-gold text-navy shadow-md ring-2 ring-gold/40 scale-105'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <span>📁 Chapter Dropdowns & Matrix</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMethod('auto')}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                        method === 'auto'
                                            ? 'bg-gold text-navy shadow-md ring-2 ring-gold/40 scale-105'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <span>⚡ Auto Fetch Engine</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMethod('manual')}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                                        method === 'manual'
                                            ? 'bg-navy text-gold shadow-md ring-2 ring-navy/40 scale-105'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <span>✍️ Manual Question Selection</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                                >
                                    <span>←</span> Method (Step 2)
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCurrentSectionDraft}
                                    disabled={savingSection}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center gap-1.5"
                                    title={`Save only ${activeSubjectTab} section without modifying other subjects`}
                                >
                                    <span>💾</span>
                                    <span>{savingSection ? 'Saving...' : `Save ${activeSubjectTab} (Draft)`}</span>
                                </button>
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
                                    <span>Preview & Merge (Step 4) →</span>
                                </button>
                            </div>
                        </div>

                        {/* ──────────────────────────────────────────────────────────
                            VIEW 0: CHAPTER BLUEPRINT / WEIGHTAGE MATRIX
                        ────────────────────────────────────────────────────────── */}
                        {method === 'blueprint' && (
                            <ChapterBlueprintMatrix
                                chapters={distinctChapters.length > 0 ? distinctChapters : (metaData.chapters || [])}
                                subject={activeSubjectTab}
                                examType={examType}
                                isGenerating={generatingBlueprint}
                                onGenerate={handleGenerateFromBlueprint}
                                onCancel={() => setMethod('auto')}
                            />
                        )}

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

                                {/* Controls: Target Count, Question Type Filter & Difficulty Distribution */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-3xl border border-gray-200">
                                    
                                    {/* 1. Target Quota for Active Subject */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-navy uppercase tracking-wider">
                                                {activeSubjectTab} Target Quota
                                            </label>
                                            <span className="text-sm font-black text-navy bg-white px-3 py-1 rounded-xl border border-gray-300">
                                                {(examType || '').toUpperCase().includes('JEE') ? 25 : autoQtyPerSubject} Questions
                                            </span>
                                        </div>
                                        {(examType || '').toUpperCase().includes('JEE') ? (
                                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800 flex items-center gap-2">
                                                <span>🔒</span>
                                                <span>Fixed JEE Main Format: Strictly 25 Questions (20 Sec A + 5 Sec B). Total: 75 Qs.</span>
                                            </div>
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                    </div>

                                    {/* 2. Question Type Filter Dropdown */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-navy uppercase tracking-wider">
                                                Question Type
                                            </label>
                                            <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-lg border border-gray-200">
                                                Filter
                                            </span>
                                        </div>
                                        <select
                                            value={selectedQuestionType}
                                            onChange={(e) => setSelectedQuestionType(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold"
                                        >
                                            <option value="ALL">All Question Types</option>
                                            <option value="Single Correct MCQ">Single Correct MCQ</option>
                                            <option value="Assertion & Reason (A/R)">Assertion & Reason (A/R)</option>
                                            <option value="Statement Based">Statement Based</option>
                                            <option value="Numerical / Integer Type">Numerical / Integer Type</option>
                                            <option value="Diagram Based">Diagrammatic / Image Based</option>
                                            <option value="Matrix Match">Matrix Match</option>
                                        </select>
                                        <div className="text-[10px] font-medium text-gray-400">
                                            Fetch only matching format questions
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
                                                {activeSubjectTab} Section
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
                                            onClick={() => setCurrentStep(2)}
                                            className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                                        >
                                            <span>←</span> Method (Step 2)
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

                                {/* Question Type Live Allocation Tracker */}
                                <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md border border-navy/30 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gold font-black text-xs uppercase tracking-wider">
                                                📊 Question Type Allocation Tracker ({activeSubjectTab})
                                            </span>
                                            <span className="text-[10px] text-white/70 font-semibold">
                                                (Target: {defaultQuotaForSubject} Qs)
                                            </span>
                                        </div>
                                        <div className="text-xs font-black text-gold">
                                            Total Selected: {(selectedQuestionsBySubject[activeSubjectTab] || []).length} / {defaultQuotaForSubject} Qs
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                                        {/* MCQ */}
                                        <div className={`p-2.5 rounded-xl border ${
                                            typeBreakdownCurrent.mcq >= (currentTypeAllocation.mcq || 0) && (currentTypeAllocation.mcq || 0) > 0
                                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                                                : 'bg-white/10 border-white/15 text-white/90'
                                        }`}>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Single Correct MCQ</div>
                                            <div className="text-sm font-black mt-0.5 flex items-center justify-between">
                                                <span>{typeBreakdownCurrent.mcq} / {currentTypeAllocation.mcq || 0}</span>
                                                {typeBreakdownCurrent.mcq >= (currentTypeAllocation.mcq || 0) && (currentTypeAllocation.mcq || 0) > 0 && <span className="text-emerald-400 font-black">✓</span>}
                                            </div>
                                        </div>

                                        {/* Statement */}
                                        <div className={`p-2.5 rounded-xl border ${
                                            typeBreakdownCurrent.stmt >= (currentTypeAllocation.stmt || 0) && (currentTypeAllocation.stmt || 0) > 0
                                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                                                : 'bg-white/10 border-white/15 text-white/90'
                                        }`}>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Statement Based</div>
                                            <div className="text-sm font-black mt-0.5 flex items-center justify-between">
                                                <span>{typeBreakdownCurrent.stmt} / {currentTypeAllocation.stmt || 0}</span>
                                                {typeBreakdownCurrent.stmt >= (currentTypeAllocation.stmt || 0) && (currentTypeAllocation.stmt || 0) > 0 && <span className="text-emerald-400 font-black">✓</span>}
                                            </div>
                                        </div>

                                        {/* Assertion & Reason */}
                                        <div className={`p-2.5 rounded-xl border ${
                                            typeBreakdownCurrent.ar >= (currentTypeAllocation.ar || 0) && (currentTypeAllocation.ar || 0) > 0
                                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                                                : 'bg-white/10 border-white/15 text-white/90'
                                        }`}>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Assertion & Reason</div>
                                            <div className="text-sm font-black mt-0.5 flex items-center justify-between">
                                                <span>{typeBreakdownCurrent.ar} / {currentTypeAllocation.ar || 0}</span>
                                                {typeBreakdownCurrent.ar >= (currentTypeAllocation.ar || 0) && (currentTypeAllocation.ar || 0) > 0 && <span className="text-emerald-400 font-black">✓</span>}
                                            </div>
                                        </div>

                                        {/* Match Following */}
                                        <div className={`p-2.5 rounded-xl border ${
                                            typeBreakdownCurrent.match >= (currentTypeAllocation.match || 0) && (currentTypeAllocation.match || 0) > 0
                                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                                                : 'bg-white/10 border-white/15 text-white/90'
                                        }`}>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Match Following</div>
                                            <div className="text-sm font-black mt-0.5 flex items-center justify-between">
                                                <span>{typeBreakdownCurrent.match} / {currentTypeAllocation.match || 0}</span>
                                                {typeBreakdownCurrent.match >= (currentTypeAllocation.match || 0) && (currentTypeAllocation.match || 0) > 0 && <span className="text-emerald-400 font-black">✓</span>}
                                            </div>
                                        </div>

                                        {/* Diagrammatic */}
                                        <div className={`p-2.5 rounded-xl border ${
                                            typeBreakdownCurrent.diag >= (currentTypeAllocation.diag || 0) && (currentTypeAllocation.diag || 0) > 0
                                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                                                : 'bg-white/10 border-white/15 text-white/90'
                                        }`}>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Diagrammatic</div>
                                            <div className="text-sm font-black mt-0.5 flex items-center justify-between">
                                                <span>{typeBreakdownCurrent.diag} / {currentTypeAllocation.diag || 0}</span>
                                                {typeBreakdownCurrent.diag >= (currentTypeAllocation.diag || 0) && (currentTypeAllocation.diag || 0) > 0 && <span className="text-emerald-400 font-black">✓</span>}
                                            </div>
                                        </div>

                                        {/* Numericals */}
                                        <div className={`p-2.5 rounded-xl border ${
                                            typeBreakdownCurrent.num >= ((examType || '').toUpperCase().includes('JEE') ? 5 : (currentTypeAllocation.num || 0)) && ((examType || '').toUpperCase().includes('JEE') || (currentTypeAllocation.num || 0) > 0)
                                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                                                : (examType || '').toUpperCase().includes('JEE')
                                                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 ring-1 ring-amber-400'
                                                : 'bg-white/10 border-white/15 text-white/90'
                                        }`}>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1">
                                                <span>Numerical</span>
                                                {(examType || '').toUpperCase().includes('JEE') && <span className="text-[8px] bg-amber-500 text-navy px-1 py-0.2 rounded font-black">JEE Sec B</span>}
                                            </div>
                                            <div className="text-sm font-black mt-0.5 flex items-center justify-between">
                                                <span>{typeBreakdownCurrent.num} / {(examType || '').toUpperCase().includes('JEE') ? 5 : (currentTypeAllocation.num || 0)}</span>
                                                {typeBreakdownCurrent.num >= ((examType || '').toUpperCase().includes('JEE') ? 5 : (currentTypeAllocation.num || 0)) && (
                                                    <span className="text-emerald-400 font-black">✓</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Question Type Quick Filter Tabs */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-100">
                                    <span className="text-[10px] font-black uppercase text-navy/70 tracking-wider mr-1">
                                        Type Filter:
                                    </span>
                                    {[
                                        { label: 'All Question Types', key: '' },
                                        { label: 'Single Correct MCQ', key: 'MCQ' },
                                        { label: 'Statement Based', key: 'STATEMENT' },
                                        { label: 'Assertion & Reason', key: 'ASSERTION' },
                                        { label: 'Match the Following', key: 'MATCH' },
                                        { label: 'Diagrammatic', key: 'DIAGRAM' },
                                        { label: (examType || '').toUpperCase().includes('JEE') ? 'Numericals (JEE Part B)' : 'Numericals', key: 'NUMERICAL' }
                                    ].map(tab => {
                                        const isTabActive = filterType === tab.key;
                                        return (
                                            <button
                                                key={tab.key}
                                                type="button"
                                                onClick={() => { setFilterType(tab.key); setPageNumber(1); }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                                    isTabActive
                                                        ? 'bg-navy text-gold shadow-xs font-black ring-1 ring-gold/40'
                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        );
                                    })}
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
                                            <div
                                                key={idx}
                                                className={`border p-5 rounded-2xl transition-all duration-700 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                                                    justSwappedIndex === idx
                                                        ? 'ring-4 ring-gold bg-amber-50/90 shadow-lg scale-[1.01] border-gold'
                                                        : 'border-gray-200 bg-gray-50/50 hover:bg-white hover:border-navy'
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <span className="text-[10px] font-black bg-navy text-gold px-2 py-0.5 rounded">
                                                            Q.{startQNo + idx}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-navy bg-blue-50 px-2 py-0.5 rounded">
                                                            {q.sectionSubject || q.subject || 'Subject'} • {q.chapter || 'General'}
                                                        </span>
                                                        {q.part && (
                                                            <span className="text-[10px] font-black text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                                                                {q.part} ({q.marks || 1}M)
                                                            </span>
                                                        )}
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
                                                        disabled={swappingIndex === idx}
                                                        onClick={() => handleAutoSwapQuestion(q, idx)}
                                                        className="bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-50 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-xs"
                                                        title="Automatically swap with another question from the same chapter"
                                                    >
                                                        {swappingIndex === idx ? (
                                                            <>
                                                                <span className="inline-block animate-spin">⏳</span>
                                                                <span>Swapping...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>🔄</span>
                                                                <span>Swap</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSwappingQuestionIndex(idx);
                                                            setShowReviewSelectedModal(false);
                                                        }}
                                                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                                                        title="Browse repository to manually pick a replacement"
                                                    >
                                                        Browse 🔍
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
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(3)}
                                    className="bg-navy text-gold hover:scale-105 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-2"
                                >
                                    <span>←</span> ✏️ Questions (Step 3)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowHeaderConfigModal(true)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition border border-gray-300 flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <span>🏛️</span> Header & Choice Directives
                                </button>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setShowAnalysisModal(true)}
                                    className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>📊</span> View Analysis
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAnswerKeyModal(true)}
                                    className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>🔑</span> Answer Key
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSolutionsModal(true)}
                                    className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>💡</span> Solutions Guide
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(5)}
                                    className="bg-slate-100 hover:bg-slate-200 text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition border border-gray-300 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>⚙️</span> Alignment Controls →
                                </button>
                                {examId ? (
                                    <button
                                        type="button"
                                        onClick={handleSaveSubjectToExam}
                                        disabled={saving}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-1.5 cursor-pointer border-2 border-emerald-400"
                                    >
                                        <span>💾</span> {saving ? 'Saving...' : `Save ${activeSubjectTab} to ${commissionedExamTitle || 'Exam'}`}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleFinalizeAndSave}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>✓</span> {saving ? 'Saving...' : (examSubjects.length > 1 ? 'Merge & Finalize Exam Paper' : `Save ${paperCategory === 'assignment' ? 'Assignment' : 'Paper'}`)}
                                </button>
                                )}
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
                                    type="button"
                                    onClick={() => setCurrentStep(4)}
                                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                >
                                    ← Back to Preview
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(3)}
                                    className="bg-gray-100 text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                >
                                    ✏️ Edit Questions
                                </button>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap">
                                <button
                                    type="button"
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
                                enableSets={paperCategory !== 'assignment'}
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

                {/* ── MODAL: ANSWER KEY (SYNCED P, Q, R, S SETS) ── */}
                {showAnswerKeyModal && (
                    <A4AnswerKey
                        paper={currentPaperObject}
                        questions={currentPaperObject.questions}
                        startQNo={startQNo}
                        onClose={() => setShowAnswerKeyModal(false)}
                        onQuestionsUpdated={(updatedQs) => {
                            setSelectedQuestions(updatedQs);
                        }}
                    />
                )}

                {/* ── MODAL: SOLUTIONS GUIDE (SYNCED P, Q, R, S SETS) ── */}
                {showSolutionsModal && (
                    <A4SolutionKey
                        paper={currentPaperObject}
                        questions={currentPaperObject.questions}
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

                {/* ── MODAL: EDIT QUESTION WITH LIVE KATEX MATH PREVIEW ── */}
                {editingQuestionModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border-b-8 border-navy animate-fade-in-up overflow-hidden my-auto">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-gray-200 bg-gray-50/90 gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-0.5 rounded-full">
                                            KaTeX Live Math Editor
                                        </span>
                                        <span className="text-xs font-bold text-gray-500">
                                            Editing Question #{startQNo + (editingQuestionModal.index || 0)}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black text-navy mt-1 uppercase tracking-tight">
                                        Edit Question Stem, Formulas & Option Keys
                                    </h3>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* View Mode Switcher */}
                                    <div className="bg-gray-200 p-1 rounded-xl flex items-center gap-1 text-xs font-black">
                                        <button
                                            type="button"
                                            onClick={() => setEditorTab('split')}
                                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                                editorTab === 'split' ? 'bg-navy text-gold shadow-xs' : 'text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            Split View
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditorTab('edit')}
                                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                                editorTab === 'edit' ? 'bg-navy text-gold shadow-xs' : 'text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            Edit Only
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditorTab('preview')}
                                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                                editorTab === 'preview' ? 'bg-navy text-gold shadow-xs' : 'text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            Preview
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setEditingQuestionModal(null)}
                                        className="text-slate-400 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow-xs transition cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Quick Symbol Toolbar */}
                            <div className="bg-slate-100 px-6 py-2 border-b border-gray-200 flex items-center gap-1.5 flex-wrap text-xs">
                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 mr-1">
                                    Insert to {activeEditorField.replace('opt_', 'Option ').toUpperCase()}:
                                </span>
                                {[
                                    { label: '+', val: '+' },
                                    { label: '−', val: '−' },
                                    { label: '×', val: '×' },
                                    { label: '÷', val: '÷' },
                                    { label: '±', val: '±' },
                                    { label: '√', val: '\\sqrt{}' },
                                    { label: 'x²', val: '^{2}' },
                                    { label: 'xₙ', val: '_{n}' },
                                    { label: 'π', val: '\\pi' },
                                    { label: 'θ', val: '\\theta' },
                                    { label: 'α', val: '\\alpha' },
                                    { label: 'β', val: '\\beta' },
                                    { label: 'λ', val: '\\lambda' },
                                    { label: '→', val: '\\rightarrow' },
                                    { label: '⇌', val: '\\rightleftharpoons' },
                                    { label: '°C', val: '^\\circ\\text{C}' },
                                    { label: 'a/b', val: '\\frac{a}{b}' },
                                    { label: 'Δ', val: '\\Delta' },
                                    { label: '∞', val: '\\infty' },
                                    { label: '≤', val: '\\le' },
                                    { label: '≥', val: '\\ge' },
                                    { label: '≈', val: '\\approx' },
                                ].map((sym, sIdx) => (
                                    <button
                                        key={sIdx}
                                        type="button"
                                        onClick={() => insertSymbolToEditorField(sym.val)}
                                        className="bg-white hover:bg-navy hover:text-gold text-slate-800 px-2 py-1 rounded-md text-xs font-bold border border-gray-300 shadow-2xs transition cursor-pointer"
                                        title={`Insert ${sym.val}`}
                                    >
                                        {sym.label}
                                    </button>
                                ))}
                            </div>

                            {/* Main Split-View Content */}
                            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                                {/* LEFT: Edit Form */}
                                {(editorTab === 'split' || editorTab === 'edit') && (
                                    <div className="p-6 space-y-4">
                                        {/* Question Textarea */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-black text-navy uppercase">
                                                    Question Text (LaTeX formulas inside $...$ or $$...$$)
                                                </label>
                                                <span className="text-[10px] text-gray-400 font-bold">
                                                    Click to focus
                                                </span>
                                            </div>
                                            <textarea
                                                rows={4}
                                                value={editingQuestionModal.form.questionText}
                                                onFocus={() => setActiveEditorField('questionText')}
                                                onChange={(e) => setEditingQuestionModal(prev => ({
                                                    ...prev,
                                                    form: { ...prev.form, questionText: e.target.value }
                                                }))}
                                                placeholder="Enter question stem with math e.g. $\\frac{1}{2}mv^2$..."
                                                className={`w-full border rounded-xl p-3 text-xs font-medium outline-none transition focus:ring-2 ${
                                                    activeEditorField === 'questionText'
                                                        ? 'border-navy ring-2 ring-navy/20'
                                                        : 'border-gray-300'
                                                }`}
                                            />
                                            {/* Validation check */}
                                            {validateLaTeXInput(editingQuestionModal.form.questionText) && (
                                                <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg mt-1 flex items-center gap-1.5">
                                                    <span>⚠️</span>
                                                    <span>{validateLaTeXInput(editingQuestionModal.form.questionText)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Options / Numerical Answer Field */}
                                        {editingQuestionModal.form.qType === 'NUMERICAL' ? (
                                            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm">🔢</span>
                                                    <span className="text-xs font-black text-navy uppercase tracking-wider">
                                                        Numerical / Integer Answer Question
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-600 mb-3">
                                                    Students enter the numerical value directly. No multiple-choice options are required.
                                                </p>
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                                                        Expected Numerical / Integer Answer
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editingQuestionModal.form.num_answer || ''}
                                                        placeholder="e.g. 25, 4.5, -12"
                                                        onChange={(e) => setEditingQuestionModal(prev => ({
                                                            ...prev,
                                                            form: { ...prev.form, num_answer: e.target.value, answer: e.target.value }
                                                        }))}
                                                        className="w-full sm:w-64 bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-navy outline-none focus:ring-2 focus:ring-navy"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* 4 Options */
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {['opt_a', 'opt_b', 'opt_c', 'opt_d'].map((optKey, idx) => {
                                                    const label = ['A', 'B', 'C', 'D'][idx];
                                                    const isCorrect = editingQuestionModal.form.answer === label;
                                                    return (
                                                        <div key={optKey}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <label className="block text-[11px] font-black text-gray-700 uppercase">
                                                                    Option {label} {isCorrect && <span className="text-emerald-600 font-black">✓ Correct</span>}
                                                                </label>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={editingQuestionModal.form[optKey]}
                                                                onFocus={() => setActiveEditorField(optKey)}
                                                                onChange={(e) => setEditingQuestionModal(prev => ({
                                                                    ...prev,
                                                                    form: { ...prev.form, [optKey]: e.target.value }
                                                                }))}
                                                                className={`w-full border rounded-xl px-3 py-2 text-xs font-medium outline-none transition focus:ring-2 ${
                                                                    isCorrect
                                                                        ? 'border-emerald-500 bg-emerald-50/30'
                                                                        : activeEditorField === optKey
                                                                        ? 'border-navy ring-2 ring-navy/20'
                                                                        : 'border-gray-300'
                                                                }`}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Question Type, Answer Key, Marks, Diagram */}
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Question Type</label>
                                                <select
                                                    value={editingQuestionModal.form.qType}
                                                    onChange={(e) => setEditingQuestionModal(prev => ({
                                                        ...prev,
                                                        form: { ...prev.form, qType: e.target.value }
                                                    }))}
                                                    className="w-full border border-gray-300 rounded-xl px-2.5 py-2 text-xs font-black text-navy outline-none bg-white cursor-pointer"
                                                >
                                                    <option value="MCQ">Single Correct MCQ</option>
                                                    <option value="ASSERTION_REASON">Assertion & Reason</option>
                                                    <option value="STATEMENT_BASED">Statement Based</option>
                                                    <option value="NUMERICAL">Numerical / Integer</option>
                                                    <option value="DIAGRAM_BASED">Diagram Based</option>
                                                    <option value="MATCH_FOLLOWING">Matrix Match</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                                    {editingQuestionModal.form.qType === 'NUMERICAL' ? 'Numerical Answer' : 'Correct Option'}
                                                </label>
                                                {editingQuestionModal.form.qType === 'NUMERICAL' ? (
                                                    <input
                                                        type="text"
                                                        value={editingQuestionModal.form.num_answer || ''}
                                                        placeholder="e.g. 25, 4.5"
                                                        onChange={(e) => setEditingQuestionModal(prev => ({
                                                            ...prev,
                                                            form: { ...prev.form, num_answer: e.target.value, answer: e.target.value }
                                                        }))}
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-navy outline-none bg-white"
                                                    />
                                                ) : (
                                                    <select
                                                        value={editingQuestionModal.form.answer}
                                                        onChange={(e) => setEditingQuestionModal(prev => ({
                                                            ...prev,
                                                            form: { ...prev.form, answer: e.target.value }
                                                        }))}
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-navy outline-none bg-white cursor-pointer"
                                                    >
                                                        <option value="A">Option A</option>
                                                        <option value="B">Option B</option>
                                                        <option value="C">Option C</option>
                                                        <option value="D">Option D</option>
                                                    </select>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Question Marks</label>
                                                <select
                                                    value={editingQuestionModal.form.marks || 4}
                                                    onChange={(e) => setEditingQuestionModal(prev => ({
                                                        ...prev,
                                                        form: { ...prev.form, marks: parseInt(e.target.value, 10) || 4 }
                                                    }))}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-black text-navy outline-none bg-white cursor-pointer"
                                                >
                                                    <option value={4}>4 Marks (JEE/NEET Standard)</option>
                                                    <option value={1}>1 Mark (KCET / Objective)</option>
                                                    <option value={2}>2 Marks</option>
                                                    <option value={3}>3 Marks</option>
                                                    <option value={5}>5 Marks</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Diagram Image URL</label>
                                                <input
                                                    type="text"
                                                    value={editingQuestionModal.form.imageUrl}
                                                    onFocus={() => setActiveEditorField('imageUrl')}
                                                    onChange={(e) => setEditingQuestionModal(prev => ({
                                                        ...prev,
                                                        form: { ...prev.form, imageUrl: e.target.value }
                                                    }))}
                                                    placeholder="https://..."
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Solution */}
                                        <div>
                                            <label className="block text-xs font-black text-navy uppercase mb-1">
                                                Solution / Valuation Steps
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={editingQuestionModal.form.solutionText}
                                                onFocus={() => setActiveEditorField('solutionText')}
                                                onChange={(e) => setEditingQuestionModal(prev => ({
                                                    ...prev,
                                                    form: { ...prev.form, solutionText: e.target.value }
                                                }))}
                                                placeholder="Provide step-by-step solution / scheme of valuation..."
                                                className="w-full border border-gray-300 rounded-xl p-3 text-xs outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* RIGHT: KaTeX Live Preview */}
                                {(editorTab === 'split' || editorTab === 'preview') && (
                                    <div className="p-6 bg-slate-50/70 overflow-y-auto space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">👁️</span>
                                                <h4 className="font-black text-xs uppercase tracking-wider text-navy">
                                                    Live Formatted KaTeX Preview
                                                </h4>
                                            </div>
                                            <span className="bg-navy text-gold text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                                {editingQuestionModal.form.marks || 1} Mark{(editingQuestionModal.form.marks || 1) > 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* Rendered Question Stem */}
                                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                                            <div className="text-xs font-bold text-navy leading-relaxed">
                                                {editingQuestionModal.form.questionText ? (
                                                    <MathRenderer inline text={editingQuestionModal.form.questionText} />
                                                ) : (
                                                    <span className="text-gray-400 italic">No question text yet. Type on the left...</span>
                                                )}
                                            </div>

                                            {/* Rendered Diagram */}
                                            {editingQuestionModal.form.imageUrl && (
                                                <div className="mt-3 text-center">
                                                    <img
                                                        src={editingQuestionModal.form.imageUrl}
                                                        alt="Diagram Preview"
                                                        className="max-h-40 mx-auto rounded-lg border object-contain"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Rendered Options / Numerical Answer */}
                                        {editingQuestionModal.form.qType === 'NUMERICAL' ? (
                                            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-navy shadow-2xs">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-navy/70 mb-1">
                                                    Numerical / Integer Answer Key:
                                                </div>
                                                <div className="font-mono font-black text-sm text-navy bg-white px-3 py-1.5 rounded-xl border border-amber-300 inline-block">
                                                    {editingQuestionModal.form.num_answer || editingQuestionModal.form.answer || <span className="text-gray-400 italic font-sans font-normal">None specified</span>}
                                                </div>
                                            </div>
                                        ) : (
                                            /* Rendered Options */
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                    Options Preview:
                                                </div>
                                                {['opt_a', 'opt_b', 'opt_c', 'opt_d'].map((optKey, idx) => {
                                                    const label = ['A', 'B', 'C', 'D'][idx];
                                                    const val = editingQuestionModal.form[optKey];
                                                    const isCorrect = editingQuestionModal.form.answer === label;

                                                    return (
                                                        <div
                                                            key={optKey}
                                                            className={`p-3 rounded-xl border flex items-start gap-3 transition ${
                                                                isCorrect
                                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-2xs'
                                                                    : 'border-gray-200 bg-white text-gray-800'
                                                            }`}
                                                        >
                                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                {label}
                                                            </span>
                                                            <div className="text-xs font-medium flex-1 pt-0.5">
                                                                {val ? <MathRenderer inline text={val} /> : <span className="text-gray-400 italic">Empty</span>}
                                                            </div>
                                                            {isCorrect && (
                                                                <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                                                    Key
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Rendered Solution */}
                                        {editingQuestionModal.form.solutionText && (
                                            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-navy mb-1">
                                                    Solution / Steps Preview:
                                                </div>
                                                <div className="text-xs text-slate-700">
                                                    <MathRenderer text={editingQuestionModal.form.solutionText} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setEditingQuestionModal(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveQuestionEdit}
                                    className="bg-navy text-gold px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-navy/90 transition shadow-md cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>✓</span>
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MODAL: INSTITUTIONAL EXAM HEADER & CHOICE DIRECTIVES ── */}
                {showHeaderConfigModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border-b-8 border-navy animate-fade-in-up overflow-hidden my-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                        Institutional Layout Configuration
                                    </span>
                                    <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                        Exam Header & PU Board Choice Directives
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowHeaderConfigModal(false)}
                                    className="text-slate-400 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow-xs transition cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5">
                                {/* Header Info */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-navy uppercase tracking-wider border-b pb-1">
                                        1. College Header Details
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">College Name</label>
                                            <input
                                                type="text"
                                                value={headerConfig.collegeName}
                                                onChange={(e) => setHeaderConfig(prev => ({ ...prev, collegeName: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Center / Subtitle</label>
                                            <input
                                                type="text"
                                                value={headerConfig.subTitle}
                                                onChange={(e) => setHeaderConfig(prev => ({ ...prev, subTitle: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Subject Code</label>
                                            <input
                                                type="text"
                                                value={headerConfig.subjectCode || ''}
                                                placeholder="e.g. 33"
                                                onChange={(e) => setHeaderConfig(prev => ({ ...prev, subjectCode: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Class / Stream</label>
                                            <input
                                                type="text"
                                                value={headerConfig.streamClass || ''}
                                                onChange={(e) => setHeaderConfig(prev => ({ ...prev, streamClass: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Time Allowed</label>
                                            <input
                                                type="text"
                                                value={headerConfig.timeAllowed || ''}
                                                onChange={(e) => setHeaderConfig(prev => ({ ...prev, timeAllowed: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Max Marks</label>
                                            <input
                                                type="text"
                                                value={headerConfig.maxMarks || ''}
                                                onChange={(e) => setHeaderConfig(prev => ({ ...prev, maxMarks: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* General Instructions */}
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase mb-1">
                                        General Instructions (One instruction per line)
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={(headerConfig.generalInstructions || []).join('\n')}
                                        onChange={(e) => setHeaderConfig(prev => ({
                                            ...prev,
                                            generalInstructions: e.target.value.split('\n').filter(Boolean)
                                        }))}
                                        className="w-full border border-gray-300 rounded-xl p-3 text-xs outline-none font-medium leading-relaxed"
                                    />
                                </div>

                                {/* Section / Part Directives */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-navy uppercase tracking-wider border-b pb-1">
                                        2. Section & Choice Directives (Examination Pattern)
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Array.from(new Set([
                                            ...selectedQuestions.map(q => q.part).filter(Boolean),
                                            ...Object.keys(partDirectives)
                                        ])).slice(0, 8).map((partKey) => (
                                            <div key={partKey}>
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                                    {partKey} Directive
                                                </label>
                                                <input
                                                    type="text"
                                                    value={partDirectives[partKey] || ''}
                                                    placeholder="e.g. Answer all questions (+4 Marks for Correct)"
                                                    onChange={(e) => setPartDirectives(prev => ({ ...prev, [partKey]: e.target.value }))}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-navy outline-none focus:ring-2 focus:ring-navy"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Scheme of Valuation Toggle */}
                                <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-black text-navy uppercase">
                                            Include Scheme of Valuation / Answer Key
                                        </div>
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            Appends a structured scheme of valuation with steps and marks on the final page of the PDF.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(settings.includeSchemeOnLastPage)}
                                        onChange={(e) => setSettings(prev => ({ ...prev, includeSchemeOnLastPage: e.target.checked }))}
                                        className="w-5 h-5 accent-navy cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHeaderConfig(DEFAULT_HEADER_CONFIG);
                                        setPartDirectives(DEFAULT_PART_DIRECTIVES);
                                    }}
                                    className="text-xs font-bold text-gray-500 hover:text-navy underline cursor-pointer"
                                >
                                    Reset to Defaults
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowHeaderConfigModal(false)}
                                    className="bg-navy text-gold px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-navy/90 transition shadow cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── FLOATING TOAST NOTIFICATION WITH 5-SECOND UNDO ── */}
                {swapToast.open && (
                    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border-2 transition-all duration-300 animate-slide-up ${
                        swapToast.type === 'success'
                            ? 'bg-navy text-white border-gold'
                            : swapToast.type === 'warning'
                            ? 'bg-amber-50 text-amber-900 border-amber-400'
                            : 'bg-slate-900 text-white border-slate-700'
                    }`}>
                        <span className="text-xl">
                            {swapToast.type === 'success' ? '⚡' : swapToast.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <div className="text-xs font-black">
                            {swapToast.message}
                        </div>
                        {swapToast.undoData && (
                            <button
                                type="button"
                                onClick={() => handleUndoSwap(swapToast.undoData)}
                                className="bg-gold text-navy hover:scale-105 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ml-2 shadow-xs cursor-pointer"
                            >
                                ↩ Undo Swap (5s)
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setSwapToast(prev => ({ ...prev, open: false }))}
                            className="text-white/60 hover:text-white text-sm font-bold ml-1 cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
