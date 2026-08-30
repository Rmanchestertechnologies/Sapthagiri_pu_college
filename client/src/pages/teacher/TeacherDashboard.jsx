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
import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import AddQuestion from './AddQuestion';
import SavedPapers from './SavedPapers';
import TemplateCart from './TemplateCart';
import GrandTestList from '../admin/GrandTestList';
import PreviousYearPapers from '../admin/PreviousYearPapers';
import AssignmentGenerator from './AssignmentGenerator';
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
            <div className="mb-8 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-navy border-t-gold rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-slate/60">Checking assignments...</span>
            </div>
        );
    }

    if (assignments.length === 0) return null;

    return (
        <div className="mb-8 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-gold animate-ping"></span>
                    <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">
                        Commissioned Paper Requests ({assignments.length})
                    </h2>
                </div>
                <span className="text-[10px] font-bold text-slate/50 uppercase tracking-widest">
                    Action Required by Faculty
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {assignments.map((item, idx) => {
                    const statusColor =
                        item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        item.status === 'In Progress' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        'bg-blue-100 text-blue-800 border-blue-300';

                    return (
                        <div
                            key={idx}
                            className="bg-white p-6 rounded-3xl shadow-md border-2 border-gray-100 hover:border-gold transition-all relative overflow-hidden flex flex-col justify-between"
                        >
                            <div className="absolute top-0 right-0 px-3 py-1 bg-navy text-gold text-[10px] font-black rounded-bl-xl uppercase tracking-widest">
                                {item.examType}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${statusColor} uppercase tracking-wider`}>
                                        {item.status}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate/50">
                                        {item.subject}
                                    </span>
                                </div>

                                <h3 className="text-base font-black text-navy mb-2 line-clamp-1">
                                    {item.examTitle}
                                </h3>

                                <div className="space-y-1.5 mb-4 text-xs font-semibold text-slate/70">
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
                                    const targetUrl = item.submittedPaperId
                                        ? `/teacher/create-paper?examId=${item.examId}&paperId=${item.submittedPaperId}`
                                        : `/teacher/create-paper?examId=${item.examId}`;
                                    navigate(targetUrl);
                                }}
                                className="w-full mt-2 bg-navy text-gold hover:bg-gold hover:text-navy py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer group"
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
    return (
        <div className="animate-fade-in-up">
            <div className="mb-8 bg-surface p-8 rounded-3xl shadow-sm border-l-8 border-navy relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16"></div>
                <h3 className="font-black text-2xl text-navy mb-2">Welcome to your Workspace</h3>
                <p className="text-slate/70 font-medium text-sm max-w-2xl leading-relaxed">
                    Access your subject's question bank, generate standardized institutional papers, and complete assigned exam papers for your department.
                </p>
            </div>

            {/* ── ASSIGNMENTS & NOTIFICATIONS SECTION ── */}
            <TeacherAssignmentsSection />

            <div className="flex items-center gap-4 mb-8">
                <h2 className="text-sm font-black text-navy uppercase tracking-[0.2em]">Academic Modules</h2>
                <div className="h-px flex-1 bg-gray-100"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {/* Question Bank */}
                <Link
                    to="/teacher/dashboard/add-question"
                    className="bg-surface p-8 rounded-3xl shadow-sm text-center border border-gray-100 hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gray-50 text-gold w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        Q
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-navy">Question Bank</h2>
                        <p className="text-xs text-slate/50 mt-2 font-bold uppercase tracking-widest">Repository Management</p>
                    </div>
                </Link>

                {/* Create Paper */}
                <Link
                    to="/teacher/create-paper"
                    className="bg-navy p-8 rounded-3xl shadow-2xl text-center border-4 border-gold hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gold text-navy w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg group-hover:rotate-12 transition-transform duration-300">
                        +
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">Create Paper</h2>
                        <p className="text-xs text-gold/60 mt-2 font-bold uppercase tracking-widest">Step-by-Step Wizard</p>
                    </div>
                </Link>

                {/* Assignments Generator */}
                <Link
                    to="/teacher/dashboard/assignments"
                    className="bg-surface p-8 rounded-3xl shadow-sm text-center border border-gold/40 hover:shadow-xl hover:border-navy hover:text-navy transform hover:-translate-y-2 transition-all flex flex-col items-center justify-center gap-4 group ring-2 ring-gold/10"
                >
                    <div className="bg-amber-50 text-navy w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-gold group-hover:text-navy transition-colors duration-300">
                        📝
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-navy">Assignments</h2>
                        <p className="text-xs text-slate/50 mt-2 font-bold uppercase tracking-widest">Practice & Keys</p>
                    </div>
                </Link>

                {/* Saved Papers */}
                <Link
                    to="/teacher/dashboard/saved-papers"
                    className="bg-surface p-8 rounded-3xl shadow-sm text-center border border-gray-100 hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gray-50 text-gold w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        P
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-navy">Saved Papers</h2>
                        <p className="text-xs text-slate/50 mt-2 font-bold uppercase tracking-widest">Document Archives</p>
                    </div>
                </Link>

                {/* Grand Test Papers */}
                <Link
                    to="/teacher/dashboard/grand-tests"
                    className="bg-surface p-8 rounded-3xl shadow-sm text-center border border-gray-100 hover:shadow-xl hover:border-gold hover:text-navy transform hover:-translate-y-2 transition-all flex flex-col items-center justify-center gap-4 group"
                >
                    <div className="bg-gray-50 text-gold w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        GT
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-navy">Grand Tests</h2>
                        <p className="text-xs text-slate/50 mt-2 font-bold uppercase tracking-widest">GT Paper Archives</p>
                    </div>
                </Link>
            </div>
        </div>
    );
};

const TeacherDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [showTemplateCart, setShowTemplateCart] = useState(false);

    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Maths': '/mathslogo.jpeg',
        'Mathematics': '/mathslogo.jpeg',
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            {/* Top Navigation Bar - Sapthagiri Navy & Gold */}
            <nav className="bg-[#081B3B] p-4 text-white flex justify-between items-center z-10 shadow-2xl border-b-4 border-amber-500">
                <div
                    className="flex items-center cursor-pointer hover:opacity-80 transition gap-4 ml-4"
                    onClick={() => navigate('/teacher/dashboard')}
                >
                    <div className="w-12 h-12 flex items-center justify-center shadow-lg bg-white rounded-xl p-1 border-2 border-amber-400">
                        <img src="/SapthagiriLogo.jpg" alt="Sapthagiri PU College" className="w-full h-full object-contain rounded-lg" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black tracking-tight uppercase leading-tight text-white">
                            Sapthagiri PU College
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            {user?.subject && logoMap[user.subject] && (
                                <img src={logoMap[user.subject]} alt={user.subject} className="w-4 h-4 object-contain rounded-sm" />
                            )}
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                                Faculty Portal • {user?.subject || 'PCMB'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Top Navigation Options */}
                <div className="space-x-3 flex items-center mr-4">
                    {location.pathname !== '/teacher/dashboard' && (
                        <button
                            onClick={() => navigate('/teacher/dashboard')}
                            className="bg-white/5 border border-gold/30 text-gold px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                        >
                            <span>←</span> Back
                        </button>
                    )}
                    <Link
                        to="/teacher/dashboard/assignments"
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${
                            location.pathname.includes('assignments') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'
                        }`}
                    >
                        Assignments
                    </Link>
                    <Link
                        to="/teacher/dashboard/grand-tests"
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${
                            location.pathname.includes('grand-tests') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'
                        }`}
                    >
                        GT Papers
                    </Link>
                    <Link
                        to="/teacher/dashboard/previous-year-papers"
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${
                            location.pathname.includes('previous-year-papers') ? 'bg-gold text-navy shadow-lg' : 'bg-white/5 text-gold border border-gold/30 hover:bg-white/10'
                        }`}
                    >
                        PYQs
                    </Link>

                    {/* Teacher Notification Bell */}
                    <TeacherNotificationBell />

                    {/* Template Cart */}
                    <button
                        id="teacher-template-cart-btn"
                        onClick={() => setShowTemplateCart(true)}
                        title="Browse Templates"
                        className="relative bg-gold text-navy w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg hover:scale-110 transition-all shadow-lg cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">T</span>
                    </button>

                    <div className="w-px h-8 bg-gold/20 mx-1"></div>
                    <button
                        onClick={() => { logout(); navigate('/'); }}
                        className="bg-red-500/10 border border-red-500/30 text-red-500 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="flex-1 p-10 max-w-7xl mx-auto w-full">
                <Routes>
                    <Route path="/" element={<TeacherDashboardHome />} />
                    <Route path="add-question" element={<AddQuestion />} />
                    <Route path="saved-papers" element={<SavedPapers />} />
                    <Route path="grand-tests" element={<GrandTestList />} />
                    <Route path="previous-year-papers" element={<PreviousYearPapers />} />
                    <Route path="assignments" element={<AssignmentGenerator onBack={() => navigate('/teacher/dashboard')} />} />
                </Routes>
            </div>

            {/* Template Cart Drawer */}
            {showTemplateCart && (
                <TemplateCart onClose={() => setShowTemplateCart(false)} />
            )}
        </div>
    );
};

export default TeacherDashboard;