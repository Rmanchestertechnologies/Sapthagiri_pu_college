import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, FileText, ClipboardList, Clock, Sparkles, ScanLine, Database, BarChart3, FilePlus2, Zap, ArrowUpRight } from 'lucide-react';
import { AnimatedNumber, SPRING } from '../../../ui/motion';

const when = (value) => {
    const t = new Date(value || 0).getTime();
    if (!t) return '';
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
    return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const examOf = (p) => String(p.examType || p.exam_type || '').toUpperCase();
const SLICES = [
    { key: 'NEET', label: 'NEET', colour: '#14b8a6' },
    { key: 'JEE', label: 'JEE', colour: '#6366f1' },
    { key: 'CET', label: 'CET', colour: '#f59e0b' },
    { key: 'OTHER', label: 'Other', colour: '#94a3b8' },
];

/** Donut of saved papers by exam, drawn with stroke-dasharray so it animates. */
function Donut({ parts, total }) {
    const r = 54;
    const c = 2 * Math.PI * r;
    let offset = 0;
    return (
        <div className="relative w-40 h-40 shrink-0">
            <svg viewBox="0 0 140 140" className="-rotate-90 w-full h-full">
                <circle cx="70" cy="70" r={r} fill="none" stroke="#eef2f7" strokeWidth="16" />
                {total > 0 && parts.filter(x => x.n > 0).map((x) => {
                    const len = (x.n / total) * c;
                    const el = (
                        <motion.circle key={x.key} cx="70" cy="70" r={r} fill="none" stroke={x.colour} strokeWidth="16" strokeDasharray={`${len} ${c - len}`}
                            initial={{ strokeDashoffset: -offset + c }} animate={{ strokeDashoffset: -offset }} transition={{ type: 'spring', stiffness: 70, damping: 20 }} />
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-[#081b3b]"><AnimatedNumber value={total} /></span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">papers</span>
            </div>
        </div>
    );
}

/**
 * The "command center" row of the admin home: what has been happening, where the papers sit, the ones you pinned, and one-tap
 * shortcuts. Everything is computed from the papers and exams already loaded on the page.
 */
export default function CommandCenter({ papers, exams, pinned, onTogglePin, onOpenPaper, go, side = false, showShortcuts = true }) {
    const parts = useMemo(() => {
        const counts = { NEET: 0, JEE: 0, CET: 0, OTHER: 0 };
        papers.forEach((p) => { const e = examOf(p); counts[e.includes('NEET') ? 'NEET' : e.includes('JEE') ? 'JEE' : e.includes('CET') ? 'CET' : 'OTHER'] += 1; });
        return SLICES.map(s => ({ ...s, n: counts[s.key] }));
    }, [papers]);

    const activity = useMemo(() => {
        const items = [
            ...papers.map(p => ({ id: `p-${p._id || p.id}`, kind: 'paper', at: p.createdAt || p.created_at, title: p.title || 'Untitled paper', sub: `${p.subject || 'Paper'} · ${examOf(p) || 'PAPER'} · ${p.questions?.length || 0} Qs`, open: () => onOpenPaper(p) })),
            ...exams.map(e => ({ id: `e-${e._id || e.id}`, kind: 'exam', at: e.createdAt || e.created_at, title: e.title, sub: `Commissioned ${e.examType || ''} exam`, open: () => go('/admin/dashboard') })),
        ].filter(x => x.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
        return items;
    }, [papers, exams, onOpenPaper, go]);

    const pinnedPapers = papers.filter(p => pinned.has(String(p._id || p.id))).slice(0, 5);

    const shortcuts = [
        { label: 'New paper', Icon: FilePlus2, to: '/admin/dashboard/create-paper', tone: 'from-emerald-500 to-teal-600' },
        { label: 'Scan OMR', Icon: ScanLine, to: '/admin/dashboard/omr', tone: 'from-sky-500 to-blue-600' },
        { label: 'Question bank', Icon: Database, to: '/admin/dashboard/questions', tone: 'from-indigo-500 to-violet-600' },
        { label: 'Online exams', Icon: Zap, to: '/admin/dashboard/cbt-exams', tone: 'from-amber-400 to-orange-500' },
        { label: 'Results', Icon: BarChart3, to: '/admin/dashboard/results', tone: 'from-rose-500 to-pink-600' },
    ];

    return (
        <section className="space-y-5" aria-label="Command center">
            {/* one-tap shortcuts */}
            {!side && showShortcuts && <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {shortcuts.map(({ label, Icon, to, tone }, i) => (
                    <motion.button key={label} type="button" onClick={() => go(to)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                        transition={{ ...SPRING.soft, delay: i * 0.04 }}
                        className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-3 text-left cursor-pointer hover:shadow-lg hover:shadow-blue-950/10">
                        <span className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow-lg`}><Icon size={20} /></span>
                        <span className="font-extrabold text-[#081b3b] text-sm">{label}</span>
                        <ArrowUpRight size={16} className="ml-auto text-slate-300 group-hover:text-[#081b3b] transition-colors" />
                    </motion.button>
                ))}
            </div>}

            <div className={side ? 'grid grid-cols-1 gap-5' : 'grid grid-cols-1 xl:grid-cols-3 gap-5'}>
                {/* papers by exam */}
                <div className="surface p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-extrabold text-[#081b3b] flex items-center gap-2"><Sparkles size={17} className="text-amber-500" /> Papers by exam</h4>
                    </div>
                    <div className="flex items-center gap-6 flex-wrap">
                        <Donut parts={parts} total={papers.length} />
                        <ul className="space-y-2.5 flex-1 min-w-[150px]">
                            {parts.map(s => (
                                <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
                                    <span className="flex items-center gap-2 font-bold text-slate-600"><span className="w-3 h-3 rounded-full" style={{ background: s.colour }} />{s.label}</span>
                                    <span className="font-extrabold text-[#081b3b]">{s.n}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* activity */}
                <div className="surface p-5">
                    <h4 className="text-base font-extrabold text-[#081b3b] flex items-center gap-2 mb-4"><Clock size={17} className="text-amber-500" /> Recent activity</h4>
                    {activity.length === 0 ? (
                        <p className="text-sm text-slate-400 font-medium py-6 text-center">Nothing yet — saved papers and commissioned exams show up here.</p>
                    ) : (
                        <ol className="relative space-y-4 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                            {activity.map((a, i) => (
                                <motion.li key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.soft, delay: i * 0.05 }}>
                                    <button type="button" onClick={a.open} className="relative w-full flex items-start gap-3 text-left cursor-pointer group">
                                        <span className={`relative z-10 w-9 h-9 shrink-0 rounded-full flex items-center justify-center ring-4 ring-white ${a.kind === 'exam' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                            {a.kind === 'exam' ? <ClipboardList size={16} /> : <FileText size={16} />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-extrabold text-[#081b3b] truncate group-hover:text-blue-700">{a.title}</span>
                                            <span className="block text-xs text-slate-500 font-medium truncate">{a.sub}</span>
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-400 shrink-0 pt-0.5">{when(a.at)}</span>
                                    </button>
                                </motion.li>
                            ))}
                        </ol>
                    )}
                </div>

                {/* pinned */}
                <div className="surface p-5">
                    <h4 className="text-base font-extrabold text-[#081b3b] flex items-center gap-2 mb-4"><Star size={17} className="text-amber-500 fill-amber-400" /> Pinned papers</h4>
                    {pinnedPapers.length === 0 ? (
                        <div className="py-6 text-center">
                            <span className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3"><Star size={22} /></span>
                            <p className="text-sm font-bold text-[#081b3b]">Keep your key papers one tap away</p>
                            <p className="text-xs text-slate-500 mt-1">Click the star on any saved paper to pin it here.</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {pinnedPapers.map(p => {
                                const id = String(p._id || p.id);
                                return (
                                    <li key={id} className="group flex items-center gap-3 rounded-2xl bg-slate-50 hover:bg-amber-50 px-3 py-2.5 transition-colors">
                                        <button type="button" onClick={() => onOpenPaper(p)} className="min-w-0 flex-1 text-left cursor-pointer">
                                            <span className="block text-sm font-extrabold text-[#081b3b] truncate">{p.title || 'Untitled paper'}</span>
                                            <span className="block text-xs text-slate-500 font-medium truncate">{p.subject || 'Paper'} · {examOf(p)} · {p.questions?.length || 0} Qs</span>
                                        </button>
                                        <button type="button" onClick={() => onTogglePin(id)} aria-label="Unpin" title="Unpin" className="w-8 h-8 rounded-lg text-amber-500 hover:bg-white flex items-center justify-center cursor-pointer"><Star size={16} className="fill-amber-400" /></button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
