import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings2, Wrench, Power, Activity, Database, Clock, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import api from '../../api';
import PageShell from '../../ui/PageShell';
import { SPRING } from '../../ui/motion';

const DURATIONS = [
    { value: 0, label: 'Until I switch it off' },
    { value: 15, label: 'About 15 minutes' },
    { value: 30, label: 'About 30 minutes' },
    { value: 60, label: 'About 1 hour' },
    { value: 180, label: 'About 3 hours' },
];

const fmtUptime = (s) => {
    const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export default function SystemSettings() {
    const [state, setState] = useState(null);
    const [health, setHealth] = useState(null);
    const [message, setMessage] = useState('We are making some updates. The site will be back shortly.');
    const [minutes, setMinutes] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [loadError, setLoadError] = useState('');

    const load = useCallback(async () => {
        setLoadError('');
        try {
            const [m, h] = await Promise.all([
                api.get('/api/admin/maintenance'),
                api.get('/api/health').catch((e) => ({ data: { status: 'unreachable', db: 'unknown', error: e.message } })),
            ]);
            setState(m.data);
            if (m.data?.message) setMessage(m.data.message);
            setHealth(h.data);
        } catch (e) {
            setLoadError(e.response?.data?.msg || 'Could not read the current status. Please try again.');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const change = async (on) => {
        setBusy(true);
        setError('');
        try {
            const res = await api.put('/api/admin/maintenance', { on, message, minutes });
            setState(res.data);
            const h = await api.get('/api/health').catch(() => null);
            if (h) setHealth(h.data);
        } catch (e) {
            setError(e.response?.data?.msg || 'The change could not be saved. Nothing was changed - please try again.');
        } finally {
            setBusy(false);
        }
    };

    const on = Boolean(state?.on);
    const fromEnv = state?.source === 'env';

    return (
        <PageShell icon={Settings2} tone="sky" title="System" subtitle="Keep the site healthy, and tell visitors when updates are going on.">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft} className="surface p-6 space-y-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${on ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{on ? <Wrench size={20} /> : <Power size={20} />}</span>
                            <div>
                                <h3 className="text-lg font-bold text-[#1e1b4b]">Maintenance mode</h3>
                                <p className="text-sm text-slate-600">Show an “updates going on” screen while you update the site.</p>
                            </div>
                        </div>
                        <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${on ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {state === null ? 'Checking…' : on ? 'Maintenance is ON' : 'Site is live'}
                        </span>
                    </div>

                    {loadError && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-800 flex items-center gap-2"><AlertTriangle size={16} /> {loadError}</p>}

                    <label className="block">
                        <span className="block text-sm font-semibold text-slate-700 mb-1.5">Message shown to visitors</span>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={3}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-500 resize-none" />
                        <span className="block mt-1 text-xs text-slate-500">{message.length}/300 characters</span>
                    </label>

                    <label className="block max-w-xs">
                        <span className="block text-sm font-semibold text-slate-700 mb-1.5">How long</span>
                        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 bg-white">
                            {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                        <span className="block mt-1 text-xs text-slate-500">A timed switch-on turns itself off, so it can never be forgotten.</span>
                    </label>

                    {fromEnv && <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">Maintenance is also forced ON by the <code className="font-mono font-bold">MAINTENANCE_MODE</code> setting on the server. Remove that setting to be able to switch it off here.</p>}
                    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}

                    <div className="flex flex-wrap gap-3 pt-1">
                        {!on ? (
                            <button type="button" disabled={busy || state === null} onClick={() => change(true)}
                                className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"><Wrench size={16} /> {busy ? 'Switching on…' : 'Turn on maintenance'}</button>
                        ) : (
                            <button type="button" disabled={busy || fromEnv} onClick={() => change(false)}
                                className="h-11 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"><Power size={16} /> {busy ? 'Going live…' : 'Turn off — go live'}</button>
                        )}
                        {on && <button type="button" disabled={busy} onClick={() => change(true)} className="h-11 px-4 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Update message</button>}
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-1.5">
                        <p className="font-bold text-[#1e1b4b] flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /> What people see</p>
                        <p>• <strong>You (admin)</strong> keep full access, so you can keep working and switch it off.</p>
                        <p>• <strong>Teachers and visitors</strong> see the “updates going on” screen. It checks by itself and reopens the site the moment you turn maintenance off.</p>
                        <p>• <strong>Students already inside an exam</strong> can keep saving and can still submit. Nobody loses an exam.</p>
                    </div>
                </motion.section>

                <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.05 }} className="surface p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-[#1e1b4b] flex items-center gap-2"><Activity size={17} className="text-amber-600" /> System health</h3>
                        <button type="button" onClick={load} aria-label="Refresh" className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"><RefreshCw size={16} /></button>
                    </div>
                    {!health ? <p className="text-sm text-slate-500">Checking…</p> : (
                        <ul className="divide-y divide-slate-100 text-sm">
                            <li className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-slate-600"><Activity size={15} /> Server</span><span className={`font-bold ${health.status === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{health.status === 'ok' ? 'Running' : 'Not healthy'}</span></li>
                            <li className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-slate-600"><Database size={15} /> Database</span><span className={`font-bold ${health.db === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{health.db === 'ok' ? 'Connected' : 'Unreachable'}</span></li>
                            <li className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-slate-600"><Clock size={15} /> Up for</span><span className="font-bold text-slate-800">{Number.isFinite(health.uptime) ? fmtUptime(health.uptime) : '—'}</span></li>
                            <li className="flex items-center justify-between py-3"><span className="text-slate-600">Version</span><span className="font-bold text-slate-800">{health.version || '—'}</span></li>
                        </ul>
                    )}
                </motion.aside>
            </div>
        </PageShell>
    );
}
