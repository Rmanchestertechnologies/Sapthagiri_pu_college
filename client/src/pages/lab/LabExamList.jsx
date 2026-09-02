import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

export default function LabExamList() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);
    const [candidateModalExam, setCandidateModalExam] = useState(null);
    const [candidateData, setCandidateData] = useState({
        studentName: '',
        rollNumber: '',
        section: 'A'
    });
    const navigate = useNavigate();
    const labToken = localStorage.getItem('lab_token');
    const labUser = JSON.parse(localStorage.getItem('lab_user') || '{}');

    useEffect(() => {
        if (!labToken) {
            navigate('/lab');
            return;
        }
        api.get('/api/lab/exams')
            .then(r => {
                setExams(r.data);
                setLoading(false);
                setTimeout(() => setMounted(true), 50);
            })
            .catch(e => {
                setError(e.response?.data?.msg || 'Failed to load examinations.');
                setLoading(false);
            });
    }, [labToken, navigate]);

    const now = new Date();

    const getExamStatus = (exam) => {
        if (!exam.start_time) return 'live';
        const start = new Date(exam.start_time);
        const end = exam.end_time ? new Date(exam.end_time) : new Date(start.getTime() + (exam.duration_minutes || 180) * 60000);
        if (now < start) return 'upcoming';
        if (now > end) return 'ended';
        return 'live';
    };

    const handleCandidateSubmit = (e) => {
        e.preventDefault();
        if (!candidateData.studentName.trim() || !candidateData.rollNumber.trim()) {
            return;
        }

        const info = {
            studentName: candidateData.studentName.trim(),
            rollNumber: candidateData.rollNumber.trim(),
            section: candidateData.section.trim() || 'A',
            studentEmail: `${candidateData.rollNumber.trim()}@student.sapthagiri.edu`
        };

        localStorage.setItem('student_info', JSON.stringify(info));
        const examId = candidateModalExam._id || candidateModalExam.id;

        // Enter Full Screen Mode
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } catch (err) {}

        navigate(`/exam/${examId}/instructions`);
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
                        <div style={{ ...s.brandShield, background: 'transparent', border: 'none' }}>
                            <img src="/SapthagiriLogo.jpg" alt="Sapthagiri Logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }} />
                        </div>
                        <div>
                            <div style={s.brandName}>Sapthagiri Pre University College, Davanagere</div>
                            <div style={s.brandSub}>Online Examination Portal</div>
                        </div>
                    </div>

                    <div style={s.topbarRight}>
                        <div style={s.terminalBadge}>
                            <span style={{ fontSize: '14px' }}>🖥️</span>
                            <span>{labUser.labId || 'LAB-001'} (Authorized Terminal)</span>
                        </div>
                        <button
                            style={s.logoutBtn}
                            onClick={() => {
                                localStorage.removeItem('lab_token');
                                localStorage.removeItem('lab_user');
                                localStorage.removeItem('student_info');
                                navigate('/lab');
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 14, height: 14, strokeWidth: 2.5 }}>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Exit Terminal
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={s.main}>
                {/* Page Title */}
                <div style={{ ...s.titleRow, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)', transition: 'all 0.5s ease' }}>
                    <div>
                        <h1 style={s.pageTitle}>Available Online Examinations</h1>
                        <p style={s.pageSubtitle}>
                            {exams.length > 0
                                ? `${exams.length} examination${exams.length !== 1 ? 's' : ''} available on this terminal`
                                : 'No examinations are currently scheduled or active'}
                        </p>
                    </div>
                    <div style={s.liveTag}>
                        <div style={s.liveDot}></div>
                        Live Session Active
                    </div>
                </div>

                {/* Exam Cards */}
                {exams.length === 0 ? (
                    <EmptyState mounted={mounted} />
                ) : (
                    <div style={s.grid}>
                        {exams.map((exam, i) => (
                            <ExamCard
                                key={exam._id || exam.id}
                                exam={exam}
                                status={getExamStatus(exam)}
                                index={i}
                                mounted={mounted}
                                onStart={() => setCandidateModalExam(exam)}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* ── MODAL: Candidate Registration (Reg No & Name) ── */}
            {candidateModalExam && (
                <div style={mStyles.backdrop}>
                    <div style={mStyles.card}>
                        <div style={mStyles.header}>
                            <div style={mStyles.badge}>Candidate Verification</div>
                            <h2 style={mStyles.examTitle}>{candidateModalExam.title}</h2>
                            <p style={mStyles.examMeta}>
                                Pattern: <strong>{candidateModalExam.examType || 'CET'}</strong> • Duration: <strong>{candidateModalExam.duration_minutes || 180} mins</strong>
                            </p>
                        </div>

                        <form onSubmit={handleCandidateSubmit} style={mStyles.form}>
                            <div>
                                <label style={mStyles.label}>
                                    Candidate Full Name <span style={{ color: '#e11d48' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter your full name"
                                    value={candidateData.studentName}
                                    onChange={e => setCandidateData(d => ({ ...d, studentName: e.target.value }))}
                                    style={mStyles.input}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label style={mStyles.label}>
                                    Register Number / Roll Number <span style={{ color: '#e11d48' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 2620101"
                                    value={candidateData.rollNumber}
                                    onChange={e => setCandidateData(d => ({ ...d, rollNumber: e.target.value }))}
                                    style={mStyles.input}
                                />
                            </div>

                            <div>
                                <label style={mStyles.label}>Class / Section</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Section A"
                                    value={candidateData.section}
                                    onChange={e => setCandidateData(d => ({ ...d, section: e.target.value }))}
                                    style={mStyles.input}
                                />
                            </div>

                            {/* Proctored Warning Notice */}
                            <div style={mStyles.warningBox}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '20px' }}>⚠️</span>
                                    <div>
                                        <div style={mStyles.warningTitle}>Strict Anti-Cheating & Full Screen Enforced</div>
                                        <div style={mStyles.warningText}>
                                            Entering the examination will activate <strong>Full-Screen Mode</strong>. If you switch tabs, minimize the browser, or blur the window, the test will <strong>automatically submit instantly</strong> and an alert notification will be sent to the Admin.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={mStyles.btnRow}>
                                <button
                                    type="button"
                                    onClick={() => setCandidateModalExam(null)}
                                    style={mStyles.cancelBtn}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={mStyles.submitBtn}
                                >
                                    Enter Full Screen & Take Exam →
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Footer strip */}
            <footer style={s.footer}>
                © {new Date().getFullYear()} Sapthagiri Pre University College, Davanagere · Online Examination System · Monitored Session
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
    const st = statusConfig[status] || statusConfig.live;

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
                    {exam.duration_minutes || 180} min
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
                {exam.totalQuestions > 0 && (
                    <div style={s.metaItem}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 14, height: 14, strokeWidth: 2 }}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {exam.totalQuestions} Questions
                    </div>
                )}
            </div>

            <div style={s.cardDivider}></div>

            <button
                style={{
                    ...s.startBtn,
                    background: 'linear-gradient(135deg, #001f6d 0%, #0c2d82 100%)',
                    transform: hovered ? 'scale(1.01)' : 'scale(1)',
                    boxShadow: hovered ? '0 6px 20px rgba(0, 31, 109, 0.3)' : '0 2px 8px rgba(0, 31, 109, 0.15)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onClick={onStart}
            >
                <span>✍️</span> Take Exam →
            </button>
        </div>
    );
}

function LoadingScreen() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: 16 }}>
            <div style={{ width: 44, height: 44, border: '4px solid #e2e8f0', borderTopColor: '#c5a059', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
            <div style={{ color: '#001f6d', fontWeight: 700, fontSize: '15px' }}>Loading Examination Portal…</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function ErrorScreen({ message }) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: '#991b1b', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Unable to Load Examinations</h2>
            <p style={{ color: '#64748b', fontSize: 14, maxWidth: 400, marginBottom: 20 }}>{message}</p>
            <button
                onClick={() => window.location.reload()}
                style={{ background: '#001f6d', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
                Try Again
            </button>
        </div>
    );
}

function EmptyState({ mounted }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '48px 24px', textAlign: 'center', maxWidth: 500, margin: '40px auto', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', opacity: mounted ? 1 : 0, transition: 'opacity 0.6s' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>📋</div>
            <h3 style={{ color: '#001f6d', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>No Examinations Scheduled</h3>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                There are currently no active or scheduled examinations available on this terminal. Please check back when your instructor initiates the exam.
            </p>
        </div>
    );
}

const s = {
    page: { minHeight: '100vh', background: '#f4f6fa', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
    topbar: { background: '#001f6d', color: '#fff', borderBottom: '2px solid #c5a059', position: 'sticky', top: 0, zIndex: 50 },
    topbarInner: { maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    brand: { display: 'flex', alignItems: 'center', gap: 12 },
    brandShield: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    brandName: { fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em', color: '#fff' },
    brandSub: { fontSize: '11px', color: '#c5a059', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' },
    topbarRight: { display: 'flex', alignItems: 'center', gap: 12 },
    terminalBadge: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 10, fontSize: '12px', color: '#e2e8f0', fontWeight: 700 },
    logoutBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: 10, fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' },
    main: { maxWidth: 1280, margin: '0 auto', padding: '32px 24px 60px' },
    titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 },
    pageTitle: { fontSize: '24px', fontWeight: 800, color: '#001f6d', margin: '0 0 4px', letterSpacing: '-0.02em' },
    pageSubtitle: { fontSize: '13px', color: '#64748b', margin: 0 },
    liveTag: { display: 'flex', alignItems: 'center', gap: 7, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '5px 12px', borderRadius: 20, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
    liveDot: { width: 7, height: 7, borderRadius: '50%', background: '#059669', animation: 'pulse 1.8s infinite' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 },
    card: { background: '#fff', borderRadius: 18, border: '1.5px solid #e8ecf0', padding: '22px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #001f6d, #c5a059)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: 8 },
    examTypeTag: { fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.03em' },
    statusBadge: { display: 'flex', alignItems: 'center', gap: 5, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 6 },
    statusDot: { width: 6, height: 6, borderRadius: '50%' },
    durationBadge: { display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', color: '#64748b', fontWeight: 600 },
    examTitle: { fontSize: '16px', fontWeight: 800, color: '#001f6d', margin: '0 0 6px', lineHeight: 1.35 },
    examSubject: { fontSize: '12px', color: '#b45309', fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase' },
    metaRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 'auto', paddingTop: 10 },
    metaItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', color: '#64748b' },
    cardDivider: { height: 1, background: '#f1f5f9', margin: '14px 0' },
    startBtn: { width: '100%', color: '#fff', border: 'none', padding: '12px', borderRadius: 12, fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.03em' },
    footer: { textAlign: 'center', padding: '24px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', background: '#fff' }
};

const mStyles = {
    backdrop: { position: 'fixed', inset: 0, background: 'rgba(0, 31, 109, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
    card: { background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0, 10, 40, 0.35)', border: '2px solid #c5a059', overflow: 'hidden', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' },
    header: { background: 'linear-gradient(135deg, #001f6d 0%, #072a8c 100%)', padding: '22px 24px', color: '#fff', textAlign: 'center' },
    badge: { display: 'inline-block', background: 'rgba(197,160,89,0.2)', border: '1px solid #c5a059', color: '#fcd34d', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: '20px', marginBottom: '8px' },
    examTitle: { margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: '#fff' },
    examMeta: { margin: 0, fontSize: '12px', color: '#cbd5e1' },
    form: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    label: { display: 'block', fontSize: '12px', fontWeight: 800, color: '#001f6d', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: '#f8fafc', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
    warningBox: { background: '#fffbeb', border: '1.5px solid #fef3c7', borderRadius: '14px', padding: '12px 14px' },
    warningTitle: { color: '#92400e', fontWeight: 800, fontSize: '12px', marginBottom: '3px' },
    warningText: { color: '#78350f', fontSize: '11px', lineHeight: 1.45 },
    btnRow: { display: 'flex', gap: '10px', marginTop: '6px' },
    cancelBtn: { flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '13px', cursor: 'pointer' },
    submitBtn: { flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #001f6d 0%, #072a8c 100%)', color: '#fff', fontWeight: 800, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0, 31, 109, 0.3)' }
};

const css = `
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } }
@keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
`;
