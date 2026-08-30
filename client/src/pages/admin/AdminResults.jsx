import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminResults() {
    const [searchParams] = useSearchParams();
    const examIdParam = searchParams.get('examId');
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState(examIdParam || '');
    const [results, setResults] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [bridgeKey, setBridgeKey] = useState('');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/api/exams').then(r => setExams(r.data)).catch(() => {});
        if (examIdParam) fetchResults(examIdParam);
    }, [examIdParam]);

    const fetchResults = async (eid) => {
        setLoading(true);
        try {
            const [res, analyticsRes] = await Promise.all([
                api.get(`/api/exams/${eid}/results`),
                api.get(`/api/exams/${eid}/analytics`).catch(() => ({ data: null }))
            ]);
            setResults(res.data);
            if (analyticsRes.data) setAnalytics(analyticsRes.data);
        } catch (e) { setMsg('Failed to load results'); }
        setLoading(false);
    };

    const handleExamSelect = (e) => {
        setSelectedExam(e.target.value);
        setResults([]);
        setAnalytics(null);
        setBridgeKey('');
        if (e.target.value) fetchResults(e.target.value);
    };

    const generateBridgeKey = async () => {
        if (!selectedExam) return setMsg('Select an exam first');
        try {
            const res = await api.post(`/api/exams/${selectedExam}/bridge-key`);
            setBridgeKey(res.data.key);
            setMsg(`✅ Bridge key generated! Expires: ${new Date(res.data.expiresAt).toLocaleDateString()}`);
        } catch (e) { setMsg('Failed to generate key'); }
    };

    const copyKey = () => {
        navigator.clipboard.writeText(bridgeKey);
        setMsg('✅ Bridge key copied to clipboard!');
    };

    const downloadIndividualPDF = (student) => {
        const token = localStorage.getItem('token');
        const downloadUrl = `${api.defaults.baseURL || ''}/api/exams/${selectedExam}/pdf-report/${student._id}?token=${token}`;
        window.open(downloadUrl, '_blank');
    };

    const downloadAllScorecardsZip = () => {
        if (!selectedExam) return;
        const token = localStorage.getItem('token');
        const downloadUrl = `${api.defaults.baseURL || ''}/api/exams/${selectedExam}/download-all-reports?token=${token}`;
        window.open(downloadUrl, '_blank');
    };

    const getScoreColor = (score) => {
        if (score >= 300) return '#10b981';
        if (score >= 150) return '#f59e0b';
        return '#ef4444';
    };

    const exportExcel = () => {
        if (!results || results.length === 0) return;
        const exam = exams.find(e => e._id === selectedExam);
        const data = results.map((r, i) => {
            const attempted = [];
            const unattempted = [];
            const correct = [];
            const wrong = [];
            if (exam && exam.questions) {
                exam.questions.forEach((q, idx) => {
                    const qNum = idx + 1;
                    const ans = r.answers?.find(a => a.questionId?.toString() === q._id?.toString());
                    if (ans && ans.selectedOption !== null && ans.selectedOption !== '') {
                        attempted.push(qNum);
                        let isCorrect = false;
                        const tolerance = q.numericalTolerance || 0;
                        const parsedSelected = parseFloat(ans.selectedOption);
                        const parsedAnswer = parseFloat(q.answer);
                        if (!isNaN(parsedSelected) && !isNaN(parsedAnswer)) {
                            if (Math.abs(parsedSelected - parsedAnswer) <= (tolerance + 1e-9)) {
                                isCorrect = true;
                            }
                        }
                        if (!isCorrect && ans.selectedOption.toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) {
                            isCorrect = true;
                        }
                        if (!isCorrect && q.options && q.options.length > 0) {
                            const letters = ['A', 'B', 'C', 'D'];
                            const selectedIdx = letters.indexOf(ans.selectedOption.toString().toUpperCase());
                            if (selectedIdx !== -1 && q.options[selectedIdx]) {
                                if (q.options[selectedIdx].toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) {
                                    isCorrect = true;
                                }
                            }
                            const correctIdx = letters.indexOf(q.answer.toString().toUpperCase());
                            if (correctIdx !== -1 && q.options[correctIdx]) {
                                if (ans.selectedOption.toString().trim().toLowerCase() === q.options[correctIdx].toString().trim().toLowerCase()) {
                                    isCorrect = true;
                                }
                            }
                        }
                        if (isCorrect) {
                            correct.push(qNum);
                        } else {
                            wrong.push(qNum);
                        }
                    } else {
                        unattempted.push(qNum);
                    }
                });
            }

            return {
                'S.No': i + 1,
                'Student Name': r.studentName,
                'Roll No': r.rollNumber || 'N/A',
                'Score': r.score,
                'Correct Count': r.correct,
                'Incorrect Count': r.incorrect,
                'Unattempted Count': r.unattempted,
                'Attempted Qs': attempted.join(', '),
                'Correct Qs': correct.join(', '),
                'Wrong Qs': wrong.join(', '),
                'Unattempted Qs': unattempted.join(', '),
                'Submitted At': new Date(r.createdAt).toLocaleString()
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
        const examName = exam?.title || 'Exam';
        XLSX.writeFile(workbook, `${examName}_Results.xlsx`);
    };

    const exportPDF = () => {
        if (!results || results.length === 0) return;
        const doc = new jsPDF('landscape');
        const exam = exams.find(e => e._id === selectedExam);
        const examName = exam?.title || 'Exam Results';
        
        doc.setFontSize(16);
        doc.text(examName, 14, 15);
        doc.setFontSize(10);
        doc.text(`Total Students: ${results.length}`, 14, 22);

        const tableColumn = ["#", "Student", "Roll No", "Score", "Attempted Qs", "Correct Qs", "Wrong Qs", "Unattempted Qs"];
        const tableRows = [];

        results.forEach((r, i) => {
            const attempted = [];
            const unattempted = [];
            const correct = [];
            const wrong = [];
            if (exam && exam.questions) {
                exam.questions.forEach((q, idx) => {
                    const qNum = idx + 1;
                    const ans = r.answers?.find(a => a.questionId?.toString() === q._id?.toString());
                    if (ans && ans.selectedOption !== null && ans.selectedOption !== '') {
                        attempted.push(qNum);
                        let isCorrect = false;
                        const tolerance = q.numericalTolerance || 0;
                        const parsedSelected = parseFloat(ans.selectedOption);
                        const parsedAnswer = parseFloat(q.answer);
                        if (!isNaN(parsedSelected) && !isNaN(parsedAnswer)) {
                            if (Math.abs(parsedSelected - parsedAnswer) <= (tolerance + 1e-9)) {
                                isCorrect = true;
                            }
                        }
                        if (!isCorrect && ans.selectedOption.toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) {
                            isCorrect = true;
                        }
                        if (!isCorrect && q.options && q.options.length > 0) {
                            const letters = ['A', 'B', 'C', 'D'];
                            const selectedIdx = letters.indexOf(ans.selectedOption.toString().toUpperCase());
                            if (selectedIdx !== -1 && q.options[selectedIdx]) {
                                if (q.options[selectedIdx].toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) {
                                    isCorrect = true;
                                }
                            }
                            const correctIdx = letters.indexOf(q.answer.toString().toUpperCase());
                            if (correctIdx !== -1 && q.options[correctIdx]) {
                                if (ans.selectedOption.toString().trim().toLowerCase() === q.options[correctIdx].toString().trim().toLowerCase()) {
                                    isCorrect = true;
                                }
                            }
                        }
                        if (isCorrect) {
                            correct.push(qNum);
                        } else {
                            wrong.push(qNum);
                        }
                    } else {
                        unattempted.push(qNum);
                    }
                });
            }

            const rowData = [
                i + 1,
                r.studentName,
                r.rollNumber || 'N/A',
                r.score,
                attempted.join(', '),
                correct.join(', '),
                wrong.join(', '),
                unattempted.join(', ')
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
                4: { cellWidth: 50 },
                5: { cellWidth: 50 },
                6: { cellWidth: 50 },
                7: { cellWidth: 50 }
            }
        });

        doc.save(`${examName}_Results.pdf`);
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>📊 Student Exam Results</h2>

            {msg && <div style={styles.msg}>{msg} <button onClick={() => setMsg('')} style={styles.closeMsg}>✕</button></div>}

            <div style={styles.toolbar}>
                <select style={styles.select} value={selectedExam} onChange={handleExamSelect}>
                    <option value="">— Select an Exam —</option>
                    {exams.map(e => <option key={e._id} value={e._id}>{e.title} ({e.examType})</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button style={styles.keyBtn} onClick={generateBridgeKey}>🔑 Generate Bridge Key</button>
                    {results && results.length > 0 && (
                        <>
                            <button style={{...styles.keyBtn, background: '#10b981'}} onClick={exportExcel}>📊 Excel</button>
                            <button style={{...styles.keyBtn, background: '#ef4444'}} onClick={exportPDF}>📄 PDF</button>
                            <button style={{...styles.keyBtn, background: '#7c3aed'}} onClick={downloadAllScorecardsZip}>⬇️ Download All (ZIP)</button>
                        </>
                    )}
                </div>
            </div>

            {bridgeKey && (
                <div style={styles.keyBox}>
                    <span style={styles.keyText}>🔑 {bridgeKey}</span>
                    <button style={styles.copyBtn} onClick={copyKey}>📋 Copy</button>
                </div>
            )}

            {loading && <div style={styles.loading}>Loading results...</div>}

            {results.length > 0 && (
                <>
                    <div style={styles.summary}>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>{results.length}</div>
                            <div style={styles.summaryLabel}>Total Students</div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>
                                {results.length > 0 ? Math.max(...results.map(r => r.score)) : 0}
                            </div>
                            <div style={styles.summaryLabel}>Highest Score</div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>
                                {results.length > 0 ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length) : 0}
                            </div>
                            <div style={styles.summaryLabel}>Average Score</div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNum}>{results.filter(r => r.fromLabIp).length}</div>
                            <div style={styles.summaryLabel}>Lab Students</div>
                        </div>
                    </div>

                    {analytics && analytics.length > 0 && (
                        <div style={styles.analyticsSection}>
                            <h3 style={styles.analyticsTitle}>Global Question Analytics</h3>
                            <div style={styles.chartLegend}>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#10b981'}}></span> Correct</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#ef4444'}}></span> Incorrect</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#e5e7eb'}}></span> Unattempted</span>
                            </div>
                            <div style={styles.chartScroll}>
                                <div style={styles.chartContainer}>
                                    {analytics.map((a, i) => {
                                        const total = a.total || 1; // prevent divide by zero
                                        const cPct = (a.correct / total) * 100;
                                        const iPct = (a.incorrect / total) * 100;
                                        const uPct = (a.unattempted / total) * 100;

                                        return (
                                            <div key={i} style={styles.barColumn} title={`Q${a.questionNumber}\nCorrect: ${a.correct}\nIncorrect: ${a.incorrect}\nUnattempted: ${a.unattempted}`}>
                                                <div style={styles.barVertical}>
                                                    {uPct > 0 && <div style={{ height: `${uPct}%`, background: '#e5e7eb', width: '100%' }} />}
                                                    {iPct > 0 && <div style={{ height: `${iPct}%`, background: '#ef4444', width: '100%' }} />}
                                                    {cPct > 0 && <div style={{ height: `${cPct}%`, background: '#10b981', width: '100%', borderRadius: (uPct === 0 && iPct === 0) ? '4px 4px 0 0' : '0' }} />}
                                                </div>
                                                <div style={styles.barLabel}>{a.questionNumber}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hardest Questions & Item Analysis (Cohort Analytics WOW Feature) */}
                    {analytics && analytics.length > 0 && (
                        <div style={styles.analyticsSection}>
                            <h3 style={styles.analyticsTitle}>🔥 Cohort Item Analysis: Hardest Questions</h3>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                                Identifying questions where the class correct rate is below 40% to pinpoint curriculum weak points.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                                {(() => {
                                    const hardest = analytics
                                        .map(a => ({
                                            ...a,
                                            correctRate: Math.round((a.correct / (a.total || 1)) * 100)
                                        }))
                                        .filter(a => a.correctRate < 40)
                                        .sort((a, b) => a.correctRate - b.correctRate)
                                        .slice(0, 4);

                                    if (hardest.length === 0) {
                                        return (
                                            <div style={{ gridColumn: '1 / -1', padding: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, textAlign: 'center', color: '#166534', fontWeight: 700, fontSize: 13 }}>
                                                🎉 Excellent! No questions fell below the 40% correct rate threshold for this cohort.
                                            </div>
                                        );
                                    }

                                    return hardest.map((a, i) => (
                                        <div key={i} style={{ padding: 16, border: '1px solid #f87171', background: '#fef2f2', borderRadius: 12 }}>
                                            <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
                                                <span style={{ fontWeight: 800, fontSize: 13, color: '#991b1b' }}>Question #{a.questionNumber} ({a.subject})</span>
                                                <span style={{ background: '#fca5a5', color: '#7f1d1d', fontWeight: 900, fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>
                                                    {a.correctRate}% Correct
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.4 }}>
                                                <strong>Incorrect:</strong> {a.incorrect} students failed this.<br />
                                                <strong>Unattempted:</strong> {a.unattempted} students skipped.
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {results && results.length > 0 && (
                        <div style={styles.analyticsSection}>
                            <h3 style={styles.analyticsTitle}>Student Performance Analytics</h3>
                            <div style={styles.chartLegend}>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#10b981'}}></span> Correct</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#ef4444'}}></span> Incorrect</span>
                                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#e5e7eb'}}></span> Unattempted</span>
                            </div>
                            <div style={styles.chartScroll}>
                                <div style={styles.chartContainer}>
                                    {results.map((r, i) => {
                                        const total = r.totalQuestions || 1; // prevent divide by zero
                                        const cPct = (r.correct / total) * 100;
                                        const iPct = (r.incorrect / total) * 100;
                                        const uPct = (r.unattempted / total) * 100;

                                        return (
                                            <div key={i} style={styles.barColumn} title={`Student: ${r.studentName} (${r.rollNumber || 'N/A'})\nScore: ${r.score}\nCorrect: ${r.correct}\nIncorrect: ${r.incorrect}\nUnattempted: ${r.unattempted}`}>
                                                <div style={styles.barVertical}>
                                                    {uPct > 0 && <div style={{ height: `${uPct}%`, background: '#e5e7eb', width: '100%' }} />}
                                                    {iPct > 0 && <div style={{ height: `${iPct}%`, background: '#ef4444', width: '100%' }} />}
                                                    {cPct > 0 && <div style={{ height: `${cPct}%`, background: '#10b981', width: '100%', borderRadius: (uPct === 0 && iPct === 0) ? '4px 4px 0 0' : '0' }} />}
                                                </div>
                                                <div style={styles.barLabel}>{i + 1}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.thead}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Student</th>
                                    <th style={styles.th}>Roll No</th>
                                    <th style={styles.th}>Score</th>
                                    <th style={styles.th}>Correct</th>
                                    <th style={styles.th}>Incorrect</th>
                                    <th style={styles.th}>Unattempted</th>
                                    <th style={styles.th}>Source</th>
                                    <th style={styles.th}>Weak Areas</th>
                                    <th style={styles.th}>Submitted</th>
                                    <th style={styles.th}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={r._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                        <td style={styles.td}>{i + 1}</td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontWeight: 600 }}>{r.studentName}</span>
                                                {r.malpracticeFlag && (
                                                    <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                                                        ⚠️ Malpractice Detected
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>{r.studentEmail}</div>
                                            {r.malpracticeFlag && (
                                                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 4 }}>
                                                    Reason: {r.malpracticeReason || 'Tab switched or window blurred'}
                                                </div>
                                            )}
                                        </td>
                                        <td style={styles.td}>{r.rollNumber || '—'}</td>
                                        <td style={{ ...styles.td, fontWeight: 700, color: getScoreColor(r.score) }}>{r.score}</td>
                                        <td style={{ ...styles.td, color: '#10b981' }}>✅ {r.correct}</td>
                                        <td style={{ ...styles.td, color: '#ef4444' }}>❌ {r.incorrect}</td>
                                        <td style={{ ...styles.td, color: '#9ca3af' }}>— {r.unattempted}</td>
                                        <td style={styles.td}>
                                            <span style={{ ...styles.sourceBadge, background: r.fromLabIp ? '#dbeafe' : '#fef3c7', color: r.fromLabIp ? '#1e40af' : '#92400e' }}>
                                                {r.fromLabIp ? '🏫 Lab' : '🌐 Remote'}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ fontSize: 12 }}>
                                                {r.weakAreas?.slice(0, 2).map((w, j) => (
                                                    <div key={j} style={{ color: '#ef4444' }}>• {w.chapter} ({w.incorrect}✕)</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ ...styles.td, fontSize: 12, color: '#6b7280' }}>
                                            {r.endTime ? new Date(r.endTime).toLocaleString() : '—'}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <a 
                                                    href={`/exam/${selectedExam}/scorecard/${r._id}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '4px 8px',
                                                        backgroundColor: '#8b5cf6',
                                                        color: 'white',
                                                        textDecoration: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    View Scorecard
                                                </a>
                                                <button
                                                    onClick={() => downloadIndividualPDF(r)}
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '4px 8px',
                                                        backgroundColor: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Download PDF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {!loading && results.length === 0 && selectedExam && (
                <div style={styles.empty}>No submissions yet for this exam.</div>
            )}
        </div>
    );
}

const styles = {
    container: { padding: '24px', fontFamily: 'Inter, sans-serif', maxWidth: 1200, margin: '0 auto' },
    title: { fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 20 },
    msg: { background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between' },
    closeMsg: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 },
    toolbar: { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' },
    select: { flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, maxWidth: 400 },
    keyBtn: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
    keyBox: { background: '#1e1b4b', color: '#a5b4fc', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, fontFamily: 'monospace', fontSize: 13 },
    keyText: { wordBreak: 'break-all' },
    copyBtn: { background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', marginLeft: 12, flexShrink: 0 },
    loading: { textAlign: 'center', color: '#9ca3af', padding: 40 },
    empty: { textAlign: 'center', color: '#9ca3af', padding: 60 },
    summary: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
    summaryCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    summaryNum: { fontSize: 32, fontWeight: 800, color: '#4f46e5' },
    summaryLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },
    tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid #e5e7eb' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    thead: { background: '#f8fafc' },
    th: { padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
    td: { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
    sourceBadge: { borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 },
    analyticsSection: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    analyticsTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, marginTop: 0 },
    chartLegend: { display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: '#6b7280' },
    legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: '50%' },
    chartScroll: { overflowX: 'auto', paddingBottom: 12 },
    chartContainer: { display: 'flex', gap: 8, height: 200, alignItems: 'flex-end', minWidth: 'min-content' },
    barColumn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 24, cursor: 'pointer', transition: 'opacity 0.2s' },
    barVertical: { width: 16, height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: '#f8fafc', borderRadius: '4px 4px 0 0', overflow: 'hidden' },
    barLabel: { fontSize: 11, color: '#6b7280', fontWeight: 600 }
};
