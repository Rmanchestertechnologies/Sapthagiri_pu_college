// ─── Settings / Alignment Panel ───────────────────────────────────────────────
export const labelStyle = { fontSize: '11px', fontWeight: 800, color: '#001f6d', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };

export const selectStyle = { height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#1e293b', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%', fontWeight: 600 };

export const inputStyle = { height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#1e293b', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', fontWeight: 600 };

export function SettingField({ label, children }) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            {children}
        </div>
    );
}

export function SettingsPanel({
    settings,
    setSettings,
    totalQuestions = 0,
    setsActive,
    setSetsActive,
    activeSet,
    setActiveSet,
    zoom,
    setZoom,
    onBack,
    onOpenAnswerKey,
    onOpenSolutions,
    onReshuffle,
    onOpenMerge,
    onDownloadWord,
    downloadingWord,
    onPrint,
    onFinalizeSave,
    savingPaper,
}) {
    const update = (key, val) => setSettings(s => ({ ...s, [key]: val }));

    return (
        <div className="bg-white p-6 rounded-2xl border-2 border-navy/20 shadow-md mb-6 animate-fade-in no-print">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <span className="text-base font-black text-gold">⚙️</span>
                    <h3 className="font-black text-sm text-navy uppercase tracking-wider">Paper Alignment & Layout Controls</h3>
                </div>
                <span className="text-[11px] font-bold text-gray-500">Fine-tune display modes, options, spacing, and typography</span>
            </div>

            {/* ── UNIFIED ACTION BAR (Back, PQRS, AK, Sol, Shuffle, Merge, Zoom, Word, PDF, Save) ── */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 mb-5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
                {/* Left controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="bg-white hover:bg-slate-100 text-navy border border-slate-300 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition"
                        >
                            ← Back
                        </button>
                    )}

                    {/* 4-Sets PQRS */}
                    {setsActive ? (
                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-navy/30 shadow-xs">
                            <span className="text-[10px] font-black text-navy uppercase px-1">Set:</span>
                            {['P', 'Q', 'R', 'S'].map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setActiveSet && setActiveSet(s)}
                                    className={'px-2.5 py-0.5 rounded-lg text-xs font-black transition cursor-pointer ' + (activeSet === s ? 'bg-navy text-gold shadow-sm scale-105' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                                >
                                    {s}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setSetsActive && setSetsActive(false)}
                                className="text-slate-400 hover:text-red-500 text-xs px-1 rounded cursor-pointer ml-1"
                                title="Reset to Single Set"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { setSetsActive && setSetsActive(true); setActiveSet && setActiveSet('P'); }}
                            className="bg-white hover:bg-slate-100 text-navy px-3 py-1.5 rounded-xl font-black text-xs border border-slate-300 shadow-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🎲</span>
                            <span>Generate 4-Sets (P, Q, R, S)</span>
                        </button>
                    )}

                    {/* Answer Key */}
                    {onOpenAnswerKey && (
                        <button
                            type="button"
                            onClick={onOpenAnswerKey}
                            className="bg-navy text-gold hover:bg-navy/90 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-xs transition"
                        >
                            <span>🔑</span> Answer Key
                        </button>
                    )}

                    {/* Solutions */}
                    {onOpenSolutions && (
                        <button
                            type="button"
                            onClick={onOpenSolutions}
                            className="bg-navy text-gold hover:bg-navy/90 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-xs transition"
                        >
                            <span>💡</span> Solutions
                        </button>
                    )}

                    {/* Reshuffle */}
                    {onReshuffle && (
                        <button
                            type="button"
                            onClick={onReshuffle}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-xs transition"
                        >
                            <span>🔀</span> Reshuffle
                        </button>
                    )}

                    {/* Merge Exam */}
                    {onOpenMerge && (
                        <button
                            type="button"
                            onClick={onOpenMerge}
                            className="bg-gold text-navy hover:bg-amber-400 font-black px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-xs transition"
                        >
                            <span>🔗</span> Merge Exam
                        </button>
                    )}

                    {/* Zoom */}
                    {setZoom && (
                        <div className="flex items-center bg-white border border-slate-300 rounded-xl px-1.5 py-0.5 gap-1 shadow-xs">
                            <button type="button" onClick={() => setZoom(z => Math.max(60, (z || 100) - 15))} className="px-1.5 py-0.5 text-xs font-black text-gray-700 hover:bg-slate-100 rounded cursor-pointer">−</button>
                            <span className="text-xs font-bold text-navy px-1">{zoom || 100}%</span>
                            <button type="button" onClick={() => setZoom(z => Math.min(150, (z || 100) + 15))} className="px-1.5 py-0.5 text-xs font-black text-gray-700 hover:bg-slate-100 rounded cursor-pointer">+</button>
                            <button type="button" onClick={() => setZoom(100)} className="px-1 py-0.5 text-[10px] font-bold bg-slate-100 text-gray-700 rounded cursor-pointer">Reset</button>
                        </div>
                    )}

                    <span className="text-xs font-bold text-gray-500 ml-1">{totalQuestions} Questions</span>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                    {/* Word (.docx) */}
                    {onDownloadWord && (
                        <button
                            type="button"
                            onClick={onDownloadWord}
                            disabled={downloadingWord}
                            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                        >
                            <span>📝</span> {downloadingWord ? 'Exporting...' : 'Word (.docx)'}
                        </button>
                    )}

                    {/* PDF / Print */}
                    {onPrint && (
                        <button
                            type="button"
                            onClick={onPrint}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                        >
                            <span>📄</span> PDF / Print
                        </button>
                    )}

                    {/* Finalize & Save */}
                    {onFinalizeSave && (
                        <button
                            type="button"
                            onClick={onFinalizeSave}
                            disabled={savingPaper}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest px-5 py-2 rounded-xl shadow-lg flex items-center gap-1.5 border-2 border-emerald-400 hover:scale-105 transition-all cursor-pointer"
                        >
                            <span>✓</span> {savingPaper ? 'Saving...' : 'Finalize & Save →'}
                        </button>
                    )}
                </div>
            </div>

            {/* Row 1: Primary Controls from Image 3, 4, 5 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <SettingField label="Display Questions, Solutions *">
                    <select
                        style={selectStyle}
                        value={settings.displayMode || '1. Questions'}
                        onChange={e => update('displayMode', e.target.value)}
                    >
                        <option value="1. Questions">1. Questions</option>
                        <option value="2. Questions with Answers">2. Questions with Answers</option>
                        <option value="3. Questions with Answers & Solutions">3. Questions with Answers & Solutions</option>
                        <option value="4. Questions after Answers & Solutions">4. Questions after Answers & Solutions</option>
                        <option value="5. Only Questions with No Options">5. Only Questions with No Options</option>
                        <option value="6. Only Answers & Solutions">6. Only Answers & Solutions</option>
                        <option value="7. Only Answers">7. Only Answers</option>
                    </select>
                </SettingField>

                <SettingField label="Option Numbering Style *">
                    <select
                        style={selectStyle}
                        value={settings.optionFormat || '(1) (2) (3) (4)'}
                        onChange={e => update('optionFormat', e.target.value)}
                    >
                        <option value="(1) (2) (3) (4)">(1) (2) (3) (4)</option>
                        <option value="(A) (B) (C) (D)">(A) (B) (C) (D)</option>
                        <option value="(a) (b) (c) (d)">(a) (b) (c) (d)</option>
                    </select>
                </SettingField>

                <SettingField label="Start Numbering From (Q.#) *">
                    <input
                        type="number"
                        min="1"
                        style={inputStyle}
                        value={settings.startQNo !== undefined ? settings.startQNo : 1}
                        onChange={e => {
                            const raw = e.target.value;
                            setSettings(s => ({
                                ...s,
                                startQNo: raw === '' ? '' : (parseInt(raw, 10) || 0)
                            }));
                        }}
                        onBlur={() => {
                            if (settings.startQNo === '' || isNaN(settings.startQNo) || Number(settings.startQNo) < 1) {
                                setSettings(s => ({ ...s, startQNo: 1 }));
                            }
                        }}
                        placeholder="e.g. 1, 10, 25"
                    />
                </SettingField>

                <SettingField label="Watermark">
                    <select
                        style={selectStyle}
                        value={settings.showWatermark === false ? 'off' : 'on'}
                        onChange={e => update('showWatermark', e.target.value !== 'off')}
                    >
                        <option value="on">Show college emblem</option>
                        <option value="off">No watermark</option>
                    </select>
                </SettingField>

                {settings.showWatermark !== false && (
                    <>
                        <SettingField label="Watermark Opacity (%)">
                            <input
                                type="number" min="0" max="40" step="1"
                                style={inputStyle}
                                value={settings.watermarkOpacity ?? 8}
                                onChange={e => {
                                    const n = Number(e.target.value);
                                    update('watermarkOpacity', Number.isFinite(n) ? Math.min(40, Math.max(0, n)) : 8);
                                }}
                            />
                        </SettingField>
                        <SettingField label="Watermark Size (%)">
                            <input
                                type="number" min="20" max="250" step="5"
                                style={inputStyle}
                                value={settings.watermarkScale ?? 100}
                                onChange={e => {
                                    const n = Number(e.target.value);
                                    update('watermarkScale', Number.isFinite(n) ? Math.min(250, Math.max(20, n)) : 100);
                                }}
                            />
                        </SettingField>
                    </>
                )}

                <SettingField label="Duration (Minutes) *">
                    <input
                        type="number"
                        min="1"
                        style={inputStyle}
                        value={settings.durationMinutes !== undefined ? settings.durationMinutes : (settings.duration ? (parseInt(settings.duration, 10) || '') : 180)}
                        onChange={e => {
                            const raw = e.target.value;
                            setSettings(s => ({
                                ...s,
                                durationMinutes: raw === '' ? '' : (parseInt(raw, 10) || 0),
                                duration: raw === '' ? '' : `${raw} Minutes`
                            }));
                        }}
                        onBlur={() => {
                            if (settings.durationMinutes === '' || isNaN(settings.durationMinutes) || Number(settings.durationMinutes) < 1) {
                                setSettings(s => ({ ...s, durationMinutes: 180, duration: '180 Minutes' }));
                            }
                        }}
                        placeholder="Duration in mins (e.g. 180, 200)"
                    />
                </SettingField>

                <SettingField label="Marks Per Question *">
                    <input
                        type="number"
                        min="1"
                        style={inputStyle}
                        value={settings.marksPerQuestion !== undefined ? settings.marksPerQuestion : 4}
                        onChange={e => {
                            const raw = e.target.value;
                            setSettings(s => ({
                                ...s,
                                marksPerQuestion: raw === '' ? '' : (parseInt(raw, 10) || 0)
                            }));
                        }}
                        onBlur={() => {
                            if (settings.marksPerQuestion === '' || isNaN(settings.marksPerQuestion) || Number(settings.marksPerQuestion) < 1) {
                                setSettings(s => ({ ...s, marksPerQuestion: 4 }));
                            }
                        }}
                        placeholder="e.g. 1, 2, 4"
                    />
                </SettingField>

                <SettingField label="Options Layout *">
                    <select
                        style={selectStyle}
                        value={settings.optionsLayout || 'line'}
                        onChange={e => update('optionsLayout', e.target.value)}
                    >
                        <option value="line">In a Line (1) (2) (3) (4)</option>
                        <option value="2col">2 Columns (2x2 Grid)</option>
                        <option value="stacked">1 Column (Stacked)</option>
                        <option value="auto">Auto (Best Fit)</option>
                    </select>
                </SettingField>

                <SettingField label="Gap Between Questions *">
                    <select
                        style={selectStyle}
                        value={settings.questionSpacing || 'Default'}
                        onChange={e => update('questionSpacing', e.target.value)}
                    >
                        <option value="No Spacing">No Spacing</option>
                        <option value="Default">Default</option>
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15">15</option>
                    </select>
                </SettingField>
            </div>

            {/* Row 2: 4 Checkboxes from Image 5 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={settings.showQuestionNumbers !== false}
                        onChange={e => update('showQuestionNumbers', e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#001f6d', cursor: 'pointer' }}
                    />
                    Show Question Numbers
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={Boolean(settings.imageBelowQuestion)}
                        onChange={e => update('imageBelowQuestion', e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#001f6d', cursor: 'pointer' }}
                    />
                    Image below Question
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={Boolean(settings.paper2Column || settings.columns === 2)}
                        onChange={e => {
                            const val = e.target.checked;
                            setSettings(s => ({ ...s, paper2Column: val, columns: val ? 2 : 1 }));
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#001f6d', cursor: 'pointer' }}
                    />
                    Paper 2 Column
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={settings.paper2ColumnQuestionBreak !== false}
                        onChange={e => update('paper2ColumnQuestionBreak', e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#001f6d', cursor: 'pointer' }}
                    />
                    Paper 2 Column Question Break
                </label>
            </div>

            {/* Row 3: Typography & Paper Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px' }}>
                <SettingField label="Font Style">
                    <select style={selectStyle} value={settings.fontFamily} onChange={e => update('fontFamily', e.target.value)}>
                        <option value='"Times New Roman", Times, Georgia, serif'>Times New Roman (Standard)</option>
                        <option value='Georgia, "Times New Roman", serif'>Georgia (Classic)</option>
                        <option value='Calibri, Candara, Segoe, sans-serif'>Calibri</option>
                        <option value='Arial, Helvetica, sans-serif'>Arial</option>
                        <option value="'Inter', system-ui, sans-serif">Inter (Modern)</option>
                    </select>
                </SettingField>

                <SettingField label="Font Size">
                    <select style={selectStyle} value={settings.fontSize} onChange={e => update('fontSize', e.target.value)}>
                        <option value="10px">Tiny (10px)</option>
                        <option value="11px">Mini (11px)</option>
                        <option value="12px">Compact (12px)</option>
                        <option value="13px">Standard (13px)</option>
                        <option value="14px">Large (14px)</option>
                        <option value="15px">Extra Large (15px)</option>
                        <option value="16px">Display (16px)</option>
                        <option value="18px">18px</option>
                        <option value="20px">20px</option>
                        <option value="22px">22px</option>
                        <option value="24px">24px</option>
                        <option value="26px">26px</option>
                        <option value="28px">28px</option>
                        <option value="30px">30px</option>
                        <option value="32px">32px</option>
                        <option value="34px">34px</option>
                        <option value="36px">36px</option>
                        <option value="38px">38px</option>
                        <option value="40px">40px (Maximum)</option>
                    </select>
                </SettingField>

                <SettingField label="Line Height">
                    <select style={selectStyle} value={settings.lineHeight} onChange={e => update('lineHeight', e.target.value)}>
                        <option value="1.35">Compact (1.35)</option>
                        <option value="1.45">Standard (1.45)</option>
                        <option value="1.6">Relaxed (1.6)</option>
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

                <SettingField label="Show Marks on Qs">
                    <select style={selectStyle} value={settings.showMarks ? 'yes' : 'no'} onChange={e => update('showMarks', e.target.value === 'yes')}>
                        <option value="no">Hidden (Standard)</option>
                        <option value="yes">Display Marks</option>
                    </select>
                </SettingField>

                <SettingField label="Scheme of Valuation">
                    <select style={selectStyle} value={settings.includeSchemeOnLastPage ? 'yes' : 'no'} onChange={e => update('includeSchemeOnLastPage', e.target.value === 'yes')}>
                        <option value="no">Exclude (Question Paper Only)</option>
                        <option value="yes">Include on Final Page</option>
                    </select>
                </SettingField>
            </div>
        </div>
    );
}
