import { motion, LayoutGroup } from 'framer-motion';
import { Check, FileText, Layers, BookOpen, Hash, Award } from 'lucide-react';
import { SPRING, AnimatedNumber } from './index';

/**
 * Left column of the paper wizard: a vertical stepper (finished steps can be revisited) and a live "your paper" card
 * that fills in as choices are made. On small screens it collapses to a slim progress bar.
 *   steps:   [{ step, label, summary? }]  summary is a short line shown under finished / current steps
 *   summary: { exam, subject, cls, chapters, questions, marks }
 */
export function StepSidebar({ steps, position, onSelect, summary = {} }) {
    const pct = steps.length > 1 ? (position / (steps.length - 1)) * 100 : 0;
    const facts = [
        { Icon: FileText, label: 'Exam', value: summary.exam },
        { Icon: BookOpen, label: 'Subject', value: summary.subject },
        { Icon: Layers, label: 'Class', value: summary.cls },
        { Icon: Hash, label: 'Chapters', value: summary.chapters ? summary.chapters : null },
    ].filter(f => f.value);

    return (
        <>
            {/* phone / tablet: slim progress */}
            <div className="lg:hidden px-4 md:px-8 pt-4 no-print">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                    <span>Step {position + 1} of {steps.length}</span>
                    <span className="text-[#1e1b4b]">{steps[position]?.label}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full" initial={false}
                        animate={{ width: `${Math.max(6, ((position + 1) / steps.length) * 100)}%` }} transition={SPRING.soft} />
                </div>
            </div>

            <aside className="hidden lg:block no-print">
                <div className="sticky top-24 space-y-4">
                    <nav aria-label="Progress" className="surface p-4">
                        <p className="eyebrow mb-3 px-1">Your steps</p>
                        <LayoutGroup id="wizard-side">
                            <ol className="relative">
                                <span className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200" aria-hidden="true" />
                                <motion.span className="absolute left-[19px] top-4 w-px bg-indigo-400" aria-hidden="true" initial={false}
                                    animate={{ height: `calc(${pct}% - ${pct / 100 * 32}px)` }} transition={SPRING.soft} />
                                {steps.map((st, i) => {
                                    const done = i < position;
                                    const current = i === position;
                                    return (
                                        <li key={st.step} className="relative">
                                            <button type="button" disabled={!done} onClick={() => done && onSelect(st.step)}
                                                aria-current={current ? 'step' : undefined}
                                                className={`relative w-full flex items-start gap-3 rounded-2xl px-2 py-2.5 text-left ${done ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}>
                                                {current && <motion.span layoutId="side-hl" transition={SPRING.bouncy} className="absolute inset-0 rounded-2xl bg-amber-50 ring-1 ring-amber-200" />}
                                                <span className={`relative z-10 mt-px w-[22px] h-[22px] shrink-0 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-colors ${
                                                    done ? 'bg-emerald-500 text-white' : current ? 'bg-[#1e1b4b] text-indigo-400' : 'bg-white text-slate-400 ring-1 ring-slate-300'}`}>
                                                    {done ? <Check size={12} strokeWidth={3.5} /> : i + 1}
                                                </span>
                                                <span className="relative z-10 min-w-0">
                                                    <span className={`block text-[13px] font-bold leading-tight ${current ? 'text-[#1e1b4b]' : done ? 'text-slate-700' : 'text-slate-400'}`}>{st.label}</span>
                                                    {(done || current) && st.summary && <span className="block text-[11px] font-medium text-slate-500 truncate mt-0.5">{st.summary}</span>}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </LayoutGroup>
                    </nav>

                    <div className="rounded-[22px] bg-gradient-to-br from-[#1e1b4b] to-[#312e81] text-white p-5 shadow-xl">
                        <p className="eyebrow mb-3">Your paper</p>
                        {facts.length === 0 && <p className="text-xs text-white/60 font-medium leading-relaxed">Pick an exam and subject — the paper takes shape here as you go.</p>}
                        <ul className="space-y-2.5">
                            {facts.map(({ Icon, label, value }) => (
                                <motion.li key={label} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={SPRING.soft} className="flex items-center gap-3 text-sm">
                                    <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-indigo-400 shrink-0"><Icon size={14} /></span>
                                    <span className="min-w-0"><span className="block text-[10px] uppercase tracking-wider text-white/50 font-bold">{label}</span><span className="block font-bold truncate">{value}</span></span>
                                </motion.li>
                            ))}
                        </ul>
                        {(summary.questions > 0) && (
                            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
                                <div><p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Questions</p><p className="text-2xl font-extrabold"><AnimatedNumber value={summary.questions} /></p></div>
                                {summary.marks > 0 && <div><p className="text-[10px] uppercase tracking-wider text-white/50 font-bold flex items-center gap-1"><Award size={11} /> Marks</p><p className="text-2xl font-extrabold"><AnimatedNumber value={summary.marks} /></p></div>}
                            </div>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold px-1">Tip: press <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Ctrl</kbd> + <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500">K</kbd> to jump anywhere.</p>
                </div>
            </aside>
        </>
    );
}
