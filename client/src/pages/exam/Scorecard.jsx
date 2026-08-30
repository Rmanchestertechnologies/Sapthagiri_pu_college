import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';

export default function Scorecard() {
    const { examId, sessionId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('summary');
    const [leaderboard, setLeaderboard] = useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            setLoadingLeaderboard(true);
            api.get(`/api/exams/${examId}/leaderboard`)
                .then(r => { setLeaderboard(r.data); setLoadingLeaderboard(false); })
                .catch(() => setLoadingLeaderboard(false));
        }
    }, [activeTab, examId]);

    const formatSeconds = (totalSecs) => {
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };



    useEffect(() => {
        api.get(`/api/exams/${examId}/scorecard/${sessionId}`)
            .then(r => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [examId, sessionId]);

    const downloadPDF = () => {
        const token = localStorage.getItem('token');
        const downloadUrl = `${api.defaults.baseURL || ''}/api/exams/${examId}/pdf-report/${sessionId}?token=${token}`;
        window.open(downloadUrl, '_blank');
    };

    if (loading) return <div style={styles.center}>Loading scorecard...</div>;
    if (!data) return <div style={styles.center}>Scorecard not found.</div>;

    const percentage = data.totalQuestions > 0
        ? Math.round((data.score / (data.totalQuestions * 4)) * 100)
        : 0;

    const getGrade = (pct) => {
        if (pct >= 80) return { grade: 'A+', color: '#10b981', label: 'Excellent' };
        if (pct >= 60) return { grade: 'A', color: '#3b82f6', label: 'Good' };
        if (pct >= 40) return { grade: 'B', color: '#f59e0b', label: 'Average' };
        return { grade: 'C', color: '#ef4444', label: 'Needs Improvement' };
    };
    const grade = getGrade(percentage);

    return (
        <div style={styles.page}>
            {/* Top Bar */}
            <div style={styles.topBar}>
                <span style={styles.topTitle}>📋 Examination Scorecard</span>
                <div style={styles.topRight}>
                    {data.isLabSession && (
                        <span style={styles.labBadge}>🏫 Lab Session — Answer Key Hidden</span>
                    )}
                    <button style={{ ...styles.homeBtn, backgroundColor: '#10b981', color: '#fff', border: 'none' }} onClick={downloadPDF}>Download PDF Result</button>
                    <button style={styles.homeBtn} onClick={() => {
                        localStorage.removeItem('student_info');
                        navigate('/lab-login');
                    }}>Back</button>
                </div>
            </div>

            <div style={styles.body}>
                {/* Score Hero Card */}
                <div style={styles.heroCard}>
                    <div style={styles.heroLeft}>
                        <div style={styles.candidateInfo}>
                            <div style={styles.candidateName}>{data.studentName}</div>
                            <div style={styles.candidateMeta}>{data.rollNumber && `Roll No: ${data.rollNumber}`} {data.studentEmail && `| ${data.studentEmail}`}</div>
                            <div style={styles.examLabel}>{data.examTitle} — {data.examType}</div>
                        </div>
                    </div>
                    <div style={styles.scoreCircleWrap}>
                        <div style={{ ...styles.scoreCircle, borderColor: grade.color }}>
                            <div style={{ ...styles.scoreNum, color: grade.color }}>{data.score}</div>
                            <div style={styles.scoreMax}>/ {data.totalQuestions * 4}</div>
                        </div>
                        <div style={{ ...styles.gradeLabel, color: grade.color }}>{grade.grade} — {grade.label}</div>
                        <div style={styles.percentage}>{percentage}%</div>
                    </div>
                </div>

                {/* Stats Row */}
                <div style={styles.statsRow}>
                    {[
                        { label: 'Total Questions', value: data.totalQuestions, color: '#6b7280' },
                        { label: 'Attempted', value: data.attempted, color: '#3b82f6' },
                        { label: 'Correct', value: data.correct, color: '#10b981' },
                        { label: 'Incorrect', value: data.incorrect, color: '#ef4444' },
                        { label: 'Unattempted', value: data.unattempted, color: '#9ca3af' }
                    ].map(stat => (
                        <div key={stat.label} style={styles.statCard}>
                            <div style={{ ...styles.statNum, color: stat.color }}>{stat.value}</div>
                            <div style={styles.statLabel}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    {['summary', 'weakareas', 'timeanalysis', 'review', 'leaderboard'].map(t => (
                        <button key={t} style={{ ...styles.tab, ...(activeTab === t ? styles.tabActive : {}) }}
                            onClick={() => setActiveTab(t)}>
                            {t === 'summary' ? '📊 Summary' : t === 'weakareas' ? '⚠️ Weak Areas' : t === 'timeanalysis' ? '⏱️ Time Analysis' : t === 'review' ? '📝 Question Review' : '🏆 Leaderboard'}
                        </button>
                    ))}
                </div>

                {/* Summary Tab */}
                {activeTab === 'summary' && (
                    <div style={styles.tabContent}>
                        <div style={styles.summaryGrid}>
                            <div style={styles.summarySection}>
                                <h3 style={styles.sectionTitle}>Score Breakdown</h3>
                                <div style={styles.breakdownBar}>
                                    <div style={{ ...styles.barSegment, background: '#10b981', width: `${(data.correct / data.totalQuestions) * 100}%` }} title="Correct" />
                                    <div style={{ ...styles.barSegment, background: '#ef4444', width: `${(data.incorrect / data.totalQuestions) * 100}%` }} title="Incorrect" />
                                    <div style={{ ...styles.barSegment, background: '#e5e7eb', width: `${(data.unattempted / data.totalQuestions) * 100}%` }} title="Unattempted" />
                                </div>
                                <div style={styles.barLegend}>
                                    <span style={{ color: '#10b981' }}>■ Correct ({data.correct})</span>
                                    <span style={{ color: '#ef4444' }}>■ Wrong ({data.incorrect})</span>
                                    <span style={{ color: '#9ca3af' }}>■ Skipped ({data.unattempted})</span>
                                </div>
                                <div style={styles.markCalc}>
                                    <div>Marks from Correct: <strong>+{data.correct * 4}</strong></div>
                                    <div>Marks deducted: <strong>−{data.incorrect}</strong></div>
                                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8, fontWeight: 700 }}>
                                        Net Score: <span style={{ color: grade.color }}>{data.score}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Weak Areas Tab */}
                {activeTab === 'weakareas' && (
                    <div style={styles.tabContent}>
                        {data.weakAreas?.length > 0 ? (
                            <>
                                <p style={styles.weakNote}>These chapters had the most incorrect answers. Focus your revision here:</p>
                                <div style={styles.weakList}>
                                    {data.weakAreas.map((w, i) => (
                                        <div key={i} style={styles.weakCard}>
                                            <div style={styles.weakRank}>#{i + 1}</div>
                                            <div style={styles.weakInfo}>
                                                <div style={styles.weakChapter}>{w.chapter}</div>
                                                <div style={styles.weakSubject}>{w.subject}</div>
                                            </div>
                                            <div style={styles.weakCount}>{w.incorrect} wrong</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={styles.noWeak}>🎉 No weak areas detected! Excellent performance.</div>
                        )}
                    </div>
                )}

                {/* Review Tab */}
                {activeTab === 'review' && (
                    <div style={styles.tabContent}>
                        {data.answerKeyHidden && (
                            <div style={styles.hiddenNotice}>
                                🔒 You are on a college lab system. Correct answers are not shown per institutional policy.
                            </div>
                        )}
                        <div style={styles.reviewList}>
                            {data.breakdown?.map((q, i) => {
                                const attempted = q.selectedOption !== null && q.selectedOption !== '';
                                let isCorrect = false;
                                let isWrong = false;
                                if (attempted && !data.answerKeyHidden) {
                                    // 1. Numerical match with tolerance
                                    const tolerance = q.numericalTolerance || 0;
                                    const parsedSelected = parseFloat(q.selectedOption);
                                    const parsedCorrect = parseFloat(q.correctAnswer);
                                    if (!isNaN(parsedSelected) && !isNaN(parsedCorrect)) {
                                        if (Math.abs(parsedSelected - parsedCorrect) <= (tolerance + 1e-9)) {
                                            isCorrect = true;
                                        }
                                    }

                                    // 2. Exact match
                                    if (!isCorrect && q.selectedOption.toString().trim().toLowerCase() === (q.correctAnswer || '').toString().trim().toLowerCase()) {
                                        isCorrect = true;
                                    }

                                    // 3. Option index / letter match fallback
                                    if (!isCorrect && q.options && q.options.length > 0) {
                                        const letters = ['A', 'B', 'C', 'D'];
                                        const selectedIdx = letters.indexOf(q.selectedOption.toString().toUpperCase());
                                        if (selectedIdx !== -1 && q.options[selectedIdx]) {
                                            if (q.options[selectedIdx].toString().trim().toLowerCase() === (q.correctAnswer || '').toString().trim().toLowerCase()) {
                                                isCorrect = true;
                                            }
                                        }
                                        const correctIdx = letters.indexOf((q.correctAnswer || '').toString().toUpperCase());
                                        if (correctIdx !== -1 && q.options[correctIdx]) {
                                            if (q.selectedOption.toString().trim().toLowerCase() === q.options[correctIdx].toString().trim().toLowerCase()) {
                                                isCorrect = true;
                                            }
                                        }
                                    }
                                    isWrong = !isCorrect;
                                }
                                return (
                                    <div key={q._id} style={{ ...styles.reviewCard, borderLeft: `4px solid ${!attempted ? '#9ca3af' : (data.answerKeyHidden ? '#6b7280' : isCorrect ? '#10b981' : '#ef4444')}` }}>
                                        <div style={styles.reviewQHeader}>
                                            <span style={styles.reviewQNum}>Q{i + 1}</span>
                                            <span style={styles.reviewSubject}>{q.subject} | {q.chapter}</span>
                                            <span style={styles.timeBadge}>⏱️ {formatSeconds(q.timeTaken || 0)}</span>
                                            {!attempted && <span style={styles.badge('#9ca3af')}>Skipped</span>}
                                            {attempted && !data.answerKeyHidden && isCorrect && <span style={styles.badgeGreen}>✅ Correct</span>}
                                            {attempted && !data.answerKeyHidden && isWrong && <span style={styles.badgeRed}>❌ Wrong</span>}
                                            {attempted && data.answerKeyHidden && <span style={styles.badgeGrey}>Attempted</span>}
                                        </div>
                                        <MathRenderer style={styles.reviewQText} text={q.questionText} />
                                        
                                        {q.type === 'numerical' || !q.options || q.options.length === 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
                                                <div style={{
                                                    ...styles.reviewOption,
                                                    background: attempted ? (isCorrect ? '#dcfce7' : '#fee2e2') : '#f9fafb',
                                                    border: attempted ? (isCorrect ? '1.5px solid #10b981' : '1.5px solid #ef4444') : '1.5px solid #e5e7eb'
                                                }}>
                                                    <span style={styles.reviewOptLabel}>Your Answer:</span> <MathRenderer inline={true} text={attempted ? q.selectedOption : 'Skipped'} />
                                                </div>
                                                {!data.answerKeyHidden && (
                                                    <div style={{
                                                        ...styles.reviewOption,
                                                        background: '#dcfce7',
                                                        border: '1.5px solid #10b981'
                                                    }}>
                                                        <span style={styles.reviewOptLabel}>Correct Answer:</span> <MathRenderer inline={true} text={q.correctAnswer} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={styles.reviewOptions}>
                                                {q.options?.map((opt, oi) => {
                                                    const label = (oi + 1).toString();
                                                    const isSelected = q.selectedOption === opt;
                                                    const isCorrectOpt = !data.answerKeyHidden && q.correctAnswer === opt;
                                                    return (
                                                        <div key={oi} style={{
                                                            ...styles.reviewOption,
                                                            background: isCorrectOpt ? '#dcfce7' : isSelected && isWrong ? '#fee2e2' : '#f9fafb',
                                                            border: isCorrectOpt ? '1.5px solid #10b981' : isSelected ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb'
                                                        }}>
                                                            <span style={styles.reviewOptLabel}>{label}.</span> <MathRenderer inline={true} text={opt} />
                                                            {isSelected && <span style={{ marginLeft: 8, fontSize: 12 }}>← Your Answer</span>}
                                                            {isCorrectOpt && <span style={{ marginLeft: 8, fontSize: 12, color: '#10b981' }}>✓ Correct</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {q.markedForReview && <div style={styles.markedTag}>🔖 Marked for Review</div>}

                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Time Analysis Tab */}
                {activeTab === 'timeanalysis' && (
                    <div style={styles.tabContent}>
                        <h3 style={styles.sectionTitle}>⏱️ Time Spent Analysis</h3>
                        <div style={styles.timeSummaryRow}>
                            <div style={styles.timeSummaryCard}>
                                <div style={styles.timeSummaryNum}>{formatSeconds(data.breakdown?.reduce((acc, q) => acc + (q.timeTaken || 0), 0) || 0)}</div>
                                <div style={styles.timeSummaryLabel}>Total Time Taken</div>
                            </div>
                            <div style={styles.timeSummaryCard}>
                                <div style={styles.timeSummaryNum}>
                                    {data.totalQuestions > 0 ? formatSeconds(Math.round((data.breakdown?.reduce((acc, q) => acc + (q.timeTaken || 0), 0) || 0) / data.totalQuestions)) : '0s'}
                                </div>
                                <div style={styles.timeSummaryLabel}>Average Time Per Question</div>
                            </div>
                        </div>

                        <h4 style={{ ...styles.sectionTitle, marginTop: 24 }}>Questions Taking the Most Time</h4>
                        {(() => {
                            const sorted = data.breakdown ? [...data.breakdown]
                                .map((q, idx) => ({ ...q, qNumber: idx + 1 }))
                                .filter(q => (q.timeTaken || 0) > 0)
                                .sort((a, b) => b.timeTaken - a.timeTaken) : [];
                            return sorted.length > 0 ? (
                                <div style={styles.timeList}>
                                    {sorted.slice(0, 10).map((q, i) => (
                                        <div key={i} style={styles.timeRow}>
                                            <span style={styles.timeRowIndex}>#{i + 1}</span>
                                            <span style={styles.timeRowQNum}>Question {q.qNumber} ({q.subject})</span>
                                            <span style={styles.timeRowTopic}>{q.chapter}</span>
                                            <span style={styles.timeRowVal}>{formatSeconds(q.timeTaken)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: '#6b7280' }}>No time records found.</p>
                            );
                        })()}

                        <h4 style={{ ...styles.sectionTitle, marginTop: 28 }}>Time Grid (All Questions)</h4>
                        <div style={styles.timeGrid}>
                            {data.breakdown?.map((q, idx) => (
                                <div key={idx} style={styles.timeGridCell}>
                                    <div style={styles.timeGridQ}>Q{idx + 1}</div>
                                    <div style={styles.timeGridVal}>{formatSeconds(q.timeTaken || 0)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Leaderboard Tab */}
                {activeTab === 'leaderboard' && (
                    <div style={styles.tabContent}>
                        <h3 style={styles.sectionTitle}>🏆 Leaderboard / Results Sheet</h3>
                        {loadingLeaderboard ? (
                            <div style={{ textAlign: 'center', padding: 20 }}>Loading results...</div>
                        ) : leaderboard.length > 0 ? (
                            <div style={styles.leaderboardWrap}>
                                <table style={styles.leaderboardTable}>
                                    <thead>
                                        <tr style={styles.leaderboardThead}>
                                            <th style={styles.leaderboardTh}>Rank</th>
                                            <th style={styles.leaderboardTh}>Name</th>
                                            <th style={styles.leaderboardTh}>Roll Number</th>
                                            <th style={styles.leaderboardTh}>Score</th>
                                            <th style={styles.leaderboardTh}>Accuracy</th>
                                            <th style={styles.leaderboardTh}>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((student, rankIdx) => {
                                            const isCurrentUser = student.rollNumber === data.rollNumber;
                                            const totalAttempted = student.correct + student.incorrect;
                                            const accuracy = totalAttempted > 0 
                                                ? Math.round((student.correct / totalAttempted) * 100)
                                                : 0;

                                            return (
                                                <tr key={rankIdx} style={{ 
                                                    background: isCurrentUser ? '#e2e8f0' : rankIdx % 2 === 0 ? '#fff' : '#f9fafb',
                                                    fontWeight: isCurrentUser ? 'bold' : 'normal'
                                                }}>
                                                    <td style={styles.leaderboardTd}>
                                                        {rankIdx === 0 ? '🥇' : rankIdx === 1 ? '🥈' : rankIdx === 2 ? '🥉' : rankIdx + 1}
                                                    </td>
                                                    <td style={styles.leaderboardTd}>
                                                        {student.studentName} {isCurrentUser && <span style={{ color: '#4f46e5', fontSize: 11 }}>(You)</span>}
                                                    </td>
                                                    <td style={styles.leaderboardTd}>{student.rollNumber || '—'}</td>
                                                    <td style={{ ...styles.leaderboardTd, color: '#4f46e5', fontWeight: 'bold' }}>{student.score}</td>
                                                    <td style={styles.leaderboardTd}>{accuracy}% accuracy</td>
                                                    <td style={{ ...styles.leaderboardTd, fontSize: 12, color: '#6b7280' }}>
                                                        ✅ {student.correct} | ❌ {student.incorrect} | ⏳ {student.unattempted} skipped
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ color: '#6b7280' }}>No submissions found for this exam yet.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    badge: (color) => ({
        background: `${color}1a`,
        color: color,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 700
    }),
    page: { minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Inter, sans-serif' },
    topBar: { background: '#1e3a5f', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    topTitle: { fontSize: 16, fontWeight: 700 },
    topRight: { display: 'flex', gap: 12, alignItems: 'center' },
    labBadge: { background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600 },
    homeBtn: { background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 },
    body: { maxWidth: 1000, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 },
    heroCard: { background: 'linear-gradient(135deg, #1e3a5f, #1e1b4b)', color: '#fff', borderRadius: 16, padding: '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    heroLeft: {},
    candidateName: { fontSize: 22, fontWeight: 800 },
    candidateMeta: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
    examLabel: { color: '#f59e0b', fontSize: 14, fontWeight: 600, marginTop: 8 },
    candidateInfo: {},
    scoreCircleWrap: { textAlign: 'center' },
    scoreCircle: { width: 100, height: 100, borderRadius: '50%', border: '5px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', background: 'rgba(255,255,255,0.1)' },
    scoreNum: { fontSize: 28, fontWeight: 900, lineHeight: 1 },
    scoreMax: { fontSize: 12, color: '#94a3b8' },
    gradeLabel: { fontSize: 14, fontWeight: 700 },
    percentage: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 },
    statCard: { background: '#fff', borderRadius: 12, padding: '16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    statNum: { fontSize: 28, fontWeight: 800 },
    statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
    tabs: { display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb' },
    tab: { padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#6b7280', borderBottom: '2px solid transparent', marginBottom: -2 },
    tabActive: { color: '#4f46e5', borderBottom: '2px solid #4f46e5' },
    tabContent: { background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #e5e7eb' },
    summaryGrid: {},
    summarySection: {},
    sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' },
    breakdownBar: { display: 'flex', height: 24, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
    barSegment: { transition: 'width 0.5s' },
    barLegend: { display: 'flex', gap: 20, fontSize: 14, marginBottom: 16 },
    markCalc: { background: '#f8fafc', borderRadius: 10, padding: '16px', fontSize: 15, lineHeight: 2 },
    weakNote: { color: '#6b7280', marginBottom: 16 },
    weakList: { display: 'flex', flexDirection: 'column', gap: 12 },
    weakCard: { display: 'flex', alignItems: 'center', gap: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px' },
    weakRank: { width: 32, height: 32, background: '#ef4444', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
    weakInfo: { flex: 1 },
    weakChapter: { fontWeight: 700, color: '#1e293b' },
    weakSubject: { fontSize: 13, color: '#6b7280' },
    weakCount: { fontWeight: 700, color: '#ef4444', fontSize: 15 },
    noWeak: { textAlign: 'center', color: '#10b981', fontSize: 18, padding: 40 },
    hiddenNotice: { background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14 },
    reviewList: { display: 'flex', flexDirection: 'column', gap: 16 },
    reviewCard: { border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', background: '#fafafa' },
    reviewQHeader: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
    reviewQNum: { fontWeight: 700, color: '#1e293b' },
    reviewSubject: { fontSize: 12, color: '#6b7280' },
    badgeGreen: { background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 },
    badgeRed: { background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 },
    badgeGrey: { background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 },
    reviewQText: { fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 12 },
    reviewOptions: { display: 'flex', flexDirection: 'column', gap: 8 },
    reviewOption: { borderRadius: 8, padding: '9px 14px', fontSize: 14, display: 'flex', alignItems: 'center' },
    reviewOptLabel: { fontWeight: 700, marginRight: 8 },
    markedTag: { fontSize: 12, color: '#8b5cf6', marginTop: 10 },
    center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#6b7280' },
    solutionBtn: {
        background: '#e0e7ff',
        color: '#4338ca',
        border: 'none',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        marginTop: 10,
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
    },
    solutionBox: {
        background: '#f5f7ff',
        border: '1px solid #c7d2fe',
        borderRadius: 10,
        padding: '14px 16px',
        marginTop: 10,
        animation: 'fadeIn 0.3s ease-out'
    },
    solutionBoxTitle: {
        margin: '0 0 8px 0',
        fontSize: 13,
        fontWeight: 800,
        color: '#312e81',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    solutionContent: {
        fontSize: 13,
        color: '#1e1b4b',
        lineHeight: 1.6
    },
    timeBadge: {
        background: '#eff6ff',
        color: '#1d4ed8',
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 700
    },
    timeSummaryRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 20
    },
    timeSummaryCard: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '20px',
        textAlign: 'center'
    },
    timeSummaryNum: {
        fontSize: 28,
        fontWeight: 800,
        color: '#1d4ed8'
    },
    timeSummaryLabel: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4
    },
    timeList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: '#f8fafc',
        borderRadius: 12,
        padding: '16px',
        border: '1px solid #e2e8f0'
    },
    timeRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: 14
    },
    timeRowIndex: {
        fontWeight: 700,
        color: '#94a3b8',
        width: 32
    },
    timeRowQNum: {
        fontWeight: 600,
        color: '#1e293b',
        width: 180
    },
    timeRowTopic: {
        color: '#64748b',
        flex: 1
    },
    timeRowVal: {
        fontWeight: 700,
        color: '#1d4ed8'
    },
    timeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: 8,
        marginTop: 12
    },
    timeGridCell: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '8px',
        textAlign: 'center'
    },
    timeGridQ: {
        fontSize: 12,
        fontWeight: 700,
        color: '#64748b'
    },
    timeGridVal: {
        fontSize: 13,
        fontWeight: 600,
        color: '#1d4ed8',
        marginTop: 2
    },
    leaderboardWrap: {
        overflowX: 'auto',
        borderRadius: 12,
        border: '1px solid #e5e7eb'
    },
    leaderboardTable: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 14
    },
    leaderboardThead: {
        background: '#f8fafc'
    },
    leaderboardTh: {
        padding: '12px 14px',
        textAlign: 'left',
        fontWeight: 700,
        color: '#374151',
        borderBottom: '1px solid #e5e7eb'
    },
    leaderboardTd: {
        padding: '12px 14px',
        borderBottom: '1px solid #f1f5f9'
    }
};
