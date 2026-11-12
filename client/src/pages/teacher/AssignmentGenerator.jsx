/**
 * AssignmentGenerator.jsx
 *
 * Dedicated Practice Assignment Generator:
 * - Dynamic subject & topic selection
 * - Custom question count and manual question range (e.g. Q10 to Q25)
 * - Full Question Quality Inspection: Complete question stem, diagram, and options (A, B, C, D)
 * - Review & Swap/Remove selected questions
 * - Direct Save Assignment to Department Archives (MongoDB + Supabase)
 * - True A4 Print/PDF output with embedded Analysis, Answer Key, and Solutions
 */
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS } from '../../components/PaperRenderer';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import A4AnswerKey from '../../components/A4AnswerKey';
import A4SolutionKey from '../../components/A4SolutionKey';
import ResizableDiagram from '../../components/ResizableDiagram';
import { optionLabel, getResolvedAnswerLabel } from '../../utils/sanitize';

// Helper to extract the introductory sentence of a match-the-following question
function getMatchIntroText(q) {
    const raw = q.questionText || q.question || '';
    const match = raw.match(/^([\s\S]*?)(?=(?:\n\s*|^)(?:\*\*)?(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b)/i);
    if (match && match[1].trim().length > 0) {
        return match[1].trim();
    }
    return raw;
}

// Helper component to render match the following pairs side-by-side
const QuestionMatchTable = ({ q }) => {
    const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0)
        ? q.matchPairs
        : (Array.isArray(q.column_a) && q.column_a.length > 0 && Array.isArray(q.column_b) && q.column_b.length > 0)
            ? q.column_a.map((left, idx) => ({ left, right: q.column_b[idx] || '' }))
            : [];

    if (pairs.length === 0) return null;

    const leftLabels = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'];
    const rightLabels = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'];

    return (
        <div className="my-2.5 border border-blue-200 rounded-xl overflow-hidden shadow-2xs bg-white text-xs">
            <div className="grid grid-cols-2 bg-navy text-gold font-black text-[10px] sm:text-[11px] uppercase tracking-wider px-3 py-1.5 border-b border-navy/20">
                <span>Column I / List I</span>
                <span>Column II / List II</span>
            </div>
            <div className="divide-y divide-gray-100">
                {pairs.map((p, idx) => {
                    const leftStr = typeof p === 'object' ? (p.left || '') : String(p);
                    const rightStr = typeof p === 'object' ? (p.right || '') : '';
                    if (!leftStr && !rightStr) return null;

                    return (
                        <div key={idx} className="grid grid-cols-2 px-3 py-2 text-slate-800 bg-gray-50/40 hover:bg-blue-50/30 transition">
                            <div className="flex items-start gap-1.5 pr-2">
                                <span className="font-bold text-navy flex-shrink-0 text-[11px]">{leftLabels[idx] || `${idx + 1}.`}</span>
                                <div className="min-w-0 font-medium leading-relaxed">
                                    <MathRenderer inline text={leftStr} />
                                </div>
                            </div>
                            <div className="flex items-start gap-1.5 pl-2 border-l border-gray-100">
                                <span className="font-bold text-navy flex-shrink-0 text-[11px]">{rightLabels[idx] || `(${idx + 1})`}</span>
                                <div className="min-w-0 font-medium leading-relaxed">
                                    <MathRenderer inline text={rightStr} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Helper component to render complete options for a question
const QuestionOptionsDisplay = ({ q, options = [] }) => {
    if (!options || options.length === 0) {
        const isNum = q && ((q.type || '').includes('NUM') || Boolean(q.num_answer || q.correct_option));
        if (isNum) {
            return (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-gray-100 px-2 py-0.5 rounded">
                        Numerical / Free Response
                    </span>
                    {(q.answer || q.num_answer) && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Key: {q.answer || q.num_answer}
                        </span>
                    )}
                </div>
            );
        }
        return null;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100">
            {options.map((opt, oIdx) => {
                const optText = typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '');
                const label = typeof opt === 'object' && opt.label ? opt.label : optionLabel(oIdx);

                return (
                    <div key={oIdx} className="flex items-start gap-2 text-xs text-slate-700 bg-gray-50/80 rounded-xl p-2 border border-gray-100">
                        <span className="font-black text-navy bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-[10px] flex-shrink-0">
                            ({label})
                        </span>
                        <div className="flex-1 min-w-0 font-medium">
                            <MathRenderer inline text={optText} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const AssignmentGenerator = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Assignment Metadata
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState(user?.subject || 'Physics');
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [targetCount, setTargetCount] = useState(25);
    const [startQNo, setStartQNo] = useState(1);
    // Assignment sheet details (printed on the sheet and saved with the assignment)
    const [classLevel, setClassLevel] = useState('12');
    const [marksPerQuestion, setMarksPerQuestion] = useState(1);
    const [submissionDate, setSubmissionDate] = useState('');
    const [instructionsText, setInstructionsText] = useState('Answer all the questions. Show the necessary working in the space provided or in your notebook.');
    const [showStudentDetails, setShowStudentDetails] = useState(true);
    const [endQNo, setEndQNo] = useState(null);

    // Questions Pool & Selection
    // Chapter and concept lists come from /api/questions/meta; questions are loaded per chapter, only for the chapters
    // that are ticked. The screen used to download up to 20 000 questions in one request on every visit.
    const [metaChapters, setMetaChapters] = useState([]);
    const [metaConcepts, setMetaConcepts] = useState([]);
    const [chapterPools, setChapterPools] = useState({}); // chapter -> questions
    const [loadError, setLoadError] = useState('');
    const questionsPool = useMemo(() => Object.values(chapterPools).flat(), [chapterPools]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // View Options (Full Quality View vs Compact View)
    const [fullQualityView, setFullQualityView] = useState(true);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [swappingIndex, setSwappingIndex] = useState(null);

    // Filters
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

    // Default title based on subject
    useEffect(() => {
        if (!title || title.includes('Assignment')) {
            setTitle(`${subject} Practice Assignment`);
        }
    }, [subject]);

    // Chapter / concept lists for the chosen subject and class
    const fetchMeta = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await api.get(`/api/questions/meta?subject=${encodeURIComponent(subject)}&classes=${encodeURIComponent(classLevel)}`, { timeout: 20000 });
            setMetaChapters(Array.isArray(res.data?.chapters) ? res.data.chapters : []);
            setMetaConcepts(Array.isArray(res.data?.concepts) ? res.data.concepts : []);
        } catch (err) {
            console.error('Error fetching chapters:', err);
            setLoadError('Could not load the chapter list. Please check your connection and reload.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!subject) return;
        setChapterPools({});
        setMetaChapters([]);
        setMetaConcepts([]);
        fetchMeta();
    }, [subject, classLevel]);

    // Load the questions of newly ticked chapters (already loaded chapters are kept)
    useEffect(() => {
        const missing = selectedChapters.filter(ch => !(ch in chapterPools));
        if (missing.length === 0) return;
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        Promise.all(missing.map(async (ch) => {
            try {
                const res = await api.get(
                    `/api/questions?subject=${encodeURIComponent(subject)}&classes=${encodeURIComponent(classLevel)}&chapter=${encodeURIComponent(ch)}&limit=400`,
                    { timeout: 35000 }
                );
                const qs = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
                return [ch, qs, null];
            } catch (err) {
                console.error(`Error fetching questions for ${ch}:`, err);
                return [ch, null, ch];
            }
        })).then(results => {
            if (cancelled) return;
            const failed = results.filter(r => r[2]).map(r => r[2]);
            setChapterPools(prev => {
                const next = { ...prev };
                results.forEach(([ch, qs]) => { if (qs) next[ch] = qs; });
                return next;
            });
            if (failed.length) setLoadError(`Could not load questions for: ${failed.join(', ')}. Untick and tick the chapter again to retry.`);
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [selectedChapters, subject, classLevel]);

    // Chapters and concepts
    const { distinctChapters, chapterConceptsMap } = useMemo(() => {
        const sorted = [...metaChapters].sort();
        const map = {};
        sorted.forEach(ch => { map[ch] = []; });
        metaConcepts.forEach(c => {
            const ch = c.chapter;
            const name = c.name || c.concept;
            if (ch && name && name !== 'General' && name !== ch && map[ch] && !map[ch].includes(name)) map[ch].push(name);
        });
        Object.keys(map).forEach(ch => map[ch].sort());
        return { distinctChapters: sorted, chapterConceptsMap: map };
    }, [metaChapters, metaConcepts]);

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

    // Chapter check toggling
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

    const toggleConcept = (cpt) => {
        setSelectedConcepts(prev => 
            prev.includes(cpt) ? prev.filter(c => c !== cpt) : [...prev, cpt]
        );
    };

    // Scoped pool based on checked chapters & concepts
    const scopedPool = useMemo(() => {
        return questionsPool.filter(q => {
            if (selectedChapters.length > 0 && !selectedChapters.includes(q.chapter)) return false;
            if (selectedConcepts.length > 0) {
                const cpt = q.concept || q.topic;
                if (!selectedConcepts.includes(cpt)) return false;
            }
            return true;
        });
    }, [questionsPool, selectedChapters, selectedConcepts]);

    // Filtered pool based on search and sub-filters
    const filteredQuestions = useMemo(() => {
        return scopedPool.filter(q => {
            const matchesSearch = !searchTerm ||
                (q.questionText || q.question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.chapter || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.concept || q.topic || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesChapter = !filterChapter || q.chapter === filterChapter;
            const matchesDifficulty = !filterDifficulty || (q.level || 'medium').toLowerCase() === filterDifficulty.toLowerCase();
            const matchesType = !filterType || (q.type || 'MCQ').toUpperCase() === filterType.toUpperCase();

            return matchesSearch && matchesChapter && matchesDifficulty && matchesType;
        });
    }, [scopedPool, searchTerm, filterChapter, filterDifficulty, filterType]);

    // Handle Question Click or Swap
    const handleQuestionClick = (q) => {
        const qId = q._id || q.id;

        // If swapping
        if (swappingIndex !== null) {
            setSelectedQuestions(prev => {
                const next = [...prev];
                next[swappingIndex] = q;
                return next;
            });
            setSwappingIndex(null);
            return;
        }

        setSelectedQuestions(prev => {
            const exists = prev.some(item => (item._id || item.id) === qId);
            if (exists) {
                return prev.filter(item => (item._id || item.id) !== qId);
            } else {
                if (prev.length >= targetCount) {
                    alert(`Target question limit of ${targetCount} reached. Remove or swap questions if needed.`);
                    return prev;
                }
                return [...prev, q];
            }
        });
    };

    const removeQuestionByIndex = (idx) => {
        setSelectedQuestions(prev => prev.filter((_, i) => i !== idx));
    };

    // Auto Pick Questions
    const handleAutoPick = () => {
        if (selectedChapters.length === 0) return alert('Tick at least one chapter first.');
        if (scopedPool.length === 0) return alert('No questions match the selected chapters/concepts.');
        const want = Math.min(Number(targetCount) || 0, scopedPool.length);

        // Spread the questions evenly over the ticked chapters (largest-remainder split), each chapter capped by what it
        // has; leftovers go to chapters that still have questions. A plain shuffle of the whole pool let one big chapter
        // supply most of the assignment.
        const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        const byChapter = {};
        selectedChapters.forEach(ch => { byChapter[ch] = shuffle(scopedPool.filter(q => q.chapter === ch)); });
        const chapters = selectedChapters.filter(ch => byChapter[ch].length > 0);
        const take = {};
        chapters.forEach(ch => { take[ch] = 0; });
        let left = want;
        while (left > 0) {
            const open = chapters.filter(ch => take[ch] < byChapter[ch].length);
            if (open.length === 0) break;
            const share = Math.max(1, Math.floor(left / open.length));
            for (const ch of open) {
                if (left <= 0) break;
                const add = Math.min(share, byChapter[ch].length - take[ch], left);
                take[ch] += add;
                left -= add;
            }
        }
        setSelectedQuestions(shuffle(chapters.flatMap(ch => byChapter[ch].slice(0, take[ch]))));
    };

    // Effective visible questions
    const visibleQs = useMemo(() => {
        const effectiveEnd = endQNo || (startQNo + selectedQuestions.length - 1);
        const needed = Math.max(0, effectiveEnd - startQNo + 1);
        return selectedQuestions.slice(0, needed || selectedQuestions.length);
    }, [selectedQuestions, startQNo, endQNo]);

    // Assignment paper object for renderer
    const assignmentPaper = useMemo(() => ({
        _id: 'new-assignment',
        title: title || `${subject.toUpperCase()} PRACTICE ASSIGNMENT`,
        subject,
        classes: [classLevel],
        questions: visibleQs.map(q => ({ ...q, marks: Number(marksPerQuestion) || 1 })),
        marksPerQuestion: Number(marksPerQuestion) || 1,
        totalMarks: visibleQs.length * (Number(marksPerQuestion) || 1),
        instructions: instructionsText,
        submissionDate,
        showStudentDetails,
        duration: null,
        isAssignment: true,
        startQNo,
        endQNo: endQNo || (startQNo + visibleQs.length - 1),
    }), [title, subject, classLevel, visibleQs, marksPerQuestion, instructionsText, submissionDate, showStudentDetails, startQNo, endQNo]);

    // Save Assignment to MongoDB & Supabase
    const handleSaveAssignment = async () => {
        if (visibleQs.length === 0) return alert('No questions selected. Please select questions before saving.');
        setSaving(true);
        try {
            const payload = {
                title: title || `${subject.toUpperCase()} Practice Assignment`,
                subject,
                classes: [classLevel],
                class_level: classLevel,
                instructions: instructionsText,
                total_marks: visibleQs.length * (Number(marksPerQuestion) || 1),
                metadata: {
                    marksPerQuestion: Number(marksPerQuestion) || 1,
                    submissionDate: submissionDate || null,
                    showStudentDetails,
                },
                duration: null,
                isAssignment: true,
                startQNo: startQNo || 1,
                endQNo: endQNo || (startQNo + visibleQs.length - 1),
                questions: visibleQs.map(q => q._id || q.id),
                questionObjects: visibleQs.map(q => ({ ...q, marks: Number(marksPerQuestion) || 1 })),
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
                                    showSettings ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 border-gray-300'
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
                            onPaperUpdated={(updatedPaper) => setSelectedQuestions(updatedPaper.questions || [])}
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
                                Select syllabus, review full questions & options, and save directly to Department Archives.
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
                                disabled={selectedQuestions.length === 0}
                                className="bg-navy text-gold hover:scale-105 disabled:opacity-40 disabled:pointer-events-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer"
                            >
                                <span>Preview Assignment ({selectedQuestions.length})</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>

                    {/* Swap Active Banner */}
                    {swappingIndex !== null && (
                        <div className="bg-amber-500 text-navy p-4 rounded-2xl shadow-lg border-2 border-gold flex items-center justify-between gap-3 animate-pulse">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Assignment Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Organic Chemistry Practice Sheet"
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Subject</label>
                                <input
                                    type="text"
                                    value={subject}
                                    disabled
                                    className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-navy bg-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Questions Count</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={targetCount !== undefined ? targetCount : 10}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        setTargetCount(raw === '' ? '' : (parseInt(raw, 10) || 0));
                                    }}
                                    onBlur={() => {
                                        if (targetCount === '' || isNaN(targetCount) || Number(targetCount) < 1) {
                                            setTargetCount(10);
                                        }
                                    }}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none"
                                />
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
                        </div>

                        {/* Assignment sheet details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Class</label>
                                <select
                                    value={classLevel}
                                    onChange={e => { setClassLevel(e.target.value); setSelectedChapters([]); setSelectedConcepts([]); setSelectedQuestions([]); }}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none bg-white"
                                >
                                    <option value="11">Class 11 (I PUC)</option>
                                    <option value="12">Class 12 (II PUC)</option>
                                </select>
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
                            <div className="flex items-end">
                                <label className="flex items-center gap-2 text-xs font-black text-navy uppercase tracking-wider cursor-pointer pb-3">
                                    <input type="checkbox" checked={showStudentDetails} onChange={e => setShowStudentDetails(e.target.checked)} />
                                    Print student detail lines
                                </label>
                            </div>
                            <div className="md:col-span-2 lg:col-span-4">
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Instructions to Students</label>
                                <textarea
                                    rows={2}
                                    value={instructionsText}
                                    onChange={e => setInstructionsText(e.target.value)}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none"
                                />
                            </div>
                        </div>

                        {/* Chapter Multi-Select */}
                        <div className="space-y-3 pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                    <span>📚</span> Filter Chapters ({selectedChapters.length} Selected)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedChapters([...distinctChapters])}
                                        className="text-[11px] font-bold text-navy bg-navy/10 hover:bg-navy hover:text-gold px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedChapters([]); setSelectedConcepts([]); }}
                                        className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto p-1">
                                {distinctChapters.map(ch => {
                                    const isChecked = selectedChapters.includes(ch);
                                    return (
                                        <div
                                            key={ch}
                                            onClick={() => toggleChapter(ch)}
                                            className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2.5 ${
                                                isChecked ? 'border-navy bg-blue-50/60 font-bold text-navy' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 text-xs'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}}
                                                className="w-3.5 h-3.5 text-navy rounded border-gray-300 cursor-pointer"
                                            />
                                            <span className="text-xs truncate" title={ch}>{ch}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Concepts Multi-Select */}
                        {availableConceptsForSelectedChapters.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                        <span>💡</span> Filter Concepts & Topics ({selectedConcepts.length} Selected)
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedConcepts([...new Set(availableConceptsForSelectedChapters.map(i => i.concept))])}
                                            className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-800 hover:text-white px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Select All Concepts
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedConcepts([])}
                                            className="text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto p-1">
                                    {availableConceptsForSelectedChapters.map(({ concept: cpt, chapter: ch }) => {
                                        const isChecked = selectedConcepts.includes(cpt);
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
                                                    className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 cursor-pointer"
                                                />
                                                <span className="text-xs truncate" title={cpt}>{cpt}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Question Repository & Selection Area */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                        
                        {/* Repository Toolbar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-navy uppercase tracking-tight">
                                    Question Repository ({filteredQuestions.length} in Pool)
                                </h3>
                                <p className="text-xs text-gray-500 font-bold">
                                    {selectedQuestions.length} of {targetCount} Questions Selected
                                </p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Toggle View Mode */}
                                <button
                                    onClick={() => setFullQualityView(!fullQualityView)}
                                    className="bg-slate-100 text-navy hover:bg-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-gray-300 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>{fullQualityView ? '🖼 Full Details View (Active)' : '📄 Compact View (Active)'}</span>
                                </button>

                                <button
                                    onClick={handleAutoPick}
                                    className="bg-amber-100 text-amber-900 hover:bg-amber-200 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>⚡</span> Auto Pick ({targetCount})
                                </button>

                                <button
                                    onClick={() => setShowReviewModal(true)}
                                    className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>👁</span> Review Selected ({selectedQuestions.length})
                                </button>
                            </div>
                        </div>

                        {/* Search & Sub-Filters */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                            <input
                                type="text"
                                placeholder="🔍 Search questions..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                            />
                            <select
                                value={filterChapter}
                                onChange={e => setFilterChapter(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                            >
                                <option value="">All Scoped Chapters</option>
                                {(selectedChapters.length > 0 ? selectedChapters : distinctChapters).map(ch => (
                                    <option key={ch} value={ch}>{ch}</option>
                                ))}
                            </select>
                            <select
                                value={filterDifficulty}
                                onChange={e => setFilterDifficulty(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
                            >
                                <option value="">All Difficulties</option>
                                <option value="easy">🟢 Easy</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="hard">🔴 Hard</option>
                            </select>
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-white"
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
                            <div className="p-12 text-center text-xs font-bold text-gray-400">Loading questions...</div>
                        ) : loadError ? (
                            <div role="alert" className="p-6 text-center text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-2xl">
                                {loadError}
                            </div>
                        ) : selectedChapters.length === 0 ? (
                            <div className="p-12 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                Tick one or more chapters above to load their questions.
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="p-12 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                No questions found in this filtered pool.
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                                {filteredQuestions.map((q, idx) => {
                                    const isSelected = selectedQuestions.some(sq => (sq._id || sq.id) === (q._id || q.id));
                                    const conceptName = q.concept || q.topic;
                                    const diagramImg = q.imageUrl || q.image_url;

                                    return (
                                        <div
                                            key={q._id || idx}
                                            onClick={() => handleQuestionClick(q)}
                                            className={`p-5 rounded-2xl border-2 transition cursor-pointer flex items-start gap-4 ${
                                                swappingIndex !== null
                                                    ? 'border-amber-400 bg-amber-50/60 hover:bg-amber-100 hover:border-amber-500 shadow-md'
                                                    : isSelected
                                                    ? 'border-navy bg-blue-50/40 shadow-sm ring-1 ring-navy/20'
                                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="mt-1 w-4 h-4 text-navy rounded border-gray-300 cursor-pointer flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <span className="text-[10px] font-black bg-navy text-gold px-2 py-0.5 rounded">
                                                        {q.type || 'MCQ'}
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
                                                </div>

                                                {/* Full Question Text */}
                                                <div className="text-xs font-bold text-navy leading-relaxed">
                                                    <MathRenderer inline text={getMatchIntroText(q)} />
                                                </div>

                                                {/* Match the Following Columns Table */}
                                                <QuestionMatchTable q={q} />

                                                {/* Diagram */}
                                                {diagramImg && (
                                                    <div className="mt-2.5 max-w-sm border border-gray-200 rounded-xl overflow-hidden bg-white p-2 shadow-xs">
                                                        <ResizableDiagram
                                                            src={diagramImg}
                                                            alt="Diagram"
                                                            maxWidth="100%"
                                                        />
                                                    </div>
                                                )}

                                                {/* Options when Full Quality View is enabled */}
                                                {fullQualityView && (
                                                    <QuestionOptionsDisplay q={q} options={q.options} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── MODAL: REVIEW SELECTED BASKET ── */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">
                                    Selected Basket
                                </span>
                                <h3 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">
                                    Selected Questions ({selectedQuestions.length} Questions)
                                </h3>
                                <p className="text-xs text-gray-500 font-bold">
                                    Review full quality, options, or swap/remove questions.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowReviewModal(false)}
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
                                                            Answer: ({getResolvedAnswerLabel(q)})
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="text-xs font-bold text-navy leading-relaxed">
                                                    <MathRenderer inline text={getMatchIntroText(q)} />
                                                </div>

                                                {/* Match the Following Columns Table */}
                                                <QuestionMatchTable q={q} />

                                                {diagramImg && (
                                                    <div className="mt-2 max-w-sm border border-gray-200 rounded-xl overflow-hidden bg-white p-2">
                                                        <ResizableDiagram
                                                            src={diagramImg}
                                                            alt="Diagram"
                                                            maxWidth="100%"
                                                        />
                                                    </div>
                                                )}

                                                <QuestionOptionsDisplay q={q} options={q.options} />
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0 sm:self-start">
                                                <button
                                                    onClick={() => {
                                                        setSwappingIndex(idx);
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
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-600">
                                Total: {selectedQuestions.length} Questions
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
                    paper={{ title: title || `${subject} Assignment`, subject, classes: [classLevel] }}
                    questions={visibleQs}
                    startQNo={startQNo}
                    setName="P"
                    onClose={() => setShowAnswerKeyModal(false)}
                />
            )}

            {/* ── MODAL: SOLUTIONS GUIDE (TRUE A4 VIEW, KATEX MATH, INDEPENDENT PRINT & DOWNLOAD) ── */}
            {showSolutionsModal && (
                <A4SolutionKey
                    paper={{ title: title || `${subject} Assignment`, subject, classes: [classLevel] }}
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
                paperTitle={title || `${subject} Assignment`}
                questions={visibleQs}
                examType="CET"
            />
        </div>
    );
};

export default AssignmentGenerator;
