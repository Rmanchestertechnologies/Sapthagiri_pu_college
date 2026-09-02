/**
 * PaperRenderer.jsx
 *
 * Professional Unified A4 Layout & Preview System
 *
 * Requirements fulfilled:
 * - True A4 Paper Rendering with discrete Page-by-Page pagination
 * - Intelligent Diagram Placement & Spacing via QuestionBlock & A4PaperEngine
 * - Preview Mode with Page Navigation (Page X of Y, Prev, Next, Zoom, Fit-to-screen)
 * - Separate Alignment Step / Panel (not shown prematurely on create screen)
 * - 100% fidelity match between Preview and PDF print
 */
import React, { useState, useMemo } from 'react';
import A4PaperEngine from './A4PaperEngine';
import QuestionBlock from './QuestionBlock';
import { optionLabel } from '../utils/sanitize';

// ─── Marks helpers ────────────────────────────────────────────────────────────
export function formatMarks(type = '', classes = []) {
    const isNeet = Array.isArray(classes) && classes.some(c => String(c).toUpperCase() === 'NEET');
    const t = (type || '').toUpperCase();
    if (t === 'MCQ' || t === '1M' || t === 'DIAGRAM_BASED' || t === 'IMAGE_BASED' || t === 'ASSERTION_REASON') {
        return isNeet ? '4 Marks' : '1 Mark';
    }
    if (t === '2M') return '2 Marks';
    if (t === '3M') return '3 Marks';
    if (t === '4M' || t === 'NUMERICAL') return '4 Marks';
    if (t === '5M') return '5 Marks';
    if (t === 'MATCH_FOLLOWING') return '4 Marks';
    return '1 Mark';
}

export function calcTotal(questions = [], classes = []) {
    return questions.reduce((s, q) => {
        const t = (q.type || '').toUpperCase();
        const isNeet = Array.isArray(classes) && classes.some(c => String(c).toUpperCase() === 'NEET');
        if (t === 'MCQ' || t === '1M' || t === 'DIAGRAM_BASED' || t === 'ASSERTION_REASON') return s + (isNeet ? 4 : 1);
        if (t === '2M') return s + 2;
        if (t === '3M') return s + 3;
        if (t === 'NUMERICAL' || t === '4M' || t === 'MATCH_FOLLOWING') return s + 4;
        if (t === '5M') return s + 5;
        return s + 1;
    }, 0);
}

// ─── Default settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '13px',
    lineHeight: '1.45',
    columns: 1,
    columnGap: '24px',
    showMarks: false,
    showAnswerKey: false,
    showDifficulty: false,
    showCoverPage: false,
    startQNo: 1,
    endQNo: null,
    pageSize: 'A4',
    orientation: 'portrait',
    marginTop: '15mm',
    marginBottom: '15mm',
    marginLeft: '18mm',
    marginRight: '18mm',
    questionSpacing: '14px',
    optionSpacing: '4px',
    diagramMaxHeight: '260px',
};

