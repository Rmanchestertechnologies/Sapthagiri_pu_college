import api from '../../../api';
import { downloadFile } from '../../../utils/downloadFile';
import { optionLabel } from '../../../utils/sanitize';
import MathRenderer from '../../../components/MathRenderer';
import ResizableDiagram from '../../../components/ResizableDiagram';
import { getOptionsGridStyle } from './examManagementUtils';
import { styles } from './styles';

// ─── Exam Custom Print Preview Component ───
export function ExamPrintView({ exam, templates, settings, setSettings, onBack }) {
    const activeTemplate = templates.find(t => t._id === settings.selectedTemplateId);

    const formatMarks = (type) => {
        if (type === 'MCQ' || type === '1m') return '4 Marks';
        if (type === '2m') return '2 Marks';
        if (type === '3m') return '3 Marks';
        if (type === '4m') return '4 Marks';
        if (type === '5m') return '5 Marks';
        return type;
    };

    const handleWordExport = async () => {
        try {
            await downloadFile(`/api/exams/${exam._id}/export-word`, `${(exam.title || 'Exam').replace(/\s+/g, '_')}.docx`);
        } catch (err) {
            alert(`Word export failed: ${err.message}`);
        }
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
                                                <span style={{ fontWeight: 400, marginRight: '8px', whiteSpace: 'nowrap', fontSize: '1em' }}>{idx + 1}.</span>
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
                                                            <ResizableDiagram src={q.imageUrl} alt="Diagram" maxWidth="380px" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {settings.showMarks && <span style={{ fontWeight: 400, whiteSpace: 'nowrap', fontSize: '1em' }}>[{formatMarks(q.type)}]</span>}
                                        </div>
                                        {q.options && q.options.length > 0 && (
                                            <div style={getOptionsGridStyle(q.options)}>
                                                {q.options.map((opt, i) => (
                                                    <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '1em', fontWeight: 400 }}>
                                                        <span style={{ marginRight: '6px', fontWeight: 400 }}>{optionLabel(i, q.classes)})</span>
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

export const printViewStyles = {
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
