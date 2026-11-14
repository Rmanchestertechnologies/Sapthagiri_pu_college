import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Wrench, Wifi } from 'lucide-react';
import { API_URL } from '../api';

/**
 * Keeps the website honest when the server is being updated or is unreachable:
 *   - "maintenance": an admin switched maintenance on (or MAINTENANCE_MODE is set on the server) -> shows the admin's message
 *   - "down": the server did not answer sensibly three checks in a row (a deploy, a restart, a sleeping host) -> shows the same
 *     friendly screen, and the page comes back by itself the moment the server answers again.
 * Never shown while a student is inside an exam (/exam/...): the exam screen keeps its own saving and retry logic.
 * A build-time switch, VITE_MAINTENANCE=1, shows the screen with no server involved (for a front-end-only release window).
 */
const BUILD_FLAG = String(import.meta.env.VITE_MAINTENANCE || '') === '1';
const OK_EVERY = 30000;
const BAD_EVERY = 10000;
const FAILS_BEFORE_SHOWING = 3;

const inExam = () => /^\/exam\//.test(window.location.pathname);

// An admin is never locked out (they have to be able to switch maintenance off): a signed-in admin sees the site as usual, and the
// "Staff sign-in" link on the maintenance screen opens the sign-in page so an admin can sign in while the site is closed.
const isAdminSession = () => {
    try { return JSON.parse(localStorage.getItem('user') || '{}')?.role === 'admin' && Boolean(localStorage.getItem('token')); } catch { return false; }
};
const staffSignInPage = () => {
    try {
        if (new URLSearchParams(window.location.search).get('staff') === '1') sessionStorage.setItem('staff_signin', '1');
        return window.location.pathname === '/' && sessionStorage.getItem('staff_signin') === '1';
    } catch { return false; }
};

async function checkServer() {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
        const res = await fetch(`${API_URL}/api/maintenance`, { signal: ctl.signal, cache: 'no-store', credentials: 'omit' });
        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            return data.on ? { kind: 'maintenance', message: data.message, until: data.until } : { kind: 'ok' };
        }
        if (res.status === 503) {
            const data = await res.json().catch(() => ({}));
            if (data.maintenance) return { kind: 'maintenance', message: data.message, until: data.until };
        }
        // any 5xx from this tiny status endpoint means the server or the host in front of it is not answering properly (a restart, a deploy,
        // a sleeping host); 4xx such as 404 on an old server or 429 is not an outage
        return res.status >= 500 ? { kind: 'fail' } : { kind: 'ok' };
    } catch {
        return { kind: 'fail' };
    } finally {
        clearTimeout(timer);
    }
}

export function MaintenanceScreen({ message, until, checking, onRetry, mode }) {
    const minutesLeft = () => (until ? Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 60000)) : null);
    const [left, setLeft] = useState(minutesLeft);
    useEffect(() => {
        const id = setInterval(() => setLeft(minutesLeft()), 30000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [until]);
    return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6 bg-[#0c0b2c] text-white font-sans" role="alert" aria-live="polite">
            <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-indigo-500/20 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full bg-sky-500/15 blur-3xl" aria-hidden="true" />
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                className="relative w-full max-w-lg text-center">
                <span className="mx-auto w-20 h-20 rounded-3xl bg-white p-2 shadow-2xl ring-2 ring-indigo-400/60 block">
                    <img src="/SapthagiriLogo.jpg" alt="Sapthagiri PU College" className="w-full h-full object-contain rounded-2xl" />
                </span>
                <h1 className="mt-7 text-3xl sm:text-4xl font-extrabold tracking-tight">Updates are going on</h1>
                <p className="mt-3 text-white/70 text-base leading-relaxed">
                    {message || 'We are making some updates. The site will be back shortly.'}
                </p>
                <div className="mt-8 mx-auto w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                    <motion.span className="block h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-300 to-indigo-500"
                        animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }} />
                </div>
                <p className="mt-4 text-sm text-white/55 flex items-center justify-center gap-2">
                    {mode === 'down' ? <Wifi size={15} /> : <Wrench size={15} />}
                    {checking ? 'Checking if we are back…' : (left ? `Expected back in about ${left} minute${left === 1 ? '' : 's'} · checking automatically` : 'This page checks automatically and reopens the site when we are back')}
                </p>
                <button type="button" onClick={onRetry} disabled={checking}
                    className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold cursor-pointer disabled:opacity-60">
                    <RefreshCw size={15} className={checking ? 'animate-spin' : ''} /> Try again now
                </button>
                <p className="mt-10 text-xs text-white/40">Sapthagiri PU College, Davanagere · <a href="/?staff=1" className="underline hover:text-white/70">Staff sign-in</a></p>
            </motion.div>
        </div>
    );
}

export default function MaintenanceGate({ children }) {
    const [view, setView] = useState({ kind: 'ok' });
    const [checking, setChecking] = useState(false);
    const fails = useRef(0);
    const wasBad = useRef(false);
    const timer = useRef(null);

    const apply = useCallback((result) => {
        if (result.kind === 'maintenance') {
            fails.current = 0;
            wasBad.current = true;
            setView({ kind: 'maintenance', message: result.message, until: result.until });
        } else if (result.kind === 'fail') {
            fails.current += 1;
            if (fails.current >= FAILS_BEFORE_SHOWING) { wasBad.current = true; setView({ kind: 'down' }); }
        } else {
            fails.current = 0;
            if (wasBad.current) { window.location.reload(); return; } // back online: start from a clean, current page
            setView({ kind: 'ok' });
        }
    }, []);

    const run = useCallback(async () => {
        setChecking(true);
        const result = await checkServer();
        setChecking(false);
        apply(result);
    }, [apply]);

    useEffect(() => {
        if (BUILD_FLAG) return undefined;
        let stopped = false;
        const loop = async () => {
            if (stopped) return;
            if (document.visibilityState === 'visible' && !inExam()) await run();
            if (stopped) return;
            timer.current = setTimeout(loop, view.kind === 'ok' && fails.current === 0 ? OK_EVERY : BAD_EVERY);
        };
        timer.current = setTimeout(loop, 1500);
        const onMaintenance = (e) => { wasBad.current = true; setView({ kind: 'maintenance', message: e.detail?.message, until: e.detail?.until }); };
        window.addEventListener('app:maintenance', onMaintenance);
        const onVisible = () => { if (document.visibilityState === 'visible' && !inExam()) run(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { stopped = true; clearTimeout(timer.current); window.removeEventListener('app:maintenance', onMaintenance); document.removeEventListener('visibilitychange', onVisible); };
    }, [run, view.kind]);

    if (BUILD_FLAG && !inExam() && !isAdminSession() && !staffSignInPage()) return <MaintenanceScreen message="We are making some updates. The site will be back shortly." onRetry={() => window.location.reload()} />;
    if (view.kind !== 'ok' && !inExam() && !isAdminSession() && !staffSignInPage()) {
        return <MaintenanceScreen mode={view.kind} message={view.kind === 'maintenance' ? view.message : 'We are updating the system and the connection will be back in a moment.'} until={view.until} checking={checking} onRetry={run} />;
    }
    return children;
}
