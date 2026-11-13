import { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { LayoutDashboard, FilePlus2, ScanLine, Zap, BarChart3, Database, Trophy, Archive, Ruler, FileText, Menu, LogOut, ChevronLeft, X } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import { AdminNotificationBell } from './AdminNotificationBell';
import { SPRING } from '../../../ui/motion';

export const ADMIN_NAV = [
    {
        group: 'Examination operations',
        items: [
            { title: 'Executive Overview', path: '/admin/dashboard', Icon: LayoutDashboard, desc: 'Delegation and readiness' },
            { title: 'Create Question Paper', path: '/admin/dashboard/create-paper', Icon: FilePlus2, desc: 'Single or mixed-subject papers' },
            { title: 'OMR Evaluation & Scanner', path: '/admin/dashboard/omr', Icon: ScanLine, desc: 'Scan OMR sheets, merit lists' },
            { title: 'CBT Online Exams', path: '/admin/dashboard/cbt-exams', Icon: Zap, desc: 'Manage and monitor online exams' },
            { title: 'Results & Scorecards', path: '/admin/dashboard/results', Icon: BarChart3, desc: 'Student scores and analytics' },
        ],
    },
    {
        group: 'Academic vault',
        items: [
            { title: 'Question Bank', path: '/admin/dashboard/questions', Icon: Database, desc: 'Institutional question repository' },
            { title: 'Grand Test Papers', path: '/admin/dashboard/grand-tests', Icon: Trophy, desc: 'Official grand tests archive' },
            { title: 'Previous Year Papers', path: '/admin/dashboard/previous-year-papers', Icon: Archive, desc: 'PYQs and keys' },
            { title: 'Exam Blueprints', path: '/admin/dashboard/exam-blueprints', Icon: Ruler, desc: 'Chapter weightage and patterns' },
            { title: 'Document Templates', path: '/admin/dashboard/upload-template', Icon: FileText, desc: 'Paper formatting templates' },
        ],
    },
];

const isActivePath = (pathname, itemPath) => (itemPath === '/admin/dashboard'
    ? (pathname === '/admin/dashboard' || pathname === '/admin/dashboard/')
    : pathname.includes(itemPath.split('/').pop()));

export function pageTitleFor(pathname) {
    if (pathname.includes('create-paper')) return 'Create Question Paper';
    if (pathname.includes('omr')) return 'OMR Sheet Evaluation';
    if (pathname.includes('cbt-exams')) return 'CBT Online Exams';
    if (pathname.includes('results')) return 'Result Scorecards';
    if (pathname.includes('questions')) return 'Question Bank';
    if (pathname.includes('grand-tests')) return 'Grand Tests';
    if (pathname.includes('previous-year-papers')) return 'Previous Year Papers';
    if (pathname.includes('exam-blueprints')) return 'Exam Blueprints';
    if (pathname.includes('upload-template')) return 'Templates';
    if (pathname.includes('preview')) return 'Paper Preview';
    return 'Executive Overview';
}

function SidebarBody({ onNavigate, onClose }) {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-[#071738] to-[#050e1f] text-white">
            <div className="p-5 flex items-center justify-between gap-3">
                <button type="button" onClick={() => onNavigate('/admin/dashboard')} className="flex items-center gap-3 min-w-0 text-left cursor-pointer">
                    <span className="w-11 h-11 shrink-0 rounded-2xl bg-white p-1 shadow-lg"><img src="/SapthagiriLogo.jpg" alt="" className="w-full h-full object-contain rounded-xl" /></span>
                    <span className="min-w-0">
                        <span className="block text-sm font-extrabold leading-tight truncate">Sapthagiri PU College</span>
                        <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-400">Admin portal</span>
                    </span>
                </button>
                {onClose && (
                    <button type="button" onClick={onClose} aria-label="Close menu" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"><X size={17} /></button>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6" aria-label="Admin sections">
                <LayoutGroup id={onClose ? 'admin-nav-drawer' : 'admin-nav'}>
                    {ADMIN_NAV.map(group => (
                        <div key={group.group}>
                            <p className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">{group.group}</p>
                            <ul className="space-y-0.5">
                                {group.items.map(({ title, path, Icon, desc }) => {
                                    const active = isActivePath(location.pathname, path);
                                    return (
                                        <li key={path}>
                                            <button type="button" onClick={() => onNavigate(path)} aria-current={active ? 'page' : undefined}
                                                className={`relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer transition-colors ${active ? 'text-[#081b3b]' : 'text-white/75 hover:text-white hover:bg-white/5'}`}>
                                                {active && <motion.span layoutId="admin-nav-pill" transition={SPRING.bouncy} className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 shadow-lg shadow-amber-500/20" />}
                                                <Icon size={18} className="relative shrink-0" />
                                                <span className="relative min-w-0">
                                                    <span className="block text-[13px] font-bold leading-tight truncate">{title}</span>
                                                    <span className={`block text-[11px] truncate ${active ? 'text-[#081b3b]/70' : 'text-white/40'}`}>{desc}</span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </LayoutGroup>
            </nav>

            <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-amber-400 text-[#081b3b] text-xs font-extrabold flex items-center justify-center shrink-0">AD</span>
                    <span className="min-w-0"><span className="block text-xs font-bold truncate">Admin console</span><span className="block text-[10px] text-white/40 truncate">Davanagere campus</span></span>
                </div>
                <button type="button" onClick={() => { logout(); navigate('/'); }} aria-label="Sign out" title="Sign out"
                    className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white flex items-center justify-center cursor-pointer"><LogOut size={16} /></button>
            </div>
        </div>
    );
}

/**
 * Admin frame: a permanent left sidebar on wide screens (a slide-in drawer on small ones) and a slim glass top bar with the page
 * title, back button and notifications. The paper wizard (create-paper) has its own left column, so there the sidebar becomes the drawer.
 */
export function AdminShell({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [drawer, setDrawer] = useState(false);
    const wizardRoute = location.pathname.includes('create-paper');
    const atHome = location.pathname === '/admin/dashboard' || location.pathname === '/admin/dashboard/';

    useEffect(() => { setDrawer(false); }, [location.pathname]);
    useEffect(() => {
        if (!drawer) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawer]);

    const go = (path) => { navigate(path); setDrawer(false); };

    return (
        <div className="min-h-screen font-sans">
            {!wizardRoute && (
                <aside className="hidden lg:block fixed inset-y-0 left-0 w-[272px] z-30 no-print shadow-2xl shadow-blue-950/20"><SidebarBody onNavigate={go} /></aside>
            )}

            <AnimatePresence>
                {drawer && (
                    <motion.div className="fixed inset-0 z-50 no-print" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
                        <motion.aside className="absolute inset-y-0 left-0 w-[300px] max-w-[86vw] shadow-2xl" initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={SPRING.island}>
                            <SidebarBody onNavigate={go} onClose={() => setDrawer(false)} />
                        </motion.aside>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={wizardRoute ? '' : 'lg:pl-[272px]'}>
                <header className="glass sticky top-0 z-20 no-print border-x-0 border-t-0 rounded-none">
                    <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu"
                                className={`w-10 h-10 shrink-0 rounded-xl bg-[#081b3b] text-amber-400 flex items-center justify-center cursor-pointer ${wizardRoute ? '' : 'lg:hidden'}`}><Menu size={19} /></button>
                            {!atHome && (
                                <button type="button" onClick={() => navigate('/admin/dashboard')} aria-label="Back to dashboard" title="Back to dashboard"
                                    className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#081b3b] flex items-center justify-center cursor-pointer"><ChevronLeft size={18} /></button>
                            )}
                            <div className="min-w-0">
                                <p className="eyebrow">Admin portal</p>
                                <h1 className="text-lg font-extrabold text-[#081b3b] truncate">{pageTitleFor(location.pathname)}</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0"><AdminNotificationBell /></div>
                    </div>
                </header>
                <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full min-w-0">{children}</div>
            </div>
        </div>
    );
}
