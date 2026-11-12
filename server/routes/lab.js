const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { labIpOnly } = require('../middleware/labIp');
const storage = require('../services/postgresStorage');
const pool = require('../config/postgres'); // shared pool (this file used to open a second one)

// ─────────────────────────────────────────────────────────────────
// STUDENT: Look up student by roll number
// GET /api/lab/student/:rollNumber
// ─────────────────────────────────────────────────────────────────
// Lab terminals only (set LAB_IP): the lookup returns a student's name and SATS number for any roll number,
// so it must not be open to the whole internet. The student's e-mail address is no longer returned; the
// lab pages already fall back to a generated address.
router.get('/student/:rollNumber', labIpOnly, async (req, res) => {
    try {
        const roll = String(req.params.rollNumber || '').trim().replace(/[\s\-_]/g, '');
        if (!roll) {
            return res.status(400).json({ msg: 'Enrollment / Register Number is required.' });
        }

        const result = await pool.query(
            `SELECT name, roll_number, enrollment_no, sats_no, section, class_level, email 
             FROM public.students 
             WHERE roll_number = $1 OR enrollment_no = $1 
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
                email: ''
            });
        }

        return res.status(404).json({
            error: 'Not Enrolled',
            msg: `Enrollment ID "${roll}" is not recognized. Only enrolled Sapthagiri PU College students are authorized to access the exam portal.`
        });
    } catch (err) {
        console.error('Error fetching student:', err);
        res.status(500).json({ msg: 'Server error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// LAB LOGIN
// POST /api/lab/login
// ─────────────────────────────────────────────────────────────────
router.post('/login', labIpOnly, async (req, res) => {
    try {
        const { labId, password } = req.body;

        // Credentials come from the environment only. There are no built-in IDs, passwords or
        // signing secrets: anything hard-coded here is readable by everyone with the source code.
        const envLabId = process.env.LAB_ID;
        const envLabPassword = process.env.LAB_PASSWORD;
        if (!envLabId || !envLabPassword || !process.env.JWT_SECRET) {
            console.error('[LAB LOGIN] LAB_ID, LAB_PASSWORD and JWT_SECRET must be set in the server environment.');
            return res.status(503).json({ msg: 'Lab login is not configured on the server. Please contact the administrator.' });
        }

        const cleanId = String(labId || '').replace(/[\s\-_]/g, '').toLowerCase();
        const cleanEnvId = String(envLabId).replace(/[\s\-_]/g, '').toLowerCase();

        // Constant-time comparison of fixed-length digests (does not leak length or prefix).
        const digest = v => crypto.createHash('sha256').update(String(v ?? '')).digest();
        const isValidId = crypto.timingSafeEqual(digest(cleanId), digest(cleanEnvId));
        const isValidPassword = crypto.timingSafeEqual(digest(password), digest(envLabPassword));

        if (!isValidId || !isValidPassword) {
            return res.status(401).json({ msg: 'Invalid Lab ID or Password' });
        }

        const token = jwt.sign(
            { role: 'lab', labId: envLabId, ip: req.clientIp },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: { role: 'lab', labId: envLabId, name: `Lab Terminal ${envLabId}`, ip: req.clientIp }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

module.exports = router;
