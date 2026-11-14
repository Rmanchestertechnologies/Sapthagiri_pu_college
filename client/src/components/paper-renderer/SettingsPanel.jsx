// ─── Settings / Alignment Panel ───────────────────────────────────────────────
// A sectioned control centre for the paper: one action dock on top, four calm tabs below. Every setting key, value and
// callback is exactly the one the paper engine already reads - only the controls changed (segmented buttons, switches,
// sliders and steppers instead of a wall of dropdowns).
import { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
    ArrowLeft, KeyRound, Lightbulb, Shuffle, Link2, FileText, Printer, CheckCheck, Dices, X, Minus, Plus,
    SlidersHorizontal, LayoutPanelTop, Type, Stamp, ListChecks,
} from 'lucide-react';

const SPRING = { type: 'spring', stiffness: 420, damping: 34 };

// Kept for any older import; the new controls below do not use them.
export const labelStyle = { fontSize: '11px', fontWeight: 800, color: '#001f6d', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };
export const selectStyle = { height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#1e293b', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%', fontWeight: 600 };
export const inputStyle = { height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#1e293b', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', fontWeight: 600 };

const SELECT_CLS = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#1e1b4b] outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 cursor-pointer';

export function SettingField({ label, hint, children }) {
    return (
        <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</label>
                {hint && <span className="text-[11px] font-medium text-slate-400">{hint}</span>}
            </div>
            {children}
        </div>
    );
}

/** Pill-style choice between a few values; the highlight glides to the chosen one. */
function Segmented({ id, value, onChange, options, small = false }) {
    return (
        <LayoutGroup id={id}>
            <div role="radiogroup" className="inline-flex w-full flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
                {options.map(o => {
                    const on = String(value) === String(o.value);
                    return (
                        <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} title={o.title}
                            className={`relative flex-1 cursor-pointer whitespace-nowrap rounded-lg ${small ? 'px-2 py-1.5' : 'px-3 py-2'} text-[12px] font-bold transition-colors ${on ? 'text-[#1e1b4b]' : 'text-slate-500 hover:text-slate-800'}`}>
                            {on && <motion.span layoutId={`${id}-pill`} transition={SPRING} className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgba(15,23,42,0.12),0_0_0_1px_rgba(99,102,241,0.18)]" />}
                            <span className="relative flex items-center justify-center gap-1.5">{o.icon}{o.label}</span>
                        </button>
                    );
                })}
            </div>
        </LayoutGroup>
    );
}

/** On/off switch with a title and a one-line explanation. */
function Switch({ checked, onChange, title, hint }) {
    return (
        <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
            className={`group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${checked ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <span className="min-w-0">
                <span className="block text-[13px] font-bold text-[#1e1b4b]">{title}</span>
                {hint && <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-slate-500">{hint}</span>}
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <motion.span animate={{ x: checked ? 20 : 2 }} transition={SPRING} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" />
            </span>
        </button>
    );
}

/** Number box with − / + buttons. `raw` handlers are the same ones the old inputs used. */
function Stepper({ value, onRaw, onBlur, min = 1, max, step = 1, onStep, suffix, placeholder }) {
    const bump = (d) => onStep(Math.min(max ?? Infinity, Math.max(min, (Number(value) || 0) + d * step)));
    return (
        <div className="flex h-10 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
            <button type="button" aria-label="Decrease" onClick={() => bump(-1)} className="flex w-9 cursor-pointer items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-[#1e1b4b]"><Minus size={14} /></button>
            <input type="number" min={min} max={max} step={step} value={value} placeholder={placeholder} onChange={e => onRaw(e.target.value)} onBlur={onBlur}
                className="w-full min-w-0 border-x border-slate-100 bg-transparent text-center text-[13px] font-bold text-[#1e1b4b] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            {suffix && <span className="flex items-center bg-slate-50 px-2 text-[11px] font-bold text-slate-400">{suffix}</span>}
            <button type="button" aria-label="Increase" onClick={() => bump(1)} className="flex w-9 cursor-pointer items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-[#1e1b4b]"><Plus size={14} /></button>
        </div>
    );
}

/** Slider with a live number. */
function Slider({ value, min, max, step = 1, onChange, suffix = '%' }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className="flex h-10 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
                style={{ background: `linear-gradient(90deg, #6366f1 ${pct}%, #e2e8f0 ${pct}%)` }}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow-md" />
            <span className="w-12 shrink-0 text-right text-[13px] font-bold tabular-nums text-[#1e1b4b]">{value}{suffix}</span>
        </div>
    );
}

function Card({ title, hint, children, cols = 'sm:grid-cols-2' }) {
    return (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
            {(title || hint) && (
                <div className="mb-4">
                    {title && <h4 className="text-[14px] font-bold text-[#1e1b4b]">{title}</h4>}
                    {hint && <p className="mt-0.5 text-[12px] font-medium text-slate-500">{hint}</p>}
                </div>
            )}
            <div className={`grid grid-cols-1 gap-4 ${cols}`}>{children}</div>
        </section>
    );
}

const btn = 'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-bold transition cursor-pointer disabled:opacity-50';

const TABS = [
    { id: 'content', label: 'Content', Icon: ListChecks },
    { id: 'options', label: 'Options & spacing', Icon: LayoutPanelTop },
    { id: 'type', label: 'Typography', Icon: Type },
    { id: 'header', label: 'Marks & watermark', Icon: Stamp },
];

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
    const [tab, setTab] = useState('content');
    const z = zoom || 100;

    const durationValue = settings.durationMinutes !== undefined ? settings.durationMinutes : (settings.duration ? (parseInt(settings.duration, 10) || '') : 180);
    const setDuration = (raw) => setSettings(s => ({ ...s, durationMinutes: raw === '' ? '' : (parseInt(raw, 10) || 0), duration: raw === '' ? '' : `${raw} Minutes` }));

    return (
        <div className="no-print mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-50/70 shadow-[0_24px_48px_-32px_rgba(30,27,75,0.45)] animate-fade-in">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><SlidersHorizontal size={19} /></span>
                    <div>
                        <h3 className="font-display text-[19px] leading-tight tracking-tight text-[#1e1b4b]">Layout &amp; alignment</h3>
                        <p className="text-[12px] font-medium text-slate-500">Every change shows on the paper below straight away.</p>
                    </div>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[12px] font-bold text-indigo-700">{totalQuestions} questions</span>
            </div>

            {/* ── action dock ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/70 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                    {onBack && (
                        <button type="button" onClick={onBack} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`}><ArrowLeft size={15} /> Back</button>
                    )}

                    {setsActive ? (
                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
                            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Set</span>
                            <LayoutGroup id="panel-sets">
                                {['P', 'Q', 'R', 'S'].map(s => (
                                    <button key={s} type="button" onClick={() => setActiveSet && setActiveSet(s)} aria-pressed={activeSet === s}
                                        className={`relative h-8 w-9 cursor-pointer rounded-lg text-[12.5px] font-bold transition-colors ${activeSet === s ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                                        {activeSet === s && <motion.span layoutId="panel-set-pill" transition={SPRING} className="absolute inset-0 rounded-lg bg-[#1e1b4b] shadow-[0_6px_14px_-6px_rgba(30,27,75,0.8)]" />}
                                        <span className="relative">{s}</span>
                                    </button>
                                ))}
                            </LayoutGroup>
                            <button type="button" onClick={() => setSetsActive && setSetsActive(false)} title="Reset to Single Set" aria-label="Reset to single set"
                                className="ml-0.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><X size={15} /></button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => { setSetsActive && setSetsActive(true); setActiveSet && setActiveSet('P'); }}
                            className={`${btn} border border-dashed border-indigo-300 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-50`}><Dices size={16} /> Generate 4 sets (P, Q, R, S)</button>
                    )}

                    {onOpenAnswerKey && <button type="button" onClick={onOpenAnswerKey} className={`${btn} bg-[#1e1b4b] text-white hover:bg-[#312e81]`}><KeyRound size={15} className="text-[#d6b878]" /> Answer key</button>}
                    {onOpenSolutions && <button type="button" onClick={onOpenSolutions} className={`${btn} bg-[#1e1b4b] text-white hover:bg-[#312e81]`}><Lightbulb size={15} className="text-[#d6b878]" /> Solutions</button>}
                    {onReshuffle && <button type="button" onClick={onReshuffle} className={`${btn} border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}><Shuffle size={15} /> Reshuffle</button>}
                    {onOpenMerge && <button type="button" onClick={onOpenMerge} className={`${btn} border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100`}><Link2 size={15} /> Merge exam</button>}

                    {setZoom && (
                        <div className="flex h-10 items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-1">
                            <button type="button" aria-label="Zoom out" onClick={() => setZoom(v => Math.max(60, (v || 100) - 15))} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Minus size={14} /></button>
                            <button type="button" title="Reset zoom" onClick={() => setZoom(100)} className="min-w-[3.4rem] cursor-pointer rounded-lg px-1 text-center text-[12.5px] font-bold tabular-nums text-[#1e1b4b] hover:bg-slate-100">{z}%</button>
                            <button type="button" aria-label="Zoom in" onClick={() => setZoom(v => Math.min(150, (v || 100) + 15))} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Plus size={14} /></button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {onDownloadWord && (
                        <button type="button" onClick={onDownloadWord} disabled={downloadingWord} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`}><FileText size={15} className="text-sky-600" /> {downloadingWord ? 'Exporting…' : 'Word (.docx)'}</button>
                    )}
                    {onPrint && (
                        <button type="button" onClick={onPrint} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`}><Printer size={15} className="text-amber-600" /> PDF / Print</button>
                    )}
                    {onFinalizeSave && (
                        <button type="button" onClick={onFinalizeSave} disabled={savingPaper}
                            className={`${btn} bg-emerald-600 px-5 text-white shadow-[0_10px_20px_-10px_rgba(5,150,105,0.8)] hover:bg-emerald-700`}><CheckCheck size={16} /> {savingPaper ? 'Saving…' : 'Finalize & Save'}</button>
                    )}
                </div>
            </div>

            {/* ── tabs ── */}
            <div className="px-5 pt-4">
                <LayoutGroup id="panel-tabs">
                    <div role="tablist" className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl bg-slate-200/70 p-1">
                        {TABS.map(({ id, label, Icon }) => (
                            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                                className={`relative flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${tab === id ? 'text-[#1e1b4b]' : 'text-slate-500 hover:text-slate-800'}`}>
                                {tab === id && <motion.span layoutId="panel-tab-pill" transition={SPRING} className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.12)]" />}
                                <Icon size={15} className="relative" /><span className="relative">{label}</span>
                            </button>
                        ))}
                    </div>
                </LayoutGroup>
            </div>

            <div className="p-5">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="space-y-4">

                        {tab === 'content' && (
                            <>
                                <Card title="What to print" hint="Choose what appears with each question." cols="grid-cols-1">
                                    <SettingField label="Display questions, solutions">
                                        <select className={SELECT_CLS} value={settings.displayMode || '1. Questions'} onChange={e => update('displayMode', e.target.value)}>
                                            <option value="1. Questions">1. Questions</option>
                                            <option value="2. Questions with Answers">2. Questions with Answers</option>
                                            <option value="3. Questions with Answers & Solutions">3. Questions with Answers &amp; Solutions</option>
                                            <option value="4. Questions after Answers & Solutions">4. Questions after Answers &amp; Solutions</option>
                                            <option value="5. Only Questions with No Options">5. Only Questions with No Options</option>
                                            <option value="6. Only Answers & Solutions">6. Only Answers &amp; Solutions</option>
                                            <option value="7. Only Answers">7. Only Answers</option>
                                        </select>
                                    </SettingField>
                                </Card>
                                <Card title="Show or hide" cols="lg:grid-cols-2">
                                    <Switch checked={settings.showQuestionNumbers !== false} onChange={v => update('showQuestionNumbers', v)} title="Question numbers" hint="Print 1, 2, 3… before each question." />
                                    <Switch checked={Boolean(settings.showMarks)} onChange={v => update('showMarks', v)} title="Marks on each question" hint="Show [4] beside every question." />
                                    <Switch checked={Boolean(settings.imageBelowQuestion)} onChange={v => update('imageBelowQuestion', v)} title="Image below question" hint="Move diagrams under the question text." />
                                    <Switch checked={Boolean(settings.includeSchemeOnLastPage)} onChange={v => update('includeSchemeOnLastPage', v)} title="Scheme of valuation" hint="Add it on the final page." />
                                </Card>
                            </>
                        )}

                        {tab === 'options' && (
                            <>
                                <Card title="Options" hint="How the four choices are labelled and arranged." cols="grid-cols-1">
                                    <SettingField label="Option numbering">
                                        <Segmented id="seg-optfmt" value={settings.optionFormat || '(1) (2) (3) (4)'} onChange={v => update('optionFormat', v)}
                                            options={[{ value: '(1) (2) (3) (4)', label: '(1) (2) (3) (4)' }, { value: '(A) (B) (C) (D)', label: '(A) (B) (C) (D)' }, { value: '(a) (b) (c) (d)', label: '(a) (b) (c) (d)' }]} />
                                    </SettingField>
                                    <SettingField label="Options layout">
                                        <Segmented id="seg-optlay" value={settings.optionsLayout || 'line'} onChange={v => update('optionsLayout', v)}
                                            options={[{ value: 'line', label: 'In a line' }, { value: '2col', label: '2 columns' }, { value: 'stacked', label: '1 column' }, { value: 'auto', label: 'Auto fit' }]} />
                                    </SettingField>
                                </Card>
                                <Card title="Spacing and columns" cols="grid-cols-1 lg:grid-cols-2">
                                    <div className="lg:col-span-2">
                                        <SettingField label="Gap between questions">
                                            <Segmented id="seg-gap" value={settings.questionSpacing || 'Default'} onChange={v => update('questionSpacing', v)}
                                                options={[{ value: 'No Spacing', label: 'None' }, { value: 'Default', label: 'Default' }, { value: '5', label: '5' }, { value: '10', label: '10' }, { value: '15', label: '15' }]} />
                                        </SettingField>
                                    </div>
                                    <Switch checked={Boolean(settings.paper2Column || settings.columns === 2)} onChange={v => setSettings(s => ({ ...s, paper2Column: v, columns: v ? 2 : 1 }))} title="Two-column paper" hint="Print the paper in two columns." />
                                    <Switch checked={settings.paper2ColumnQuestionBreak !== false} onChange={v => update('paper2ColumnQuestionBreak', v)} title="Keep a question in one column" hint="Avoid splitting a question across columns." />
                                </Card>
                            </>
                        )}

                        {tab === 'type' && (
                            <Card title="Typography" hint="Font, size and spacing of the text." cols="sm:grid-cols-2">
                                <SettingField label="Font style">
                                    <select className={SELECT_CLS} value={settings.fontFamily} onChange={e => update('fontFamily', e.target.value)}>
                                        <option value='"Times New Roman", Times, Georgia, serif'>Times New Roman (Standard)</option>
                                        <option value='Georgia, "Times New Roman", serif'>Georgia (Classic)</option>
                                        <option value='Calibri, Candara, Segoe, sans-serif'>Calibri</option>
                                        <option value='Arial, Helvetica, sans-serif'>Arial</option>
                                        <option value="'Inter', system-ui, sans-serif">Inter (Modern)</option>
                                    </select>
                                </SettingField>
                                <SettingField label="Font size">
                                    <select className={SELECT_CLS} value={settings.fontSize} onChange={e => update('fontSize', e.target.value)}>
                                        <option value="10px">Tiny (10px)</option>
                                        <option value="11px">Mini (11px)</option>
                                        <option value="12px">Compact (12px)</option>
                                        <option value="13px">Standard (13px)</option>
                                        <option value="14px">Large (14px)</option>
                                        <option value="15px">Extra Large (15px)</option>
                                        <option value="16px">Display (16px)</option>
                                        {[18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38].map(n => <option key={n} value={`${n}px`}>{n}px</option>)}
                                        <option value="40px">40px (Maximum)</option>
                                    </select>
                                </SettingField>
                                <SettingField label="Line height">
                                    <Segmented id="seg-lh" value={String(settings.lineHeight)} onChange={v => update('lineHeight', v)}
                                        options={[{ value: '1.35', label: 'Compact' }, { value: '1.45', label: 'Standard' }, { value: '1.6', label: 'Relaxed' }]} />
                                </SettingField>
                                <SettingField label="Diagram max height">
                                    <Segmented id="seg-dia" value={String(settings.diagramMaxHeight)} onChange={v => update('diagramMaxHeight', v)} small
                                        options={[{ value: '200px', label: '200' }, { value: '260px', label: '260 ★', title: 'Recommended' }, { value: '300px', label: '300' }, { value: '350px', label: '350' }]} />
                                </SettingField>
                            </Card>
                        )}

                        {tab === 'header' && (
                            <>
                                <Card title="Numbers and marks" cols="sm:grid-cols-3">
                                    <SettingField label="Start numbering at Q.#">
                                        <Stepper value={settings.startQNo !== undefined ? settings.startQNo : 1} placeholder="1"
                                            onRaw={raw => setSettings(s => ({ ...s, startQNo: raw === '' ? '' : (parseInt(raw, 10) || 0) }))}
                                            onStep={n => setSettings(s => ({ ...s, startQNo: n }))}
                                            onBlur={() => { if (settings.startQNo === '' || isNaN(settings.startQNo) || Number(settings.startQNo) < 1) setSettings(s => ({ ...s, startQNo: 1 })); }} />
                                    </SettingField>
                                    <SettingField label="Duration">
                                        <Stepper value={durationValue} suffix="min" step={5} placeholder="180"
                                            onRaw={setDuration}
                                            onStep={n => setDuration(String(n))}
                                            onBlur={() => { if (settings.durationMinutes === '' || isNaN(settings.durationMinutes) || Number(settings.durationMinutes) < 1) setSettings(s => ({ ...s, durationMinutes: 180, duration: '180 Minutes' })); }} />
                                    </SettingField>
                                    <SettingField label="Marks per question">
                                        <Stepper value={settings.marksPerQuestion !== undefined ? settings.marksPerQuestion : 4} placeholder="4"
                                            onRaw={raw => setSettings(s => ({ ...s, marksPerQuestion: raw === '' ? '' : (parseInt(raw, 10) || 0) }))}
                                            onStep={n => setSettings(s => ({ ...s, marksPerQuestion: n }))}
                                            onBlur={() => { if (settings.marksPerQuestion === '' || isNaN(settings.marksPerQuestion) || Number(settings.marksPerQuestion) < 1) setSettings(s => ({ ...s, marksPerQuestion: 4 })); }} />
                                    </SettingField>
                                </Card>
                                <Card title="Watermark" hint="A faint college emblem behind the text." cols="grid-cols-1 lg:grid-cols-2">
                                    <div className="lg:col-span-2">
                                        <Switch checked={settings.showWatermark !== false} onChange={v => update('showWatermark', v)} title="Show college emblem" hint="Turn off for a plain paper." />
                                    </div>
                                    {settings.showWatermark !== false && (
                                        <>
                                            <SettingField label="Opacity">
                                                <Slider min={0} max={40} value={settings.watermarkOpacity ?? 8} onChange={n => update('watermarkOpacity', Math.min(40, Math.max(0, n)))} />
                                            </SettingField>
                                            <SettingField label="Size">
                                                <Slider min={20} max={250} step={5} value={settings.watermarkScale ?? 100} onChange={n => update('watermarkScale', Math.min(250, Math.max(20, n)))} />
                                            </SettingField>
                                        </>
                                    )}
                                </Card>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
