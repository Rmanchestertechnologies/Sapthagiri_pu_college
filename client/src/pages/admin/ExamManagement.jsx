import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { ExamCountdown } from './exam-management/ExamCountdown';
import { ExamPrintView } from './exam-management/ExamPrintView';
import { EXAM_TYPES, STATUS_COLORS, calculateEndTime, localToUtcIso, utcToLocalStr } from './exam-management/examManagementUtils';
import { styles } from './exam-management/styles';

// ─── Main Exam Management Component ───
export default function ExamManagement() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('online');
    const [exams, setExams] = useState([]);
    const [papers, setPapers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [grandTests, setGrandTests] = useState([]);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(null); // exam id
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    // Merge form state
    const [mergeForm, setMergeForm] = useState({
        title: '', examType: 'NEET', paperIds: [], instructions: '',
        start_time: '', end_time: '', duration_minutes: 180, allowedStudents: '',
        shuffleQuestions: false
    });

    // Grand Test exam creation state
    const [selectedGTId, setSelectedGTId] = useState('');

    // Config edit state
    const [configForm, setConfigForm] = useState({
        start_time: '', end_time: '', duration_minutes: 180, instructions: '', status: '', allowedStudents: '',
        shuffleQuestions: false
    });

    // Print / offline state
    const [printExamDetail, setPrintExamDetail] = useState(null);
    const [printSettings, setPrintSettings] = useState({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '14px',
        lineHeight: '1.5',
        columns: 1,
        showMarks: true,
        selectedTemplateId: '',
        showSettings: true,
        numSets: 4,
        activeSet: 'Standard',
        printOMRSheet: false,
        bilingualMode: false
    });

    useEffect(() => { 
        fetchExams(); 
        fetchPapers(); 
        fetchTemplates();
        fetchGrandTests();
    }, []);

    const fetchExams = async () => {
        try {
            const res = await api.get('/api/exams');
            setExams(res.data);
        } catch (e) { setMsg('Failed to load exams'); }
    };

    const fetchPapers = async () => {
        try {
            const res = await api.get('/api/papers/admin/all');
            setPapers(res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (e) { /* ignore */ }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/api/templates');
            setTemplates(res.data);
        } catch (e) { /* ignore */ }
    };

    const fetchGrandTests = async () => {
        try {
            const res = await api.get('/api/grand-tests');
            setGrandTests(res.data);
        } catch { /* ignore */ }
    };

    const togglePaper = (id) => {
        setMergeForm(f => {
            if (f.paperIds.includes(id)) return { ...f, paperIds: f.paperIds.filter(p => p !== id) };
            return { ...f, paperIds: [...f.paperIds, id] };
        });
    };

    const handleMerge = async () => {
        if (mergeForm.paperIds.length === 0) return setMsg(`Select at least 1 paper to merge.`);
        setLoading(true);
        try {
            const payload = {
                ...mergeForm,
                start_time: localToUtcIso(mergeForm.start_time),
                end_time: localToUtcIso(mergeForm.end_time),
                allowedStudents: mergeForm.allowedStudents ? mergeForm.allowedStudents.split(',').map(s => s.trim()).filter(Boolean) : []
            };
            const res = await api.post('/api/exams/merge', payload);
            setMsg('✅ Composite Exam & Master Question Paper created successfully!');
            setShowMergeModal(false);
            setMergeForm({ title: '', examType: 'NEET', paperIds: [], instructions: '', start_time: '', end_time: '', duration_minutes: 180, allowedStudents: '', shuffleQuestions: false });
            fetchExams();
        } catch (e) {
            setMsg(e.response?.data?.msg || 'Merge failed');
        }
        setLoading(false);
    };

    const handleCreateFromGT = async () => {
        if (!selectedGTId) return setMsg('Please select a Grand Test paper.');
        setLoading(true);
        try {
            const payload = {
                grandTestId: selectedGTId,
                title: mergeForm.title,
                instructions: mergeForm.instructions,
                start_time: localToUtcIso(mergeForm.start_time),
                end_time: localToUtcIso(mergeForm.end_time),
                duration_minutes: mergeForm.duration_minutes,
                allowedStudents: mergeForm.allowedStudents ? mergeForm.allowedStudents.split(',').map(s => s.trim()).filter(Boolean) : []
            };
            await api.post('/api/exams/from-grand-test', payload);
            setMsg('✅ Grand Test Exam created successfully!');
            setShowMergeModal(false);
            setSelectedGTId('');
            setMergeForm({ title: '', examType: 'NEET', paperIds: [], instructions: '', start_time: '', end_time: '', duration_minutes: 180, allowedStudents: '', shuffleQuestions: false });
            fetchExams();
        } catch (e) {
            setMsg(e.response?.data?.msg || 'Failed to create exam from Grand Test');
        }
        setLoading(false);
    };

    const openConfigModal = (exam) => {
        setConfigForm({
            start_time: utcToLocalStr(exam.start_time),
            end_time: utcToLocalStr(exam.end_time),
            duration_minutes: exam.duration_minutes || 180,
            instructions: exam.instructions || '',
            status: exam.status || 'draft',
            allowedStudents: exam.allowedStudents ? exam.allowedStudents.join(', ') : '',
            shuffleQuestions: exam.shuffleQuestions || false
        });
        setShowConfigModal(exam._id);
    };

    const handleConfigSave = async () => {
        setLoading(true);
        try {
            const payload = {
                ...configForm,
                start_time: localToUtcIso(configForm.start_time),
                end_time: localToUtcIso(configForm.end_time),
                allowedStudents: configForm.allowedStudents ? configForm.allowedStudents.split(',').map(s => s.trim()).filter(Boolean) : []
            };
            await api.put(`/api/exams/${showConfigModal}/config`, payload);
            setMsg('✅ Exam config updated!');
            setShowConfigModal(null);
            fetchExams();
        } catch (e) {
            setMsg(e.response?.data?.msg || 'Update failed');
        }
        setLoading(false);
    };

    const handleToggleOnlineVisibility = async (examId) => {
        try {
            const res = await api.put(`/api/exams/${examId}/toggle-online-visibility`);
            setMsg(res.data.msg || 'Online exam visibility updated');
            fetchExams();
        } catch (e) {
            setMsg(e.response?.data?.msg || 'Failed to toggle visibility');
        }
    };

    const handleDeleteExam = async (examId) => {
        if (!window.confirm('Are you sure you want to delete this exam? This will remove all student sessions as well.')) return;
        try {
            await api.delete(`/api/exams/${examId}`);
            setMsg('🗑️ Exam deleted successfully');
            fetchExams();
        } catch (e) {
            setMsg(e.response?.data?.msg || 'Delete failed');
        }
    };

    const handlePrint = async (exam) => {
        try {
            const examId = exam._id || exam.id;
            const res = await api.get(`/api/exams/admin/${examId}`);
            const data = res.data;

            const defaultOffline = `General Instructions for Offline Exam:
1. This is an offline examination. Please mark your answers clearly on the response sheet.
2. The duration of this exam is ${data.duration_minutes || 180} minutes.
3. Read each question carefully before choosing your answer.
4. Marking Scheme: +4 for Correct, -1 for Incorrect, 0 for Unattempted.
5. No extra scrap sheet is allowed. Use the space provided for rough calculations.`;

            const examInstructions = data.instructions || '';
            const isDefaultOnline = examInstructions.includes('clock will be set') || examInstructions.includes('Question Palette');
            const instructionsToUse = (examInstructions && !isDefaultOnline) ? examInstructions : defaultOffline;

            setPrintExamDetail(data);
            setPrintSettings(s => ({
                ...s,
                selectedTemplateId: templates.length > 0 ? templates[0]._id : '',
                instructions: instructionsToUse
            }));
        } catch { setMsg('Failed to load exam for print'); }
    };

    const copyShareLink = (examId) => {
        const url = `${window.location.origin}/exam/${examId}/instructions`;
        navigator.clipboard.writeText(url);
        setMsg('✅ Exam link copied to clipboard!');
    };

    if (printExamDetail) {
        return (
            <ExamPrintView
                exam={printExamDetail}
                templates={templates}
                settings={printSettings}
                setSettings={setPrintSettings}
                onBack={() => setPrintExamDetail(null)}
            />
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>📋 Exam Management</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                        onClick={() => {
                            const url = `${window.location.origin}/lab-exam`;
                            navigator.clipboard.writeText(url);
                            setMsg(`✅ Permanent Student Lab Portal link copied: ${url}`);
                        }}
                        style={{
                            padding: '10px 18px',
                            background: '#071328',
                            color: '#a5b4fc',
                            border: '1.5px solid #6366f1',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🖥️</span>
                        <span>Copy Student Lab Link (/lab-exam)</span>
                    </button>
                    <button style={styles.primaryBtn} onClick={() => setShowMergeModal(true)}>
                        ⊕ Generate Composite Exam
                    </button>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        style={{
                            padding: '10px 20px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '2px solid #e2e8f0',
                            borderRadius: '12px',
                            fontWeight: 900,
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            cursor: 'pointer'
                        }}
                    >
                        ← Back
                    </button>
                </div>
            </div>

            {msg && <div style={styles.msgBar}>{msg} <button style={styles.closeMsg} onClick={() => setMsg('')}>✕</button></div>}

            {/* Tabs */}
            <div style={styles.tabs}>
                {['online', 'offline'].map(t => (
                    <button key={t} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }} onClick={() => setTab(t)}>
                        {t === 'online' ? '🌐 Online Exams' : '🖨️ Offline / Print'}
                    </button>
                ))}
            </div>

            {/* Online Tab */}
            {tab === 'online' && (
                <div>
                    {exams.length === 0 ? (
                        <div style={styles.empty}>No online exams created yet. Click "Generate Composite Exam" to start.</div>
                    ) : (
                        <div style={styles.examGrid}>
                            {exams.map(exam => {
                                const isOnlineActive = exam.isOnlineVisible !== false && exam.status !== 'draft' && exam.status !== 'archived';
                                return (
                                    <div key={exam._id} style={styles.examCard}>
                                        <div style={styles.examCardHeader}>
                                            <span style={styles.examType}>{exam.examType}</span>
                                            <span style={{ ...styles.statusBadge, background: STATUS_COLORS[exam.status] || '#16a34a' }}>
                                                {exam.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <h3 style={styles.examCardTitle}>{exam.title}</h3>
                                        <div style={styles.examMeta}>
                                            <span>📝 {exam.questions?.length || 0} Questions</span>
                                            <span>⏱ {exam.duration_minutes} min</span>
                                        </div>
                                        {exam.start_time && (
                                            <div style={styles.examTime}>
                                                🕐 {new Date(exam.start_time).toLocaleString()} → {exam.end_time ? new Date(exam.end_time).toLocaleString() : 'Open'}
                                            </div>
                                        )}

                                        {/* Quick Online Exam Visibility Switch */}
                                        <div style={{ marginTop: 10, marginBottom: 4 }}>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleOnlineVisibility(exam._id)}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    fontWeight: 800,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    border: isOnlineActive ? '1.5px solid #16a34a' : '1.5px solid #94a3b8',
                                                    background: isOnlineActive ? '#f0fdf4' : '#f8fafc',
                                                    color: isOnlineActive ? '#15803d' : '#64748b'
                                                }}
                                                title="Click to toggle visibility on student online CBT portal"
                                            >
                                                <span>{isOnlineActive ? '🟢 Visible in Online Exam' : '⚪ Hidden from Students'}</span>
                                                <span style={{ textDecoration: 'underline', fontSize: '10px' }}>
                                                    {isOnlineActive ? 'Hide' : 'Enable'}
                                                </span>
                                            </button>
                                        </div>

                                        {['scheduled', 'live'].includes(exam.status) && (
                                            <ExamCountdown 
                                                startTime={exam.start_time} 
                                                endTime={exam.end_time} 
                                                status={exam.status}
                                                onZero={fetchExams}
                                            />
                                        )}
                                        <div style={{ ...styles.examActions, marginTop: 10 }}>
                                            <button style={styles.actionBtn} onClick={() => openConfigModal(exam)}>⚙️ Configure</button>
                                            <button style={styles.actionBtn} onClick={() => copyShareLink(exam._id)}>🔗 Link</button>
                                            <button style={{ ...styles.actionBtn, background: '#7c3aed' }}
                                                onClick={() => window.open(`/admin/dashboard/results?examId=${exam._id}`, '_self')}>
                                                📊 Results
                                            </button>
                                            <button style={{ ...styles.actionBtn, background: '#ef4444' }} onClick={() => handleDeleteExam(exam._id)}>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Offline / Print Tab */}
            {tab === 'offline' && (
                <div>
                    <p style={styles.printNote}>
                        Select an exam to customize layout formatting, choose templates, and print A4 or export to Word.
                    </p>
                    <div style={styles.examGrid}>
                        {exams.map(exam => (
                            <div key={exam._id} style={styles.examCard}>
                                <div style={styles.examCardHeader}>
                                    <span style={styles.examType}>{exam.examType}</span>
                                </div>
                                <h3 style={styles.examCardTitle}>{exam.title}</h3>
                                <div style={styles.examMeta}>
                                    <span>📝 {exam.questions?.length || 0} Questions</span>
                                </div>
                                <div style={{ ...styles.examActions, marginTop: 12 }}>
                                    <button style={styles.actionBtn} onClick={() => handlePrint(exam)}>
                                        🖨️ Print & Customize
                                    </button>
                                    <button style={{ ...styles.actionBtn, background: '#ef4444' }} onClick={() => handleDeleteExam(exam._id)}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Merge Modal */}
            {showMergeModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <h3>Generate Composite Exam</h3>
                            <button style={styles.closeBtn} onClick={() => setShowMergeModal(false)}>✕</button>
                        </div>
                        <div style={styles.modalBody}>
                            <label style={styles.label}>Exam Title</label>
                            <input style={styles.input} placeholder="e.g. NEET 2025 Mock Test" value={mergeForm.title}
                                onChange={e => setMergeForm(f => ({ ...f, title: e.target.value }))} />

                            <label style={styles.label}>Exam Type</label>
                            <select style={styles.input} value={mergeForm.examType}
                                onChange={e => setMergeForm(f => ({ ...f, examType: e.target.value, paperIds: [] }))}>
                                {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>

                            <label style={styles.label}>Duration (minutes)</label>
                            <input style={styles.input} type="number" value={mergeForm.duration_minutes}
                                onChange={e => {
                                    const dm = Number(e.target.value);
                                    const et = calculateEndTime(mergeForm.start_time, dm);
                                    setMergeForm(f => ({ ...f, duration_minutes: dm, end_time: et }));
                                }} />

                            <label style={styles.label}>Start Time (optional)</label>
                            <input style={styles.input} type="datetime-local" value={mergeForm.start_time}
                                onChange={e => {
                                    const st = e.target.value;
                                    const et = calculateEndTime(st, mergeForm.duration_minutes);
                                    setMergeForm(f => ({ ...f, start_time: st, end_time: et }));
                                }} />

                            <label style={styles.label}>End Time (optional)</label>
                            <input style={styles.input} type="datetime-local" value={mergeForm.end_time}
                                onChange={e => setMergeForm(f => ({ ...f, end_time: e.target.value }))} />

                            <label style={styles.label}>Allowed Students (Roll Numbers, comma separated)</label>
                            <input style={styles.input} placeholder="Leave blank to allow all students" value={mergeForm.allowedStudents}
                                onChange={e => setMergeForm(f => ({ ...f, allowedStudents: e.target.value }))} />

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 16 }}>
                                <input 
                                    type="checkbox" 
                                    id="shuffleQuestions"
                                    checked={mergeForm.shuffleQuestions || false}
                                    onChange={e => setMergeForm(f => ({ ...f, shuffleQuestions: e.target.checked }))}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="shuffleQuestions" style={{ fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                    🔀 Shuffle Questions (Randomizes question order per student session to prevent lab screen copying)
                                </label>
                            </div>

                            <label style={styles.label}>
                                Select Papers ({mergeForm.paperIds.length} selected)
                            </label>
                            <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 8, fontWeight: 500 }}>
                                Merge any 2, 3, 4 or more subject papers into a single Grand Composite Exam & A4 Question Paper with continuous/section numbering and PQRS sets support (e.g. NEET: Physics, Chemistry, Botany, Zoology | CET: Physics, Chemistry, Maths, Biology | JEE: Physics, Chemistry, Maths).
                            </div>

                            {/* Grand Test Papers Section */}
                            {grandTests.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#001f6d', marginBottom: 8, background: '#f0f4ff', padding: '6px 10px', borderRadius: 8, border: '1px solid #c7d2fe' }}>
                                        📋 OR — Select a Grand Test Paper
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 160, overflowY: 'auto' }}>
                                        {grandTests.map(gt => (
                                            <div
                                                key={gt._id}
                                                onClick={() => setSelectedGTId(prev => prev === gt._id ? '' : gt._id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                                    border: selectedGTId === gt._id ? '2px solid #001f6d' : '1.5px solid #e5e7eb',
                                                    borderRadius: 10, cursor: 'pointer', background: selectedGTId === gt._id ? '#eef2ff' : '#fff',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <span style={{ fontSize: 16 }}>{selectedGTId === gt._id ? '✅' : '⬜'}</span>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#001f6d' }}>{gt.title}</div>
                                                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                                                        {gt.examType} • {gt.questions?.length || 0} Questions
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {selectedGTId && (
                                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, padding: '4px 10px', background: '#ecfdf5', borderRadius: 6 }}>
                                            ✅ Grand Test selected — use button below to create exam from this GT.
                                        </div>
                                    )}
                                    <div style={{ textAlign: 'center', margin: '10px 0', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>— OR select individual teacher papers below —</div>
                                </div>
                            )}

                            <div style={styles.paperList}>
                                {papers.map(p => {
                                    const selected = mergeForm.paperIds.includes(p._id);
                                    return (
                                        <div key={p._id} style={{ ...styles.paperItem, ...(selected ? styles.paperItemSelected : {}) }}
                                            onClick={() => togglePaper(p._id)}>
                                            <div style={styles.paperCheck}>{selected ? '✅' : '⬜'}</div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{p.title}</div>
                                                <div style={styles.paperMeta}>{p.subject} • {new Date(p.createdAt).toLocaleDateString()} • {p.questions?.length || 0} Q</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {papers.length === 0 && <div style={{ color: '#9ca3af', padding: 16 }}>No approved papers found.</div>}
                            </div>

                            <label style={styles.label}>Custom Instructions (optional)</label>
                            <textarea style={{ ...styles.input, height: 80 }} placeholder="Leave blank for default instructions"
                                value={mergeForm.instructions}
                                onChange={e => setMergeForm(f => ({ ...f, instructions: e.target.value }))} />
                        </div>
                        <div style={styles.modalFooter}>
                            <button style={styles.cancelBtn} onClick={() => setShowMergeModal(false)}>Cancel</button>
                            {selectedGTId ? (
                                <button style={styles.primaryBtn} onClick={handleCreateFromGT} disabled={loading}>
                                    {loading ? 'Creating...' : '📋 Create Exam from GT'}
                                </button>
                            ) : (
                                <button style={styles.primaryBtn} onClick={handleMerge} disabled={loading || mergeForm.paperIds.length === 0}>
                                    {loading ? 'Merging...' : '🔀 Merge & Create Exam'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {showConfigModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <h3>⚙️ Configure Exam</h3>
                            <button style={styles.closeBtn} onClick={() => setShowConfigModal(null)}>✕</button>
                        </div>
                        <div style={styles.modalBody}>
                            <label style={styles.label}>Status</label>
                            <select style={styles.input} value={configForm.status}
                                onChange={e => setConfigForm(f => ({ ...f, status: e.target.value }))}>
                                {['draft', 'scheduled', 'live', 'ended'].map(s => <option key={s}>{s}</option>)}
                            </select>
                            <label style={styles.label}>Start Time</label>
                            <input style={styles.input} type="datetime-local" value={configForm.start_time}
                                onChange={e => {
                                    const st = e.target.value;
                                    const et = calculateEndTime(st, configForm.duration_minutes);
                                    setConfigForm(f => ({ ...f, start_time: st, end_time: et }));
                                }} />
                            <label style={styles.label}>End Time</label>
                            <input style={styles.input} type="datetime-local" value={configForm.end_time}
                                onChange={e => setConfigForm(f => ({ ...f, end_time: e.target.value }))} />
                            
                            <label style={styles.label}>Allowed Students (Roll Numbers, comma separated)</label>
                            <input style={styles.input} placeholder="Leave blank to allow all students" value={configForm.allowedStudents}
                                onChange={e => setConfigForm(f => ({ ...f, allowedStudents: e.target.value }))} />

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 16 }}>
                                <input 
                                    type="checkbox" 
                                    id="shuffleQuestionsEdit"
                                    checked={configForm.shuffleQuestions || false}
                                    onChange={e => setConfigForm(f => ({ ...f, shuffleQuestions: e.target.checked }))}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="shuffleQuestionsEdit" style={{ fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                    🔀 Shuffle Questions (Randomizes question order per student session to prevent lab screen copying)
                                </label>
                            </div>

                            <label style={styles.label}>Duration (minutes)</label>
                            <input style={styles.input} type="number" value={configForm.duration_minutes}
                                onChange={e => {
                                    const dm = Number(e.target.value);
                                    const et = calculateEndTime(configForm.start_time, dm);
                                    setConfigForm(f => ({ ...f, duration_minutes: dm, end_time: et }));
                                }} />
                            <label style={styles.label}>Instructions</label>
                            <textarea style={{ ...styles.input, height: 120 }} value={configForm.instructions}
                                onChange={e => setConfigForm(f => ({ ...f, instructions: e.target.value }))} />
                        </div>
                        <div style={styles.modalFooter}>
                            <button style={styles.cancelBtn} onClick={() => setShowConfigModal(null)}>Cancel</button>
                            <button style={styles.primaryBtn} onClick={handleConfigSave} disabled={loading}>
                                {loading ? 'Saving...' : '💾 Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
