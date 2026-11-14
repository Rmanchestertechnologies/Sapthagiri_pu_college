import { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { Check, Zap, Edit3, Target, Scale, X, Plus, Minus, Search, CheckCircle2, ArrowLeft, Command } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api, { API_URL } from '../../api';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import A4AnswerKey from '../../components/A4AnswerKey';
import A4SolutionKey from '../../components/A4SolutionKey';
import Loader from '../../components/Loader';
import { AnimatePresence } from 'framer-motion';
import { StepSidebar } from '../../ui/motion/StepSidebar';
import { MotionRoot, StepTransition, StatusIsland, useIsland, BalanceDock, PaperSeal, CommandPalette, useCommandShortcut } from '../../ui/motion';
import { cleanOptionText, extractOptionsIfMissing } from '../../utils/sanitize';
import { EXAM_PATTERNS, getQCategory, isCetQ, normalizeSubjectName } from './commissioned/examPatterns';

export { getQCategory, isCetQ } from './commissioned/examPatterns';

export default function CommissionedExam() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const routeLocation = useLocation();
    const [searchParams] = useSearchParams();
    // Inside the admin portal the wizard sits under the portal's own top bar, so it must not draw a second sticky bar over it,
    // and "back" / "done" go to the admin screens, not the faculty ones.
    const embedded = routeLocation.pathname.startsWith('/admin/dashboard');
    const homePath = embedded ? '/admin/dashboard' : '/teacher/dashboard';
    const savedPapersPath = embedded ? '/admin/dashboard' : '/teacher/dashboard/saved-papers';

    // Query params
    const paramExamType = searchParams.get('examType');
    const paramSubject = searchParams.get('subject');
    const paramExamId = searchParams.get('examId');
    const paramPaperId = searchParams.get('paperId');

    // ---------------- STEP FLOW STRICTLY DEFINED BY USER:
    // Step 1: Subject Selection (NEET: PCBZ, JEE: PCM, CET: PCMB, Custom)
    // Step 2: Chapter Selection
    // Step 3: Concept Selection
    // Step 4: No of questions from each chapter how many questions (UNLIMITED)
    // Step 5: From each type how many questions (Dynamic Balancing Engine)
    // Step 6: Method (Auto Fetch vs Manual Fetch)
    // Step 7: Preview, Alignment & Save (Fixed bottom-right Save & Merge)
    const paramExamTitle = searchParams.get('examTitle');
    const paramClasses = searchParams.get('classes');
    const [currentStep, setCurrentStep] = useState(paramPaperId ? 7 : (paramSubject ? 2 : 1));
    const [selectedExamPattern, setSelectedExamPattern] = useState(paramExamType || 'NEET');
    const [selectedSubject, setSelectedSubject] = useState(paramSubject || user?.subject || '');
    const [selectedClass, setSelectedClass] = useState(paramClasses || 'Both'); // '11' | '12' | 'Both'
    const [examTitle, setExamTitle] = useState(paramExamTitle || '');

    // Transition Loader state
    const [stepLoading, setStepLoading] = useState(false);
    const [isMetadataLoading, setIsMetadataLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [fetchError, setFetchError] = useState(null); // in-page error state for fetch failures
    // Server report of the last Auto Fetch: requested vs delivered per chapter / type / difficulty
    const [generationReport, setGenerationReport] = useState(null);

    // Step 2: Chapter Selection
    const [availableChapters, setAvailableChapters] = useState([]);
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [chapterSearch, setChapterSearch] = useState('');

    // Step 3: Concept Selection (normalized to { chapter, name })
    const [availableConcepts, setAvailableConcepts] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [conceptSearch, setConceptSearch] = useState('');

    // Filter concepts belonging strictly to selected chapters
    const scopedConcepts = useMemo(() => {
        if (selectedChapters.length === 0) return availableConcepts;
        return availableConcepts.filter(c => {
            if (!c.chapter) return true;
            return selectedChapters.some(ch => ch.toLowerCase() === c.chapter.toLowerCase());
        });
    }, [availableConcepts, selectedChapters]);

    // Step 4: Questions from each chapter how many questions (UNLIMITED CAPACITY)
    // chapterQuotas: { [chapterName]: number }
    const [chapterQuotas, setChapterQuotas] = useState({});
    const [targetQuestionCount, setTargetQuestionCount] = useState(30);

    // Step 5: From each type how many questions (Defaults strictly to 100% MCQs for NEET & CET)
    // typeAllocations: { mcq: number, ar: number, match: number, diag: number, stmt: number, numerical: number }
    const [typeAllocations, setTypeAllocations] = useState({
        mcq: 45,
        ar: 0,
        match: 0,
        diag: 0,
        stmt: 0,
        numerical: 0,
    });

    // Step 5: Difficulty percentage distribution (Easy %, Medium %, Hard % - sum should = 100)
    const [difficultyDistribution, setDifficultyDistribution] = useState({ easy: 30, medium: 50, hard: 20 });

    // Update one difficulty level, auto-clamp the others so total = 100
    const handleDifficultyChange = (level, rawValue) => {
        const val = Math.max(0, Math.min(100, parseInt(rawValue) || 0));
        setDifficultyDistribution(prev => {
            const others = Object.keys(prev).filter(k => k !== level);
            const remaining = 100 - val;
            const otherSum = others.reduce((s, k) => s + prev[k], 0);
            if (otherSum === 0) {
                // Spread equally among others
                const each = Math.floor(remaining / others.length);
                const result = { ...prev, [level]: val };
                others.forEach((k, i) => result[k] = each + (i === 0 ? remaining - each * others.length : 0));
                return result;
            }
            const result = { ...prev, [level]: val };
            let leftover = remaining;
            others.forEach((k, i) => {
                const share = i === others.length - 1 ? leftover : Math.round((prev[k] / otherSum) * remaining);
                result[k] = Math.max(0, share);
                leftover -= result[k];
            });
            return result;
        });
    };

    // Fetch Mode: 'auto' | 'manual'
    const [fetchMode, setFetchMode] = useState('auto'); // 'auto' | 'manual'
    const [showModeModal, setShowModeModal] = useState(false);
    const [pendingSubject, setPendingSubject] = useState(null);

    // Manual Question Selection state
    const [manualPool, setManualPool] = useState([]);
    const [manualLoading, setManualLoading] = useState(false);
    const [manualFilterChapter, setManualFilterChapter] = useState('all');
    const [manualFilterConcept, setManualFilterConcept] = useState('all');
    const [manualFilterDifficulty, setManualFilterDifficulty] = useState('all'); // 'all' | 'easy' | 'medium' | 'hard'
    const [manualFilterType, setManualFilterType] = useState('all'); // 'all' | 'match' | 'ar' | 'mcq' | 'stmt' | 'diag' | 'numerical'
    const [manualSearch, setManualSearch] = useState('');
    const [manualShowSelectedOnly, setManualShowSelectedOnly] = useState(false);

    const [selectedQuestions, setSelectedQuestions] = useState([]);

    // Step 7: Preview & Alignment Settings
    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        optionFormat: 'numeric', // 1, 2, 3, 4 default
    });
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [showAnswerKey, setShowAnswerKey] = useState(false);
    const [showSolutionGuide, setShowSolutionGuide] = useState(false);
    const [savingPaper, setSavingPaper] = useState(false);
    // Id of the paper once saved. Sets Q/R/S are permuted with a seed taken from the paper id, so the
    // sets shown (and the keys printed) match the saved paper, the OMR key and the saved-papers screen
    // only after the first save. Saving again updates this paper instead of creating a duplicate.
    const [savedPaperId, setSavedPaperId] = useState(null);
    // Seed of the P/Q/R/S shuffles, created together with the paper and saved with it, so the sets never change when
    // the paper is saved (they used to depend on the id the database assigns).
    const [pqrsSeed] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `seed-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    // Step 7: PQRS 4-Sets & Zoom & Word state (lifted up so bottom toolbar controls them)
    const [setsActive, setSetsActive] = useState(false);
    const [activeSet, setActiveSet] = useState('P');
    const [previewZoom, setPreviewZoom] = useState(100);
    const [downloadingWord, setDownloadingWord] = useState(false);

    // Merge Exam Modal
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [existingDrafts, setExistingDrafts] = useState([]);
    const [selectedDraftIdsToMerge, setSelectedDraftIdsToMerge] = useState([]);

    const patternConfig = EXAM_PATTERNS[selectedExamPattern] || EXAM_PATTERNS.NEET;

    useEffect(() => {
        if (patternConfig?.defaultTotal) {
            setTargetQuestionCount(patternConfig.defaultTotal);
        }
    }, [selectedExamPattern]);

    // Sum of questions from all chapters (UNLIMITED CAPACITY)
    // Only chapters that are still selected count: a deselected chapter keeps its old entry in
    // chapterQuotas, and counting it inflated the target beyond what the chapters could supply.
    const totalChapterQuestions = useMemo(() => {
        return selectedChapters.reduce((sum, ch) => sum + (parseInt(chapterQuotas[ch]) || 0), 0);
    }, [chapterQuotas, selectedChapters]);

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
                        setSavedPaperId(String(p._id || p.id || paramPaperId));
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

    // Automatically load subject metadata on mount or when subject changes
    useEffect(() => {
        const sub = paramSubject || selectedSubject;
        if (sub) {
            fetchMetadata(sub);
        }
    }, [paramSubject, selectedClass]);

    // Fetch chapters and concepts for selected subject
    const fetchMetadata = async (subj) => {
        const normSub = normalizeSubjectName(subj);
        setIsMetadataLoading(true);
        try {
            const res = await api.get(`/api/questions/meta?subject=${encodeURIComponent(normSub)}&classes=${encodeURIComponent(selectedClass === 'Both' ? '' : selectedClass)}`, { timeout: 20000 });
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
            setIsMetadataLoading(false);
        }
    };

    // When subject is picked in Step 1, open modal to choose Auto Fetch vs Manual Fetch
    const handleSelectSubjectBlock = (sub, patternId = null) => {
        const isAll = sub === 'All Subjects';
        const norm = isAll ? 'Physics, Chemistry, Mathematics, Biology' : normalizeSubjectName(sub);
        if (patternId) setSelectedExamPattern(patternId);
        setSelectedSubject(norm);
        fetchMetadata(norm);
        setPendingSubject({ sub: norm, patternId });
        setShowModeModal(true);
    };

    const handleConfirmMode = (mode) => {
        setFetchMode(mode);
        setShowModeModal(false);
        setCurrentStep(2); // Jump to Chapter Selection (Step 2)
    };

    // Step 4: Auto-distribute evenly across selected chapters (custom target or pattern default)
    const handleDistributeEvenly = (targetTotal = null) => {
        if (selectedChapters.length === 0) return;
        const total = targetTotal || targetQuestionCount || (patternConfig.defaultTotal || 30);
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
    const syncTypesToChapterTotal = (forceAllMcq = false) => {
        const target = totalChapterQuestions > 0 ? totalChapterQuestions : 45;
        const isJEE = selectedExamPattern === 'JEE';
        
        let numQs = isJEE ? Math.min(5, Math.floor(target * 0.2)) : 0;
        let remaining = target - numQs;

        // Strictly 100% Single Correct MCQs for NEET & CET (unless faculty explicitly chooses mixed)
        if (forceAllMcq || selectedExamPattern === 'NEET' || selectedExamPattern === 'CET') {
            setTypeAllocations({
                mcq: remaining,
                ar: 0,
                match: 0,
                diag: 0,
                stmt: 0,
                numerical: numQs,
            });
            return;
        }

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

    const setAllMCQPreset = () => {
        const target = totalChapterQuestions > 0 ? totalChapterQuestions : 45;
        setTypeAllocations({
            mcq: target,
            ar: 0,
            match: 0,
            diag: 0,
            stmt: 0,
            numerical: 0,
        });
    };

    const setBalancedMixPreset = () => {
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

    // Helper to shuffle array and disperse special question types evenly across the paper
    const shuffleAndDisperse = (arr, getCategory) => {
        if (!arr || arr.length <= 1) return arr;
        // 1. Standard Fisher-Yates shuffle
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }

        // 2. Dispersal pass: avoid consecutive clusters of identical special types (e.g. 5 match in a row)
        for (let i = 1; i < a.length; i++) {
            const prevCat = getCategory(a[i - 1]);
            const curCat = getCategory(a[i]);
            if (curCat !== 'mcq' && curCat === prevCat) {
                // Find another question with a different category further down to swap with
                const swapIdx = a.findIndex((item, idx) => idx > i && getCategory(item) !== curCat);
                if (swapIdx !== -1) {
                    const temp = a[i];
                    a[i] = a[swapIdx];
                    a[swapIdx] = temp;
                }
            }
        }
        return a;
    };

    // Load Question Pool for Manual Selection
    const loadManualCandidates = async () => {
        setManualLoading(true);
        setLoadingMessage('Loading question repository for manual selection...');
        try {
            const isJee = selectedExamPattern === 'JEE';
            const baseParams = new URLSearchParams();
            baseParams.append('subject', selectedSubject);
            baseParams.append('limit', '400');
            if (selectedExamPattern) baseParams.append('examType', selectedExamPattern);
            if (selectedClass !== 'Both') baseParams.append('classes', selectedClass);
            if (selectedChapters.length > 0) baseParams.append('chapter', selectedChapters.join(','));

            const fetchTyped = async (typeKey, extraLimit = 300) => {
                const p = new URLSearchParams(baseParams.toString());
                p.set('type', typeKey);
                p.set('limit', String(Math.max(extraLimit, 100)));
                try {
                    const res = await api.get(`/api/questions?${p.toString()}`);
                    const rows = Array.isArray(res.data?.questions) ? res.data.questions : (Array.isArray(res.data) ? res.data : []);
                    return (selectedExamPattern === 'CET') ? rows : rows.filter(q => !isCetQ(q));
                } catch {
                    return [];
                }
            };

            const [arPool, matchPool, stmtPool, diagPool, numPool, mcqPool] = await Promise.all([
                fetchTyped('assertion', 200),
                fetchTyped('match', 200),
                fetchTyped('statement', 200),
                fetchTyped('diagram', 200),
                isJee ? fetchTyped('numerical', 200) : Promise.resolve([]),
                fetchTyped('mcq', 500),
            ]);

            const combined = [
                ...arPool, ...matchPool, ...stmtPool, ...diagPool, ...numPool, ...mcqPool
            ].filter((q, i, arr) => arr.findIndex(x => (x._id || x.id) === (q._id || q.id)) === i);

            setManualPool(combined);
        } catch (err) {
            console.error('Error loading manual candidate pool:', err);
        } finally {
            setManualLoading(false);
            setLoadingMessage('');
        }
    };

    const availableFilterConcepts = useMemo(() => {
        if (manualFilterChapter === 'all') {
            const set = new Set(scopedConcepts.map(c => c.name));
            return Array.from(set);
        }
        const filtered = scopedConcepts.filter(c => (c.chapter || '').toLowerCase() === manualFilterChapter.toLowerCase());
        const set = new Set(filtered.map(c => c.name));
        return Array.from(set);
    }, [scopedConcepts, manualFilterChapter]);

    const filteredManualQuestions = useMemo(() => {
        const isJee = selectedExamPattern === 'JEE';
        return manualPool.filter(q => {
            // 1. Chapter filter
            if (manualFilterChapter !== 'all') {
                const qCh = (q.chapter || '').toLowerCase().trim();
                if (qCh !== manualFilterChapter.toLowerCase().trim()) return false;
            }

            // 2. Concept filter
            if (manualFilterConcept !== 'all') {
                const qCpt = (q.concept || '').toLowerCase().trim();
                if (qCpt !== manualFilterConcept.toLowerCase().trim()) return false;
            }

            // 3. Difficulty filter (easy / medium / hard)
            if (manualFilterDifficulty !== 'all') {
                const qLvl = (q.level || 'medium').toLowerCase().trim();
                if (qLvl !== manualFilterDifficulty.toLowerCase().trim()) return false;
            }

            // 4. Type filter
            if (manualFilterType !== 'all') {
                const cat = getQCategory(q, isJee);
                if (manualFilterType === 'match' || manualFilterType === 'mtf') {
                    if (cat !== 'match') return false;
                } else if (manualFilterType === 'ar') {
                    if (cat !== 'ar') return false;
                } else if (manualFilterType === 'mcq') {
                    if (cat !== 'mcq') return false;
                } else if (manualFilterType === 'stmt') {
                    if (cat !== 'stmt') return false;
                } else if (manualFilterType === 'diag') {
                    if (cat !== 'diag') return false;
                } else if (manualFilterType === 'numerical') {
                    if (cat !== 'numerical') return false;
                }
            }

            // 5. Search text filter
            if (manualSearch.trim()) {
                const s = manualSearch.toLowerCase();
                const text = (q.questionText || q.question || '').toLowerCase();
                const ch = (q.chapter || '').toLowerCase();
                const cpt = (q.concept || '').toLowerCase();
                if (!text.includes(s) && !ch.includes(s) && !cpt.includes(s)) return false;
            }

            // 6. Show selected only
            if (manualShowSelectedOnly) {
                const isSelected = selectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
                if (!isSelected) return false;
            }

            return true;
        });
    }, [manualPool, manualFilterChapter, manualFilterConcept, manualFilterDifficulty, manualFilterType, manualSearch, manualShowSelectedOnly, selectedQuestions, selectedExamPattern]);

    const handleDoneManualSelection = () => {
        if (selectedQuestions.length === 0) {
            alert('Please select at least one question before proceeding to preview.');
            return;
        }
        const isJee = selectedExamPattern === 'JEE';
        const finalOrdered = selectedQuestions.map((rawQ, idx) => {
            const q = { ...rawQ, questionNumber: idx + 1 };
            const cat = getQCategory(q, isJee);
            if (!isJee) {
                q.isNumerical = false;
                q.num_answer = null;
                delete q.num_answer;
                if ((q.type || '').toUpperCase().includes('NUMERICAL')) {
                    q.type = 'MCQ';
                }
            }
            if (cat === 'ar') {
                q.type = 'ASSERTION_REASON';
                const validOpts = (q.options || []).filter(o => o && String(o).trim().length > 0);
                if (validOpts.length < 4) {
                    q.options = [
                        'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
                        'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
                        'Assertion is correct but Reason is incorrect.',
                        'Assertion is incorrect but Reason is correct.'
                    ];
                }
            } else if (cat === 'stmt') {
                q.type = 'STATEMENT_BASED';
                const validOpts = (q.options || []).filter(o => o && String(o).trim().length > 0);
                if (validOpts.length < 4) {
                    q.options = [
                        'Both Statement I and Statement II are correct.',
                        'Both Statement I and Statement II are incorrect.',
                        'Statement I is correct but Statement II is incorrect.',
                        'Statement I is incorrect but Statement II is correct.'
                    ];
                }
            } else if (cat === 'match') {
                q.type = 'MATCH_FOLLOWING';
                if (!q.options || q.options.filter(o => o && String(o).trim().length > 0).length < 2) {
                    const rawOpts = extractOptionsIfMissing(q);
                    if (rawOpts.length >= 2) {
                        q.options = rawOpts;
                    } else if (q.match_options && typeof q.match_options === 'object') {
                        const moArr = [q.match_options.A, q.match_options.B, q.match_options.C, q.match_options.D].filter(Boolean);
                        if (moArr.length >= 2) q.options = moArr;
                    }
                }
            } else if (cat === 'diag') {
                q.type = 'DIAGRAM_BASED';
                if (!q.options || q.options.filter(o => o && String(o).trim().length > 0).length < 2) {
                    const extracted = extractOptionsIfMissing(q);
                    if (extracted.length >= 2) {
                        q.options = extracted;
                    } else {
                        const directOpts = [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(o => o && String(o).trim().length > 0);
                        if (directOpts.length >= 2) q.options = directOpts;
                    }
                }
            } else {
                if (!q.options || q.options.filter(o => o && String(o).trim().length > 0).length < 2) {
                    const extracted = extractOptionsIfMissing(q);
                    if (extracted.length >= 2) {
                        q.options = extracted;
                    } else {
                        const directOpts = [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(o => o && String(o).trim().length > 0);
                        if (directOpts.length >= 2) q.options = directOpts;
                    }
                }
            }
            return q;
        });
        setSelectedQuestions(finalOrdered);
        setCurrentStep(7); // Proceed to Step 7: Preview & Save!
    };

    const handleBackStep = () => {
        if (currentStep === 7) {
            setCurrentStep(fetchMode === 'manual' ? 6 : 5);
        } else if (currentStep === 6) {
            setCurrentStep(3);
        } else if (currentStep === 5) {
            setCurrentStep(4);
        } else if (currentStep === 4) {
            setCurrentStep(3);
        } else if (currentStep === 3) {
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(1);
        } else {
            navigate(homePath);
        }
    };

    // Step 6: Execute Question Fetch - optimized fast single-pool fetch with retry
    const executeFetch = async () => {
        setStepLoading(true);
        setFetchError(null);
        setLoadingMessage('Fetching questions from repository...');

        try {
            const isJee = selectedExamPattern === 'JEE';

            // Build base query parameters
            const baseParams = new URLSearchParams();
            baseParams.append('subject', selectedSubject);
            if (selectedExamPattern) baseParams.append('examType', selectedExamPattern);
            if (selectedClass !== 'Both') baseParams.append('classes', selectedClass);
            if (selectedChapters.length > 0) baseParams.append('chapter', selectedChapters.join(','));

            if (difficultyDistribution.easy > 0 || difficultyDistribution.medium > 0 || difficultyDistribution.hard > 0) {
                const levels = [];
                if (difficultyDistribution.easy > 0) levels.push('easy');
                if (difficultyDistribution.medium > 0) levels.push('medium');
                if (difficultyDistribution.hard > 0) levels.push('hard');
                baseParams.append('level', levels.join(','));
            }

            // ── AUTO MODE ────────────────────────────────────────────────────────────
            // Selection runs on the server (POST /api/questions/chapter-distribution) so that
            // every chapter quota is filled from that chapter only. The previous client-side
            // assembly backfilled a short or failed chapter from the other chapters' pools,
            // which is how a 10/10/10 request could come back as 30 questions from one chapter.
            if (fetchMode === 'auto') {
                const activeQuotas = {};
                selectedChapters.forEach(ch => {
                    const n = parseInt(chapterQuotas[ch], 10);
                    if (n > 0) activeQuotas[ch] = n;
                });
                if (Object.keys(activeQuotas).length === 0) {
                    setFetchError('Select at least one chapter and enter how many questions you need from it (Step 4).');
                    return;
                }

                setLoadingMessage('Assembling question paper honoring chapter, type and difficulty quotas...');
                const res = await api.post('/api/questions/chapter-distribution', {
                    subject: selectedSubject,
                    classes: selectedClass,
                    examType: selectedExamPattern,
                    chapterQuotas: activeQuotas,
                    typeAllocations,
                    difficultyDistribution,
                    concepts: selectedConcepts,
                }, { timeout: 90000 });

                const report = res.data || {};
                const picked = Array.isArray(report.questions) ? report.questions : [];
                setGenerationReport({
                    requestedTotal: report.requestedTotal ?? 0,
                    total: picked.length,
                    complete: Boolean(report.complete),
                    chapters: report.distributionReport || {},
                    types: report.typeReport || {},
                    difficulty: report.difficultyReport || {},
                    warnings: Array.isArray(report.warnings) ? report.warnings : [],
                });

                if (picked.length === 0) {
                    const why = (report.warnings || []).slice(0, 3).join(' ');
                    setFetchError(`No questions could be generated. ${why}`.trim());
                    return;
                }

                // Clean and ensure options for 100% of questions
                picked.forEach(q => {
                    const cat = getQCategory(q, isJee);
                    if (!isJee) {
                        q.isNumerical = false;
                        q.num_answer = null;
                        delete q.num_answer;
                        if ((q.type || '').toUpperCase().includes('NUMERICAL')) {
                            q.type = 'MCQ';
                        }
                    }
                    if (cat === 'ar') {
                        q.type = 'ASSERTION_REASON';
                        const validOpts = (q.options || []).filter(o => o && String(o).trim().length > 0);
                        if (validOpts.length < 4) {
                            q.options = [
                                'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
                                'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
                                'Assertion is correct but Reason is incorrect.',
                                'Assertion is incorrect but Reason is correct.'
                            ];
                        }
                    } else if (cat === 'stmt') {
                        q.type = 'STATEMENT_BASED';
                        const validOpts = (q.options || []).filter(o => o && String(o).trim().length > 0);
                        if (validOpts.length < 4) {
                            q.options = [
                                'Both Statement I and Statement II are correct.',
                                'Both Statement I and Statement II are incorrect.',
                                'Statement I is correct but Statement II is incorrect.',
                                'Statement I is incorrect but Statement II is correct.'
                            ];
                        }
                    } else if (cat === 'match') {
                        q.type = 'MATCH_FOLLOWING';
                        if (!q.options || q.options.filter(o => o && String(o).trim().length > 0).length < 2) {
                            const rawOpts = extractOptionsIfMissing(q);
                            if (rawOpts.length >= 2) {
                                q.options = rawOpts;
                            } else if (q.match_options && typeof q.match_options === 'object') {
                                const moArr = [q.match_options.A, q.match_options.B, q.match_options.C, q.match_options.D].filter(Boolean);
                                if (moArr.length >= 2) q.options = moArr;
                            }
                        }
                    } else if (cat === 'diag') {
                        q.type = 'DIAGRAM_BASED';
                        if (!q.options || q.options.filter(o => o && String(o).trim().length > 0).length < 2) {
                            const extracted = extractOptionsIfMissing(q);
                            if (extracted.length >= 2) {
                                q.options = extracted;
                            } else {
                                const directOpts = [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(o => o && String(o).trim().length > 0);
                                if (directOpts.length >= 2) q.options = directOpts;
                            }
                        }
                    } else {
                        if (!q.options || q.options.filter(o => o && String(o).trim().length > 0).length < 2) {
                            const extracted = extractOptionsIfMissing(q);
                            if (extracted.length >= 2) {
                                q.options = extracted;
                            } else {
                                const directOpts = [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(o => o && String(o).trim().length > 0);
                                if (directOpts.length >= 2) q.options = directOpts;
                            }
                        }
                    }
                });

                // Disperse types naturally across paper
                let finalOrdered = [];
                if (isJee) {
                    const nonNumericals = picked.filter(q => getQCategory(q, true) !== 'numerical');
                    const numericals = picked.filter(q => getQCategory(q, true) === 'numerical');
                    const shuffledNonNum = shuffleAndDisperse(nonNumericals, (q) => getQCategory(q, true));
                    finalOrdered = [...shuffledNonNum, ...numericals];
                } else {
                    finalOrdered = shuffleAndDisperse(picked, (q) => getQCategory(q, false));
                }

                // Number questions 1..N
                finalOrdered = finalOrdered.map((q, idx) => ({
                    ...q,
                    questionNumber: idx + 1
                }));

                setSelectedQuestions(finalOrdered);
                setCurrentStep(7); // Jump straight to Step 7 Preview & Alignment!
                return;
            }

            // ── MANUAL MODE: load a candidate pool per selected chapter ─────────────────
            const chaptersToFetch = selectedChapters.length > 0 ? selectedChapters : [''];
            const chapterPools = {};
            const failedChapters = [];
            setLoadingMessage(`Fetching questions for ${chaptersToFetch.length} selected chapter${chaptersToFetch.length > 1 ? 's' : ''}...`);

            await Promise.all(
                chaptersToFetch.map(async (ch) => {
                    const chParams = new URLSearchParams(baseParams);
                    if (ch) chParams.set('chapter', ch);
                    chParams.set('limit', '100');
                    try {
                        const res = await api.get(`/api/questions?${chParams.toString()}`, { timeout: 35000 });
                        const rows = Array.isArray(res.data?.questions) ? res.data.questions : (Array.isArray(res.data) ? res.data : []);
                        chapterPools[ch] = (selectedExamPattern === 'CET') ? rows : rows.filter(q => !isCetQ(q));
                    } catch (err) {
                        console.warn(`[FETCH] Chapter fetch failed for "${ch}":`, err.message);
                        chapterPools[ch] = [];
                        failedChapters.push(ch || 'all chapters');
                    }
                })
            );

            const filteredRows = Object.values(chapterPools).flat();
            setManualPool(filteredRows);

            if (failedChapters.length > 0) {
                setFetchError(`Could not load questions for: ${failedChapters.join(', ')}. Please retry.`);
            } else if (filteredRows.length === 0) {
                setFetchError('No questions found matching your selected chapter/class filters. Please broaden your selection.');
            }
        } catch (err) {
            console.error('Error fetching questions:', err);
            const isNetworkErr = !err.response;
            const errorDetails = err.message || (err.response ? `HTTP ${err.response.status}` : 'Network error');
            const msg = isNetworkErr
                ? `Connection timed out or network error (${errorDetails}). Please click Retry below to try again.`
                : (err.response?.data?.msg || err.message || 'Failed to fetch questions.');
            setFetchError(msg);
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    // On-demand re-shuffle for Step 7 Preview
    const handleReshuffleQuestions = () => {
        if (!selectedQuestions || selectedQuestions.length <= 1) return;
        const isJee = selectedExamPattern === 'JEE';
        const getQCategory = (q) => {
            const t = (q.type || q.q_type || '').toUpperCase();
            const txt = `${q.questionText || q.question || ''}`;
            if (isJee && (t === 'NUMERICAL' || (!q.options?.length && !q.opt_a && !q.opt_b && q.num_answer))) return 'numerical';
            if (t === 'ASSERTION_REASON' || /Assertion\s*(?:\(A\))?[:\-]/i.test(txt)) return 'ar';
            if (t === 'MATCH_FOLLOWING' || t.includes('MATCH') || /Column\s*(?:I|1|A)\b/i.test(txt)) return 'match';
            if (t === 'STATEMENT_BASED' || /Statement\s*(?:I|1|A)\b/i.test(txt)) return 'stmt';
            if (t === 'DIAGRAM_BASED' || q.imageUrl || q.image_url || /\{\{IMG::|!\[|<img/i.test(txt)) return 'diag';
            return 'mcq';
        };

        let shuffled = [];
        if (isJee) {
            const nonNumericals = selectedQuestions.filter(q => getQCategory(q) !== 'numerical');
            const numericals = selectedQuestions.filter(q => getQCategory(q) === 'numerical');
            const shuffledNonNum = shuffleAndDisperse(nonNumericals, getQCategory);
            shuffled = [...shuffledNonNum, ...numericals];
        } else {
            shuffled = shuffleAndDisperse(selectedQuestions, getQCategory);
        }

        setSelectedQuestions(shuffled.map((q, idx) => ({ ...q, questionNumber: idx + 1 })));
    };

    // Step 7: Live Diagram Resize Sync across questions
    const handleDiagramResize = (qIdOrNum, newHeight, diagramKey = 'main') => {
        setSelectedQuestions(prev => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((q, idx) => {
                const isMatch = (q._id && String(q._id) === String(qIdOrNum)) || 
                                (q.id && String(q.id) === String(qIdOrNum)) ||
                                (idx + 1 === Number(qIdOrNum));
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
            });
        });
    };

    // Step 7: Save Paper Draft
    const handleSaveDraft = async () => {
        setSavingPaper(true);
        island.show('working', 'Saving paper…');
        try {
            const paperData = {
                title: examTitle || `${selectedExamPattern} Examination`,
                subject: selectedSubject || 'General',
                examType: selectedExamPattern,
                exam_type: selectedExamPattern,
                classes: selectedClass === 'Both' ? ['11', '12'] : [selectedClass],
                questions: selectedQuestions.map((q, idx) => ({ ...q, questionNumber: idx + 1 })),
                questionObjects: selectedQuestions.map((q, idx) => ({ ...q, questionNumber: idx + 1 })),
                totalQuestions: selectedQuestions.length,
                totalMarks: selectedQuestions.length * patternConfig.marksPerQ,
                status: 'Draft',
                settings,
                metadata: { pqrsSeed },
                // set only when the paper is created from a commissioned exam's subject block: this is what fills that block
                ...(paramExamId ? { examId: paramExamId } : {}),
            };

            const res = savedPaperId
                ? await api.put(`/api/papers/${savedPaperId}`, paperData)
                : await api.post('/api/papers', paperData);
            const newId = res.data?._id || res.data?.id || savedPaperId;
            if (newId) setSavedPaperId(String(newId));
            setSealShow(true);
            island.show('success', `Saved to your papers${newId ? ` · #${newId}` : ''}`);
            clearDraft();
        } catch (err) {
            console.error('Error saving paper:', err);
            island.show('error', 'Could not save the paper. Check the details and try again.');
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
            navigate(savedPapersPath);
        } catch (err) {
            console.error('Error merging exam:', err);
            alert('Failed to merge exam papers.');
        } finally {
            setStepLoading(false);
            setLoadingMessage('');
        }
    };

    // Step 7: Word Download & Print handlers (uses lifted PQRS state)
    const handleDownloadWord = async () => {
        setDownloadingWord(true);
        try {
            const { generatePaperSet } = await import('../../utils/pqrsGenerator');
            const baseQs = selectedQuestions.map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
            const basePaper = {
                title: examTitle || `${selectedExamPattern} Examination`,
                subject: selectedSubject || 'General',
                examType: selectedExamPattern,
                classes: selectedClass === 'Both' ? ['11', '12'] : [selectedClass],
                questions: baseQs,
                setName: setsActive ? activeSet : 'P',
            };
            const activePaper = setsActive && activeSet !== 'P' ? generatePaperSet(basePaper, activeSet, Number(settings?.startQNo) || 1) : basePaper;
            const rawActiveQs = activePaper?.questions || baseQs;
            const paperData = {
                ...activePaper,
                examType: selectedExamPattern,
                exam_type: selectedExamPattern,
                questions: rawActiveQs,
                setName: setsActive ? activeSet : 'P',
                startQNo: settings?.startQNo || 1,
            };
            const res = await api.post('/api/papers/export-word', paperData, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const cleanTitle = (examTitle || 'Question_Paper').replace(/[^a-zA-Z0-9_-]/g, '_');
            a.download = `${cleanTitle}${setsActive ? `_Set_${activeSet}` : ''}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Word export error:', err);
            let errMsg = err.message;
            if (err.response?.data instanceof Blob) {
                try { const t = await err.response.data.text(); const p = JSON.parse(t); if (p.msg) errMsg = p.msg; } catch { /* body was not JSON */ }
            } else if (err.response?.data?.msg) { errMsg = err.response.data.msg; }
            alert('Failed to download Word document: ' + errMsg);
        } finally { setDownloadingWord(false); }
    };

    const handlePrint = () => window.print();

    const currentPaperObject = useMemo(() => {
        const rawType = String(selectedExamPattern || '').toUpperCase();
        const marksPerQ = settings?.marksPerQuestion !== undefined
            ? Number(settings.marksPerQuestion)
            : (patternConfig.marksPerQ || (rawType.includes('CET') || rawType.includes('ASSIGNMENT') ? 1 : 4));
        const totalMarks = selectedQuestions.length * marksPerQ;
        const defaultDuration = rawType.includes('NEET') ? '200 Minutes' : (rawType.includes('JEE') ? '180 Minutes' : '80 Minutes');
        const effectiveDuration = settings?.duration || (settings?.durationMinutes ? `${settings.durationMinutes} Minutes` : defaultDuration);

        return {
            ...(savedPaperId ? { _id: savedPaperId } : {}),
            pqrsSeed,
            title: examTitle || `${selectedExamPattern} Examination`,
            subject: selectedSubject || 'General',
            examType: selectedExamPattern,
            classes: selectedClass === 'Both' ? ['11', '12'] : [selectedClass],
            questions: selectedQuestions.map((q, idx) => ({ ...q, questionNumber: idx + 1, marks: marksPerQ })),
            marksPerQuestion: marksPerQ,
            totalMarks: totalMarks,
            duration: effectiveDuration,
            institutionName: 'SAPTHAGIRI PU COLLEGE',
            subHeader: 'DEPARTMENT OF PRE-UNIVERSITY EDUCATION, KARNATAKA',
        };
    }, [savedPaperId, pqrsSeed, examTitle, selectedSubject, selectedExamPattern, selectedClass, selectedQuestions, settings?.duration, settings?.durationMinutes, settings?.marksPerQuestion, patternConfig]);

    // The MASTER paper is what gets passed down. PaperRenderer, A4AnswerKey and A4SolutionKey each
    // derive the active P/Q/R/S set from it themselves; handing them an already-permuted paper made
    // them permute it a second time and let edits overwrite the master order with a shuffled one.
    const keySetName = setsActive ? activeSet : 'P';

    // The visible steps of the current flow. Internal step numbers stay 1-7 (the manual flow skips 4 and 5, the automatic flow
    // skips 6); what the user sees is always "Step n of N" with N = 5 (manual) or 6 (automatic), the last one being the preview.
    const wizardSteps = fetchMode === 'manual' ? [
        { step: 1, label: 'Subject' },
        { step: 2, label: 'Chapters' },
        { step: 3, label: 'Concepts' },
        { step: 6, label: 'Select Questions' },
        { step: 7, label: 'Preview & Save' },
    ] : [
        { step: 1, label: 'Subject' },
        { step: 2, label: 'Chapters' },
        { step: 3, label: 'Concepts' },
        { step: 4, label: 'Questions per Chapter' },
        { step: 5, label: 'Questions per Type' },
        { step: 7, label: 'Preview & Save' },
    ];
    const wizardPos = Math.max(0, wizardSteps.findIndex(x => x.step === currentStep));

    // motion layer: direction of travel for the slide, the status pill, the save seal and the command palette
    const island = useIsland();
    const [sealShow, setSealShow] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const prevStepRef = useRef(currentStep);
    const stepDirection = currentStep >= prevStepRef.current ? 1 : -1;
    useEffect(() => { prevStepRef.current = currentStep; }, [currentStep]);
    const togglePalette = useCallback(() => setPaletteOpen(o => !o), []);
    useCommandShortcut(togglePalette);
    const paletteCommands = [
        ...wizardSteps.map((st, i) => ({
            id: `step-${st.step}`, label: `Go to step ${i + 1}: ${st.label}`, hint: i < wizardPos ? 'jump' : (i === wizardPos ? 'you are here' : 'locked'),
            hidden: i >= wizardPos, run: () => setCurrentStep(st.step),
        })),
        { id: 'back', label: 'Go back one step', hint: 'back', run: () => handleBackStep() },
        { id: 'save', label: 'Save paper as draft', hint: 'save', hidden: !(selectedQuestions && selectedQuestions.length), run: () => handleSaveDraft() },
        { id: 'dash', label: 'Leave the wizard (dashboard)', hint: 'exit', run: () => navigate(homePath) },
    ];

    // ───────────── automatic draft saving ─────────────
    // Everything chosen so far is kept on the server about 1.5 s after each change, so a closed laptop, a power cut or another
    // computer never loses an unfinished paper. On the next visit the teacher is offered "Continue" or "Start fresh".
    const draftKey = (paramExamId && paramSubject) ? `block_${paramExamId}_${String(paramSubject).replace(/[^A-Za-z0-9]/g, '')}` : 'free';
    const draftEnabled = !paramPaperId; // a paper that is already saved is edited in place and needs no draft
    const [draftOffer, setDraftOffer] = useState(null);      // { state, meta, updatedAt } waiting for the teacher's choice
    const [draftReady, setDraftReady] = useState(false);     // saving starts only after the offer is answered
    const [draftStatus, setDraftStatus] = useState('idle');  // idle | saving | saved | error
    const [draftRestoredTick, setDraftRestoredTick] = useState(0);
    const draftTimer = useRef(null);
    const lastSent = useRef('');
    const pending = useRef(null);

    const draftSnapshot = useMemo(() => ({
        currentStep, selectedExamPattern, selectedSubject, selectedClass, examTitle, fetchMode,
        selectedChapters, selectedConcepts, chapterQuotas, targetQuestionCount, typeAllocations, difficultyDistribution,
        selectedQuestions, savedPaperId,
    }), [currentStep, selectedExamPattern, selectedSubject, selectedClass, examTitle, fetchMode, selectedChapters, selectedConcepts,
        chapterQuotas, targetQuestionCount, typeAllocations, difficultyDistribution, selectedQuestions, savedPaperId]);

    const hasProgress = (snap) => (snap.selectedChapters && snap.selectedChapters.length > 0) || (snap.selectedQuestions && snap.selectedQuestions.length > 0) || (snap.currentStep || 1) > 2;

    const sendDraft = useCallback(async (snap, keepalive = false) => {
        const text = JSON.stringify(snap);
        if (text === lastSent.current) return;
        setDraftStatus('saving');
        const meta = {
            title: snap.examTitle || `${snap.selectedExamPattern || ''} ${snap.selectedSubject || ''}`.trim() || 'Unfinished paper',
            subject: snap.selectedSubject, examType: snap.selectedExamPattern, step: snap.currentStep,
            questions: (snap.selectedQuestions || []).length, resumeUrl: `${routeLocation.pathname}${routeLocation.search}`,
        };
        try {
            if (keepalive) {
                await fetch(`${API_URL}/api/drafts/${draftKey}`, { method: 'PUT', keepalive: true, credentials: 'include',
                    headers: { 'content-type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify({ state: snap, meta }) });
            } else {
                await api.put(`/api/drafts/${draftKey}`, { state: snap, meta });
            }
            lastSent.current = text;
            setDraftStatus('saved');
        } catch {
            setDraftStatus('error');
        }
    }, [draftKey, routeLocation.pathname, routeLocation.search]);

    const clearDraft = useCallback(async () => {
        clearTimeout(draftTimer.current);
        pending.current = null;
        lastSent.current = '';
        setDraftStatus('idle');
        try { await api.delete(`/api/drafts/${draftKey}`); } catch { /* nothing to remove */ }
    }, [draftKey]);

    // on arrival: is there an unfinished draft for this context?
    useEffect(() => {
        if (!draftEnabled) { setDraftReady(false); return undefined; }
        let alive = true;
        api.get(`/api/drafts/${draftKey}`).then((res) => {
            if (!alive) return;
            if (res.data?.state && hasProgress(res.data.state)) setDraftOffer(res.data);
            else setDraftReady(true);
        }).catch(() => { if (alive) setDraftReady(true); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey, draftEnabled]);

    const applyDraft = (d) => {
        const st = d.state || {};
        if (st.selectedExamPattern) setSelectedExamPattern(st.selectedExamPattern);
        if (st.selectedSubject) setSelectedSubject(st.selectedSubject);
        if (st.selectedClass) setSelectedClass(st.selectedClass);
        if (st.examTitle !== undefined) setExamTitle(st.examTitle);
        if (st.fetchMode) setFetchMode(st.fetchMode);
        if (Array.isArray(st.selectedChapters)) setSelectedChapters(st.selectedChapters);
        if (Array.isArray(st.selectedConcepts)) setSelectedConcepts(st.selectedConcepts);
        if (st.chapterQuotas) setChapterQuotas(st.chapterQuotas);
        if (st.targetQuestionCount) setTargetQuestionCount(st.targetQuestionCount);
        if (st.typeAllocations) setTypeAllocations(st.typeAllocations);
        if (st.difficultyDistribution) setDifficultyDistribution(st.difficultyDistribution);
        if (Array.isArray(st.selectedQuestions)) setSelectedQuestions(st.selectedQuestions);
        if (st.savedPaperId) setSavedPaperId(st.savedPaperId);
        if (st.currentStep) setCurrentStep(st.currentStep);
        lastSent.current = JSON.stringify(st);
        setDraftOffer(null);
        setDraftReady(true);
        setDraftRestoredTick(n => n + 1);
    };
    const discardDraft = async () => { await clearDraft(); setDraftOffer(null); setDraftReady(true); };

    // after a draft is restored, load the chapters / concepts of its subject so the later steps have their lists
    useEffect(() => {
        if (draftRestoredTick > 0 && selectedSubject) fetchMetadata(selectedSubject);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftRestoredTick]);

    // keep the draft up to date (debounced) ...
    useEffect(() => {
        if (!draftEnabled || !draftReady || !hasProgress(draftSnapshot)) return undefined;
        pending.current = draftSnapshot;
        clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => { sendDraft(draftSnapshot); pending.current = null; }, 1500);
        return () => clearTimeout(draftTimer.current);
    }, [draftSnapshot, draftEnabled, draftReady, sendDraft]);

    // ... and flush at once when the tab is hidden or closed
    useEffect(() => {
        const flush = () => { if (pending.current && draftEnabled && draftReady) { clearTimeout(draftTimer.current); sendDraft(pending.current, true); pending.current = null; } };
        const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', flush);
        return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); };
    }, [draftEnabled, draftReady, sendDraft]);

    // what the left column shows: a line under each finished step, and the "your paper" card
    const stepSummaries = {
        1: [selectedExamPattern, selectedSubject].filter(Boolean).join(' · '),
        2: selectedChapters.length ? `${selectedChapters.length} chapter${selectedChapters.length > 1 ? 's' : ''}` : '',
        3: selectedConcepts.length ? `${selectedConcepts.length} concept${selectedConcepts.length > 1 ? 's' : ''}` : 'All concepts',
        4: totalChapterQuestions ? `${totalChapterQuestions} questions` : '',
        5: totalTypeQuestions ? `${totalTypeQuestions} by type` : '',
        6: selectedQuestions && selectedQuestions.length ? `${selectedQuestions.length} picked` : '',
        7: '',
    };
    const sidebarSteps = wizardSteps.map(st => ({ ...st, summary: stepSummaries[st.step] }));
    const sidebarQuestions = (selectedQuestions && selectedQuestions.length) || (currentStep >= 5 ? totalChapterQuestions : 0) || (currentStep === 4 ? totalChapterQuestions : 0);
    const sidebarSummary = {
        exam: selectedExamPattern,
        subject: selectedSubject,
        cls: selectedClass === 'Both' ? 'Class 11 + 12' : (selectedClass ? `Class ${selectedClass}` : ''),
        chapters: selectedChapters.length,
        questions: sidebarQuestions,
        marks: sidebarQuestions * (patternConfig.marksPerQ || 0),
    };

    return (
        <MotionRoot>
        <div className="min-h-screen flex flex-col font-sans">
            {/* Top bar: back, where you are, and the quick-jump hint. Progress lives in the left column. */}
            <header className={`no-print ${embedded ? 'mb-5' : 'glass sticky top-0 z-40 border-x-0 border-t-0 rounded-none'}`}>
                <div className={`${embedded ? 'w-full' : 'max-w-[1400px] mx-auto px-4 md:px-8 py-3'} flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => currentStep > 1 ? handleBackStep() : navigate(homePath)}
                            className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#1e1b4b] hover:border-slate-300 flex items-center justify-center cursor-pointer"
                            aria-label={currentStep > 1 ? 'Previous step' : 'Back'}
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="min-w-0">
                            <p className="eyebrow">Exam generator</p>
                            <h1 className="text-base sm:text-lg font-extrabold text-[#1e1b4b] truncate">{examTitle ? examTitle : 'Question Paper Generator'}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                    {draftEnabled && draftReady && draftStatus !== 'idle' && (
                        <span className={`hidden md:inline-flex items-center gap-1.5 text-xs font-semibold ${draftStatus === 'error' ? 'text-red-700' : 'text-slate-600'}`} role="status">
                            <span className={`w-2 h-2 rounded-full ${draftStatus === 'saved' ? 'bg-emerald-500' : draftStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`} />
                            {draftStatus === 'saved' ? 'Draft saved' : draftStatus === 'saving' ? 'Saving draft…' : 'Draft not saved — will retry'}
                        </span>
                    )}
                    <button type="button" onClick={() => setPaletteOpen(true)}
                        className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:text-[#1e1b4b] hover:border-slate-300 cursor-pointer">
                        <Command size={14} /> Quick jump <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px]">Ctrl K</kbd>
                    </button>
                    </div>
                </div>
            </header>

            {/* Centered Step-Transition Loader (Centered on screen, never persists after load) */}
            <StatusIsland status={stepLoading ? { state: 'working', message: loadingMessage || 'Loading…' } : island.status} />
            <PaperSeal show={sealShow} onDone={() => setSealShow(false)} />
            {draftOffer && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm no-print">
                    <div role="alertdialog" aria-label="Continue your unfinished paper" className="w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 p-6">
                        <div className="flex items-start gap-3.5">
                            <span className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30"><Command size={22} /></span>
                            <div>
                                <h3 className="text-lg font-bold text-[#1e1b4b]">Continue where you left off?</h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    You have an unfinished paper{draftOffer.meta?.title ? <> — <strong>{draftOffer.meta.title}</strong></> : ''}
                                    {draftOffer.meta?.step ? `, at step ${draftOffer.meta.step}` : ''}{draftOffer.meta?.questions ? ` with ${draftOffer.meta.questions} questions picked` : ''}.
                                    {draftOffer.updatedAt ? ` Last saved ${new Date(draftOffer.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2.5">
                            <button type="button" onClick={discardDraft} className="h-11 px-5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Start fresh</button>
                            <button type="button" onClick={() => applyDraft(draftOffer)} className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer">Continue</button>
                        </div>
                    </div>
                </div>
            )}
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={paletteCommands} />
            <AnimatePresence>
                {!stepLoading && (currentStep === 4 || currentStep === 5) && fetchMode === 'auto' && (
                    <BalanceDock
                        count={currentStep === 4 ? totalChapterQuestions : totalTypeQuestions}
                        target={currentStep === 4 ? (targetQuestionCount || 0) : totalChapterQuestions}
                        marksPerQ={patternConfig.marksPerQ}
                    />
                )}
            </AnimatePresence>

            <div className="w-full max-w-[1400px] mx-auto lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:items-start">
            <StepSidebar steps={sidebarSteps} position={wizardPos} onSelect={setCurrentStep} summary={sidebarSummary} />
            <main className="min-w-0 w-full p-4 md:p-8 lg:px-0 space-y-6 pb-28">
                <StepTransition stepKey={currentStep} direction={stepDirection} className="space-y-6">

                {/* ----------------------------------------------------------------
                    STEP 1: SUBJECT SELECTION (NEET: PCBZ, JEE: PCM, CET: PCMB, CUSTOM)
                ---------------------------------------------------------------- */}
                {currentStep === 1 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="text-center max-w-2xl mx-auto space-y-2">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Step {wizardPos + 1} of {wizardSteps.length}
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
                        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))' }}>
                            {['NEET', 'JEE', 'CET', 'ASSIGNMENT'].map(patternKey => {
                                const pattern = EXAM_PATTERNS[patternKey];
                                const isSelected = selectedExamPattern === pattern.id;
                                return (
                                    <div
                                        key={pattern.id}
                                        onClick={() => setSelectedExamPattern(pattern.id)}
                                        className={`bg-white rounded-3xl p-6 border-2 transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${
                                            isSelected ? 'border-indigo-400 ring-4 ring-indigo-400/20' : 'border-slate-200 hover:border-slate-300'
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
                                            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }}>
                                                {pattern.subjects.map(sub => (
                                                    <button
                                                        key={sub}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectSubjectBlock(sub, pattern.id);
                                                        }}
                                                        className="bg-navy/5 hover:bg-navy hover:text-gold text-navy text-xs font-black py-2.5 px-3 rounded-xl transition text-center border border-navy/10 shadow-2xs cursor-pointer flex items-center justify-between gap-1.5 min-w-0"
                                                    >
                                                        <span className="min-w-0 break-words">{sub}</span>
                                                        <span className="text-xs shrink-0">→</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Mode Choice Modal right after subject block is clicked */}
                        {showModeModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in no-print">
                                <div className="bg-white rounded-3xl shadow-2xl border-2 border-navy w-full max-w-xl p-6 md:p-8 animate-scale-in space-y-6">
                                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                                        <div>
                                            <span className="bg-gold text-navy text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                                {selectedSubject} &bull; {selectedExamPattern}
                                            </span>
                                            <h3 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                                Choose Question Acquisition Mode
                                            </h3>
                                            <p className="text-xs text-slate-500 font-medium mt-1">
                                                Select how you would like to source questions for this examination.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setShowModeModal(false); setCurrentStep(2); }}
                                            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Auto Fetch Card */}
                                        <div
                                            onClick={() => handleConfirmMode('auto')}
                                            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-gold hover:bg-amber-50/40 transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-lg"
                                        >
                                            <div>
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                                                    <Zap className="w-6 h-6 fill-indigo-500" />
                                                </div>
                                                <h4 className="text-base font-black text-navy mb-1 group-hover:text-gold transition">
                                                    ⚡ Auto Fetch Mode
                                                </h4>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                                    Specify chapter quotas and question type breakdowns. The system automatically balances, samples, and generates your paper.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="mt-4 w-full bg-navy group-hover:bg-gold text-gold group-hover:text-navy text-xs font-black uppercase tracking-wider py-2 rounded-xl transition cursor-pointer"
                                            >
                                                Use Auto Fetch →
                                            </button>
                                        </div>

                                        {/* Manual Fetch Card */}
                                        <div
                                            onClick={() => handleConfirmMode('manual')}
                                            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-gold hover:bg-amber-50/40 transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-lg"
                                        >
                                            <div>
                                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-navy flex items-center justify-center mb-3 group-hover:scale-110 transition">
                                                    <Edit3 className="w-6 h-6 text-navy" />
                                                </div>
                                                <h4 className="text-base font-black text-navy mb-1 group-hover:text-gold transition">
                                                    ✏️ Manual Fetch Mode
                                                </h4>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                                    Hand-pick every single question. Filter by chapter, concept, difficulty (Easy/Med/Hard), and question type (MTF, AR, MCQ).
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="mt-4 w-full bg-navy group-hover:bg-gold text-gold group-hover:text-navy text-xs font-black uppercase tracking-wider py-2 rounded-xl transition cursor-pointer"
                                            >
                                                Use Manual Fetch →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ----------------------------------------------------------------
                    STEP 2: CHAPTER SELECTION
                ---------------------------------------------------------------- */}
                {currentStep === 2 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Step {wizardPos + 1} of {wizardSteps.length}
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Chapter Selection &bull; {selectedSubject}
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Select syllabus chapters strictly belonging to {selectedSubject}. ({selectedChapters.length} Selected)
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Acquisition Mode Switcher right after Subject Selection as shown in Image 1 */}
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setFetchMode('auto')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                                            fetchMode === 'auto' ? 'bg-navy text-gold shadow-md ring-2 ring-gold/40' : 'text-slate-600 hover:text-navy'
                                        }`}
                                        title="Automatically balance and sample questions based on chapter quotas and question types"
                                    >
                                        <Zap className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
                                        <span>Auto Fetch</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFetchMode('manual')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                                            fetchMode === 'manual' ? 'bg-navy text-gold shadow-md ring-2 ring-gold/40' : 'text-slate-600 hover:text-navy'
                                        }`}
                                        title="Hand-pick questions with chapter, concept, difficulty & type filters"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Manual Fetch</span>
                                    </button>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 max-h-[62vh] overflow-y-auto pr-2">
                            {isMetadataLoading ? (
                                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                                    <Loader text={`Loading ${selectedSubject} chapters...`} />
                                </div>
                            ) : availableChapters.length === 0 ? (
                                <div className="col-span-full py-16 text-center text-slate-400 font-bold">
                                    No chapters found for ${selectedSubject}.
                                </div>
                            ) : (
                                availableChapters
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
                                            <span className="text-[13px] font-bold leading-snug line-clamp-2">{ch}</span>
                                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black ${
                                                isChecked ? 'bg-gold text-navy shadow-xs' : 'border border-slate-300 text-transparent'
                                            }`}>
                                                {isChecked ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                                            </span>
                                        </div>
                                    );
                                }))}
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

                {/* ----------------------------------------------------------------
                    STEP 3: CONCEPT / SUB-TOPIC SELECTION
                ---------------------------------------------------------------- */}
                {currentStep === 3 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Step {wizardPos + 1} of {wizardSteps.length}
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 max-h-[62vh] overflow-y-auto pr-2">
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
                                                <span className="text-[13px] font-bold leading-snug line-clamp-2">{cpt.name}</span>
                                                {cpt.chapter && (
                                                    <span className="text-[9px] text-slate-400 font-bold block truncate">{cpt.chapter}</span>
                                                )}
                                            </div>
                                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                                isChecked ? 'bg-gold text-navy shadow-xs' : 'border border-slate-300 text-transparent'
                                            }`}>
                                                {isChecked ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
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
                                    if (fetchMode === 'manual') {
                                        loadManualCandidates();
                                        setCurrentStep(6); // Proceed to Step 6: Manual Question Selection
                                    } else {
                                        handleDistributeEvenly();
                                        setCurrentStep(4); // Proceed to Step 4: Questions per Chapter
                                    }
                                }}
                                className="bg-navy hover:bg-navy/90 text-gold font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                            >
                                <span>{fetchMode === 'manual' ? 'Proceed to Question Selection (Step 4) →' : 'Proceed to Questions per Chapter (Step 4) →'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ----------------------------------------------------------------
                    STEP 4: NUMBER OF QUESTIONS FROM EACH CHAPTER (UNLIMITED)
                ---------------------------------------------------------------- */}
                {currentStep === 4 && fetchMode === 'auto' && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Step {wizardPos + 1} of {wizardSteps.length}
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Questions From Each Chapter
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Specify how many questions required from each chosen chapter. Add any question count - not limited to 60 questions.
                                </p>
                            </div>

                            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-2 px-3 shadow-2xs">
                                <label className="text-xs font-black text-navy whitespace-nowrap">
                                    Total Questions Desired:
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={targetQuestionCount}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        setTargetQuestionCount(raw === '' ? '' : (parseInt(raw, 10) || 0));
                                    }}
                                    onBlur={() => {
                                        if (targetQuestionCount === '' || isNaN(targetQuestionCount) || Number(targetQuestionCount) < 1) {
                                            setTargetQuestionCount(totalChapterQuestions > 0 ? totalChapterQuestions : (patternConfig.defaultTotal || 45));
                                        }
                                    }}
                                    className="w-20 text-center font-black text-xs py-1.5 px-2 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-gold text-navy"
                                    placeholder="e.g. 25, 50"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleDistributeEvenly(targetQuestionCount)}
                                    className="bg-navy hover:bg-navy/90 text-gold text-xs font-black px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap"
                                >
                                    Distribute Evenly
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
                                            className="w-9 h-9 rounded-xl bg-white border border-slate-300 text-navy flex items-center justify-center shadow-xs hover:bg-navy hover:text-gold hover:border-navy active:scale-90 transition cursor-pointer" aria-label="Fewer questions"
                                        >
                                            <Minus size={16} strokeWidth={3} />
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            value={chapterQuotas[ch] !== undefined ? chapterQuotas[ch] : 0}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                setChapterQuotas(prev => ({
                                                    ...prev,
                                                    [ch]: raw === '' ? '' : (parseInt(raw, 10) || 0)
                                                }));
                                            }}
                                            onBlur={() => {
                                                if (chapterQuotas[ch] === '' || isNaN(chapterQuotas[ch])) {
                                                    setChapterQuotas(prev => ({ ...prev, [ch]: 0 }));
                                                }
                                            }}
                                            className="w-16 text-center font-black text-sm py-1 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-gold"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setChapterQuotas(prev => ({ ...prev, [ch]: (parseInt(prev[ch]) || 0) + 1 }))}
                                            className="w-9 h-9 rounded-xl bg-white border border-slate-300 text-navy flex items-center justify-center shadow-xs hover:bg-navy hover:text-gold hover:border-navy active:scale-90 transition cursor-pointer" aria-label="More questions"
                                        >
                                            <Plus size={16} strokeWidth={3} />
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

                {/* ----------------------------------------------------------------
                    STEP 5: FROM EACH TYPE HOW MANY QUESTIONS (DYNAMIC BALANCING)
                ---------------------------------------------------------------- */}
                {currentStep === 5 && fetchMode === 'auto' && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        <div className="border-b border-slate-100 pb-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                        Step {wizardPos + 1} of {wizardSteps.length}
                                    </span>
                                    <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                        Questions From Each Question Type
                                    </h2>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">
                                        Allocate how many questions for each type. Auto-fetch strictly adheres to these numbers ({totalChapterQuestions} total).
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={setAllMCQPreset}
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1.5"
                                    >
                                        <Target className="w-4 h-4 text-white" /> 100% Single Correct MCQs ({totalChapterQuestions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={setBalancedMixPreset}
                                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-slate-200"
                                    >
                                        <Scale className="w-4 h-4 text-slate-600" /> Mixed Format
                                    </button>
                                </div>
                            </div>
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
                                            className="w-9 h-9 rounded-xl bg-white border border-slate-300 text-navy flex items-center justify-center shadow-xs hover:bg-navy hover:text-gold hover:border-navy active:scale-90 transition cursor-pointer" aria-label="Fewer questions"
                                        >
                                            <Minus size={16} strokeWidth={3} />
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            value={typeAllocations[item.key] !== undefined ? typeAllocations[item.key] : 0}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const val = raw === '' ? '' : Math.max(0, parseInt(raw, 10) || 0);
                                                setTypeAllocations(prev => ({ ...prev, [item.key]: val }));
                                            }}
                                            onBlur={() => {
                                                if (typeAllocations[item.key] === '' || isNaN(typeAllocations[item.key])) {
                                                    setTypeAllocations(prev => ({ ...prev, [item.key]: 0 }));
                                                }
                                            }}
                                            className="w-14 text-center font-black text-sm text-navy py-1 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-gold"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleTypeCountChange(item.key, 1)}
                                            className="w-9 h-9 rounded-xl bg-white border border-slate-300 text-navy flex items-center justify-center shadow-xs hover:bg-navy hover:text-gold hover:border-navy active:scale-90 transition cursor-pointer" aria-label="More questions"
                                        >
                                            <Plus size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Difficulty Level Distribution */}
                        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-navy uppercase tracking-wider">Difficulty Distribution</h4>
                                <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                                    difficultyDistribution.easy + difficultyDistribution.medium + difficultyDistribution.hard === 100
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                    Total: {difficultyDistribution.easy + difficultyDistribution.medium + difficultyDistribution.hard}%
                                    {difficultyDistribution.easy + difficultyDistribution.medium + difficultyDistribution.hard !== 100 && ' (Must equal 100%)'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { key: 'easy', label: 'Easy', color: 'emerald' },
                                    { key: 'medium', label: 'Medium', color: 'amber' },
                                    { key: 'hard', label: 'Hard', color: 'red' },
                                ].map(({ key, label, color }) => (
                                    <div key={key} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3 text-center`}>
                                        <label className={`text-[10px] font-black text-${color}-800 uppercase tracking-wider block mb-1.5`}>{label}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={difficultyDistribution[key] !== undefined ? difficultyDistribution[key] : ''}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                if (raw === '') {
                                                    setDifficultyDistribution(prev => ({ ...prev, [key]: '' }));
                                                } else {
                                                    handleDifficultyChange(key, raw);
                                                }
                                            }}
                                            onBlur={() => {
                                                if (difficultyDistribution[key] === '' || isNaN(difficultyDistribution[key])) {
                                                    handleDifficultyChange(key, 0);
                                                }
                                            }}
                                            className={`w-full text-center font-black text-lg py-1.5 border-2 border-${color}-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-${color}-400`}
                                        />
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={difficultyDistribution[key]}
                                            onChange={(e) => handleDifficultyChange(key, e.target.value)}
                                            className="w-full mt-1.5 cursor-pointer accent-current"
                                            style={{ accentColor: color === 'emerald' ? '#10b981' : color === 'amber' ? '#6366f1' : '#ef4444' }}
                                        />
                                        <span className={`text-[10px] font-bold text-${color}-700`}>
                                            ~{Math.round((difficultyDistribution[key] / 100) * totalTypeQuestions)} Qs
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold">Questions will be fetched matching this difficulty distribution. Sliders auto-balance to 100%.</p>
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
                                onClick={() => executeFetch()}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-8 py-3 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
                            >
                                <Zap className="w-4 h-4 text-indigo-300 fill-indigo-300" />
                                <span>Execute Auto Fetch & Preview →</span>
                            </button>
                        </div>

                         {/* Fetch Error Banner */}
                         {fetchError && (
                             <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                                 <span className="text-red-500 text-lg flex-shrink-0">&#9888;&#65039;</span>
                                 <div className="flex-1">
                                     <p className="text-xs font-bold text-red-700 mb-1">Fetch Failed</p>
                                     <p className="text-xs text-red-600">{fetchError}</p>
                                     <button
                                         type="button"
                                         onClick={() => { setFetchError(null); executeFetch(); }}
                                         className="mt-2 text-xs font-bold text-red-700 underline cursor-pointer hover:text-red-900"
                                     >
                                         Retry Now
                                     </button>
                                 </div>
                                 <button
                                     type="button"
                                     onClick={() => setFetchError(null)}
                                     className="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0"
                                 >
                                     <X className="w-4 h-4" />
                                 </button>
                             </div>
                         )}
                    </div>
                )}

                {/* ----------------------------------------------------------------
                    STEP 6: MANUAL QUESTION SELECTOR (FILTER BY CHAPTER, CONCEPT, DIFFICULTY & TYPE)
                ---------------------------------------------------------------- */}
                {currentStep === 6 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-fade-in">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Step {wizardPos + 1} of {wizardSteps.length}
                                </span>
                                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mt-2">
                                    Manual Question Selection &bull; {selectedSubject}
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                    Hand-pick questions from your selected syllabus. Filter by chapter, concept, difficulty and question type.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>{selectedQuestions.length} Questions Selected</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={handleDoneManualSelection}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>Done Selection →</span>
                                </button>
                            </div>
                        </div>

                        {/* Top Filter Bar: Chapter, Concept, Difficulty (Easy/Medium/Hard) and Question Type Dropdown */}
                        <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* 1. Chapter Dropdown */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">
                                        Chapter
                                    </label>
                                    <select
                                        value={manualFilterChapter}
                                        onChange={(e) => {
                                            setManualFilterChapter(e.target.value);
                                            setManualFilterConcept('all');
                                        }}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
                                    >
                                        <option value="all">All Selected Chapters ({selectedChapters.length})</option>
                                        {selectedChapters.map((ch, idx) => (
                                            <option key={idx} value={ch}>{ch}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 2. Concept Dropdown */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">
                                        Concept / Sub-Topic
                                    </label>
                                    <select
                                        value={manualFilterConcept}
                                        onChange={(e) => setManualFilterConcept(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
                                    >
                                        <option value="all">All Concepts ({availableFilterConcepts.length})</option>
                                        {availableFilterConcepts.map((cpt, idx) => (
                                            <option key={idx} value={cpt}>{cpt}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 3. Difficulty Filter (Easy / Medium / Hard) */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">
                                        Difficulty Level
                                    </label>
                                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300">
                                        {[
                                            { key: 'all', label: 'All' },
                                            { key: 'easy', label: 'Easy' },
                                            { key: 'medium', label: 'Med' },
                                            { key: 'hard', label: 'Hard' },
                                        ].map(d => (
                                            <button
                                                key={d.key}
                                                type="button"
                                                onClick={() => setManualFilterDifficulty(d.key)}
                                                className={`flex-1 py-1 text-[11px] font-black rounded-lg transition text-center cursor-pointer ${
                                                    manualFilterDifficulty === d.key
                                                        ? 'bg-navy text-gold shadow-xs'
                                                        : 'text-slate-600 hover:text-navy hover:bg-slate-100'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 4. Question Type Dropdown */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-navy mb-1.5">
                                        Question Type
                                    </label>
                                    <select
                                        value={manualFilterType}
                                        onChange={(e) => setManualFilterType(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
                                    >
                                        <option value="all">All Question Types</option>
                                        <option value="match">Match the Following (MTF)</option>
                                        <option value="ar">Assertion & Reason (AR)</option>
                                        <option value="mcq">Standard MCQ (Single Correct)</option>
                                        <option value="stmt">Statement Based</option>
                                        <option value="diag">Diagram Based</option>
                                        {patternConfig.supportsNumerical && (
                                            <option value="numerical">Numerical / Section B (JEE)</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Search and Secondary Filter Row */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200">
                                <div className="relative w-full sm:w-80">
                                    <input
                                        type="text"
                                        placeholder="Search questions by text or keywords..."
                                        value={manualSearch}
                                        onChange={(e) => setManualSearch(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-navy outline-none focus:ring-2 focus:ring-gold bg-white"
                                    />
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setManualShowSelectedOnly(prev => !prev)}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 border ${
                                            manualShowSelectedOnly
                                                ? 'bg-amber-100 text-amber-900 border-indigo-300 shadow-xs'
                                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Show Selected Only ({selectedQuestions.length})</span>
                                    </button>
                                    {selectedQuestions.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedQuestions([])}
                                            className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 transition cursor-pointer"
                                        >
                                            Clear Selection
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Question Pool Cards */}
                        {manualLoading ? (
                            <div className="p-12 text-center">
                                <Loader message="Loading questions repository for your selection..." />
                            </div>
                        ) : filteredManualQuestions.length === 0 ? (
                            <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
                                <div className="text-3xl">🔍</div>
                                <h4 className="text-sm font-black text-navy uppercase">No questions match your current filters</h4>
                                <p className="text-xs text-slate-500 font-medium">
                                    Try choosing &quot;All Types&quot;, &quot;All Levels&quot;, or clearing the search query to view more questions.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setManualFilterChapter('all');
                                        setManualFilterConcept('all');
                                        setManualFilterDifficulty('all');
                                        setManualFilterType('all');
                                        setManualSearch('');
                                        setManualShowSelectedOnly(false);
                                    }}
                                    className="mt-3 bg-navy text-gold text-xs font-bold px-4 py-2 rounded-xl hover:bg-navy/90 transition cursor-pointer"
                                >
                                    Reset All Filters
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2">
                                <div className="text-[11px] font-bold text-slate-500 px-1 flex justify-between items-center">
                                    <span>Showing {filteredManualQuestions.length} candidate questions</span>
                                    <span>Click any question card to select / unselect</span>
                                </div>
                                {filteredManualQuestions.map((q, idx) => {
                                    const qId = q._id || q.id;
                                    const isSelected = selectedQuestions.some(sq => (sq._id || sq.id) === qId);
                                    const cat = getQCategory(q, selectedExamPattern === 'JEE');
                                    const lvl = (q.level || 'medium').toLowerCase();

                                    const typeBadgeText = {
                                        match: 'MTF (Match)',
                                        ar: 'Assertion-Reason',
                                        stmt: 'Statement',
                                        diag: 'Diagram',
                                        numerical: 'Numerical',
                                        mcq: 'MCQ'
                                    }[cat] || 'MCQ';

                                    const typeBadgeClass = {
                                        match: 'bg-purple-100 text-purple-900 border-purple-200',
                                        ar: 'bg-indigo-100 text-indigo-900 border-indigo-200',
                                        stmt: 'bg-blue-100 text-blue-900 border-blue-200',
                                        diag: 'bg-teal-100 text-teal-900 border-teal-200',
                                        numerical: 'bg-emerald-100 text-emerald-900 border-emerald-200',
                                        mcq: 'bg-slate-100 text-slate-800 border-slate-200'
                                    }[cat] || 'bg-slate-100 text-slate-800 border-slate-200';

                                    const levelBadgeClass = {
                                        easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                        medium: 'bg-amber-50 text-amber-700 border-amber-200',
                                        hard: 'bg-rose-50 text-rose-700 border-rose-200'
                                    }[lvl] || 'bg-amber-50 text-amber-700 border-amber-200';

                                    return (
                                        <div
                                            key={qId || idx}
                                            onClick={() => {
                                                setSelectedQuestions(prev => {
                                                    const exists = prev.some(sq => (sq._id || sq.id) === qId);
                                                    if (exists) return prev.filter(sq => (sq._id || sq.id) !== qId);
                                                    return [...prev, q];
                                                });
                                            }}
                                            className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start justify-between gap-4 select-none ${
                                                isSelected
                                                    ? 'bg-amber-50/60 border-gold shadow-md ring-2 ring-gold/30'
                                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[11px] font-black text-slate-400">
                                                        #{idx + 1}
                                                    </span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${typeBadgeClass}`}>
                                                        {typeBadgeText}
                                                    </span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${levelBadgeClass}`}>
                                                        {lvl}
                                                    </span>
                                                    {q.chapter && (
                                                        <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                                                            {q.chapter}
                                                        </span>
                                                    )}
                                                    {q.concept && (
                                                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">
                                                            &bull; {q.concept}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="text-xs font-semibold text-slate-900 leading-relaxed">
                                                    <MathRenderer inline text={q.questionText || q.question || ''} />
                                                </div>

                                                {q.imageUrl && (
                                                    <div className="my-2">
                                                        <img
                                                            src={q.imageUrl}
                                                            alt="Diagram"
                                                            className="max-h-28 rounded-lg border border-slate-200 object-contain bg-white p-1"
                                                        />
                                                    </div>
                                                )}

                                                {/* Options preview if available */}
                                                {Array.isArray(q.options) && q.options.length > 0 && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-700">
                                                        {q.options.map((opt, oIdx) => {
                                                            const optStr = typeof opt === 'object' ? (opt.text || opt.option || '') : String(opt || '');
                                                            return (
                                                                <div key={oIdx} className="flex items-baseline gap-1.5 line-clamp-1">
                                                                    <span className="font-bold text-slate-400">({oIdx + 1})</span>
                                                                    <span className="truncate"><MathRenderer inline text={cleanOptionText(optStr)} /></span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Checkbox button */}
                                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition ${
                                                isSelected ? 'bg-gold text-navy shadow-sm ring-2 ring-gold/40' : 'border-2 border-slate-300 text-slate-400 hover:border-slate-400'
                                            }`}>
                                                {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Bottom Actions */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(3)}
                                className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer flex items-center gap-1"
                            >
                                <span>← Back to Concepts</span>
                            </button>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                                    {selectedQuestions.length} questions picked
                                </span>
                                <button
                                    type="button"
                                    onClick={handleDoneManualSelection}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-8 py-3 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>Done Selection → Proceed to Preview & Save</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ----------------------------------------------------------------
                    STEP 7: PREVIEW, ALIGNMENT & MERGE EXAM
                ---------------------------------------------------------------- */}
                {currentStep === 7 && (
                    <div className="space-y-6 animate-fade-in relative pb-12">
                        <div className="text-center no-print">
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Step {wizardPos + 1} of {wizardSteps.length}
                            </span>
                        </div>

                        {/* Auto Fetch result. Shown ONLY when the paper is really short of what was asked (so a short paper is never silent);
                            a complete paper shows nothing, and the technical notes (difficulty mix, type counts, skipped rows) stay out of sight. */}
                        {fetchMode === 'auto' && generationReport && !generationReport.complete && (
                            <div className={`max-w-4xl mx-auto rounded-2xl border p-4 text-xs ${generationReport.complete && generationReport.warnings.length === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-indigo-300 text-amber-900'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <p className="font-black">
                                        {generationReport.complete
                                            ? `Generated ${generationReport.total} of ${generationReport.requestedTotal} requested questions.`
                                            : `Partial paper: ${generationReport.total} of ${generationReport.requestedTotal} requested questions were available.`}
                                    </p>
                                    <button type="button" onClick={() => setGenerationReport(null)} className="opacity-60 hover:opacity-100 cursor-pointer flex-shrink-0" aria-label="Dismiss generation summary">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {Object.entries(generationReport.chapters).map(([ch, r]) => (
                                        <span key={ch} className={`px-2 py-1 rounded-lg border font-semibold ${r.delivered < r.requested ? 'bg-white border-indigo-400 text-amber-900' : 'bg-white/70 border-emerald-200'}`}>
                                            {ch}: {r.delivered}/{r.requested}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Paginated Paper Renderer with unified SettingsPanel containing all layout controls & actions */}
                        <div className="w-full flex justify-center">
                            <PaperRenderer
                                paper={currentPaperObject}
                                activeTemplate={activeTemplate}
                                settings={settings}
                                setSettings={setSettings}
                                showSettingsPanel={true}
                                onDiagramResize={handleDiagramResize}
                                onPaperUpdated={(updatedPaper) => setSelectedQuestions(updatedPaper.questions || [])}
                                setsActive={setsActive}
                                setSetsActive={setSetsActive}
                                activeSet={activeSet}
                                setActiveSet={setActiveSet}
                                zoom={previewZoom}
                                setZoom={setPreviewZoom}
                                hideToolbar={true}
                                onBack={() => setCurrentStep(fetchMode === 'manual' ? 6 : 5)}
                                onOpenAnswerKey={() => setShowAnswerKey(true)}
                                onOpenSolutions={() => setShowSolutionGuide(true)}
                                onReshuffle={handleReshuffleQuestions}
                                onOpenMerge={handleOpenMergeModal}
                                onDownloadWord={handleDownloadWord}
                                downloadingWord={downloadingWord}
                                onPrint={handlePrint}
                                onFinalizeSave={handleSaveDraft}
                                savingPaper={savingPaper}
                            />
                        </div>
                    </div>
                )}
                </StepTransition>
            </main>
            </div>

            {/* ---------------------------------------------------------------- MODAL: ANSWER KEY ---------------------------------------------------------------- */}
            {showAnswerKey && (
                <A4AnswerKey
                    paper={currentPaperObject}
                    questions={currentPaperObject.questions}
                    startQNo={Number(settings?.startQNo) || 1}
                    setName={keySetName}
                    onClose={() => setShowAnswerKey(false)}
                />
            )}

            {/* ---------------------------------------------------------------- MODAL: SOLUTION GUIDE ---------------------------------------------------------------- */}
            {showSolutionGuide && (
                <A4SolutionKey
                    paper={currentPaperObject}
                    questions={currentPaperObject.questions}
                    startQNo={Number(settings?.startQNo) || 1}
                    setName={keySetName}
                    onClose={() => setShowSolutionGuide(false)}
                />
            )}

            {/* ---------------------------------------------------------------- MODAL: MERGE EXAM ENGINE ---------------------------------------------------------------- */}
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
        </MotionRoot>
    );
}
