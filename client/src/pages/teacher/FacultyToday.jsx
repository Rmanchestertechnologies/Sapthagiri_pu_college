import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sun, Sunrise, Moon, FilePlus2, FileClock, FolderOpen, Star, ArrowRight, Flame } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { AnimatedNumber, SPRING } from '../../ui/motion';

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
        { label: 'Papers saved', value: list.length, Icon: FolderOpen },
        { label: 'Drafts to finish', value: drafts, Icon: FileClock },
        { label: 'Created this week', value: thisWeek, Icon: Flame },
        { label: 'Pinned', value: list.filter(p => pinned.has(String(p._id || p.id))).length, Icon: Star },
    ];

    return (
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#081b3b] via-[#0b2552] to-[#123a7a] text-white p-6 sm:p-8 shadow-[0_30px_70px_-34px_rgba(8,27,59,0.7)] mb-6">
            <span aria-hidden="true" className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl" />
            <span aria-hidden="true" className="absolute -left-10 -bottom-24 w-64 h-64 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="relative grid lg:grid-cols-[1.1fr_1fr] gap-8">
                <div>
                    <p className="flex items-center gap-2 text-amber-300 text-xs font-extrabold uppercase tracking-[0.16em]"><Icon size={15} /> {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight !normal-case !text-white !text-[2.1rem] leading-tight">{text}, {first}.</h2>
                    <p className="mt-2 text-white/60 font-medium max-w-md">Pick up a draft, or start a fresh {user?.subject ? `${user.subject} ` : ''}paper — the wizard builds it for you.</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={SPRING.press} onClick={() => navigate('/teacher/create-paper')}
                            className="h-12 px-6 rounded-2xl bg-gradient-to-r from-amber-300 to-amber-500 text-[#081b3b] text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"><FilePlus2 size={17} /> Create a paper</motion.button>
                        <button type="button" onClick={() => navigate('/teacher/dashboard/saved-papers')}
                            className="h-12 px-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer"><FolderOpen size={16} /> Saved papers</button>
                    </div>
                    <dl className="mt-7 grid grid-cols-2 2xl:grid-cols-4 gap-3">
                        {stats.map(({ label, value, Icon: StatIcon }) => (
                            <div key={label} className="rounded-2xl bg-white/[0.07] border border-white/10 px-3.5 py-3">
                                <dt className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white/50"><StatIcon size={12} /> {label}</dt>
                                <dd className="text-2xl font-extrabold"><AnimatedNumber value={papers ? value : 0} /></dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <div className="rounded-3xl bg-white/[0.07] border border-white/10 p-5 backdrop-blur">
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/55 mb-3">Pick up where you left off</p>
                    {papers === null && <p className="text-sm text-white/50 py-6 text-center">Loading your papers…</p>}
                    {papers !== null && recent.length === 0 && (
                        <div className="py-6 text-center">
                            <p className="font-bold">No papers yet</p>
                            <p className="text-sm text-white/55 mt-1">Your first paper takes about a minute.</p>
                        </div>
                    )}
                    <ul className="space-y-2">
                        {recent.map((p, i) => {
                            const id = p._id || p.id;
                            return (
                                <motion.li key={id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.soft, delay: i * 0.05 }}>
                                    <button type="button" onClick={() => navigate(`/teacher/create-paper?paperId=${id}`)} className="group w-full flex items-center gap-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.14] px-3.5 py-3 text-left cursor-pointer transition-colors">
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-bold truncate">{p.title || 'Untitled paper'}</span>
                                            <span className="block text-xs text-white/50 truncate">{p.subject || 'Paper'} · {p.questions?.length || p.totalQuestions || 0} questions · {when(p.createdAt || p.created_at)}</span>
                                        </span>
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2 py-1 bg-amber-400/20 text-amber-300">{p.status || 'Draft'}</span>
                                        <ArrowRight size={16} className="text-white/40 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
                                    </button>
                                </motion.li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </section>
    );
}
