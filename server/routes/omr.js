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

/**
 * Multi-Option Answer Parsing & Normalization (Server-Side)
 * Handles: single ('A', '1'), multi ('1, 2', 'A, B', '12', 'AB'), and phrases ('Both A and B', 'Both 1 and 2')
 */
function parseAnswerIndicesServer(rawAns, options = []) {
    if (rawAns === null || rawAns === undefined) return [];
    if (Array.isArray(rawAns)) {
        const set = new Set();
        rawAns.forEach(item => {
            parseAnswerIndicesServer(item, options).forEach(idx => set.add(idx));
        });
        return Array.from(set).sort((a, b) => a - b);
    }
    if (typeof rawAns === 'number') {
        if (rawAns >= 1 && rawAns <= 4) return [rawAns - 1];
        rawAns = String(rawAns);
    }
    const str = String(rawAns).trim();
    if (!str) return [];

    const indicesSet = new Set();

    // 1. "Both A and B", "Both 1 and 2", "Both (A) and (B)", "Both (1) and (2)"
    const bothMatch = str.match(/both\s*(?:\()?\s*([A-D1-4])\s*(?:\))?\s*(?:and|&|\/|,)\s*(?:\()?\s*([A-D1-4])\s*(?:\))?/i);
    if (bothMatch) {
        const toIdx = (char) => {
            const c = char.toUpperCase();
            if (/[1-4]/.test(c)) return parseInt(c, 10) - 1;
            return c.charCodeAt(0) - 65;
        };
        indicesSet.add(toIdx(bothMatch[1]));
        indicesSet.add(toIdx(bothMatch[2]));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    // 2. Concatenated digits: "12", "23", "34", "13", "123", "1234", "14"
    if (/^[1-4]{2,4}$/.test(str)) {
        str.split('').forEach(d => indicesSet.add(parseInt(d, 10) - 1));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    // 3. Concatenated letters: "AB", "BC", "CD", "AC", "BD", "ABC", "ABCD"
    if (/^[A-Da-d]{2,4}$/.test(str)) {
        str.toUpperCase().split('').forEach(ch => indicesSet.add(ch.charCodeAt(0) - 65));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    // 4. Delimited tokens: "1, 2", "A, B", "1 & 2", "A and B", "1 / 2", "A or B"
    const splitTokens = str
        .split(/[,;&/|\s]+|\band\b|\bor\b/i)
        .map(t => t.trim().replace(/[\(\)\[\]\.]/g, ''))
        .filter(Boolean);

    if (splitTokens.length > 1) {
        let allRecognized = true;
        const tempIndices = [];
        for (const token of splitTokens) {
            if (/^[1-4]$/.test(token)) {
                tempIndices.push(parseInt(token, 10) - 1);
            } else if (/^[A-Da-d]$/.test(token)) {
                tempIndices.push(token.toUpperCase().charCodeAt(0) - 65);
            } else {
                allRecognized = false;
                break;
            }
        }
        if (allRecognized && tempIndices.length > 0) {
            tempIndices.forEach(idx => indicesSet.add(idx));
            return Array.from(indicesSet).sort((a, b) => a - b);
        }
    }

    // 5. Single digit 1-4
    if (/^[1-4]$/.test(str)) {
        return [parseInt(str, 10) - 1];
    }

    // 6. Single letter A-D
    const singleLetter = str.match(/^[\(]?([A-Da-d])[\)\.]?$/);
    if (singleLetter) {
        return [singleLetter[1].toUpperCase().charCodeAt(0) - 65];
    }

    // 7. Match against option text
    const cleanStr = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/[\$\s\\{}]/g, '').toLowerCase();
    const targetStr = cleanStr(str);
    if (targetStr && options.length > 0) {
        const matchedIdx = options.findIndex((opt) => {
            const optText = typeof opt === 'object' && opt ? (opt.text || opt.optionText || '') : String(opt || '');
            const candidate = cleanStr(optText);
            if (!candidate) return false;
            if (candidate === targetStr) return true;
            if (targetStr.length > 4 && (candidate.includes(targetStr) || targetStr.includes(candidate))) return true;
            return false;
        });
        if (matchedIdx !== -1) return [matchedIdx];
    }

    return [];
}

function resolveAnswerServer(rawAns, isJee, options = []) {
    const indices = parseAnswerIndicesServer(rawAns, options);
    if (indices.length > 0) {
        const cleanRaw = String(rawAns).trim();
        const isCompact = /^[1-4]{2,4}$/.test(cleanRaw) || /^[A-Da-d]{2,4}$/.test(cleanRaw);
        if (isJee) {
            // JEE: letters A, B, C, D
            return indices.map(i => String.fromCharCode(65 + i)).join(isCompact ? '' : (indices.length > 1 ? ', ' : ''));
        } else {
            // KCET / NEET: numbers 1, 2, 3, 4
            return indices.map(i => String(i + 1)).join(isCompact ? '' : (indices.length > 1 ? ', ' : ''));
        }
    }
    return String(rawAns || '').trim().toUpperCase();
}

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

        const paperClasses = paperData.paper.classes || [];
        const isJee = Array.isArray(paperClasses) && paperClasses.some(c => String(c).toUpperCase() === 'JEE');

        const questions = paperData.questions.map((q, idx) => {
            const rawAns = q.answer || q.correctAnswer || '';
            const options = Array.isArray(q.options) ? q.options : [];
            const cleanAns = resolveAnswerServer(rawAns, isJee, options);
            const indices = parseAnswerIndicesServer(rawAns, options);

            return {
                questionNumber: idx + 1,
                id: String(q._id || q.id || idx + 1),
                subject: q.subject || paperData.paper.subject || 'Physics',
                chapter: q.chapter || 'General',
                concept: q.concept || q.topic || q.chapter || 'General Concept',
                correctAnswer: cleanAns,
                correctIndices: indices,
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

        const paperClasses = paperData.paper.classes || [];
        const isJee = Array.isArray(paperClasses) && paperClasses.some(c => String(c).toUpperCase() === 'JEE');

        const questions = paperData.questions.map((q, idx) => {
            const rawAns = q.answer || q.correctAnswer || '';
            const options = Array.isArray(q.options) ? q.options : [];
            const cleanAns = resolveAnswerServer(rawAns, isJee, options);
            const indices = parseAnswerIndicesServer(rawAns, options);

            return {
                number: idx + 1,
                id: String(q._id || q.id || idx + 1),
                subject: q.subject || paperData.paper.subject || 'Physics',
                concept: q.concept || q.topic || q.chapter || 'General',
                correctAnswer: cleanAns,
                correctIndices: indices
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
                    const correctIndices = q.correctIndices || [];

                    let status = 'not_attempted';
                    let marks = blankM;

                    if (detected === 'BLANK' || detected === 'UNATTEMPTED' || !detected) {
                        status = 'not_attempted';
                        marks = blankM;
                        blankCount++;
                    } else {
                        const studentIndices = parseAnswerIndicesServer(detected);
                        const isIndexMatch = studentIndices.length > 0 && correctIndices.length > 0 &&
                            studentIndices.some(idx => correctIndices.includes(idx));
                        const isDirectMatch = detected === correct ||
                            detected.replace(/[\s,]/g, '') === String(correct).replace(/[\s,]/g, '');

                        if (isIndexMatch || isDirectMatch) {
                            status = 'correct';
                            marks = correctM;
                            correctCount++;
                        } else {
                            status = 'wrong';
                            marks = wrongM;
                            wrongCount++;
                        }
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
