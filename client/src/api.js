import axios from 'axios';

// ── Base URL Configuration ──────────────────────────────────────────────────
// Always route requests via same-origin relative path ('') so Vercel rewrites proxy
// seamlessly to Render without triggering cross-origin CORS socket resets or ISP blocks.
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

// Global loading callbacks
let loadingCallback = (_isLoading) => {};
export const setLoadingCallback = (cb) => { loadingCallback = cb; };

// ── Request Interceptor: Attach token from localStorage if present ──────────
api.interceptors.request.use((config) => {
    // Only fire global loader if explicitly requested via showGlobalLoader: true
    // This prevents background polling (notifications, stats) from flashing the loader repeatedly
    if (config.showGlobalLoader) {
        loadingCallback(true);
    }
    // Student exam endpoints are authorised by the per-session token issued by /start.
    const sessionToken = localStorage.getItem('exam_session_token');
    if (sessionToken && /\/api\/exams\/[^/?]+\/(start|submit|session|malpractice|scorecard|pdf-report|leaderboard)/.test(String(config.url || ''))) {
        config.headers['x-session-token'] = sessionToken;
    }
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        config.headers['x-auth-token'] = token;
    }
    return config;
}, (error) => {
    loadingCallback(false);
    return Promise.reject(error);
});

// ── Response Interceptor: Handle token expiry globally ─────────────────────
api.interceptors.response.use(
    (response) => {
        if (response.config?.showGlobalLoader) {
            loadingCallback(false);
        }

        // Strict Institutional Guard: ZERO CET/KCET questions across the entire frontend
        if (response.config?.url && response.config.url.includes('/api/questions')) {
            const isCetQuestion = (q) => {
                if (!q) return true;
                const exams = (Array.isArray(q.classes) ? q.classes : []).concat(Array.isArray(q.exams) ? q.exams : []);
                const srcExam = String(q.sourceExam || '').toUpperCase();
                const qText = String(q.questionText || q.question || '').toUpperCase();
                return exams.some(e => ['CET', 'KCET'].includes(String(e).toUpperCase())) ||
                       srcExam.includes('CET') ||
                       srcExam.includes('KCET') ||
                       qText.includes('[KCET') ||
                       qText.includes('(KCET') ||
                       qText.includes('[CET') ||
                       qText.includes('(CET');
            };

            if (Array.isArray(response.data)) {
                response.data = response.data.filter(q => !isCetQuestion(q));
            } else if (response.data && Array.isArray(response.data.questions)) {
                const before = response.data.questions.length;
                response.data.questions = response.data.questions.filter(q => !isCetQuestion(q));
                const removed = before - response.data.questions.length;
                // Only subtract what was removed. The total used to be replaced by the size of the CURRENT PAGE, so the
                // question bank showed "Total Questions: 50" for a bank of 13,897.
                if (response.data.pagination && removed > 0 && Number.isFinite(response.data.pagination.total)) {
                    response.data.pagination.total = Math.max(0, response.data.pagination.total - removed);
                }
            }
        }

        return response;
    },
    async (error) => {
        loadingCallback(false);
        // The server says it is in maintenance: show the maintenance screen right away (everything else keeps its own error handling)
        if (error.response && error.response.status === 503 && error.response.data && error.response.data.maintenance) {
            window.dispatchEvent(new CustomEvent('app:maintenance', { detail: { message: error.response.data.message, until: error.response.data.until } }));
            return Promise.reject(error);
        }
        // Safe reads (GET) are retried a few times when the host is restarting or the connection blips: 502/503/504 or no answer at all.
        // Writes are never retried here, so nothing can be saved or deleted twice.
        const cfg = error.config;
        const transient = !error.response || [502, 503, 504].includes(error.response.status);
        if (cfg && transient && String(cfg.method || 'get').toLowerCase() === 'get' && !cfg.__noRetry) {
            cfg.__retries = (cfg.__retries || 0) + 1;
            if (cfg.__retries <= 3) {
                await new Promise(r => setTimeout(r, 600 * Math.pow(2, cfg.__retries - 1)));
                return api(cfg);
            }
        }
        // A rejected exam-session token must not log a student out or bounce them to the staff login page.
        const isStudentCall = Boolean(error.config?.headers?.['x-session-token']);
        if (error.response && error.response.status === 401 && !isStudentCall) {
            // Clear local credentials on 401
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
export { API_URL };