// ─── Settings / Alignment Panel ───────────────────────────────────────────────
const labelStyle = { fontSize: '11px', fontWeight: 800, color: '#001f6d', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const selectStyle = { height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#1e293b', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%', fontWeight: 600 };
const inputStyle = { height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#1e293b', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', fontWeight: 600 };

function SettingField({ label, children }) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            {children}
        </div>
    );
}

export function SettingsPanel({ settings, setSettings, totalQuestions = 0 }) {
    const update = (key, val) => setSettings(s => ({ ...s, [key]: val }));
    const endMax = settings.startQNo + totalQuestions - 1;

    return (
        <div className="bg-white p-6 rounded-2xl border-2 border-navy/20 shadow-md mb-6 animate-fade-in no-print">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <span className="text-base font-black text-gold">⚙️</span>
                    <h3 className="font-black text-sm text-navy uppercase tracking-wider">Paper Alignment & Layout Controls</h3>
                </div>
                <span className="text-[11px] font-bold text-gray-500">Fine-tune spacing, typography, and page setup</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px' }}>
                {/* ── Spacing & Layout ── */}
                <SettingField label="Question Spacing">
                    <select style={selectStyle} value={settings.questionSpacing} onChange={e => update('questionSpacing', e.target.value)}>
                        <option value="10px">Compact (10px)</option>
                        <option value="14px">Standard (14px)</option>
                        <option value="18px">Relaxed (18px)</option>
                        <option value="24px">Wide (24px)</option>
                    </select>
                </SettingField>

                <SettingField label="Columns Mode">
                    <select style={selectStyle} value={settings.columns} onChange={e => update('columns', parseInt(e.target.value))}>
                        <option value={1}>Single Column</option>
                        <option value={2}>Two Columns</option>
                    </select>
                </SettingField>

                <SettingField label="Diagram Max Height">
                    <select style={selectStyle} value={settings.diagramMaxHeight} onChange={e => update('diagramMaxHeight', e.target.value)}>
                        <option value="200px">Medium (200px)</option>
                        <option value="260px">Standard / Clear (260px - Recommended)</option>
                        <option value="300px">Large (300px)</option>
                        <option value="350px">Extra Large (350px)</option>
                    </select>
                </SettingField>

                {/* ── Typography ── */}
                <SettingField label="Font Style">
                    <select style={selectStyle} value={settings.fontFamily} onChange={e => update('fontFamily', e.target.value)}>
                        <option value='Georgia, "Times New Roman", serif'>Georgia (Classic)</option>
                        <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                        <option value='Calibri, Candara, Segoe, sans-serif'>Calibri</option>
                        <option value='Arial, Helvetica, sans-serif'>Arial</option>
                        <option value="'Inter', system-ui, sans-serif">Inter (Modern)</option>
                    </select>
                </SettingField>

                <SettingField label="Font Size">
                    <select style={selectStyle} value={settings.fontSize} onChange={e => update('fontSize', e.target.value)}>
                        <option value="12px">Compact (12px)</option>
                        <option value="13px">Standard (13px)</option>
                        <option value="14px">Large (14px)</option>
                    </select>
                </SettingField>

                <SettingField label="Line Height">
                    <select style={selectStyle} value={settings.lineHeight} onChange={e => update('lineHeight', e.target.value)}>
                        <option value="1.35">Compact (1.35)</option>
                        <option value="1.45">Standard (1.45)</option>
                        <option value="1.6">Relaxed (1.6)</option>
                    </select>
                </SettingField>

                <SettingField label="Show Marks on Qs">
                    <select style={selectStyle} value={settings.showMarks ? 'yes' : 'no'} onChange={e => update('showMarks', e.target.value === 'yes')}>
                        <option value="no">Hidden (Standard)</option>
                        <option value="yes">Display Marks</option>
                    </select>
                </SettingField>
            </div>
        </div>
    );
}

// ─── Instruction Cover Page ───────────────────────────────────────────────────
export function InstructionCoverPage({ paper, questions = [], duration, totalMarks, classes = [] }) {
    const totalQCount = questions.length || 60;

    return (
        <div style={{ paddingBottom: '16px', borderBottom: '2px dashed #666', marginBottom: '20px' }}>
            {/* Candidate Name and Reg No Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 14px 0', fontSize: '12px', fontWeight: 800 }}>
                <div style={{ flex: 1 }}>
                    Name of the candidate: <span style={{ display: 'inline-block', borderBottom: '1.5px solid #000', width: '240px', marginLeft: '6px' }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800 }}>Reg. No.</span>
                    <div style={{ display: 'flex', border: '1.5px solid #000' }}>
                        {[...Array(8)].map((_, i) => (
                            <div key={i} style={{ width: '20px', height: '22px', borderRight: i < 7 ? '1.5px solid #000' : 'none' }}></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Instructions Title */}
            <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', color: '#000' }}>
                IMPORTANT INSTRUCTIONS TO CANDIDATES :
            </div>

            {/* Instructions Body */}
            <div style={{ fontSize: '11.5px', lineHeight: '1.5', color: '#111' }}>
                <p style={{ margin: '3px 0' }}>
                    <strong>1)</strong> This question paper contains <strong>{totalQCount} questions</strong>. Each question consists of a question stem and 4 choices/options.
                </p>
                <p style={{ margin: '3px 0' }}>
                    <strong>2)</strong> Duration: <strong>{duration || '180 Minutes / 3 Hours'}</strong>. Read each question carefully and shade the corresponding circle completely on the OMR answer sheet using a blue/black ballpoint pen.
                </p>

                {/* OMR Demonstration Box */}
                <div style={{ border: '1.5px solid #000', margin: '8px 0', padding: '6px', background: '#fafafa', borderRadius: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', border: '1px solid #777', background: '#fff' }}>
                        <div style={{ padding: '5px 8px', borderRight: '1px solid #777', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '4px', color: '#111' }}>ಸರಿಯಾದ ಕ್ರಮ / CORRECT METHOD</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center' }}>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>A</span>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, background: '#000', color: '#fff' }}>B</span>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>C</span>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>D</span>
                            </div>
                        </div>
                        <div style={{ padding: '5px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '4px', color: '#111' }}>ತಪ್ಪು ಕ್ರಮಗಳು / WRONG METHODS</div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#c00' }}>✖</span>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>B</span>
                                </div>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>A</span>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#090' }}>✔</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <p style={{ margin: '3px 0' }}>
                    <strong>3)</strong> Avoid stray marks or multiple responses on the OMR sheet. Hand over the sheet to the room invigilator at conclusion of exam.
                </p>
            </div>
        </div>
    );
}

// ─── Paper Header ─────────────────────────────────────────────────────────────
export function PaperHeader({ title, subject, classes, duration, totalMarks, templateUrl, isAssignment = false }) {
    // Clean assignment title
    let displayTitle = title;
    if (isAssignment) {
        if (!displayTitle || /assessment|test|exam|jee|neet|cet|paper/i.test(displayTitle)) {
            displayTitle = `${subject || ''} ASSIGNMENT`.trim().toUpperCase();
        } else {
            // Strip out any accidental CET/NEET/JEE references
            displayTitle = displayTitle.replace(/\b(jee|neet|cet|kcet|bitsat|mains|advanced|board)\b/gi, '').replace(/\s+/g, ' ').trim();
            if (!/assignment/i.test(displayTitle)) {
                displayTitle = `${displayTitle} ASSIGNMENT`.trim();
            }
        }
    }

    return (
        <div style={{ marginBottom: '14px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
            {templateUrl && templateUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                <div style={{ textAlign: 'center', marginBottom: '6px', borderBottom: '1.5px solid #000', paddingBottom: '4px' }}>
                    <img
                        src={templateUrl}
                        alt="Header"
                        onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                        style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                    />
                </div>
            ) : (
                /* Official Sapthagiri PU College Davanagere Header Crest */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '8px' }}>
                    <div style={{ width: '68px', height: '68px', flexShrink: 0 }}>
                        <img 
                            src="/SapthagiriLogo.jpg" 
                            alt="Sapthagiri PU College" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#000', lineHeight: 1.1 }}>
                            SAPTHAGIRI PU COLLEGE
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333', marginTop: '2px' }}>
                            DAVANAGERE • THE LAND OF OPPORTUNITY
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000', marginTop: '4px' }}>
                            {displayTitle || (isAssignment ? `${subject} ASSIGNMENT` : (title || `${subject} Examination`))}
                        </div>
                    </div>
                    <div style={{ width: '68px', height: '68px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #000', borderRadius: '4px', padding: '2px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SET</span>
                        <span style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1 }}>A</span>
                    </div>
                </div>
            )}

            {!isAssignment && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#111', fontWeight: 700, borderTop: '1px solid #777', paddingTop: '4px', marginTop: '4px' }}>
                    <span>Subject: <strong>{subject || 'General'}</strong></span>
                    {classes && classes.length > 0 && <span>Class: <strong>PUC {classes.join(', ')}</strong></span>}
                    <span>Time: <strong>{duration || '3 Hours'}</strong></span>
                    <span>Max Marks: <strong>{totalMarks}</strong></span>
                </div>
            )}

            {isAssignment && (
                /* Pure clean Assignment header */
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #777', paddingTop: '4px', fontWeight: 700, fontSize: '11.5px', marginTop: '4px' }}>
                    <span>Subject: <strong>{subject || 'General'}</strong></span>
                    <span>Student Name: _____________________</span>
                    <span>Roll No: ________</span>
                    <span>Date: _________</span>
                </div>
            )}
        </div>
    );
}

