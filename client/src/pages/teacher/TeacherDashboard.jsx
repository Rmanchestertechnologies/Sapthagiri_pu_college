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
                        item.status === 'In Progress' ? 'bg-amber-100 text-amber-800 border-amber-300' :
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
                                    const targetUrl = item.submittedPaperId
                                        ? `/teacher/create-paper?examId=${item.examId}&paperId=${item.submittedPaperId}`
                                        : `/teacher/create-paper?examId=${item.examId}`;
                                    navigate(targetUrl);
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
            <div className="mb-5 bg-white p-5 sm:p-6 rounded-2xl shadow-xs border-l-4 border-navy relative overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 bg-gold/5 rounded-full -mr-12 -mt-12"></div>
                <h3 className="font-black text-xl text-navy mb-1.5">Welcome to your Workspace</h3>
                <p className="text-slate/70 font-medium text-xs max-w-2xl leading-relaxed">
                    Access your subject's question bank, generate standardized institutional papers, and complete assigned exam papers for your department.
                </p>
            </div>

            {/* ── ASSIGNMENTS & NOTIFICATIONS SECTION ── */}
            <TeacherAssignmentsSection />

            <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs font-black text-navy uppercase tracking-[0.2em]">Academic Modules</h2>
                <div className="h-px flex-1 bg-gray-200"></div>
            </div>

            <div className={`grid grid-cols-2 sm:grid-cols-3 ${hasOmr ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-4`}>
                {/* Question Bank */}
                <Link
                    to="/teacher/dashboard/add-question"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-gray-100 hover:shadow-md hover:border-gold hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-gray-50 text-gold w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        Q
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy">Question Bank</h2>
                        <p className="text-[10px] text-slate/50 mt-1 font-bold uppercase tracking-wider">Repository Management</p>
                    </div>
                </Link>

                {/* Create Paper */}
                <Link
                    to="/teacher/create-paper"
                    className="bg-navy p-5 rounded-2xl shadow-xl text-center border-2 border-gold hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-gold text-navy w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black shadow-md group-hover:rotate-12 transition-transform duration-300">
                        +
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white">Create Paper</h2>
                        <p className="text-[10px] text-gold/60 mt-1 font-bold uppercase tracking-wider">Step-by-Step Wizard</p>
                    </div>
                </Link>

                {/* Assignments Generator */}
                <Link
                    to="/teacher/dashboard/assignments"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-gold/30 hover:shadow-md hover:border-navy hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group ring-1 ring-gold/10 min-h-[160px]"
                >
                    <div className="bg-amber-50 text-navy w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-gold group-hover:text-navy transition-colors duration-300">
                        📝
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy">Assignments</h2>
                        <p className="text-[10px] text-slate/50 mt-1 font-bold uppercase tracking-wider">Practice & Keys</p>
                    </div>
                </Link>

                {/* Saved Papers */}
                <Link
                    to="/teacher/dashboard/saved-papers"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-gray-100 hover:shadow-md hover:border-gold hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-gray-50 text-gold w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        P
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy">Saved Papers</h2>
                        <p className="text-[10px] text-slate/50 mt-1 font-bold uppercase tracking-wider">Document Archives</p>
                    </div>
                </Link>

                {/* Grand Test Papers */}
                <Link
                    to="/teacher/dashboard/grand-tests"
                    className="bg-white p-5 rounded-2xl shadow-xs text-center border border-gray-100 hover:shadow-md hover:border-gold hover:text-navy transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
                >
                    <div className="bg-gray-50 text-gold w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-navy group-hover:text-gold transition-colors duration-300">
                        GT
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-navy">Grand Tests</h2>
                        <p className="text-[10px] text-slate/50 mt-1 font-bold uppercase tracking-wider">GT Paper Archives</p>
                    </div>
                </Link>

                {/* OMR Evaluation Module — ONLY visible if Admin granted OMR access */}
                {hasOmr && (
                    <Link
                        to="/teacher/dashboard/omr"
                        className="bg-emerald-950/10 p-5 rounded-2xl shadow-xs text-center border border-emerald-500/40 hover:shadow-md hover:border-emerald-400 transform hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 group ring-1 ring-emerald-500/20 min-h-[160px]"
                    >
                        <div className="bg-emerald-500/20 text-emerald-400 w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black shadow-inner group-hover:bg-emerald-500 group-hover:text-navy transition-colors duration-300">
                            📑
                        </div>
                        <div>
                            <div className="flex items-center justify-center gap-1">
                                <h2 className="text-sm font-black text-navy">OMR Evaluation</h2>
                                <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Enabled</span>
                            </div>
                            <p className="text-[10px] text-slate/50 mt-1 font-bold uppercase tracking-wider">Scanner & Analytics</p>
                        </div>
                    </Link>
                )}
            </div>
        </div>
    );
};

const TeacherDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [isSideboxOpen, setIsSideboxOpen] = useState(false);
    const [showTemplateCart, setShowTemplateCart] = useState(false);

    const hasOmr = Boolean(user?.role === 'admin' || user?.omrAccess || user?.omr_access);

    const logoMap = {
        'Physics': '/physicslogo.jpeg',
        'Chemistry': '/chemistrylogo.jpeg',
        'Biology': '/biologylogo.jpeg',
        'Maths': '/mathslogo.jpeg',
        'Mathematics': '/mathslogo.jpeg',
    };

    const navItems = [
        {
            group: 'Archives & Reference Papers',
            items: [
                { title: 'Previous Year Papers (PYQs)', path: '/teacher/dashboard/previous-year-papers', icon: '📑', desc: 'Official question papers & answer keys repository' }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">

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
                                    <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest mt-1 block">Faculty Navigation Menu</span>
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
                        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-180px)]">
                            {navItems.map((group, gIdx) => (
                                <div key={gIdx}>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/70 px-3 block mb-2">
                                        {group.group}
                                    </span>
                                    <div className="space-y-1">
                                        {group.items.map((item, iIdx) => {
                                            const isActive = location.pathname.includes(item.path.split('/').pop());

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

                            {/* Template Cart Trigger */}
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/70 px-3 block mb-2">
                                    Resources & Headers
                                </span>
                                <button
                                    onClick={() => {
                                        setIsSideboxOpen(false);
                                        setShowTemplateCart(true);
                                    }}
                                    className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left transition cursor-pointer text-slate-300 hover:bg-white/10 hover:text-white"
                                >
                                    <span className="text-lg leading-none">🖼️</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold leading-tight text-white">
                                            Institutional Templates
                                        </div>
                                        <div className="text-[10px] truncate mt-0.5 text-slate-400">
                                            Browse approved header template graphics
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sidebox Bottom User & Logout */}
                    <div className="p-4 border-t border-white/10 bg-black/30 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow">
                                {user?.subject ? user.subject.substring(0, 2).toUpperCase() : 'FC'}
                            </div>
                            <div>
                                <div className="text-xs font-black text-white leading-tight">{user?.name || 'Faculty Member'}</div>
                                <div className="text-[10px] text-amber-400 font-mono">{user?.subject || 'PCMB'} Department</div>
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

            {/* Top Navigation Bar - Sapthagiri Navy & Gold */}
            <nav className="bg-[#081B3B] px-6 py-3.5 text-white flex justify-between items-center z-10 shadow-2xl border-b-4 border-amber-500">
                <div className="flex items-center gap-3.5">
                    {/* LEFT-SIDE HAMBURGER MENU BUTTON */}
                    <button
                        onClick={() => setIsSideboxOpen(true)}
                        title="Open Faculty Menu"
                        className="relative bg-amber-400 text-slate-950 hover:bg-amber-300 w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg hover:scale-105 transition shadow-lg cursor-pointer"
                    >
                        <span className="text-xl leading-none">☰</span>
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                            T
                        </span>
                    </button>

                    <div
                        className="flex items-center cursor-pointer hover:opacity-80 transition gap-3"
                        onClick={() => navigate('/teacher/dashboard')}
                    >
                        <div className="w-10 h-10 flex items-center justify-center shadow-lg bg-white rounded-xl p-1 border-2 border-amber-400">
                            <img src="/SapthagiriLogo.jpg" alt="Sapthagiri PU College" className="w-full h-full object-contain rounded-lg" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-base font-black tracking-tight uppercase leading-tight text-white">
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
                </div>

                {/* Top Navigation Options */}
                <div className="flex items-center gap-2.5">
                    {location.pathname !== '/teacher/dashboard' && (
                        <button
                            onClick={() => navigate('/teacher/dashboard')}
                            className="bg-white/5 border border-gold/30 text-gold px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer mr-1"
                        >
                            <span>←</span> Back to Dashboard
                        </button>
                    )}

                    {/* Teacher Notification Bell */}
                    <TeacherNotificationBell />

                    <div className="w-px h-7 bg-gold/20 mx-1"></div>
                    <button
                        onClick={() => { logout(); navigate('/'); }}
                        className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">
                <Routes>
                    <Route path="/" element={<TeacherDashboardHome />} />
                    <Route path="add-question" element={<AddQuestion />} />
                    <Route path="saved-papers" element={<SavedPapers />} />
                    <Route path="grand-tests" element={<GrandTestList />} />
                    <Route path="previous-year-papers" element={<PreviousYearPapers />} />
                    <Route path="assignments" element={<AssignmentGenerator onBack={() => navigate('/teacher/dashboard')} />} />
                    <Route path="omr/*" element={<TeacherOmr />} />
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