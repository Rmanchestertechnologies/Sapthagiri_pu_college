import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize, optionLabel } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';

const EXAM_TYPES = ['JEE', 'NEET', 'CET'];
const STATUS_COLORS = {
    draft: '#6b7280',
    scheduled: '#f59e0b',
    live: '#10b981',
    ended: '#ef4444'
};

const getOptionsGridStyle = (options) => {
    if (!options || options.length === 0) {
        return {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '8px 24px',
            marginTop: '8px',
            marginLeft: '24px',
            fontSize: '0.95em'
        };
    }
    
    let hasComplexFormula = false;
    const cleanLengths = options.map(opt => {
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || '') : (opt || ''));
        const clean = str.replace(/<[^>]+>/g, '').trim();
        if (/(\$|\\\[|\\\(|\\frac|\\sqrt|\\int|\\rightarrow|\||\^|_)/i.test(clean)) {
            if (clean.length > 12 || clean.includes('|') || clean.includes('\\rightarrow') || clean.includes('\\frac')) {
                hasComplexFormula = true;
            }
        }
        return clean.length;
    });

    if (hasComplexFormula) {
        return {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '8px 24px',
            marginTop: '8px',
            marginLeft: '24px',
            fontSize: '0.95em'
        };
    }
    
    const maxLength = Math.max(...cleanLengths);
    const totalLength = cleanLengths.reduce((a, b) => a + b, 0);
    
    let columns = '1fr';
    let gap = '10px 24px';
    
    if (maxLength <= 10 && totalLength <= 40) {
        columns = '1fr 1fr 1fr 1fr';
        gap = '8px 16px';
    } else if (maxLength <= 28 && totalLength <= 90) {
        columns = '1fr 1fr';
        gap = '8px 24px';
    }
    
    return {
        display: 'grid',
        gridTemplateColumns: columns,
        gap: gap,
        marginTop: '8px',
        marginLeft: '24px',
        fontSize: '0.95em'
    };
};

