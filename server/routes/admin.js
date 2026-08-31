const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

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
// @desc    Create a teacher — PRIMARY: MongoDB Atlas, SECONDARY: PostgreSQL sync
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    const { name, email, password, subject } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Name, email and password are required.' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    // Standardize Maths to Mathematics
    let cleanSubject = (subject || '').trim();
    if (cleanSubject.toLowerCase() === 'maths') {
        cleanSubject = 'Mathematics';
    }

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

        // 3. Non-blocking background sync to MongoDB (does not delay or block HTTP response)
        if (mongoose.connection.readyState === 1 && User) {
            setImmediate(async () => {
                try {
                    const existingMongo = await Promise.race([
                        User.findOne({ email: cleanEmail }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                    ]);
                    if (!existingMongo) {
                        const mUser = new User({
                            name: cleanName,
                            email: cleanEmail,
                            password: hashedPassword,
                            role: 'teacher',
                            subject: cleanSubject
                        });
                        await mUser.save();
                    }
                } catch (mErr) {
                    console.warn('[ADMIN] Background Mongo sync notice:', mErr.message);
                }
            });
        }

        console.log(`[ADMIN] Teacher successfully created: ${cleanName} <${cleanEmail}> [${cleanSubject}]`);
        return res.json(teacherData);

    } catch (err) {
        console.error('[ADMIN] Create teacher error:', err.message);
        return res.status(500).json({ msg: 'Server error creating teacher: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/teachers
// @desc    Get all teachers (PostgreSQL primary, non-blocking MongoDB)
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teachersMap = new Map(); // email -> teacher object

        // 1. Fetch from PostgreSQL (Primary)
        try {
            const pgRes = await pool.query(`
                SELECT id, name, email, role, subject, created_at
                FROM public.users
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
                    createdAt: r.created_at,
                    created_at: r.created_at
                });
            }
        } catch (pgErr) {
            console.error('[ADMIN] PostgreSQL teachers fetch error:', pgErr.message);
        }

        // 2. Only query MongoDB if PostgreSQL returned 0 teachers
        if (teachersMap.size === 0 && mongoose.connection.readyState === 1 && User) {
            try {
                const mongoTeachers = await Promise.race([
                    User.find({ role: 'teacher' }).select('-password').lean(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
                for (const m of (mongoTeachers || [])) {
                    const emailKey = (m.email || '').toLowerCase();
                    if (!teachersMap.has(emailKey)) {
                        teachersMap.set(emailKey, {
                            _id: String(m._id),
                            id: String(m._id),
                            name: m.name,
                            email: m.email,
                            role: m.role,
                            subject: m.subject || '',
                            createdAt: m.createdAt,
                            created_at: m.createdAt
                        });
                    }
                }
            } catch (mErr) {
                console.warn('[ADMIN] Mongo teachers fetch notice:', mErr.message);
            }
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
    const teacherId = req.params.id;

    try {
        let deletedEmail = null;

        // 1. Delete from PostgreSQL
        try {
            const check = await pool.query('SELECT email FROM public.users WHERE id::text = $1', [teacherId.toString()]);
            if (check.rows.length > 0) {
                deletedEmail = check.rows[0].email;
            }
            await pool.query('DELETE FROM public.users WHERE id::text = $1', [teacherId.toString()]);
        } catch (pgErr) {
            console.warn('[ADMIN] PostgreSQL delete warning:', pgErr.message);
        }

        // 2. Non-blocking delete from MongoDB
        if (mongoose.connection.readyState === 1 && User) {
            setImmediate(async () => {
                try {
                    if (mongoose.Types.ObjectId.isValid(teacherId)) {
                        await User.findByIdAndDelete(teacherId);
                    } else if (deletedEmail) {
                        await User.deleteOne({ email: deletedEmail });
                    }
                } catch (mErr) {
                    console.warn('[ADMIN] MongoDB delete warning:', mErr.message);
                }
            });
        }

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
    const teacherId = req.params.id;
    const { newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
        return res.status(400).json({ msg: 'Password must be at least 4 characters.' });
    }

    const cleanPass = newPassword.trim();

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cleanPass, salt);
        let updatedEmail = null;

        // 1. Update in PostgreSQL
        try {
            const pgRes = await pool.query(`
                UPDATE public.users 
                SET password = $1 
                WHERE id::text = $2 
                RETURNING email, name
            `, [hashedPassword, teacherId.toString()]);

            if (pgRes.rows.length > 0) {
                updatedEmail = pgRes.rows[0].email;
            }
        } catch (pgErr) {
            console.warn('[ADMIN] PostgreSQL password update warning:', pgErr.message);
        }

        // 2. Non-blocking update in MongoDB
        if (mongoose.connection.readyState === 1 && User) {
            setImmediate(async () => {
                try {
                    if (mongoose.Types.ObjectId.isValid(teacherId)) {
                        await User.findByIdAndUpdate(teacherId, { password: hashedPassword });
                    } else if (updatedEmail) {
                        await User.updateOne({ email: updatedEmail }, { password: hashedPassword });
                    }
                } catch (mErr) {
                    console.warn('[ADMIN] MongoDB password update warning:', mErr.message);
                }
            });
        }

        console.log(`[ADMIN] Password reset successfully for teacher ID ${teacherId} (${updatedEmail || 'Postgres'})`);
        return res.json({ msg: 'Password updated successfully.' });
    } catch (err) {
        console.error('[ADMIN] Error updating password:', err.message);
        return res.status(500).json({ msg: 'Server error updating password.' });
    }
});

module.exports = router;
