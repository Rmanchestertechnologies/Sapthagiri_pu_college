import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

export default function StudentLabPortal() {
    const navigate = useNavigate();

    // ── Student Identification State ──
    const [savedStudent, setSavedStudent] = useState(() => {
        try {
            const data = localStorage.getItem('student_info');
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    });

    const [studentName, setStudentName] = useState(savedStudent?.studentName || '');
    const [regNo, setRegNo] = useState(savedStudent?.rollNumber || '');
    const [studentClass, setStudentClass] = useState(savedStudent?.class || '12');
    const [isLoggedIn, setIsLoggedIn] = useState(Boolean(savedStudent?.rollNumber && savedStudent?.studentName));

    // ── Exam State ──
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now());
    const [startingExamId, setStartingExamId] = useState(null);

    // ── 1-Second Master Clock for Real-time Red/Green transitions ──
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Fetch active exams from public lab endpoint ──
    const fetchExams = useCallback(async () => {
        try {
            const res = await api.get('/api/exams/lab-active');
            setExams(res.data.exams || []);
            setError('');
        } catch (err) {
            console.error('Failed to fetch lab exams:', err);
            setError('Unable to reach examination server. Please notify lab invigilator.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExams();
        // Poll every 15 seconds to pick up new schedules from Admin
        const poll = setInterval(fetchExams, 15000);
        return () => clearInterval(poll);
    }, [fetchExams]);

    // ── Handle Student Login / Registration ──
    const handleStudentLogin = (e) => {
        e.preventDefault();
        const trimmedName = studentName.trim();
        const trimmedReg = regNo.trim().toUpperCase();

        if (!trimmedName || !trimmedReg) {
            setError('Please enter both your Student Full Name and Register Number.');
            return;
        }

        const info = {
            studentName: trimmedName,
            rollNumber: trimmedReg,
            class: studentClass,
            studentEmail: `${trimmedReg.toLowerCase()}@student.sapthagiri.edu`
        };

        localStorage.setItem('student_info', JSON.stringify(info));
        setSavedStudent(info);
        setIsLoggedIn(true);
        setError('');
    };

    const handleSwitchStudent = () => {
        setIsLoggedIn(false);
    };

    // ── Helper: Format Countdown ──
    const formatCountdown = (ms) => {
        if (ms <= 0) return '00:00';
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // ── Helper: Determine Timing & Visibility per User Specification ──
    // Rule: "before 5 min only it should be visible untill the selected time red dot once time comes green one"
    const getExamTimeStatus = (exam) => {
        if (!exam.start_time) {
            // Immediate live exam without schedule lock
            return {
                visible: true,
                status: 'live',
                label: 'LIVE NOW',
                canStart: true,
                countdown: null
            };
        }

        const startMs = new Date(exam.start_time).getTime();
        const duration = (exam.duration_minutes || 180) * 60000;
        const endMs = exam.end_time ? new Date(exam.end_time).getTime() : startMs + duration;

        const msUntilStart = startMs - now;
        const minutesUntilStart = msUntilStart / 60000;

        if (minutesUntilStart > 5) {
            // More than 5 mins before start: HIDDEN from student
            return {
                visible: false,
                status: 'hidden',
                label: 'Scheduled',
                canStart: false,
                countdown: null
            };
        }

        if (msUntilStart > 0) {
            // Between 0 and 5 minutes: VISIBLE with RED DOT 🔴
            return {
                visible: true,
                status: 'waiting_5min',
                label: `OPENS IN ${formatCountdown(msUntilStart)}`,
                canStart: false,
                countdown: msUntilStart
            };
        }

        if (now <= endMs) {
            // Start time reached and before end time: GREEN DOT 🟢
            return {
                visible: true,
                status: 'live',
                label: 'ACTIVE / LIVE',
                canStart: true,
                countdown: null
            };
        }

        // Exam has concluded
        return {
            visible: true,
            status: 'concluded',
            label: 'CONCLUDED',
            canStart: false,
            countdown: null
        };
    };

    // ── Filter to Visible Exams ──
    const visibleExams = exams
        .map(ex => ({ ...ex, timing: getExamTimeStatus(ex) }))
        .filter(ex => ex.timing.visible);

    // ── Start Exam Handler ──
    const handleStartExam = (exam) => {
        if (!isLoggedIn) {
            setError('Please register your Name and Reg No first.');
            return;
        }

        setStartingExamId(exam._id || exam.id);

        // Attempt Fullscreen
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } catch (err) {
            console.log('Fullscreen request bypassed');
        }

        // Navigate directly to Exam Instructions / Engine
        navigate(`/exam/${exam._id || exam.id}/instructions`);
    };

    return (
        <div className="min-h-screen bg-[#071328] text-white flex flex-col font-sans select-none relative overflow-x-hidden">
            {/* Background ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-amber-500/10 blur-[130px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-sky-500/10 blur-[140px] pointer-events-none rounded-full" />

            {/* ── Top Header Navigation Bar ── */}
            <header className="border-b border-slate-800/80 bg-[#091834]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-lg border border-amber-400/30">
                            <img src="/SapthagiriLogo.jpg" alt="Sapthagiri College Crest" className="w-full h-full object-contain rounded-lg" />
                        </div>
                        <div>
                            <h1 className="text-base font-extrabold tracking-wide text-white uppercase">
                                Sapthagiri Pre University College
                            </h1>
                            <p className="text-xs text-amber-400 font-semibold tracking-wider flex items-center gap-2">
                                <span>Davanagere • The Land of Opportunity</span>
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                                <span className="text-slate-300">Digital CBT Examination Portal</span>
                            </p>
                        </div>
                    </div>

                    {/* Clock & Status */}
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-xs font-mono text-amber-300 font-semibold">
                                {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(now).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>LAB TERMINAL CONNECTED</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main Container ── */}
            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 relative z-10 flex flex-col justify-start">
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
                        <span className="text-lg">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* ── STEP 1: Student Not Registered in this terminal session ── */}
                {!isLoggedIn ? (
                    <div className="max-w-md w-full mx-auto my-auto py-8">
                        <div className="bg-[#0e2142]/90 border border-slate-700/80 rounded-2xl p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-white p-2 mx-auto mb-3 shadow-md border border-amber-400/40">
                                    <img src="/SapthagiriLogo.jpg" alt="Logo" className="w-full h-full object-contain rounded-xl" />
                                </div>
                                <h2 className="text-xl font-black text-white uppercase tracking-wide">Student Lab Login</h2>
                                <p className="text-xs text-slate-400 mt-1">Enter your details to view your scheduled online exams</p>
                            </div>

                            <form onSubmit={handleStudentLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Registration / Roll Number *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        placeholder="e.g. 24SC0149 or PU2025001"
                                        value={regNo}
                                        onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3 rounded-xl bg-[#071328] border border-slate-700 text-white placeholder-slate-500 font-mono font-semibold focus:outline-none focus:border-amber-400 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Candidate Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Rahul Sharma"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-[#071328] border border-slate-700 text-white placeholder-slate-500 font-medium focus:outline-none focus:border-amber-400 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Class / Standard
                                    </label>
                                    <select
                                        value={studentClass}
                                        onChange={(e) => setStudentClass(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-[#071328] border border-slate-700 text-white font-medium focus:outline-none focus:border-amber-400 transition"
                                    >
                                        <option value="12">2nd PUC (Class 12)</option>
                                        <option value="11">1st PUC (Class 11)</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full mt-6 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black tracking-wider uppercase text-sm shadow-xl shadow-amber-500/20 active:scale-[0.99] transition cursor-pointer"
                                >
                                    Proceed to Examination Room →
                                </button>
                            </form>

                            <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-400">
                                🔒 Dedicated Lab Portal • Sapthagiri PU College Davanagere
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── STEP 2: Candidate Verified — Display Scheduled Online Exams ── */
                    <div className="space-y-6 animate-fade-in">
                        {/* Student Info Ribbon */}
                        <div className="bg-[#0e2142]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-bold">
                                    👨‍🎓
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Student Terminal</div>
                                    <div className="text-lg font-black text-white flex items-center gap-2">
                                        <span>{savedStudent.studentName}</span>
                                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                            {savedStudent.rollNumber}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 font-medium">Class: {savedStudent.class || '12'}th PUC</div>
                                </div>
                            </div>

                            <button
                                onClick={handleSwitchStudent}
                                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition flex items-center gap-2 cursor-pointer"
                            >
                                <span>🔄</span>
                                <span>Switch Student / Reg No</span>
                            </button>
                        </div>

                        {/* Title Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-wide uppercase">
                                    Assigned Online Examinations
                                </h2>
                                <p className="text-xs text-slate-400">
                                    Tests scheduled by administration. Tests appear 5 minutes before scheduled start time.
                                </p>
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                                    <span>Red Dot: Starting Soon (&lt; 5 min)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                    <span>Green Dot: Active / Live</span>
                                </div>
                            </div>
                        </div>

                        {/* Loading State */}
                        {loading ? (
                            <div className="py-20 text-center">
                                <div className="w-10 h-10 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-xs text-slate-400 tracking-wider uppercase font-semibold">Synchronizing Exam Schedules...</p>
                            </div>
                        ) : visibleExams.length === 0 ? (
                            /* No exams visible yet */
                            <div className="bg-[#0e2142]/50 border border-slate-800 rounded-2xl p-12 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-3xl mb-4 border border-slate-700">
                                    ⏳
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">No Active or Upcoming Exams Right Now</h3>
                                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                                    Examinations will automatically appear on this screen exactly <strong className="text-amber-300">5 minutes</strong> prior to their scheduled start time. Please wait comfortably in the lab.
                                </p>
                                <div className="mt-6">
                                    <button
                                        onClick={fetchExams}
                                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 font-bold border border-slate-700 transition"
                                    >
                                        Check For Updates
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── Exam Cards Grid ── */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {visibleExams.map((exam) => {
                                    const { timing } = exam;
                                    const isLive = timing.status === 'live';
                                    const isWaiting = timing.status === 'waiting_5min';
                                    const isConcluded = timing.status === 'concluded';

                                    return (
                                        <div
                                            key={exam._id || exam.id}
                                            className={`rounded-2xl border p-6 flex flex-col justify-between transition relative overflow-hidden backdrop-blur-md ${
                                                isLive
                                                    ? 'bg-[#0a273b]/80 border-emerald-500/50 shadow-xl shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                                                    : isWaiting
                                                    ? 'bg-[#29121a]/80 border-rose-500/50 shadow-xl shadow-rose-950/30 ring-1 ring-rose-500/30'
                                                    : 'bg-[#0e2142]/60 border-slate-800 opacity-60'
                                            }`}
                                        >
                                            {/* Top Status Badge with Pulsing Dot */}
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <span className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-amber-300">
                                                    {exam.examType || 'CET'} Examination
                                                </span>

                                                {/* Red Dot / Green Dot Indicator */}
                                                {isLive && (
                                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black tracking-wide">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                                        <span>🟢 {timing.label}</span>
                                                    </div>
                                                )}

                                                {isWaiting && (
                                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black tracking-wide">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                                                        <span>🔴 {timing.label}</span>
                                                    </div>
                                                )}

                                                {isConcluded && (
                                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-bold">
                                                        <span>⚪ {timing.label}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Exam Title & Details */}
                                            <div className="mb-6">
                                                <h3 className="text-lg font-black text-white mb-2 leading-snug">
                                                    {exam.title}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300">
                                                    <span className="flex items-center gap-1.5">
                                                        <span>⏱️</span>
                                                        <span>{exam.duration_minutes || 180} Minutes</span>
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <span>📝</span>
                                                        <span>{exam.totalQuestions || 60} Questions</span>
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <span>🎯</span>
                                                        <span>Class {Array.isArray(exam.classes) ? exam.classes.join(', ') : exam.classes || '12'}</span>
                                                    </span>
                                                </div>

                                                {exam.start_time && (
                                                    <div className="mt-3 text-[11px] text-slate-400">
                                                        Scheduled Start: {new Date(exam.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            <div>
                                                {isLive ? (
                                                    <button
                                                        onClick={() => handleStartExam(exam)}
                                                        disabled={startingExamId === (exam._id || exam.id)}
                                                        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black tracking-wider uppercase text-sm shadow-xl shadow-emerald-500/20 active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2"
                                                    >
                                                        <span>🟢 START EXAM NOW</span>
                                                        <span>→</span>
                                                    </button>
                                                ) : isWaiting ? (
                                                    <div className="w-full py-3 px-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-center font-bold text-xs flex items-center justify-center gap-2">
                                                        <span>🔴 Opens at test start time. Button unlocks automatically.</span>
                                                    </div>
                                                ) : (
                                                    <div className="w-full py-3 px-4 rounded-xl bg-slate-800 text-slate-400 text-center font-bold text-xs">
                                                        Exam Session Finished
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800/80 bg-[#071328]/90 py-4 px-6 text-center text-xs text-slate-500">
                Sapthagiri Pre University College, Davanagere • Autonomous Examination Terminal
            </footer>
        </div>
    );
}
