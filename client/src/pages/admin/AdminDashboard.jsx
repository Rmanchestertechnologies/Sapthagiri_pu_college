import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { Trash2, Eye, Clock, ChevronDown, Search, AlertCircle, FilePlus2, Zap, ClipboardList, Database, Target, ArrowRight, FolderOpen, Pencil, Check, ArrowDownUp, Star, Folder, LayoutGrid, List, X, Trophy, BookOpen, BarChart3, Atom, FlaskConical, Sigma, Dna, Leaf, PawPrint } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { AnimatedNumber, SPRING } from '../../ui/motion';

const SUBJECT_ICONS = { Physics: Atom, Chemistry: FlaskConical, Mathematics: Sigma, Biology: Dna, Botany: Leaf, Zoology: PawPrint };
const SUBJECT_TONES = {
    Physics: { bar: 'from-blue-400 to-indigo-500', tile: 'bg-blue-50 text-blue-600', wash: 'from-blue-50 to-white' },
    Chemistry: { bar: 'from-emerald-400 to-teal-500', tile: 'bg-emerald-50 text-emerald-600', wash: 'from-emerald-50 to-white' },
    Mathematics: { bar: 'from-violet-400 to-purple-500', tile: 'bg-violet-50 text-violet-600', wash: 'from-violet-50 to-white' },
    Biology: { bar: 'from-rose-400 to-pink-500', tile: 'bg-rose-50 text-rose-600', wash: 'from-rose-50 to-white' },
    Botany: { bar: 'from-lime-400 to-green-500', tile: 'bg-lime-50 text-lime-700', wash: 'from-lime-50 to-white' },
    Zoology: { bar: 'from-orange-400 to-amber-500', tile: 'bg-orange-50 text-orange-600', wash: 'from-orange-50 to-white' },
};

