import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';

// ── Palette States ──────────────────────────────────────────────
// not_visited: #6b7280 (grey)
// not_answered: #ef4444 (red)
// answered: #10b981 (green)
// marked: #8b5cf6 (purple)
// answered_marked: #8b5cf6 with green dot

const STATE = {
    NOT_VISITED: 'not_visited',
    NOT_ANSWERED: 'not_answered',
    ANSWERED: 'answered',
    MARKED: 'marked',
    ANSWERED_MARKED: 'answered_marked'
};

const STATE_COLORS = {
    [STATE.NOT_VISITED]: '#6b7280',
    [STATE.NOT_ANSWERED]: '#ef4444',
    [STATE.ANSWERED]: '#10b981',
    [STATE.MARKED]: '#8b5cf6',
    [STATE.ANSWERED_MARKED]: '#8b5cf6'
};

function getState(q) {
    if (!q.visited) return STATE.NOT_VISITED;
    if (q.selectedOption && q.markedForReview) return STATE.ANSWERED_MARKED;
    if (q.markedForReview) return STATE.MARKED;
    if (q.selectedOption) return STATE.ANSWERED;
    return STATE.NOT_ANSWERED;
}

export default function ExamEngine() {
    const { examId } = useParams();
    const navigate = useNavigate();
    const studentInfo = JSON.parse(localStorage.getItem('student_info') || '{}');

    const [exam, setExam] = useState(null);
    const [session, setSession] = useState(null);
    const [answers, setAnswers] = useState([]); // per-question local state
    const [current, setCurrent] = useState(0);
    const [timeLeft, setTimeLeft] = useState(null); // seconds
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const timerRef = useRef(null);
    const autoSubmitted = useRef(false);
    const isSubmittingOrFinished = useRef(false);

    const triggerMalpractice = useCallback(async (reason) => {
        if (isSubmittingOrFinished.current) return;
        isSubmittingOrFinished.current = true;
        
        try {
            await api.post(`/api/exams/${examId}/malpractice`, {
                sessionId: session?._id || session?.id,
                reason
            });
        } catch (e) {
            console.error('Failed to report malpractice:', e);
        }

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        localStorage.removeItem('active_exam_session_id');
        navigate(`/exam/disqualified?reason=${encodeURIComponent(reason)}`);
    }, [session, examId, navigate]);

    // ── Load exam and start session ─────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const emailParam = encodeURIComponent(studentInfo.studentEmail || '');
                const rollParam = encodeURIComponent(studentInfo.rollNumber || '');
                const examRes = await api.get(`/api/exams/${examId}/take?email=${emailParam}&rollNumber=${rollParam}`);
                const e = examRes.data;

                // 1. Enforce scheduled start time: if student tries to enter early, redirect to instructions
                if (e.start_time) {
                    const start = new Date(e.start_time).getTime();
                    const now = new Date().getTime();
                    if (now < start) {
                        navigate(`/exam/${examId}/instructions`);
                        return;
                    }
                }

                setExam(e);

                const sessionRes = await api.post(`/api/exams/${examId}/start`, {
                    studentName: studentInfo.studentName || 'Student',
                    studentEmail: studentInfo.studentEmail || '',
                    rollNumber: studentInfo.rollNumber || ''
                });
                const sessionData = sessionRes.data.session;
                setSession(sessionData);

                // Calculate remaining time relative to student's actual session start time
                const elapsedSeconds = Math.floor((new Date().getTime() - new Date(sessionData.startTime).getTime()) / 1000);
                let durationSeconds = e.duration_minutes * 60 - elapsedSeconds;
                if (durationSeconds < 0) durationSeconds = 0;

                // Late Entry Check: Capped remaining time based on end_time if it exists
                if (e.end_time) {
                    const end = new Date(e.end_time).getTime();
                    const now = new Date().getTime();
                    const scheduledRemaining = Math.floor((end - now) / 1000);
                    if (scheduledRemaining < durationSeconds) {
                        durationSeconds = Math.max(0, scheduledRemaining);
                    }
                }
                setTimeLeft(durationSeconds);

                // Initialize local answers state (restore saved state if session resumed)
                const storageKey = `exam_answers_${examId}_${sessionData._id}`;
                const cachedAnswersStr = localStorage.getItem(storageKey);
                let cachedAnswers = null;
                if (cachedAnswersStr) {
                    try { cachedAnswers = JSON.parse(cachedAnswersStr); } catch(e) {}
                }

                setAnswers(e.questions.map((q, i) => {
                    const savedAns = sessionData.answers?.find(sa => sa.questionId?.toString() === q._id?.toString());
                    const cachedAns = cachedAnswers?.find(ca => ca.questionId?.toString() === q._id?.toString());
                    return {
                        questionId: q._id,
                        selectedOption: cachedAns ? cachedAns.selectedOption : (savedAns ? savedAns.selectedOption : null),
                        markedForReview: cachedAns ? cachedAns.markedForReview : (savedAns ? savedAns.markedForReview : false),
                        visited: cachedAns ? cachedAns.visited : (savedAns ? savedAns.visited : (i === 0)),
                        timeTaken: cachedAns ? (cachedAns.timeTaken || 0) : (savedAns ? (savedAns.timeTaken || 0) : 0)
                    };
                }));
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        init();
        return () => clearInterval(timerRef.current);
    }, [examId, navigate]);

    // ── Malpractice and Security Controls ─────────────────────────
    useEffect(() => {
        if (!session || !exam) return;

        // Enter fullscreen mode and keep it fullscreen
        const enterFullscreen = () => {
            if (!document.fullscreenElement && !isSubmittingOrFinished.current) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };
        enterFullscreen();

        const preventDefault = (e) => e.preventDefault();

        // Disable mouse-based copy-pasting & right click
        document.addEventListener('contextmenu', preventDefault);
        document.addEventListener('selectstart', preventDefault);
        document.addEventListener('dragstart', preventDefault);
        document.addEventListener('copy', preventDefault);
        document.addEventListener('cut', preventDefault);
        document.addEventListener('paste', preventDefault);

        // Block secure/developer shortcuts
        const handleKeyDown = (e) => {
            if (isSubmittingOrFinished.current) return;
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X' || e.key === 's' || e.key === 'S'))
            ) {
                e.preventDefault();
                triggerMalpractice(`Unauthorized keyboard shortcut: ${e.key}`);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        // Detect switching tabs or minimizing window
        const handleVisibilityChange = () => {
            if (isSubmittingOrFinished.current) return;
            if (document.visibilityState === 'hidden') {
                triggerMalpractice('Switched tabs or minimized window');
            }
        };

        // Detect loss of window focus (e.g. system alerts, clicking outside browser, secondary monitors/overlays)
        const handleBlur = () => {
            setTimeout(() => {
                if (isSubmittingOrFinished.current) return;
                if (!document.hasFocus()) {
                    triggerMalpractice('Window focus lost (possible overlay or secondary application opened)');
                }
            }, 400);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        // Detect exit from fullscreen
        const handleFullscreenChange = () => {
            if (isSubmittingOrFinished.current) return;
            if (!document.fullscreenElement) {
                triggerMalpractice('Exited secure full-screen mode');
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('contextmenu', preventDefault);
            document.removeEventListener('selectstart', preventDefault);
            document.removeEventListener('dragstart', preventDefault);
            document.removeEventListener('copy', preventDefault);
            document.removeEventListener('cut', preventDefault);
            document.removeEventListener('paste', preventDefault);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [session, exam, triggerMalpractice]);

    // ── Countdown Timer ─────────────────────────────────────────
    useEffect(() => {
        if (timeLeft === null) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(timerRef.current);
                    if (!autoSubmitted.current) { autoSubmitted.current = true; handleSubmit(true); }
                    return 0;
                }
                return t - 1;
            });
            setAnswers(prev => prev.map((a, i) => i === current ? { ...a, timeTaken: (a.timeTaken || 0) + 1 } : a));
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timeLeft !== null, current]);

    // ── Local Storage & Autosave Progress sync ──────────────────
    useEffect(() => {
        if (!session?._id || answers.length === 0) return;
        
        // 1. Sync immediately to localStorage
        const storageKey = `exam_answers_${examId}_${session._id}`;
        localStorage.setItem(storageKey, JSON.stringify(answers));

        // 2. Debounced sync to database
        const timer = setTimeout(async () => {
            try {
                await api.post(`/api/exams/${examId}/session/save-progress`, {
                    sessionId: session._id,
                    answers
                });
            } catch (err) {
                console.error('Failed to autosave progress to server:', err);
            }
        }, 3000); // debounce 3 seconds

        return () => clearTimeout(timer);
    }, [answers, session?._id, examId]);

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const isTimeCritical = timeLeft !== null && timeLeft < 300;

    // ── Palette helpers ─────────────────────────────────────────
    const updateAnswer = (idx, patch) => {
        setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
    };

    const goTo = (idx) => {
        if (idx < 0 || !exam || idx >= exam.questions.length) return;
        // Mark current as visited
        updateAnswer(idx, { visited: true });
        setCurrent(idx);
    };

    // ── Actions ─────────────────────────────────────────────────
    const handleOptionSelect = (opt) => {
        updateAnswer(current, { selectedOption: opt });
    };

    const handleSaveNext = () => {
        updateAnswer(current, { visited: true });
        if (current < exam.questions.length - 1) goTo(current + 1);
    };

    const handleClear = () => {
        updateAnswer(current, { selectedOption: null });
    };

    const handleMarkForReview = () => {
        updateAnswer(current, { markedForReview: true, visited: true });
        if (current < exam.questions.length - 1) goTo(current + 1);
    };

    const handleSaveAndMarkForReview = () => {
        updateAnswer(current, { markedForReview: true, visited: true });
        if (current < exam.questions.length - 1) goTo(current + 1);
    };

    const handleSubmit = useCallback(async (auto = false) => {
        if (submitting) return;
        isSubmittingOrFinished.current = true;
        setSubmitting(true);
        clearInterval(timerRef.current);
        try {
            const res = await api.post(`/api/exams/${examId}/submit`, {
                sessionId: session?._id,
                answers
            });
            try {
                const storageKey = `exam_answers_${examId}_${session?._id}`;
                localStorage.removeItem(storageKey);
            } catch (e) {}
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            navigate(`/exam/${examId}/scorecard/${res.data.sessionId}`);
        } catch (err) {
            console.error('Submit failed', err);
            isSubmittingOrFinished.current = false;
            setSubmitting(false);
        }
    }, [submitting, session, answers, examId, navigate]);

    // ── Computed palette counts ─────────────────────────────────
    const counts = answers.reduce((acc, a) => {
        const s = getState(a);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    if (loading) return <div style={styles.center}>Loading exam...</div>;
    if (!exam) return <div style={styles.center}>Exam not available.</div>;

    const currentQ = exam.questions[current];
    const currentA = answers[current] || {};

    return (
        <div style={styles.page}>
            {/* Top Bar */}
            <div style={styles.topBar}>
                <div style={styles.topLeft}>
                    <span style={styles.examTitleTop}>{exam.title}</span>
                    <span style={styles.examTypeTag}>{exam.examType}</span>
                </div>
                <div style={styles.timerBox}>
                    <span style={styles.timerLabel}>Time Left</span>
                    <span style={{ ...styles.timer, color: isTimeCritical ? '#ef4444' : '#10b981' }}>
                        {timeLeft !== null ? formatTime(timeLeft) : '--:--:--'}
                    </span>
                </div>
                <div style={styles.topRight}>
                    <span style={styles.candidateName}>👤 {studentInfo.studentName || 'Candidate'}</span>
                </div>
            </div>

            <div style={styles.body}>
                {/* ── Left: Question Panel ── */}
                <div style={styles.questionPanel}>
                    {/* Question Header */}
                    <div style={styles.qHeader}>
                        <span style={styles.qNum}>Question {current + 1} of {exam.questions.length}</span>
                        <span style={styles.qSubject}>{currentQ.subject} | {currentQ.chapter}</span>
                    </div>

                    {/* Question Text */}
                    <div style={styles.qBody}>
                        {currentQ.type === 'ASSERTION_REASON' && (
                            <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#1f2937' }}>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Assertion (A):</strong> {currentQ.assertion}</p>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Reason (R):</strong> {currentQ.reason}</p>
                            </div>
                        )}

                        {currentQ.type === 'STATEMENT_BASED' && (
                            <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#1f2937' }}>
                                <MathRenderer style={{ marginBottom: '0.75rem', fontWeight: 'bold' }} text={currentQ.questionText} />
                                {currentQ.statements?.map((stmt, idx) => (
                                    <p key={idx} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}><strong>Statement {idx + 1}:</strong> {stmt}</p>
                                ))}
                            </div>
                        )}

                        {currentQ.type === 'MATCH_FOLLOWING' && (
                            <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#1f2937' }}>
                                <MathRenderer style={{ marginBottom: '0.75rem', fontWeight: 'bold' }} text={currentQ.questionText} />
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', background: '#f9fafb', maxWidth: '500px', marginBottom: '1rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', fontWeight: 'bold', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Column A</th>
                                                <th style={{ textAlign: 'left', fontWeight: 'bold', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Column B</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentQ.matchPairs?.map((pair, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ padding: '0.5rem 0' }}>{String.fromCharCode(65 + idx)}. {pair.left}</td>
                                                    <td style={{ padding: '0.5rem 0' }}>{idx + 1}. {pair.right}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {currentQ.type !== 'ASSERTION_REASON' && currentQ.type !== 'STATEMENT_BASED' && currentQ.type !== 'MATCH_FOLLOWING' && (
                            <MathRenderer style={styles.qText} text={currentQ.questionText} />
                        )}
                        {currentQ.imageUrl && (
                            <img src={currentQ.imageUrl} alt="Question" style={styles.qImage} />
                        )}

                        {/* Options or Numerical Input */}
                        {currentQ.type === 'NUMERICAL' || currentQ.type === 'numerical' || !currentQ.options || currentQ.options.length === 0 ? (
                            <div style={styles.numericalContainer}>
                                <div style={styles.numericalRow}>
                                    <div style={styles.inputWrapper}>
                                        <label style={styles.inputLabel}>Enter your answer (Numerical Value):</label>
                                        <input
                                            type="text"
                                            value={currentA.selectedOption || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (/^-?\d*\.?\d*$/.test(val)) {
                                                    handleOptionSelect(val);
                                                }
                                            }}
                                            placeholder="Type your answer here..."
                                            style={styles.numericalInput}
                                            autoFocus
                                        />
                                    </div>
                                    
                                    {/* Virtual Keypad */}
                                    <div style={styles.keypadWrapper}>
                                        <div style={styles.keypadTitle}>Virtual Keypad</div>
                                        <div style={styles.keypadGrid}>
                                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '.'].map((key) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentVal = (currentA.selectedOption || '').toString();
                                                        let newVal = currentVal;
                                                        if (key === '-') {
                                                            if (currentVal.startsWith('-')) {
                                                                newVal = currentVal.substring(1);
                                                            } else {
                                                                newVal = '-' + currentVal;
                                                            }
                                                        } else if (key === '.') {
                                                            if (!currentVal.includes('.')) {
                                                                newVal = currentVal + '.';
                                                            }
                                                        } else {
                                                            if (currentVal === '0') {
                                                                newVal = key;
                                                            } else {
                                                                newVal = currentVal + key;
                                                            }
                                                        }
                                                        if (/^-?\d*\.?\d*$/.test(newVal)) {
                                                            handleOptionSelect(newVal);
                                                        }
                                                    }}
                                                    style={styles.keypadBtn}
                                                >
                                                    {key}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const currentVal = (currentA.selectedOption || '').toString();
                                                    if (currentVal.length > 0) {
                                                        handleOptionSelect(currentVal.substring(0, currentVal.length - 1));
                                                    }
                                                }}
                                                style={{ ...styles.keypadBtn, gridColumn: 'span 2', background: '#f3f4f6', color: '#374151' }}
                                            >
                                                ⌫ Backspace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOptionSelect('')}
                                                style={{ ...styles.keypadBtn, background: '#fef2f2', color: '#b91c1c' }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : currentQ.type === 'TRUE_FALSE' ? (
                            <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                                {['True', 'False'].map(opt => {
                                    const selected = currentA.selectedOption === opt;
                                    return (
                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', color: '#1e3a8a' }}>
                                            <input
                                                type="radio"
                                                name="tf_option"
                                                checked={selected}
                                                onChange={() => handleOptionSelect(opt)}
                                                style={{ width: '1.25rem', height: '1.25rem' }}
                                            />
                                            {opt}
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <div>
                                <div style={styles.optionsTextContainer}>
                                    {currentQ.options?.map((opt, i) => {
                                        const label = String.fromCharCode(65 + i); // Use standard A, B, C, D
                                        return (
                                            <div key={i} style={styles.optionTextLine}>
                                                <span style={styles.optionTextLabel}>{label}.</span>
                                                <MathRenderer inline={true} style={styles.optionTextContent} text={opt} />
                                            </div>
                                        );
                                    })}
                                </div>
                                <hr style={styles.divider} />
                                <div style={styles.radioContainer}>
                                    {currentQ.options?.map((opt, i) => {
                                        const label = String.fromCharCode(65 + i);
                                        const selected = currentA.selectedOption === label || currentA.selectedOption === opt;
                                        return (
                                            <label key={`radio-${i}`} style={styles.radioLabel}>
                                                <input 
                                                    type="radio" 
                                                    name="jee_option" 
                                                    checked={selected} 
                                                    onChange={() => handleOptionSelect(label)} 
                                                    style={styles.radioInput}
                                                />
                                                {label})
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons - placed below the options */}
                        <div style={styles.actionBarContainer}>
                            <hr style={styles.dividerBlue} />
                            <div style={styles.actionBarRow1}>
                                <button style={styles.btnSaveNextJEE} onClick={handleSaveNext}>SAVE & NEXT</button>
                                <button style={styles.btnClearJEE} onClick={handleClear}>CLEAR</button>
                                <button style={styles.btnSaveMarkReviewJEE} onClick={handleSaveAndMarkForReview}>SAVE & MARK FOR REVIEW</button>
                                <button style={styles.btnMarkReviewJEE} onClick={handleMarkForReview}>MARK FOR REVIEW & NEXT</button>
                            </div>
                            <div style={styles.actionBarRow2}>
                                <div style={styles.navBtns}>
                                    <button style={styles.btnNavJEE} onClick={() => goTo(current - 1)} disabled={current === 0}>&lt;&lt; BACK</button>
                                    <button style={styles.btnNavJEE} onClick={() => goTo(current + 1)} disabled={current === exam.questions?.length - 1}>NEXT &gt;&gt;</button>
                                </div>
                                <button style={styles.btnSubmitJEE} onClick={() => setShowSubmitConfirm(true)}>SUBMIT</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right: Question Palette ── */}
                <div style={styles.palettePanel}>
                    {/* Candidate Info */}
                    <div style={styles.candidateBlock}>
                        <div style={styles.candidateAvatar}>👤</div>
                        <div>
                            <div style={styles.candidateNameRight}>{studentInfo.studentName || 'Student'}</div>
                            <div style={styles.candidateRoll}>{studentInfo.rollNumber || ''}</div>
                        </div>
                    </div>

                    {/* Status Counts */}
                    <div style={styles.statusRowJEE}>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusSquare, background: '#f5f5f5', border: '1px solid #ccc', color: '#000' }}>{counts[STATE.NOT_VISITED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Not Visited</span>
                        </div>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusPolyRed }}>{counts[STATE.NOT_ANSWERED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Not Answered</span>
                        </div>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusPolyGreen }}>{counts[STATE.ANSWERED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Answered</span>
                        </div>
                        <div style={styles.statusItemJEE}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusCirclePurple }}>{counts[STATE.MARKED] || 0}</span>
                            </div>
                            <span style={styles.statusLabelJEE}>Marked for Review</span>
                        </div>
                        <div style={{...styles.statusItemJEE, gridColumn: 'span 2', marginTop: 5}}>
                            <div style={styles.paletteShapeWrap}>
                                <span style={{ ...styles.statusCirclePurple, position: 'relative' }}>
                                    {(counts[STATE.ANSWERED_MARKED] || 0)}
                                    <span style={styles.statusDotGreenSmall} />
                                </span>
                            </div>
                            <span style={styles.statusLabelJEE}>Answered & Marked for Review<br/>(will be considered for evaluation)</span>
                        </div>
                    </div>

                    {/* Palette Title */}
                    <div style={styles.paletteTitle}>Question Palette</div>

                    {/* Palette Grid */}
                    <div style={styles.paletteGrid}>
                        {answers.map((a, i) => {
                            const state = getState(a);
                            const isCurrent = i === current;
                            
                            let shapeStyle = {};
                            let textStyle = { color: '#fff' };
                            
                            if (state === STATE.NOT_VISITED) {
                                shapeStyle = { ...styles.statusSquare, background: '#f5f5f5', border: '1px solid #ccc', color: '#000' };
                                textStyle = { color: '#000' };
                            } else if (state === STATE.NOT_ANSWERED) {
                                shapeStyle = styles.statusPolyRed;
                            } else if (state === STATE.ANSWERED) {
                                shapeStyle = styles.statusPolyGreen;
                            } else if (state === STATE.MARKED || state === STATE.ANSWERED_MARKED) {
                                shapeStyle = styles.statusCirclePurple;
                            }

                            return (
                                <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div 
                                        style={{ ...shapeStyle, cursor: 'pointer', opacity: isCurrent ? 0.7 : 1 }}
                                        onClick={() => goTo(i)}
                                    >
                                        <span style={textStyle}>{String(i + 1).padStart(2, '0')}</span>
                                    </div>
                                    {state === STATE.ANSWERED_MARKED && (
                                        <span style={styles.statusDotGreenSmall} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Submit Button */}
                    <button style={styles.submitBtn} onClick={() => setShowSubmitConfirm(true)}>
                        🏁 Submit Exam
                    </button>
                </div>
            </div>

            {/* Submit Confirmation Modal */}
            {showSubmitConfirm && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3 style={styles.modalTitle}>⚠️ Submit Examination?</h3>
                        <div style={styles.modalStats}>
                            <div style={styles.modalStat}><span style={{ color: '#10b981', fontWeight: 700 }}>{counts[STATE.ANSWERED] || 0}</span> Answered</div>
                            <div style={styles.modalStat}><span style={{ color: '#ef4444', fontWeight: 700 }}>{counts[STATE.NOT_ANSWERED] || 0}</span> Not Answered</div>
                            <div style={styles.modalStat}><span style={{ color: '#6b7280', fontWeight: 700 }}>{counts[STATE.NOT_VISITED] || 0}</span> Not Visited</div>
                            <div style={styles.modalStat}><span style={{ color: '#8b5cf6', fontWeight: 700 }}>{(counts[STATE.MARKED] || 0) + (counts[STATE.ANSWERED_MARKED] || 0)}</span> Marked</div>
                        </div>
                        <p style={styles.modalNote}>Once submitted, you cannot return to the exam. Are you sure?</p>
                        <div style={styles.modalBtns}>
                            <button style={styles.cancelBtn} onClick={() => setShowSubmitConfirm(false)}>◀ Return to Exam</button>
                            <button style={styles.confirmBtn} onClick={() => handleSubmit(false)} disabled={submitting}>
                                {submitting ? 'Submitting...' : '✅ Confirm Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    page: { minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' },
    topBar: { background: '#1e3a5f', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
    topLeft: { display: 'flex', alignItems: 'center', gap: 12 },
    examTitleTop: { fontSize: 14, fontWeight: 600 },
    examTypeTag: { background: '#f59e0b', color: '#000', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 },
    timerBox: { textAlign: 'center' },
    timerLabel: { display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: 1 },
    timer: { fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
    topRight: { fontSize: 13, color: '#cbd5e1' },
    candidateName: { fontWeight: 600 },
    body: { display: 'flex', flex: 1, gap: 0 },
    // Question Panel
    questionPanel: { flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', margin: 16, borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' },
    qHeader: { background: '#1e3a5f', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', fontSize: 13 },
    qNum: { fontWeight: 700 },
    qSubject: { color: '#94a3b8', fontSize: 12 },
    qBody: { flex: 1, padding: '24px 28px', overflowY: 'auto' },
    qText: { fontSize: 15, color: '#1e293b', lineHeight: 1.7, marginBottom: 20, fontWeight: 500 },
    qImage: { maxWidth: '100%', borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' },
    optionsTextContainer: { display: 'flex', flexDirection: 'column', gap: '20px', margin: '20px 0' },
    optionTextLine: { display: 'flex', gap: '10px', fontSize: '15px' },
    optionTextLabel: { fontWeight: 'bold' },
    optionTextContent: { flex: 1 },
    divider: { border: '0', borderTop: '1px solid #ccc', margin: '20px 0' },
    dividerBlue: { border: '0', borderTop: '1px solid #4f46e5', margin: '10px 0', opacity: 0.3 },
    radioContainer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' },
    radioLabel: { display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '16px', color: '#555' },
    radioInput: { marginRight: '8px', width: '16px', height: '16px', accentColor: '#4f46e5' },
    
    actionBarContainer: { display: 'flex', flexDirection: 'column' },
    actionBarRow1: { display: 'flex', gap: '5px', padding: '10px 0', flexWrap: 'wrap', borderBottom: '1px solid #eee' },
    actionBarRow2: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', background: '#f9f9f9' },
    navBtns: { display: 'flex', gap: '5px' },
    
    btnSaveNextJEE: { background: '#5cb85c', color: '#fff', border: 'none', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnClearJEE: { background: '#fff', color: '#333', border: '1px solid #ccc', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnSaveMarkReviewJEE: { background: '#f0ad4e', color: '#fff', border: 'none', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnMarkReviewJEE: { background: '#337ab7', color: '#fff', border: 'none', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnNavJEE: { background: '#fff', color: '#666', border: '1px solid #ccc', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    btnSubmitJEE: { background: '#5cb85c', color: '#fff', border: 'none', padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    
    // Palette Panel
    palettePanel: { width: 320, flexShrink: 0, background: '#fff', borderLeft: '1px solid #ccc', display: 'flex', flexDirection: 'column' },
    candidateBlock: { display: 'flex', gap: 10, alignItems: 'center', background: '#f5f5f5', borderBottom: '1px solid #ccc', padding: '10px', color: '#333' },
    candidateAvatar: { fontSize: 32 },
    candidateNameRight: { fontSize: 13, fontWeight: 'bold' },
    candidateRoll: { fontSize: 11, color: '#666' },
    
    statusRowJEE: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', borderBottom: '1px dashed #ccc', border: '1px solid #ccc', margin: '10px', borderRadius: '4px' },
    statusItemJEE: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' },
    paletteShapeWrap: { width: '30px', display: 'flex', justifyContent: 'center' },
    statusLabelJEE: { color: '#333', lineHeight: '1.2' },
    
    statusSquare: { width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', borderRadius: '3px', fontWeight: 'bold' },
    statusPolyRed: { width: '30px', height: '30px', background: '#eb3b3b', border: '1px solid #c92a2a', clipPath: 'polygon(0 15%, 100% 0, 100% 85%, 0% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', borderRadius: '2px', color: '#fff', fontWeight: 'bold' },
    statusPolyGreen: { width: '30px', height: '30px', background: '#22c55e', border: '1px solid #16a34a', clipPath: 'polygon(0 0, 100% 15%, 100% 100%, 0 85%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', borderRadius: '2px', color: '#fff', fontWeight: 'bold' },
    statusCirclePurple: { width: '30px', height: '30px', background: '#6366f1', border: '1px solid #4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', fontWeight: 'bold' },
    statusDotGreenSmall: { width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', position: 'absolute', bottom: '0px', right: '0px', border: '1px solid #fff' },
    
    paletteTitle: { fontSize: 13, fontWeight: 700, color: '#1e293b', padding: '10px', background: '#e0e7ff', borderTop: '1px solid #c7d2fe', borderBottom: '1px solid #c7d2fe' },
    paletteGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', padding: '15px 10px', overflowY: 'auto' },
    
    submitBtn: { display: 'none' }, // Submit button is now in the actionBarRow2
    // Modal
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { background: '#fff', borderRadius: 16, padding: '32px 36px', width: '90%', maxWidth: 460 },
    modalTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 20px', textAlign: 'center' },
    modalStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 },
    modalStat: { background: '#f8fafc', borderRadius: 8, padding: '12px', textAlign: 'center', fontSize: 14 },
    modalNote: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 24 },
    modalBtns: { display: 'flex', gap: 12 },
    cancelBtn: { flex: 1, background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    confirmBtn: { flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#6b7280', fontSize: 16 },
    numericalContainer: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '24px',
        margin: '12px 0',
        width: '100%'
    },
    numericalRow: {
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
        flexWrap: 'wrap'
    },
    inputWrapper: {
        flex: 1,
        minWidth: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: 600,
        color: '#475569'
    },
    numericalInput: {
        padding: '14px 18px',
        fontSize: 20,
        fontWeight: 700,
        fontFamily: 'Courier New, monospace',
        border: '2.5px solid #cbd5e1',
        borderRadius: 10,
        outline: 'none',
        transition: 'all 0.15s',
        color: '#1e293b',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
        textAlign: 'center',
        background: '#fff'
    },
    keypadWrapper: {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '16px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
        width: '100%',
        maxWidth: 240
    },
    keypadTitle: {
        fontSize: 12,
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
        textAlign: 'center'
    },
    keypadGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8
    },
    keypadBtn: {
        padding: '10px 0',
        fontSize: 16,
        fontWeight: 700,
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#fff',
        cursor: 'pointer',
        transition: 'all 0.1s',
        color: '#1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }
};
