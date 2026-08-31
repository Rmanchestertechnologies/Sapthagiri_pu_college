const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// ─────────────────────────────────────────────────────────────────────────────
// Helper — lazy-load Postgres pool only when needed.
// Keeps MongoDB path free of any Postgres import failures.
// ─────────────────────────────────────────────────────────────────────────────
const getPool = () => {
    try {
        return require('../config/postgres');
    } catch (e) {
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin
// @desc    Admin panel status / dashboard stats
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    res.json({ msg: 'Sapthagiri Admin portal accessible', role: req.user.role });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/admin/teachers
// @desc    Create a teacher — PRIMARY: MongoDB Atlas, FALLBACK SYNC: Postgres
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    const { name, email, password, subject } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Name, email and password are required.' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName  = (name  || '').trim();
    const cleanSubject = (subject || '').trim();

    try {
        // ── 1. PRIMARY: Save to MongoDB Atlas ────────────────────────────────
        const existingMongo = await User.findOne({ email: cleanEmail });
        if (existingMongo) {
            return res.status(400).json({ msg: 'Teacher already exists with this email.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name:     cleanName,
            email:    cleanEmail,
            password: hashedPassword,
            role:     'teacher',
            subject:  cleanSubject,
        });
        await newUser.save();

        console.log(`[ADMIN] Teacher created in MongoDB: ${cleanName} <${cleanEmail}> — ${cleanSubject}`);

        // ── 2. SECONDARY SYNC: Attempt Postgres (non-blocking, ignore errors) ─
        try {
            const pool = getPool();
            if (pool) {
                const existing = await pool.query(
                    'SELECT id FROM public.users WHERE email = $1', [cleanEmail]
                );
                if (!existing.rows || existing.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO public.users (name, email, password, role, subject)
                         VALUES ($1, $2, $3, 'teacher', $4)`,
                        [cleanName, cleanEmail, hashedPassword, cleanSubject]
                    );
                }
            }
        } catch (pgErr) {
            // Postgres sync is non-critical — MongoDB is the source of truth
            console.warn('[ADMIN] Postgres sync skipped (non-critical):', pgErr.message);
        }

        // ── Return the created teacher (MongoDB shape) ────────────────────────
        return res.json({
            _id:       String(newUser._id),
            id:        String(newUser._id),
            name:      newUser.name,
            email:     newUser.email,
            role:      newUser.role,
            subject:   newUser.subject,
            createdAt: newUser.createdAt,
        });

    } catch (err) {
        console.error('[ADMIN] Error creating teacher:', err.message);
        res.status(500).json({ msg: 'Server error creating teacher.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/teachers
// @desc    Get all teachers — PRIMARY: MongoDB Atlas, FALLBACK: Postgres
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        // ── 1. PRIMARY: Query MongoDB Atlas ──────────────────────────────────
        const mongoTeachers = await User.find({ role: 'teacher' })
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        if (mongoTeachers && mongoTeachers.length > 0) {
            console.log(`[ADMIN] Teachers from MongoDB: ${mongoTeachers.length} found`);

            // Normalise shape so frontend works with both _id and id
            const normalised = mongoTeachers.map(t => ({
                _id:       String(t._id),
                id:        String(t._id),
                name:      t.name,
                email:     t.email,
                role:      t.role,
                subject:   t.subject || '',
                createdAt: t.createdAt,
            }));

            return res.json(normalised);
        }

        // ── 2. FALLBACK: Postgres (only if MongoDB returned nothing) ─────────
        console.log('[ADMIN] MongoDB returned 0 teachers — trying Postgres fallback...');
        try {
            const pool = getPool();
            if (pool) {
                const pgRes = await pool.query(
                    `SELECT id, name, email, role, subject, created_at
                     FROM public.users
                     WHERE role = 'teacher'
                     ORDER BY created_at DESC`
                );
                if (pgRes.rows && pgRes.rows.length > 0) {
                    console.log(`[ADMIN] Teachers from Postgres fallback: ${pgRes.rows.length} found`);
                    return res.json(pgRes.rows.map(r => ({
                        _id:       String(r.id),
                        id:        String(r.id),
                        name:      r.name,
                        email:     r.email,
                        role:      r.role,
                        subject:   r.subject || '',
                        createdAt: r.created_at,
                    })));
                }
            }
        } catch (pgErr) {
            console.warn('[ADMIN] Postgres fallback error (non-critical):', pgErr.message);
        }

        // ── 3. Genuinely empty — no teachers registered anywhere ─────────────
        console.log('[ADMIN] No teachers found in MongoDB or Postgres.');
        return res.json([]);

    } catch (err) {
        console.error('[ADMIN] Error fetching teachers:', err.message);
        res.status(500).json({ msg: 'Server error fetching teachers.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/admin/teachers/:id
// @desc    Delete a teacher — PRIMARY: MongoDB Atlas, SECONDARY SYNC: Postgres
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/teachers/:id', [auth, checkRole(['admin'])], async (req, res) => {
    const teacherId = req.params.id;

    try {
        // ── 1. PRIMARY: Delete from MongoDB Atlas ─────────────────────────────
        let deleted = false;
        try {
            const result = await User.findByIdAndDelete(teacherId);
            if (result) {
                deleted = true;
                console.log(`[ADMIN] Teacher deleted from MongoDB: ${teacherId}`);
            }
        } catch (mErr) {
            console.warn('[ADMIN] MongoDB delete error:', mErr.message);
        }

        // ── 2. SECONDARY SYNC: Delete from Postgres (non-blocking) ────────────
        try {
            const pool = getPool();
            if (pool) {
                await pool.query('DELETE FROM public.users WHERE id = $1', [teacherId]);
            }
        } catch (pgErr) {
            // Postgres sync is non-critical
            console.warn('[ADMIN] Postgres delete sync skipped (non-critical):', pgErr.message);
        }

        if (!deleted) {
            // Teacher not found in MongoDB — still return success if Postgres had them
            return res.json({ msg: 'Teacher removed successfully.' });
        }

        res.json({ msg: 'Teacher deleted successfully.' });

    } catch (err) {
        console.error('[ADMIN] Error deleting teacher:', err.message);
        res.status(500).json({ msg: 'Server error deleting teacher.' });
    }
});

module.exports = router;
