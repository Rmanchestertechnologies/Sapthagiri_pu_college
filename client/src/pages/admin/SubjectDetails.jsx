import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';

const SubjectDetails = () => {
    const { subject } = useParams();
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [teachers, setTeachers] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('papers');
    const [selectedAnalysisPaper, setSelectedAnalysisPaper] = useState(null);

    const [showCommissionModal, setShowCommissionModal] = useState(false);
    const [commissionForm, setCommissionForm] = useState({
        title: '',
        examType: 'CET',
        classes: ['12'],
        targetPerSubject: 60,
        difficultyDistribution: { easy: 40, medium: 40, hard: 20 },
        assignedTeachers: {}
    });

    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Maths': '/mathslogo.jpeg',
        'Mathematics': '/mathslogo.jpeg'
    };

    const fetchData = async () => {
        try {
            const [teachersRes, papersRes] = await Promise.all([
                api.get('/api/admin/teachers').catch(() => ({ data: [] })),
                api.get('/api/papers/admin/all').catch(() => ({ data: [] }))
            ]);
            const allT = Array.isArray(teachersRes.data) ? teachersRes.data : [];
            const allP = Array.isArray(papersRes.data) ? papersRes.data : [];

            const isSubMatch = (tSub, targetSub) => {
                if (!tSub || !targetSub) return false;
                const a = tSub.toLowerCase().replace(/ematics|s$/g, '');
                const b = targetSub.toLowerCase().replace(/ematics|s$/g, '');
                return a === b || a.includes(b) || b.includes(a);
            };

            setAllTeachers(allT);
            setTeachers(allT.filter(t => isSubMatch(t.subject, subject)));
            setPapers(allP.filter(p => isSubMatch(p.subject, subject)));
        } catch (err) {
            console.error('Error fetching subject details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [subject]);

    const handleDeleteTeacher = async (id) => {
        if (window.confirm('Are you sure you want to delete this teacher?')) {
            try {
                await api.delete(`/api/admin/teachers/${id}`);
                fetchData();
            } catch (err) {
                console.error(err);
            }
        }
    };

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
                subjectsNeeded = [subject];
            }

            const defaultTarget = commissionForm.examType === 'JEE' ? 25 : commissionForm.examType === 'NEET' ? 45 : 60;

            const subjectAssignments = subjectsNeeded.map(subName => {
                const assignedTeacherId = commissionForm.assignedTeachers[subName];
                const teacherObj = allTeachers.find(t => (t._id || t.id) === assignedTeacherId) || allTeachers.find(t => (t.subject || '').toLowerCase().includes(subName.toLowerCase()));
                return {
                    subject: subName,
                    teacherId: teacherObj ? (teacherObj._id || teacherObj.id) : undefined,
                    teacherName: teacherObj ? teacherObj.name : `Prof. ${subName} Faculty`,
                    teacherEmail: teacherObj ? teacherObj.email : `${subName.toLowerCase()}@sapthagiripucollege.edu.in`,
                    targetQuestions: commissionForm.targetPerSubject || defaultTarget,
                    difficultyDistribution: commissionForm.difficultyDistribution,
                    status: 'Not Started'
                };
            });

            await api.post('/api/exams/commission', {
                title: commissionForm.title,
                examType: commissionForm.examType,
                classes: commissionForm.classes,
                subjectAssignments,
                duration_minutes: 180
            });

            alert(`✓ Exam "${commissionForm.title}" successfully created & assigned to faculty!`);
            setShowCommissionModal(false);
            setCommissionForm({
                title: '',
                examType: 'CET',
                classes: ['12'],
                targetPerSubject: 60,
                difficultyDistribution: { easy: 40, medium: 40, hard: 20 },
                assignedTeachers: {}
            });
            fetchData();
        } catch (err) {
            console.error('Error creating exam:', err);
            alert('Failed to assign exam: ' + (err.response?.data?.msg || err.message));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-6 h-6 border-2 border-navy border-t-gold rounded-full animate-spin"></div>
                    <span className="text-sm font-black text-navy uppercase tracking-widest">Loading {subject} Division...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in-up px-4 py-8 max-w-7xl mx-auto font-sans">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 border-l-8 border-navy flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-6">
                    {logoMap[subject] && (
                        <div className="w-16 h-16 bg-white p-2 rounded-2xl shadow-md border border-gray-100 flex items-center justify-center transform -rotate-2 hover:rotate-0 transition-transform">
                            <img src={logoMap[subject]} alt={subject} className="w-full h-full object-contain" />
                        </div>
                    )}
                    <div>
                        <h3 className="font-black text-2xl text-navy uppercase tracking-tight">{subject} Division</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Departmental Asset & Faculty Control</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowCommissionModal(true)}
                        className="bg-navy text-gold px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg flex items-center gap-2"
                    >
                        <span>+</span> Create / Assign Exam
                    </button>
                    <button 
                        onClick={() => navigate('/admin/dashboard')} 
                        className="bg-gray-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition"
                    >
                        ← Back
                    </button>
                </div>
            </div>
            
            <div className="flex gap-3 p-1.5 bg-gray-200/80 rounded-2xl w-fit">
                <button 
                    onClick={() => setActiveTab('papers')}
                    className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'papers' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:text-navy'}`}
                >
                    Question Papers ({papers.length})
                </button>
                <button 
                    onClick={() => setActiveTab('teachers')}
                    className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'teachers' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:text-navy'}`}
                >
                    Faculty List ({teachers.length})
                </button>
            </div>

            {activeTab === 'papers' && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-sm font-black text-navy flex items-center gap-3 uppercase tracking-widest">
                            <span className="bg-gold text-navy w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shadow">{papers.length}</span>
                            Departmental Question Papers
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {papers.map(p => {
                            const creator = teachers.find(t => t._id === p.teacherId) || allTeachers.find(t => t._id === p.teacherId);
                            const creatorName = creator ? creator.name : 'Faculty Member';

                            return (
                                <div key={p._id} className="border-2 border-gray-100 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-gold transition-all bg-white flex flex-col justify-between h-full relative group">
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-navy/5 text-navy border border-navy/10">
                                                {p.classes?.join(', ') || 'Class 12'}
                                            </span>
                                            <span className={`px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ${p.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : p.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {p.status || 'Pending Approval'}
                                            </span>
                                        </div>

                                        <h4 className="font-black text-navy text-lg mb-3 line-clamp-2 leading-snug">{p.title}</h4>
                                        
                                        <div className="space-y-2 text-xs font-semibold text-slate-600 border-t border-gray-100 pt-3">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Created By:</span>
                                                <span className="font-bold text-navy">{creatorName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Questions:</span>
                                                <span className="font-bold text-navy">{Array.isArray(p.questions) ? p.questions.length : 0} Qs</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-400">
                                                <span>Date:</span>
                                                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-auto border-t border-gray-100 pt-4">
                                        <button 
                                            onClick={() => navigate(`/admin/paper-preview/${p._id}`)} 
                                            className="bg-navy text-gold py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition shadow flex items-center justify-center gap-1 col-span-1"
                                        >
                                            <span>👁</span> View Paper
                                        </button>
                                        <button 
                                            onClick={() => setSelectedAnalysisPaper(p)} 
                                            className="bg-gold/20 border border-gold/60 text-navy hover:bg-gold py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1 col-span-1"
                                        >
                                            <span>📊</span> Analysis
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {papers.length === 0 && (
                            <div className="col-span-full p-16 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                                <div className="w-16 h-16 bg-gray-100 text-slate-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">📝</div>
                                <h4 className="text-base font-black text-navy mb-1 uppercase tracking-tight">No papers created for {subject} yet</h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">You can create and assign a new standardized exam for faculty to populate questions.</p>
                                <button 
                                    onClick={() => setShowCommissionModal(true)}
                                    className="bg-navy text-gold px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-md"
                                >
                                    + Create / Assign Exam
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'teachers' && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 animate-fade-in-up">
                    <h3 className="text-sm font-black mb-6 text-navy flex items-center gap-3 uppercase tracking-widest">
                        <span className="bg-gold text-navy w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shadow">{teachers.length}</span>
                        Authorized Department Faculty
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-navy/60 text-xs font-black uppercase tracking-wider border-b-2 border-gray-100">
                                    <th className="p-4 text-left w-12">#</th>
                                    <th className="p-4 text-left">Faculty Name</th>
                                    <th className="p-4 text-left">Official Email</th>
                                    <th className="p-4 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teachers.map((t, index) => (
                                    <tr key={t._id || t.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                                        <td className="p-4 text-slate-400 font-black text-xs">{String(index + 1).padStart(2, '0')}</td>
                                        <td className="p-4 font-black text-navy text-sm">{t.name}</td>
                                        <td className="p-4 text-slate-600 font-medium text-xs">{t.email}</td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => handleDeleteTeacher(t._id || t.id)} 
                                                className="bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-wider hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg transition"
                                            >
                                                Revoke
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {teachers.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center p-12 text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                                            No faculty currently assigned to this division.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showCommissionModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/60">
                            <div>
                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Administrative Engine</span>
                                <h2 className="text-xl font-black text-navy mt-2 uppercase tracking-tight">Create / Assign Exam</h2>
                                <p className="text-xs text-gray-500 font-medium">Set exam parameters and assign department teachers.</p>
                            </div>
                            <button onClick={() => setShowCommissionModal(false)} className="text-slate-400 hover:text-red-500 bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border border-gray-100 shadow transition">✕</button>
                        </div>

                        <form onSubmit={handleCommissionSubmit} className="p-6 overflow-y-auto space-y-5">
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">
                                    Exam / Paper Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. CET MOCK TEST 1 or JEE ADVANCED 2026"
                                    value={commissionForm.title}
                                    onChange={e => setCommissionForm({ ...commissionForm, title: e.target.value })}
                                    className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-3 text-sm font-bold text-navy outline-none bg-gray-50/50"
                                />
                            </div>

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
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="CET">CET (60 Qs per subject)</option>
                                        <option value="NEET">NEET (45 Qs per subject)</option>
                                        <option value="JEE">JEE (20+5 Scheme - 25 Qs per subject)</option>
                                        <option value="KCET">KCET (60 Qs per subject)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Target Class</label>
                                    <select
                                        value={commissionForm.classes[0]}
                                        onChange={e => setCommissionForm({ ...commissionForm, classes: [e.target.value] })}
                                        className="w-full border-2 border-gray-200 focus:border-navy rounded-2xl px-4 py-2.5 text-xs font-bold text-navy outline-none bg-white cursor-pointer"
                                    >
                                        <option value="12">Class 12</option>
                                        <option value="11">Class 11</option>
                                    </select>
                                </div>
                            </div>

                            {/* Difficulty Distribution */}
                            <div>
                                <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Difficulty Distribution</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Easy %</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={commissionForm.difficultyDistribution.easy}
                                            onChange={e => setCommissionForm({
                                                ...commissionForm,
                                                difficultyDistribution: { ...commissionForm.difficultyDistribution, easy: Number(e.target.value) }
                                            })}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Medium %</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={commissionForm.difficultyDistribution.medium}
                                            onChange={e => setCommissionForm({
                                                ...commissionForm,
                                                difficultyDistribution: { ...commissionForm.difficultyDistribution, medium: Number(e.target.value) }
                                            })}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hard %</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={commissionForm.difficultyDistribution.hard}
                                            onChange={e => setCommissionForm({
                                                ...commissionForm,
                                                difficultyDistribution: { ...commissionForm.difficultyDistribution, hard: Number(e.target.value) }
                                            })}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-navy text-gold hover:bg-gold hover:text-navy py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg mt-4"
                            >
                                🚀 Assign Exam to Faculty
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Paper Analysis Modal */}
            {selectedAnalysisPaper && (
                <PaperAnalysisModal
                    isOpen={!!selectedAnalysisPaper}
                    onClose={() => setSelectedAnalysisPaper(null)}
                    paperTitle={selectedAnalysisPaper.title}
                    questions={selectedAnalysisPaper.questions || []}
                    examType={selectedAnalysisPaper.title?.toUpperCase().includes('JEE') ? 'JEE' : selectedAnalysisPaper.title?.toUpperCase().includes('NEET') ? 'NEET' : 'CET'}
                />
            )}
        </div>
    );
};

export default SubjectDetails;
