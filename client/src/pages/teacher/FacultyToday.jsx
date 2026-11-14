import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sun, Sunrise, Moon, FilePlus2, FileClock, FolderOpen, Star, ArrowRight, Flame } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { AnimatedNumber, SPRING } from '../../ui/motion';
import DraftsStrip from '../../ui/DraftsStrip';

const greeting = (d) => {
    const h = d.getHours();
    if (h < 5) return { text: 'Working late', Icon: Moon };
    if (h < 12) return { text: 'Good morning', Icon: Sunrise };
    if (h < 17) return { text: 'Good afternoon', Icon: Sun };
    return { text: 'Good evening', Icon: Moon };
};

const when = (value) => {
    const t = new Date(value || 0).getTime();
    if (!t) return '';
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
    return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** "Your day" band at the top of the faculty home: greeting, your numbers, and the papers to pick up where you left off. */
export default function FacultyToday() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [papers, setPapers] = useState(null);
    const now = new Date();
    const { text, Icon } = greeting(now);
    const first = String(user?.name || 'there').split(' ')[0];

    useEffect(() => {
        let alive = true;
        api.get('/api/papers').then(res => { if (alive) setPapers(Array.isArray(res.data) ? res.data : (res.data?.papers || [])); }).catch(() => { if (alive) setPapers([]); });
        return () => { alive = false; };
    }, []);

    const pinned = useMemo(() => {
        try { return new Set(JSON.parse(localStorage.getItem('pinned-papers') || '[]').map(String)); } catch { return new Set(); }
    }, []);
    const list = useMemo(() => [...(papers || [])].sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)), [papers]);
    const drafts = list.filter(p => String(p.status || 'Draft').toLowerCase() === 'draft').length;
    const thisWeek = list.filter(p => Date.now() - new Date(p.createdAt || p.created_at || 0).getTime() < 7 * 86400000).length;
    const recent = list.slice(0, 4);

    const stats = [
        { label: 'Papers saved', value: list.length, Icon: FolderOpen, tone: 'bg-indigo-50 text-indigo-600' },
        { label: 'Drafts to finish', value: drafts, Icon: FileClock, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Created this week', value: thisWeek, Icon: Flame, tone: 'bg-rose-50 text-rose-600' },
        { label: 'Pinned papers', value: list.filter(p => pinned.has(String(p._id || p.id))).length, Icon: Star, tone: 'bg-emerald-50 text-emerald-600' },
    ];

    return (
        <section className="mb-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-2"><Icon size={14} className="text-indigo-500" /> {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h2 className="font-display mt-1 text-[28px] sm:text-[34px] tracking-tight text-[#1e1b4b] !normal-case">{text}, {first}</h2>
                    <p className="mt-1 text-sm text-slate-500">Pick up a draft, or start a fresh {user?.subject ? `${user.subject} ` : ''}paper — the wizard builds it for you.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button type="button" onClick={() => navigate('/teacher/dashboard/saved-papers')}
                        className="h-10 px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-[#1e1b4b] text-[13px] font-semibold flex items-center gap-2 cursor-pointer shadow-sm"><FolderOpen size={15} className="text-indigo-500" /> Saved papers</button>
                    <button type="button" onClick={() => navigate('/teacher/create-paper')}
                        className="h-10 px-4 rounded-xl bg-[#1e1b4b] hover:bg-[#312e81] text-white text-[13px] font-semibold flex items-center gap-2 cursor-pointer shadow-sm"><FilePlus2 size={15} className="text-indigo-400" /> Create a paper</button>
                </div>
            </div>

            <DraftsStrip />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map(({ label, value, Icon: StatIcon, tone }) => (
                    <div key={label} className="rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-slate-500">{label}</span>
                            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}><StatIcon size={17} /></span>
                        </div>
                        <p className="font-display mt-3 text-[34px] leading-none tracking-tight text-[#1e1b4b]"><AnimatedNumber value={papers ? value : 0} /></p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[15px] font-bold text-[#1e1b4b]">Pick up where you left off</h3>
                    <button type="button" onClick={() => navigate('/teacher/dashboard/saved-papers')} className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">View all</button>
                </div>
                {papers === null && <p className="text-sm text-slate-400 py-6 text-center">Loading your papers…</p>}
                {papers !== null && recent.length === 0 && (
                    <div className="py-8 text-center">
                        <p className="font-semibold text-[#1e1b4b]">No papers yet</p>
                        <p className="text-sm text-slate-500 mt-1">Your first paper takes about a minute.</p>
                    </div>
                )}
                <ul className="divide-y divide-slate-100">
                    {recent.map((p, i) => {
                        const id = p._id || p.id;
                        return (
                            <motion.li key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: i * 0.04 }}>
                                <button type="button" onClick={() => navigate(`/teacher/create-paper?paperId=${id}`)} className="group w-full flex items-center gap-3 py-3 text-left cursor-pointer">
                                    <span className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"><FileClock size={16} /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-[#1e1b4b] truncate">{p.title || 'Untitled paper'}</span>
                                        <span className="block text-xs text-slate-500 truncate">{p.subject || 'Paper'} · {p.questions?.length || p.totalQuestions || 0} questions · {when(p.createdAt || p.created_at)}</span>
                                    </span>
                                    <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-50 text-amber-700">{p.status || 'Draft'}</span>
                                    <ArrowRight size={16} className="text-slate-300 group-hover:text-[#1e1b4b] group-hover:translate-x-0.5 transition-all" />
                                </button>
                            </motion.li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
