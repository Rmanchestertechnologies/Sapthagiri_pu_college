const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { labIpOnly } = require('../middleware/labIp');
const OnlineExam = require('../models/OnlineExam');
const Student = require('../models/Student');

// ─────────────────────────────────────────────────────────────────
// STUDENT: Look up student by roll number
// GET /api/lab/student/:rollNumber
// ─────────────────────────────────────────────────────────────────
router.get('/student/:rollNumber', async (req, res) => {
    try {
        const student = await Student.findOne({ rollNumber: req.params.rollNumber });
        if (!student) {
            return res.status(404).json({ msg: 'Student not found. Please check your roll number.' });
        }
        res.json({
            name: student.name,
            rollNumber: student.rollNumber,
            section: student.section,
            email: student.email || ''
        });
    } catch (err) {
        console.error('Error fetching student:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// LAB LOGIN — IP restricted
// POST /api/lab/login
// ─────────────────────────────────────────────────────────────────
router.post('/login', labIpOnly, async (req, res) => {
    try {
        const { labId, password } = req.body;

        const envLabId = process.env.LAB_ID || 'lab001';
        const envLabPassword = process.env.LAB_PASSWORD || 'lab@123';

        if (labId !== envLabId) {
            return res.status(401).json({ msg: 'Invalid Lab ID or Password' });
        }

        const isMatch = password === envLabPassword;
        if (!isMatch) {
            return res.status(401).json({ msg: 'Invalid Lab ID or Password' });
        }

        // Issue a lab-scoped JWT
        const token = jwt.sign(
            { role: 'lab', labId, ip: req.clientIp },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: { role: 'lab', labId, name: 'Lab Student', ip: req.clientIp }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// LAB: Get available live exam for lab
// GET /api/lab/exams
// ─────────────────────────────────────────────────────────────────
router.get('/exams', labIpOnly, async (req, res) => {
    try {
        const now = new Date();

        // 1. Transition scheduled -> live
        await OnlineExam.updateMany(
            { status: 'scheduled', start_time: { $lte: now } },
            { $set: { status: 'live' } }
        );
        
        // 2. Transition live -> ended
        await OnlineExam.updateMany(
            { status: 'live', end_time: { $lte: now } },
            { $set: { status: 'ended' } }
        );

        const { rollNumber } = req.query;

        const query = {
            status: { $in: ['live', 'scheduled'] },
            $or: [
                { end_time: null },
                { end_time: { $gt: now } }
            ]
        };

        if (rollNumber) {
            query.$and = [
                {
                    $or: [
                        { allowedStudents: { $exists: false } },
                        { allowedStudents: { $size: 0 } },
                        { allowedStudents: rollNumber }
                    ]
                }
            ];
        }

        const exams = await OnlineExam.find(query)
            .select('title examType duration_minutes start_time end_time instructions status')
            .sort({ start_time: 1 });

        let examsWithSession = [];
        if (rollNumber) {
            const ExamSession = require('../models/ExamSession');
            const examIds = exams.map(e => e._id);
            const sessions = await ExamSession.find({
                examId: { $in: examIds },
                rollNumber: rollNumber
            });

            examsWithSession = exams.map(exam => {
                const session = sessions.find(s => s.examId.toString() === exam._id.toString());
                return {
                    ...exam.toObject(),
                    sessionStatus: session ? (session.submitted ? 'submitted' : 'active') : 'not_started',
                    sessionId: session ? session._id : null
                };
            });
        } else {
            examsWithSession = exams.map(exam => ({
                ...exam.toObject(),
                sessionStatus: 'not_started',
                sessionId: null
            }));
        }

        res.json(examsWithSession);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
