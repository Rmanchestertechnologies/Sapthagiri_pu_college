/**
 * Motion kit for the paper wizard: spring presets and a few small components that give every action a physical reaction.
 * Everything honours "reduce motion" (MotionConfig reducedMotion="user" in <MotionRoot>) and never blocks the page:
 * status messages are a floating pill, not a full-screen loader.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Check, CornerDownLeft, Search, Scale, AlertTriangle, Loader2 } from 'lucide-react';

/** Spring presets: snappy for presses, soft for layout, bouncy for delight. */
export const SPRING = {
    press: { type: 'spring', stiffness: 700, damping: 30, mass: 0.6 },
    soft: { type: 'spring', stiffness: 260, damping: 28 },
    bouncy: { type: 'spring', stiffness: 380, damping: 18 },
    island: { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 },
};

export function MotionRoot({ children }) {
    return <MotionConfig reducedMotion="user" transition={SPRING.soft}>{children}</MotionConfig>;
}

/** A number that rolls to its new value instead of jumping. */
export function AnimatedNumber({ value, className = '' }) {
    const mv = useMotionValue(Number(value) || 0);
    const rounded = useTransform(mv, v => Math.round(v));
    const [text, setText] = useState(String(Math.round(Number(value) || 0)));
    useEffect(() => rounded.on('change', v => setText(String(v))), [rounded]);
    useEffect(() => {
        const controls = animate(mv, Number(value) || 0, { type: 'spring', stiffness: 220, damping: 26 });
        return () => controls.stop();
    }, [value, mv]);
    return <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</span>;
}

/** Wraps a button-like element so it squeezes under the finger and springs back. */
export function Press({ as = 'button', className = '', children, ...props }) {
    const Comp = motion[as] || motion.button;
    return (
        <Comp whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }} transition={SPRING.press} className={className} {...props}>
            {children}
        </Comp>
    );
}

/** Wizard progress: one pill that glides between steps (shared layout), with a line that fills as you go. */
export function StepRail({ steps, position, onSelect }) {
    const pct = steps.length > 1 ? (position / (steps.length - 1)) * 100 : 0;
    return (
        <LayoutGroup id="step-rail">
            <nav className="hidden md:flex items-center gap-1.5 relative" aria-label="Progress">
                {steps.map((st, i) => {
                    const clickable = i < position;
                    const current = i === position;
                    return (
                        <motion.button
                            key={st.step}
                            type="button"
                            disabled={!clickable}
                            aria-current={current ? 'step' : undefined}
                            onClick={() => clickable && onSelect(st.step)}
                            whileTap={clickable ? { scale: 0.94 } : undefined}
                            whileHover={clickable ? { y: -1 } : undefined}
                            transition={SPRING.press}
                            className={`relative px-2.5 lg:px-3 py-1 rounded-xl text-[10px] lg:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                current ? 'text-navy' : clickable ? 'text-white cursor-pointer' : 'text-slate-300 cursor-default'}`}
                        >
                            {current && (
                                <motion.span layoutId="step-pill" transition={SPRING.bouncy}
                                    className="absolute inset-0 rounded-xl bg-gold shadow-md ring-2 ring-gold/40" />
                            )}
                            {!current && <span className={`absolute inset-0 rounded-xl ${clickable ? 'bg-white/15' : 'bg-white/5 border border-white/15'}`} />}
                            <span className="relative flex items-center gap-1">
                                <AnimatePresence initial={false} mode="popLayout">
                                    {i < position
                                        ? <motion.span key="done" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={SPRING.bouncy}><Check size={11} strokeWidth={3} /></motion.span>
                                        : <motion.span key="n" exit={{ scale: 0 }}>{i + 1}.</motion.span>}
                                </AnimatePresence>
                                <span className="hidden lg:inline">{st.label}</span>
                            </span>
                        </motion.button>
                    );
                })}
                <span className="absolute -bottom-2 left-0 right-0 h-[2px] rounded bg-white/10 overflow-hidden" aria-hidden="true">
                    <motion.span className="block h-full bg-gold" initial={false} animate={{ width: `${pct}%` }} transition={SPRING.soft} />
                </span>
            </nav>
        </LayoutGroup>
    );
}

