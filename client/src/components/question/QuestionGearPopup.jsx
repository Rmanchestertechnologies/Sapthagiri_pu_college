import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Minus, Plus, RotateCcw, Check, Image as ImageIcon, Rows3, Maximize2, MoveVertical } from 'lucide-react';

const PANEL_WIDTH = 340;
const SPRING = { type: 'spring', stiffness: 420, damping: 34 };

/** A tiny page sketch: where the picture (solid block) sits relative to the text lines. */
function PlacementGlyph({ kind, active }) {
    const img = active ? '#6366f1' : '#94a3b8';
    const line = active ? '#cbd5e1' : '#e2e8f0';
    const rect = (x, y, w, h, fill, r = 1.5) => <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} />;
    const lines = (x, y, w, n) => Array.from({ length: n }).map((_, i) => <rect key={`${x}-${y}-${i}`} x={x} y={y + i * 5} width={i === n - 1 ? w * 0.6 : w} height="2.4" rx="1.2" fill={line} />);
    return (
        <svg width="38" height="30" viewBox="0 0 38 30" aria-hidden="true">
            <rect x="0.5" y="0.5" width="37" height="29" rx="4" fill="#fff" stroke={active ? '#6366f1' : '#e2e8f0'} />
            {kind === 'Left' && <>{rect(4, 5, 11, 11, img)}{lines(18, 5, 16, 4)}{lines(4, 20, 30, 1)}</>}
            {kind === 'Right' && <>{rect(23, 5, 11, 11, img)}{lines(4, 5, 16, 4)}{lines(4, 20, 30, 1)}</>}
            {kind === 'Top' && <>{rect(11, 4, 16, 9, img)}{lines(4, 17, 30, 2)}</>}
            {kind === 'Below' && <>{lines(4, 4, 30, 2)}{rect(11, 16, 16, 9, img)}</>}
            {kind === 'Center' && <>{lines(4, 3, 30, 1)}{rect(11, 9, 16, 10, img)}{lines(4, 23, 30, 1)}</>}
        </svg>
    );
}

function Section({ icon: Icon, title, right, children }) {
    return (
        <section className="mb-5">
            <div className="flex items-center justify-between mb-2.5">
                <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-slate-700" style={{ fontFamily: 'inherit', letterSpacing: '0.12em' }}>
                    <Icon size={14} className="text-indigo-500" /> {title}
                </h3>
                {right}
            </div>
            {children}
        </section>
    );
}

/**
 * Settings of ONE question (image position and size, options per line).
 *
 * A panel fixed to the right edge of the window, drawn through a portal into <body>: inside the paper it used to sit in the
 * zoomed / scaled page area, where "fixed" is not relative to the window, so it overlapped the questions. While it is open
 * (on screens wide enough) the page is pushed left by the panel's width, so the paper stays fully visible and every change
 * shows on it at once.
 */
