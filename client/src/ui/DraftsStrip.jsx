import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, ArrowRight, X } from 'lucide-react';
import api from '../api';
import { SPRING } from './motion';

const ago = (iso) => {
    const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
};

/** "Unfinished papers": drafts saved automatically by the paper wizard, one tap to continue (or discard). Renders nothing when there are none. */
export default function DraftsStrip() {
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState([]);

    const load = useCallback(() => {
        api.get('/api/drafts').then(r => setDrafts(Array.isArray(r.data) ? r.data : [])).catch(() => setDrafts([]));
    }, []);
    useEffect(() => { load(); }, [load]);

    const discard = async (key) => {
        setDrafts(d => d.filter(x => x.key !== key));
        try { await api.delete(`/api/drafts/${key}`); } catch { load(); }
    };

    if (!drafts.length) return null;
    return (
        <section aria-label="Unfinished papers" className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-4 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-[#1e1b4b]"><PenLine size={16} className="text-indigo-600" /> Unfinished {drafts.length === 1 ? 'paper' : 'papers'} — saved automatically</p>
            <ul className="mt-3 space-y-2">
                <AnimatePresence initial={false}>
                    {drafts.map((d) => (
                        <motion.li key={d.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING.soft}
                            className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3">
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-900 truncate">{d.meta?.title || 'Unfinished paper'}</span>
                                <span className="block text-xs text-slate-600">{[d.meta?.subject, d.meta?.step ? `step ${d.meta.step}` : '', d.meta?.questions ? `${d.meta.questions} questions picked` : '', `saved ${ago(d.updatedAt)}`].filter(Boolean).join(' · ')}</span>
                            </span>
                            <button type="button" onClick={() => navigate(d.meta?.resumeUrl || '/teacher/create-paper')}
                                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer">Continue <ArrowRight size={15} /></button>
                            <button type="button" onClick={() => discard(d.key)} aria-label="Discard this draft" title="Discard"
                                className="w-9 h-9 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center cursor-pointer"><X size={16} /></button>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        </section>
    );
}
