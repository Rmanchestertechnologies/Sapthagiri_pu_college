import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Trash2, Eye, Clock, Calendar, ChevronDown, Filter, Search, X, FolderOpen, BookOpen, AlertCircle } from 'lucide-react';
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
        return isNeetPaper(p) || isJeePaper(p) || isCetPaper(p);
    };

    const isPcmbPaper = (p) => {
        const title = String(p.title || '').toUpperCase();
        const s = String(p.subject || '').toUpperCase();
        const et = String(p.examType || p.exam_type || '').toUpperCase();
        return s.includes('PCMB') || title.includes('PCMB') || et.includes('PCMB');
    };

    const isBzPaper = (p) => {
        const title = String(p.title || '').toUpperCase();
        const s = String(p.subject || '').toUpperCase();
        return s.includes('BZ') || title.includes('BZ') || (s.includes('BOTAN') && s.includes('ZOOL')) || (title.includes('BOTAN') && title.includes('ZOOL'));
    };

    // Strict check for individual single-subject papers:
    // Excludes NEET, JEE, CET competitive exams, and excludes multi-subject papers (PCMB, BZ).
    const isIndividualSubjectPaper = (p, targetSub) => {
        if (isCompetitivePaper(p)) return false;
        if (isPcmbPaper(p) || isBzPaper(p)) return false;

        const s = String(p.subject || '').toLowerCase().trim();
        const target = targetSub.toLowerCase().trim();

        // Multi-subject check
        if (s.includes('•') || s.includes(',') || s.includes('&') || s.includes(' and ')) {
            return false;
        }

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
        if (category === 'PCMB') return allPapers.filter(isPcmbPaper);
        if (category === 'BZ') return allPapers.filter(isBzPaper);
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
                    teacherName: 'Sapthagiri PU College',
                    teacherEmail: 'sapthagiripucollegedvg@gmail.com',
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

            {/* ── CLEAN EXECUTIVE HEADER & QUICK ACTION ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[11px] font-black text-navy uppercase tracking-[0.2em]">Academic Session 2025–26</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-navy tracking-tight">
                        Institutional Assessment Command
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                        Centralized assessment management, real-time question paper compilation, and department progress.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/admin/dashboard/create-paper')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2.5 cursor-pointer"
                    >
                        <span className="text-base">✍️</span>
                        <span>Create Question Paper</span>
                    </button>
                    <button
                        id="admin-quick-commission-btn"
                        onClick={() => setShowCommissionModal(true)}
                        className="bg-navy text-gold hover:bg-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2.5 border-2 border-gold cursor-pointer"
                    >
                        <span className="text-base">⚡</span>
                        <span>Commission Exam</span>
                    </button>
                </div>
            </div>

            {/* ── 3 COMPACT EXECUTIVE KPI CARDS (NO PROFESSORS / FACULTY) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-black shadow-inner">
                        📋
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Commissioned</div>
                        <div className="text-xl font-black text-navy">{totalExamsCount} Exams</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-black shadow-inner">
                        ✍️
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Questions Ready</div>
                        <div className="text-xl font-black text-navy">{totalReadyQuestions} Qs</div>
                    </div>
                </div>

                <div
                    onClick={() => {
                        setIsExamSubjectsOpen(true);
                        const el = document.getElementById('commissioned-exams-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-white p-5 rounded-2xl border border-gold/40 shadow-xs flex items-center gap-4 cursor-pointer hover:border-gold hover:shadow-md transition-all group"
                >
                    <div className="w-12 h-12 rounded-xl bg-gold/15 text-navy flex items-center justify-center text-xl font-black shadow-inner group-hover:scale-110 transition-transform">
                        📋
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Commissioned Exam</div>
                        <div className="text-xl font-black text-navy flex items-center gap-1.5">
                            <span>{activeExam ? `${activeExam.examType} Active` : 'Start Blueprint'}</span>
                            <span className="text-xs text-gold font-bold">→</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SECTION 1: COMMISSIONED EXAMS & PCMB TARGETS (ONE BOX - CLICK TO EXPAND 4 SUBJECTS) ── */}
            <div id="commissioned-exams-section" className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden transition-all duration-300">
                {/* Master Box Header (Click to Open/Close) */}
                <div
                    onClick={() => setIsExamSubjectsOpen(!isExamSubjectsOpen)}
                    className="p-6 cursor-pointer hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-navy text-gold flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                            📋
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="bg-navy text-gold text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg">
                                    {activeExam?.examType || 'CET'}
                                </span>
                                <h3 className="font-black text-lg text-navy uppercase tracking-tight">
                                    {activeExam?.title || 'Commissioned Examination Targets'}
                                </h3>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                                    {activeExam?.classes && activeExam.classes.length > 1 ? 'Class 11 & 12' : `Class ${activeExam?.classes?.[0] || '12'}`}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                {commissionedExams.length} Total Exams Registered • Tap to open 4 PCMB department target breakdown
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-auto">
                        <div className="text-right hidden sm:block">
                            <span className="text-xs font-black text-navy block">
                                {isExamSubjectsOpen ? 'Hide Department Subjects' : 'View 4 Subjects & Switch Exam'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                                Physics • Chemistry • Maths • Biology
                            </span>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base transition-all duration-300 ${
                            isExamSubjectsOpen ? 'bg-navy text-gold rotate-180 shadow-md' : 'bg-slate-100 text-navy hover:bg-slate-200'
                        }`}>
                            ▾
                        </div>
                    </div>
                </div>

                {/* WHEN CLICKED: THE EXAM SWITCHER & 4 PCMB SUBJECTS EXPAND */}
                {isExamSubjectsOpen && (
                    <div className="p-6 pt-0 border-t border-slate-100 space-y-6 animate-fade-in bg-slate-50/40">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400 font-bold text-sm">
                                Loading assessment progress...
                            </div>
                        ) : commissionedExams.length === 0 ? (
                            <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                                <h4 className="font-black text-navy text-base mb-1">No Commissioned Exams Yet</h4>
                                <p className="text-xs text-gray-500 mb-4">Create your first standardized exam to open subject question targets.</p>
                                <button
                                    onClick={() => setShowCommissionModal(true)}
                                    className="bg-gold text-navy px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow cursor-pointer"
                                >
                                    + Create Exam
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 pt-4">
                                {/* Exam Switcher Pills */}
                                <div>
                                    <div className="text-xs font-black text-navy uppercase tracking-wider mb-2.5">
                                        Select Assessment:
                                    </div>
                                    <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                                        {commissionedExams.map((exam) => {
                                            const examKey = exam._id || exam.id;
                                            const isSelected = ((activeExam?._id || activeExam?.id) === examKey);
                                            const subAssignments = exam.subjectAssignments || [];
                                            const totalTarget = subAssignments.reduce((sum, sa) => sum + (sa.targetQuestions || 60), 0);
                                            const totalAdded = exam.totalQuestionsAdded !== undefined
                                                ? exam.totalQuestionsAdded
                                                : subAssignments.reduce((sum, sa) => sum + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0);
                                            const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAdded / totalTarget) * 100)) : 0;
                                            const examType = exam.examType || 'CET';

                                            return (
                                                <button
                                                    key={examKey}
                                                    onClick={() => setSelectedExamId(examKey)}
                                                    className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-navy text-gold shadow-md font-black border-2 border-gold scale-[1.02]'
                                                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                                >
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                        isSelected ? 'bg-gold/20 text-gold' : 'bg-slate-100 text-navy'
                                                    }`}>
                                                        {examType}
                                                    </span>
                                                    <span>{exam.title}</span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                        isSelected ? 'bg-white text-navy' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {overallPct}%
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Exam Action Controls */}
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
                                            <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                                                <div>
                                                    <h4 className="font-black text-base text-navy uppercase">{exam.title}</h4>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Total Readiness: {totalAdded} / {totalTarget} Questions Compiled ({overallPct}%)
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => handleMergeExamSubjects(exam)}
                                                        disabled={merging}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md border border-emerald-400"
                                                        title="Merge all completed subject papers into a single grand assessment paper"
                                                    >
                                                        <span>⚡</span> {merging ? 'Merging...' : 'Merge All Subjects'}
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedViewExam(exam)}
                                                        className="bg-navy text-gold hover:bg-slate-900 px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                    >
                                                        <span>👁</span> View Full Paper
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedAnalysisExam(exam)}
                                                        className="bg-gold text-navy hover:bg-amber-400 px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                    >
                                                        <span>📊</span> Analysis
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteExam(exam._id || exam.id)}
                                                        className="bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer"
                                                    >
                                                        ✕ Delete
                                                    </button>
                                                </div>
                                            </div>

                                            {/* The Multi-Subject Department Cards */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {subAssignments.map((sa, idx) => {
                                                    const subName = sa.subject;
                                                    const isJEE = (exam.examType || '').toUpperCase().includes('JEE');
                                                    const isNEET = (exam.examType || '').toUpperCase().includes('NEET');
                                                    const target = isJEE ? 25 : isNEET ? 45 : (sa.targetQuestions || 60);

                                                    // Find submitted paper either directly or in allPapers
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

                                                    const subIcon = subName.toLowerCase().includes('physic') ? '⚛️'
                                                        : subName.toLowerCase().includes('chem') ? '🧪'
                                                        : subName.toLowerCase().includes('math') ? '📐'
                                                        : subName.toLowerCase().includes('botan') ? '🌿'
                                                        : subName.toLowerCase().includes('zool') ? '🐾'
                                                        : '🧬';

                                                    return (
                                                        <div key={idx} className={`border p-4 rounded-2xl bg-white flex flex-col justify-between shadow-xs transition ${
                                                            isReady ? 'border-emerald-300 ring-2 ring-emerald-50' : 'border-slate-200 hover:border-navy'
                                                        }`}>
                                                            <div>
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-lg">{subIcon}</span>
                                                                        <h5 className="text-xs font-black text-navy uppercase">{subName}</h5>
                                                                    </div>
                                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                        isReady ? 'bg-emerald-100 text-emerald-800' : count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                                                    }`}>
                                                                        {isReady ? 'Ready' : count > 0 ? 'In Progress' : 'Pending'}
                                                                    </span>
                                                                </div>

                                                                <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 mb-3 text-left">
                                                                    <div className="text-[11px] font-black text-navy uppercase tracking-wider flex items-center justify-between">
                                                                        <span>Format Quota</span>
                                                                        <span className="text-amber-600 font-bold">
                                                                            {isJEE ? '20 Sec A + 5 Sec B' : `${target} Qs`}
                                                                        </span>
                                                                    </div>
                                                                    {submittedPaper ? (
                                                                        <div className="text-[10px] text-emerald-700 font-bold mt-1 truncate" title={submittedPaper.title}>
                                                                            ✓ Saved: {submittedPaper.title || `${subName} - ${exam.title}`}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[10px] text-slate-400 font-medium mt-1">
                                                                            Select & compile {subName} questions
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="mb-2">
                                                                    <div className="flex justify-between text-[10px] font-black text-navy mb-1">
                                                                        <span>Progress</span>
                                                                        <span>{count} / {target} Qs ({pct}%)</span>
                                                                    </div>
                                                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden p-0.5 shadow-inner">
                                                                        <div
                                                                            style={{ width: `${pct}%` }}
                                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                                isReady ? 'bg-emerald-500' : count > 0 ? 'bg-blue-600' : 'bg-gray-300'
                                                                            }`}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                                                                {submittedPaperId ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => navigate(`/admin/dashboard/preview/${submittedPaperId}`)}
                                                                            className="flex-1 bg-navy text-gold hover:bg-slate-900 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition text-center cursor-pointer shadow-xs"
                                                                            title="View & Download PDF in single subject form"
                                                                        >
                                                                            👁 View / PDF
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => navigate(`/admin/dashboard/create-paper?examId=${exam._id || exam.id}&paperId=${submittedPaperId}&subject=${subName}&examType=${exam.examType || 'CET'}&examTitle=${encodeURIComponent(exam.title)}&classes=${encodeURIComponent(exam.classes ? (exam.classes.includes('11') && exam.classes.includes('12') ? 'Both' : exam.classes[0]) : '12')}`)}
                                                                            className="bg-slate-100 hover:bg-slate-200 text-navy py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition text-center cursor-pointer"
                                                                            title="Edit questions for this subject"
                                                                        >
                                                                            ✎ Edit
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => navigate(`/admin/dashboard/create-paper?examId=${exam._id || exam.id}&subject=${subName}&examType=${exam.examType || 'CET'}&examTitle=${encodeURIComponent(exam.title)}&classes=${encodeURIComponent(exam.classes ? (exam.classes.includes('11') && exam.classes.includes('12') ? 'Both' : exam.classes[0]) : '12')}`)}
                                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition text-center cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                                                                    >
                                                                        <span>✍️</span> Select & Create {subName} Paper →
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── SECTION 3: SAVED PAPERS (ORGANIZED BY SUBJECTS & COMPETITIVE EXAMS) ── */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden transition-all duration-300">
                {/* Master Box Header (Click to Open/Close) */}
                <div
                    onClick={() => setIsSavedPapersOpen(!isSavedPapersOpen)}
                    className="p-6 cursor-pointer hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-navy text-gold flex items-center justify-center text-2xl font-black shadow-inner shrink-0">
                            📁
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-lg text-navy uppercase tracking-tight">
                                    Saved Papers
                                </h3>
                                <span className="text-[10px] font-bold text-navy bg-gold/20 text-navy px-2.5 py-0.5 rounded-full border border-gold/40">
                                    {allPapers.length} Total Papers
                                </span>
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                    Filter: {savedPapersCategory === 'ALL' ? 'All Papers' : savedPapersCategory}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Browse and manage saved question papers: Individual Subjects (PCMB & BZ) and Competitive Exams (NEET, JEE, CET)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-auto">
                        <span className="text-xs font-bold text-slate-500 hidden sm:inline-block">
                            {isSavedPapersOpen ? 'Hide Saved Papers' : 'View Saved Papers'}
                        </span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base transition-all duration-300 ${
                            isSavedPapersOpen ? 'bg-navy text-gold rotate-180 shadow-md' : 'bg-slate-100 text-navy hover:bg-slate-200'
                        }`}>
                            ▾
                        </div>
                    </div>
                </div>

                {/* WHEN OPEN: CONTROLS, DROPDOWN, QUICK PILLS, AND PAPERS GRID */}
                {isSavedPapersOpen && (
                    <div className="p-6 pt-0 border-t border-slate-100 animate-fade-in bg-slate-50/40">
                        {/* Control Bar: Dropdown Selector & Search Filter */}
                        <div className="pt-4 pb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/70">
                            {/* Custom Modern Dropdown Selector */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                                <label className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                    <Filter className="w-3.5 h-3.5 text-navy" />
                                    <span>Filter Repository:</span>
                                </label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                        className="w-full sm:w-auto flex items-center justify-between gap-3 bg-white border-2 border-slate-200 hover:border-navy text-navy font-bold text-xs rounded-xl px-4 py-2 shadow-xs transition cursor-pointer select-none"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">
                                                {savedPapersCategory === 'ALL' ? '📁' :
                                                 savedPapersCategory === 'NEET' ? '🎯' :
                                                 savedPapersCategory === 'JEE' ? '⚡' :
                                                 savedPapersCategory === 'CET' ? '🏆' :
                                                 (departmentMeta[savedPapersCategory]?.icon || '📚')}
                                            </span>
                                            <span className="font-black text-navy">
                                                {savedPapersCategory === 'ALL' ? 'All Saved Papers' :
                                                 savedPapersCategory === 'NEET' ? 'NEET Papers' :
                                                 savedPapersCategory === 'JEE' ? 'JEE Papers' :
                                                 savedPapersCategory === 'CET' ? 'CET Papers' :
                                                 `${savedPapersCategory} (Individual Only)`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="bg-slate-100 text-slate-700 font-black text-[10px] px-2 py-0.5 rounded-full border border-slate-200">
                                                {getSavedCategoryCount(savedPapersCategory)}
                                            </span>
                                            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180 text-navy' : ''}`} />
                                        </div>
                                    </button>

                                    {/* Floating Dropdown Card */}
                                    {isCategoryDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-20" onClick={() => setIsCategoryDropdownOpen(false)} />
                                            <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2.5 z-30 animate-fade-in text-xs font-semibold">
                                                {/* All option */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setSavedPapersCategory('ALL'); setIsCategoryDropdownOpen(false); }}
                                                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                                                        savedPapersCategory === 'ALL' ? 'bg-navy text-gold font-black shadow-xs' : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">📁</span>
                                                        <span>All Saved Papers</span>
                                                    </div>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${savedPapersCategory === 'ALL' ? 'bg-gold/30 text-gold' : 'bg-slate-100 text-slate-600'}`}>
                                                        {allPapers.length}
                                                    </span>
                                                </button>

                                                <div className="my-2 border-t border-slate-100 px-2 pt-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Competitive Examinations
                                                </div>
                                                {['NEET', 'JEE', 'CET'].map(exam => {
                                                    const count = getSavedCategoryCount(exam);
                                                    const isAct = savedPapersCategory === exam;
                                                    const icon = exam === 'NEET' ? '🎯' : exam === 'JEE' ? '⚡' : '🏆';
                                                    return (
                                                        <button
                                                            key={exam}
                                                            type="button"
                                                            onClick={() => { setSavedPapersCategory(exam); setIsCategoryDropdownOpen(false); }}
                                                            className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                                                                isAct ? 'bg-navy text-gold font-black shadow-xs' : 'hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base">{icon}</span>
                                                                <span>{exam} Papers</span>
                                                            </div>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isAct ? 'bg-gold/30 text-gold' : 'bg-slate-100 text-slate-600'}`}>
                                                                {count}
                                                            </span>
                                                        </button>
                                                    );
                                                })}

                                                <div className="my-2 border-t border-slate-100 px-2 pt-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Multi-Subject Combinations
                                                </div>
                                                {[
                                                    { key: 'PCMB', label: 'PCMB (Phy, Chem, Math, Bio)', icon: '🧬' },
                                                    { key: 'BZ', label: 'BZ (Botany & Zoology)', icon: '🌿' }
                                                ].map(combo => {
                                                    const count = getSavedCategoryCount(combo.key);
                                                    const isAct = savedPapersCategory === combo.key;
                                                    return (
                                                        <button
                                                            key={combo.key}
                                                            type="button"
                                                            onClick={() => { setSavedPapersCategory(combo.key); setIsCategoryDropdownOpen(false); }}
                                                            className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                                                                isAct ? 'bg-navy text-gold font-black shadow-xs' : 'hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base">{combo.icon}</span>
                                                                <span>{combo.label}</span>
                                                            </div>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isAct ? 'bg-gold/30 text-gold' : 'bg-slate-100 text-slate-600'}`}>
                                                                {count}
                                                            </span>
                                                        </button>
                                                    );
                                                })}

                                                <div className="my-2 border-t border-slate-100 px-2 pt-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Individual Subjects (Isolated Only)
                                                </div>
                                                {subjects.map(sub => {
                                                    const count = getSavedCategoryCount(sub);
                                                    const isAct = savedPapersCategory === sub;
                                                    const meta = departmentMeta[sub] || {};
                                                    return (
                                                        <button
                                                            key={sub}
                                                            type="button"
                                                            onClick={() => { setSavedPapersCategory(sub); setIsCategoryDropdownOpen(false); }}
                                                            className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                                                                isAct ? 'bg-navy text-gold font-black shadow-xs' : 'hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base">{meta.icon || '📚'}</span>
                                                                <span>{sub} (Individual Only)</span>
                                                            </div>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isAct ? 'bg-gold/30 text-gold' : 'bg-slate-100 text-slate-600'}`}>
                                                                {count}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Search Filter Box */}
                            <div className="relative min-w-[260px]">
                                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Search className="w-3.5 h-3.5" />
                                </div>
                                <input
                                    type="text"
                                    value={savedPapersSearch}
                                    onChange={(e) => setSavedPapersSearch(e.target.value)}
                                    placeholder="Search saved papers by title or exam..."
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs text-navy placeholder:text-slate-400 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
                                />
                                {savedPapersSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setSavedPapersSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Quick Selection Pills */}
                        <div className="pt-3 pb-3 flex items-center gap-1.5 flex-wrap border-b border-slate-200/50">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                                Quick Select:
                            </span>
                            <button
                                type="button"
                                onClick={() => setSavedPapersCategory('ALL')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    savedPapersCategory === 'ALL'
                                        ? 'bg-navy text-gold shadow-xs font-black'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                            >
                                <span>📁</span>
                                <span>All</span>
                                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
                                    {allPapers.length}
                                </span>
                            </button>

                            {/* Competitive Exam Pills */}
                            {['NEET', 'JEE', 'CET'].map(exam => {
                                const count = getSavedCategoryCount(exam);
                                const isActive = savedPapersCategory === exam;
                                const icon = exam === 'NEET' ? '🎯' : exam === 'JEE' ? '⚡' : '🏆';
                                return (
                                    <button
                                        key={exam}
                                        type="button"
                                        onClick={() => setSavedPapersCategory(exam)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                            isActive
                                                ? 'bg-navy text-gold shadow-xs font-black'
                                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        <span>{icon}</span>
                                        <span>{exam}</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                                            isActive ? 'bg-gold/30 text-gold' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}

                            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                            {/* Multi-Subject Combination Pills */}
                            {[
                                { key: 'PCMB', label: 'PCMB', icon: '🧬' },
                                { key: 'BZ', label: 'BZ', icon: '🌿' }
                            ].map(combo => {
                                const count = getSavedCategoryCount(combo.key);
                                const isActive = savedPapersCategory === combo.key;
                                return (
                                    <button
                                        key={combo.key}
                                        type="button"
                                        onClick={() => setSavedPapersCategory(combo.key)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                            isActive
                                                ? 'bg-navy text-gold shadow-xs font-black'
                                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        <span>{combo.icon}</span>
                                        <span>{combo.label}</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                                            isActive ? 'bg-gold/30 text-gold' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}

                            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                            {/* Subject Pills */}
                            {subjects.map(sub => {
                                const count = getSavedCategoryCount(sub);
                                const isActive = savedPapersCategory === sub;
                                const meta = departmentMeta[sub] || {};
                                return (
                                    <button
                                        key={sub}
                                        type="button"
                                        onClick={() => setSavedPapersCategory(sub)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                            isActive
                                                ? 'bg-navy text-gold shadow-xs font-black'
                                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        <span>{meta.icon || '📚'}</span>
                                        <span>{sub}</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                                            isActive ? 'bg-gold/30 text-gold' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active Category Header Banner */}
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

                            return (
                                <div className="pt-4">
                                    {/* Category Context Info */}
                                    <div className="mb-4 p-3 rounded-2xl bg-white border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xl">
                                                {savedPapersCategory === 'ALL' ? '📁' :
                                                 savedPapersCategory === 'NEET' ? '🎯' :
                                                 savedPapersCategory === 'JEE' ? '⚡' :
                                                 savedPapersCategory === 'CET' ? '🏆' :
                                                 (departmentMeta[savedPapersCategory]?.icon || '📚')}
                                            </span>
                                            <div>
                                                <h4 className="font-black text-navy text-sm">
                                                    {savedPapersCategory === 'ALL' ? 'All Saved Question Papers' :
                                                     savedPapersCategory === 'NEET' ? 'NEET Assessment Papers' :
                                                     savedPapersCategory === 'JEE' ? 'JEE Examination Papers' :
                                                     savedPapersCategory === 'CET' ? 'CET / KCET Question Papers' :
                                                     `${savedPapersCategory} (Individual Subject Papers)`}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    {isIndividual
                                                        ? `Strictly showing papers created for ${savedPapersCategory} alone. Competitive exams (NEET/JEE/CET) are excluded.`
                                                        : savedPapersCategory === 'ALL'
                                                        ? 'Showing all institutional question papers across all categories.'
                                                        : `Showing all saved ${savedPapersCategory} question papers.`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                            <span className="text-xs font-black text-navy bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
                                                {filteredPapers.length} {filteredPapers.length === 1 ? 'Paper Found' : 'Papers Found'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Papers Responsive Grid */}
                                    {filteredPapers.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {filteredPapers.map(p => {
                                                const pId = p._id || p.id;
                                                const qCount = Array.isArray(p.questions) ? p.questions.length : 0;
                                                const dt = formatPaperDateTime(p.createdAt || p.created_at);
                                                const isDeleting = deletingPaperId === pId;

                                                const examBadgeColor = 
                                                    isNeetPaper(p) ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                    isJeePaper(p) ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    isCetPaper(p) ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    p.examType === 'ASSIGNMENT' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200';

                                                return (
                                                    <div
                                                        key={pId}
                                                        onClick={() => navigate(`/admin/dashboard/preview/${pId}`)}
                                                        className="group bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 hover:border-navy hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between relative"
                                                    >
                                                        {/* Top Row: Exam Type, Subject, and Delete Button */}
                                                        <div>
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase ${examBadgeColor}`}>
                                                                        {p.examType || p.exam_type || 'PAPER'}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                                        {p.subject || 'All Subjects'}
                                                                    </span>
                                                                </div>

                                                                {/* Delete Icon Button */}
                                                                <button
                                                                    type="button"
                                                                    disabled={isDeleting}
                                                                    onClick={(e) => handleDeletePaper(e, p)}
                                                                    title="Delete Paper"
                                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer shrink-0"
                                                                >
                                                                    {isDeleting ? (
                                                                        <span className="animate-spin text-xs">⏳</span>
                                                                    ) : (
                                                                        <Trash2 className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                            </div>

                                                            {/* Paper Title / Name */}
                                                            <h5
                                                                className="font-black text-navy text-sm leading-snug line-clamp-2 group-hover:text-blue-700 transition"
                                                                title={p.title || 'Untitled Question Paper'}
                                                            >
                                                                {p.title || 'Untitled Question Paper'}
                                                            </h5>

                                                            {/* Creation Date & Time */}
                                                            <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                                    <span className="font-semibold">{dt.date}</span>
                                                                </div>
                                                                {dt.time && (
                                                                    <div className="flex items-center gap-1 text-slate-500">
                                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                        <span>{dt.time}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Metadata: Classes & Question Count */}
                                                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
                                                                <span className="font-semibold text-slate-600">
                                                                    🏛️ {p.classes?.length ? `Class ${p.classes.join(', ')}` : 'Class 12'}
                                                                </span>
                                                                <span className="font-bold text-navy bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                                                    📝 {qCount} Questions
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Bottom Action Buttons */}
                                                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate(`/admin/dashboard/preview/${pId}`);
                                                                }}
                                                                className="flex-1 bg-navy text-gold hover:bg-navy/90 py-1.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition text-center cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                                <span>View Paper</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedAnalysisExam({
                                                                        title: p.title || `${p.subject || 'Saved'} Question Paper`,
                                                                        allQuestions: p.questions || [],
                                                                        examType: p.examType || p.exam_type || 'CET'
                                                                    });
                                                                }}
                                                                className="bg-amber-50 hover:bg-amber-100 text-navy border border-amber-200 py-1.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                                                                title="View Paper Analysis"
                                                            >
                                                                <span>📊</span> Stats
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-12 px-4 text-center rounded-2xl bg-white border border-dashed border-slate-200">
                                            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                                <AlertCircle className="w-6 h-6" />
                                            </div>
                                            <h5 className="font-bold text-sm text-navy">
                                                {savedPapersSearch.trim()
                                                    ? `No papers match "${savedPapersSearch}" in ${savedPapersCategory}`
                                                    : `No papers saved under ${savedPapersCategory}`}
                                            </h5>
                                            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                                {isIndividual
                                                    ? `Only papers created purely for ${savedPapersCategory} appear here. Competitive tests like NEET, JEE, or CET are kept in their own exam categories.`
                                                    : `There are currently no papers cataloged under ${savedPapersCategory}.`}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSavedPapersCategory('ALL');
                                                    setSavedPapersSearch('');
                                                }}
                                                className="mt-4 px-4 py-2 rounded-xl bg-navy text-gold text-xs font-bold uppercase tracking-wider hover:bg-navy/90 transition cursor-pointer"
                                            >
                                                View All Saved Papers ({allPapers.length})
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

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
const AdminAssignmentWrapper = () => {
    const navigate = useNavigate();
    const subjectParam = window.location.pathname.split('/').pop();
    const subject = decodeURIComponent(subjectParam || 'Physics');
    return (
        <AssignmentGenerator
            onBack={() => navigate('/admin/dashboard')}
            adminMode={true}
            adminSubject={subject}
        />
    );
};

const AdminNotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // 30s low-overhead polling
        return () => clearInterval(interval);
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleMarkAsRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error('Error marking notification read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Error marking all read:', err);
        }
    };

    const handleReview = async (notif) => {
        await handleMarkAsRead(notif.id);
        setIsOpen(false);
        if (notif.related_paper_id) {
            navigate(`/admin/dashboard/preview/${notif.related_paper_id}`);
        } else {
            navigate('/admin/dashboard/cbt-exams');
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-gold/30 text-gold transition flex items-center justify-center cursor-pointer"
                title="Notifications"
            >
                <span className="text-base">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border-2 border-gold/40 z-[100] text-gray-800 overflow-hidden animate-fade-in-up">
                    <div className="p-3.5 bg-navy text-white flex justify-between items-center border-b border-gold/20">
                        <div className="flex items-center gap-2">
                            <span className="text-gold text-sm font-black uppercase tracking-wider">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="bg-gold text-navy text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-gold/80 hover:text-gold font-bold underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-xs font-medium">
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.slice(0, 15).map(n => (
                                <div
                                    key={n.id}
                                    className={`p-3.5 transition flex flex-col gap-1.5 ${n.is_read ? 'bg-white hover:bg-gray-50/80' : 'bg-blue-50/70 hover:bg-blue-50 border-l-4 border-l-gold'}`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-bold text-xs text-navy leading-snug">
                                            {n.title}
                                        </h4>
                                        <span className="text-[9px] text-gray-400 font-semibold whitespace-nowrap">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                        {n.message}
                                    </p>
                                    <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-gray-100/60">
                                        <span className="text-[9px] text-gray-400 font-semibold">
                                            Teacher: {n.sender_name}
                                        </span>
                                        <button
                                            onClick={() => handleReview(n)}
                                            className="bg-navy hover:bg-gold hover:text-navy text-gold text-[10px] font-black px-3 py-1 rounded-lg transition shadow-xs uppercase tracking-wider flex items-center gap-1"
                                        >
                                            <span>Review Now</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {

    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [isSideboxOpen, setIsSideboxOpen] = useState(false);

    const navItems = [
        {
            group: 'Examination Operations',
            items: [
                { title: 'Executive Overview', path: '/admin/dashboard', icon: '📋', desc: 'Delegation & readiness dashboard' },
                { title: 'Create Question Paper', path: '/admin/dashboard/create-paper', icon: '✍️', desc: 'Create single or mixed-subject papers' },
                { title: 'OMR Evaluation & Scanner', path: '/admin/dashboard/omr', icon: '📑', desc: 'Scan physical OMR sheets & merit lists' },
                { title: 'CBT Online Exams', path: '/admin/dashboard/cbt-exams', icon: '⚡', desc: 'Manage & monitor online exams' },
                { title: 'Results & Scorecards', path: '/admin/dashboard/results', icon: '📊', desc: 'View student scores and analytics' }
            ]
        },
        {
            group: 'Academic Vault',
            items: [
                { title: 'Question Bank', path: '/admin/dashboard/questions', icon: '📚', desc: 'Institutional question repository' },
                { title: 'Grand Test Papers', path: '/admin/dashboard/grand-tests', icon: '🏆', desc: 'Archive of official grand tests' },
                { title: 'Previous Year Papers', path: '/admin/dashboard/previous-year-papers', icon: '📑', desc: 'PYQs repository & keys' },
                { title: 'Exam Blueprints', path: '/admin/dashboard/exam-blueprints', icon: '📐', desc: 'Chapter weightage & patterns' },
                { title: 'Document Templates', path: '/admin/dashboard/upload-template', icon: '📄', desc: 'Institutional paper formatting' }
            ]
        }
    ];

    // Current page label
    const getCurrentPageTitle = () => {
        if (location.pathname.includes('create-paper')) return 'Create Question Paper';
        if (location.pathname.includes('omr')) return 'OMR Sheet Evaluation';
        if (location.pathname.includes('cbt-exams')) return 'CBT Online Exams';
        if (location.pathname.includes('results')) return 'Result Scorecards';
        if (location.pathname.includes('questions')) return 'Question Bank';
        if (location.pathname.includes('grand-tests')) return 'Grand Tests';
        if (location.pathname.includes('previous-year-papers')) return 'Previous Year Papers';
        if (location.pathname.includes('exam-blueprints')) return 'Exam Blueprints';
        if (location.pathname.includes('upload-template')) return 'Templates';
        
        return 'Executive Overview';
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">

            {/* ── LEFT-SIDE SLIDE-OVER SIDEBOX DRAWER ── */}
            <div className={`fixed inset-0 z-50 transition-all duration-300 ${isSideboxOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
                {/* Backdrop Overlay */}
                <div 
                    onClick={() => setIsSideboxOpen(false)}
                    className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${isSideboxOpen ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* Sidebox Panel (Slides in from LEFT) */}
                <aside className={`absolute top-0 left-0 h-full w-88 max-w-[85vw] bg-[#071738] text-white shadow-2xl border-r-4 border-amber-400 flex flex-col justify-between transition-transform duration-300 ease-out ${isSideboxOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div>
                        {/* Sidebox Top Brand Bar */}
                        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white p-1 border border-amber-400/50 shadow-md flex items-center justify-center">
                                    <img src="/SapthagiriLogo.jpg" alt="Logo" className="w-full h-full object-contain rounded-lg" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-tight text-white leading-none">Sapthagiri PU College</h2>
                                    <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest mt-1 block">Admin Console Menu</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsSideboxOpen(false)}
                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
                                title="Close Menu"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Navigation Options List */}
                        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
                            {navItems.map((group, gIdx) => (
                                <div key={gIdx}>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/70 px-3 block mb-2">
                                        {group.group}
                                    </span>
                                    <div className="space-y-1">
                                        {group.items.map((item, iIdx) => {
                                            const isActive = item.path === '/admin/dashboard'
                                                ? (location.pathname === '/admin/dashboard' || location.pathname === '/admin/dashboard/')
                                                : location.pathname.includes(item.path.split('/').pop());

                                            return (
                                                <button
                                                    key={iIdx}
                                                    onClick={() => {
                                                        navigate(item.path);
                                                        setIsSideboxOpen(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left transition cursor-pointer ${
                                                        isActive
                                                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md'
                                                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    <span className="text-lg leading-none">{item.icon}</span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`text-xs font-bold leading-tight ${isActive ? 'text-slate-950' : 'text-white'}`}>
                                                            {item.title}
                                                        </div>
                                                        <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-slate-900/80 font-semibold' : 'text-slate-400'}`}>
                                                            {item.desc}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebox Bottom User & Logout */}
                    <div className="p-4 border-t border-white/10 bg-black/30 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow">
                                AD
                            </div>
                            <div>
                                <div className="text-xs font-black text-white leading-tight">Admin Console</div>
                                <div className="text-[10px] text-slate-400 font-mono">Davanagere Campus</div>
                            </div>
                        </div>
                        <button
                            onClick={() => { logout(); navigate('/'); }}
                            className="bg-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                        >
                            Logout
                        </button>
                    </div>
                </aside>
            </div>

            {/* ── TOP APP BAR — SAPTHAGIRI NAVY & GOLD WITH LEFT-ALIGNED HAMBURGER MENU ── */}
            <nav className="bg-[#081B3B] px-6 py-3.5 text-white flex justify-between items-center z-40 sticky top-0 shadow-2xl border-b-4 border-amber-500 backdrop-blur-md">
                {/* Left Brand Area */}
                <div className="flex items-center gap-3.5">
                    {/* LEFT-SIDE HAMBURGER MENU BUTTON */}
                    <button
                        onClick={() => setIsSideboxOpen(true)}
                        className="relative bg-amber-400 text-slate-950 hover:bg-amber-300 w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg hover:scale-105 transition shadow-lg cursor-pointer"
                        title="Open Admin Dashboard Menu"
                    >
                        <span className="text-xl leading-none">☰</span>
                        <span className="absolute -top-1 -right-1 bg-navy text-amber-400 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none border border-amber-400">
                            A
                        </span>
                    </button>

                    <div 
                        className="flex items-center cursor-pointer hover:opacity-90 transition gap-3"
                        onClick={() => navigate('/admin/dashboard')}
                    >
                        <div className="w-10 h-10 flex items-center justify-center shadow-lg bg-white rounded-xl p-1 border-2 border-amber-400">
                            <img src="/SapthagiriLogo.jpg" alt="Logo" className="w-full h-full object-contain rounded-lg" />
                        </div>
                        <div>
                            <h1 className="text-base font-black tracking-tight uppercase leading-tight text-white flex items-center gap-2">
                                <span>Sapthagiri PU College</span>
                                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    Admin Portal
                                </span>
                            </h1>
                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                                {getCurrentPageTitle()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Navigation & Dashboard Menu Controls */}
                <div className="flex items-center gap-2.5">
                    {location.pathname !== '/admin/dashboard' && location.pathname !== '/admin/dashboard/' && (
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="bg-white/5 border border-amber-400/30 text-amber-400 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer mr-1"
                        >
                            <span>←</span> Back to Dashboard
                        </button>
                    )}

                    {/* Admin Notification Bell */}
                    <AdminNotificationBell />

                    <div className="w-px h-7 bg-amber-400/20 mx-1"></div>

                    {/* Logout Button */}
                    <button 
                        onClick={() => { logout(); navigate('/'); }} 
                        className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm cursor-pointer"
                        title="Sign Out"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            {/* ── MAIN CONTENT OUTLET ── */}
            <div className="flex-1 p-6 sm:p-10 max-w-7xl mx-auto w-full">
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
            </div>
        </div>
    );
};

export default AdminDashboard;