// ─── Exam Live Countdown Component ───
function ExamCountdown({ startTime, endTime, status, onZero }) {
    const [timeLeft, setTimeLeft] = useState('');
    const hasTriggered = useRef(false);

    useEffect(() => {
        hasTriggered.current = false;
    }, [startTime, endTime, status]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date().getTime();
            if (status === 'scheduled' && startTime) {
                const start = new Date(startTime).getTime();
                const diff = start - now;
                if (diff <= 0) {
                    setTimeLeft('00:00:00');
                    if (onZero && !hasTriggered.current) {
                        hasTriggered.current = true;
                        onZero();
                    }
                } else {
                    setTimeLeft(formatDuration(diff));
                }
            } else if (status === 'live' && endTime) {
                const end = new Date(endTime).getTime();
                const diff = end - now;
                if (diff <= 0) {
                    setTimeLeft('00:00:00');
                    if (onZero && !hasTriggered.current) {
                        hasTriggered.current = true;
                        onZero();
                    }
                } else {
                    setTimeLeft(formatDuration(diff));
                }
            }
        };

        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, [startTime, endTime, status, onZero]);

    const formatDuration = (ms) => {
        const totalSecs = Math.floor(ms / 1000);
        const secs = totalSecs % 60;
        const totalMins = Math.floor(totalSecs / 60);
        const mins = totalMins % 60;
        const totalHours = Math.floor(totalMins / 60);
        const hours = totalHours % 24;
        const days = Math.floor(totalHours / 24);

        let str = '';
        if (days > 0) str += `${days}d `;
        str += `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        return str;
    };

    if (status === 'scheduled') {
        return <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, marginTop: 6 }}>⏳ Starts in: {timeLeft}</div>;
    }
    if (status === 'live') {
        return <div style={{ color: '#10b981', fontSize: 13, fontWeight: 600, marginTop: 6 }}>🟢 Live (Ends in: {timeLeft})</div>;
    }
    return null;
}

// ─── Exam Custom Print Preview Component ───
function ExamPrintView({ exam, templates, settings, setSettings, onBack }) {
    const activeTemplate = templates.find(t => t._id === settings.selectedTemplateId);

    const formatMarks = (type) => {
        if (type === 'MCQ' || type === '1m') return '4 Marks';
        if (type === '2m') return '2 Marks';
        if (type === '3m') return '3 Marks';
        if (type === '4m') return '4 Marks';
        if (type === '5m') return '5 Marks';
        return type;
    };

    const handleWordExport = () => {
        const token = localStorage.getItem('token');
        const downloadUrl = `${api.defaults.baseURL || ''}/api/exams/${exam._id}/export-word?token=${token}`;
        window.open(downloadUrl, '_blank');
    };

    const seededShuffle = (arr, seed) => {
        let m = arr.length, t, i;
        let seedNum = 0;
        for (let charIdx = 0; charIdx < seed.length; charIdx++) {
            seedNum += seed.charCodeAt(charIdx);
        }
        const random = () => {
            let x = Math.sin(seedNum++) * 10000;
            return x - Math.floor(x);
        };
        const shuffled = [...arr];
        while (m) {
            i = Math.floor(random() * m--);
            t = shuffled[m];
            shuffled[m] = shuffled[i];
            shuffled[i] = t;
        }
        return shuffled;
    };

    const getProcessedQuestions = () => {
        if (!exam || !exam.questions) return [];
        const activeSet = settings.activeSet || 'Standard';
        
        const subjects = {};
        exam.questions.forEach(q => {
            const sub = q.subject || 'Default';
            if (!subjects[sub]) subjects[sub] = [];
            subjects[sub].push(q);
        });

        let processed = [];
        Object.keys(subjects).forEach(sub => {
            const list = subjects[sub];
            const shuffled = activeSet !== 'Standard'
                ? seededShuffle(list, `${activeSet}-${exam._id}-${sub}`)
                : list;
            processed = processed.concat(shuffled);
        });

        return processed;
    };

    const processedQuestions = getProcessedQuestions();

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Settings Toolbar (hidden on print) */}
            <div className="no-print" style={printViewStyles.toolbar}>
                <div style={printViewStyles.toolbarHeader}>
                    <button style={styles.cancelBtn} onClick={onBack}>← Back to Exams</button>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                            style={{ ...styles.actionBtn, background: settings.showSettings ? '#4f46e5' : '#e5e7eb', color: settings.showSettings ? '#fff' : '#374151' }} 
                            onClick={() => setSettings(s => ({ ...s, showSettings: !s.showSettings }))}
                        >
                            ⚙️ Print Settings
                        </button>
                        <button style={{ ...styles.actionBtn, background: '#10b981' }} onClick={() => window.print()}>
                            🖨️ Print / Save PDF
                        </button>
                    </div>
                </div>

                {settings.showSettings && (
                    <div style={printViewStyles.settingsGrid}>
                        <div>
                            <label style={printViewStyles.label}>Font Style</label>
                            <select 
                                style={styles.input} 
                                value={settings.fontFamily}
                                onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                            >
                                <option value='Georgia, serif'>Classic Serif (Georgia)</option>
                                <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                                <option value='Cambria, Georgia, serif'>Cambria</option>
                                <option value='Calibri, Candara, Segoe, sans-serif'>Calibri</option>
                                <option value='Arial, Helvetica, sans-serif'>Arial</option>
                                <option value="'Inter', sans-serif">Modern Sans (Inter)</option>
                                <option value="'JetBrains Mono', monospace">Technical Mono</option>
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Font Size</label>
                            <select 
                                style={styles.input} 
                                value={settings.fontSize}
                                onChange={e => setSettings(s => ({ ...s, fontSize: e.target.value }))}
                            >
                                <option value="12px">Small (12px)</option>
                                <option value="14px">Standard (14px)</option>
                                <option value="16px">Large (16px)</option>
                                <option value="18px">X-Large (18px)</option>
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Line Spacing</label>
                            <select 
                                style={styles.input} 
                                value={settings.lineHeight}
                                onChange={e => setSettings(s => ({ ...s, lineHeight: e.target.value }))}
                            >
                                <option value="1.2">Compact (1.2)</option>
                                <option value="1.5">Standard (1.5)</option>
                                <option value="2.0">Double (2.0)</option>
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Page Layout</label>
                            <select 
                                style={styles.input} 
                                value={settings.columns}
                                onChange={e => setSettings(s => ({ ...s, columns: parseInt(e.target.value) }))}
                            >
                                <option value={1}>Single Column</option>
                                <option value={2}>Two Columns (Double Qs)</option>
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Show Marks</label>
                            <select 
                                style={styles.input} 
                                value={settings.showMarks ? 'yes' : 'no'}
                                onChange={e => setSettings(s => ({ ...s, showMarks: e.target.value === 'yes' }))}
                            >
                                <option value="yes">Yes (Show)</option>
                                <option value="no">No (Hide)</option>
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Header Template</label>
                            <select 
                                style={styles.input} 
                                value={settings.selectedTemplateId}
                                onChange={e => setSettings(s => ({ ...s, selectedTemplateId: e.target.value }))}
                            >
                                <option value="">No Template (Plain Title)</option>
                                {templates.map(t => (
                                    <option key={t._id} value={t._id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Offline Set-Shuffling</label>
                            <select 
                                style={styles.input} 
                                value={settings.numSets || 4}
                                onChange={e => setSettings(s => ({ ...s, numSets: parseInt(e.target.value), activeSet: 'Standard' }))}
                            >
                                <option value={2}>2 Sets (A, B)</option>
                                <option value={3}>3 Sets (A, B, C)</option>
                                <option value={4}>4 Sets (P, Q, R, S)</option>
                                <option value={5}>5 Sets (A, B, C, D, E)</option>
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Active Print Set</label>
                            <select 
                                style={styles.input} 
                                value={settings.activeSet || 'Standard'}
                                onChange={e => setSettings(s => ({ ...s, activeSet: e.target.value }))}
                            >
                                <option value="Standard">Standard (Unshuffled)</option>
                                {(() => {
                                    const count = settings.numSets || 4;
                                    const getSetNames = (c) => {
                                        if (c === 4) return ['P', 'Q', 'R', 'S'];
                                        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                                        return alphabet.split('').slice(0, c);
                                    };
                                    return getSetNames(count).map(setLetter => (
                                        <option key={setLetter} value={setLetter}>Set {setLetter}</option>
                                    ));
                                })()}
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Print Layout Type</label>
                            <select 
                                style={styles.input} 
                                value={settings.printOMRSheet ? 'omr' : 'questions'}
                                onChange={e => setSettings(s => ({ ...s, printOMRSheet: e.target.value === 'omr' }))}
                            >
                                <option value="questions">Questions Paper Only</option>
                                <option value="omr">OMR Bubble Answer Sheet</option>
                            </select>
                        </div>
                        <div>
                            <label style={printViewStyles.label}>Dual-Language Mode</label>
                            <select 
                                style={styles.input} 
                                value={settings.bilingualMode ? 'bilingual' : 'english'}
                                onChange={e => setSettings(s => ({ ...s, bilingualMode: e.target.value === 'bilingual' }))}
                            >
                                <option value="english">English Version Only</option>
                                <option value="bilingual">Bilingual Side-by-Side</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 3', marginTop: '12px' }}>
                            <label style={printViewStyles.label}>Print Sheet Instructions</label>
                            <textarea 
                                style={{ ...styles.input, width: '100%', height: '80px', fontFamily: 'inherit', resize: 'vertical' }} 
                                value={settings.instructions || ''}
                                onChange={e => setSettings(s => ({ ...s, instructions: e.target.value }))}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Print Area */}
            <div className="print-area" style={{
                background: '#fff', padding: '48px 56px',
                maxWidth: '1000px', margin: '0 auto',
                border: '1px solid #e2e8f0', borderRadius: '12px',
                fontFamily: settings.fontFamily, fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                color: '#000',
                position: 'relative'
            }}>
                {/* Watermark */}
                {activeTemplate?.watermarkText && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(-45deg)',
                        fontSize: '5rem',
                        fontWeight: 'bold',
                        color: 'rgba(0, 0, 0, 0.04)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        zIndex: 0,
                        whiteSpace: 'nowrap'
                    }}>
                        {activeTemplate.watermarkText}
                    </div>
                )}

                {/* Custom Institutional Header Layout */}
                {activeTemplate && (activeTemplate.institutionName || activeTemplate.headerText) ? (
                    <div style={{ marginBottom: '24px', borderBottom: '4px double #000', paddingBottom: '12px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                        {activeTemplate.fileUrl && (
                            <img src={activeTemplate.fileUrl} alt="Logo" style={{ maxHeight: '80px', objectFit: 'contain', margin: '0 auto 8px block' }} />
                        )}
                        {activeTemplate.institutionName && (
                            <h2 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 4px' }}>
                                {activeTemplate.institutionName} {settings.activeSet && settings.activeSet !== 'Standard' && `— SET ${settings.activeSet}`}
                            </h2>
                        )}
                        {activeTemplate.address && (
                            <p style={{ fontSize: '12px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{activeTemplate.address}</p>
                        )}
                        {activeTemplate.headerText && (
                            <h3 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', borderTop: '1px solid #ddd', paddingTop: '6px', margin: '8px 0 0' }}>{activeTemplate.headerText}</h3>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px', fontWeight: 700, textAlign: 'left', marginTop: '12px', borderTop: '2px solid #000', paddingTop: '10px' }}>
                            <div>Exam: <span style={{ fontWeight: 500 }}>{exam.title}</span></div>
                            <div>Exam Type: <span style={{ fontWeight: 500 }}>{exam.examType}</span></div>
                            <div>Duration: <span style={{ fontWeight: 500 }}>{exam.duration_minutes} mins</span></div>
                            <div>Questions: <span style={{ fontWeight: 500 }}>{exam.questions?.length || 0}</span></div>
                        </div>
                    </div>
                ) : (
                    /* Fallback to simple title/image logo header */
                    <>
                        {activeTemplate?.fileUrl?.match(/\.(jpeg|jpg|gif|png)$/i) && (
                            <div style={{ marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '16px', textAlign: 'center', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
                                <img src={activeTemplate.fileUrl} alt="Header" style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', margin: '0 auto', display: 'block' }} />
                            </div>
                        )}

                        <div style={{ marginBottom: '24px', position: 'relative', zIndex: 10 }}>
                            <div style={{ textAlign: 'center' }}>
                                <h1 style={{ fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                    {exam.title} {settings.activeSet && settings.activeSet !== 'Standard' && `— SET ${settings.activeSet}`}
                                </h1>
                                <p style={{ marginTop: '6px', color: '#333', fontWeight: 500 }}>Exam Type: {exam.examType} &nbsp;|&nbsp; Duration: {exam.duration_minutes} minutes</p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderBottom: '2px solid #000', paddingBottom: '8px', fontWeight: 700, fontSize: '15px' }}>
                                <span>Time: {exam.duration_minutes} mins</span>
                                <span>Total Questions: {exam.questions?.length || 0}</span>
                            </div>
                        </div>
                    </>
                )}

                {settings.printOMRSheet ? (
                    <div className="relative z-10 mt-8 text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '12px', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                                {activeTemplate?.institutionName || 'OMR ANSWER RESPONSE SHEET'}
                            </h3>
                            <p style={{ fontSize: '13px', fontWeight: 700, margin: '4px 0 0' }}>
                                EXAM: {exam.title.toUpperCase()} {settings.activeSet && settings.activeSet !== 'Standard' && `— SET ${settings.activeSet}`}
                            </p>
                        </div>

                        {/* Candidate Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            {/* Left Box: Name & Details */}
                            <div style={{ border: '2px solid #000', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Candidate Name (In Block Letters)</label>
                                    <div style={{ borderBottom: '1.5px solid #000', height: '24px' }}></div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Student Email / Roll Number</label>
                                    <div style={{ borderBottom: '1.5px solid #000', height: '24px' }}></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Candidate Signature</label>
                                        <div style={{ border: '1.5px solid #000', height: '40px', borderRadius: '6px' }}></div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Invigilator Signature</label>
                                        <div style={{ border: '1.5px solid #000', height: '40px', borderRadius: '6px' }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Box: Roll Number Bubbles (standard 10-digit bubble grid) */}
                            <div style={{ border: '2px solid #000', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Roll Number Bubbling Grid</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {Array.from({ length: 10 }).map((_, colIdx) => (
                                        <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '16px', height: '16px', border: '1.5px solid #000', borderBottomWidth: '3px', textAlign: 'center', fontSize: '9px', fontWeight: 900, marginBottom: '2px' }}></div>
                                            {Array.from({ length: 10 }).map((_, val) => (
                                                <span key={val} style={{
                                                    width: '18px', height: '18px', border: '1px solid #000', borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
                                                    fontSize: '8px', fontWeight: 900, cursor: 'pointer'
                                                }}>{val}</span>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* OMR Question Circles Grid */}
                        <div style={{ border: '2px solid #000', borderRadius: '12px', padding: '20px', background: '#fff' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: '8px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                Mark your answers by filling the bubbles completely. Use blue/black ballpoint pen only.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 24px' }}>
                                {(() => {
                                    const items = processedQuestions || [];
                                    const colSize = Math.ceil(items.length / 4) || 1;
                                    return Array.from({ length: 4 }).map((_, colIdx) => (
                                        <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {items.slice(colIdx * colSize, (colIdx + 1) * colSize).map((q, localIdx) => {
                                                const qNum = colIdx * colSize + localIdx + 1;
                                                return (
                                                    <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700 }}>
                                                        <span style={{ minWidth: '24px', textAlign: 'right' }}>{qNum}.</span>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            {['A', 'B', 'C', 'D'].map(opt => (
                                                                <span key={opt} style={{
                                                                    width: '20px', height: '20px', border: '1px solid #000', borderRadius: '50%',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '9px', fontWeight: 900
                                                                }}>{opt}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Instructions */}
                        {(activeTemplate?.instructions || settings.instructions) && (
                            <div style={{ marginBottom: 24, fontSize: '0.9em', borderBottom: '1px solid #ddd', paddingBottom: 16, position: 'relative', zIndex: 10 }}>
                                <p style={{ fontWeight: 'bold', margin: '0 0 8px' }}>Instructions:</p>
                                <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>
                                    {activeTemplate?.instructions || settings.instructions}
                                </div>
                            </div>
                        )}

                        <div style={{ 
                            columnCount: settings.columns, 
                            columnGap: '40px', 
                            columnRule: settings.columns > 1 ? '1px solid #eee' : 'none' 
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {processedQuestions?.map((q, idx) => (
                                    <div key={q._id || idx} style={{ color: '#111', breakInside: 'avoid-column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, paddingRight: '16px' }}>
                                                <span style={{ fontWeight: 700, marginRight: '8px', whiteSpace: 'nowrap', fontSize: '1.1em' }}>{idx + 1}.</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: settings.bilingualMode ? '1fr 1fr' : '1fr', gap: '20px' }}>
                                                        <div>
                                                            <MathRenderer style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', fontSize: '1em', margin: 0 }} text={q.questionText} />
                                                        </div>
                                                        {settings.bilingualMode && (
                                                            <div style={{ borderLeft: '1.5px dashed #ccc', paddingLeft: '20px' }}>
                                                                <MathRenderer style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', fontSize: '1em', margin: 0, color: '#374151', fontFamily: 'sans-serif', fontStyle: 'italic' }} text={q.questionTextTranslation || '<span style="font-size:11px;color:#9ca3af">[No Translation]</span>'} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {q.imageUrl && (
                                                        <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                                                            <img src={q.imageUrl} alt="Diagram" style={{ maxWidth: '70%', maxHeight: '130px', objectFit: 'contain' }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {settings.showMarks && <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.9em' }}>[{formatMarks(q.type)}]</span>}
                                        </div>
                                        {q.options && q.options.length > 0 && (
                                            <div style={getOptionsGridStyle(q.options)}>
                                                {q.options.map((opt, i) => (
                                                    <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline' }}>
                                                        <span style={{ marginRight: '6px', fontWeight: 600 }}>{optionLabel(i, q.classes)})</span>
                                                        <MathRenderer inline={true} text={opt} />
                                                        {settings.bilingualMode && q.optionsTranslation?.[i] && (
                                                            <span style={{ color: '#6b7280', fontSize: '11px', fontFamily: 'sans-serif', fontStyle: 'italic', marginLeft: '6px' }}>
                                                                / {q.optionsTranslation[i]}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div style={{ textAlign: 'center', fontWeight: 700, borderTop: '2px solid #000', paddingTop: '16px', marginTop: '48px', fontSize: '13px' }}>
                    *** End of Exam ***
                    {activeTemplate?.footerText && (
                        <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', color: '#666' }}>
                            {activeTemplate.footerText}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; border-radius: 0 !important; padding: 0 !important; margin: 0 !important; }
                    .no-print { display: none !important; }
                    @page { margin: 15mm; size: A4; }
                }
            `}</style>
        </div>
    );
}

