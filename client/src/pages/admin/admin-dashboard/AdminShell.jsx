import { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { LayoutDashboard, FilePlus2, ClipboardList, ScanLine, Zap, BarChart3, Database, Trophy, Archive, Ruler, FileText, Menu, LogOut, ChevronLeft, ChevronsLeft, ChevronsRight, X, Search, Command, Plus, Keyboard, Settings2 } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import { AdminNotificationBell } from './AdminNotificationBell';
import { SPRING, CommandPalette, useCommandShortcut } from '../../../ui/motion';

export const ADMIN_NAV = [
    {
        group: 'Examination operations',
        items: [
            { title: 'Executive Overview', path: '/admin/dashboard', Icon: LayoutDashboard, desc: 'Delegation and readiness' },
            { title: 'Create Question Paper', path: '/admin/dashboard/create-paper', Icon: FilePlus2, desc: 'Single or mixed-subject papers' },
            { title: 'Commissioned Exams', path: '/admin/dashboard/commissioned-exams', Icon: ClipboardList, desc: 'Department targets for each exam' },
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
    {
        group: 'System',
        items: [
            { title: 'System', path: '/admin/dashboard/system', Icon: Settings2, desc: 'Maintenance mode and health' },
        ],
    },
];

const isActivePath = (pathname, itemPath, home) => (itemPath === home
    ? (pathname === home || pathname === `${home}/`)
    : pathname.includes(itemPath.split('/').pop()));

export function pageTitleFor(pathname) {
    if (pathname.includes('create-paper')) return 'Create Question Paper';
    if (pathname.includes('/system')) return 'System';
    if (pathname.includes('commissioned-exams')) return 'Commissioned Exams';
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

const RAIL = 64;
const FULL = 256;

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
        <div className="h-full flex flex-col text-white bg-[#0a1630]">
            {/* brand + collapse */}
            <div className={`flex items-center ${slim ? 'flex-col gap-3 px-2 pt-4 pb-2' : 'justify-between gap-2 px-4 pt-4 pb-2'}`}>
                <button type="button" onClick={() => onNavigate(cfg.home)} className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer" aria-label="Home">
                    <span className="w-9 h-9 shrink-0 rounded-[10px] bg-white p-[3px]"><img src="/SapthagiriLogo.jpg" alt="" className="w-full h-full object-contain rounded-lg" /></span>
                    {!slim && (
                        <span className="min-w-0 leading-tight">
                            <span className="block text-[13px] font-bold truncate">Sapthagiri PU College</span>
                            <span className="block text-[11px] text-white/45 truncate">{cfg.portal}</span>
                        </span>
                    )}
                </button>
                {onClose ? (
                    <button type="button" onClick={onClose} aria-label="Close menu" className="w-8 h-8 rounded-lg text-white/60 hover:bg-white/10 flex items-center justify-center cursor-pointer"><X size={16} /></button>
                ) : null}
            </div>

            {/* search */}
            <div className={slim ? 'px-2 pb-2' : 'px-3 pb-2'}>
                <button type="button" onClick={onSearch} title="Search or jump to (Ctrl K)"
                    className={`w-full h-9 flex items-center ${slim ? 'justify-center' : 'gap-2 px-2.5'} rounded-lg bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white cursor-pointer transition-colors`}>
                    <Search size={15} className="shrink-0" />
                    {!slim && (<><span className="text-[13px] flex-1 text-left">Search</span><kbd className="rounded border border-white/15 px-1.5 text-[10px] font-semibold text-white/50">Ctrl K</kbd></>)}
                </button>
            </div>

            {/* nav */}
            <nav className={`flex-1 overflow-y-auto ${slim ? 'px-2' : 'px-3'} pb-3`} aria-label="Sections">
                <LayoutGroup id={onClose ? `${cfg.id}-nav-drawer` : `${cfg.id}-nav`}>
                    {cfg.nav.map((group, gi) => (
                        <div key={group.group} className={gi === 0 ? 'mt-1' : 'mt-5'}>
                            {slim
                                ? (gi > 0 && <div className="mx-auto mb-2 h-px w-6 bg-white/10" />)
                                : <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">{group.group}</p>}
                            <ul className="space-y-0.5">
                                {group.items.map(({ title, path, Icon, desc }) => {
                                    const active = isActivePath(location.pathname, path, cfg.home);
                                    return (
                                        <li key={path}>
                                            <button type="button" onClick={() => onNavigate(path)} aria-current={active ? 'page' : undefined} title={slim ? title : desc}
                                                className={`relative w-full h-9 flex items-center ${slim ? 'justify-center' : 'gap-3 px-2.5'} rounded-lg text-left cursor-pointer transition-colors ${active ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.05]'}`}>
                                                {active && <motion.span layoutId={`${cfg.id}-nav-pill`} transition={SPRING.soft} className="absolute inset-0 rounded-lg bg-white/[0.09]" />}
                                                {active && !slim && <motion.span layoutId={`${cfg.id}-nav-bar`} transition={SPRING.soft} className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-amber-400" />}
                                                <Icon size={17} strokeWidth={2} className={`relative shrink-0 ${active ? 'text-amber-400' : ''}`} />
                                                {!slim && <span className="relative text-[13.5px] font-medium truncate">{title}</span>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </LayoutGroup>

                {cfg.actions && cfg.actions.length > 0 && (
                    <div className="mt-5">
                        {!slim && <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">Resources</p>}
                        <ul className="space-y-0.5">
                            {cfg.actions.map(({ title, Icon, desc, run }) => (
                                <li key={title}>
                                    <button type="button" title={slim ? title : desc} onClick={() => { run(); if (onClose) onClose(); }}
                                        className={`w-full h-9 flex items-center ${slim ? 'justify-center' : 'gap-3 px-2.5'} rounded-lg text-left cursor-pointer text-white/60 hover:text-white hover:bg-white/[0.05]`}>
                                        <Icon size={17} className="shrink-0" />{!slim && <span className="text-[13.5px] font-medium truncate">{title}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </nav>

            {/* user */}
            <div className={`border-t border-white/[0.07] ${slim ? 'px-2 py-3 flex flex-col items-center gap-2' : 'px-3 py-3 flex items-center gap-2.5'}`}>
                <span className="relative w-8 h-8 shrink-0 rounded-full bg-amber-400 text-[#0a1630] text-[11px] font-bold flex items-center justify-center">
                    {cfg.user.initials}
                    <span className="absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a1630]" aria-hidden="true" />
                </span>
                {!slim && <span className="min-w-0 flex-1 leading-tight"><span className="block text-[13px] font-semibold truncate">{cfg.user.name}</span><span className="block text-[11px] text-white/40 truncate">{cfg.user.sub}</span></span>}
                <button type="button" onClick={() => { logout(); navigate('/'); }} aria-label="Sign out" title="Sign out"
                    className="w-8 h-8 shrink-0 rounded-lg text-white/45 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"><LogOut size={15} /></button>
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
    const [quick, setQuick] = useState(false);
    const [help, setHelp] = useState(false);
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
    // "?" shows the shortcuts, "[" collapses the sidebar, Esc closes menus - never while typing in a field
    useEffect(() => {
        const onKey = (e) => {
            const el = e.target;
            const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
            if (e.key === 'Escape') { setHelp(false); setQuick(false); return; }
            if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === '?') { e.preventDefault(); setHelp(h => !h); }
            else if (e.key === '[') { toggleCollapsed(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

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
                <motion.aside className="fixed top-0 bottom-0 left-0 z-30 no-print border-r border-white/[0.06]"
                    initial={false} animate={{ width: sidebarW }} transition={SPRING.soft}>
                    <SidebarBody onNavigate={go} cfg={cfg} collapsed={collapsed} onToggle={toggleCollapsed} onSearch={() => setPalette(true)} />
                    <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={`${collapsed ? 'Expand' : 'Collapse'} sidebar ([)`}
                        className="absolute -right-3 top-[22px] z-10 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-[#081b3b] shadow-sm flex items-center justify-center cursor-pointer">
                        {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
                    </button>
                </motion.aside>
            )}

            <AnimatePresence>
                {drawer && (
                    <motion.div className="fixed inset-0 z-50 no-print" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
                        <motion.aside className="absolute top-0 bottom-0 left-0 w-[280px] max-w-[86vw] shadow-2xl" initial={{ x: -330 }} animate={{ x: 0 }} exit={{ x: -330 }} transition={SPRING.island}>
                            <SidebarBody onNavigate={go} onClose={() => setDrawer(false)} cfg={cfg} onSearch={() => { setDrawer(false); setPalette(true); }} />
                        </motion.aside>
                    </motion.div>
                )}
            </AnimatePresence>

            <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />

            <AnimatePresence>
                {help && (
                    <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm no-print" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setHelp(false)}>
                        <motion.div role="dialog" aria-label="Keyboard shortcuts" onMouseDown={(e) => e.stopPropagation()} initial={{ y: 16, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 10, scale: 0.97, opacity: 0 }} transition={SPRING.island}
                            className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-extrabold text-[#081b3b] flex items-center gap-2"><Keyboard size={19} className="text-amber-500" /> Keyboard shortcuts</h3>
                                <button type="button" onClick={() => setHelp(false)} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer"><X size={16} /></button>
                            </div>
                            <ul className="divide-y divide-slate-100">
                                {[['Ctrl / Cmd + K', 'Search or jump to any section'], ['?', 'Show this list'], ['[', 'Collapse or expand the sidebar'], ['Esc', 'Close menus and dialogs']].map(([k, d]) => (
                                    <li key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
                                        <span className="text-slate-600 font-semibold">{d}</span>
                                        <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-[#081b3b] whitespace-nowrap">{k}</kbd>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="transition-[padding] duration-300" style={showSidebar ? { paddingLeft: sidebarW } : undefined}>
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
                            {cfg.quickActions && cfg.quickActions.length > 0 && (
                                <div className="relative">
                                    <button type="button" onClick={() => setQuick(q => !q)} aria-haspopup="menu" aria-expanded={quick}
                                        className="h-10 pl-3 pr-4 rounded-xl bg-gradient-to-r from-[#081b3b] to-[#0d2a5e] text-amber-300 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-blue-950/20 cursor-pointer"><Plus size={16} strokeWidth={3} /> New</button>
                                    <AnimatePresence>
                                        {quick && (
                                            <>
                                                <div className="fixed inset-0 z-30" onClick={() => setQuick(false)} />
                                                <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={SPRING.island}
                                                    className="absolute right-0 mt-2 w-72 z-40 rounded-2xl bg-white border border-slate-200 shadow-2xl p-2">
                                                    {cfg.quickActions.map(({ title, desc, Icon, to, run }) => (
                                                        <button key={title} type="button" role="menuitem" onClick={() => { setQuick(false); if (run) run(); else navigate(to); }}
                                                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-amber-50 cursor-pointer">
                                                            <span className="w-10 h-10 rounded-xl bg-[#081b3b] text-amber-300 flex items-center justify-center shrink-0"><Icon size={18} /></span>
                                                            <span className="min-w-0"><span className="block text-sm font-extrabold text-[#081b3b]">{title}</span><span className="block text-xs text-slate-500 truncate">{desc}</span></span>
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                            <button type="button" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)"
                                className="hidden sm:flex w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-[#081b3b] hover:border-slate-300 items-center justify-center cursor-pointer"><Keyboard size={17} /></button>
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
        quickActions: [
            { title: 'Create question paper', desc: 'Open the paper wizard', Icon: FilePlus2, to: '/admin/dashboard/create-paper' },
            { title: 'Scan OMR sheets', desc: 'Evaluate and rank', Icon: ScanLine, to: '/admin/dashboard/omr' },
            { title: 'Add to question bank', desc: 'Browse and manage questions', Icon: Database, to: '/admin/dashboard/questions' },
        ],
    };
    return <PortalShell cfg={cfg}>{children}</PortalShell>;
}
