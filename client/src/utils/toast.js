/**
 * Non-blocking notifications. `installToastAlerts()` replaces window.alert, so the ~100 `alert(...)` calls across the app
 * show a small message that disappears by itself instead of a browser dialog that blocks the page (and, during an exam
 * session, the timer's repaint). `window.confirm` is left alone because those calls need an answer.
 *
 * Plain DOM, no React, so it also works from code that runs outside a component.
 */
let container = null;

function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.setAttribute('aria-live', 'polite');
    Object.assign(container.style, {
        position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483000',
        display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 'min(420px, calc(100vw - 32px))',
        pointerEvents: 'none'
    });
    document.body.appendChild(container);
    return container;
}

function kindOf(message) {
    const m = String(message).toLowerCase();
    if (/(^|\s)(✅|✓|success|saved|created|updated|deleted|imported|copied)/.test(m) && !/fail|error|could not|cannot|unable/.test(m)) return 'success';
    if (/fail|error|could not|cannot|unable|denied|invalid|not found|please (enter|select|choose|upload|fill)|required|expired|disqualif/.test(m)) return 'error';
    return 'info';
}

const COLORS = {
    success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' }
};

export function showToast(message, kind) {
    if (typeof document === 'undefined') return;
    const text = String(message == null ? '' : message);
    const type = kind || kindOf(text);
    const c = COLORS[type];
    const el = document.createElement('div');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = text;
    Object.assign(el.style, {
        background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderLeft: `5px solid ${c.border}`,
        borderRadius: '10px', padding: '12px 14px', fontSize: '14px', lineHeight: '1.4', fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        pointerEvents: 'auto', cursor: 'pointer'
    });
    const remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener('click', remove);
    const host = ensureContainer();
    host.appendChild(el);
    // keep at most 4 on screen
    while (host.children.length > 4) host.removeChild(host.firstChild);
    window.setTimeout(remove, type === 'error' ? 9000 : 5000);
}

export function installToastAlerts() {
    if (typeof window === 'undefined' || window.__toastAlertsInstalled) return;
    window.__toastAlertsInstalled = true;
    window.alert = (message) => showToast(message);
}
