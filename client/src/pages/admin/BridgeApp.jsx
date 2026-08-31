import React, { useState } from 'react';
import api from '../../api';

export default function BridgeApp() {
    const [key, setKey] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFetch = async (e) => {
        e.preventDefault();
        if (!key.trim()) return;
        setLoading(true);
        setError('');
        setData(null);
        try {
            const res = await api.get(`/api/exams/bridge/${key.trim()}`);
            setData(res.data);
        } catch (e) {
            setError(e.response?.data?.msg || 'Invalid or expired key.');
        }
        setLoading(false);
    };

    const getScoreColor = (score, total) => {
        const pct = (score / (total * 4)) * 100;
        if (pct >= 70) return '#10b981';
        if (pct >= 40) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={styles.logo}>🌉</div>
                <h2 style={styles.title}>Bridge App</h2>
                <p style={styles.subtitle}>Enter a Bridge Key to securely access compiled exam results</p>
            </div>

            <form onSubmit={handleFetch} style={styles.form}>
                <input
                    style={styles.keyInput}
                    placeholder="Paste Bridge Key here..."
                    value={key}
                    onChange={e => setKey(e.target.value)}
                />
                <button style={styles.fetchBtn} type="submit" disabled={loading}>
                    {loading ? 'Fetching...' : '🔍 Fetch Results'}
                </button>
            </form>

            {error && <div style={styles.error}>{error}</div>}

            {data && (
                <div style={styles.results}>
                    <div style={styles.resultsHeader}>
                        <h3 style={styles.examTitle}>{data.examTitle}</h3>
                        <div style={styles.examMeta}>
                            {data.exam?.examType && <span style={styles.typeBadge}>{data.exam.examType}</span>}
                            <span>{data.results?.length || 0} students</span>
                        </div>
                    </div>

                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.thead}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Student</th>
                                    <th style={styles.th}>Roll No</th>
                                    <th style={styles.th}>Score</th>
                                    <th style={styles.th}>Correct</th>
                                    <th style={styles.th}>Wrong</th>
                                    <th style={styles.th}>Skip</th>
                                    <th style={styles.th}>Source</th>
                                    <th style={styles.th}>Top Weak Area</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.results?.map((r, i) => {
                                    const totalQ = data.exam?.questions?.length || (r.correct + r.incorrect + r.unattempted);
                                    return (
                                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                            <td style={styles.td}>{i + 1}</td>
                                            <td style={styles.td}>
                                                <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>{r.studentEmail}</div>
                                            </td>
                                            <td style={styles.td}>{r.rollNumber || '—'}</td>
                                            <td style={{ ...styles.td, fontWeight: 800, color: getScoreColor(r.score, r.correct + r.incorrect + r.unattempted), fontSize: 18 }}>{r.score}</td>
                                            <td style={{ ...styles.td, color: '#10b981' }}>✅ {r.correct}</td>
                                            <td style={{ ...styles.td, color: '#ef4444' }}>❌ {r.incorrect}</td>
                                            <td style={{ ...styles.td, color: '#9ca3af' }}>— {r.unattempted}</td>
                                            <td style={styles.td}>
                                                <span style={{ ...styles.sourceBadge, background: r.fromLabIp ? '#dbeafe' : '#fef3c7', color: r.fromLabIp ? '#1d4ed8' : '#92400e' }}>
                                                    {r.fromLabIp ? '🏫 Lab' : '🌐 Remote'}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.td, fontSize: 12, color: '#ef4444' }}>
                                                {r.weakAreas?.[0] ? `${r.weakAreas[0].chapter} (${r.weakAreas[0].incorrect}✕)` : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: { padding: '40px 24px', fontFamily: 'Inter, sans-serif', maxWidth: 1100, margin: '0 auto' },
    header: { textAlign: 'center', marginBottom: 32 },
    logo: { fontSize: 48, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' },
    subtitle: { color: '#6b7280', fontSize: 15 },
    form: { display: 'flex', gap: 12, marginBottom: 24, maxWidth: 700, margin: '0 auto 24px' },
    keyInput: { flex: 1, padding: '12px 16px', border: '2px solid #d1d5db', borderRadius: 10, fontSize: 14, fontFamily: 'monospace', outline: 'none' },
    fetchBtn: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
    error: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, marginBottom: 20, textAlign: 'center' },
    results: { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' },
    resultsHeader: { background: '#1e1b4b', color: '#fff', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    examTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
    examMeta: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#94a3b8' },
    typeBadge: { background: '#f59e0b', color: '#000', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 700 },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    thead: { background: '#f8fafc' },
    th: { padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' },
    td: { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
    sourceBadge: { borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }
};
