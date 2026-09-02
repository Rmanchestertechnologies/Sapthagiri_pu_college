const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');

const auth = require('../middleware/auth');
const pool = require('../config/postgres');
const Paper = require('../models/Paper');
const supabaseQuestions = require('../services/supabaseQuestions');

// Configure Multer for temporary file uploads
const uploadDir = path.resolve(__dirname, '../uploads/omr');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'omr-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max per image
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/i;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            return cb(null, true);
        }
        cb(new Error('Only JPG, JPEG, and PNG images are supported for OMR scanning.'));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: Enforce OMR Access Permission
// ─────────────────────────────────────────────────────────────────────────────
async function requireOmrAccess(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ msg: 'Authentication required.' });
    }

    if (req.user.role === 'admin') {
        return next();
    }

    try {
        const userId = req.user.id;
        const pgRes = await pool.query('SELECT omr_access FROM public.users WHERE id::text = $1', [userId.toString()]);
        if (pgRes.rows.length > 0 && pgRes.rows[0].omr_access === true) {
            return next();
        }
    } catch (e) {
        console.error('[OMR AUTH] Error checking permission:', e.message);
    }

    return res.status(403).json({
        msg: 'Access denied. You do not have permission to access the OMR Module. Please contact College Admin to enable OMR access for your faculty account.'
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Run Python OMR Scanner CLI
// ─────────────────────────────────────────────────────────────────────────────
function runOmrScannerCli(imagePath, examType) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(__dirname, '../omr_engine/scan_cli.py');
        const args = [
            scriptPath,
            '--image', imagePath,
            '--exam', (examType || 'neet').toLowerCase()
        ];

        execFile('python', args, { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }, (error, stdout, stderr) => {
            if (error) {
                console.error('[OMR CLI ERROR]', error.message, stderr);
                return reject(new Error(stderr || error.message || 'OMR scanner engine process failed.'));
            }

            try {
                const trimmed = stdout.trim();
                // Find first '{' in case of python warnings
                const firstBrace = trimmed.indexOf('{');
                const lastBrace = trimmed.lastIndexOf('}');
                if (firstBrace === -1 || lastBrace === -1) {
                    return reject(new Error('Invalid output format from OMR scanner engine.'));
                }
                const jsonStr = trimmed.slice(firstBrace, lastBrace + 1);
                const parsed = JSON.parse(jsonStr);
                if (parsed.success === false) {
                    return reject(new Error(parsed.error || 'OMR scanner detected sheet failure.'));
                }
                resolve(parsed);
            } catch (parseErr) {
                reject(new Error('Failed to parse OMR scanner output: ' + parseErr.message));
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Fetch and Populate QPG Paper Questions & Metadata
// ─────────────────────────────────────────────────────────────────────────────
async function getPaperWithQuestions(paperId) {
    let paper = null;

    // 1. Try PostgreSQL papers
    try {
        const pgRes = await pool.query('SELECT * FROM public.papers WHERE id::text = $1', [paperId.toString()]);
        if (pgRes.rows.length > 0) {
            paper = pgRes.rows[0];
        }
    } catch (e) {
        console.warn('[OMR] PG paper fetch notice:', e.message);
    }

    // 2. Try MongoDB Paper
    if (!paper && Paper) {
        try {
            paper = await Paper.findById(paperId).lean();
        } catch (e) {
            // ignore
        }
    }

    if (!paper) return null;

    let rawQuestions = paper.questions || paper.questionObjects || [];
    let populatedQuestions = [];

    if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
        if (typeof rawQuestions[0] === 'object' && (rawQuestions[0].questionText || rawQuestions[0].question || rawQuestions[0].answer)) {
            populatedQuestions = rawQuestions;
        } else {
            const stringIds = rawQuestions.map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
            if (stringIds.length > 0) {
                try {
                    const fetched = await supabaseQuestions.getQuestionsByIds(stringIds);
                    if (fetched && fetched.length > 0) {
                        const map = new Map(fetched.map(q => [String(q._id || q.id), q]));
                        populatedQuestions = stringIds.map(id => map.get(String(id))).filter(Boolean);
                    }
                } catch (err) {
                    console.error('[OMR] Supabase question population error:', err.message);
                }
            }
        }
    }

    if (populatedQuestions.length === 0 && Array.isArray(paper.questionObjects) && paper.questionObjects.length > 0) {
        populatedQuestions = paper.questionObjects;
    }

    return {
        paper,
        questions: populatedQuestions
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/omr/papers
// @desc    Get list of QPG papers available for OMR evaluation
// @access  Teacher (with OMR permission) or Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/papers', [auth, requireOmrAccess], async (req, res) => {
    try {
        const user = req.user;
        let papersList = [];

        // Fetch from PostgreSQL
        try {
            let query = `
                SELECT id, title, subject, classes, questions, created_at, status
                FROM public.papers
            `;
            const params = [];
            if (user.role !== 'admin') {
                query += ` WHERE teacher_id::text = $1 OR status IN ('Approved', 'Submitted')`;
                params.push(user.id.toString());
            }
            query += ` ORDER BY created_at DESC LIMIT 50;`;

            const pgRes = await pool.query(query, params);
            papersList = pgRes.rows.map(r => ({
                id: String(r.id),
                _id: String(r.id),
                title: r.title || 'Untitled Paper',
                subject: r.subject || 'General',
                classes: Array.isArray(r.classes) ? r.classes : (r.classes ? [r.classes] : []),
                questionCount: Array.isArray(r.questions) ? r.questions.length : 0,
                status: r.status || 'Approved',
                createdAt: r.created_at
            }));
        } catch (pgErr) {
            console.warn('[OMR] Postgres papers fetch notice:', pgErr.message);
        }

        // Fallback to Mongo if empty
        if (papersList.length === 0 && Paper) {
            try {
                const query = user.role === 'admin' ? {} : { teacherId: user.id };
                const mPapers = await Paper.find(query).sort({ createdAt: -1 }).limit(50).lean();
                papersList = mPapers.map(p => ({
                    id: String(p._id),
                    _id: String(p._id),
                    title: p.title || 'Untitled Paper',
                    subject: p.subject || 'General',
                    classes: p.classes || [],
                    questionCount: Array.isArray(p.questions) ? p.questions.length : 0,
                    status: p.status || 'Approved',
                    createdAt: p.createdAt
                }));
            } catch (mErr) {
                console.warn('[OMR] Mongo papers fetch notice:', mErr.message);
            }
        }

        return res.json({ papers: papersList });
    } catch (err) {
        console.error('[OMR] Error fetching papers:', err.message);
        return res.status(500).json({ msg: 'Failed to load QPG papers.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/omr/papers/:id/key
// @desc    Get populated questions, answer key, and concept metadata for a paper
// @access  Teacher (with OMR permission) or Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/papers/:id/key', [auth, requireOmrAccess], async (req, res) => {
    try {
        const paperData = await getPaperWithQuestions(req.params.id);
        if (!paperData || !paperData.paper) {
            return res.status(404).json({ msg: 'Question paper not found.' });
        }

        const questions = paperData.questions.map((q, idx) => {
            let cleanAns = (q.answer || q.correctAnswer || '').toString().trim().toUpperCase();
            // Normalize numeric answer to Letter: 1->A, 2->B, 3->C, 4->D
            if (cleanAns === '1') cleanAns = 'A';
            else if (cleanAns === '2') cleanAns = 'B';
            else if (cleanAns === '3') cleanAns = 'C';
            else if (cleanAns === '4') cleanAns = 'D';

            return {
                questionNumber: idx + 1,
                id: String(q._id || q.id || idx + 1),
                subject: q.subject || paperData.paper.subject || 'Physics',
                chapter: q.chapter || 'General',
                concept: q.concept || q.topic || q.chapter || 'General Concept',
                correctAnswer: cleanAns,
                questionText: q.questionText || q.question || ''
            };
        });

        // Compute unique subjects and concepts
        const subjects = [...new Set(questions.map(q => q.subject).filter(Boolean))];
        const concepts = [...new Set(questions.map(q => q.concept).filter(Boolean))];

        return res.json({
            paperId: String(paperData.paper.id || paperData.paper._id),
            title: paperData.paper.title,
            subject: paperData.paper.subject,
            totalQuestions: questions.length,
            subjects,
            concepts,
            questions
        });
    } catch (err) {
        console.error('[OMR] Error fetching answer key:', err.message);
        return res.status(500).json({ msg: 'Failed to retrieve answer key and question metadata.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/omr/scan
// @desc    Upload single or bulk OMR sheets, scan bubbles, evaluate against QPG key
// @access  Teacher (with OMR permission) or Admin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/scan', [auth, requireOmrAccess, upload.array('sheets', 100)], async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) {
        return res.status(400).json({ msg: 'Please upload at least one OMR sheet image.' });
    }

    const { paperId, examType = 'NEET', correctMarks, wrongMarks, blankMarks } = req.body;
    if (!paperId) {
        // Clean up uploaded files
        files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });
        return res.status(400).json({ msg: 'Question paper ID is required.' });
    }

    try {
        const paperData = await getPaperWithQuestions(paperId);
        if (!paperData || !paperData.paper || !paperData.questions || paperData.questions.length === 0) {
            files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });
            return res.status(404).json({ msg: 'Selected QPG paper not found or has no questions.' });
        }

        const questions = paperData.questions.map((q, idx) => {
            let cleanAns = (q.answer || q.correctAnswer || '').toString().trim().toUpperCase();
            if (cleanAns === '1') cleanAns = 'A';
            else if (cleanAns === '2') cleanAns = 'B';
            else if (cleanAns === '3') cleanAns = 'C';
            else if (cleanAns === '4') cleanAns = 'D';

            return {
                number: idx + 1,
                id: String(q._id || q.id || idx + 1),
                subject: q.subject || paperData.paper.subject || 'Physics',
                concept: q.concept || q.topic || q.chapter || 'General',
                correctAnswer: cleanAns
            };
        });

        // KCET has +1 for correct and 0 (NO negative marking) for wrong.
        // JEE and NEET have +4 for correct and -1 for wrong.
        const isKcet = (examType || '').toUpperCase() === 'KCET';
        const correctM = (req.body.correctMarks !== undefined && req.body.correctMarks !== '')
            ? Number(req.body.correctMarks)
            : (isKcet ? 1 : 4);
        const wrongM = (req.body.wrongMarks !== undefined && req.body.wrongMarks !== '')
            ? Number(req.body.wrongMarks)
            : (isKcet ? 0 : -1);
        const blankM = (req.body.blankMarks !== undefined && req.body.blankMarks !== '')
            ? Number(req.body.blankMarks)
            : 0;

        const results = [];
        const errors = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const originalName = file.originalname;

            try {
                const scanRes = await runOmrScannerCli(file.path, examType);
                const detectedAnswers = scanRes.answers || {};

                // Use detected roll number or fallback to clean filename
                let rollNumber = (scanRes.roll_number || '').trim();
                if (!rollNumber) {
                    const match = originalName.match(/\d{4,}/);
                    rollNumber = match ? match[0] : `ROLL-${Date.now().toString().slice(-5)}-${i + 1}`;
                }

                let studentName = scanRes.student_name || `Student ${rollNumber}`;
                const detectedSeries = scanRes.series || 'P';

                let totalScore = 0;
                let correctCount = 0;
                let wrongCount = 0;
                let blankCount = 0;

                const subjectStats = {};
                const conceptStats = {};
                const questionEvaluations = [];

                for (const q of questions) {
                    const qNum = String(q.number);
                    const detected = (detectedAnswers[qNum] || 'BLANK').trim().toUpperCase();
                    const correct = q.correctAnswer;

                    let status = 'not_attempted';
                    let marks = blankM;

                    if (detected === 'BLANK' || detected === 'UNATTEMPTED' || !detected) {
                        status = 'not_attempted';
                        marks = blankM;
                        blankCount++;
                    } else if (detected === correct) {
                        status = 'correct';
                        marks = correctM;
                        correctCount++;
                    } else {
                        status = 'wrong';
                        marks = wrongM;
                        wrongCount++;
                    }

                    totalScore += marks;

                    // Subject stats
                    const subj = q.subject || 'General';
                    if (!subjectStats[subj]) {
                        subjectStats[subj] = { correct: 0, wrong: 0, notAttempted: 0, total: 0, score: 0 };
                    }
                    subjectStats[subj].total++;
                    if (status === 'correct') {
                        subjectStats[subj].correct++;
                        subjectStats[subj].score += correctM;
                    } else if (status === 'wrong') {
                        subjectStats[subj].wrong++;
                        subjectStats[subj].score += wrongM;
                    } else {
                        subjectStats[subj].notAttempted++;
                        subjectStats[subj].score += blankM;
                    }

                    // Concept stats
                    const conc = q.concept || 'General';
                    if (!conceptStats[conc]) {
                        conceptStats[conc] = { concept: conc, subject: subj, correct: 0, wrong: 0, notAttempted: 0, total: 0 };
                    }
                    conceptStats[conc].total++;
                    if (status === 'correct') conceptStats[conc].correct++;
                    else if (status === 'wrong') conceptStats[conc].wrong++;
                    else conceptStats[conc].notAttempted++;

                    questionEvaluations.push({
                        questionNumber: q.number,
                        questionId: q.id,
                        subject: subj,
                        concept: conc,
                        detectedAnswer: detected,
                        correctAnswer: correct,
                        status,
                        marks
                    });
                }

                const scoreData = {
                    totalScore,
                    maxScore: questions.length * correctM,
                    correctCount,
                    wrongCount,
                    blankCount,
                    totalQuestions: questions.length,
                    accuracyPercent: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
                };

                // Save to PostgreSQL public.omr_submissions
                const insertRes = await pool.query(`
                    INSERT INTO public.omr_submissions (
                        paper_id, teacher_id, roll_number, student_name,
                        detected_series, detected_answers, correct_answers,
                        score_data, subject_scores, concept_analysis,
                        image_path, scan_status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'processed')
                    RETURNING id, created_at;
                `, [
                    paperId.toString(),
                    req.user.id.toString(),
                    rollNumber,
                    studentName,
                    detectedSeries,
                    JSON.stringify(detectedAnswers),
                    JSON.stringify(questionEvaluations),
                    JSON.stringify(scoreData),
                    JSON.stringify(subjectStats),
                    JSON.stringify(Object.values(conceptStats)),
                    file.filename
                ]);

                results.push({
                    submissionId: insertRes.rows[0].id,
                    filename: originalName,
                    rollNumber,
                    studentName,
                    detectedSeries,
                    scoreData,
                    subjectScores: subjectStats,
                    conceptAnalysis: Object.values(conceptStats),
                    questionsCount: questions.length
                });

            } catch (sheetErr) {
                console.error(`[OMR SCAN SHEET ERROR] ${originalName}:`, sheetErr.message);
                errors.push({
                    filename: originalName,
                    error: sheetErr.message || 'Sheet alignment or processing error.'
                });
            } finally {
                // Remove temporary uploaded image after evaluation
                try { fs.unlinkSync(file.path); } catch (e) {}
            }
        }

        return res.json({
            success: true,
            totalUploaded: files.length,
            processedCount: results.length,
            failedCount: errors.length,
            results,
            errors
        });

    } catch (err) {
        console.error('[OMR BATCH ERROR]:', err.message);
        files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });
        return res.status(500).json({ msg: 'Internal error processing OMR sheets: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/omr/results/:paperId
// @desc    Get full evaluated result sheet for a QPG paper
// @access  Teacher (with OMR permission) or Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/results/:paperId', [auth, requireOmrAccess], async (req, res) => {
    try {
        const pgRes = await pool.query(`
            SELECT id, paper_id, teacher_id, roll_number, student_name,
                   detected_series, score_data, subject_scores, concept_analysis,
                   scan_status, created_at
            FROM public.omr_submissions
            WHERE paper_id = $1
            ORDER BY (score_data->>'totalScore')::int DESC, roll_number ASC;
        `, [req.params.paperId.toString()]);

        const submissions = pgRes.rows.map((r, idx) => ({
            rank: idx + 1,
            id: r.id,
            rollNumber: r.roll_number,
            studentName: r.student_name || `Student ${r.roll_number}`,
            series: r.detected_series || 'P',
            scoreData: r.score_data || {},
            subjectScores: r.subject_scores || {},
            conceptAnalysis: r.concept_analysis || [],
            createdAt: r.created_at
        }));

        // Compute batch aggregate stats
        let totalStudents = submissions.length;
        let avgScore = 0;
        let topScore = 0;
        let totalCorrect = 0;
        let totalWrong = 0;
        let totalBlank = 0;

        if (totalStudents > 0) {
            topScore = submissions[0]?.scoreData?.totalScore || 0;
            let sumScore = 0;
            submissions.forEach(s => {
                sumScore += s.scoreData.totalScore || 0;
                totalCorrect += s.scoreData.correctCount || 0;
                totalWrong += s.scoreData.wrongCount || 0;
                totalBlank += s.scoreData.blankCount || 0;
            });
            avgScore = Math.round((sumScore / totalStudents) * 10) / 10;
        }

        return res.json({
            paperId: req.params.paperId,
            totalStudents,
            aggregate: {
                topScore,
                avgScore,
                totalCorrect,
                totalWrong,
                totalBlank
            },
            submissions
        });
    } catch (err) {
        console.error('[OMR RESULTS ERROR]:', err.message);
        return res.status(500).json({ msg: 'Failed to retrieve OMR results.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/omr/results/:paperId/student/:rollNumber
// @desc    Get detailed student diagnostic analysis (question & concept breakdown)
// @access  Teacher (with OMR permission) or Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/results/:paperId/student/:rollNumber', [auth, requireOmrAccess], async (req, res) => {
    try {
        const pgRes = await pool.query(`
            SELECT * FROM public.omr_submissions
            WHERE paper_id = $1 AND roll_number = $2
            ORDER BY created_at DESC LIMIT 1;
        `, [req.params.paperId.toString(), req.params.rollNumber.toString()]);

        if (pgRes.rows.length === 0) {
            return res.status(404).json({ msg: 'Student submission not found.' });
        }

        const sub = pgRes.rows[0];
        return res.json({
            id: sub.id,
            rollNumber: sub.roll_number,
            studentName: sub.student_name,
            series: sub.detected_series,
            scoreData: sub.score_data || {},
            subjectScores: sub.subject_scores || {},
            conceptAnalysis: sub.concept_analysis || [],
            questionEvaluations: sub.correct_answers || [],
            createdAt: sub.created_at
        });
    } catch (err) {
        console.error('[OMR STUDENT ANALYSIS ERROR]:', err.message);
        return res.status(500).json({ msg: 'Failed to retrieve student analysis.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/omr/submissions/:id
// @desc    Delete a submission to allow re-scanning
// @access  Teacher (with OMR permission) or Admin
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/submissions/:id', [auth, requireOmrAccess], async (req, res) => {
    try {
        await pool.query('DELETE FROM public.omr_submissions WHERE id = $1;', [req.params.id]);
        return res.json({ msg: 'OMR submission deleted successfully.' });
    } catch (err) {
        console.error('[OMR DELETE ERROR]:', err.message);
        return res.status(500).json({ msg: 'Failed to delete submission.' });
    }
});

module.exports = router;