/** A circular progress gauge that fills with a spring. */
function ProgressRing({ pct = 0, size = 64, stroke = 6, dark = false }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, pct));
    const colour = v >= 100 ? '#10b981' : '#f59e0b';
    return (
        <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${v}% complete`}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? 'rgba(255,255,255,0.18)' : '#e2e8f0'} strokeWidth={stroke} />
                <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
                    initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v / 100) }} transition={{ type: 'spring', stiffness: 90, damping: 22 }} />
            </svg>
            <span className={`absolute text-[11px] font-extrabold ${dark ? 'text-white' : 'text-[#081b3b]'}`}>{v}%</span>
        </span>
    );
}
import UploadTemplate from './UploadTemplate';
import CreateTeacher from './CreateTeacher';
import SubjectDetails from './SubjectDetails';
import AdminPaperPreview from './AdminPaperPreview';
import ExamManagement from './ExamManagement';
import AdminResults from './AdminResults';
import GrandTestList from './GrandTestList';
import PreviousYearPapers from './PreviousYearPapers';
import ExamBlueprints from './ExamBlueprints';
import AdminQuestionBank from './AdminQuestionBank';
import AssignmentGenerator from '../teacher/AssignmentGenerator';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import MathRenderer from '../../components/MathRenderer';
import TeacherOmr from '../teacher/omr/TeacherOmr';
import CommissionedExam from '../teacher/CommissionedExam';
import api from '../../api';
import { AdminAssignmentWrapper } from './admin-dashboard/AdminAssignmentWrapper';
import { AdminShell } from './admin-dashboard/AdminShell';
import CommandCenter from './admin-dashboard/CommandCenter';

const DashboardHome = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // Subject Directory strictly PCMB
    const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology'];
    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Botany': '/biologylogo.jpeg',
        'Zoology': '/biologylogo.jpeg',
        'Mathematics': '/mathslogo.jpeg',
        'Maths': '/mathslogo.jpeg'
    };

    const departmentMeta = {
        'Physics': {
            icon: '⚛️',
            subtitle: 'Physical Sciences',
            badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
            iconBg: 'bg-blue-600 text-white',
            borderAccent: 'border-blue-100 hover:border-blue-300',
            headerBg: 'bg-gradient-to-r from-blue-50/80 via-indigo-50/30 to-white'
        },
        'Chemistry': {
            icon: '🧪',
            subtitle: 'Chemical Sciences',
            badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            iconBg: 'bg-emerald-600 text-white',
            borderAccent: 'border-emerald-100 hover:border-emerald-300',
            headerBg: 'bg-gradient-to-r from-emerald-50/80 via-teal-50/30 to-white'
        },
        'Mathematics': {
            icon: '📐',
            subtitle: 'Mathematical Sciences',
            badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            iconBg: 'bg-indigo-600 text-white',
            borderAccent: 'border-indigo-100 hover:border-indigo-300',
            headerBg: 'bg-gradient-to-r from-indigo-50/80 via-purple-50/30 to-white'
        },
        'Biology': {
            icon: '🧬',
            subtitle: 'Life Sciences (General)',
            badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
            iconBg: 'bg-teal-600 text-white',
            borderAccent: 'border-teal-100 hover:border-teal-300',
            headerBg: 'bg-gradient-to-r from-teal-50/80 via-emerald-50/30 to-white'
        },
        'Botany': {
            icon: '🌿',
            subtitle: 'Plant Sciences',
            badgeBg: 'bg-lime-50 text-lime-800 border-lime-200',
            iconBg: 'bg-lime-600 text-white',
            borderAccent: 'border-lime-100 hover:border-lime-300',
            headerBg: 'bg-gradient-to-r from-lime-50/80 via-emerald-50/30 to-white'
        },
        'Zoology': {
            icon: '🦁',
            subtitle: 'Animal Sciences',
            badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
            iconBg: 'bg-amber-600 text-white',
            borderAccent: 'border-amber-100 hover:border-amber-300',
            headerBg: 'bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-white'
        }
    };

    const [commissionedExams, setCommissionedExams] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    // Separate loading state for teachers so the faculty dropdown shows
    // "Loading faculty..." while the API call is in-flight instead of
    // incorrectly showing "No registered X faculty" before data arrives.
    const [teachersLoading, setTeachersLoading] = useState(true);

    // Commission Exam Modal state
    const [showCommissionModal, setShowCommissionModal] = useState(false);
    const [commissionForm, setCommissionForm] = useState({
        title: '',
        examType: 'CET',
        classes: ['12'],
        targetPerSubject: 60,
        assignedTeachers: {
            'Physics': '',
            'Chemistry': '',
            'Mathematics': '',
            'Biology': '',
            'Botany': '',
            'Zoology': ''
        }
    });

    // Active selected exam ID (defaults to first exam when loaded)
    const [selectedExamId, setSelectedExamId] = useState(null);

    // Automatically set default selected exam when list loads
    useEffect(() => {
        if (commissionedExams.length > 0 && !selectedExamId) {
            setSelectedExamId(commissionedExams[0]._id);
        }
    }, [commissionedExams, selectedExamId]);

    // View Full Paper / Exam Preview Modal
    const [selectedViewExam, setSelectedViewExam] = useState(null);
    // Analysis Modal
    const [selectedAnalysisExam, setSelectedAnalysisExam] = useState(null);
    const [merging, setMerging] = useState(false);

    // Expandable Box States (One box when clicked the four will open)
    const [isExamSubjectsOpen, setIsExamSubjectsOpen] = useState(false);
    const [isSavedPapersOpen, setIsSavedPapersOpen] = useState(true);
    const [paperView, setPaperView] = useState('grid');
    const [pinned, setPinned] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('pinned-papers') || '[]').map(String)); } catch { return new Set(); }
    });
    const togglePin = (id) => setPinned(prev => {
        const next = new Set(prev);
        const key = String(id);
        if (next.has(key)) next.delete(key); else next.add(key);
        try { localStorage.setItem('pinned-papers', JSON.stringify([...next])); } catch { /* storage unavailable */ }
        return next;
    });
    const [paperSort, setPaperSort] = useState('newest');
    const [visiblePapers, setVisiblePapers] = useState(9);
    const [savedPapersCategory, setSavedPapersCategory] = useState('ALL');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [savedPapersSearch, setSavedPapersSearch] = useState('');
    const [deletingPaperId, setDeletingPaperId] = useState(null);
    const [allPapers, setAllPapers] = useState([]);

    // Categorization & Strict Isolation Helpers for Saved Papers
    const isNeetPaper = (p) => {
        const et = String(p.examType || p.exam_type || '').toUpperCase();
        const title = String(p.title || '').toUpperCase();
        return et.includes('NEET') || title.includes('NEET');
    };

    const isJeePaper = (p) => {
        const et = String(p.examType || p.exam_type || '').toUpperCase();
        const title = String(p.title || '').toUpperCase();
        return !isNeetPaper(p) && (et.includes('JEE') || title.includes('JEE'));
    };

    const isCetPaper = (p) => {
        const et = String(p.examType || p.exam_type || '').toUpperCase();
        const title = String(p.title || '').toUpperCase();
        return !isNeetPaper(p) && !isJeePaper(p) && (et.includes('CET') || et.includes('KCET') || title.includes('CET') || title.includes('KCET'));
    };

    const isCompetitivePaper = (p) => {
        const et = String(p.examType || p.exam_type || '').toUpperCase();
        const title = String(p.title || '').toUpperCase();
        return isNeetPaper(p) || isJeePaper(p) || isCetPaper(p) || et.includes('PCM') || et.includes('PCB') || et.includes('PCMB') || title.includes('GRAND ASSESSMENT');
    };

    // Strict check for individual single-subject papers:
    // Matches papers created for that specific subject alone.
    // Excludes competitive exams (NEET, JEE, CET) and multi-subject papers (e.g. "Physics • Chemistry • Botany • Zoology").
    const isIndividualSubjectPaper = (p, targetSub) => {
        // Competitive papers (NEET, JEE, CET, Grand Assessments) must NEVER appear under individual subjects
        if (isCompetitivePaper(p)) return false;

        const s = String(p.subject || '').toLowerCase().trim();
        // If subject string contains multiple combined subjects, exclude from individual subject view
        if (s.includes('•') || s.includes(',') || s.includes('&') || s.includes(' and ') || s.includes('pcmb')) {
            return false;
        }

        const target = targetSub.toLowerCase().trim();
        if (target === 'botany') return s.includes('botan');
        if (target === 'zoology') return s.includes('zool');
        if (target === 'biology') return (s === 'biology' || s === 'bio' || s.startsWith('bio')) && !s.includes('botan') && !s.includes('zool');
        if (target === 'mathematics' || target === 'maths') return s.includes('math');
        if (target === 'physics') return s.includes('physic');
        if (target === 'chemistry') return s.includes('chem');
        return s === target;
    };

    const getPapersByCategory = (category) => {
        if (category === 'NEET') return allPapers.filter(isNeetPaper);
        if (category === 'JEE') return allPapers.filter(isJeePaper);
        if (category === 'CET') return allPapers.filter(isCetPaper);
        if (['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology'].includes(category)) {
            return allPapers.filter(p => isIndividualSubjectPaper(p, category));
        }
        return allPapers;
    };

    const getSavedCategoryCount = (category) => {
        return getPapersByCategory(category).length;
    };

    const formatPaperDateTime = (dateVal) => {
        if (!dateVal) return { date: 'Date N/A', time: '', full: 'Date not recorded' };
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return { date: String(dateVal), time: '', full: String(dateVal) };
            const dateStr = d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const timeStr = d.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return { date: dateStr, time: timeStr, full: `${dateStr} • ${timeStr}` };
        } catch {
            return { date: String(dateVal), time: '', full: String(dateVal) };
        }
    };

    const handleDeletePaper = async (e, paper) => {
        e.stopPropagation();
        const paperId = paper._id || paper.id;
        const paperTitle = paper.title || 'Untitled Question Paper';
        const dt = formatPaperDateTime(paper.createdAt || paper.created_at);

        if (!paperId) return;

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete this paper?\n\n"${paperTitle}"\nCreated: ${dt.full}\n\nThis action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            setDeletingPaperId(paperId);
            await api.delete(`/api/papers/${paperId}`);
            setAllPapers(prev => prev.filter(p => String(p._id || p.id) !== String(paperId)));
        } catch (err) {
            console.error('Error deleting paper:', err);
            alert(`Failed to delete paper: ${err.response?.data?.msg || err.message}`);
        } finally {
            setDeletingPaperId(null);
        }
    };

    const fetchData = async () => {
        try {
            // Fetch teachers, exams, and teacher papers in parallel.
            setTeachersLoading(true);
            const [teachersRes, examsRes, papersRes] = await Promise.all([
                api.get('/api/admin/teachers').catch(err => {
                    console.error('Teachers load notice:', err.message);
                    return { data: [] };
                }),
                api.get('/api/exams/commissioned').catch(err => {
                    console.warn('Exams load notice:', err.message);
                    return { data: [] };
                }),
                api.get('/api/papers/admin/all').catch(err => {
                    console.warn('Papers load notice:', err.message);
                    return { data: [] };
                })
            ]);
            setAllTeachers(Array.isArray(teachersRes.data) ? teachersRes.data : []);
            setTeachersLoading(false);
            const examsList = Array.isArray(examsRes.data) ? examsRes.data : [];
            setCommissionedExams(examsList);
            const papersList = Array.isArray(papersRes.data) ? papersRes.data : [];
            setAllPapers(papersList);

            if (examsList.length > 0) {
                setSelectedExamId(prev => (prev && examsList.some(e => (e._id || e.id) === prev) ? prev : (examsList[0]._id || examsList[0].id)));
            }
            setLoading(false);
        } catch (err) {
            console.error('Error fetching admin dashboard data:', err);
            setTeachersLoading(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCommissionSubmit = async (e) => {
        e.preventDefault();
        if (!commissionForm.title) return alert('Please enter an Exam Title');

        try {
            let subjectsNeeded = [];
            if (commissionForm.examType === 'NEET') {
                subjectsNeeded = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
            } else if (commissionForm.examType === 'CET') {
                subjectsNeeded = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
            } else if (commissionForm.examType === 'JEE') {
                subjectsNeeded = ['Physics', 'Chemistry', 'Mathematics'];
            } else {
                subjectsNeeded = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
            }

            const defaultTarget = commissionForm.examType === 'JEE' ? 25 : commissionForm.examType === 'NEET' ? 45 : 60;

            // Universal college access - no faculty assignments required
            const subjectAssignments = subjectsNeeded.map(subName => {
                return {
                    subject: subName,
                    teacherId: (user && (user._id || user.id)) ? (user._id || user.id) : 'sapthagiri-admin',
                    teacherName: user?.name || 'Sapthagiri PU College',
                    teacherEmail: user?.email || '',
                    targetQuestions: defaultTarget,
                    status: 'Pending'
                };
            });

            console.log('Commissioning Exam Payload:', {
                title: commissionForm.title,
                examType: commissionForm.examType,
                classes: commissionForm.classes,
                subjectAssignments
            });

            const res = await api.post('/api/exams/commission', {
                title: commissionForm.title,
                examType: commissionForm.examType,
                classes: commissionForm.classes,
                subjectAssignments,
                duration_minutes: 180
            });

            alert(`✓ Exam "${commissionForm.title}" successfully commissioned! Ready for subject paper creation.`);
            setShowCommissionModal(false);

            setCommissionForm({
                title: '',
                examType: 'CET',
                classes: ['12'],
                targetPerSubject: 60,
                assignedTeachers: {}
            });
            if (res.data?.exam?._id) setSelectedExamId(res.data.exam._id);
            else if (res.data?._id) setSelectedExamId(res.data._id);
            fetchData();
        } catch (err) {
            console.error('Commission error:', err);
            const msg =
                err.response?.data?.msg ||
                err.response?.data?.message ||
                err.message ||
                'Failed to commission exam. Please try again.';
            alert(`Error: ${msg}`);
        }
    };

    const handleMergeExamSubjects = async (exam) => {
        if (!exam) return;
        setMerging(true);
        try {
            const subAssignments = exam.subjectAssignments || [];
            const paperIds = [];

            for (const sa of subAssignments) {
                const subName = sa.subject;
                let submittedPaper = null;
                if (sa.submittedPaperId && typeof sa.submittedPaperId === 'object' && (sa.submittedPaperId._id || sa.submittedPaperId.id)) {
                    submittedPaper = sa.submittedPaperId;
                } else {
                    const pId = sa.submittedPaperId ? String(sa.submittedPaperId) : null;
                    if (pId) {
                        submittedPaper = allPapers.find(p => String(p._id || p.id) === pId);
                    }
                }
                if (!submittedPaper) {
                    submittedPaper = allPapers.find(p => {
                        const matchesExam = (p.examId && String(p.examId) === String(exam._id || exam.id)) ||
                                            (p.title && p.title.toLowerCase().includes(exam.title.toLowerCase()));
                        const pSub = (p.subject || '').toLowerCase();
                        const curSub = subName.toLowerCase();
                        const matchesSub = pSub.includes(curSub) || curSub.includes(pSub) ||
                                            (curSub.includes('math') && pSub.includes('math')) ||
                                            (curSub.includes('bio') && pSub.includes('bio'));
                        return matchesExam && matchesSub;
                    });
                }
                if (submittedPaper && (submittedPaper._id || submittedPaper.id)) {
                    paperIds.push(submittedPaper._id || submittedPaper.id);
                }
            }

            if (paperIds.length === 0) {
                alert('No completed subject papers found to merge. Please compile and save at least one subject paper first.');
                setMerging(false);
                return;
            }

            const res = await api.post('/api/exams/merge', {
                title: `${exam.title} - Grand Assessment`,
                examType: exam.examType || 'NEET',
                paperIds: paperIds,
                duration_minutes: exam.duration_minutes || 180
            });

            const mergedPaper = res.data?.paper;
            const targetPaperId = mergedPaper?._id || mergedPaper?.id;

            alert(`✓ Successfully merged ${paperIds.length} subjects into "${exam.title} - Grand Assessment"! Opening assessment preview...`);
            fetchData();
            if (targetPaperId) {
                navigate(`/admin/dashboard/preview/${targetPaperId}`);
            }
        } catch (err) {
            console.error('Error merging exam subjects:', err);
            const errorMsg = err.response?.data?.msg || err.response?.data?.message || err.message;
            alert(`Failed to merge subjects: ${errorMsg}`);
        } finally {
            setMerging(false);
        }
    };

    const handleDeleteExam = async (rawId) => {
        const examId = rawId?._id || rawId?.id || rawId;
        if (window.confirm('Are you sure you want to delete this exam? This will remove all associated submissions.')) {
            try {
                await api.delete(`/api/exams/${examId}`);
                setSelectedExamId(null);
                fetchData();
            } catch (err) {
                console.error(err);
                alert('Failed to delete exam.');
            }
        }
    };

    const activeExam = commissionedExams.find(e => (e._id || e.id) === selectedExamId) || commissionedExams[0];

    const totalExamsCount = commissionedExams.length;
    const totalReadyQuestions = commissionedExams.reduce((sum, e) => {
        const subs = e.subjectAssignments || [];
        return sum + (e.totalQuestionsAdded !== undefined
            ? e.totalQuestionsAdded
            : subs.reduce((s, sa) => s + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0));
    }, 0);
    const facultyCount = allTeachers.length;

    return (
        <div className="animate-fade-in-up space-y-8">

            {/* ── EXECUTIVE HERO & QUICK ACTIONS ── */}
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#081b3b] via-[#0b2552] to-[#123a7a] text-white p-6 sm:p-9 shadow-[0_30px_70px_-30px_rgba(8,27,59,0.55)]">
                <span aria-hidden="true" className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-amber-400/15 blur-2xl" />
                <span aria-hidden="true" className="absolute -left-10 -bottom-20 w-64 h-64 rounded-full bg-sky-400/10 blur-2xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="eyebrow">Academic session 2025–26</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">Institutional Assessment Command</h2>
                        <p className="mt-3 text-sm sm:text-base text-white/65 font-medium leading-relaxed">
                            Centralized assessment management, real-time question paper compilation, and department progress.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => navigate('/admin/dashboard/create-paper')}
                            className="group rounded-2xl bg-amber-400 hover:bg-amber-300 text-[#081b3b] px-6 py-3.5 font-extrabold text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                        >
                            <FilePlus2 size={17} />
                            <span>Create Question Paper</span>
                        </button>
                        <button
                            id="admin-quick-commission-btn"
                            onClick={() => setShowCommissionModal(true)}
                            className="rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3.5 font-extrabold text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer backdrop-blur"
                        >
                            <Zap size={17} className="text-amber-400" />
                            <span>Commission Exam</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 3 EXECUTIVE KPI CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <div className="surface p-5 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><ClipboardList size={22} /></span>
                    <div>
                        <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Commissioned</div>
                        <div className="text-2xl font-extrabold text-[#081b3b]"><AnimatedNumber value={totalExamsCount} /> <span className="text-sm font-bold text-slate-400">exams</span></div>
                    </div>
                </div>

                <div className="surface p-5 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Database size={22} /></span>
                    <div>
                        <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Questions ready</div>
                        <div className="text-2xl font-extrabold text-[#081b3b]"><AnimatedNumber value={totalReadyQuestions} /> <span className="text-sm font-bold text-slate-400">Qs</span></div>
                    </div>
                </div>

                <div
                    onClick={() => {
                        setIsExamSubjectsOpen(true);
                        const el = document.getElementById('commissioned-exams-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="surface p-5 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
                >
                    <span className="w-12 h-12 rounded-2xl bg-[#081b3b] text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform"><Target size={22} /></span>
                    <div className="min-w-0">
                        <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Commissioned exam</div>
                        <div className="text-lg font-extrabold text-[#081b3b] flex items-center gap-1.5">
                            <span>{activeExam ? `${activeExam.examType} active` : 'Start blueprint'}</span>
                            <ArrowRight size={16} className="text-amber-500 shrink-0 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>

            <CommandCenter papers={allPapers} exams={commissionedExams} pinned={pinned} onTogglePin={togglePin}
                onOpenPaper={(p) => navigate(`/admin/dashboard/preview/${p._id || p.id}`)} go={navigate} />

            {/* ── COMMISSIONED EXAMS (per-subject targets of each commissioned exam) ── */}
            <section id="commissioned-exams-section" className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <span className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-[#081b3b] flex items-center justify-center shadow-xl shadow-amber-500/25"><ClipboardList size={26} /></span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-2xl font-extrabold text-[#081b3b] tracking-tight">Commissioned Exams</h3>
                                <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold px-3 py-1"><AnimatedNumber value={commissionedExams.length} /> registered</span>
                            </div>
                            <p className="text-sm text-slate-500 font-medium mt-0.5">Track every department's progress towards each commissioned exam and open the subject papers.</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setIsExamSubjectsOpen(!isExamSubjectsOpen)} aria-expanded={isExamSubjectsOpen}
                        className="self-start md:self-auto h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold uppercase tracking-wider text-slate-600 hover:text-[#081b3b] hover:border-slate-300 flex items-center gap-2 cursor-pointer">
                        {isExamSubjectsOpen ? 'Hide departments' : 'View 4 subjects & switch exam'} <ChevronDown size={15} className={`transition-transform ${isExamSubjectsOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {!isExamSubjectsOpen && activeExam && (() => {
                    const sa = activeExam.subjectAssignments || [];
                    const tt = sa.reduce((sum, x) => sum + (x.targetQuestions || 60), 0);
                    const ta = activeExam.totalQuestionsAdded !== undefined ? activeExam.totalQuestionsAdded : sa.reduce((sum, x) => sum + (x.questionsCount || (x.submittedPaperId?.questions?.length || 0)), 0);
                    const pc = tt > 0 ? Math.min(100, Math.round((ta / tt) * 100)) : 0;
                    return (
                        <button type="button" onClick={() => setIsExamSubjectsOpen(true)} className="w-full text-left surface p-4 flex items-center gap-4 hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer group">
                            <ProgressRing pct={pc} size={56} stroke={6} />
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 flex-wrap">
                                    <span className="rounded-full bg-[#081b3b] text-amber-300 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1">{activeExam.examType || 'CET'}</span>
                                    <span className="text-lg font-extrabold text-[#081b3b] truncate">{activeExam.title}</span>
                                    <span className="rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-1">{activeExam.classes && activeExam.classes.length > 1 ? 'Class 11 & 12' : `Class ${activeExam.classes?.[0] || '12'}`}</span>
                                </span>
                                <span className="block text-xs text-slate-500 font-semibold mt-1">{ta} of {tt} questions compiled · Physics • Chemistry • Maths • Biology</span>
                            </span>
                            <ArrowRight size={18} className="text-slate-300 group-hover:text-[#081b3b] group-hover:translate-x-1 transition-all shrink-0" />
                        </button>
                    );
                })()}

                {isExamSubjectsOpen && (
                    <div className="space-y-6">
                        {loading ? (
                            <div className="surface p-12 text-center text-slate-400 font-bold text-sm">Loading assessment progress…</div>
                        ) : commissionedExams.length === 0 ? (
                            <div className="p-12 border-2 border-dashed border-slate-300 rounded-3xl bg-white text-center">
                                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4"><ClipboardList size={26} /></div>
                                <h4 className="font-extrabold text-lg text-[#081b3b] mb-1">No Commissioned Exams Yet</h4>
                                <p className="text-sm text-slate-500 mb-5">Create your first standardized exam to open subject question targets.</p>
                                <button onClick={() => setShowCommissionModal(true)}
                                    className="bg-amber-400 hover:bg-amber-300 text-[#081b3b] px-6 py-3 rounded-2xl font-extrabold text-xs uppercase tracking-widest shadow-lg shadow-amber-500/25 cursor-pointer">+ Create Exam</button>
                            </div>
                        ) : (
                            <>
                                {/* exam switcher */}
                                <div>
                                    <p className="eyebrow !text-slate-500 mb-2.5">Select assessment</p>
                                    <div className="flex items-stretch gap-3 overflow-x-auto pb-3 -mx-1 px-1">
                                        {commissionedExams.map((exam) => {
                                            const examKey = exam._id || exam.id;
                                            const isSelected = ((activeExam?._id || activeExam?.id) === examKey);
                                            const subAssignments = exam.subjectAssignments || [];
                                            const totalTarget = subAssignments.reduce((sum, sa) => sum + (sa.targetQuestions || 60), 0);
                                            const totalAdded = exam.totalQuestionsAdded !== undefined
                                                ? exam.totalQuestionsAdded
                                                : subAssignments.reduce((sum, sa) => sum + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0);
                                            const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAdded / totalTarget) * 100)) : 0;
                                            return (
                                                <button key={examKey} onClick={() => setSelectedExamId(examKey)} aria-pressed={isSelected}
                                                    className={`relative shrink-0 w-[250px] text-left rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-all ${isSelected
                                                        ? 'bg-gradient-to-br from-[#081b3b] to-[#123a7a] text-white shadow-xl shadow-blue-950/25 ring-2 ring-amber-400'
                                                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-md'}`}>
                                                    <ProgressRing pct={overallPct} size={48} stroke={5} dark={isSelected} />
                                                    <span className="min-w-0">
                                                        <span className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md mb-1 ${isSelected ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-100 text-[#081b3b]'}`}>{exam.examType || 'CET'}</span>
                                                        <span className="block text-sm font-extrabold leading-tight truncate" title={exam.title}>{exam.title}</span>
                                                        <span className={`block text-[11px] font-semibold ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>{totalAdded} / {totalTarget} questions</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {activeExam && (() => {
                                    const exam = activeExam;
                                    const subAssignments = exam.subjectAssignments || [];
                                    const totalTarget = subAssignments.reduce((sum, sa) => sum + (sa.targetQuestions || 60), 0);
                                    const totalAdded = exam.totalQuestionsAdded !== undefined
                                        ? exam.totalQuestionsAdded
                                        : subAssignments.reduce((sum, sa) => sum + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0);
                                    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAdded / totalTarget) * 100)) : 0;

                                    return (
                                        <div className="space-y-5">
                                            {/* active exam banner */}
                                            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#081b3b] via-[#0b2552] to-[#123a7a] text-white p-6 sm:p-7 shadow-[0_24px_60px_-30px_rgba(8,27,59,0.6)]">
                                                <span aria-hidden="true" className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-400/15 blur-2xl" />
                                                <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className="rounded-full bg-amber-400 text-[#081b3b] text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1">{exam.examType || 'CET'}</span>
                                                            <span className="rounded-full bg-white/10 text-white/80 text-[11px] font-bold px-2.5 py-1">{exam.classes && exam.classes.length > 1 ? 'Class 11 & 12' : `Class ${exam.classes?.[0] || '12'}`}</span>
                                                        </div>
                                                        <h4 className="text-2xl font-extrabold tracking-tight truncate">{exam.title}</h4>
                                                        <div className="mt-4 max-w-md">
                                                            <div className="flex justify-between text-xs font-bold text-white/70 mb-1.5"><span>Total readiness</span><span>{totalAdded} / {totalTarget} · {overallPct}%</span></div>
                                                            <div className="h-2.5 rounded-full bg-white/15 overflow-hidden"><motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400" initial={{ width: 0 }} animate={{ width: `${overallPct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} /></div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <button onClick={() => handleMergeExamSubjects(exam)} disabled={merging}
                                                            className="h-11 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-60 cursor-pointer"
                                                            title="Merge all completed subject papers into a single grand assessment paper"><Zap size={15} /> {merging ? 'Merging...' : 'Merge All Subjects'}</button>
                                                        <button onClick={() => setSelectedViewExam(exam)} className="h-11 px-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer"><Eye size={15} /> View Full Paper</button>
                                                        <button onClick={() => setSelectedAnalysisExam(exam)} className="h-11 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-[#081b3b] text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer"><BarChart3 size={15} /> Analysis</button>
                                                        <button onClick={() => handleDeleteExam(exam._id || exam.id)} className="h-11 px-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500 text-rose-200 hover:text-white border border-rose-400/30 text-xs font-extrabold flex items-center gap-2 cursor-pointer"><Trash2 size={15} /> Delete</button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* the department cards */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
                                                {subAssignments.map((sa, idx) => {
                                                    const subName = sa.subject;
                                                    const isJEE = (exam.examType || '').toUpperCase().includes('JEE');
                                                    const isNEET = (exam.examType || '').toUpperCase().includes('NEET');
                                                    const target = isJEE ? 25 : isNEET ? 45 : (sa.targetQuestions || 60);

                                                    let submittedPaper = null;
                                                    if (sa.submittedPaperId && typeof sa.submittedPaperId === 'object' && (sa.submittedPaperId._id || sa.submittedPaperId.id)) {
                                                        submittedPaper = sa.submittedPaperId;
                                                    } else {
                                                        const pId = sa.submittedPaperId ? String(sa.submittedPaperId) : null;
                                                        if (pId) {
                                                            submittedPaper = allPapers.find(p => String(p._id || p.id) === pId);
                                                        }
                                                    }
                                                    if (!submittedPaper) {
                                                        submittedPaper = allPapers.find(p => {
                                                            const matchesExam = (p.examId && String(p.examId) === String(exam._id || exam.id)) ||
                                                                                (p.title && p.title.toLowerCase().includes(exam.title.toLowerCase()));
                                                            const pSub = (p.subject || '').toLowerCase();
                                                            const curSub = subName.toLowerCase();
                                                            const matchesSub = pSub.includes(curSub) || curSub.includes(pSub) ||
                                                                               (curSub.includes('math') && pSub.includes('math')) ||
                                                                               (curSub.includes('bio') && pSub.includes('bio'));
                                                            return matchesExam && matchesSub;
                                                        });
                                                    }

                                                    const submittedPaperId = submittedPaper ? (submittedPaper._id || submittedPaper.id) : null;
                                                    const count = submittedPaper && Array.isArray(submittedPaper.questions)
                                                        ? submittedPaper.questions.length
                                                        : (sa.questionsCount || 0);
                                                    const pct = Math.min(100, Math.round((count / target) * 100));
                                                    const isReady = count >= target || pct >= 100;
                                                    const key = Object.keys(SUBJECT_ICONS).find(k => subName.toLowerCase().includes(k.toLowerCase().slice(0, 4))) || 'Biology';
                                                    const SubIcon = SUBJECT_ICONS[key] || BookOpen;
                                                    const tone = SUBJECT_TONES[key] || SUBJECT_TONES.Biology;

                                                    return (
                                                        <motion.div key={idx} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ ...SPRING.soft, delay: idx * 0.05 }}
                                                            className={`relative overflow-hidden rounded-3xl bg-white flex flex-col justify-between border ${isReady ? 'border-emerald-300 shadow-lg shadow-emerald-500/10' : 'border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-950/10'}`}>
                                                            <span className={`h-1.5 w-full bg-gradient-to-r ${tone.bar}`} aria-hidden="true" />
                                                            <div className="p-5">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <span className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${tone.tile}`}><SubIcon size={22} /></span>
                                                                        <h5 className="text-base font-extrabold text-[#081b3b] truncate">{subName}</h5>
                                                                    </div>
                                                                    <span className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${isReady ? 'bg-emerald-100 text-emerald-800' : count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                        {isReady ? 'Ready' : count > 0 ? 'In progress' : 'Pending'}
                                                                    </span>
                                                                </div>

                                                                <div className="mt-5 flex items-center gap-4">
                                                                    <ProgressRing pct={pct} size={76} stroke={7} />
                                                                    <div className="min-w-0">
                                                                        <p className="text-2xl font-extrabold text-[#081b3b] leading-none"><AnimatedNumber value={count} /><span className="text-sm font-bold text-slate-400"> / {target}</span></p>
                                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">Questions</p>
                                                                        <p className="text-[11px] font-bold text-amber-600 mt-1">{isJEE ? '20 Sec A + 5 Sec B' : `${target} Qs quota`}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-4 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-[12px] font-semibold">
                                                                    {submittedPaper ? (
                                                                        <span className="text-emerald-700 flex items-center gap-1.5 truncate" title={submittedPaper.title}><Check size={14} className="shrink-0" /> <span className="truncate">Saved: {submittedPaper.title || `${subName} - ${exam.title}`}</span></span>
                                                                    ) : (
                                                                        <span className="text-slate-400">Select & compile {subName} questions</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="px-5 pb-5">
                                                                {submittedPaperId ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <button type="button" onClick={() => navigate(`/admin/dashboard/preview/${submittedPaperId}`)} title="View & Download PDF in single subject form"
                                                                            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-[#081b3b] to-[#0d2a5e] text-amber-300 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20 cursor-pointer"><Eye size={15} /> View / PDF</button>
                                                                        <button type="button" title="Edit questions for this subject"
                                                                            onClick={() => navigate(`/admin/dashboard/create-paper?examId=${exam._id || exam.id}&paperId=${submittedPaperId}&subject=${subName}&examType=${exam.examType || 'CET'}&examTitle=${encodeURIComponent(exam.title)}&classes=${encodeURIComponent(exam.classes ? (exam.classes.includes('11') && exam.classes.includes('12') ? 'Both' : exam.classes[0]) : '12')}`)}
                                                                            className="h-11 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#081b3b] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"><Pencil size={14} /> Edit</button>
                                                                    </div>
                                                                ) : (
                                                                    <button type="button"
                                                                        onClick={() => navigate(`/admin/dashboard/create-paper?examId=${exam._id || exam.id}&subject=${subName}&examType=${exam.examType || 'CET'}&examTitle=${encodeURIComponent(exam.title)}&classes=${encodeURIComponent(exam.classes ? (exam.classes.includes('11') && exam.classes.includes('12') ? 'Both' : exam.classes[0]) : '12')}`)}
                                                                        className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"><FilePlus2 size={15} /> Select & create {subName} paper <ArrowRight size={14} /></button>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}
            </section>

            {/* ── SAVED PAPERS LIBRARY (organised by competitive exam and by subject) ── */}
            <section id="saved-papers-section" className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <span className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#081b3b] to-[#123a7a] text-amber-400 flex items-center justify-center shadow-xl shadow-blue-950/20"><FolderOpen size={26} /></span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-2xl font-extrabold text-[#081b3b] tracking-tight">Saved Papers</h3>
                                <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold px-3 py-1"><AnimatedNumber value={allPapers.length} /> total</span>
                            </div>
                            <p className="text-sm text-slate-500 font-medium mt-0.5">Every question paper your faculty has saved, ready to open, analyse or export.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        {isSavedPapersOpen && (
                            <div className="inline-flex rounded-xl bg-slate-200/70 p-1" role="group" aria-label="Layout">
                                {[['grid', LayoutGrid, 'Grid'], ['list', List, 'List']].map(([key, Icon, label]) => (
                                    <button key={key} type="button" onClick={() => setPaperView(key)} aria-pressed={paperView === key} aria-label={`${label} view`} title={`${label} view`}
                                        className={`w-10 h-9 rounded-lg flex items-center justify-center cursor-pointer ${paperView === key ? 'bg-white text-[#081b3b] shadow' : 'text-slate-500 hover:text-slate-700'}`}><Icon size={17} /></button>
                                ))}
                            </div>
                        )}
                        <button type="button" onClick={() => setIsSavedPapersOpen(!isSavedPapersOpen)} aria-expanded={isSavedPapersOpen}
                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold uppercase tracking-wider text-slate-600 hover:text-[#081b3b] hover:border-slate-300 flex items-center gap-2 cursor-pointer">
                            {isSavedPapersOpen ? 'Hide' : 'Show'} <ChevronDown size={15} className={`transition-transform ${isSavedPapersOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {isSavedPapersOpen && (
                    <>
                        {/* at-a-glance numbers (click a tile to filter) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[
                                { key: 'ALL', label: 'All papers', Icon: Folder, tone: 'from-[#081b3b] to-[#123a7a]', n: allPapers.length },
                                { key: 'NEET', label: 'NEET', Icon: Target, tone: 'from-teal-500 to-emerald-600', n: getSavedCategoryCount('NEET') },
                                { key: 'JEE', label: 'JEE', Icon: Zap, tone: 'from-indigo-500 to-violet-600', n: getSavedCategoryCount('JEE') },
                                { key: 'CET', label: 'CET', Icon: Trophy, tone: 'from-amber-400 to-orange-500', n: getSavedCategoryCount('CET') },
                            ].map(({ key, label, Icon, tone, n }) => {
                                const share = allPapers.length ? Math.round((n / allPapers.length) * 100) : 0;
                                return (
                                    <button key={key} type="button" onClick={() => { setSavedPapersCategory(key); setVisiblePapers(9); }}
                                        className={`relative overflow-hidden rounded-2xl p-4 text-left text-white bg-gradient-to-br ${tone} shadow-lg hover:-translate-y-0.5 transition-transform cursor-pointer ${savedPapersCategory === key ? 'ring-4 ring-amber-300/70' : ''}`}>
                                        <Icon size={64} className="absolute -right-3 -bottom-3 opacity-15" aria-hidden="true" />
                                        <span className="relative block text-[11px] font-extrabold uppercase tracking-wider text-white/80">{label}</span>
                                        <span className="relative block text-3xl font-extrabold leading-tight"><AnimatedNumber value={n} /></span>
                                        <span className="relative mt-1 block h-1.5 rounded-full bg-white/25 overflow-hidden"><span className="block h-full rounded-full bg-white/90" style={{ width: `${share}%` }} /></span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* search + filter chips */}
                        <div className="surface p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" value={savedPapersSearch} onChange={(e) => setSavedPapersSearch(e.target.value)}
                                    placeholder="Search saved papers by title, subject or exam…"
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm font-semibold text-[#081b3b] placeholder:text-slate-400 outline-none focus:border-amber-400 focus:bg-white" />
                                {savedPapersSearch && (
                                    <button type="button" onClick={() => setSavedPapersSearch('')} aria-label="Clear search"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"><X size={15} /></button>
                                )}
                            </div>
                            <label className="relative flex items-center gap-2 h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-extrabold uppercase tracking-wider text-slate-500 cursor-pointer">
                                <ArrowDownUp size={15} />
                                <select value={paperSort} onChange={(e) => { setPaperSort(e.target.value); setVisiblePapers(9); }} aria-label="Sort papers"
                                    className="bg-transparent text-[#081b3b] font-extrabold outline-none cursor-pointer pr-1">
                                    <option value="newest">Newest first</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="questions">Most questions</option>
                                    <option value="title">Title A–Z</option>
                                </select>
                            </label>
                            </div>
                            <LayoutGroup id="paper-filter">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {[{ key: 'ALL', label: 'All papers', Icon: Folder }, { key: 'NEET', label: 'NEET', Icon: Target }, { key: 'JEE', label: 'JEE', Icon: Zap }, { key: 'CET', label: 'CET', Icon: Trophy }].map(({ key, label, Icon }) => {
                                        const on = savedPapersCategory === key;
                                        return (
                                            <button key={key} type="button" onClick={() => setSavedPapersCategory(key)} aria-pressed={on}
                                                className={`relative rounded-xl px-3.5 h-10 flex items-center gap-2 text-[13px] font-bold cursor-pointer ${on ? 'text-amber-300' : 'text-slate-600 hover:bg-slate-100'}`}>
                                                {on && <motion.span layoutId="paper-chip" transition={SPRING.bouncy} className="absolute inset-0 rounded-xl bg-[#081b3b] shadow-lg shadow-blue-950/25" />}
                                                <Icon size={15} className="relative" /><span className="relative">{label}</span>
                                                <span className={`relative rounded-full px-1.5 text-[11px] font-extrabold ${on ? 'bg-white/15 text-amber-200' : 'bg-slate-100 text-slate-500'}`}>{key === 'ALL' ? allPapers.length : getSavedCategoryCount(key)}</span>
                                            </button>
                                        );
                                    })}
                                    <span className="mx-1 h-6 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />
                                    {subjects.map(sub => {
                                        const on = savedPapersCategory === sub;
                                        const SubIcon = SUBJECT_ICONS[sub] || BookOpen;
                                        return (
                                            <button key={sub} type="button" onClick={() => setSavedPapersCategory(sub)} aria-pressed={on}
                                                className={`relative rounded-xl px-3.5 h-10 flex items-center gap-2 text-[13px] font-bold cursor-pointer ${on ? 'text-amber-300' : 'text-slate-600 hover:bg-slate-100'}`}>
                                                {on && <motion.span layoutId="paper-chip" transition={SPRING.bouncy} className="absolute inset-0 rounded-xl bg-[#081b3b] shadow-lg shadow-blue-950/25" />}
                                                <SubIcon size={15} className="relative" /><span className="relative">{sub}</span>
                                                <span className={`relative rounded-full px-1.5 text-[11px] font-extrabold ${on ? 'bg-white/15 text-amber-200' : 'bg-slate-100 text-slate-500'}`}>{getSavedCategoryCount(sub)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </LayoutGroup>
                        </div>

                        {(() => {
                            const categoryPapers = getPapersByCategory(savedPapersCategory);
                            const filteredPapers = categoryPapers.filter(p => {
                                if (!savedPapersSearch.trim()) return true;
                                const q = savedPapersSearch.toLowerCase().trim();
                                return (
                                    String(p.title || '').toLowerCase().includes(q) ||
                                    String(p.subject || '').toLowerCase().includes(q) ||
                                    String(p.examType || p.exam_type || '').toLowerCase().includes(q) ||
                                    (Array.isArray(p.classes) && p.classes.some(c => String(c).includes(q)))
                                );
                            });
                            const isIndividual = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology'].includes(savedPapersCategory);
                            const stamp = (p) => new Date(p.createdAt || p.created_at || 0).getTime() || 0;
                            const sortedPapers = [...filteredPapers].sort((x, y) => (
                                paperSort === 'oldest' ? stamp(x) - stamp(y)
                                    : paperSort === 'questions' ? (y.questions?.length || 0) - (x.questions?.length || 0)
                                    : paperSort === 'title' ? String(x.title || '').localeCompare(String(y.title || ''))
                                    : stamp(y) - stamp(x)));
                            const shownPapers = sortedPapers.slice(0, visiblePapers);

                            if (filteredPapers.length === 0) {
                                return (
                                    <div className="py-16 px-4 text-center rounded-3xl bg-white border border-dashed border-slate-300">
                                        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4"><AlertCircle className="w-7 h-7" /></div>
                                        <h5 className="font-extrabold text-base text-[#081b3b]">
                                            {savedPapersSearch.trim() ? `No papers match “${savedPapersSearch}” in ${savedPapersCategory}` : `No papers saved under ${savedPapersCategory}`}
                                        </h5>
                                        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                                            {isIndividual ? `Only papers created purely for ${savedPapersCategory} appear here. NEET, JEE and CET papers are kept in their own exam categories.` : `There are currently no papers cataloged under ${savedPapersCategory}.`}
                                        </p>
                                        <button type="button" onClick={() => { setSavedPapersCategory('ALL'); setSavedPapersSearch(''); }}
                                            className="mt-5 px-5 py-2.5 rounded-xl bg-[#081b3b] text-amber-300 text-xs font-extrabold uppercase tracking-wider cursor-pointer">View all saved papers ({allPapers.length})</button>
                                    </div>
                                );
                            }

                            const accentFor = (p) => (isNeetPaper(p) ? { bar: 'from-teal-400 to-emerald-500', chip: 'bg-teal-50 text-teal-700 border-teal-200' }
                                : isJeePaper(p) ? { bar: 'from-indigo-400 to-violet-500', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
                                : isCetPaper(p) ? { bar: 'from-amber-400 to-orange-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' }
                                : p.examType === 'ASSIGNMENT' ? { bar: 'from-fuchsia-400 to-purple-500', chip: 'bg-purple-50 text-purple-700 border-purple-200' }
                                : { bar: 'from-sky-400 to-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200' });

                            return (
                                <div>
                                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{filteredPapers.length} {filteredPapers.length === 1 ? 'paper' : 'papers'} · {savedPapersCategory === 'ALL' ? 'all categories' : savedPapersCategory}</p>
                                    <div className={paperView === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5' : 'flex flex-col gap-3'}>
                                        {shownPapers.map((p, idx) => {
                                            const pId = p._id || p.id;
                                            const qCount = Array.isArray(p.questions) ? p.questions.length : 0;
                                            const dt = formatPaperDateTime(p.createdAt || p.created_at);
                                            const isDeleting = deletingPaperId === pId;
                                            const accent = accentFor(p);
                                            const SubIcon = SUBJECT_ICONS[p.subject] || BookOpen;
                                            const examLabel = p.examType || p.exam_type || 'PAPER';
                                            const openStats = (e) => {
                                                e.stopPropagation();
                                                setSelectedAnalysisExam({
                                                    title: p.title || `${p.subject || 'Saved'} Question Paper`,
                                                    allQuestions: p.questions || [],
                                                    examType: p.examType || p.exam_type || 'CET',
                                                });
                                            };
                                            const open = () => navigate(`/admin/dashboard/preview/${pId}`);

                                            if (paperView === 'list') {
                                                return (
                                                    <motion.div key={pId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: Math.min(idx, 12) * 0.025 }}
                                                        onClick={open} className="group relative overflow-hidden flex items-center gap-4 rounded-2xl bg-white border border-slate-200 pl-5 pr-3 py-3 hover:shadow-lg hover:border-slate-300 cursor-pointer transition-shadow">
                                                        <span className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${accent.bar}`} aria-hidden="true" />
                                                        <span className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><SubIcon size={19} /></span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block font-extrabold text-[#081b3b] truncate" title={p.title || 'Untitled Question Paper'}>{p.title || 'Untitled Question Paper'}</span>
                                                            <span className="block text-xs text-slate-500 font-semibold truncate">{p.subject || 'All Subjects'} · {p.classes?.length ? `Class ${p.classes.join(', ')}` : 'Class 12'} · {qCount} questions · {dt.date}</span>
                                                        </span>
                                                        <span className={`hidden sm:inline text-[11px] font-extrabold px-2.5 py-1 rounded-full border uppercase ${accent.chip}`}>{examLabel}</span>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); open(); }} className="h-9 px-4 rounded-xl bg-[#081b3b] text-amber-300 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"><Eye size={14} /> View</button>
                                                        <button type="button" onClick={openStats} title="View paper analysis" className="h-9 px-3 rounded-xl bg-amber-50 text-[#081b3b] border border-amber-200 text-xs font-extrabold cursor-pointer">Stats</button>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); togglePin(pId); }} aria-pressed={pinned.has(String(pId))} title={pinned.has(String(pId)) ? 'Unpin' : 'Pin to dashboard'} aria-label="Pin paper"
                                                            className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-amber-50 ${pinned.has(String(pId)) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}><Star size={17} className={pinned.has(String(pId)) ? 'fill-amber-400' : ''} /></button>
                                                        <button type="button" disabled={isDeleting} onClick={(e) => handleDeletePaper(e, p)} title="Delete paper" aria-label="Delete paper"
                                                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer">{isDeleting ? <span className="animate-spin text-xs">⏳</span> : <Trash2 className="w-4 h-4" />}</button>
                                                    </motion.div>
                                                );
                                            }

                                            return (
                                                <motion.div key={pId} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} transition={{ ...SPRING.soft, delay: Math.min(idx, 12) * 0.03 }}
                                                    onClick={open} className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-blue-950/10 hover:border-slate-300 cursor-pointer flex flex-col">
                                                    <span className={`h-1.5 w-full bg-gradient-to-r ${accent.bar}`} aria-hidden="true" />
                                                    <SubIcon size={120} className="absolute -right-6 top-10 text-slate-100 pointer-events-none" aria-hidden="true" />
                                                    <div className="relative p-5 flex-1 flex flex-col">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wide ${accent.chip}`}>{examLabel}</span>
                                                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1.5"><SubIcon size={12} />{p.subject || 'All Subjects'}</span>
                                                            </div>
                                                            <div className="flex items-center -mr-2 -mt-1 shrink-0">
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); togglePin(pId); }} aria-pressed={pinned.has(String(pId))} title={pinned.has(String(pId)) ? 'Unpin' : 'Pin to dashboard'} aria-label="Pin paper"
                                                                className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-amber-50 ${pinned.has(String(pId)) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}><Star size={17} className={pinned.has(String(pId)) ? 'fill-amber-400' : ''} /></button>
                                                            <button type="button" disabled={isDeleting} onClick={(e) => handleDeletePaper(e, p)} title="Delete paper" aria-label="Delete paper"
                                                                className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer">{isDeleting ? <span className="animate-spin text-xs">⏳</span> : <Trash2 className="w-4 h-4" />}</button>
                                                            </div>
                                                        </div>
                                                        <h5 className="mt-4 text-lg font-extrabold text-[#081b3b] leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors" title={p.title || 'Untitled Question Paper'}>{p.title || 'Untitled Question Paper'}</h5>

                                                        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                                                            <div className="rounded-2xl bg-slate-50 py-2.5"><dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Questions</dt><dd className="text-lg font-extrabold text-[#081b3b]">{qCount}</dd></div>
                                                            <div className="rounded-2xl bg-slate-50 py-2.5"><dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Class</dt><dd className="text-lg font-extrabold text-[#081b3b]">{p.classes?.length ? p.classes.join(', ') : '12'}</dd></div>
                                                            <div className="rounded-2xl bg-slate-50 py-2.5 px-1"><dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Saved</dt><dd className="text-[13px] font-extrabold text-[#081b3b] leading-tight pt-1">{dt.date}</dd></div>
                                                        </dl>
                                                        {dt.time && <p className="mt-2.5 text-[11px] text-slate-400 font-semibold flex items-center gap-1.5"><Clock size={12} /> {dt.time}</p>}
                                                    </div>
                                                    <div className="relative px-5 pb-5 flex items-center gap-2">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); open(); }}
                                                            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-[#081b3b] to-[#0d2a5e] text-amber-300 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20 cursor-pointer"><Eye size={15} /> View paper</button>
                                                        <button type="button" onClick={openStats} title="View paper analysis"
                                                            className="h-11 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-[#081b3b] border border-amber-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"><BarChart3 size={15} /> Stats</button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                    {sortedPapers.length > shownPapers.length && (
                                        <div className="mt-6 flex justify-center">
                                            <button type="button" onClick={() => setVisiblePapers(v => v + 9)}
                                                className="h-12 px-8 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md text-xs font-extrabold uppercase tracking-wider text-[#081b3b] flex items-center gap-2 cursor-pointer">
                                                Show more <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{sortedPapers.length - shownPapers.length} left</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </section>

            {/* ── MODAL: CREATE & COMMISSION EXAM ── */}
            {showCommissionModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-8 border-b border-gray-100 bg-gray-50/60">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Admin Commissioning Engine</span>
                                <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Create & Delegate Exam Assignment</h2>
                                <p className="text-xs text-gray-500 font-medium mt-1">Set the exam title and configure standardized subject question targets.</p>
                            </div>
                            <button onClick={() => setShowCommissionModal(false)} className="text-slate/30 hover:text-red-500 bg-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 shadow transition">✕</button>
                        </div>

                        <form onSubmit={handleCommissionSubmit} className="p-8 overflow-y-auto space-y-6">
                            {/* Exam Title */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Exam Title / Assessment Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. CET MOCK 1 or NEET GRAND TEST 2026"
                                    value={commissionForm.title}
                                    onChange={e => setCommissionForm({ ...commissionForm, title: e.target.value })}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-5 py-3.5 text-base font-bold text-navy outline-none bg-gray-50/50"
                                />
                            </div>

                            {/* Exam Preset & Target Class */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Exam Preset</label>
                                    <select
                                        value={commissionForm.examType}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const defaultTarget = val === 'JEE' ? 25 : val === 'NEET' ? 45 : 60;
                                            setCommissionForm({ ...commissionForm, examType: val, targetPerSubject: defaultTarget });
                                        }}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="CET">CET (4 Subjects: Physics, Chemistry, Maths, Biology - 60 Qs each)</option>
                                        <option value="NEET">NEET (4 Subjects: Physics, Chemistry, Botany, Zoology - 45 Qs each)</option>
                                        <option value="JEE">JEE (3 Subjects: Physics, Chemistry, Mathematics - 25 Qs each [20 MCQs + 5 Numerical])</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Class</label>
                                    <select
                                        value={
                                            (Array.isArray(commissionForm.classes) && (
                                                (commissionForm.classes.includes('11') && commissionForm.classes.includes('12')) ||
                                                commissionForm.classes.includes('Both')
                                            ))
                                                ? 'Both'
                                                : (commissionForm.classes[0] || '12')
                                        }
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'Both') {
                                                setCommissionForm({ ...commissionForm, classes: ['11', '12'] });
                                            } else {
                                                setCommissionForm({ ...commissionForm, classes: [val] });
                                            }
                                        }}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="12">Class 12</option>
                                        <option value="11">Class 11</option>
                                        <option value="Both">Both Class 11 & 12</option>
                                    </select>
                                </div>
                            </div>

                            {/* Multi-Subject Structure & Quotas */}
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-3">
                                <h4 className="text-xs font-black text-navy uppercase tracking-widest flex items-center gap-2">
                                    <span>🎯</span> Standardized Multi-Subject Structure
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                    <div className={`p-4 rounded-2xl border transition ${
                                        commissionForm.examType === 'CET' ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-100' : 'bg-white border-slate-200'
                                    }`}>
                                        <div className="font-black text-navy text-sm">CET (PCMB)</div>
                                        <div className="text-slate-500 text-xs mt-1">4 Subjects: Physics, Chemistry, Maths, Biology</div>
                                        <div className="text-amber-700 font-extrabold text-xs mt-2">60 Questions each (240 Qs Total)</div>
                                    </div>
                                    <div className={`p-4 rounded-2xl border transition ${
                                        commissionForm.examType === 'NEET' ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-100' : 'bg-white border-slate-200'
                                    }`}>
                                        <div className="font-black text-navy text-sm">NEET (PCBZ)</div>
                                        <div className="text-slate-500 text-xs mt-1">4 Subjects: Physics, Chemistry, Botany, Zoology</div>
                                        <div className="text-amber-700 font-extrabold text-xs mt-2">45 Questions each (180 Qs Total)</div>
                                    </div>
                                    <div className={`p-4 rounded-2xl border transition ${
                                        commissionForm.examType === 'JEE' ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-100' : 'bg-white border-slate-200'
                                    }`}>
                                        <div className="font-black text-navy text-sm">JEE Main (PCM)</div>
                                        <div className="text-slate-500 text-xs mt-1">3 Subjects: Physics, Chemistry, Mathematics</div>
                                        <div className="text-amber-700 font-extrabold text-xs mt-2">25 Qs each (20 Sec A + 5 Sec B = 75 Qs)</div>
                                    </div>
                                </div>
                            </div>

                            {/* Submit & Dispatch */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCommissionModal(false)}
                                    className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-100 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 rounded-xl bg-gold text-navy font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg cursor-pointer flex items-center gap-2"
                                >
                                    <span>⚡</span> Commission Exam Now
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: VIEW FULL EXAM PAPER (PREVIEW QUESTIONS) ── */}
            {selectedViewExam && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-8 border-b border-gray-100 bg-gray-50/80">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Assessment Blueprint</span>
                                <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">{selectedViewExam.title}</h2>
                                <p className="text-xs text-gray-500 font-bold mt-1">
                                    Preset: {selectedViewExam.examType} • {selectedViewExam.allQuestions?.length || 0} Questions Compiled Across All Subjects
                                </p>
                            </div>
                            <button onClick={() => setSelectedViewExam(null)} className="text-slate/30 hover:text-red-500 bg-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 shadow transition">✕</button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-6 flex-1">
                            {(!selectedViewExam.allQuestions || selectedViewExam.allQuestions.length === 0) ? (
                                <div className="p-12 text-center text-slate/40 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-gray-200 rounded-3xl">
                                    Zero questions added yet for this exam. Teachers will auto-fetch and submit questions for their assigned subjects.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {selectedViewExam.allQuestions.map((q, qIdx) => (
                                        <div key={q._id || qIdx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3 font-normal text-[15px]">
                                            <div className="flex justify-between items-center text-xs font-normal text-slate-500">
                                                <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-normal">Q{qIdx + 1}. [{q.subject || 'Physics'}]</span>
                                                <span className="font-normal uppercase">{q.type || 'MCQ'} • {q.level || 'medium'}</span>
                                            </div>
                                            <div className="text-[15px] font-normal text-slate-800 leading-relaxed">
                                                <MathRenderer text={q.questionText || ''} />
                                            </div>
                                            {q.imageUrl && (
                                                <div className="mt-2 text-center">
                                                    <img src={q.imageUrl} alt="Diagram" className="max-h-56 mx-auto rounded border border-gray-200 object-contain" />
                                                </div>
                                            )}
                                            {q.options && q.options.length > 0 && (
                                                <div className="space-y-1.5 pt-2 text-[15px] font-normal text-slate-800">
                                                    {q.options.map((opt, oIdx) => (
                                                        <div key={oIdx} className="p-2 rounded-lg border border-gray-100 flex items-baseline gap-2 bg-gray-50/50 font-normal">
                                                            <span className="font-normal text-slate-700 min-w-[22px]">({String.fromCharCode(65 + oIdx)})</span>
                                                            <div className="flex-1 min-w-0 font-normal">
                                                                <MathRenderer inline text={opt || ''} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center p-6 border-t border-gray-100 bg-gray-50">
                            <div className="text-xs font-bold text-navy">
                                Total Questions: <span className="text-blue-700 font-black">{selectedViewExam.allQuestions?.length || 0}</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedAnalysisExam(selectedViewExam);
                                    }}
                                    className="px-6 py-2.5 rounded-xl bg-gold text-navy font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow"
                                >
                                    <span>📊</span> View Paper Analysis
                                </button>
                                <button
                                    onClick={() => setSelectedViewExam(null)}
                                    className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-100 transition"
                                >
                                    Close Preview
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: GENUINE PAPER ANALYSIS MODAL (NO FAKE DATA, CSV/PRINT EXPORT) ── */}
            {selectedAnalysisExam && (
                <PaperAnalysisModal
                    isOpen={!!selectedAnalysisExam}
                    onClose={() => setSelectedAnalysisExam(null)}
                    paperTitle={selectedAnalysisExam.title}
                    questions={selectedAnalysisExam.allQuestions || []}
                    examType={selectedAnalysisExam.examType || 'CET'}
                />
            )}
        </div>
    );
};

/* Admin wrapper for AssignmentGenerator — gets subject from URL param */

const AdminDashboard = () => (
    <AdminShell>
        <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="create-paper" element={<CommissionedExam />} />
            <Route path="omr/*" element={<TeacherOmr />} />
            <Route path="cbt-exams" element={<ExamManagement />} />
            <Route path="results" element={<AdminResults />} />
            <Route path="questions" element={<AdminQuestionBank />} />
            <Route path="upload-template" element={<UploadTemplate />} />
            <Route path="create-teacher" element={<CreateTeacher />} />
            <Route path="subject/:subject" element={<SubjectDetails />} />
            <Route path="preview/:paperId" element={<AdminPaperPreview />} />
            <Route path="grand-tests" element={<GrandTestList />} />
            <Route path="previous-year-papers" element={<PreviousYearPapers />} />
            <Route path="exam-blueprints" element={<ExamBlueprints />} />
            <Route path="assignments/:subject" element={<AdminAssignmentWrapper />} />
        </Routes>
    </AdminShell>
);

export default AdminDashboard;
