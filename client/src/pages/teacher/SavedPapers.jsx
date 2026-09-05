import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize, optionLabel } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';
import PaperRenderer, { DEFAULT_SETTINGS, SettingsPanel, formatMarks, calcTotal } from '../../components/PaperRenderer';
import PaperAnalysisModal from '../../components/PaperAnalysisModal';
import A4AnswerKey from '../../components/A4AnswerKey';
import A4SolutionKey from '../../components/A4SolutionKey';

/* ─── Inline styles ─── */
const S = {
    page: { fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" },

    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
        marginBottom: '32px',
    },
    summaryCard: {
        background: '#fff',
        border: '1px solid #f1f5f9',
        borderRadius: '24px',
        padding: '24px 30px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        borderLeft: '8px solid #001f6d',
    },
    summaryLabel: {
        fontSize: '10px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: '#001f6d',
        opacity: 0.5,
        marginBottom: '8px',
    },
    summaryValue: {
        fontSize: '32px',
        fontWeight: 900,
        color: '#001f6d',
        fontFamily: "'Inter', sans-serif",
        lineHeight: 1.1,
    },
    summarySub: { fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginTop: '6px' },

    sectionLabel: {
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#94a3b8',
        marginBottom: '10px',
    },

    /* ── Filter bar ── */
    filterBar: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        marginBottom: '12px',
        flexWrap: 'wrap',
    },
    filterSelect: {
        height: '34px',
        padding: '0 12px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '7px',
        border: '1px solid #e2e8f0',
        background: '#fff',
        color: '#374151',
        fontFamily: 'inherit',
        cursor: 'pointer',
        outline: 'none',
        minWidth: '160px',
    },
    filterDate: {
        height: '34px',
        padding: '0 10px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '7px',
        border: '1px solid #e2e8f0',
        background: '#fff',
        color: '#374151',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        cursor: 'pointer',
        outline: 'none',
    },
    filterLabel: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#64748b',
        whiteSpace: 'nowrap',
    },
    btnClearFilters: {
        height: '34px',
        padding: '0 14px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '7px',
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        color: '#64748b',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.14s',
    },

    tableWrap: {
        background: '#fff',
        border: '1px solid #f1f5f9',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
    },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#94a3b8',
        padding: '11px 18px',
        textAlign: 'left',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
    },
    thRight: { textAlign: 'right' },
    td: { padding: '14px 18px', verticalAlign: 'middle', borderBottom: '1px solid #f1f5f9' },
    tdLast: { padding: '14px 18px', verticalAlign: 'middle' },

    paperCell: { display: 'flex', alignItems: 'center', gap: '12px' },
    paperIcon: {
        width: '38px', height: '38px',
        background: '#dbeafe',
        borderRadius: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', flexShrink: 0,
    },
    paperTitle: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
    paperId: {
        fontSize: '11px', color: '#94a3b8',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        marginTop: '2px',
    },

    tagClass: {
        display: 'inline-flex', alignItems: 'center',
        fontSize: '11px', fontWeight: 800,
        padding: '4px 12px', borderRadius: '8px',
        background: '#f8fafc', color: '#001f6d', border: '1px solid #f1f5f9',
        textTransform: 'uppercase', letterSpacing: '0.05em',
    },
    tagQ: {
        display: 'inline-flex', alignItems: 'center',
        fontSize: '11.5px', fontWeight: 600,
        padding: '3px 10px', borderRadius: '5px',
        background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
    },
    dateCell: {
        fontSize: '12.5px', color: '#475569',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
    },

    actionCell: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
    btnView: {
        height: '34px', padding: '0 14px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '10px', cursor: 'pointer',
        background: '#001f6d', color: '#c5a059',
        border: 'none',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        transition: 'all 0.2s',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        boxShadow: '0 4px 10px rgba(0,31,109,0.15)',
    },
    btnEdit: {
        height: '34px', padding: '0 14px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '10px', cursor: 'pointer',
        background: '#f1f5f9', color: '#001f6d',
        border: '1px solid #cbd5e1',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        transition: 'all 0.2s',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
    },
    btnDel: {
        height: '34px', padding: '0 12px',
        fontSize: '11px', fontWeight: 700,
        borderRadius: '10px', cursor: 'pointer',
        background: '#fff', color: '#dc2626',
        border: '1px solid #fecaca',
        fontFamily: 'inherit',
        transition: 'all 0.14s',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
    },

    empty: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 0', gap: '8px',
    },
    emptyIcon: { fontSize: '36px', marginBottom: '6px' },
    emptyTitle: { fontSize: '14px', fontWeight: 600, color: '#475569' },
    emptySub: { fontSize: '12.5px', color: '#94a3b8' },

    viewToolbar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px',
        padding: '12px 18px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
    },
    btnBack: {
        height: '38px', padding: '0 18px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '12px', cursor: 'pointer',
        background: '#f1f5f9', color: '#001f6d',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
    },
    btnPrint: {
        height: '38px', padding: '0 20px',
        fontSize: '11px', fontWeight: 800,
        borderRadius: '12px', cursor: 'pointer',
        background: '#001f6d', color: '#c5a059',
        border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        boxShadow: '0 8px 20px rgba(0,31,109,0.2)',
    },
    viewBtns: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
};

