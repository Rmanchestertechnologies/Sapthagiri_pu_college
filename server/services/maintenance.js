/**
 * Maintenance mode: while it is ON, the site tells visitors "updates are going on, we will be back shortly" instead of failing.
 *
 * Two ways to switch it on:
 *   1. The admin screen (System page): stored in the database (public.app_settings), takes effect within a few seconds, no restart.
 *   2. The environment variable MAINTENANCE_MODE=1 on the API host: for the moments when the admin screen itself cannot be used.
 *      It overrides the stored setting while it is set.
 *
 * What still works during maintenance (so nobody loses work and an admin can always switch it off):
 *   - GET /api/health and GET /api/maintenance
 *   - signing in (an admin who signs in keeps full access; other users see the maintenance screen after signing in)
 *   - every request carrying an admin token
 *   - a student who is already sitting an exam can still save progress, report and SUBMIT
 */
const jwt = require('jsonwebtoken');

const TRUE = /^(1|true|on|yes)$/i;
const DEFAULT_MESSAGE = 'We are making some updates. The site will be back shortly.';
const TTL_MS = 5000;

let cache = { at: 0, state: { on: false, message: DEFAULT_MESSAGE, until: null, source: 'default' } };
let tableReady = false;

const getPool = () => require('../config/postgres');

async function ensureTable() {
    if (tableReady) return;
    await getPool().query(`CREATE TABLE IF NOT EXISTS public.app_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    tableReady = true;
}

/** Current maintenance state. Never throws: if the database cannot be read, the last known state is kept. */
async function getState({ force = false } = {}) {
    if (TRUE.test(String(process.env.MAINTENANCE_MODE || ''))) {
        return { on: true, message: process.env.MAINTENANCE_MESSAGE || DEFAULT_MESSAGE, until: null, source: 'env' };
    }
    if (!force && Date.now() - cache.at < TTL_MS) return cache.state;
    try {
        await ensureTable();
        const res = await getPool().query("SELECT value FROM public.app_settings WHERE key = 'maintenance'");
        const v = res.rows[0]?.value || {};
        let on = Boolean(v.on);
        // an end time that has passed switches maintenance off by itself, so a forgotten switch cannot lock the site for good
        if (on && v.until && new Date(v.until).getTime() < Date.now()) on = false;
        cache = { at: Date.now(), state: { on, message: String(v.message || DEFAULT_MESSAGE), until: v.until || null, source: 'admin' } };
    } catch (err) {
        cache = { at: Date.now(), state: cache.state };
    }
    return cache.state;
}

async function setState({ on, message, minutes }) {
    await ensureTable();
    const until = on && Number(minutes) > 0 ? new Date(Date.now() + Number(minutes) * 60000).toISOString() : null;
    const value = { on: Boolean(on), message: String(message || DEFAULT_MESSAGE).slice(0, 300), until };
    await getPool().query(
        `INSERT INTO public.app_settings (key, value, updated_at) VALUES ('maintenance', $1::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [JSON.stringify(value)]
    );
    cache = { at: 0, state: cache.state };
    return getState({ force: true });
}

const isAdminRequest = (req) => {
    const header = req.header('Authorization');
    const token = (req.cookies && req.cookies.auth_token) || (header && header.startsWith('Bearer ') ? header.split(' ')[1] : null) || req.header('x-auth-token');
    if (!token || token === 'null' || token === 'undefined' || !process.env.JWT_SECRET) return false;
    try { return jwt.verify(token, process.env.JWT_SECRET).role === 'admin'; } catch { return false; }
};

const ALWAYS_ALLOWED = [
    /^\/api\/health\/?$/,
    /^\/api\/maintenance\/?$/,
    /^\/api\/auth\/login\/?$/,
    /^\/api\/client-log\/?$/,
    // a sitting that has already started can still be saved and handed in
    /^\/api\/exams\/[^/]+\/(submit|malpractice)\/?$/,
    /^\/api\/exams\/[^/]+\/session\/save-progress\/?$/,
];

function maintenanceGate() {
    return async (req, res, next) => {
        try {
            const state = await getState();
            if (!state.on) return next();
            const url = req.originalUrl.split('?')[0];
            if (ALWAYS_ALLOWED.some(r => r.test(url))) return next();
            if (isAdminRequest(req)) return next();
            const retry = state.until ? Math.max(30, Math.round((new Date(state.until).getTime() - Date.now()) / 1000)) : 120;
            res.set('Retry-After', String(retry));
            return res.status(503).json({ maintenance: true, message: state.message, until: state.until, msg: state.message });
        } catch (err) {
            return next();
        }
    };
}

module.exports = { getState, setState, maintenanceGate, DEFAULT_MESSAGE };
