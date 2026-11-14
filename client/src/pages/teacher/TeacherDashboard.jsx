/**
 * TeacherDashboard.jsx
 *
 * Streamlined Teacher Workspace
 * Features:
 * - Teacher Notification Bell with live unread counts & assignment pre-fill
 * - Simplified clean top navigation (Grand Test Papers, Previous Year Papers, Template cart)
 * - Direct assignment continuation
 * - Academic modules
 */
import { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route } from 'react-router-dom';
import AddQuestion from './AddQuestion';
import ModuleGrid from './ModuleGrid';
import FacultyToday from './FacultyToday';
import { PortalShell } from '../admin/admin-dashboard/AdminShell';
import { LayoutDashboard, ClipboardList, FilePlus2, NotebookPen, Database, FolderOpen, Trophy, Archive, ScanLine, Image as ImageIcon } from 'lucide-react';
import SavedPapers from './SavedPapers';
import TemplateCart from './TemplateCart';
import GrandTestList from '../admin/GrandTestList';
import PreviousYearPapers from '../admin/PreviousYearPapers';
import AssignmentGenerator from './AssignmentGenerator';
import TeacherOmr from './omr/TeacherOmr';
import api from '../../api';

// ── Teacher Notification Bell Component ──────────────────────────────────────
const TeacherNotificationBell = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            if (Array.isArray(res.data)) {
                setNotifications(res.data);
            }
        } catch (err) {
            console.error('Error fetching teacher notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 20000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleMarkAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Error marking read:', err);
        }
    };

    const handleNotificationClick = async (notif) => {
        try {
            if (!notif.is_read) {
                await api.put(`/api/notifications/${notif.id}/read`);
                setNotifications(prev => prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n)));
            }
            setIsOpen(false);

            // If it's an exam assignment notification, navigate with metadata pre-filled
            const meta = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata || '{}') : (notif.metadata || {});
            if (meta.examId) {
                navigate(`/teacher/create-paper?examId=${meta.examId}`);
            } else if (notif.related_paper_id) {
                navigate(`/teacher/create-paper?paperId=${notif.related_paper_id}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative bg-white/10 hover:bg-white/20 text-gold w-10 h-10 rounded-xl flex items-center justify-center transition border border-gold/30 cursor-pointer"
                title="Notifications from Admin"
            >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border-2 border-navy/20 z-50 overflow-hidden animate-fade-in-up text-left">
                    <div className="p-4 bg-navy text-white flex justify-between items-center border-b border-gold/30">
                        <div className="flex items-center gap-2">
                            <span className="text-gold font-bold">🔔</span>
                            <span className="font-black text-xs uppercase tracking-wider">Admin Notifications</span>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-gold hover:underline font-bold"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-400 font-bold">
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`p-3.5 hover:bg-gray-50 transition cursor-pointer ${
                                        !n.is_read ? 'bg-blue-50/60 border-l-4 border-gold' : ''
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-bold text-xs text-navy leading-snug">{n.title}</h4>
                                        <span className="text-[9px] text-gray-400 font-semibold whitespace-nowrap">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                                        {n.message}
                                    </p>
                                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100/60">
                                        <span className="text-[9px] font-bold text-gray-400">
                                            From: {n.sender_name || 'Admin'}
                                        </span>
                                        <span className="text-[10px] font-black text-navy uppercase tracking-wider">
                                            Open →
                                        </span>
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

// ── Teacher Active Assignments Section ────────────────────────────────────────
const TeacherAssignmentsSection = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAssignments = async () => {
        try {
            const res = await api.get('/api/exams/my-assignments');
            const examList = Array.isArray(res.data) ? res.data : [];

            const myAssignedList = [];
            examList.forEach(exam => {
                const subAssignments = Array.isArray(exam.subjectAssignments) ? exam.subjectAssignments : [];
                subAssignments.forEach(sa => {
                    const isMySub = (sa.subject || '').toLowerCase().trim() === (user?.subject || '').toLowerCase().trim() ||
                                   (sa.teacherId && String(sa.teacherId) === String(user?._id || user?.id));
                    if (isMySub) {
                        myAssignedList.push({
                            examId: exam._id,
                            examTitle: exam.title,
                            examType: exam.examType || 'CET',
                            classes: exam.classes || ['12'],
                            subject: sa.subject,
                            targetQuestions: sa.targetQuestions || 60,
                            difficultyDistribution: sa.difficultyDistribution || { easy: 40, medium: 40, hard: 20 },
                            status: sa.status || 'Not Started',
                            submittedPaperId: sa.submittedPaperId?._id || sa.submittedPaperId,
                            assignedDate: sa.assignedDate || exam.createdAt,
                        });
                    }
                });
            });

            setAssignments(myAssignedList);
        } catch (err) {
            console.error('Error fetching teacher assignments:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, [user]);

    if (loading) {
        return (
            <div className="mb-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-xs flex items-center justify-center gap-2.5">
                <div className="w-4 h-4 border-2 border-navy border-t-gold rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-slate/60">Checking assignments...</span>
            </div>
        );
    }

    if (assignments.length === 0) return null;

    return (
        <div className="mb-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gold animate-ping"></span>
                    <h2 className="text-xs font-black text-navy uppercase tracking-[0.2em]">
                        Commissioned Paper Requests ({assignments.length})
                    </h2>
                </div>
                <span className="text-[10px] font-bold text-slate/50 uppercase tracking-widest">
                    Action Required by Faculty
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignments.map((item, idx) => {
                    const statusColor =
                        item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        item.status === 'In Progress' ? 'bg-amber-100 text-amber-800 border-indigo-300' :
                        'bg-blue-100 text-blue-800 border-blue-300';

                    return (
                        <div
                            key={idx}
                            className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 hover:border-gold transition-all relative overflow-hidden flex flex-col justify-between"
                        >
                            <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-navy text-gold text-[9px] font-black rounded-bl-lg uppercase tracking-widest">
                                {item.examType}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${statusColor} uppercase tracking-wider`}>
                                        {item.status}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate/50">
                                        {item.subject}
                                    </span>
                                </div>

                                <h3 className="text-sm font-black text-navy mb-2 line-clamp-1">
                                    {item.examTitle}
                                </h3>

                                <div className="space-y-1 mb-3 text-xs font-semibold text-slate/70">
                                    <div className="flex justify-between">
                                        <span className="text-slate/50">Target Questions:</span>
                                        <span className="font-bold text-navy">{item.targetQuestions} Qs</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate/50">Target Split:</span>
                                        <span className="font-bold text-slate/80">
                                            {item.difficultyDistribution?.easy || 40}%E / {item.difficultyDistribution?.medium || 40}%M / {item.difficultyDistribution?.hard || 20}%H
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const cls = Array.isArray(item.classes) && item.classes.includes('11') && item.classes.includes('12') ? 'Both' : (item.classes?.[0] || '12');
                                    const block = `examId=${item.examId}&subject=${encodeURIComponent(item.subject)}&examType=${encodeURIComponent(item.examType || 'CET')}&examTitle=${encodeURIComponent(item.examTitle || '')}&classes=${encodeURIComponent(cls)}`;
                                    navigate(item.submittedPaperId ? `/teacher/create-paper?${block}&paperId=${item.submittedPaperId}` : `/teacher/create-paper?${block}`);
                                }}
                                className="w-full mt-1 bg-navy text-gold hover:bg-gold hover:text-navy py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer group"
                            >
                                <span>{item.status === 'In Progress' ? '⚡ Continue Creation' : '✍️ Create Paper'}</span>
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Teacher Dashboard Home ────────────────────────────────────────────────────
const TeacherDashboardHome = () => {
    const { user } = useContext(AuthContext);
    const hasOmr = Boolean(user?.role === 'admin' || user?.omrAccess || user?.omr_access);

    return (
        <div className="animate-fade-in-up">
            <FacultyToday />

            {/* ── ASSIGNMENTS & NOTIFICATIONS SECTION ── */}
            <TeacherAssignmentsSection />

            <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs font-black text-navy uppercase tracking-[0.2em]">Academic Modules</h2>
                <div className="h-px flex-1 bg-gray-200"></div>
            </div>

            <ModuleGrid hasOmr={hasOmr} />
        </div>
    );
};

const TEACHER_NAV = [
    {
        group: 'Workspace',
        items: [
            { title: 'Home', path: '/teacher/dashboard', Icon: LayoutDashboard, desc: 'Your workspace' },
            { title: 'Commissioned Exam', path: '/teacher/commissioned-exam', Icon: ClipboardList, desc: 'Official multi-step exam' },
            { title: 'Create Paper', path: '/teacher/create-paper', Icon: FilePlus2, desc: 'Step-by-step wizard' },
            { title: 'Assignments', path: '/teacher/dashboard/assignments', Icon: NotebookPen, desc: 'Practice and keys' },
        ],
    },
    {
        group: 'Library',
        items: [
            { title: 'Question Bank', path: '/teacher/dashboard/add-question', Icon: Database, desc: 'Add and manage questions' },
            { title: 'Saved Papers', path: '/teacher/dashboard/saved-papers', Icon: FolderOpen, desc: 'Drafts and finished papers' },
            { title: 'Grand Tests', path: '/teacher/dashboard/grand-tests', Icon: Trophy, desc: 'Grand test archives' },
            { title: 'Previous Year Papers', path: '/teacher/dashboard/previous-year-papers', Icon: Archive, desc: 'PYQs and answer keys' },
        ],
    },
];

const teacherTitleFor = (pathname) => {
    if (pathname.includes('add-question')) return 'Question Bank';
    if (pathname.includes('saved-papers')) return 'Saved Papers';
    if (pathname.includes('grand-tests')) return 'Grand Tests';
    if (pathname.includes('previous-year-papers')) return 'Previous Year Papers';
    if (pathname.includes('assignments')) return 'Assignments';
    if (pathname.includes('omr')) return 'OMR Evaluation';
    return 'Your Workspace';
};

const TeacherDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [showTemplateCart, setShowTemplateCart] = useState(false);
    const hasOmr = Boolean(user?.role === 'admin' || user?.omrAccess || user?.omr_access);

    const nav = hasOmr
        ? [TEACHER_NAV[0], { ...TEACHER_NAV[1], items: [...TEACHER_NAV[1].items, { title: 'OMR Evaluation', path: '/teacher/dashboard/omr', Icon: ScanLine, desc: 'Scanner and analytics' }] }]
        : TEACHER_NAV;

    const cfg = {
        id: 'teacher', home: '/teacher/dashboard', portal: `Faculty portal · ${user?.subject || 'PCMB'}`, nav, titleFor: teacherTitleFor,
        user: { initials: user?.subject ? user.subject.substring(0, 2).toUpperCase() : 'FC', name: user?.name || 'Faculty member', sub: `${user?.subject || 'PCMB'} department` },
        actions: [{ title: 'Institutional Templates', Icon: ImageIcon, desc: 'Approved header graphics', run: () => setShowTemplateCart(true) }],
        topRight: null,
        quickActions: [
            { title: 'Create a paper', desc: 'Step-by-step wizard', Icon: FilePlus2, to: '/teacher/create-paper' },
            { title: 'Commissioned exam', desc: 'Official multi-step exam', Icon: ClipboardList, to: '/teacher/commissioned-exam' },
            { title: 'New assignment', desc: 'Practice sheet and key', Icon: NotebookPen, to: '/teacher/dashboard/assignments' },
        ],
    };

    return (
        <PortalShell cfg={cfg}>
            <Routes>
                <Route path="/" element={<TeacherDashboardHome />} />
                <Route path="add-question" element={<AddQuestion />} />
                <Route path="saved-papers" element={<SavedPapers />} />
                <Route path="grand-tests" element={<GrandTestList />} />
                <Route path="previous-year-papers" element={<PreviousYearPapers />} />
                <Route path="assignments" element={<AssignmentGenerator onBack={() => navigate('/teacher/dashboard')} />} />
                <Route path="omr/*" element={<TeacherOmr />} />
            </Routes>

            {showTemplateCart && (
                <TemplateCart onClose={() => setShowTemplateCart(false)} />
            )}
        </PortalShell>
    );
};

export default TeacherDashboard;
