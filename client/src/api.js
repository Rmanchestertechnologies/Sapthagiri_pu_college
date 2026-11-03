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
                response.data.questions = response.data.questions.filter(q => !isCetQuestion(q));
                if (response.data.pagination) {
                    response.data.pagination.total = response.data.questions.length;
                }
            }
        }

        return response;
    },
    (error) => {
        loadingCallback(false);
        if (error.response && error.response.status === 401) {
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
