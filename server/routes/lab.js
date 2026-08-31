const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { labIpOnly } = require('../middleware/labIp');
const storage = require('../services/postgresStorage');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Look up student by roll number
// GET /api/lab/student/:rollNumber
// ─────────────────────────────────────────────────────────────────
router.get('/student/:rollNumber', async (req, res) => {
    try {
        const roll = req.params.rollNumber;
        const result = await pool.query(
            'SELECT name, roll_number, section, email FROM public.students WHERE roll_number = $1 LIMIT 1',
            [roll]
        );

        if (result.rows.length > 0) {
            const s = result.rows[0];
            return res.json({
                name: s.name,
                rollNumber: s.roll_number,
                section: s.section,
                email: s.email || ''
            });
        }

        // Return fallback student record if student table hasn't imported this roll number
        res.json({
            name: `Student (${roll})`,
            rollNumber: roll,
            section: 'A',
            email: ''
        });
    } catch (err) {
        console.error('Error fetching student:', err);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// LAB LOGIN
// POST /api/lab/login
// ─────────────────────────────────────────────────────────────────
router.post('/login', labIpOnly, async (req, res) => {
    try {
        const { labId, password } = req.body;

        const envLabId = process.env.LAB_ID || 'lab001';
        const envLabPassword = process.env.LAB_PASSWORD || 'lab@123';

        if (labId !== envLabId || password !== envLabPassword) {
            return res.status(401).json({ msg: 'Invalid Lab ID or Password' });
        }

        const token = jwt.sign(
            { role: 'lab', labId, ip: req.clientIp },
            process.env.JWT_SECRET || 'sapthagiri_secret_key_2026',
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: { role: 'lab', labId, name: 'Lab Student', ip: req.clientIp }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// LAB: Get available live exam for lab
// GET /api/lab/exams
// ─────────────────────────────────────────────────────────────────
router.get('/exams', labIpOnly, async (req, res) => {
    try {
        const { rollNumber } = req.query;
        const exams = await storage.getExams();

        const availableExams = exams.filter(e => {
            const statusMatch = ['live', 'scheduled', 'draft'].includes(e.status);
            if (!statusMatch) return false;
            if (rollNumber && Array.isArray(e.allowedStudents) && e.allowedStudents.length > 0) {
                return e.allowedStudents.includes(rollNumber);
            }
            return true;
        });

        const result = availableExams.map(e => ({
            _id: e._id,
            id: e.id,
            title: e.title,
            examType: e.examType,
            duration_minutes: e.duration_minutes,
            start_time: e.start_time,
            end_time: e.end_time,
            instructions: e.instructions,
            status: e.status,
            sessionStatus: 'not_started',
            sessionId: null
        }));

        res.json(result);
    } catch (err) {
        console.error('Lab exams error:', err);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

module.exports = router;
