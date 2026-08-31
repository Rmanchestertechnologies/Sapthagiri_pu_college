import axios from 'axios';

// ── Base URL Configuration ──────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://sapthagiri-pu-college-api.onrender.com' : '');

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

// Global loading callbacks
let loadingCallback = (_isLoading) => {};
export const setLoadingCallback = (cb) => { loadingCallback = cb; };

// ── Request Interceptor: Attach token from localStorage if present ──────────
api.interceptors.request.use((config) => {
    loadingCallback(true);
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
        loadingCallback(false);
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
