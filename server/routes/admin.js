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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 1. PRIMARY: Check & Save to MongoDB Atlas
        let mongoUser = null;
        if (User) {
            const existingMongo = await User.findOne({ email: cleanEmail });
            if (existingMongo) {
                return res.status(400).json({ msg: 'Teacher already exists with this email.' });
            }

            mongoUser = new User({
                name: cleanName,
                email: cleanEmail,
                password: hashedPassword,
                role: 'teacher',
                subject: cleanSubject
            });
            await mongoUser.save();
        }

        // 2. SECONDARY: Sync to PostgreSQL if pool exists (non-blocking)
        try {
            const existingPg = await pool.query('SELECT id FROM public.users WHERE email = $1', [cleanEmail]);
            if (existingPg.rows.length === 0) {
                await pool.query(`
                    INSERT INTO public.users (name, email, password, role, subject)
                    VALUES ($1, $2, $3, 'teacher', $4)
                `, [cleanName, cleanEmail, hashedPassword, cleanSubject]);
            }
        } catch (pgErr) {
            console.warn('[ADMIN] PostgreSQL sync notice:', pgErr.message);
        }

        const teacherIdStr = mongoUser ? String(mongoUser._id) : null;
        console.log(`[ADMIN] Teacher successfully created: ${cleanName} <${cleanEmail}> [${cleanSubject}] - Mongo ID: ${teacherIdStr}`);

        return res.json({
            _id: teacherIdStr,
            id: teacherIdStr,
            name: mongoUser ? mongoUser.name : cleanName,
            email: cleanEmail,
            role: 'teacher',
            subject: cleanSubject,
            createdAt: mongoUser ? mongoUser.createdAt : new Date(),
            created_at: mongoUser ? mongoUser.createdAt : new Date()
        });

    } catch (err) {
        console.error('[ADMIN] Create teacher error:', err.message);
        return res.status(500).json({ msg: 'Server error creating teacher: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/admin/teachers
// @desc    Get all teachers — PRIMARY: MongoDB Atlas (guaranteed real Mongo _ids)
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teachersMap = new Map(); // email -> teacher object

        // 1. PRIMARY: Query MongoDB Atlas
        if (User) {
            try {
                const mongoTeachers = await User.find({ role: 'teacher' }).select('-password').lean();
                for (const m of mongoTeachers) {
                    const emailKey = (m.email || '').toLowerCase();
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
            } catch (mErr) {
                console.warn('[ADMIN] Mongo teachers fetch notice:', mErr.message);
            }
        }

        // 2. Check PostgreSQL for any legacy teachers not yet in MongoDB
        try {
            const pgRes = await pool.query(`
                SELECT id, name, email, password, role, subject, created_at
                FROM public.users
                WHERE role = 'teacher'
                ORDER BY created_at DESC
            `);

            for (const r of pgRes.rows) {
                const emailKey = (r.email || '').toLowerCase();
                // If this teacher is not in MongoDB, create a MongoDB document so they have a real Mongo _id
                if (!teachersMap.has(emailKey) && User) {
                    try {
                        let existingMongo = await User.findOne({ email: emailKey });
                        if (!existingMongo) {
                            existingMongo = new User({
                                name: r.name,
                                email: emailKey,
                                password: r.password || '$2a$10$defaultPlaceholderHashForLegacyAccount',
                                role: 'teacher',
                                subject: r.subject || ''
                            });
                            await existingMongo.save();
                        }
                        teachersMap.set(emailKey, {
                            _id: String(existingMongo._id),
                            id: String(existingMongo._id),
                            name: existingMongo.name,
                            email: existingMongo.email,
                            role: existingMongo.role,
                            subject: existingMongo.subject || '',
                            createdAt: existingMongo.createdAt,
                            created_at: existingMongo.createdAt
                        });
                    } catch (syncErr) {
                        console.warn('[ADMIN] Auto-sync legacy teacher to Mongo notice:', syncErr.message);
                    }
                }
            }
        } catch (pgErr) {
            console.warn('[ADMIN] PostgreSQL teachers fetch notice:', pgErr.message);
        }

        const teachersList = Array.from(teachersMap.values());
        console.log(`[ADMIN] Total active faculty found (all MongoDB backed): ${teachersList.length}`);
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
