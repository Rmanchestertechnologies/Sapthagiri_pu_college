import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import UploadTemplate from './UploadTemplate';
import CreateTeacher from './CreateTeacher';
import SubjectDetails from './SubjectDetails';
import AdminPaperPreview from './AdminPaperPreview';
import ExamManagement from './ExamManagement';
import AdminResults from './AdminResults';
import GrandTestList from './GrandTestList';
import PreviousYearPapers from './PreviousYearPapers';
import ExamBlueprints from './ExamBlueprints';
import AssignmentGenerator from '../teacher/AssignmentGenerator';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import MathRenderer from '../../components/MathRenderer';
import api from '../../api';

const DashboardHome = () => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // Subject Directory strictly PCMB
    const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Mathematics': '/mathslogo.jpeg',
        'Maths': '/mathslogo.jpeg'
    };

    const [commissionedExams, setCommissionedExams] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const fetchData = async () => {
        try {
            const [teachersRes, examsRes] = await Promise.all([
                api.get('/api/admin/teachers'),
                api.get('/api/exams/commissioned')
            ]);
            setAllTeachers(teachersRes.data || []);
            const examsList = examsRes.data || [];
            setCommissionedExams(examsList);
            if (examsList.length > 0) {
                setSelectedExamId(prev => (prev && examsList.some(e => e._id === prev) ? prev : examsList[0]._id));
            }
            setLoading(false);
        } catch (err) {
            console.error('Error fetching admin dashboard data:', err);
            if (err.response && [400, 401, 403].includes(err.response.status)) {
                logout();
                navigate('/');
            }
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

            const subjectAssignments = subjectsNeeded.map(subName => {
                const assignedTeacherId = commissionForm.assignedTeachers[subName];
                const teacherObj = allTeachers.find(t => (t._id || t.id) === assignedTeacherId) || allTeachers.find(t => (t.subject || '').toLowerCase().includes(subName.toLowerCase()));
                return {
                    subject: subName,
                    teacherId: teacherObj ? (teacherObj._id || teacherObj.id) : undefined,
                    teacherName: teacherObj ? teacherObj.name : `Prof. ${subName} Faculty`,
                    teacherEmail: teacherObj ? teacherObj.email : `${subName.toLowerCase()}@sapthagiripucollege.edu.in`,
                    targetQuestions: commissionForm.targetPerSubject || 60,
                    status: 'Pending'
                };
            });

            const res = await api.post('/api/exams/commission', {
                title: commissionForm.title,
                examType: commissionForm.examType,
                classes: commissionForm.classes,
                subjectAssignments,
                duration_minutes: 180
            });

            alert(`✓ Exam "${commissionForm.title}" successfully commissioned! Access granted to assigned faculty.`);
            setShowCommissionModal(false);
            setCommissionForm({
                title: '',
                examType: 'CET',
                classes: ['12'],
                targetPerSubject: 60,
                assignedTeachers: {}
            });
            if (res.data?._id) setSelectedExamId(res.data._id);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to commission exam. Please try again.');
        }
    };

    const handleDeleteExam = async (examId) => {
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

    const activeExam = commissionedExams.find(e => e._id === selectedExamId) || commissionedExams[0];

    return (
        <div className="animate-fade-in-up space-y-10">

            {/* Top Welcome Card with Action Bar */}
            <div className="bg-surface p-8 rounded-3xl shadow-sm border-l-8 border-navy relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16"></div>
                <div>
                    <h3 className="font-black text-2xl text-navy mb-2">Welcome to the Administration</h3>
                    <p className="text-slate/70 font-medium text-sm max-w-2xl leading-relaxed">
                        Manage institutional examinations, track PCMB question delegation, and monitor faculty progress in real-time.
                    </p>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                    <button
                        onClick={() => setShowCommissionModal(true)}
                        className="bg-navy text-gold px-7 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2.5 border-2 border-gold cursor-pointer"
                    >
                        <span className="text-base">⚡</span> Create & Commission Exam
                    </button>
                </div>
            </div>

            {/* ── SECTION 1: SINGLE UNIFIED EXAMS CARD (LIST & 3/4 SUBJECT PROGRESS BOXES INSIDE) ── */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-200 relative overflow-hidden space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">
                            EXAMS & DEPARTMENT PROGRESS
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate/40">{commissionedExams.length} Commissioned Assessments</span>
                        <button
                            onClick={() => setShowCommissionModal(true)}
                            className="bg-gold text-navy px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider hover:scale-105 transition shadow-sm cursor-pointer"
                        >
                            + New Exam
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate/40 font-bold text-sm">
                        Loading exam progress...
                    </div>
                ) : commissionedExams.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-gray-200 rounded-[2rem] text-center">
                        <div className="w-16 h-16 bg-navy/5 text-navy rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 font-black">🎓</div>
                        <h4 className="font-black text-navy text-lg mb-1">No Commissioned Exams Yet</h4>
                        <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">Create your first exam (e.g. CET MOCK 1) and delegate question targets to PCMB faculty.</p>
                        <button
                            onClick={() => setShowCommissionModal(true)}
                            className="bg-gold text-navy px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg cursor-pointer"
                        >
                            + Create Exam
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ── EXAM SELECTOR TABS (CLICK TO SWITCH BETWEEN EXAMS) ── */}
                        <div className="flex items-center gap-3 overflow-x-auto pb-2 border-b border-gray-100">
                            <span className="text-xs font-black text-navy uppercase tracking-wider whitespace-nowrap mr-1">
                                Select Exam:
                            </span>
                            {commissionedExams.map((exam) => {
                                const isSelected = (activeExam?._id === exam._id);
                                const subAssignments = exam.subjectAssignments || [];
                                const totalTarget = subAssignments.reduce((sum, sa) => sum + (sa.targetQuestions || 60), 0);
                                const totalAdded = exam.totalQuestionsAdded !== undefined
                                    ? exam.totalQuestionsAdded
                                    : subAssignments.reduce((sum, sa) => sum + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0);
                                const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAdded / totalTarget) * 100)) : 0;

                                return (
                                    <button
                                        key={exam._id}
                                        onClick={() => setSelectedExamId(exam._id)}
                                        className={`px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
                                            isSelected
                                                ? 'bg-navy text-gold shadow-md scale-105 border-2 border-gold'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-gold"></span>
                                        <span>{exam.title}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-black ${
                                            isSelected ? 'bg-white/20 text-white' : 'bg-white text-navy'
                                        }`}>
                                            {overallPct}%
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── ACTIVE EXAM DETAILS & 3/4 PCMB SUBJECT PROGRESS BOXES ── */}
                        {activeExam && (() => {
                            const exam = activeExam;
                            const subAssignments = exam.subjectAssignments || [];
                            const totalTarget = subAssignments.reduce((sum, sa) => sum + (sa.targetQuestions || 60), 0);
                            const totalAdded = exam.totalQuestionsAdded !== undefined
                                ? exam.totalQuestionsAdded
                                : subAssignments.reduce((sum, sa) => sum + (sa.questionsCount || (sa.submittedPaperId?.questions?.length || 0)), 0);
                            const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAdded / totalTarget) * 100)) : 0;

                            return (
                                <div className="space-y-6 animate-fade-in pt-2">
                                    {/* Active Exam Header Banner */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                                <span className="bg-navy text-gold text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg shadow-sm">
                                                    {exam.examType || 'CET'}
                                                </span>
                                                <h3 className="font-black text-2xl text-navy uppercase tracking-tight">{exam.title}</h3>
                                                <span className="text-[10px] font-bold text-slate/50 bg-white px-2.5 py-1 rounded-md border border-gray-200">
                                                    Class {exam.classes?.join(', ') || '12'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 font-medium">
                                                Created: {new Date(exam.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>

                                        {/* Action Controls */}
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <button
                                                onClick={() => setSelectedViewExam(exam)}
                                                className="bg-navy text-gold px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-md flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>👁</span> View Full Paper ({totalAdded} Qs)
                                            </button>
                                            <button
                                                onClick={() => setSelectedAnalysisExam(exam)}
                                                className="bg-gold text-navy px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-md flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>📊</span> Paper Analysis
                                            </button>
                                            <button
                                                onClick={() => handleDeleteExam(exam._id)}
                                                className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-3.5 py-2.5 rounded-xl font-black text-xs transition shadow-sm cursor-pointer"
                                                title="Delete this exam"
                                            >
                                                ✕ Delete
                                            </button>
                                        </div>
                                    </div>

                                    {/* Overall Assessment Progress Bar */}
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                                        <div className="flex justify-between items-center text-xs font-black text-navy mb-2">
                                            <span>Overall Assessment Compilation Progress</span>
                                            <span>{totalAdded} / {totalTarget} Questions ({overallPct}%)</span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden p-0.5 shadow-inner">
                                            <div
                                                style={{ width: `${overallPct}%` }}
                                                className={`h-full rounded-full transition-all duration-500 ${overallPct >= 100 ? 'bg-emerald-500' : overallPct >= 50 ? 'bg-blue-600' : 'bg-amber-500'}`}
                                            />
                                        </div>
                                    </div>

                                    {/* ── 3 OR 4 PCMB SUBJECT PROGRESS BOXES (INSIDE EXAM) ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                        {subAssignments.map((sa, idx) => {
                                            const subName = sa.subject;
                                            const target = sa.targetQuestions || 60;
                                            const count = sa.questionsCount !== undefined
                                                ? sa.questionsCount
                                                : (sa.submittedPaperId?.questions?.length || 0);
                                            const pct = Math.min(100, Math.round((count / target) * 100));

                                            const subIcon = subName.toLowerCase().includes('physic') ? '⚛️'
                                                : subName.toLowerCase().includes('chem') ? '🧪'
                                                : subName.toLowerCase().includes('math') ? '📐'
                                                : subName.toLowerCase().includes('botan') ? '🌿'
                                                : subName.toLowerCase().includes('zool') ? '🐾'
                                                : '🧬';

                                            return (
                                                <div key={idx} className="border-2 border-navy/10 p-5 rounded-2xl bg-white flex flex-col justify-between hover:border-navy/40 transition shadow-sm">
                                                    <div>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl">{subIcon}</span>
                                                                <h4 className="text-base font-black text-navy uppercase">{subName}</h4>
                                                            </div>
                                                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${pct >= 100 ? 'bg-emerald-100 text-emerald-800' : pct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                                                {pct >= 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Pending'}
                                                            </span>
                                                        </div>

                                                        {/* Archivist Teacher Name & Email */}
                                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 mb-3 text-left">
                                                            <div className="text-[11px] font-bold text-navy truncate">
                                                                👤 {sa.teacherName || `Prof. ${subName} Faculty`}
                                                            </div>
                                                            <div className="text-[10px] text-blue-600 font-mono truncate mt-0.5">
                                                                ✉ {sa.teacherEmail || `${subName.toLowerCase()}@sapthagiripucollege.edu.in`}
                                                            </div>
                                                        </div>

                                                        {/* Question Progress Bar */}
                                                        <div className="mb-2">
                                                            <div className="flex justify-between text-[11px] font-black text-navy mb-1">
                                                                <span>Questions</span>
                                                                <span>{count} / {target} Qs ({pct}%)</span>
                                                            </div>
                                                            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden p-0.5 shadow-inner">
                                                                <div
                                                                    style={{ width: `${pct}%` }}
                                                                    className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-600' : 'bg-gray-300'}`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                        <span>Target</span>
                                                        <span className="text-navy font-black">{target} Qs</span>
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

            {/* ── SECTION 2: SUBJECT DIRECTORY (STRICTLY PCMB) ── */}
            <div>
                <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">Subject Directory (PCMB)</h2>
                    <div className="h-px flex-1 bg-gray-200"></div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {subjects.map(sub => (
                        <Link 
                            to={`/admin/dashboard/subject/${sub}`}
                            key={sub}
                            className="bg-surface p-8 rounded-3xl shadow-sm text-center font-black text-lg transition border border-gray-100 text-slate hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 flex flex-col items-center justify-center gap-4 group"
                        >
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-110 transition-transform duration-300 bg-white p-2">
                                <img 
                                    src={logoMap[sub] || '/physicslogo.jpeg'} 
                                    alt={sub} 
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.parentNode.innerHTML = `<div class="bg-gray-50 text-gold w-full h-full flex items-center justify-center text-2xl font-black">${sub.charAt(0)}</div>`;
                                    }}
                                />
                            </div>
                            {sub}
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── MODAL: CREATE & COMMISSION EXAM ── */}
            {showCommissionModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-8 border-b border-gray-100 bg-gray-50/60">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Admin Commissioning Engine</span>
                                <h2 className="text-2xl font-black text-navy mt-2 uppercase tracking-tight">Create & Delegate Exam Assignment</h2>
                                <p className="text-xs text-gray-500 font-medium mt-1">Set the exam title and delegate question targets to authorized PCMB faculty.</p>
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
                                        value={commissionForm.classes[0]}
                                        onChange={e => setCommissionForm({ ...commissionForm, classes: [e.target.value] })}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="12">Class 12</option>
                                        <option value="11">Class 11</option>
                                    </select>
                                </div>
                            </div>

                            {/* Per-Subject Faculty Assignment */}
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                                <h4 className="text-xs font-black text-navy uppercase tracking-widest flex items-center gap-2">
                                    <span>👥</span> Assign Subject Faculty (PCMB Authorized Staff)
                                </h4>

                                {(() => {
                                    let subs = [];
                                    if (commissionForm.examType === 'NEET') subs = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
                                    else if (commissionForm.examType === 'JEE') subs = ['Physics', 'Chemistry', 'Mathematics'];
                                    else subs = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

                                    return subs.map(subName => {
                                        const subTeachers = allTeachers.filter(t => {
                                            const tSub = (t.subject || '').toLowerCase();
                                            const sName = subName.toLowerCase();
                                            // Bidirectional match (same as SubjectDetails.jsx)
                                            const fwd = tSub.includes(sName) || sName.includes(tSub);
                                            if (fwd) return true;
                                            // Extra aliases
                                            if (sName === 'mathematics' && (tSub.includes('math') || tSub === 'maths')) return true;
                                            if ((sName === 'botany' || sName === 'zoology') && (tSub.includes('bio') || tSub.includes(sName))) return true;
                                            return false;
                                        });

                                        return (
                                            <div key={subName} className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 min-w-[140px]">
                                                    <span className="w-8 h-8 bg-navy text-gold rounded-xl flex items-center justify-center font-black text-xs">
                                                        {subName.charAt(0)}
                                                    </span>
                                                    <span className="font-black text-sm text-navy uppercase">{subName}</span>
                                                </div>

                                                <div className="flex-1">
                                                    <select
                                                        value={commissionForm.assignedTeachers[subName] || ''}
                                                        onChange={e => setCommissionForm({
                                                            ...commissionForm,
                                                            assignedTeachers: { ...commissionForm.assignedTeachers, [subName]: e.target.value }
                                                        })}
                                                        className="w-full border border-gray-200 focus:border-navy rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none bg-gray-50/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Assign {subName} Teacher --</option>
                                                        {subTeachers.map(t => (
                                                            <option key={t._id || t.id} value={t._id || t.id}>
                                                                {t.name} ({t.email})
                                                            </option>
                                                        ))}
                                                        {subTeachers.length === 0 && (
                                                            <option value="" disabled>No registered {subName} faculty (will use department lead)</option>
                                                        )}
                                                    </select>
                                                </div>

                                                <div className="text-right text-[11px] font-bold text-slate/50">
                                                    Target: {commissionForm.targetPerSubject} Qs
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Submit & Dispatch */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCommissionModal(false)}
                                    className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 rounded-xl bg-gold text-navy font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg"
                                >
                                    Proceed & Dispatch to Faculty
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
                                        <div key={q._id || qIdx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-black text-navy bg-gold/20 px-2.5 py-1 rounded">Q{qIdx + 1}. [{q.subject || 'Physics'}]</span>
                                                <span className="text-gray-500 font-bold text-[10px] uppercase">{q.type || 'MCQ'} • {q.level || 'medium'}</span>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-800 leading-relaxed">
                                                <MathRenderer text={q.questionText || ''} />
                                            </div>
                                            {q.options && q.options.length > 0 && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                                                    {q.options.map((opt, oIdx) => (
                                                        <div key={oIdx} className="p-2.5 rounded-xl border border-gray-200 text-xs flex items-start gap-2 bg-gray-50/50">
                                                            <span className="font-bold text-navy">({String.fromCharCode(65 + oIdx)})</span>
                                                            <MathRenderer inline text={opt || ''} />
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
            navigate('/admin/dashboard/exams');
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
                <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border-2 border-gold/40 z-50 text-gray-800 overflow-hidden animate-fade-in-up">
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

    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
            {/* Top Navigation Bar - Sapthagiri Navy & Gold */}
            <nav className="bg-[#081B3B] p-4 text-white flex justify-between items-center z-10 shadow-2xl border-b-4 border-amber-500">
                <div 
                    className="flex items-center cursor-pointer hover:opacity-90 transition gap-4 ml-4"
                    onClick={() => navigate('/admin/dashboard')}
                >
                    <div className="w-12 h-12 flex items-center justify-center shadow-lg bg-white rounded-xl p-1 border-2 border-amber-400">
                        <img src="/SapthagiriLogo.jpg" alt="Sapthagiri PU College" className="w-full h-full object-contain rounded-lg" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight uppercase leading-tight text-white">
                            Sapthagiri PU College
                        </h1>
                        <p className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest">
                            Admin Portal • Davanagere
                        </p>
                    </div>
                </div>
                
                <div className="space-x-3 flex items-center mr-4">
                    <Link 
                        to="/admin/dashboard/grand-tests" 
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${location.pathname.includes('grand-tests') ? 'bg-amber-500 text-[#081B3B] shadow-lg' : 'bg-white/5 text-amber-300 border border-amber-400/30 hover:bg-white/10'}`}
                    >
                        GT Papers
                    </Link>
                    <Link 
                        to="/admin/dashboard/previous-year-papers" 
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${location.pathname.includes('previous-year-papers') ? 'bg-amber-500 text-[#081B3B] shadow-lg' : 'bg-white/5 text-amber-300 border border-amber-400/30 hover:bg-white/10'}`}
                    >
                        PYQs
                    </Link>
                    <Link 
                        to="/admin/dashboard/exam-blueprints" 
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${location.pathname.includes('exam-blueprints') ? 'bg-amber-500 text-[#081B3B] shadow-lg' : 'bg-white/5 text-amber-300 border border-amber-400/30 hover:bg-white/10'}`}
                    >
                        Blueprints
                    </Link>
                    <Link 
                        to="/admin/dashboard/upload-template" 
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition flex items-center gap-2 ${location.pathname.includes('upload-template') ? 'bg-amber-500 text-[#081B3B] shadow-lg' : 'bg-white/5 text-amber-300 border border-amber-400/30 hover:bg-white/10'}`}
                    >
                        Templates
                    </Link>
                    <Link 
                        to="/admin/dashboard/create-teacher" 
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition flex items-center gap-2 ${location.pathname.includes('create-teacher') ? 'bg-amber-500 text-[#081B3B] shadow-lg' : 'bg-white/5 text-amber-300 border border-amber-400/30 hover:bg-white/10'}`}
                    >
                        + Faculty
                    </Link>

                    {/* Notification Center */}
                    <AdminNotificationBell />

                    <div className="w-px h-8 bg-amber-400/20 mx-2"></div>
                    <button 
                        onClick={() => { logout(); navigate('/'); }} 
                        className="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all shadow-sm cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="flex-1 p-10 max-w-7xl mx-auto w-full">
                <Routes>
                    <Route path="/" element={<DashboardHome />} />
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
