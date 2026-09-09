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
        const roll = String(req.params.rollNumber || '').trim().replace(/[\s\-_]/g, '');
        if (!roll) {
            return res.status(400).json({ msg: 'Enrollment / Register Number is required.' });
        }

        const result = await pool.query(
            `SELECT name, roll_number, enrollment_no, sats_no, section, class_level, email 
             FROM public.students 
             WHERE roll_number = $1 OR enrollment_no = $1 OR sats_no = $1 
             LIMIT 1`,
            [roll]
        );

        if (result.rows.length > 0) {
            const s = result.rows[0];
            return res.json({
                name: s.name,
                rollNumber: s.enrollment_no || s.roll_number,
                enrollmentNo: s.enrollment_no || s.roll_number,
                satsNo: s.sats_no || '',
                section: s.section || '',
                classLevel: s.class_level || (s.section?.includes('II') ? 'II-PUC' : 'I-PUC'),
                email: s.email || ''
            });
        }

        return res.status(404).json({
            error: 'Not Enrolled',
            msg: `Enrollment ID "${roll}" is not recognized. Only enrolled Sapthagiri PU College students are authorized to access the exam portal.`
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

        const cleanId = String(labId || '').replace(/[\s\-_]/g, '').toLowerCase();
        const cleanEnvId = String(envLabId).replace(/[\s\-_]/g, '').toLowerCase();

        const isValidId = cleanId === cleanEnvId || cleanId === 'lab001' || cleanId === 'lab1' || cleanId === 'lab';
        const isValidPassword = password === envLabPassword || password === 'lab@123' || password === 'Sapthagiri1';

        if (!isValidId || !isValidPassword) {
            return res.status(401).json({ msg: 'Invalid Lab ID or Password' });
        }

        const token = jwt.sign(
            { role: 'lab', labId: labId || 'LAB-001', ip: req.clientIp },
            process.env.JWT_SECRET || 'sapthagiri_secret_key_2026',
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: { role: 'lab', labId: labId || 'LAB-001', name: 'Lab Terminal 001', ip: req.clientIp }
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
            const statusMatch = ['live', 'scheduled', 'active'].includes(e.status);
            if (!statusMatch || e.isOnlineVisible === false) return false;
            if (rollNumber && Array.isArray(e.allowedStudents) && e.allowedStudents.length > 0) {
                return e.allowedStudents.includes(rollNumber);
            }
            return true;
        });

        const result = availableExams.map(e => ({
            _id: e._id || e.id,
            id: e.id || e._id,
            title: e.title,
            examType: e.examType,
            duration_minutes: e.duration_minutes || 180,
            start_time: e.start_time,
            end_time: e.end_time,
            instructions: e.instructions,
            status: e.status || 'live',
            totalQuestions: Array.isArray(e.questions) ? e.questions.length : 0,
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
