import { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { LayoutDashboard, FilePlus2, ScanLine, Zap, BarChart3, Database, Trophy, Archive, Ruler, FileText, Menu, LogOut, ChevronLeft, ChevronsLeft, ChevronsRight, X, Search, Command } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import { AdminNotificationBell } from './AdminNotificationBell';
import { SPRING, CommandPalette, useCommandShortcut } from '../../../ui/motion';

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

const isActivePath = (pathname, itemPath, home) => (itemPath === home
    ? (pathname === home || pathname === `${home}/`)
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

const RAIL = 84;
const FULL = 268;

function useIsDesktop() {
    const query = '(min-width: 1024px)';
    const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : true));
    useEffect(() => {
        const mq = window.matchMedia(query);
        const on = () => setWide(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return wide;
}

function SidebarBody({ onNavigate, onClose, cfg, collapsed = false, onToggle, onSearch }) {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const slim = collapsed && !onClose; // the drawer is always full width

    return (
        <div className="relative h-full flex flex-col text-white overflow-hidden"
            style={{ background: 'linear-gradient(180deg,#0b1f45 0%,#071636 55%,#050e24 100%)' }}>
            <span aria-hidden="true" className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full bg-amber-400/20 blur-3xl" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-10 -right-20 w-56 h-56 rounded-full bg-sky-500/15 blur-3xl" />

            {/* brand */}
            <div className={`relative flex items-center ${slim ? 'justify-center px-3 pt-5 pb-3' : 'justify-between gap-3 px-5 pt-5 pb-3'}`}>
                <button type="button" onClick={() => onNavigate(cfg.home)} className="flex items-center gap-3 min-w-0 text-left cursor-pointer" aria-label="Home">
                    <span className="relative w-11 h-11 shrink-0 rounded-2xl bg-white p-1 shadow-xl shadow-black/30 ring-2 ring-amber-400/70">
                        <img src="/SapthagiriLogo.jpg" alt="" className="w-full h-full object-contain rounded-xl" />
                    </span>
                    {!slim && (
                        <span className="min-w-0">
                            <span className="block text-[15px] font-extrabold leading-tight truncate">Sapthagiri PU College</span>
                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-400 truncate">{cfg.portal}</span>
                        </span>
                    )}
                </button>
                {onClose && (
                    <button type="button" onClick={onClose} aria-label="Close menu" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"><X size={17} /></button>
                )}
            </div>

            {/* search */}
            <div className={`relative ${slim ? 'px-3' : 'px-4'} pb-3`}>
                <button type="button" onClick={onSearch} title="Search or jump to (Ctrl K)"
                    className={`w-full flex items-center ${slim ? 'justify-center h-11' : 'gap-2.5 px-3.5 h-11'} rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-white/60 hover:text-white cursor-pointer transition-colors`}>
                    <Search size={16} className="shrink-0" />
                    {!slim && (<><span className="text-[13px] font-semibold flex-1 text-left">Search or jump to…</span><kbd className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70 flex items-center gap-0.5"><Command size={9} />K</kbd></>)}
                </button>
            </div>

            {/* nav */}
            <nav className={`relative flex-1 overflow-y-auto ${slim ? 'overflow-x-visible px-3' : 'overflow-x-hidden px-3.5'} pb-4 space-y-5`} aria-label="Sections">
                <LayoutGroup id={onClose ? `${cfg.id}-nav-drawer` : `${cfg.id}-nav`}>
                    {cfg.nav.map(group => (
                        <div key={group.group}>
                            {slim
                                ? <div className="mx-auto mb-2 h-px w-8 bg-white/10" />
                                : <p className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35">{group.group}</p>}
                            <ul className="space-y-1">
                                {group.items.map(({ title, path, Icon, desc }) => {
                                    const active = isActivePath(location.pathname, path, cfg.home);
                                    return (
                                        <li key={path} className="relative">
                                            <button type="button" onClick={() => onNavigate(path)} aria-current={active ? 'page' : undefined} title={slim ? title : undefined}
                                                className={`group/item relative w-full flex items-center ${slim ? 'justify-center p-1.5' : 'gap-3 pl-1.5 pr-3 py-1.5'} rounded-2xl text-left cursor-pointer transition-colors ${active ? 'text-white' : 'text-white/70 hover:text-white'}`}>
                                                {active && <motion.span layoutId={`${cfg.id}-nav-pill`} transition={SPRING.bouncy} className="absolute inset-0 rounded-2xl bg-white/[0.09] border border-white/15 shadow-[0_8px_24px_-10px_rgba(245,158,11,0.45)]" />}
                                                {active && !slim && <motion.span layoutId={`${cfg.id}-nav-bar`} transition={SPRING.bouncy} className="absolute -left-3.5 top-2.5 bottom-2.5 w-1 rounded-r-full bg-amber-400" />}
                                                <span className={`relative w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${active
                                                    ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-[#081b3b] shadow-lg shadow-amber-500/30'
                                                    : 'bg-white/[0.06] group-hover/item:bg-white/[0.12]'}`}>
                                                    <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                                                </span>
                                                {!slim && (
                                                    <span className="relative min-w-0">
                                                        <span className="block text-[13.5px] font-bold leading-tight truncate">{title}</span>
                                                        <span className={`block text-[11px] truncate ${active ? 'text-white/55' : 'text-white/35'}`}>{desc}</span>
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </LayoutGroup>
            </nav>

            {cfg.actions && cfg.actions.length > 0 && (
                <div className={`relative ${slim ? 'px-3' : 'px-3.5'} pb-3 space-y-1`}>
                    {cfg.actions.map(({ title, Icon, desc, run }) => (
                        <button key={title} type="button" title={slim ? title : undefined} onClick={() => { run(); if (onClose) onClose(); }}
                            className={`w-full flex items-center ${slim ? 'justify-center p-1.5' : 'gap-3 pl-1.5 pr-3 py-1.5'} rounded-2xl text-left cursor-pointer text-white/70 hover:text-white hover:bg-white/5`}>
                            <span className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.06] flex items-center justify-center"><Icon size={19} /></span>
                            {!slim && <span className="min-w-0"><span className="block text-[13.5px] font-bold leading-tight truncate">{title}</span><span className="block text-[11px] text-white/35 truncate">{desc}</span></span>}
                        </button>
                    ))}
                </div>
            )}

            {/* user */}
            <div className={`relative ${slim ? 'px-3' : 'px-4'} pb-4`}>
                <div className={`rounded-2xl bg-white/[0.07] border border-white/10 ${slim ? 'p-2 flex flex-col items-center gap-2' : 'p-3 flex items-center gap-3'}`}>
                    <span className="relative w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[#081b3b] text-xs font-extrabold flex items-center justify-center">
                        {cfg.user.initials}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#071636]" aria-hidden="true" />
                    </span>
                    {!slim && <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold truncate">{cfg.user.name}</span><span className="block text-[11px] text-white/45 truncate">{cfg.user.sub}</span></span>}
                    <button type="button" onClick={() => { logout(); navigate('/'); }} aria-label="Sign out" title="Sign out"
                        className="w-9 h-9 shrink-0 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white flex items-center justify-center cursor-pointer"><LogOut size={16} /></button>
                </div>
                {onToggle && (
                    <button type="button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className="mt-2 w-full h-9 rounded-xl text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer">
                        {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Portal frame: a floating glass sidebar on wide screens (collapses to an icon rail; a slide-in drawer on small ones), a slim glass
 * top bar with the page title / back button / notifications, and a Ctrl+K palette that jumps to any section. The paper wizard
 * (create-paper) has its own left column, so there the sidebar becomes the drawer.
 */
export function PortalShell({ cfg, children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const wide = useIsDesktop();
    const [drawer, setDrawer] = useState(false);
    const [palette, setPalette] = useState(false);
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem('portal-sidebar-collapsed') === '1'; } catch { return false; }
    });
    const wizardRoute = location.pathname.includes('create-paper');
    const atHome = location.pathname === cfg.home || location.pathname === `${cfg.home}/`;

    useEffect(() => { setDrawer(false); }, [location.pathname]);
    useEffect(() => {
        if (!drawer) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawer]);

    const toggleCollapsed = () => setCollapsed(c => {
        const next = !c;
        try { localStorage.setItem('portal-sidebar-collapsed', next ? '1' : '0'); } catch { /* storage unavailable */ }
        return next;
    });
    const togglePalette = useCallback(() => setPalette(o => !o), []);
    useCommandShortcut(togglePalette);

    const go = (path) => { navigate(path); setDrawer(false); };
    const commands = useMemo(() => [
        ...cfg.nav.flatMap(g => g.items.map(i => ({ id: i.path, label: i.title, hint: g.group, run: () => navigate(i.path) }))),
        ...(cfg.actions || []).map(a => ({ id: `act-${a.title}`, label: a.title, hint: 'open', run: a.run })),
    ], [cfg, navigate]);

    const sidebarW = collapsed ? RAIL : FULL;
    const showSidebar = wide && !wizardRoute;

    return (
        <div className="min-h-screen font-sans">
            {showSidebar && (
                <motion.aside className="fixed top-3 bottom-3 left-3 z-30 no-print rounded-[28px] shadow-[0_30px_70px_-20px_rgba(5,14,36,0.7)] ring-1 ring-white/10"
                    initial={false} animate={{ width: sidebarW }} transition={SPRING.soft}>
                    <div className="h-full rounded-[28px] overflow-hidden">
                        <SidebarBody onNavigate={go} cfg={cfg} collapsed={collapsed} onToggle={toggleCollapsed} onSearch={() => setPalette(true)} />
                    </div>
                </motion.aside>
            )}

            <AnimatePresence>
                {drawer && (
                    <motion.div className="fixed inset-0 z-50 no-print" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
                        <motion.aside className="absolute top-3 bottom-3 left-3 w-[300px] max-w-[86vw] rounded-[28px] overflow-hidden shadow-2xl" initial={{ x: -330 }} animate={{ x: 0 }} exit={{ x: -330 }} transition={SPRING.island}>
                            <SidebarBody onNavigate={go} onClose={() => setDrawer(false)} cfg={cfg} onSearch={() => { setDrawer(false); setPalette(true); }} />
                        </motion.aside>
                    </motion.div>
                )}
            </AnimatePresence>

            <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />

            <div className="transition-[padding] duration-300" style={showSidebar ? { paddingLeft: sidebarW + 24 } : undefined}>
                <header className="glass sticky top-0 z-20 no-print border-x-0 border-t-0 rounded-none">
                    <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu"
                                className={`w-10 h-10 shrink-0 rounded-xl bg-[#081b3b] text-amber-400 flex items-center justify-center cursor-pointer ${showSidebar ? 'hidden' : ''}`}><Menu size={19} /></button>
                            {!atHome && (
                                <button type="button" onClick={() => navigate(cfg.home)} aria-label="Back to dashboard" title="Back to dashboard"
                                    className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#081b3b] flex items-center justify-center cursor-pointer"><ChevronLeft size={18} /></button>
                            )}
                            <div className="min-w-0">
                                <p className="eyebrow">{cfg.portal}</p>
                                <h1 className="text-lg font-extrabold text-[#081b3b] truncate">{cfg.titleFor(location.pathname)}</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => setPalette(true)} className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:text-[#081b3b] hover:border-slate-300 cursor-pointer">
                                <Search size={14} /> Search <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px]">Ctrl K</kbd>
                            </button>
                            {cfg.topRight}
                        </div>
                    </div>
                </header>
                <div key={location.pathname} className="page-rise p-4 sm:p-8 max-w-7xl mx-auto w-full min-w-0">{children}</div>
            </div>
        </div>
    );
}

export function AdminShell({ children }) {
    const cfg = {
        id: 'admin', home: '/admin/dashboard', portal: 'Admin portal', nav: ADMIN_NAV, titleFor: pageTitleFor,
        user: { initials: 'AD', name: 'Admin console', sub: 'Davanagere campus' },
        topRight: <AdminNotificationBell />,
    };
    return <PortalShell cfg={cfg}>{children}</PortalShell>;
}
