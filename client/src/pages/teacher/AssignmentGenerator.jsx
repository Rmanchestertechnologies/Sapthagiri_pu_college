/**
 * AssignmentGenerator.jsx
 *
 * Dedicated Practice Assignment Generator:
 * - Multi-Subject selection (Physics, Chemistry, Mathematics, Biology, etc.)
 * - Dynamic Subject Order / Format Dropdown (PCM, PCMB, CBPM, etc. strictly based on selected subjects)
 * - Per-subject and per-chapter question quotas and target counts
 * - Per-subject chapter & concept filtering
 * - Full Question Quality Inspection: Complete question stem, diagram, and options (A, B, C, D)
 * - Review & Swap/Remove selected questions
 * - Direct Save Assignment to Department Archives (MongoDB + Supabase)
 * - True A4 Print/PDF output with embedded Analysis, Answer Key, and Solutions
 */

import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import QuestionPreviewCard from '../../components/question/QuestionPreviewCard';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import A4AnswerKey from '../../components/A4AnswerKey';
import A4SolutionKey from '../../components/A4SolutionKey';
import { getResolvedAnswerLabel } from '../../utils/sanitize';

const BASE_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

const SUBJECT_META_INFO = {
    Physics: { code: 'P', icon: '⚛️', color: 'border-blue-300 bg-blue-50 text-blue-900' },
    Chemistry: { code: 'C', icon: '🧪', color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
    Mathematics: { code: 'M', icon: '📐', color: 'border-purple-300 bg-purple-50 text-purple-900' },
    Biology: { code: 'B', icon: '🧬', color: 'border-amber-300 bg-amber-50 text-amber-900' },
    Botany: { code: 'B', icon: '🌿', color: 'border-green-300 bg-green-50 text-green-900' },
    Zoology: { code: 'Z', icon: '🐾', color: 'border-orange-300 bg-orange-50 text-orange-900' },
};

const getSubjectCode = (sub) => {
    const s = String(sub || '').trim();
    if (/physic/i.test(s)) return 'P';
    if (/chem/i.test(s)) return 'C';
    if (/math/i.test(s)) return 'M';
    if (/bio/i.test(s)) return 'B';
    if (/botan/i.test(s)) return 'B';
    if (/zool/i.test(s)) return 'Z';
    return s.charAt(0).toUpperCase();
};

const getSubjectIcon = (sub) => {
    return SUBJECT_META_INFO[sub]?.icon || '📘';
};

/**
 * Generate all permutations of the selected subjects for the format dropdown.
 * Strictly generates permutations using ONLY the selected subjects.
 */
const generateFormatOptions = (subs) => {
    if (!subs || subs.length === 0) return [];
    if (subs.length === 1) {
        const c = getSubjectCode(subs[0]);
        return [{ code: c, label: `${c} (${subs[0]})`, subjects: [subs[0]] }];
    }

    const permute = (arr) => {
        if (arr.length <= 1) return [arr];
        const res = [];
        for (let i = 0; i < arr.length; i++) {
            const current = arr[i];
            const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
            const remainingPerms = permute(remaining);
            for (const sp of remainingPerms) {
                res.push([current, ...sp]);
            }
        }
        return res;
    };

    const allPerms = permute(subs);
    return allPerms.map(list => {
        const code = list.map(getSubjectCode).join('');
        const label = `${code} (${list.join(' → ')})`;
        return { code, label, subjects: list };
    });
};

const AssignmentGenerator = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Available subjects for selection (including teacher's subject if custom)
    const availableSubjectsList = useMemo(() => {
        const list = [...BASE_SUBJECTS];
        if (user?.subject && !list.includes(user.subject)) {
            list.push(user.subject);
        }
        return list;
    }, [user?.subject]);

    // Subjects Selection State
    const [selectedSubjects, setSelectedSubjects] = useState(() => [user?.subject || 'Physics']);
    const [activeSubject, setActiveSubject] = useState(() => user?.subject || 'Physics');
    const [selectedFormat, setSelectedFormat] = useState(() => getSubjectCode(user?.subject || 'Physics'));

    // Assignment Metadata
    const [title, setTitle] = useState('');
    const [startQNo, setStartQNo] = useState(1);
    const [classLevel, setClassLevel] = useState('12');
    const [marksPerQuestion, setMarksPerQuestion] = useState(1);
    const [submissionDate, setSubmissionDate] = useState('');
    const [instructionsText, setInstructionsText] = useState('Answer all the questions. Show the necessary working in the space provided or in your notebook.');
    const [showStudentDetails, setShowStudentDetails] = useState(true);
    const [endQNo, setEndQNo] = useState(null);

    // Per-subject Configuration:
    // { [subject]: { chapters: string[], concepts: string[], targetCount: number, chapterQuotas: { [ch]: number }, selectedQuestions: Question[] } }
    const [subjectConfigs, setSubjectConfigs] = useState({});

    // Metadata per subject: { [subject]: { chapters: string[], concepts: { chapter: string, name: string }[] } }
    const [subjectMetas, setSubjectMetas] = useState({});

    // Question pools per subject: { [subject]: { [chapter]: Question[] } }
    const [subjectChapterPools, setSubjectChapterPools] = useState({});

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');

    // View Options (Full Quality View vs Compact View)
    const [fullQualityView, setFullQualityView] = useState(true);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [swappingIndex, setSwappingIndex] = useState(null);

    // Active Subject Search & Filters
    const [filterChapter, setFilterChapter] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [filterType, setFilterType] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Preview & Analysis Modals
    const [showPreview, setShowPreview] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
    const [showSolutionsModal, setShowSolutionsModal] = useState(false);

    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        startQNo: 1,
        endQNo: null,
        showMarks: false,
    });

    // Helper to get configuration for a subject
    const getSubConfig = useCallback((sub) => {
        return subjectConfigs[sub] || {
            chapters: [],
            concepts: [],
            targetCount: 15,
            chapterQuotas: {},
            selectedQuestions: [],
        };
    }, [subjectConfigs]);

    // Helper to update configuration for a subject
    const updateSubConfig = useCallback((sub, updater) => {
        setSubjectConfigs(prev => {
            const cur = prev[sub] || {
                chapters: [],
                concepts: [],
                targetCount: 15,
                chapterQuotas: {},
                selectedQuestions: [],
            };
            const next = typeof updater === 'function' ? updater(cur) : { ...cur, ...updater };
            return { ...prev, [sub]: next };
        });
    }, []);

    // Format permutations based strictly on selected subjects
    const formatOptions = useMemo(() => generateFormatOptions(selectedSubjects), [selectedSubjects]);

    // Ensure selectedFormat stays valid when selectedSubjects change
    useEffect(() => {
        if (!formatOptions.some(f => f.code === selectedFormat)) {
            setSelectedFormat(formatOptions[0]?.code || '');
        }
    }, [formatOptions, selectedFormat]);

    // Default title based on format / subjects
    useEffect(() => {
        const fmt = selectedFormat || selectedSubjects.map(getSubjectCode).join('');
        if (!title || title.includes('Assignment') || title.includes('Practice')) {
            setTitle(`${fmt} Practice Assignment`);
        }
    }, [selectedFormat, selectedSubjects]);

    // Toggle a subject in the selection
    const toggleSubject = (sub) => {
        setSelectedSubjects(prev => {
            if (prev.includes(sub)) {
                if (prev.length === 1) return prev; // Keep at least one subject
                const next = prev.filter(s => s !== sub);
                if (activeSubject === sub) {
                    setActiveSubject(next[0]);
                }
                return next;
            } else {
                return [...prev, sub];
            }
        });
    };

    // Load Metadata for all selected subjects
    useEffect(() => {
        selectedSubjects.forEach(sub => {
            if (!subjectMetas[sub]) {
                api.get(`/api/questions/meta?subject=${encodeURIComponent(sub)}&classes=${encodeURIComponent(classLevel)}`, { timeout: 20000 })
                    .then(res => {
                        setSubjectMetas(prev => ({
                            ...prev,
                            [sub]: {
                                chapters: Array.isArray(res.data?.chapters) ? res.data.chapters : [],
                                concepts: Array.isArray(res.data?.concepts) ? res.data.concepts : []
                            }
                        }));
                    })
                    .catch(err => console.error(`Error loading meta for ${sub}:`, err));
            }
        });
    }, [selectedSubjects, classLevel, subjectMetas]);

    // When classLevel changes, refresh metadata
    useEffect(() => {
        setSubjectMetas({});
        setSubjectChapterPools({});
    }, [classLevel]);

    // Load question pool for newly ticked chapters across all selected subjects
    useEffect(() => {
        selectedSubjects.forEach(sub => {
            const cfg = getSubConfig(sub);
            const pools = subjectChapterPools[sub] || {};
            const missing = (cfg.chapters || []).filter(ch => !(ch in pools));
            if (missing.length === 0) return;

            setLoading(true);
            setLoadError('');
            Promise.all(missing.map(async (ch) => {
                try {
                    const res = await api.get(
                        `/api/questions?subject=${encodeURIComponent(sub)}&classes=${encodeURIComponent(classLevel)}&chapter=${encodeURIComponent(ch)}&limit=400`,
                        { timeout: 35000 }
                    );
                    const qs = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
                    return [ch, qs, null];
                } catch (err) {
                    console.error(`Error fetching questions for ${sub} - ${ch}:`, err);
                    return [ch, [], ch];
                }
            })).then(results => {
                setSubjectChapterPools(prev => {
                    const curSubPools = { ...(prev[sub] || {}) };
                    results.forEach(([ch, qs]) => {
                        curSubPools[ch] = qs;
                    });
                    return { ...prev, [sub]: curSubPools };
                });
            }).finally(() => setLoading(false));
        });
    }, [selectedSubjects, subjectConfigs, classLevel, getSubConfig, subjectChapterPools]);

    // Metadata for the active subject
    const { distinctChapters, chapterConceptsMap } = useMemo(() => {
        const sorted = [...(subjectMetas[activeSubject]?.chapters || [])].sort();
        const map = {};
        sorted.forEach(ch => { map[ch] = []; });
        (subjectMetas[activeSubject]?.concepts || []).forEach(c => {
            const ch = c.chapter;
            const name = c.name || c.concept;
            if (ch && name && name !== 'General' && name !== ch && map[ch] && !map[ch].includes(name)) map[ch].push(name);
        });
        Object.keys(map).forEach(ch => map[ch].sort());
        return { distinctChapters: sorted, chapterConceptsMap: map };
    }, [subjectMetas, activeSubject]);

    const activeCfg = getSubConfig(activeSubject);
    const activeSelectedChapters = activeCfg.chapters || [];
    const activeSelectedConcepts = activeCfg.concepts || [];
    const activeTargetCount = activeCfg.targetCount !== undefined ? activeCfg.targetCount : 15;
    const activeChapterQuotas = activeCfg.chapterQuotas || {};
    const activeSelectedQuestions = activeCfg.selectedQuestions || [];

    // Available concepts for checked chapters of active subject
    const availableConceptsForSelectedChapters = useMemo(() => {
        if (activeSelectedChapters.length === 0) return [];
        const list = [];
        activeSelectedChapters.forEach(ch => {
            const cList = chapterConceptsMap[ch] || [];
            cList.forEach(c => {
                if (!list.some(item => item.concept === c && item.chapter === ch)) {
                    list.push({ concept: c, chapter: ch });
                }
            });
        });
        return list;
    }, [activeSelectedChapters, chapterConceptsMap]);

    // Chapter check toggling for active subject
    const toggleChapter = (ch) => {
        updateSubConfig(activeSubject, cur => {
            const chs = cur.chapters || [];
            if (chs.includes(ch)) {
                const cList = chapterConceptsMap[ch] || [];
                const nextConcepts = (cur.concepts || []).filter(c => !cList.includes(c));
                const nextQuotas = { ...(cur.chapterQuotas || {}) };
                delete nextQuotas[ch];
                return {
                    ...cur,
                    chapters: chs.filter(c => c !== ch),
                    concepts: nextConcepts,
                    chapterQuotas: nextQuotas,
                };
            } else {
                return { ...cur, chapters: [...chs, ch] };
            }
        });
    };

    // Concept check toggling for active subject
    const toggleConcept = (cpt) => {
        updateSubConfig(activeSubject, cur => {
            const cpts = cur.concepts || [];
            return {
                ...cur,
                concepts: cpts.includes(cpt) ? cpts.filter(c => c !== cpt) : [...cpts, cpt]
            };
        });
    };

    // Set per-chapter question quota
    const setChapterQuota = (ch, count) => {
        updateSubConfig(activeSubject, cur => {
            const nextQuotas = { ...(cur.chapterQuotas || {}) };
            if (count === '' || count === undefined || count === null || Number(count) <= 0) {
                delete nextQuotas[ch];
            } else {
                nextQuotas[ch] = parseInt(count, 10) || 0;
            }
            return { ...cur, chapterQuotas: nextQuotas };
        });
    };

    // Scoped pool for active subject based on checked chapters & concepts
    const activeScopedPool = useMemo(() => {
        const subPool = subjectChapterPools[activeSubject] || {};
        const allQuestions = Object.values(subPool).flat();
        return allQuestions.filter(q => {
            if (activeSelectedChapters.length > 0 && !activeSelectedChapters.includes(q.chapter)) return false;
            if (activeSelectedConcepts.length > 0) {
                const cpt = q.concept || q.topic;
                if (!activeSelectedConcepts.includes(cpt)) return false;
            }
            return true;
        });
    }, [subjectChapterPools, activeSubject, activeSelectedChapters, activeSelectedConcepts]);

    // Filtered pool for active subject based on search and sub-filters
    const filteredQuestions = useMemo(() => {
        return activeScopedPool.filter(q => {
            const matchesSearch = !searchTerm ||
                (q.questionText || q.question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.chapter || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.concept || q.topic || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesChapter = !filterChapter || q.chapter === filterChapter;
            const matchesDifficulty = !filterDifficulty || (q.level || 'medium').toLowerCase() === filterDifficulty.toLowerCase();
            const matchesType = !filterType || (q.type || 'MCQ').toUpperCase() === filterType.toUpperCase();

            return matchesSearch && matchesChapter && matchesDifficulty && matchesType;
        });
    }, [activeScopedPool, searchTerm, filterChapter, filterDifficulty, filterType]);

    // Ordered subject sequence from the selected format
    const orderedSubjectList = useMemo(() => {
        const match = formatOptions.find(f => f.code === selectedFormat);
        if (match && Array.isArray(match.subjects)) return match.subjects;
        return selectedSubjects;
    }, [formatOptions, selectedFormat, selectedSubjects]);

    // Assembled questions ordered strictly by the chosen Format Order (e.g. PCM / CBPM)
    const allOrderedQuestions = useMemo(() => {
        const list = [];
        orderedSubjectList.forEach(sub => {
            const subQs = getSubConfig(sub).selectedQuestions || [];
            subQs.forEach(q => {
                list.push({
                    ...q,
                    subject: sub,
                    sectionSubject: sub,
                    marks: Number(marksPerQuestion) || 1,
                });
            });
        });
        return list;
    }, [orderedSubjectList, getSubConfig, marksPerQuestion]);

    // Handle Question Click or Swap in the active subject
    const handleQuestionClick = (q) => {
        const qId = q._id || q.id;
        const target = activeTargetCount;

        // If swapping
        if (swappingIndex !== null) {
            const targetQ = allOrderedQuestions[swappingIndex];
            if (targetQ) {
                const subOfTarget = targetQ.sectionSubject || targetQ.subject || activeSubject;
                updateSubConfig(subOfTarget, cur => {
                    const idxInSub = (cur.selectedQuestions || []).findIndex(sq => (sq._id || sq.id) === (targetQ._id || targetQ.id));
                    if (idxInSub >= 0) {
                        const next = [...cur.selectedQuestions];
                        next[idxInSub] = { ...q, subject: subOfTarget, sectionSubject: subOfTarget };
                        return { ...cur, selectedQuestions: next };
                    }
                    return cur;
                });
            }
            setSwappingIndex(null);
            return;
        }

        updateSubConfig(activeSubject, cur => {
            const prev = cur.selectedQuestions || [];
            const exists = prev.some(item => (item._id || item.id) === qId);
            if (exists) {
                return { ...cur, selectedQuestions: prev.filter(item => (item._id || item.id) !== qId) };
            } else {
                if (prev.length >= target) {
                    alert(`Target question limit of ${target} reached for ${activeSubject}. Increase target count or remove questions.`);
                    return cur;
                }
                return { ...cur, selectedQuestions: [...prev, { ...q, subject: activeSubject, sectionSubject: activeSubject }] };
            }
        });
    };

    // Remove a question by its global index in the ordered list
    const removeQuestionByIndex = (globalIdx) => {
        const qToRemove = allOrderedQuestions[globalIdx];
        if (!qToRemove) return;
        const sub = qToRemove.sectionSubject || qToRemove.subject || activeSubject;
        updateSubConfig(sub, cur => ({
            ...cur,
            selectedQuestions: (cur.selectedQuestions || []).filter(q => (q._id || q.id) !== (qToRemove._id || qToRemove.id))
        }));
    };

    // Auto Pick Questions for a single subject
    const handleAutoPickSubject = (sub) => {
        const cfg = getSubConfig(sub);
        const chs = cfg.chapters || [];
        if (chs.length === 0) return alert(`Tick at least one chapter for ${sub} first.`);

        const subPool = Object.values(subjectChapterPools[sub] || {}).flat().filter(q => {
            if (chs.length > 0 && !chs.includes(q.chapter)) return false;
            if (cfg.concepts && cfg.concepts.length > 0) {
                const cpt = q.concept || q.topic;
                if (!cfg.concepts.includes(cpt)) return false;
            }
            return true;
        });

        if (subPool.length === 0) return alert(`No questions match the selected chapters/concepts for ${sub}.`);

        const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        const quotas = cfg.chapterQuotas || {};
        const byChapter = {};
        chs.forEach(ch => { byChapter[ch] = shuffle(subPool.filter(q => q.chapter === ch)); });

        let picked = [];
        const hasQuotas = Object.keys(quotas).some(ch => quotas[ch] > 0);

        if (hasQuotas) {
            chs.forEach(ch => {
                const quota = quotas[ch] || 0;
                if (quota > 0) {
                    const pool = byChapter[ch] || [];
                    picked.push(...pool.slice(0, quota));
                }
            });
        } else {
            const want = Math.min(Number(cfg.targetCount) || 15, subPool.length);
            const activeChapters = chs.filter(ch => byChapter[ch].length > 0);
            const take = {};
            activeChapters.forEach(ch => { take[ch] = 0; });
            let left = want;
            while (left > 0) {
                const open = activeChapters.filter(ch => take[ch] < byChapter[ch].length);
                if (open.length === 0) break;
                const share = Math.max(1, Math.floor(left / open.length));
                for (const ch of open) {
                    if (left <= 0) break;
                    const add = Math.min(share, byChapter[ch].length - take[ch], left);
                    take[ch] += add;
                    left -= add;
                }
            }
            picked = activeChapters.flatMap(ch => byChapter[ch].slice(0, take[ch]));
        }

        const stamped = picked.map(q => ({ ...q, subject: sub, sectionSubject: sub }));
        updateSubConfig(sub, { selectedQuestions: stamped });
    };

    // Auto Pick for all selected subjects at once
    const handleAutoPickAllSubjects = () => {
        selectedSubjects.forEach(sub => handleAutoPickSubject(sub));
    };

    // Effective visible questions
    const visibleQs = useMemo(() => {
        const effectiveEnd = endQNo || (startQNo + allOrderedQuestions.length - 1);
        const needed = Math.max(0, effectiveEnd - startQNo + 1);
        return allOrderedQuestions.slice(0, needed || allOrderedQuestions.length);
    }, [allOrderedQuestions, startQNo, endQNo]);

    // Assignment paper object for renderer
    const assignmentPaper = useMemo(() => {
        const fmtCode = selectedFormat || selectedSubjects.map(getSubjectCode).join('');
        const displaySub = selectedSubjects.length > 1
            ? `${selectedSubjects.join(' • ')} (${fmtCode})`
            : (selectedSubjects[0] || 'Physics');

        return {
            _id: 'new-assignment',
            title: title || `${fmtCode} PRACTICE ASSIGNMENT`,
            subject: displaySub,
            classes: [classLevel],
            questions: visibleQs,
            marksPerQuestion: Number(marksPerQuestion) || 1,
            totalMarks: visibleQs.length * (Number(marksPerQuestion) || 1),
            instructions: instructionsText,
            submissionDate,
            showStudentDetails,
            duration: null,
            isAssignment: true,
            startQNo,
            endQNo: endQNo || (startQNo + visibleQs.length - 1),
        };
    }, [title, selectedSubjects, selectedFormat, classLevel, visibleQs, marksPerQuestion, instructionsText, submissionDate, showStudentDetails, startQNo, endQNo]);

    // Save Assignment to MongoDB & Supabase
    const handleSaveAssignment = async () => {
        if (visibleQs.length === 0) return alert('No questions selected. Please select questions before saving.');
        setSaving(true);
        try {
            const fmtCode = selectedFormat || selectedSubjects.map(getSubjectCode).join('');
            const payload = {
                title: title || `${fmtCode} Practice Assignment`,
                subject: selectedSubjects.join(', '),
                classes: [classLevel],
                class_level: classLevel,
                instructions: instructionsText,
                total_marks: visibleQs.length * (Number(marksPerQuestion) || 1),
                metadata: {
                    marksPerQuestion: Number(marksPerQuestion) || 1,
                    submissionDate: submissionDate || null,
                    showStudentDetails,
                    formatCode: fmtCode,
                    selectedSubjects,
                },
                duration: null,
                isAssignment: true,
                startQNo: startQNo || 1,
                endQNo: endQNo || (startQNo + visibleQs.length - 1),
                questions: visibleQs.map(q => q._id || q.id),
                questionObjects: visibleQs,
                status: user?.role === 'admin' ? 'Approved' : 'Pending Approval',
            };

            await api.post('/api/papers', payload);
            alert('✓ Assignment successfully finalized and saved! It is now visible in Department Archives / Saved Papers.');
            navigate('/teacher/dashboard/saved-papers');
        } catch (err) {
            console.error('Error saving assignment:', err);
            alert('Failed to save assignment. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            
            {/* ══════════════════════════════════════════════════════════════
                PREVIEW MODE
            ══════════════════════════════════════════════════════════════ */}
            {showPreview ? (
                <div className="space-y-6">
                    {/* Toolbar */}
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200 flex flex-wrap justify-between items-center gap-4 no-print">
                        <button
                            onClick={() => setShowPreview(false)}
                            className="bg-gray-100 text-navy hover:bg-navy hover:text-gold px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                        >
                            <span>←</span> ✏️ Back to Edit Questions
                        </button>

                        <div className="flex items-center gap-2.5 flex-wrap">
                            <button
                                onClick={() => setShowAnalysisModal(true)}
                                className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            >
                                <span>📊</span> View Analysis
                            </button>
                            <button
                                onClick={() => setShowAnswerKeyModal(true)}
                                className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            >
                                <span>🔑</span> Answer Key
                            </button>
                            <button
                                onClick={() => setShowSolutionsModal(true)}
                                className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            >
                                <span>💡</span> Solutions
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition border cursor-pointer ${
                                    showSettings ? 'bg-indigo-500 text-white' : 'bg-white text-gray-700 border-gray-300'
                                }`}
                            >
                                <span>⚙️</span> Layout Settings
                            </button>
                            <button
                                onClick={handleSaveAssignment}
                                disabled={saving}
                                className="bg-navy text-gold hover:scale-105 px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5 border border-gold"
                            >
                                <span>💾</span> {saving ? 'Saving...' : 'Save Assignment'}
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                            >
                                <span>🖨</span> Download / Print PDF
                            </button>
                        </div>
                    </div>

                    {/* Paper Renderer */}
                    <div className="w-full flex justify-center">
                        <PaperRenderer
                            paper={assignmentPaper}
                            activeTemplate={null}
                            isAssignment={true}
                            settings={{ ...settings, startQNo, endQNo }}
                            setSettings={setSettings}
                            showSettingsPanel={showSettings}
                            onPaperUpdated={(updatedPaper) => {
                                const newQs = updatedPaper.questions || [];
                                selectedSubjects.forEach(sub => {
                                    const subQs = newQs.filter(q => (q.sectionSubject || q.subject || '').toLowerCase() === sub.toLowerCase());
                                    updateSubConfig(sub, { selectedQuestions: subQs });
                                });
                            }}
                        />
                    </div>
                </div>
            ) : (
                /* ══════════════════════════════════════════════════════════════
                    BUILDER MODE (CONFIG + FULL QUALITY QUESTIONS SELECTION)
                ══════════════════════════════════════════════════════════════ */
                <div className="space-y-6">
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                        <div>
                            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                Dedicated Generator
                            </span>
                            <h2 className="text-2xl font-black text-navy mt-1 uppercase tracking-tight">Practice Assignment Studio</h2>
                            <p className="text-xs text-gray-500 font-bold mt-0.5">
                                Create single or multi-subject assignments with custom syllabus, questions count, and subject ordering.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/teacher/dashboard')}
                                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                                ← Back to Portal
                            </button>
                            <button
                                onClick={() => setShowPreview(true)}
                                disabled={allOrderedQuestions.length === 0}
                                className="bg-navy text-gold hover:scale-105 disabled:opacity-40 disabled:pointer-events-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer"
                            >
                                <span>Preview Assignment ({allOrderedQuestions.length})</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>

                    {/* Swap Active Banner */}
                    {swappingIndex !== null && (
                        <div className="bg-indigo-500 text-navy p-4 rounded-2xl shadow-lg border-2 border-gold flex items-center justify-between gap-3 animate-pulse">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🔄</span>
                                <div>
                                    <h4 className="font-black text-xs uppercase tracking-wider">
                                        Swap Mode Active: Replacing Question #{startQNo + swappingIndex}
                                    </h4>
                                    <p className="text-[11px] font-bold text-navy/80">
                                        Click any question below in the repository to replace this question.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSwappingIndex(null)}
                                className="bg-navy text-gold px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-navy/90 transition cursor-pointer"
                            >
                                ✕ Cancel Swap
                            </button>
                        </div>
                    )}

                    {/* Configuration Form */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                        
                        {/* Row 1: Title & Subjects Multi-Select */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-4">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Assignment Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. PCM Practice Assignment"
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none"
                                />
                            </div>

                            {/* Multi-Subject Selector */}
                            <div className="lg:col-span-5">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Select Subjects ({selectedSubjects.length} Active)
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {availableSubjectsList.map(sub => {
                                        const isChecked = selectedSubjects.includes(sub);
                                        const info = SUBJECT_META_INFO[sub] || { code: sub.charAt(0), icon: '📘' };
                                        return (
                                            <button
                                                key={sub}
                                                type="button"
                                                onClick={() => toggleSubject(sub)}
                                                className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 border-2 ${
                                                    isChecked
                                                        ? 'bg-navy text-gold border-navy shadow-xs'
                                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <span>{info.icon}</span>
                                                <span>{sub}</span>
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isChecked ? 'bg-gold/20 text-gold' : 'bg-gray-200 text-gray-600'}`}>
                                                    {info.code}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Subject Order / Format Dropdown */}
                            <div className="lg:col-span-3">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Question Format / Order
                                </label>
                                <select
                                    value={selectedFormat}
                                    onChange={e => setSelectedFormat(e.target.value)}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-3 py-2.5 text-xs font-bold text-navy outline-none bg-white cursor-pointer"
                                >
                                    {formatOptions.map(opt => (
                                        <option key={opt.code} value={opt.code}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Assignment Sheet Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Class</label>
                                <select
                                    value={classLevel}
                                    onChange={e => {
                                        setClassLevel(e.target.value);
                                        setSubjectConfigs({});
                                    }}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none bg-white cursor-pointer"
                                >
                                    <option value="11">Class 11 (I PUC)</option>
                                    <option value="12">Class 12 (II PUC)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Start Question No.</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={startQNo !== undefined ? startQNo : 1}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        setStartQNo(raw === '' ? '' : (parseInt(raw, 10) || 0));
                                    }}
                                    onBlur={() => {
                                        if (startQNo === '' || isNaN(startQNo) || Number(startQNo) < 1) {
                                            setStartQNo(1);
                                        }
                                    }}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Marks per Question</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={marksPerQuestion}
                                    onChange={e => setMarksPerQuestion(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    onBlur={() => { if (!marksPerQuestion || Number(marksPerQuestion) < 1) setMarksPerQuestion(1); }}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Submission Date</label>
                                <input
                                    type="date"
                                    value={submissionDate}
                                    onChange={e => setSubmissionDate(e.target.value)}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none"
                                />
                            </div>
                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-2 text-xs font-black text-navy uppercase tracking-wider cursor-pointer">
                                    <input type="checkbox" checked={showStudentDetails} onChange={e => setShowStudentDetails(e.target.checked)} />
                                    Print student detail lines
                                </label>
                            </div>
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Instructions to Students</label>
                                <textarea
                                    rows={2}
                                    value={instructionsText}
                                    onChange={e => setInstructionsText(e.target.value)}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2 text-xs font-bold text-navy outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Subject Tabs (when multiple subjects are selected) */}
                    {selectedSubjects.length > 1 && (
                        <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-gray-200 shadow-sm flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-navy uppercase tracking-wider mr-2">Configuring:</span>
                                {selectedSubjects.map(sub => {
                                    const isCurrent = activeSubject === sub;
                                    const subQsCount = (getSubConfig(sub).selectedQuestions || []).length;
                                    const subTarget = getSubConfig(sub).targetCount || 15;
                                    return (
                                        <button
                                            key={sub}
                                            type="button"
                                            onClick={() => {
                                                setActiveSubject(sub);
                                                setFilterChapter('');
                                            }}
                                            className={`px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer flex items-center gap-2 border-2 ${
                                                isCurrent
                                                    ? 'bg-navy text-gold border-navy shadow-md scale-102'
                                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <span>{getSubjectIcon(sub)}</span>
                                            <span>{sub}</span>
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                                subQsCount >= subTarget
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-amber-100 text-amber-900'
                                            }`}>
                                                {subQsCount} / {subTarget} Qs
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAutoPickAllSubjects}
                                    className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>⚡</span> Auto Pick All Subjects
                                </button>
                                <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                    Total: {allOrderedQuestions.length} Questions
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Active Subject Syllabus Configuration (Chapters, Concepts, Quotas) */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                        
                        {/* Target count for active subject */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{getSubjectIcon(activeSubject)}</span>
                                <div>
                                    <h3 className="text-base font-black text-navy uppercase tracking-tight">
                                        {activeSubject} Syllabus & Chapter Quotas
                                    </h3>
                                    <p className="text-xs text-gray-500 font-bold">
                                        Select chapters & concepts and set desired question count for {activeSubject}.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="text-xs font-black text-navy uppercase tracking-wider">
                                    Target Questions for {activeSubject}:
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={activeTargetCount}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        const val = raw === '' ? '' : (parseInt(raw, 10) || 0);
                                        updateSubConfig(activeSubject, { targetCount: val });
                                    }}
                                    onBlur={() => {
                                        if (!activeTargetCount || Number(activeTargetCount) < 1) {
                                            updateSubConfig(activeSubject, { targetCount: 15 });
                                        }
                                    }}
                                    className="w-20 border-2 border-gray-200 focus:border-navy rounded-xl px-3 py-1.5 text-xs font-bold text-navy outline-none text-center"
                                />
                            </div>
                        </div>

                        {/* Chapter Multi-Select with Per-Chapter Quota */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                    <span>📚</span> Filter Chapters for {activeSubject} ({activeSelectedChapters.length} Selected)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateSubConfig(activeSubject, { chapters: [...distinctChapters] })}
                                        className="text-[11px] font-bold text-navy bg-navy/10 hover:bg-navy hover:text-gold px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSubConfig(activeSubject, { chapters: [], concepts: [], chapterQuotas: {} })}
                                        className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-52 overflow-y-auto p-1">
                                {distinctChapters.map(ch => {
                                    const isChecked = activeSelectedChapters.includes(ch);
                                    const quota = activeChapterQuotas[ch] || '';
                                    return (
                                        <div
                                            key={ch}
                                            className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                                                isChecked ? 'border-navy bg-blue-50/60 font-bold text-navy' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 text-xs'
                                            }`}
                                        >
                                            <div
                                                onClick={() => toggleChapter(ch)}
                                                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="w-3.5 h-3.5 text-navy rounded border-gray-300 cursor-pointer flex-shrink-0"
                                                />
                                                <span className="text-xs truncate" title={ch}>{ch}</span>
                                            </div>

                                            {/* Optional Per-Chapter Quota */}
                                            {isChecked && (
                                                <div className="flex items-center gap-1 flex-shrink-0" title="Optional number of questions from this chapter">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={100}
                                                        placeholder="Qty"
                                                        value={quota}
                                                        onChange={e => setChapterQuota(ch, e.target.value)}
                                                        className="w-12 text-center text-[11px] font-bold py-0.5 px-1 bg-white border border-slate-300 rounded-md outline-none focus:ring-1 focus:ring-navy"
                                                    />
                                                    <span className="text-[10px] text-slate-500 font-bold">Qs</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Concepts Multi-Select for Active Subject */}
                        {availableConceptsForSelectedChapters.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                        <span>💡</span> Filter Concepts for {activeSubject} ({activeSelectedConcepts.length} Selected)
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateSubConfig(activeSubject, { concepts: [...new Set(availableConceptsForSelectedChapters.map(i => i.concept))] })}
                                            className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-800 hover:text-white px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Select All Concepts
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateSubConfig(activeSubject, { concepts: [] })}
                                            className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto p-1">
                                    {availableConceptsForSelectedChapters.map(({ concept: cpt, chapter: ch }) => {
                                        const isChecked = activeSelectedConcepts.includes(cpt);
                                        return (
                                            <div
                                                key={`${ch}-${cpt}`}
                                                onClick={() => toggleConcept(cpt)}
                                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2.5 ${
                                                    isChecked ? 'border-emerald-600 bg-emerald-50/60 font-bold text-emerald-900' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 text-xs'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 cursor-pointer flex-shrink-0"
                                                />
                                                <span className="text-xs truncate" title={cpt}>{cpt}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Question Repository & Selection Area for Active Subject */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                        
                        {/* Repository Toolbar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-navy uppercase tracking-tight flex items-center gap-2">
                                    <span>{getSubjectIcon(activeSubject)}</span>
                                    <span>{activeSubject} Question Repository ({filteredQuestions.length} in Pool)</span>
                                </h3>
                                <p className="text-xs text-gray-500 font-bold">
                                    {activeSelectedQuestions.length} of {activeTargetCount} Questions Selected for {activeSubject}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={() => setFullQualityView(!fullQualityView)}
                                    className="bg-slate-100 text-navy hover:bg-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-gray-300 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>{fullQualityView ? '🖼 Full Details View' : '📄 Compact View'}</span>
                                </button>

                                <button
                                    onClick={() => handleAutoPickSubject(activeSubject)}
                                    className="bg-amber-100 text-amber-900 hover:bg-amber-200 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>⚡</span> Auto Pick {activeSubject} ({activeTargetCount})
                                </button>

                                <button
                                    onClick={() => setShowReviewModal(true)}
                                    className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>👁</span> Review All Selected ({allOrderedQuestions.length})
                                </button>
                            </div>
                        </div>

                        {/* Search & Sub-Filters */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                            <input
                                type="text"
                                placeholder={`🔍 Search ${activeSubject} questions...`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                            />
                            <select
                                value={filterChapter}
                                onChange={e => setFilterChapter(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white cursor-pointer"
                            >
                                <option value="">All Scoped Chapters</option>
                                {(activeSelectedChapters.length > 0 ? activeSelectedChapters : distinctChapters).map(ch => (
                                    <option key={ch} value={ch}>{ch}</option>
                                ))}
                            </select>
                            <select
                                value={filterDifficulty}
                                onChange={e => setFilterDifficulty(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white cursor-pointer"
                            >
                                <option value="">All Difficulties</option>
                                <option value="easy">🟢 Easy</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="hard">🔴 Hard</option>
                            </select>
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white cursor-pointer"
                            >
                                <option value="">All Types</option>
                                <option value="MCQ">MCQ</option>
                                <option value="ASSERTION_REASON">Assertion & Reason</option>
                                <option value="MATCH_FOLLOWING">Match the Column</option>
                                <option value="STATEMENT_BASED">Statement Based</option>
                            </select>
                        </div>

                        {/* Questions List */}
                        {loading ? (
                            <div className="p-12 text-center text-xs font-bold text-gray-400">Loading questions repository...</div>
                        ) : loadError ? (
                            <div role="alert" className="p-6 text-center text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-2xl">
                                {loadError}
                            </div>
                        ) : activeSelectedChapters.length === 0 ? (
                            <div className="p-12 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                Tick one or more chapters for {activeSubject} above to load questions.
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="p-12 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                No questions found matching your filters for {activeSubject}.
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                                {filteredQuestions.map((q, idx) => {
                                    const isSelected = activeSelectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
                                    const conceptName = q.concept || q.topic;

                                    // Same card as the paper's parsing: statements, both match columns, A/R and diagrams always show
                                    return (
                                        <QuestionPreviewCard
                                            key={q._id || idx}
                                            q={q}
                                            number={idx + 1}
                                            selected={isSelected || swappingIndex !== null}
                                            onClick={() => handleQuestionClick(q)}
                                            hideOptions={!fullQualityView}
                                            actions={(
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 text-navy rounded border-gray-300 cursor-pointer flex-shrink-0"
                                                />
                                            )}
                                            badges={(
                                                <>
                                                    <span className="text-[10px] font-black bg-navy text-gold px-2 py-0.5 rounded">
                                                        {q.type || 'MCQ'}
                                                    </span>
                                                    <span className="text-[10px] font-black bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                                                        {getSubjectIcon(activeSubject)} {activeSubject}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-navy bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        📖 {q.chapter || 'General'}
                                                    </span>
                                                    {conceptName && conceptName !== 'General' && (
                                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                            💡 {conceptName}
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                        (q.level || 'medium').toLowerCase() === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                                                        (q.level || 'medium').toLowerCase() === 'hard' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {q.level || 'Medium'}
                                                    </span>
                                                    {swappingIndex !== null && (
                                                        <span className="text-[10px] font-black text-amber-800 bg-amber-200 px-2 py-0.5 rounded animate-pulse">
                                                            Click to Swap with Q#{startQNo + swappingIndex}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── MODAL: REVIEW SELECTED BASKET (ALL SUBJECTS) ── */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Selected Basket &bull; Order: {selectedFormat}
                                </span>
                                <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                    Selected Questions ({allOrderedQuestions.length} Questions across {selectedSubjects.length} Subjects)
                                </h3>
                                <p className="text-xs text-gray-500 font-bold">
                                    Review full quality, options, or swap/remove questions. Ordered according to {selectedFormat}.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className="text-slate/30 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border shadow transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4">
                            {allOrderedQuestions.length === 0 ? (
                                <div className="p-12 text-center text-xs font-bold text-gray-400">
                                    No questions selected yet across any subject.
                                </div>
                            ) : (
                                allOrderedQuestions.map((q, idx) => {
                                    const sub = q.sectionSubject || q.subject || 'General';

                                    return (
                                        <QuestionPreviewCard
                                            key={idx}
                                            q={q}
                                            number={startQNo + idx}
                                            showAnswer
                                            badges={(
                                                <>
                                                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded">
                                                        {getSubjectIcon(sub)} {sub}
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
                                                            Answer: ({getResolvedAnswerLabel(q)})
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            actions={(
                                                <>
                                                <button
                                                    onClick={() => {
                                                        setSwappingIndex(idx);
                                                        setActiveSubject(sub);
                                                        setShowReviewModal(false);
                                                    }}
                                                    className="bg-amber-100 text-amber-900 hover:bg-amber-200 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-xs"
                                                >
                                                    <span>🔄</span> Swap
                                                </button>
                                                <button
                                                    onClick={() => removeQuestionByIndex(idx)}
                                                    className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border border-rose-200"
                                                >
                                                    ✕ Remove
                                                </button>
                                                </>
                                            )}
                                        />
                                    );
                                })
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-600">
                                Total: {allOrderedQuestions.length} Questions across {selectedSubjects.length} Subjects
                            </span>
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className="bg-navy text-gold px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer"
                            >
                                Done Reviewing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: ANSWER KEY (TRUE A4 VIEW, DYNAMIC LABELS, INDEPENDENT PRINT & DOWNLOAD) ── */}
            {showAnswerKeyModal && (
                <A4AnswerKey
                    paper={assignmentPaper}
                    questions={visibleQs}
                    startQNo={startQNo}
                    setName="P"
                    onClose={() => setShowAnswerKeyModal(false)}
                />
            )}

            {/* ── MODAL: SOLUTIONS GUIDE (TRUE A4 VIEW, KATEX MATH, INDEPENDENT PRINT & DOWNLOAD) ── */}
            {showSolutionsModal && (
                <A4SolutionKey
                    paper={assignmentPaper}
                    questions={visibleQs}
                    startQNo={startQNo}
                    setName="P"
                    onClose={() => setShowSolutionsModal(false)}
                />
            )}

            {/* ── MODAL: ANALYSIS ── */}
            <PaperAnalysisModal
                isOpen={showAnalysisModal}
                onClose={() => setShowAnalysisModal(false)}
                paperTitle={title || `${selectedFormat} Assignment`}
                questions={visibleQs}
                examType="CET"
            />
        </div>
    );
};

export default AssignmentGenerator;
