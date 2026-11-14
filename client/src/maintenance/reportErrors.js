import { API_URL } from '../api';

/**
 * Sends browser errors to the server log (POST /api/client-log) so a problem on a teacher's screen shows up in Render's logs without
 * anyone having to ask for a screenshot. Best effort: it never throws, never blocks, and stops after 10 reports per page load.
 */
let sent = 0;
const BUILD = String(import.meta.env.VITE_BUILD_ID || 'dev').slice(0, 20);

export function reportClientError(kind, error) {
    if (sent >= 10) return;
    sent += 1;
    try {
        const message = error && error.message ? error.message : String(error || '');
        // a failed network call while the server is restarting is expected and handled by the maintenance screen
        if (/Network Error|Failed to fetch|Load failed|aborted/i.test(message)) return;
        const body = JSON.stringify({ kind, message, stack: error && error.stack ? String(error.stack).slice(0, 400) : '', page: window.location.pathname, build: BUILD });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${API_URL}/api/client-log`, new Blob([body], { type: 'application/json' }));
        } else {
            fetch(`${API_URL}/api/client-log`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
        }
    } catch { /* reporting must never cause an error of its own */ }
}

export function installErrorReporting() {
    window.addEventListener('error', (e) => reportClientError('error', e.error || e.message));
    window.addEventListener('unhandledrejection', (e) => reportClientError('promise', e.reason));
}