export function QuestionGearPopup({
    imageAlignment,
    optionsPerLine,
    sizeScale = 100,
    currentDiagramHeight = 180,
    onAlignmentChange,
    onOptionsPerLineChange,
    onSizeScaleChange,
    onDiagramSizeDelta,
    onReset,
    onClose,
    displayNum = 1,
}) {
    useEffect(() => {
        const previous = document.body.style.paddingRight;
        // on a narrow screen there is no room beside the page: the panel then covers it instead of squeezing it
        if (window.innerWidth >= 900) document.body.style.paddingRight = `${PANEL_WIDTH}px`;
        document.body.style.transition = 'padding-right 0.15s ease';
        return () => { document.body.style.paddingRight = previous; };
    }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const height = parseInt(currentDiagramHeight, 10) || 180;
    const scale = Number(sizeScale) || 100;
    const align = String(imageAlignment || '').toLowerCase();

    const chip = (active) => `flex-1 rounded-xl py-2 text-xs font-extrabold border transition-colors ${active
        ? 'bg-[#1e1b4b] text-indigo-400 border-[#1e1b4b] shadow-md'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`;

    const panel = (
        <motion.aside
            className="no-print"
            role="dialog"
            aria-label={`Question display settings, question ${displayNum}`}
            initial={{ x: PANEL_WIDTH }} animate={{ x: 0 }} transition={SPRING}
            style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: `min(${PANEL_WIDTH}px, 92vw)`, zIndex: 2147483000,
                background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                borderLeft: '1px solid rgba(15,23,42,0.08)', boxShadow: '-24px 0 48px -20px rgba(30,27,75,0.35)',
                overflowY: 'auto', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-[#1e1b4b] to-[#312e81] text-white">
                <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-400">Question display</p>
                    <p className="text-sm font-bold truncate">Question {displayNum} · live preview on the page</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close settings" className="w-8 h-8 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center">
                    <X size={16} />
                </button>
            </header>

            <div className="p-5">
                <Section icon={ImageIcon} title="Image position">
                    <div className="grid grid-cols-5 gap-1.5">
                        {['Left', 'Right', 'Top', 'Below', 'Center'].map((a) => {
                            const active = align === a.toLowerCase();
                            return (
                                <button key={a} type="button" onClick={() => onAlignmentChange && onAlignmentChange(a)} aria-pressed={active}
                                    className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 pb-1 transition-all ${active ? 'border-indigo-400 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                    <PlacementGlyph kind={a} active={active} />
                                    <span className={`text-[9.5px] font-extrabold uppercase tracking-wide ${active ? 'text-amber-700' : 'text-slate-500'}`}>{a}</span>
                                </button>
                            );
                        })}
                    </div>
                </Section>

                <Section icon={Rows3} title="Options per line">
                    <div className="flex gap-1.5 p-1 rounded-2xl bg-slate-100">
                        {[1, 2, 4].map((n) => (
                            <button key={n} type="button" onClick={() => onOptionsPerLineChange && onOptionsPerLineChange(n)} aria-pressed={Number(optionsPerLine) === n}
                                className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${Number(optionsPerLine) === n ? 'bg-white text-[#1e1b4b] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {n === 1 ? '1 · stacked' : n === 2 ? '2 · grid' : '4 · in a row'}
                            </button>
                        ))}
                    </div>
                </Section>

                <Section icon={Maximize2} title="Image scale" right={<span className="text-xs font-extrabold text-[#1e1b4b] bg-amber-100 rounded-lg px-2 py-0.5">{scale}%</span>}>
                    <input type="range" min="50" max="250" step="5" value={scale} aria-label="Image scale"
                        onChange={(e) => onSizeScaleChange && onSizeScaleChange(Number(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer" />
                    <div className="mt-2 flex gap-1.5">
                        {[50, 75, 100, 150, 250].map((v) => (
                            <button key={v} type="button" onClick={() => onSizeScaleChange && onSizeScaleChange(v)} className={chip(scale === v)}>{v}</button>
                        ))}
                    </div>
                </Section>

                <Section icon={MoveVertical} title="Image height" right={<span className="text-xs font-extrabold text-slate-600 bg-slate-100 rounded-lg px-2 py-0.5">{height}px</span>}>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onDiagramSizeDelta && onDiagramSizeDelta(-10)} aria-label="10 pixels shorter"
                            className="w-11 h-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center hover:bg-[#1e1b4b] hover:text-indigo-400 hover:border-[#1e1b4b]"><Minus size={17} strokeWidth={3} /></button>
                        <div className="flex-1 grid grid-cols-4 gap-1.5">
                            {[-100, -50, 50, 100].map((d) => (
                                <button key={d} type="button" onClick={() => onDiagramSizeDelta && onDiagramSizeDelta(d)}
                                    className="rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-extrabold text-slate-600 hover:border-indigo-400 hover:text-amber-700">{d > 0 ? `+${d}` : d}</button>
                            ))}
                        </div>
                        <button type="button" onClick={() => onDiagramSizeDelta && onDiagramSizeDelta(10)} aria-label="10 pixels taller"
                            className="w-11 h-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center hover:bg-[#1e1b4b] hover:text-indigo-400 hover:border-[#1e1b4b]"><Plus size={17} strokeWidth={3} /></button>
                    </div>
                </Section>
            </div>

            <footer className="sticky bottom-0 flex gap-2 p-4 bg-white/90 backdrop-blur border-t border-slate-100">
                {onReset && (
                    <button type="button" onClick={onReset} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-300 py-2.5 text-xs font-extrabold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
                        <RotateCcw size={14} /> Reset
                    </button>
                )}
                <button type="button" onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-[#1e1b4b] py-2.5 text-xs font-extrabold uppercase tracking-wide text-indigo-400 hover:bg-[#312e81]">
                    <Check size={15} strokeWidth={3} /> Done
                </button>
            </footer>
        </motion.aside>
    );

    return typeof document !== 'undefined' ? createPortal(panel, document.body) : null;
}
