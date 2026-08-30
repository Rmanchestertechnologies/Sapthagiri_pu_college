const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/postgres');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// @route   GET /api/admin
// @desc    Admin panel status / dashboard stats
// @access  Admin
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    res.json({ msg: 'Sapthagiri Admin portal accessible', role: req.user.role });
});

// @route   POST /api/admin/teachers
// @desc    Create a teacher
// @access  Admin
router.post('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    const { name, email, password, subject } = req.body;
    try {
        const cleanEmail = (email || '').trim().toLowerCase();
        // Check in PostgreSQL
        const existing = await pool.query('SELECT * FROM public.users WHERE email = $1', [cleanEmail]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ msg: 'Teacher already exists with this email.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const insertRes = await pool.query(`
            INSERT INTO public.users (name, email, password, role, subject)
            VALUES ($1, $2, $3, 'teacher', $4)
            RETURNING id, name, email, role, subject, created_at
        `, [name.trim(), cleanEmail, hashedPassword, subject || '']);

        const newTeacher = insertRes.rows[0];

        // Also sync to MongoDB if connected
        try {
            if (User && User.findOne) {
                const mExists = await User.findOne({ email: cleanEmail });
                if (!mExists) {
                    const mUser = new User({ name, email: cleanEmail, password: hashedPassword, role: 'teacher', subject });
                    await mUser.save();
                }
            }
        } catch (mErr) {
            // Ignore mongo sync error
        }

        res.json(newTeacher);
    } catch (err) {
        console.error('Error creating teacher:', err.message);
        res.status(500).json({ msg: 'Server error creating teacher' });
    }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers
// @access  Admin
router.get('/teachers', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const pgRes = await pool.query(`
            SELECT id, name, email, role, subject, created_at
            FROM public.users
            WHERE role = 'teacher'
            ORDER BY created_at DESC
        `);

        if (pgRes.rows && pgRes.rows.length > 0) {
            return res.json(pgRes.rows);
        }

        // Fallback to MongoDB if postgres is empty
        try {
            if (User && User.find) {
                const teachers = await User.find({ role: 'teacher' }).select('-password');
                return res.json(teachers);
            }
        } catch (mErr) {}

        res.json([]);
    } catch (err) {
        console.error('Error fetching teachers:', err.message);
        res.status(500).json({ msg: 'Server error fetching teachers' });
    }
});

// @route   DELETE /api/admin/teachers/:id
// @desc    Delete a teacher
// @access  Admin
router.delete('/teachers/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const teacherId = req.params.id;
        await pool.query('DELETE FROM public.users WHERE id = $1', [teacherId]);

        try {
            if (User && User.findByIdAndDelete) {
                await User.findByIdAndDelete(teacherId);
            }
        } catch (mErr) {}

        res.json({ msg: 'Teacher deleted successfully' });
    } catch (err) {
        console.error('Error deleting teacher:', err.message);
        res.status(500).json({ msg: 'Server error deleting teacher' });
    }
});

module.exports = router;
