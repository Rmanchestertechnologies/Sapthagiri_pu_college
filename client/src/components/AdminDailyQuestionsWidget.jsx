import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function AdminDailyQuestionsWidget() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/admin/questions-daily-stats');
            if (res.data) {
                setStats(res.data);
                setLastRefreshed(new Date());
            }
        } catch (err) {
            console.error('Error fetching daily question stats:', err);
            try {
                const fallbackRes = await api.get('/api/questions/daily-stats');
                if (fallbackRes.data) {
                    setStats(fallbackRes.data);
                    setLastRefreshed(new Date());
                }
            } catch (fbErr) {
                console.error('Fallback stats failed:', fbErr);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 120000);
        return () => clearInterval(interval);
    }, [fetchStats]);
    const addedToday = stats?.addedToday ?? stats?.today?.total ?? 0;
    const addedYesterday = stats?.addedYesterday ?? stats?.yesterday?.total ?? 0;
    const totalQuestions = stats?.totalQuestions || 0;
    const subjectsToday = stats?.subjectsToday ?? stats?.today?.bySubject ?? {};
    const history = stats?.dailyTimeline ?? stats?.history ?? [];
    const pools = stats?.pools || [];
    const totalsBySubject = stats?.totalsBySubject || pools.reduce((acc, p) => {
        acc[p.subject] = (acc[p.subject] || 0) + (p.total || 0);
        return acc;
    }, {});

    return (
        <>
            {/* ── BOTTOM-LEFT FLOATING BADGE / BUTTON ── */}
            <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-2">
                <button
                    onClick={() => setIsOpen(prev => !prev)}
                    className="group flex items-center gap-2.5 bg-gradient-to-r from-slate-900 via-[#081B3B] to-slate-900 text-white px-4 py-2.5 rounded-2xl border-2 border-amber-400/60 shadow-[0_10px_25px_rgba(0,0,0,0.5)] hover:border-amber-400 hover:shadow-amber-400/20 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer backdrop-blur-xl"
                    title="Click to view daily questions added analytics"
                >
                    <div className="relative flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="absolute w-4 h-4 rounded-full bg-emerald-400/30 animate-ping"></span>
                    </div>

                    <div className="flex flex-col text-left leading-tight">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                                Added Today:
                            </span>
                            <span className="text-xs font-black text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/40">
                                +{addedToday.toLocaleString()}
                            </span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-300 flex items-center gap-1">
                            <span>Total Bank:</span>
                            <span className="font-bold text-amber-200">
                                {totalQuestions > 0 ? totalQuestions.toLocaleString() : '...'}
                            </span>
                        </div>
                    </div>

                    <div className="pl-1 text-slate-400 group-hover:text-amber-300 transition text-xs font-bold">
                        {isOpen ? '✕' : '📊'}
                    </div>
                </button>
            </div>

            {/* ── EXPANDABLE INGESTION ANALYTICS MODAL ── */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center sm:items-end sm:justify-start p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="bg-gradient-to-b from-[#081B3B] via-slate-900 to-slate-950 border-2 border-amber-400/80 rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col text-white overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-amber-400/20">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/40 flex items-center justify-center text-xl">
                                    <span role="img" aria-label="chart">📈</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">
                                        Question Ingestion Live Tracker
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        Real-time audit across all 8 Question Databases
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={fetchStats}
                                    disabled={loading}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-amber-400/30 text-amber-300 text-xs transition cursor-pointer disabled:opacity-50"
                                    title="Refresh Data"
                                >
                                    <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 text-slate-400 text-xs transition cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 custom-scrollbar">
                            {/* Key Numbers Grid */}
                            <div className="grid grid-cols-3 gap-2.5">
                                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 text-center">
                                    <div className="text-[10px] uppercase font-bold text-emerald-300">Added Today</div>
                                    <div className="text-xl font-black text-emerald-400 mt-1">
                                        +{addedToday.toLocaleString()}
                                    </div>
                                    <div className="text-[9px] text-emerald-200/60 mt-0.5">
                                        Live Postgres audit
                                    </div>
                                </div>

                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 text-center">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Yesterday</div>
                                    <div className="text-xl font-black text-slate-200 mt-1">
                                        +{addedYesterday.toLocaleString()}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-0.5">
                                        Previous day
                                    </div>
                                </div>

                                <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-3 text-center">
                                    <div className="text-[10px] uppercase font-bold text-amber-300">Total In Bank</div>
                                    <div className="text-xl font-black text-amber-400 mt-1">
                                        {totalQuestions.toLocaleString()}
                                    </div>
                                    <div className="text-[9px] text-amber-200/60 mt-0.5">
                                        8 Active Pools
                                    </div>
                                </div>
                            </div>

                            {/* Today's Subject Breakdown */}
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 mb-3 flex items-center justify-between">
                                    <span>Today's Subject Ingestion</span>
                                    <span className="text-[10px] font-normal text-slate-400">Class 11 + 12</span>
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border bg-sky-500/10 border-sky-500/30">
                                        <span className="font-bold text-slate-200">Physics</span>
                                        <span className="font-black text-sky-400">+{subjectsToday?.Physics || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/30">
                                        <span className="font-bold text-slate-200">Chemistry</span>
                                        <span className="font-black text-amber-400">+{subjectsToday?.Chemistry || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/30">
                                        <span className="font-bold text-slate-200">Mathematics</span>
                                        <span className="font-black text-emerald-400">+{subjectsToday?.Mathematics || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border bg-rose-500/10 border-rose-500/30">
                                        <span className="font-bold text-slate-200">Biology</span>
                                        <span className="font-black text-rose-400">+{subjectsToday?.Biology || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Overall Database Pool Totals */}
                            {totalsBySubject && Object.keys(totalsBySubject).length > 0 && (
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 mb-3">
                                        Total Question Bank Reservoir
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-slate-400 font-bold truncate">Physics</div>
                                            <div className="text-xs font-black mt-1 text-sky-400">
                                                {(totalsBySubject.Physics || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-slate-400 font-bold truncate">Chemistry</div>
                                            <div className="text-xs font-black mt-1 text-amber-400">
                                                {(totalsBySubject.Chemistry || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-slate-400 font-bold truncate">Mathematics</div>
                                            <div className="text-xs font-black mt-1 text-emerald-400">
                                                {(totalsBySubject.Mathematics || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-slate-400 font-bold truncate">Biology</div>
                                            <div className="text-xs font-black mt-1 text-rose-400">
                                                {(totalsBySubject.Biology || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Daily Timeline (Last 14 Days) */}
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 mb-3 flex items-center justify-between">
                                    <span>Recent Daily Ingestion History</span>
                                    <span className="text-[10px] font-normal text-slate-400">Day-by-Day</span>
                                </h4>

                                {history.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-3">
                                        No recent additions recorded in the timeline.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-white/10 text-[10px] font-black uppercase text-slate-400">
                                                    <th className="pb-2">Date</th>
                                                    <th className="pb-2 text-right">Total Added</th>
                                                    <th className="pb-2 text-right">Phy</th>
                                                    <th className="pb-2 text-right">Chem</th>
                                                    <th className="pb-2 text-right">Math</th>
                                                    <th className="pb-2 text-right">Bio</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {history.slice(0, 10).map((h, idx) => {
                                                    const isTodayRow = idx === 0;
                                                    return (
                                                        <tr key={h.date} className={`hover:bg-white/5 transition ${isTodayRow ? 'bg-emerald-950/20 font-bold' : ''}`}>
                                                            <td className="py-2 text-slate-300">
                                                                {h.date} {isTodayRow && <span className="text-emerald-400 text-[9px] font-bold ml-1">(Today)</span>}
                                                            </td>
                                                            <td className="py-2 text-right font-black text-emerald-400">
                                                                +{h.total}
                                                            </td>
                                                            <td className="py-2 text-right text-slate-400">{h.bySubject?.Physics || 0}</td>
                                                            <td className="py-2 text-right text-slate-400">{h.bySubject?.Chemistry || 0}</td>
                                                            <td className="py-2 text-right text-slate-400">{h.bySubject?.Mathematics || 0}</td>
                                                            <td className="py-2 text-right text-slate-400">{h.bySubject?.Biology || 0}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-amber-400/20 flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                                Last refreshed: {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'Just now'}
                            </span>
                            <span className="text-amber-400 font-bold">
                                Sapthagiri PU College Ingestion Monitor
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}