const express = require('express');
const router = express.Router();
const { OMR_ACCESS_SQL, UNDEFINED_COLUMN } = require('../config/userColumns');
const bcrypt = require('bcryptjs');
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const supabaseQuestions = require('../services/supabaseQuestions');
const maintenance = require('../services/maintenance');

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin
// @desc    Admin panel status / dashboard stats
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    res.json({ msg: 'Sapthagiri Admin portal accessible', role: req.user.role });
});

// ───────────────────────────────────────
// @route   GET/PUT /api/admin/maintenance
// @desc    Read / switch maintenance mode ("updates going on" screen for everyone except admins)
// @access  Admin
// ───────────────────────────────────────
router.get('/maintenance', [auth, checkRole(['admin'])], async (req, res) => {
    res.json(await maintenance.getState({ force: true }));
});
router.put('/maintenance', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { on, message, minutes } = req.body || {};
        if (typeof on !== 'boolean') return res.status(400).json({ msg: 'Send {"on": true|false}.' });
        const state = await maintenance.setState({ on, message, minutes });
        console.log(`[MAINTENANCE] ${on ? 'ON' : 'OFF'} by admin ${req.user.id}${state.until ? ` until ${state.until}` : ''}`);
        res.json(state);
    } catch (err) {
        console.error('Maintenance switch error:', err.message);
        res.status(500).json({ msg: 'Could not change maintenance mode. Nothing was changed.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/admin/teachers
// @desc    Create a teacher
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    const { name, email, password, subject } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Name, email and password are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ msg: 'Password must be at least 8 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({ msg: 'Please enter a valid e-mail address.' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    // Standardize Maths to Mathematics
    let cleanSubject = (subject || '').trim();
    if (cleanSubject.toLowerCase() === 'maths') {
        cleanSubject = 'Mathematics';
    }
    const ALLOWED_SUBJECTS = ['Physics', 'Chemistry', 'Botany', 'Zoology', 'Biology', 'Mathematics', 'Computer Science', 'Kannada', 'English', 'Hindi'];
    if (!ALLOWED_SUBJECTS.some(x => x.toLowerCase() === cleanSubject.toLowerCase())) {
        return res.status(400).json({ msg: 'Please choose a valid academic department.' });
    }
    cleanSubject = ALLOWED_SUBJECTS.find(x => x.toLowerCase() === cleanSubject.toLowerCase());

    try {
        // 1. Check if user already exists in PostgreSQL
        const existingPg = await pool.query('SELECT id FROM public.users WHERE email = $1', [cleanEmail]);
        if (existingPg.rows.length > 0) {
            return res.status(400).json({ msg: 'Teacher already exists with this email.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Insert into PostgreSQL (Primary Source of Truth)
        const insertRes = await pool.query(`
            INSERT INTO public.users (name, email, password, role, subject)
            VALUES ($1, $2, $3, 'teacher', $4)
            RETURNING id, name, email, role, subject, created_at
        `, [cleanName, cleanEmail, hashedPassword, cleanSubject]);

        const row = insertRes.rows[0];
        const teacherData = {
            _id: row.id.toString(),
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            subject: row.subject,
            createdAt: row.created_at,
            created_at: row.created_at
        };

        console.log(`[ADMIN] Teacher successfully created: ${cleanName} <${cleanEmail}> [${cleanSubject}]`);
        return res.json(teacherData);

    } catch (err) {
        console.error('[ADMIN] Create teacher error:', err.message);
        return res.status(500).json({ msg: 'Server error creating teacher. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/teachers
// @desc    Get all teachers
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teachersMap = new Map(); // email -> teacher object

        // 1. Fetch from PostgreSQL (Primary)
        try {
            const pgRes = await pool.query(`
                SELECT id, name, email, role, subject, ${OMR_ACCESS_SQL} AS omr_access, created_at
                FROM public.users u
                WHERE role = 'teacher'
                ORDER BY created_at DESC
            `);

            for (const r of pgRes.rows) {
                teachersMap.set(r.email.toLowerCase(), {
                    _id: r.id.toString(),
                    id: r.id,
                    name: r.name,
                    email: r.email,
                    role: r.role,
                    subject: r.subject || '',
                    omrAccess: Boolean(r.omr_access),
                    omr_access: Boolean(r.omr_access),
                    createdAt: r.created_at,
                    created_at: r.created_at
                });
            }
        } catch (pgErr) {
            console.error('[ADMIN] PostgreSQL teachers fetch error:', pgErr.message);
        }

        const teachersList = Array.from(teachersMap.values());
        console.log(`[ADMIN] Total active faculty found: ${teachersList.length}`);
        return res.json(teachersList);

    } catch (err) {
        console.error('[ADMIN] Error in GET /teachers:', err.message);
        return res.status(500).json({ msg: 'Server error fetching teachers.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/admin/teachers/:id
// @desc    Delete a teacher
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/teachers/:id', [auth, checkRole(['admin'])], async (req, res) => {
    const teacherId = String(req.params.id);

    try {
        // Only faculty accounts can be removed here: an administrator account must never be deleted from this screen.
        const result = await pool.query(
            "DELETE FROM public.users WHERE id::text = $1 AND role = 'teacher' RETURNING email",
            [teacherId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'Faculty account not found.' });
        }
        console.log(`[ADMIN] Faculty account removed: ${result.rows[0].email}`);
        return res.json({ msg: 'Teacher deleted successfully.' });
    } catch (err) {
        console.error('[ADMIN] Error deleting teacher:', err.message);
        return res.status(500).json({ msg: 'Server error deleting teacher.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/admin/teachers/:id/password
// @desc    Reset/Update teacher password
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.put('/teachers/:id/password', [auth, checkRole(['admin'])], async (req, res) => {
    const teacherId = String(req.params.id);
    const { newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
        return res.status(400).json({ msg: 'Password must be at least 8 characters.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
        const result = await pool.query(
            "UPDATE public.users SET password = $1 WHERE id::text = $2 AND role = 'teacher' RETURNING email",
            [hashedPassword, teacherId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'Faculty account not found.' });
        }
        console.log(`[ADMIN] Password reset for faculty ${result.rows[0].email}`);
        return res.json({ msg: 'Password updated successfully.' });
    } catch (err) {
        console.error('[ADMIN] Error updating password:', err.message);
        return res.status(500).json({ msg: 'Server error updating password.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/admin/teachers/:id/omr-access
// @desc    Assign or revoke OMR access permission for a teacher
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/teachers/:id/omr-access', [auth, checkRole(['admin'])], async (req, res) => {
    const teacherId = req.params.id;
    const { enabled } = req.body;

    try {
        let updatedUser = null;
        let isEnabled = typeof enabled === 'boolean' ? enabled : true;

        // 1. Update in PostgreSQL
        try {
            // If enabled wasn't provided, toggle existing state
            if (typeof enabled !== 'boolean') {
                const cur = await pool.query(`SELECT ${OMR_ACCESS_SQL} AS omr_access FROM public.users u WHERE id::text = $1`, [teacherId.toString()]);
                if (cur.rows.length > 0) {
                    isEnabled = !cur.rows[0].omr_access;
                }
            }

            const pgRes = await pool.query(`
                UPDATE public.users
                SET omr_access = $1
                WHERE id::text = $2
                RETURNING id, name, email, role, subject, omr_access
            `, [isEnabled, teacherId.toString()]);

            if (pgRes.rows.length > 0) {
                updatedUser = pgRes.rows[0];
            }
        } catch (pgErr) {
            console.error('[ADMIN] PostgreSQL OMR access update error:', pgErr.message);
            if (pgErr.code === UNDEFINED_COLUMN) {
                return res.status(409).json({ msg: 'OMR access cannot be saved yet: the database needs migration 002 (adds users.omr_access). Run: node scripts/migrate.js --apply' });
            }
        }

        if (!updatedUser) {
            return res.status(404).json({ msg: 'Teacher not found.' });
        }

        console.log(`[ADMIN] OMR access ${isEnabled ? 'GRANTED' : 'REVOKED'} for teacher ${updatedUser.name} (${updatedUser.email})`);
        return res.json({
            msg: `OMR access ${isEnabled ? 'granted' : 'revoked'} successfully.`,
            teacher: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                omrAccess: Boolean(updatedUser.omr_access),
                omr_access: Boolean(updatedUser.omr_access)
            }
        });
    } catch (err) {
        console.error('[ADMIN] Error updating OMR access:', err.message);
        return res.status(500).json({ msg: 'Server error updating OMR access.' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/questions-daily-stats
// @desc    Redacted for strict institutional metric privacy
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/questions-daily-stats', [auth, checkRole(['admin'])], async (req, res) => {
    return res.json({
        totalQuestions: null,
        addedToday: null,
        subjectsToday: {},
        databases: [],
        dailyTimeline: []
    });
});

module.exports = router;
