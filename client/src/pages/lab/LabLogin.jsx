import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */
export default function LabLogin() {
    const [form, setForm] = useState({ labId: '', password: '', rollNumber: '' });
    const [step, setStep] = useState(localStorage.getItem('lab_token') ? 'student' : 'lab');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);
    const [bgIndex, setBgIndex] = useState(0);
    const [showPass, setShowPass] = useState(false);
    const navigate = useNavigate();

    /* Background slideshow */
    const BG_IMAGES = ['/pacecollege1.jpg', '/pacecollege2.jpg'];
    useEffect(() => {
        setMounted(true);
        const t = setInterval(() => setBgIndex(i => (i + 1) % BG_IMAGES.length), 7000);
        return () => clearInterval(t);
    }, []);

    const handleLabLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/api/lab/login', { labId: form.labId, password: form.password });
            localStorage.setItem('lab_token', res.data.token);
            localStorage.setItem('lab_user', JSON.stringify(res.data.user));
            setStep('student');
        } catch (e) {
            setError(e.response?.data?.msg || 'Login failed. This terminal may not be authorized.');
        }
        setLoading(false);
    };

    const handleStudentProceed = async (e) => {
        e.preventDefault();
        if (!form.rollNumber) return setError('Roll Number is required');
        setError('');
        setLoading(true);
        try {
            const res = await api.get(`/api/lab/student/${form.rollNumber.trim()}`);
            const d = res.data;
            localStorage.setItem('student_info', JSON.stringify({
                studentName: d.name, rollNumber: d.rollNumber,
                studentEmail: d.email, section: d.section
            }));
            navigate('/lab/exams');
        } catch (err) {
            setError(err.response?.data?.msg || 'Student not found. Please check your roll number.');
        }
        setLoading(false);
    };

    return (
        <div style={s.root}>
            <style>{css}</style>

            {/* ── Full-bleed Background Slideshow ── */}
            {BG_IMAGES.map((src, i) => (
                <div key={src} style={{
                    ...s.bgSlide,
                    backgroundImage: `url("${src}")`,
                    opacity: i === bgIndex ? 1 : 0,
                    transition: 'opacity 1.8s ease-in-out',
                }} />
            ))}

            {/* Deep overlay for readability */}
            <div style={s.overlay} />

            {/* Subtle noise texture */}
            <div style={s.noise} />

            {/* ── Layout: Left info panel + Right form panel ── */}
            <div style={{ ...s.layout, opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease' }}>

                {/* LEFT — College identity */}
                <div style={s.leftPanel}>
                    <div style={s.leftInner}>
                        <div style={s.logoWrap}>
                            <img src="/pacelogo.png" alt="PACE" style={s.logo} />
                        </div>

                        <div style={s.collegeNameWrap}>
                            <div style={s.paceWord}>PACE</div>
                            <div style={s.collegeRest}>Pre University College</div>
                        </div>

                        <div style={s.goldRule} />

                        <p style={s.tagline}>
                            Shaping futures through excellence in education since 1994
                        </p>

                        <div style={s.leftFooter}>
                            <div style={s.locationChip}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 12, height: 12, strokeWidth: 2 }}>
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                Shivamogga, Karnataka
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT — Form panel */}
                <div style={s.rightPanel}>
                    <div style={s.formCard}>

                        {/* Step indicator */}
                        <div style={s.stepRow}>
                            <div style={{ ...s.stepDot, background: '#c5a059' }} />
                            <div style={{ ...s.stepLine, background: step === 'student' ? '#c5a059' : 'rgba(0,31,109,0.15)' }} />
                            <div style={{ ...s.stepDot, background: step === 'student' ? '#c5a059' : 'rgba(0,31,109,0.2)' }} />
                            <div style={s.stepLabels}>
                                <span style={{ ...s.stepLbl, color: '#001f6d', fontWeight: 700 }}>Lab Verify</span>
                                <span style={{ ...s.stepLbl, color: step === 'student' ? '#001f6d' : '#94a3b8', fontWeight: step === 'student' ? 700 : 400 }}>Student Login</span>
                            </div>
                        </div>

                        {/* ── LAB STEP ── */}
                        {step === 'lab' && (
                            <div key="lab" style={{ animation: 'slideUp 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                                <div style={s.formHeader}>
                                    <div style={s.formIconWrap}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 22, height: 22, strokeWidth: 2, color: '#c5a059' }}>
                                            <rect x="3" y="11" width="18" height="11" rx="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={s.formTitle}>Terminal Verification</div>
                                        <div style={s.formSubtitle}>Restricted to authorized lab systems</div>
                                    </div>
                                </div>

                                <form onSubmit={handleLabLogin} style={s.form}>
                                    <Field label="Lab Terminal ID" hint="e.g. LAB-001">
                                        <input
                                            style={s.input}
                                            className="pace-input"
                                            type="text"
                                            placeholder="LAB-001"
                                            required
                                            value={form.labId}
                                            onChange={e => setForm(f => ({ ...f, labId: e.target.value }))}
                                            autoComplete="off"
                                        />
                                    </Field>

                                    <Field label="Secure Password">
                                        <div style={s.passWrap}>
                                            <input
                                                style={{ ...s.input, paddingRight: 44 }}
                                                className="pace-input"
                                                type={showPass ? 'text' : 'password'}
                                                placeholder="••••••••••"
                                                required
                                                value={form.password}
                                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                            />
                                            <button type="button" style={s.eyeBtn} onClick={() => setShowPass(v => !v)}>
                                                {showPass
                                                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16, strokeWidth: 2 }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16, strokeWidth: 2 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                }
                                            </button>
                                        </div>
                                    </Field>

                                    {error && <ErrorBanner msg={error} />}

                                    <button style={s.primaryBtn} className="pace-btn" type="submit" disabled={loading}>
                                        {loading
                                            ? <><Spinner /> Verifying Terminal…</>
                                            : <>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16, strokeWidth: 2.5 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                                Verify Lab Terminal
                                            </>
                                        }
                                    </button>
                                </form>

                                <p style={s.hint}>Contact your lab administrator if you don't have credentials</p>
                            </div>
                        )}

                        {/* ── STUDENT STEP ── */}
                        {step === 'student' && (
                            <div key="student" style={{ animation: 'slideUp 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                                <div style={s.formHeader}>
                                    <div style={{ ...s.formIconWrap, background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 22, height: 22, strokeWidth: 2, color: '#059669' }}>
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={s.formTitle}>Student Access</div>
                                        <div style={{ ...s.formSubtitle, color: '#059669' }}>Terminal verified · Enter roll number</div>
                                    </div>
                                </div>

                                <form onSubmit={handleStudentProceed} style={s.form}>
                                    <Field label="Student Roll Number" hint="e.g. 2620101">
                                        <input
                                            style={s.input}
                                            className="pace-input"
                                            type="text"
                                            placeholder="2620101"
                                            required
                                            value={form.rollNumber}
                                            onChange={e => setForm(f => ({ ...f, rollNumber: e.target.value }))}
                                            autoFocus
                                        />
                                    </Field>

                                    {error && <ErrorBanner msg={error} />}

                                    <button style={s.primaryBtn} className="pace-btn" type="submit" disabled={loading}>
                                        {loading
                                            ? <><Spinner /> Verifying Student…</>
                                            : <>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16, strokeWidth: 2.5 }}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                                Access Exam Portal
                                            </>
                                        }
                                    </button>

                                    <button type="button" style={s.ghostBtn} onClick={() => {
                                        localStorage.removeItem('lab_token');
                                        localStorage.removeItem('lab_user');
                                        setStep('lab');
                                        setForm(f => ({ ...f, labId: '', password: '' }));
                                        setError('');
                                    }}>
                                        ← Use Different Terminal
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Card footer */}
                        <div style={s.cardFooter}>
                            © {new Date().getFullYear()} PACE Pre University College · Examinations
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Sub-components ── */
function Field({ label, hint, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={s.label}>{label}</label>
                {hint && <span style={s.labelHint}>{hint}</span>}
            </div>
            {children}
        </div>
    );
}

function ErrorBanner({ msg }) {
    return (
        <div style={s.errorBanner}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 15, height: 15, strokeWidth: 2.5, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {msg}
        </div>
    );
}

function Spinner() {
    return <span className="pace-spin" style={{ display: 'inline-block', width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />;
}

/* ── Global CSS ── */
const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes slideUp {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
    }

    .pace-input:focus {
        outline: none;
        border-color: #c5a059 !important;
        background: #fff !important;
        box-shadow: 0 0 0 3px rgba(197,160,89,0.12) !important;
    }

    .pace-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #00297a, #0041b8) !important;
        box-shadow: 0 6px 20px rgba(0,31,109,0.4) !important;
        transform: translateY(-1px);
    }

    .pace-btn:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
    }

    .pace-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
`;

/* ── Styles ── */
const s = {
    root: {
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: "'DM Sans', system-ui, sans-serif",
    },

    /* Background */
    bgSlide: {
        position: 'absolute',
        inset: 0,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 0,
    },
    overlay: {
        position: 'absolute', inset: 0,
        background: 'linear-gradient(110deg, rgba(0,15,50,0.88) 0%, rgba(0,25,80,0.75) 50%, rgba(0,10,40,0.70) 100%)',
        zIndex: 1,
    },
    noise: {
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '150px',
    },

    /* Layout */
    layout: {
        position: 'relative', zIndex: 10,
        height: '100vh',
        display: 'flex',
    },

    /* Left panel */
    leftPanel: {
        flex: '0 0 42%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
    },
    leftInner: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: 340,
    },
    logoWrap: {
        width: 110, height: 110,
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    },
    logo: { width: 80, height: 80, objectFit: 'contain' },

    collegeNameWrap: { marginBottom: 20 },
    paceWord: {
        fontFamily: "'Playfair Display', serif",
        fontSize: 52,
        fontWeight: 800,
        color: '#c5a059',
        lineHeight: 1,
        letterSpacing: '6px',
        textShadow: '0 2px 20px rgba(197,160,89,0.4)',
    },
    collegeRest: {
        fontSize: 15,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.65)',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        marginTop: 6,
    },

    goldRule: {
        width: 60, height: 2,
        background: 'linear-gradient(90deg, transparent, #c5a059, transparent)',
        margin: '0 auto 20px',
    },

    tagline: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.45)',
        lineHeight: 1.7,
        fontStyle: 'italic',
        maxWidth: 260,
    },

    leftFooter: { marginTop: 32 },
    locationChip: {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.5)',
        borderRadius: 20,
        padding: '5px 14px',
        fontSize: 12, fontWeight: 500,
    },

    /* Right panel */
    rightPanel: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(2px)',
    },
    formCard: {
        background: '#ffffff',
        borderRadius: 20,
        padding: '36px 40px 28px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
    },

    /* Step tracker */
    stepRow: {
        display: 'flex', alignItems: 'center', gap: 0,
        marginBottom: 28,
        position: 'relative',
        flexWrap: 'wrap',
    },
    stepDot: {
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        transition: 'background 0.4s ease',
    },
    stepLine: {
        flex: 1, height: 2, margin: '0 8px',
        transition: 'background 0.4s ease',
        borderRadius: 2,
    },
    stepLabels: {
        position: 'absolute',
        top: 18, left: 0, right: 0,
        display: 'flex',
        justifyContent: 'space-between',
    },
    stepLbl: {
        fontSize: 11, letterSpacing: '0.3px',
        transition: 'all 0.3s',
    },

    /* Form header */
    formHeader: {
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 24,
    },
    formIconWrap: {
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        border: '1.5px solid #fbbf24',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    formTitle: {
        fontSize: 20, fontWeight: 700, color: '#001f6d',
        letterSpacing: '-0.3px',
    },
    formSubtitle: {
        fontSize: 12, color: '#94a3b8', fontWeight: 500, marginTop: 2,
    },

    /* Form */
    form: {
        display: 'flex', flexDirection: 'column', gap: 18,
    },
    label: {
        fontSize: 12, fontWeight: 700, color: '#001f6d',
        textTransform: 'uppercase', letterSpacing: '0.7px',
    },
    labelHint: {
        fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono', monospace",
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        border: '1.5px solid #e2e8f0',
        borderRadius: 10,
        fontSize: 14, fontFamily: "'DM Sans', sans-serif",
        background: '#f8fafc',
        color: '#1e293b',
        transition: 'all 0.2s ease',
    },
    passWrap: { position: 'relative' },
    eyeBtn: {
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#94a3b8', display: 'flex', padding: 4,
    },

    errorBanner: {
        display: 'flex', alignItems: 'flex-start', gap: 8,
        background: '#fef2f2', border: '1.5px solid #fca5a5',
        color: '#991b1b', padding: '11px 14px', borderRadius: 9,
        fontSize: 13, fontWeight: 500, lineHeight: 1.4,
    },

    primaryBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'linear-gradient(135deg, #001f6d 0%, #003499 100%)',
        color: '#fff', border: 'none', borderRadius: 10,
        padding: '13px 20px', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', width: '100%',
        letterSpacing: '0.2px',
        boxShadow: '0 4px 16px rgba(0,31,109,0.28)',
        transition: 'all 0.25s ease',
        fontFamily: "'DM Sans', sans-serif",
        marginTop: 4,
    },

    ghostBtn: {
        background: 'transparent', color: '#64748b',
        border: '1.5px solid #e8ecf0', borderRadius: 10,
        padding: '11px 20px', fontSize: 13, fontWeight: 500,
        cursor: 'pointer', width: '100%',
        transition: 'all 0.2s',
        fontFamily: "'DM Sans', sans-serif",
    },

    hint: {
        fontSize: 11, color: '#b0bac6', textAlign: 'center',
        fontStyle: 'italic', marginTop: 4,
    },

    cardFooter: {
        marginTop: 28, paddingTop: 20,
        borderTop: '1px solid #f1f5f9',
        textAlign: 'center',
        fontSize: 11, color: '#cbd5e1', letterSpacing: '0.2px',
    },
};