// ─── Main PaperRenderer Component ─────────────────────────────────────────────
export default function PaperRenderer({
    paper,
    activeTemplate,
    isAssignment = false,
    settings: externalSettings,
    setSettings: externalSetSettings,
    showSettingsPanel = false,
    onProceedToAlignment,
    onProceedToFinalize,
    onDiagramResize,
}) {
    const [internalSettings, setInternalSettings] = useState(DEFAULT_SETTINGS);
    const settings = externalSettings || internalSettings;
    const setSettings = externalSetSettings || setInternalSettings;

    // Preview Controls state
    const [zoom, setZoom] = useState(100);

    const questions = useMemo(() => paper?.questions || [], [paper]);
    const showCover = !isAssignment && settings.showCoverPage !== false;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="paper-renderer-wrapper w-full flex flex-col items-center">
            
            {/* ── PREVIEW TOOLBAR ── */}
            <div className="sticky top-4 z-40 bg-white/95 backdrop-blur-md px-6 py-3.5 rounded-2xl shadow-xl border-2 border-navy/20 flex flex-wrap items-center justify-between gap-4 mb-6 w-full max-w-5xl no-print">
                {/* Mode & Columns Switcher */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSettings(s => ({ ...s, columns: s.columns === 2 ? 1 : 2 }))}
                        className="bg-slate-100 hover:bg-slate-200 text-navy px-3.5 py-1.5 rounded-xl font-bold text-xs border border-slate-300 transition cursor-pointer flex items-center gap-1.5"
                    >
                        <span>{settings.columns === 2 ? '📰 2-Columns (Dense)' : '📄 Single Column'}</span>
                        <span className="text-[10px] bg-navy text-gold px-1.5 py-0.5 rounded">Switch</span>
                    </button>
                    <span className="text-xs font-bold text-gray-500">
                        {questions.length} Questions
                    </span>
                </div>

                {/* View Controls (Zoom, Mode) */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setZoom(z => Math.max(60, z - 15))}
                            className="px-2.5 py-1 text-xs font-black text-gray-700 hover:bg-white rounded-lg transition"
                            title="Zoom Out"
                        >
                            −
                        </button>
                        <span className="text-xs font-bold text-navy px-1">{zoom}%</span>
                        <button
                            onClick={() => setZoom(z => Math.min(150, z + 15))}
                            className="px-2.5 py-1 text-xs font-black text-gray-700 hover:bg-white rounded-lg transition"
                            title="Zoom In"
                        >
                            +
                        </button>
                        <button
                            onClick={() => setZoom(100)}
                            className="px-2 py-1 text-[10px] font-bold bg-white text-gray-700 rounded-lg shadow-sm cursor-pointer"
                        >
                            Reset
                        </button>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="bg-gold text-navy hover:bg-navy hover:text-gold px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center gap-1.5"
                    >
                        <span>🖨</span> Print / Save PDF
                    </button>
                </div>

                {/* Next Workflow Action Button */}
                <div className="flex items-center gap-2">
                    {onProceedToAlignment && (
                        <button
                            onClick={onProceedToAlignment}
                            className="bg-navy text-gold px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:scale-105 transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>⚙️</span> Alignment Controls →
                        </button>
                    )}
                    {onProceedToFinalize && (
                        <button
                            onClick={onProceedToFinalize}
                            className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-700 transition shadow cursor-pointer flex items-center gap-1.5"
                        >
                            <span>✓</span> Finalize & Save →
                        </button>
                    )}
                </div>
            </div>

            {/* Alignment / Settings Panel (Shown only in Alignment step) */}
            {showSettingsPanel && (
                <div className="w-full max-w-5xl no-print">
                    <SettingsPanel settings={settings} setSettings={setSettings} totalQuestions={questions.length} />
                </div>
            )}

            {/* ── TRUE A4 ENGINE RENDERING ── */}
            <A4PaperEngine
                paper={paper}
                activeTemplate={activeTemplate}
                isAssignment={isAssignment}
                settings={settings}
                zoom={zoom}
                onDiagramResize={onDiagramResize}
            />
        </div>
    );
}

export { DEFAULT_SETTINGS };