/* ─── toDateStr ─── */
const toDateStr = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PAPER VIEW — uses PaperRenderer engine + Analysis & Key modals             */
/* ═══════════════════════════════════════════════════════════════════════════ */
const PaperView = ({ paper: initialPaper, activeTemplate, onBack }) => {
    const navigate = useNavigate();
    const [paper, setPaper] = useState(initialPaper);
    const [showSettings, setShowSettings] = useState(false);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
    const [showSolutionsModal, setShowSolutionsModal] = useState(false);

    useEffect(() => {
        setPaper(initialPaper);
    }, [initialPaper]);

    const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS,
        showMarks: false,
        showAnswerKey: false,
        startQNo: paper.startQNo || 1,
        endQNo: paper.endQNo || null,
    });

    const isApproved = paper?.status?.toLowerCase() === 'approved';
    const questions = paper?.questions || [];
    const startQNo = paper?.startQNo || 1;

    return (
        <div style={S.page}>
            {/* --- Toolbar --- */}
            <div style={{ ...S.viewToolbar, flexDirection: 'column', gap: '12px', alignItems: 'stretch' }} className="no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <button style={S.btnBack} onClick={onBack}>← Back to Papers</button>
                    
                    <div style={S.viewBtns}>
                        {/* Edit Paper / Questions */}
                        <button
                            onClick={() => navigate(`/teacher/create-paper?paperId=${paper._id}`)}
                            className="bg-navy text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>✏️</span> Edit Questions
                        </button>

                        {/* View Analysis */}
                        <button
                            onClick={() => setShowAnalysisModal(true)}
                            className="bg-gold text-navy hover:bg-navy hover:text-gold px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>📊</span> View Analysis
                        </button>

                        {/* Answer Key */}
                        <button
                            onClick={() => setShowAnswerKeyModal(true)}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🔑</span> Answer Key
                        </button>

                        {/* Solutions Guide */}
                        <button
                            onClick={() => setShowSolutionsModal(true)}
                            className="bg-navy text-gold hover:bg-gold hover:text-navy px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>💡</span> Solutions
                        </button>

                        <button
                            style={{ ...S.btnBack, background: showSettings ? '#001f6d' : '#f1f5f9', color: showSettings ? '#fff' : '#001f6d' }}
                            onClick={() => setShowSettings(s => !s)}
                        >
                            ⚙️ Layout Settings
                        </button>

                        <button style={S.btnPrint} onClick={() => window.print()}>
                            🖨 Print / Save PDF
                        </button>
                    </div>
                </div>

                {showSettings && (
                    <SettingsPanel settings={settings} setSettings={setSettings} totalQuestions={questions.length} />
                )}
            </div>

            {/* ── PaperRenderer ── */}
            <PaperRenderer
                paper={paper}
                activeTemplate={activeTemplate}
                isAssignment={paper.isAssignment || false}
                settings={settings}
                setSettings={setSettings}
                showSettingsPanel={false}
                printAreaId="qp-print-area"
            />

            {/* ── MODAL: ANSWER KEY (TRUE A4 VIEW, DYNAMIC LABELS, INDEPENDENT PRINT & DOWNLOAD) ── */}
            {showAnswerKeyModal && (
                <A4AnswerKey
                    paper={paper}
                    questions={questions}
                    startQNo={startQNo}
                    setName={paper.setName || 'P'}
                    onClose={() => setShowAnswerKeyModal(false)}
                    onQuestionsUpdated={(updatedQs) => {
                        setPaper(p => ({ ...p, questions: updatedQs }));
                    }}
                />
            )}

            {/* ── MODAL: SOLUTIONS GUIDE (TRUE A4 VIEW, KATEX MATH, INDEPENDENT PRINT & DOWNLOAD) ── */}
            {showSolutionsModal && (
                <A4SolutionKey
                    paper={paper}
                    questions={questions}
                    startQNo={startQNo}
                    setName={paper.setName || 'P'}
                    onClose={() => setShowSolutionsModal(false)}
                />
            )}

            {/* ── MODAL: ANALYSIS DASHBOARD ── */}
            <PaperAnalysisModal
                isOpen={showAnalysisModal}
                onClose={() => setShowAnalysisModal(false)}
                paperTitle={paper.title || `${paper.subject} Assessment`}
                questions={questions}
                examType={paper.isAssignment ? 'CET' : (paper.examType || 'CET')}
            />
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */
const SavedPapers = () => {
    const navigate = useNavigate();
    const [papers, setPapers] = useState([]);
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);

    /* ── Filter state ── */
    const [filterClass, setFilterClass] = useState('');
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [papersRes, templatesRes] = await Promise.all([
                    api.get('/api/papers'),
                    api.get('/api/templates'),
                ]);
                setPapers(papersRes.data);
                if (templatesRes.data.length > 0) setActiveTemplate(templatesRes.data[0]);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this paper? This cannot be undone.')) return;
        try {
            await api.delete(`/api/papers/${id}`);
            setPapers(prev => prev.filter(p => p._id !== id));
        } catch {
            alert('Failed to delete paper.');
        }
    };

    /* ── Unique class options from all papers ── */
    const classOptions = [...new Set(
        papers.flatMap(p => p.classes || [])
    )].sort();

    /* ── Filtered papers ── */
    const filteredPapers = papers.filter(p => {
        const matchClass = filterClass
            ? (p.classes || []).includes(filterClass)
            : true;
        const matchDate = filterDate
            ? toDateStr(p.createdAt) === filterDate
            : true;
        return matchClass && matchDate;
    });

    const hasActiveFilters = filterClass || filterDate;

    const clearFilters = () => {
        setFilterClass('');
        setFilterDate('');
    };

    /* ── Paper view ── */
    if (selectedPaper) {
        return (
            <PaperView
                paper={selectedPaper}
                activeTemplate={activeTemplate}
                onBack={() => setSelectedPaper(null)}
            />
        );
    }

    /* ── Summary values (based on ALL papers, not filtered) ── */
    const lastDate = papers.length
        ? new Date(Math.max(...papers.map(p => new Date(p.createdAt)))).toLocaleDateString()
        : '—';

    /* ── List view ── */
    return (
        <div style={S.page}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#001f6d', letterSpacing: '-0.03em', margin: 0, textTransform: 'uppercase' }}>Department Archives</h3>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Managed Institutional Paper Repository</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        fontSize: '11px', color: '#c5a059',
                        background: '#001f6d', border: 'none',
                        borderRadius: '10px', padding: '8px 18px',
                        fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                        boxShadow: '0 4px 12px rgba(0,31,109,0.2)',
                    }}>
                        {papers.length} RECORD{papers.length !== 1 ? 'S' : ''}
                    </div>
                    <button
                        onClick={() => navigate('/teacher/dashboard')}
                        style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '2px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '8px 18px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            cursor: 'pointer'
                        }}
                    >
                        ← Back
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div style={S.summaryGrid}>
                <div style={S.summaryCard}>
                    <div style={S.summaryLabel}>Total Papers & Assignments</div>
                    <div style={S.summaryValue}>{papers.length}</div>
                    <div style={S.summarySub}>All saved question papers</div>
                </div>
                <div style={S.summaryCard}>
                    <div style={S.summaryLabel}>Last Created</div>
                    <div style={{ ...S.summaryValue, fontSize: '16px', paddingTop: '5px' }}>{lastDate}</div>
                    <div style={S.summarySub}>Most recent paper</div>
                </div>
            </div>

            {/* Section label + filter bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={S.sectionLabel}>All Papers & Assignments</div>

                {/* ── Filters ── */}
                <div style={S.filterBar}>
                    {/* Class filter */}
                    <span style={S.filterLabel}>Class:</span>
                    <select
                        style={S.filterSelect}
                        value={filterClass}
                        onChange={e => setFilterClass(e.target.value)}
                    >
                        <option value="">All Classes</option>
                        {classOptions.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                    </select>

                    {/* Date filter */}
                    <span style={S.filterLabel}>Created:</span>
                    <input
                        type="date"
                        style={S.filterDate}
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                    />

                    {/* Clear button */}
                    {hasActiveFilters && (
                        <button
                            style={S.btnClearFilters}
                            onClick={clearFilters}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#374151'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div style={S.tableWrap}>
                {filteredPapers.length === 0 ? (
                    <div style={S.empty}>
                        <div style={S.emptyIcon}>{papers.length === 0 ? '📄' : '🔍'}</div>
                        <div style={S.emptyTitle}>{papers.length === 0 ? 'No saved papers yet' : 'No papers match your filters'}</div>
                        <div style={S.emptySub}>
                            {papers.length === 0
                                ? 'Create a paper from the Paper Builder to see it here.'
                                : 'Try changing or clearing the filters above.'}
                        </div>
                    </div>
                ) : (
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={S.th}>Paper / Assignment</th>
                                <th style={S.th}>Class</th>
                                <th style={S.th}>Questions</th>
                                <th style={S.th}>Created</th>
                                <th style={S.th}>Status</th>
                                <th style={{ ...S.th, ...S.thRight }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPapers.map((p, i) => (
                                <tr
                                    key={p._id}
                                    style={{
                                        background: hoveredRow === p._id ? '#f8fafc' : '#fff',
                                        cursor: 'default',
                                        transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={() => setHoveredRow(p._id)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                >
                                    {/* Paper */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <div style={S.paperCell}>
                                            <div style={S.paperIcon}>
                                                {p.isAssignment ? '📝' : '📄'}
                                            </div>
                                            <div>
                                                <div style={S.paperTitle}>{p.title}</div>
                                                <div style={S.paperId}>
                                                    {p.isAssignment ? 'ASSIGNMENT • ' : 'TEST • '}#{String(i + 1).padStart(4, '0')}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Class */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={S.tagClass}>Class {p.classes?.join(', ')}</span>
                                    </td>

                                    {/* Questions */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={S.tagQ}>{p.questions?.length} Qs</span>
                                    </td>

                                    {/* Date */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={S.dateCell}>{new Date(p.createdAt).toLocaleDateString()}</span>
                                    </td>

                                    {/* Status */}
                                    <td style={{ ...S.td, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={{
                                            ...S.tagClass, 
                                            background: p.status === 'Approved' ? '#dcfce7' : p.status === 'Rejected' ? '#fee2e2' : '#fef9c3',
                                            color: p.status === 'Approved' ? '#166534' : p.status === 'Rejected' ? '#991b1b' : '#854d0e',
                                            border: 'none'
                                        }}>
                                            {p.status || 'Pending Approval'}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td style={{ ...S.tdLast, borderBottom: i === filteredPapers.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <div style={S.actionCell}>
                                            <button
                                                style={S.btnEdit}
                                                onClick={() => navigate(`/teacher/create-paper?paperId=${p._id}`)}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#001f6d'; e.currentTarget.style.color = '#c5a059'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#001f6d'; }}
                                                title="Edit questions and setup"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                style={S.btnView}
                                                onClick={() => setSelectedPaper(p)}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#001f6d'; e.currentTarget.style.color = '#c5a059'; }}
                                            >
                                                View
                                            </button>
                                            <button
                                                style={S.btnDel}
                                                onClick={e => handleDelete(e, p._id)}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dc2626'; }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SavedPapers;
