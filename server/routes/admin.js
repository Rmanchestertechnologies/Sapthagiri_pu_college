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
// @desc    Create a teacher (Saves to PostgreSQL + syncs MongoDB)
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

        // 3. Secondary sync to MongoDB Atlas if connected
        if (mongoose.connection.readyState === 1 && User) {
            try {
                const existingMongo = await User.findOne({ email: cleanEmail });
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
                console.warn('[ADMIN] Mongo sync notice:', mErr.message);
            }
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
// @desc    Get all teachers (PostgreSQL + MongoDB unified)
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teachersMap = new Map(); // email -> teacher object

        // 1. Fetch from PostgreSQL
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

        // 2. Fetch from MongoDB if connected
        if (mongoose.connection.readyState === 1 && User) {
            try {
                const mongoTeachers = await User.find({ role: 'teacher' }).select('-password').lean();
                for (const m of mongoTeachers) {
                    const emailKey = (m.email || '').toLowerCase();
                    if (!teachersMap.has(emailKey)) {
                        teachersMap.set(emailKey, {
                            _id: m._id.toString(),
                            id: m._id.toString(),
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

        // 2. Delete from MongoDB
        if (mongoose.connection.readyState === 1 && User) {
            try {
                if (mongoose.Types.ObjectId.isValid(teacherId)) {
                    await User.findByIdAndDelete(teacherId);
                } else if (deletedEmail) {
                    await User.deleteOne({ email: deletedEmail });
                }
            } catch (mErr) {
                console.warn('[ADMIN] MongoDB delete warning:', mErr.message);
            }
        }

        return res.json({ msg: 'Teacher deleted successfully.' });

    } catch (err) {
        console.error('[ADMIN] Error deleting teacher:', err.message);
        return res.status(500).json({ msg: 'Server error deleting teacher.' });
    }
});

module.exports = router;
