import { motion } from 'framer-motion';
import { SPRING } from './motion';

const CHIPS = {
    amber: 'bg-amber-100 text-amber-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    rose: 'bg-rose-100 text-rose-600',
    sky: 'bg-sky-100 text-sky-600',
};

/**
 * Standard frame for the list / library pages: a calm header (icon, title, one-line purpose, the page's actions) over the content.
 * The header's buttons are restyled by `.page-hero-actions` in theme.css so the existing buttons keep working.
 */
export default function PageShell({ icon: Icon, title, subtitle, actions, tone = 'amber', children }) {
    const chip = CHIPS[tone] || CHIPS.amber;
    return (
        <div className="space-y-6">
            <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                    {Icon && <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${chip}`}><Icon size={20} /></span>}
                    <div className="min-w-0">
                        <h2 className="text-2xl font-bold tracking-tight text-[#1e1b4b] !normal-case !text-[1.6rem]">{title}</h2>
                        {subtitle && <p className="mt-0.5 text-sm text-slate-500 font-medium">{subtitle}</p>}
                    </div>
                </div>
                {actions && <div className="page-hero-actions flex items-center gap-2.5 flex-wrap">{actions}</div>}
            </motion.header>
            <div className="space-y-6 page-body">{children}</div>
        </div>
    );
}
