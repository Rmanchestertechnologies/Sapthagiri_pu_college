import React, { createContext, useState, useEffect } from 'react';
import api from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Synchronously initialize user from localStorage so page refreshes never flicker or unmount
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const savedToken = localStorage.getItem('token');
                const savedUser = localStorage.getItem('user');

                if (savedToken || savedUser) {
                    const fetchMe = api.get('/api/auth/me', { timeout: 15000 }).then(res => {
                        if (res.data?.user) {
                            setUser(res.data.user);
                            localStorage.setItem('user', JSON.stringify(res.data.user));
                        }
                    }).catch((err) => {
                        // CRITICAL: ONLY clear session if server actively rejected token with 401/403 (unauthorized/forbidden)
                        // Never log the user out due to server sleep, 429 rate limit, 502, or transient network timeouts!
                        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            setUser(null);
                        }
                    });

                    // Max 3.5s wait so other laptops on cold-start never freeze
                    const timeout = new Promise(resolve => setTimeout(resolve, 3500));
                    await Promise.race([fetchMe, timeout]);
                }
            } catch (err) {
                console.error('[AUTH INIT ERROR]:', err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const res = await api.post('/api/auth/login', { email, password }, { timeout: 35000 });
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }
            if (res.data.user) {
                localStorage.setItem('user', JSON.stringify(res.data.user));
                setUser(res.data.user);
            }
            return res.data.user;
        } catch (err) {
            if (err.response?.status === 429) {
                throw { msg: 'Server is warming up from sleep mode. Please wait 15 seconds and click Login again.' };
            }
            if (!err.response) {
                throw { msg: 'Server is starting up. Please wait a few moments and click Login again.' };
            }
            throw err.response ? err.response.data : new Error('Login failed');
        }
    };

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch {
            // Ignore network error on logout
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
