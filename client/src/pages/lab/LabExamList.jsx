import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

export default function LabExamList() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);
    const navigate = useNavigate();
    const studentInfo = JSON.parse(localStorage.getItem('student_info') || '{}');

    useEffect(() => {
        if (!studentInfo.studentName) {
            navigate('/lab-login');
            return;
        }
        api.get(`/api/lab/exams?rollNumber=${encodeURIComponent(studentInfo.rollNumber || '')}`)
            .then(r => { setExams(r.data); setLoading(false); setTimeout(() => setMounted(true), 50); })
            .catch(e => { setError(e.response?.data?.msg || 'Failed to load exams'); setLoading(false); });
    }, []);

    const now = new Date();

    const getExamStatus = (exam) => {
        if (!exam.start_time) return 'live';
        const start = new Date(exam.start_time);
        const end = exam.end_time ? new Date(exam.end_time) : new Date(start.getTime() + exam.duration_minutes * 60000);
        if (now < start) return 'upcoming';
        if (now > end) return 'ended';
        return 'live';
    };

    if (loading) return <LoadingScreen />;
    if (error) return <ErrorScreen message={error} />;

    return (
        <div style={s.page}>
            <style>{css}</style>

            {/* Topbar */}
            <header style={s.topbar}>
                <div style={s.topbarInner}>
                    <div style={s.brand}>
                        <div style={{...s.brandShield, background: 'transparent', border: 'none'}}>
                            <img src="/pacelogo.png" alt="PACE Logo" style={{width: 36, height: 36, objectFit: 'contain'}} />
                        </div>
                        <div>
                            <div style={s.brandName}>PACE Pre University College, Shivamogga</div>
                            <div style={s.brandSub}>Examination Portal</div>
                        </div>
                    </div>

                    <div style={s.topbarRight}>
                        <div style={s.studentChip}>
                            <div style={s.studentAvatar}>
                                {(studentInfo.studentName || 'S')[0].toUpperCase()}
                            </div>
                            <div style={s.studentMeta}>
                                <div style={s.studentName}>{studentInfo.studentName || 'Student'}</div>
                                <div style={s.studentRoll}>{studentInfo.rollNumber || ''}</div>
                            </div>
                        </div>
                        <button style={s.logoutBtn} onClick={() => {
                            localStorage.removeItem('student_info');
                            navigate('/lab-login');
                        }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 14, height: 14, strokeWidth: 2.5 }}>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={s.main}>
                {/* Page Title */}
                <div style={{ ...s.titleRow, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)', transition: 'all 0.5s ease' }}>
                    <div>
                        <h1 style={s.pageTitle}>Available Examinations</h1>
                        <p style={s.pageSubtitle}>
                            {exams.length > 0
                                ? `${exams.length} exam${exams.length !== 1 ? 's' : ''} scheduled for your session`
                                : 'No exams are currently scheduled'}
                        </p>
                    </div>
                    <div style={s.liveTag}>
                        <div style={s.liveDot}></div>
                        Live Session
                    </div>
                </div>

                {/* Exam Cards */}
                {exams.length === 0 ? (
                    <EmptyState mounted={mounted} />
                ) : (
                    <div style={s.grid}>
                        {exams.map((exam, i) => (
                            <ExamCard
                                key={exam._id}
                                exam={exam}
                                status={getExamStatus(exam)}
                                index={i}
                                mounted={mounted}
                                onStart={() => navigate(`/exam/${exam._id}/instructions`)}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Footer strip */}
            <footer style={s.footer}>
                © {new Date().getFullYear()} PACE Pre University College, Shivamogga · Examination System · All sessions are monitored
            </footer>
        </div>
    );
}

function ExamCard({ exam, status, index, mounted, onStart }) {
    const [hovered, setHovered] = useState(false);
    const navigate = useNavigate();

    const statusConfig = {
        live: { label: 'Live Now', bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
        upcoming: { label: 'Upcoming', bg: '#fef9c3', color: '#854d0e', dot: '#eab308' },
        ended: { label: 'Ended', bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
    };
    const st = statusConfig[status];

    const delay = `${index * 80}ms`;

    return (
        <div
            style={{
                ...s.card,
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'none' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${delay}, transform 0.5s ease ${delay}, box-shadow 0.25s ease, border-color 0.25s ease`,
                boxShadow: hovered ? '0 12px 40px rgba(0, 31, 109, 0.15)' : '0 2px 12px rgba(0,0,0,0.06)',
                borderColor: hovered ? '#c5a059' : '#e8ecf0',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Card top accent */}
            <div style={{ ...s.cardAccent, opacity: hovered ? 1 : 0, transition: 'opacity 0.3s' }}></div>

            <div style={s.cardHeader}>
                <div style={s.cardHeaderLeft}>
                    <span style={{ ...s.examTypeTag, background: '#eef2ff', color: '#3730a3' }}>
                        {exam.examType || 'Examination'}
                    </span>
                    <span style={{ ...s.statusBadge, background: st.bg, color: st.color }}>
                        <span style={{ ...s.statusDot, background: st.dot }}></span>
                        {st.label}
                    </span>
                </div>
                <div style={s.durationBadge}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 13, height: 13, strokeWidth: 2 }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {exam.duration_minutes} min
                </div>
            </div>

            <h2 style={s.examTitle}>{exam.title}</h2>

            {exam.subject && <p style={s.examSubject}>{exam.subject}</p>}

            <div style={s.metaRow}>
                {exam.start_time && (
                    <div style={s.metaItem}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 14, height: 14, strokeWidth: 2 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {new Date(exam.start_time).toLocaleString('en-IN', {
                            dateStyle: 'medium', timeStyle: 'short'
                        })}
                    </div>
                )}
                {exam.totalMarks && (
                    <div style={s.metaItem}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 14, height: 14, strokeWidth: 2 }}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {exam.totalMarks} marks
                    </div>
                )}
            </div>

            <div style={s.cardDivider}></div>

            {exam.sessionStatus === 'submitted' ? (
                <button
                    style={{
                        ...s.startBtn,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                        transform: hovered ? 'scale(1.01)' : 'scale(1)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onClick={() => navigate(`/exam/${exam._id}/scorecard/${exam.sessionId}`)}
                >
                    📊 View Scorecard
                </button>
            ) : exam.sessionStatus === 'active' ? (
                <button
                    style={{
                        ...s.startBtn,
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        boxShadow: '0 4px 14px rgba(59, 130, 246, 0.25)',
                        transform: hovered ? 'scale(1.01)' : 'scale(1)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onClick={onStart}
                >
                    ▶ Resume Examination
                </button>
            ) : (
                <button
                    style={{
                        ...s.startBtn,
                        ...(status === 'ended' ? s.startBtnDisabled : {}),
                        transform: hovered && status !== 'ended' ? 'scale(1.01)' : 'scale(1)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onClick={status !== 'ended' ? onStart : undefined}
                    disabled={status === 'ended'}
                >
                    {status === 'ended' ? 'Exam Ended' : status === 'upcoming' ? '⏳ View Instructions' : '▶ Start Examination'}
                </button>
            )}
        </div>
    );
}

function LoadingScreen() {
    return (
        <div style={s.fullCenter}>
            <style>{css}</style>
            <div style={s.loadingCard}>
                <div style={s.spinnerWrap}>
                    <div className="mc-spinner"></div>
                </div>
                <div style={s.loadingTitle}>Loading Examinations</div>
                <div style={s.loadingSubtitle}>Fetching your scheduled assessments...</div>
            </div>
        </div>
    );
}

function ErrorScreen({ message }) {
    return (
        <div style={s.fullCenter}>
            <div style={s.errorCard}>
                <div style={s.errorIcon}>⚠</div>
                <div style={s.errorTitle}>Unable to Load</div>
                <div style={s.errorMsg}>{message}</div>
                <button style={s.retryBtn} onClick={() => window.location.reload()}>
                    Try Again
                </button>
            </div>
        </div>
    );
}

function EmptyState({ mounted }) {
    return (
        <div style={{ ...s.emptyCard, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }}>
            <div style={s.emptyIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 36, height: 36, strokeWidth: 1.5 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>
            </div>
            <div style={s.emptyTitle}>No Exams Scheduled</div>
            <div style={s.emptyText}>There are no live or upcoming examinations for your session at this time. Please check with your invigilator.</div>
        </div>
    );
}

const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes spin-arc {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @keyframes livePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.85); }
    }

    .mc-spinner {
        width: 40px; height: 40px;
        border-radius: 50%;
        border: 3px solid #e8ecf0;
        border-top-color: #001f6d;
        border-right-color: #c5a059;
        animation: spin-arc 0.9s linear infinite;
    }
`;

const s = {
    page: {
        minHeight: '100vh',
        background: '#f4f6fb',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
    },

    /* ── Topbar ── */
    topbar: {
        background: '#001f6d',
        borderBottom: '2px solid #c5a059',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    topbarInner: {
        maxWidth: 1080,
        margin: '0 auto',
        padding: '0 28px',
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brand: { display: 'flex', alignItems: 'center', gap: 14 },
    brandShield: {
        width: 40, height: 40,
        background: 'rgba(197,160,89,0.15)',
        border: '1px solid rgba(197,160,89,0.4)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    shieldSvg: { width: 22, height: 22, color: '#c5a059' },
    brandName: { fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '0.3px' },
    brandSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

    topbarRight: { display: 'flex', alignItems: 'center', gap: 12 },
    studentChip: {
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: '7px 14px 7px 8px',
    },
    studentAvatar: {
        width: 30, height: 30, borderRadius: 8,
        background: 'linear-gradient(135deg, #c5a059, #e8c97a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#001f6d',
    },
    studentMeta: {},
    studentName: { fontSize: 13, fontWeight: 600, color: '#fff' },
    studentRoll: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: "'DM Mono', monospace" },

    logoutBtn: {
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.7)',
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer',
    },

    /* ── Main ── */
    main: {
        maxWidth: 1080,
        margin: '0 auto',
        padding: '40px 28px 60px',
        width: '100%',
        flex: 1,
    },
    titleRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 36,
    },
    pageTitle: {
        fontSize: 30,
        fontWeight: 700,
        color: '#001f6d',
        letterSpacing: '-0.5px',
        marginBottom: 6,
    },
    pageSubtitle: { fontSize: 14, color: '#64748b', fontWeight: 400 },

    liveTag: {
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff',
        border: '1.5px solid #dcfce7',
        color: '#15803d',
        borderRadius: 20,
        padding: '7px 16px',
        fontSize: 13, fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
    liveDot: {
        width: 8, height: 8, borderRadius: '50%',
        background: '#22c55e',
        animation: 'livePulse 1.8s ease-in-out infinite',
    },

    /* ── Exam Grid ── */
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 20,
    },

    /* ── Exam Card ── */
    card: {
        background: '#ffffff',
        border: '1.5px solid #e8ecf0',
        borderRadius: 16,
        padding: '28px 28px 24px',
        position: 'relative',
        overflow: 'hidden',
    },
    cardAccent: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        background: 'linear-gradient(90deg, #001f6d, #c5a059)',
        borderRadius: '16px 16px 0 0',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

    examTypeTag: {
        fontSize: 11, fontWeight: 700,
        padding: '3px 10px', borderRadius: 5,
        letterSpacing: '0.5px', textTransform: 'uppercase',
    },
    statusBadge: {
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 12, fontWeight: 600,
        padding: '3px 10px', borderRadius: 20,
    },
    statusDot: { width: 6, height: 6, borderRadius: '50%' },

    durationBadge: {
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 12, fontWeight: 600,
        color: '#64748b',
        background: '#f1f5f9',
        padding: '4px 10px', borderRadius: 8,
    },

    examTitle: {
        fontSize: 20, fontWeight: 700,
        color: '#0f172a',
        lineHeight: 1.3,
        marginBottom: 6,
        letterSpacing: '-0.3px',
    },
    examSubject: {
        fontSize: 13, color: '#94a3b8',
        marginBottom: 14,
    },

    metaRow: { display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 },
    metaItem: {
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: '#64748b', fontWeight: 500,
    },

    cardDivider: { height: 1, background: '#f1f5f9', marginBottom: 20 },

    startBtn: {
        width: '100%',
        background: 'linear-gradient(135deg, #001f6d 0%, #003499 100%)',
        color: '#ffffff',
        border: 'none',
        borderRadius: 10,
        padding: '13px',
        fontSize: 14, fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.3px',
        boxShadow: '0 4px 14px rgba(0, 31, 109, 0.25)',
    },
    startBtnDisabled: {
        background: '#f1f5f9',
        color: '#94a3b8',
        boxShadow: 'none',
        cursor: 'not-allowed',
    },

    /* ── Empty / Error / Loading ── */
    fullCenter: {
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f4f6fb',
        fontFamily: "'DM Sans', system-ui, sans-serif",
    },
    loadingCard: {
        background: '#fff', borderRadius: 20, padding: '48px 56px',
        textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        border: '1px solid #e8ecf0',
    },
    spinnerWrap: { display: 'flex', justifyContent: 'center', marginBottom: 24 },
    loadingTitle: { fontSize: 18, fontWeight: 700, color: '#001f6d', marginBottom: 6 },
    loadingSubtitle: { fontSize: 14, color: '#94a3b8' },

    errorCard: {
        background: '#fff', borderRadius: 20, padding: '48px 56px',
        textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        maxWidth: 400,
    },
    errorIcon: { fontSize: 40, marginBottom: 16, color: '#ef4444' },
    errorTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 },
    errorMsg: { fontSize: 14, color: '#64748b', marginBottom: 24 },
    retryBtn: {
        background: '#001f6d', color: '#fff', border: 'none',
        borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    },

    emptyCard: {
        background: '#fff', borderRadius: 20, padding: '72px 40px',
        textAlign: 'center', border: '1.5px dashed #e2e8f0',
    },
    emptyIcon: {
        width: 72, height: 72, borderRadius: 18,
        background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', color: '#94a3b8',
    },
    emptyTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 10 },
    emptyText: { fontSize: 14, color: '#94a3b8', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 },

    footer: {
        textAlign: 'center', fontSize: 11, color: '#94a3b8',
        padding: '16px 24px',
        borderTop: '1px solid #e8ecf0',
        background: '#fff',
        letterSpacing: '0.2px',
    },
};