const localToUtcIso = (localStr) => {
    if (!localStr) return null;
    const d = new Date(localStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
};

const utcToLocalStr = (utcStr) => {
    if (!utcStr) return '';
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Helper to auto-calculate end time based on start time and duration
const calculateEndTime = (startTimeStr, durationMin) => {
    if (!startTimeStr || !durationMin) return '';
    const start = new Date(startTimeStr);
    if (isNaN(start.getTime())) return '';
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = end.getFullYear();
    const mm = pad(end.getMonth() + 1);
    const dd = pad(end.getDate());
    const hh = pad(end.getHours());
    const min = pad(end.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

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
        } catch (e) { /* ignore */ }
    };

    const togglePaper = (id) => {
        setMergeForm(f => {
            if (f.paperIds.includes(id)) return { ...f, paperIds: f.paperIds.filter(p => p !== id) };
            const reqCount = f.examType === 'JEE' ? 3 : 4;
            if (f.paperIds.length >= reqCount) return f;
            return { ...f, paperIds: [...f.paperIds, id] };
        });
    };

    const handleMerge = async () => {
        if (mergeForm.paperIds.length === 0) return setMsg(`Select at least 1 paper.`);
        setLoading(true);
        try {
            const payload = {
                ...mergeForm,
                start_time: localToUtcIso(mergeForm.start_time),
                end_time: localToUtcIso(mergeForm.end_time),
                allowedStudents: mergeForm.allowedStudents ? mergeForm.allowedStudents.split(',').map(s => s.trim()).filter(Boolean) : []
            };
            await api.post('/api/exams/merge', payload);
            setMsg('✅ Exam created successfully!');
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
        } catch (e) { setMsg('Failed to load exam for print'); }
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
                <div style={{ display: 'flex', gap: 12 }}>
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
                            {exams.map(exam => (
                                <div key={exam._id} style={styles.examCard}>
                                    <div style={styles.examCardHeader}>
                                        <span style={styles.examType}>{exam.examType}</span>
                                        <span style={{ ...styles.statusBadge, background: STATUS_COLORS[exam.status] }}>
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
                                    {['scheduled', 'live'].includes(exam.status) && (
                                        <ExamCountdown 
                                            startTime={exam.start_time} 
                                            endTime={exam.end_time} 
                                            status={exam.status}
                                            onZero={fetchExams}
                                        />
                                    )}
                                    <div style={{ ...styles.examActions, marginTop: 12 }}>
                                        <button style={styles.actionBtn} onClick={() => openConfigModal(exam)}>⚙️ Configure</button>
                                        <button style={styles.actionBtn} onClick={() => copyShareLink(exam._id)}>🔗 Share Link</button>
                                        <button style={{ ...styles.actionBtn, background: '#7c3aed' }}
                                            onClick={() => window.open(`/admin/dashboard/results?examId=${exam._id}`, '_self')}>
                                            📊 Results
                                        </button>
                                        <button style={{ ...styles.actionBtn, background: '#ef4444' }} onClick={() => handleDeleteExam(exam._id)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
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
                            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                                {mergeForm.examType === 'NEET' && 'Required: Physics, Chemistry, Botany, Zoology (50 Qs each)'}
                                {mergeForm.examType === 'JEE' && 'Required: Physics, Chemistry, Mathematics (25 Qs each: 20 MCQs + 5 Numerical)'}
                                {mergeForm.examType === 'CET' && 'Required: Physics, Chemistry, Mathematics, Biology (60 Qs each)'}
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

const styles = {
    container: { padding: '24px', fontFamily: 'Inter, sans-serif', maxWidth: 1100, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 700, color: '#1e293b', margin: 0 },
    primaryBtn: { background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
    cancelBtn: { background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
    tabs: { display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e5e7eb' },
    tab: { padding: '10px 24px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: 15, color: '#6b7280', borderBottom: '2px solid transparent', marginBottom: -2 },
    tabActive: { color: '#4f46e5', borderBottom: '2px solid #4f46e5' },
    msgBar: { background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    closeMsg: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#065f46' },
    empty: { textAlign: 'center', color: '#9ca3af', padding: '60px 0', fontSize: 16 },
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
    examCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' },
    examCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    examType: { background: '#ede9fe', color: '#5b21b6', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 },
    statusBadge: { borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#fff' },
    examCardTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '6px 0 8px' },
    examMeta: { display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', marginBottom: 8 },
    examTime: { fontSize: 12, color: '#f59e0b', marginBottom: 10 },
    examActions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' },
    actionBtn: { background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#fff', borderRadius: 16, width: '90%', maxWidth: 600, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' },
    modalBody: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
    modalFooter: { display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #e5e7eb' },
    closeBtn: { background: '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, marginTop: 14 },
    input: { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
    paperList: { maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4 },
    paperItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.15s' },
    paperItemSelected: { background: '#ede9fe' },
    paperCheck: { fontSize: 18 },
    paperMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    printNote: { color: '#6b7280', marginBottom: 20 }
};

const printViewStyles = {
    toolbar: {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 24px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
    },
    toolbarHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    settingsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginTop: '16px',
        borderTop: '1px solid #f1f5f9',
        paddingTop: '16px'
    },
    label: {
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: '#475569',
        marginBottom: '6px'
    }
};
