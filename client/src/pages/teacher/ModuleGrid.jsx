import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, FilePlus2, Database, NotebookPen, FolderOpen, Trophy, ScanLine, ArrowUpRight } from 'lucide-react';
import { SPRING } from '../../ui/motion';

/**
 * Faculty home: two primary actions up front, the rest as one consistent set of cards (one icon set, one shape,
 * one hover behaviour). `hasOmr` adds the OMR card only for people the admin has given OMR access.
 */
const SECONDARY = [
    { to: '/teacher/create-paper', title: 'Create a paper', desc: 'Step-by-step wizard', Icon: FilePlus2, tone: 'emerald' },
    { to: '/teacher/commissioned-exam', title: 'Commissioned exam', desc: 'Official multi-step exam', Icon: ClipboardList, tone: 'sky' },
    { to: '/teacher/dashboard/add-question', title: 'Question bank', desc: 'Add and manage questions', Icon: Database, tone: 'indigo' },
    { to: '/teacher/dashboard/assignments', title: 'Assignments', desc: 'Practice sheets and keys', Icon: NotebookPen, tone: 'amber' },
    { to: '/teacher/dashboard/saved-papers', title: 'Saved papers', desc: 'Your drafts and finished papers', Icon: FolderOpen, tone: 'sky' },
    { to: '/teacher/dashboard/grand-tests', title: 'Grand tests', desc: 'Grand test paper archives', Icon: Trophy, tone: 'rose' },
];

const OMR = { to: '/teacher/dashboard/omr', title: 'OMR evaluation', desc: 'Scan sheets and see analytics', Icon: ScanLine, tone: 'emerald' };

const TONES = {
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-indigo-500 group-hover:text-white',
    sky: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white',
    rose: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: SPRING.soft } };

export default function ModuleGrid({ hasOmr = false }) {
    const secondary = hasOmr ? [...SECONDARY, OMR] : SECONDARY;
    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                {secondary.map(({ to, title, desc, Icon, tone }) => (
                    <motion.div key={to} variants={item} whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }} transition={SPRING.press}>
                        <Link to={to} className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-shadow">
                            <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-colors ${TONES[tone]}`}>
                                <Icon size={21} strokeWidth={2.1} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-black text-navy">{title}</span>
                                <span className="block text-xs text-slate-500 font-medium truncate">{desc}</span>
                            </span>
                            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-navy group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </Link>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
