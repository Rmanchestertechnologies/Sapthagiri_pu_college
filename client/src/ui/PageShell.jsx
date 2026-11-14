import { motion } from 'framer-motion';
import { SPRING } from './motion';

const GLOWS = {
    amber: 'bg-amber-400/25',
    indigo: 'bg-indigo-400/25',
    emerald: 'bg-emerald-400/25',
    rose: 'bg-rose-400/25',
    sky: 'bg-sky-400/25',
};

/**
 * Standard frame for the list / library pages: a gradient hero banner (icon, title, one-line purpose, the page's actions) over a
 * calm content area. The hero's buttons are restyled by `.page-hero-actions` in theme.css so existing buttons keep working.
 */
export default function PageShell({ icon: Icon, title, subtitle, actions, tone = 'amber', children }) {
    return (
        <div className="space-y-6">
            <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}
                className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#081b3b] via-[#0b2552] to-[#123a7a] text-white p-6 sm:p-8 shadow-[0_30px_70px_-34px_rgba(8,27,59,0.7)]">
                <span aria-hidden="true" className={`absolute -right-14 -top-16 w-64 h-64 rounded-full blur-3xl ${GLOWS[tone] || GLOWS.amber}`} />
                <span aria-hidden="true" className="absolute -left-10 -bottom-20 w-56 h-56 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4 min-w-0">
                        {Icon && <span className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#081b3b] flex items-center justify-center shadow-xl shadow-amber-500/25"><Icon size={26} /></span>}
                        <div className="min-w-0">
                            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight !normal-case !text-white !text-[1.7rem]">{title}</h2>
                            {subtitle && <p className="mt-1 text-sm text-white/60 font-medium">{subtitle}</p>}
                        </div>
                    </div>
                    {actions && <div className="page-hero-actions flex items-center gap-2.5 flex-wrap">{actions}</div>}
                </div>
            </motion.header>
            <div className="space-y-6 page-body">{children}</div>
        </div>
    );
}
