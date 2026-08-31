const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { loginLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Cookie configuration
// ─────────────────────────────────────────────────────────────────────────────
const COOKIE_NAME = 'auth_token';
const COOKIE_OPTIONS = {
    httpOnly: true,                                    // Not accessible via JS — XSS-safe
    secure: process.env.NODE_ENV === 'production',     // HTTPS-only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site Vercel+Render
    maxAge: 10 * 60 * 60 * 1000,                       // 10 hours in ms
    path: '/'
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Authenticate user — rate limited to 5 attempts per 15 min per IP
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
    const { email: rawEmail, password: rawPassword } = req.body || {};

    if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
        return res.status(400).json({ msg: 'Email and password must be valid strings.' });
    }

    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword.trim();

    if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required.' });
    }

    // ── Hardcoded Admin Account (Sapthagiri PU College) ────────────────────
    if (email === 'sapthagiripucollegedvg@gmail.com') {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sapthagiri1';

        if (password !== ADMIN_PASSWORD) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        const adminId = '000000000000000000000000';
        const payload = { id: adminId, role: 'admin' };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'sapthagiri_jwt_secret_2026', { expiresIn: '10h' });

        // Set HttpOnly cookie
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return res.json({
            token,
            user: { id: adminId, name: 'Sapthagiri Admin', email, role: 'admin' }
        });
    }

    // ── Regular User: MongoDB PRIMARY, Supabase PostgreSQL FALLBACK ─────────
    try {
        let userRecord = null;

        // Try Supabase PostgreSQL first (fast, reliable primary database)
        try {
            const pool = require('../config/postgres');
            const pgRes = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
            if (pgRes.rows && pgRes.rows.length > 0) {
                const pgUser = pgRes.rows[0];
                userRecord = {
                    id: String(pgUser.id),
                    name: pgUser.name,
                    email: pgUser.email,
                    password: pgUser.password,
                    role: pgUser.role,
                    subject: pgUser.subject
                };
            }
        } catch (pgErr) {
            console.warn('[AUTH] Postgres lookup warning:', pgErr.message);
        }

        // If not found in PostgreSQL, check MongoDB if connected (with 2s timeout)
        if (!userRecord && mongoose.connection.readyState === 1 && User && User.findOne) {
            try {
                const mongoUser = await Promise.race([
                    User.findOne({ email }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
                if (mongoUser) {
                    userRecord = {
                        id: String(mongoUser._id),
                        name: mongoUser.name,
                        email: mongoUser.email,
                        password: mongoUser.password,
                        role: mongoUser.role,
                        subject: mongoUser.subject
                    };
                }
            } catch (mongoErr) {
                console.warn('[AUTH] MongoDB lookup warning:', mongoErr.message);
            }
        }

        if (!userRecord) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, userRecord.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        const payload = {
            id: userRecord.id,
            role: userRecord.role,
            subject: userRecord.subject
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'sapthagiri_jwt_secret_2026', { expiresIn: '10h' });

        // Set HttpOnly cookie
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return res.json({
            token,
            user: {
                id: userRecord.id,
                name: userRecord.name,
                email: userRecord.email,
                role: userRecord.role,
                subject: userRecord.subject
            }
        });
    } catch (err) {
        console.error('[AUTH] Login error:', err.message);
        return res.status(500).json({ msg: 'Server error during authentication.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/logout
// @desc    Clear auth cookie (server-side logout)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', auth, (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });
    return res.json({ msg: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current user from valid token (used to restore session)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const { id, role } = req.user;

        // Admin special case (hardcoded)
        if (id === '000000000000000000000000') {
            return res.json({
                user: { id, name: 'College Admin', email: 'college@gmail.com', role: 'admin' }
            });
        }

        const user = await User.findById(id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found.' });

        return res.json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role, subject: user.subject }
        });
    } catch (err) {
        console.error('[AUTH] /me error:', err.message);
        return res.status(500).json({ msg: 'Server error.' });
    }
});

module.exports = router;