/** Slides the step in from the direction you are travelling. */
export function StepTransition({ stepKey, direction = 1, className = '', children }) {
    return (
        <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
                key={stepKey}
                className={className}
                custom={direction}
                variants={{
                    enter: d => ({ opacity: 0, x: 36 * d, scale: 0.985 }),
                    center: { opacity: 1, x: 0, scale: 1 },
                    exit: d => ({ opacity: 0, x: -36 * d, scale: 0.985 }),
                }}
                initial="enter" animate="center" exit="exit"
                transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}

/**
 * Dynamic-Island style status pill. It stays out of the way at the top of the screen, morphs between
 * working → success / error, and dismisses itself.
 *   status: { state: 'working' | 'success' | 'error', message: string } | null
 */
export function StatusIsland({ status }) {
    return (
        <div className="fixed top-3 left-0 right-0 z-[60] flex justify-center pointer-events-none no-print" role="status" aria-live="polite">
            <AnimatePresence>
                {status && (
                    <motion.div
                        key="island"
                        layout
                        initial={{ y: -48, opacity: 0, scale: 0.7 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -40, opacity: 0, scale: 0.8 }}
                        transition={SPRING.island}
                        className="pointer-events-auto bg-black text-white rounded-full pl-2.5 pr-4 py-2 shadow-2xl flex items-center gap-2.5 max-w-[92vw]"
                    >
                        <motion.span layout className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            status.state === 'success' ? 'bg-emerald-500' : status.state === 'error' ? 'bg-red-500' : 'bg-white/15'}`}>
                            <AnimatePresence mode="wait" initial={false}>
                                {status.state === 'working' && (
                                    <motion.span key="w" initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} exit={{ scale: 0 }}
                                        transition={{ rotate: { repeat: Infinity, duration: 0.9, ease: 'linear' }, scale: SPRING.bouncy }}>
                                        <Loader2 size={14} />
                                    </motion.span>
                                )}
                                {status.state === 'success' && (
                                    <motion.svg key="s" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }} />
                                    </motion.svg>
                                )}
                                {status.state === 'error' && (
                                    <motion.span key="e" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bouncy}><AlertTriangle size={13} /></motion.span>
                                )}
                            </AnimatePresence>
                        </motion.span>
                        <motion.span layout="position" className="text-xs font-bold tracking-wide truncate">{status.message}</motion.span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Small hook: show a status pill, and let success / error messages fade away on their own. */
export function useIsland() {
    const [status, setStatus] = useState(null);
    const timer = useRef(null);
    const show = (state, message, ms) => {
        clearTimeout(timer.current);
        setStatus({ state, message });
        const hold = ms ?? (state === 'working' ? 0 : state === 'error' ? 5000 : 2600);
        if (hold) timer.current = setTimeout(() => setStatus(null), hold);
    };
    const clear = () => { clearTimeout(timer.current); setStatus(null); };
    useEffect(() => () => clearTimeout(timer.current), []);
    return { status, show, clear };
}

/**
 * The balance dock: a floating pill with a beam that tilts toward "too many" / "too few" and levels out when the
 * numbers match. `count` is what has been allocated, `target` is what the paper needs.
 */
export function BalanceDock({ count, target, unit = 'questions', marksPerQ = 0 }) {
    const diff = (Number(count) || 0) - (Number(target) || 0);
    const balanced = target > 0 && diff === 0;
    const tilt = Math.max(-14, Math.min(14, diff * 2.5));
    const marks = (Number(count) || 0) * (Number(marksPerQ) || 0);
    return (
        <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={SPRING.island}
            className="fixed bottom-4 left-1/2 lg:left-[calc(50%+152px)] -translate-x-1/2 z-50 no-print"
            style={{ x: '-50%' }}
        >
            <div className={`flex items-center gap-3 rounded-full pl-3 pr-5 py-2 shadow-2xl backdrop-blur-md border ${
                balanced ? 'bg-emerald-600/95 border-emerald-300/40 text-white' : 'bg-navy/95 border-white/10 text-white'}`}>
                <div className="w-9 h-7 relative flex items-center justify-center" aria-hidden="true">
                    <motion.div animate={{ rotate: balanced ? 0 : tilt }} transition={SPRING.bouncy} className="origin-center">
                        <Scale size={22} className={balanced ? 'text-white' : 'text-gold'} />
                    </motion.div>
                </div>
                <div className="leading-tight">
                    <div className="text-sm font-black">
                        <AnimatedNumber value={count} />
                        {target > 0 && <span className="opacity-70 font-bold"> / <AnimatedNumber value={target} /></span>}
                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1.5">{unit}</span>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {balanced
                            ? <span className="inline-flex items-center gap-1"><Check size={10} strokeWidth={3} /> Balanced{marks ? ` · ${marks} marks` : ''}</span>
                            : target > 0
                                ? (diff > 0 ? `${diff} too many` : `${-diff} to go`)
                                : 'Set a target'}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/** A wax-seal style stamp that thumps onto the screen when the paper is locked in. */
export function PaperSeal({ show, label = 'Paper saved', onDone }) {
    useEffect(() => {
        if (!show) return undefined;
        const t = setTimeout(() => onDone && onDone(), 1700);
        return () => clearTimeout(t);
    }, [show, onDone]);
    return (
        <AnimatePresence>
            {show && (
                <motion.div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none no-print"
                    initial={{ backgroundColor: 'rgba(0,0,0,0)' }} animate={{ backgroundColor: 'rgba(8,16,40,0.35)' }} exit={{ backgroundColor: 'rgba(0,0,0,0)' }}>
                    <motion.div
                        initial={{ scale: 2.6, rotate: -18, opacity: 0 }}
                        animate={{ scale: 1, rotate: -8, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0, y: -20 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 20, mass: 0.9 }}
                        className="w-44 h-44 rounded-full border-[6px] border-emerald-500 bg-white/95 text-emerald-600 shadow-2xl flex flex-col items-center justify-center"
                    >
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15, duration: 0.4 }} />
                        </svg>
                        <span className="mt-1 text-[11px] font-black uppercase tracking-[0.18em]">{label}</span>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Ctrl/⌘ + K: jump anywhere, run an action, without hunting through menus. */
export function CommandPalette({ open, onClose, commands }) {
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const inputRef = useRef(null);
    const list = useMemo(() => {
        const q = query.trim().toLowerCase();
        return commands.filter(c => !c.hidden && (!q || c.label.toLowerCase().includes(q) || (c.hint || '').toLowerCase().includes(q)));
    }, [commands, query]);

    useEffect(() => { if (open) { setQuery(''); setIndex(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);
    useEffect(() => { setIndex(0); }, [query]);

    const run = (c) => { if (!c) return; onClose(); setTimeout(() => c.run(), 0); };
    const onKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(list.length - 1, i + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
        else if (e.key === 'Enter') { e.preventDefault(); run(list[index]); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh] px-4 bg-black/40 backdrop-blur-sm no-print"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
                    <motion.div role="dialog" aria-label="Command palette" onMouseDown={e => e.stopPropagation()}
                        initial={{ y: -16, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -10, scale: 0.97, opacity: 0 }}
                        transition={SPRING.island}
                        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 border-b border-slate-100">
                            <Search size={16} className="text-slate-400" />
                            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey}
                                placeholder="Type a command… (go to step, save, back)" aria-label="Search commands"
                                className="flex-1 py-4 text-sm font-semibold outline-none bg-transparent text-slate-800 placeholder:text-slate-400" />
                            <kbd className="text-[10px] font-bold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">esc</kbd>
                        </div>
                        <ul className="max-h-72 overflow-auto p-1.5" role="listbox">
                            {list.length === 0 && <li className="px-3 py-6 text-center text-xs font-semibold text-slate-400">Nothing matches “{query}”</li>}
                            {list.map((c, i) => (
                                <li key={c.id} role="option" aria-selected={i === index}>
                                    <button type="button" onMouseEnter={() => setIndex(i)} onClick={() => run(c)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-sm font-bold relative ${i === index ? 'text-navy' : 'text-slate-600'}`}>
                                        {i === index && <motion.span layoutId="cmd-hl" transition={SPRING.press} className="absolute inset-0 rounded-xl bg-gold/20" />}
                                        <span className="relative">{c.label}</span>
                                        <span className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            {c.hint}{i === index && <CornerDownLeft size={11} />}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Global Ctrl/⌘+K binding. */
export function useCommandShortcut(toggle) {
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggle]);
}
