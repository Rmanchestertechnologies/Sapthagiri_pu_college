const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');

const auth = require('../middleware/auth');
const pool = require('../config/postgres');
const supabaseQuestions = require('../services/supabaseQuestions');
const { OMR_ACCESS_SQL } = require('../config/userColumns');
const { buildSeriesKey, parseAnswerIndices, SERIES } = require('../services/pqrsKeys');
const { canUseOmrPaper } = require('../services/accessRules');
const { checkOmrRuntime, pythonBin, pythonEnv } = require('../services/omrRuntime');
const { evaluateSheet, parseMarks } = require('../services/omrEvaluator');

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
        const pgRes = await pool.query(`SELECT ${OMR_ACCESS_SQL} AS omr_access FROM public.users u WHERE id::text = $1`, [userId.toString()]);
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

        // `python` does not exist on most Linux hosts (Render); override with PYTHON_BIN when needed.
        execFile(pythonBin(), args, { maxBuffer: 10 * 1024 * 1024, timeout: 60000, env: pythonEnv() }, (error, stdout, stderr) => {
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
    // A database error is thrown to the caller (reported as a server error) instead of being treated as "paper not found".
    const pgRes = await pool.query('SELECT * FROM public.papers WHERE id::text = $1', [paperId.toString()]);
    const paper = pgRes.rows[0] || null;
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
// @route   GET /api/omr/health
// @desc    Can this server run the OMR engine? (used by the scan screen to explain a missing Python setup)
router.get('/health', [auth, requireOmrAccess], async (req, res) => {
    res.json(await checkOmrRuntime());
});

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

        return res.json({ papers: papersList });
    } catch (err) {
        console.error('[OMR] Error fetching papers:', err.message);
        return res.status(500).json({ msg: 'Failed to load QPG papers.' });
    }
});

// Answer parsing lives in services/pqrsKeys.js so the OMR evaluator and the PQRS key builder cannot drift apart.
const parseAnswerIndicesServer = parseAnswerIndices;

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
        if (!paperData || !paperData.paper || !canUseOmrPaper(req.user, paperData.paper)) {
            return res.status(404).json({ msg: 'Question paper not found.' });
        }

        const paperClasses = paperData.paper.classes || [];
        const isJee = Array.isArray(paperClasses) && paperClasses.some(c => String(c).toUpperCase() === 'JEE');

        const questions = paperData.questions.map((q, idx) => {
            const rawAns = q.correct_option || q.answer || q.correctAnswer || ''; // the option letter is the authority (see cbtScoring)
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

        // Key of each printed series, by question number. Sheets are graded against the series the
        // student sat, so this is what a teacher should check a series against.
        const seriesKeys = {};
        SERIES.forEach(series => {
            seriesKeys[series] = buildSeriesKey(paperData.paper, paperData.questions, series).map(k => ({
                questionNumber: k.position,
                masterQuestionNumber: k.masterIndex + 1,
                correctIndices: k.correctIndices,
                correctAnswer: k.correctIndices.map(i => isJee ? String.fromCharCode(65 + i) : String(i + 1)).join(', ')
            }));
        });

        return res.json({
            paperId: String(paperData.paper.id || paperData.paper._id),
            title: paperData.paper.title,
            subject: paperData.paper.subject,
            totalQuestions: questions.length,
            subjects,
            concepts,
            questions,
            seriesKeys
        });
    } catch (err) {
        console.error('[OMR] Error fetching answer key:', err.message);
        return res.status(500).json({ msg: 'Failed to retrieve answer key and question metadata.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Background scan jobs. A batch of up to 100 sheets takes minutes (the engine reads one sheet at a time), which is longer
// than hosting platforms keep an HTTP request open. With `?async=true` the scan route answers at once with a job id and the
// client polls GET /api/omr/scan/jobs/:id. Jobs live in memory (per server process) for one hour; the scored results
// themselves are stored in public.omr_submissions as before.
// ─────────────────────────────────────────────────────────────────────────────
const scanJobs = new Map();
const JOB_TTL_MS = 60 * 60 * 1000;
function createScanJob(ownerId, total) {
    const job = {
        id: require('crypto').randomBytes(12).toString('hex'),
        ownerId: String(ownerId),
        status: 'running',
        total,
        processed: 0,
        summary: null,
        error: null,
        createdAt: Date.now()
    };
    scanJobs.set(job.id, job);
    return job;
}
setInterval(() => {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of scanJobs) if (job.createdAt < cutoff) scanJobs.delete(id);
}, 10 * 60 * 1000).unref();

router.get('/scan/jobs/:jobId', [auth, requireOmrAccess], (req, res) => {
    const job = scanJobs.get(req.params.jobId);
    if (!job || (job.ownerId !== String(req.user.id) && req.user.role !== 'admin')) {
        return res.status(404).json({ msg: 'Scan job not found (it may have expired).' });
    }
    res.json({
        jobId: job.id,
        status: job.status,
        total: job.total,
        processed: job.processed,
        error: job.error,
        ...(job.status === 'done' ? job.summary : {})
    });
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

    const runtime = await checkOmrRuntime();
    if (!runtime.available) {
        files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
        return res.status(503).json({ msg: 'OMR scanning is not available on this server. ' + runtime.reason });
    }

    const { paperId, examType = 'NEET', correctMarks, wrongMarks, blankMarks } = req.body;
    if (!paperId) {
        // Clean up uploaded files
        files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });
        return res.status(400).json({ msg: 'Question paper ID is required.' });
    }

    try {
        const paperData = await getPaperWithQuestions(paperId);
        if (!paperData || !paperData.paper || !paperData.questions || paperData.questions.length === 0
            || !canUseOmrPaper(req.user, paperData.paper)) {
            files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });
            return res.status(404).json({ msg: 'Selected QPG paper not found or has no questions.' });
        }

        const paperClasses = paperData.paper.classes || [];
        const isJee = Array.isArray(paperClasses) && paperClasses.some(c => String(c).toUpperCase() === 'JEE');

        const questions = paperData.questions.map((q, idx) => {
            const rawAns = q.correct_option || q.answer || q.correctAnswer || ''; // the option letter is the authority (see cbtScoring)
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
        const marks = parseMarks(req.body, isKcet);
        if (marks.error) {
            files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });
            return res.status(400).json({ msg: marks.error });
        }
        const { correctM, wrongM, blankM } = marks;

        // Series keys are built once per request, lazily: P is the master order, Q/R/S are the
        // seeded permutations printed for that paper (see services/pqrsKeys.js).
        const seriesKeyCache = {};
        const keyForSeries = (series) => {
            if (!seriesKeyCache[series]) {
                const rows = buildSeriesKey(paperData.paper, paperData.questions, series);
                seriesKeyCache[series] = rows.map(r => {
                    const base = questions[r.masterIndex];
                    const idx = r.correctIndices;
                    return {
                        number: r.position,
                        id: base.id,
                        subject: base.subject,
                        concept: base.concept,
                        correctIndices: idx,
                        correctAnswer: idx.length > 0
                            ? idx.map(i => isJee ? String.fromCharCode(65 + i) : String(i + 1)).join(', ')
                            : base.correctAnswer
                    };
                });
            }
            return seriesKeyCache[series];
        };
        const rollsSeenInBatch = new Map();

        const asyncMode = req.query.async === 'true' || (req.body && req.body.async === 'true');
        const job = asyncMode ? createScanJob(req.user.id, files.length) : null;

        const processAll = async () => {
        const results = [];
        const errors = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const originalName = file.originalname;

            try {
                const scanRes = await runOmrScannerCli(file.path, examType);
                const detectedAnswers = scanRes.answers || {};

                // Roll number: the engine's reading, or (flagged) a number taken from the file name.
                let rollNumber = (scanRes.roll_number || '').trim();
                let rollInferred = false;
                if (!rollNumber) {
                    rollInferred = true;
                    const match = originalName.match(/\d{4,}/);
                    rollNumber = match ? match[0] : `ROLL-${Date.now().toString().slice(-5)}-${i + 1}`;
                }
                const duplicateRollInBatch = rollsSeenInBatch.has(rollNumber);
                rollsSeenInBatch.set(rollNumber, originalName);

                const studentName = scanRes.student_name || `Student ${rollNumber}`;
                const rawSeries = String(scanRes.series || '').trim().toUpperCase();
                const seriesKnown = SERIES.includes(rawSeries);
                // An unreadable or unknown series is graded against the master order (P) and flagged.
                const gradedSeries = seriesKnown ? rawSeries : 'P';
                const detectedSeries = rawSeries || 'P';

                const evaluation = evaluateSheet({
                    key: keyForSeries(gradedSeries),
                    detectedAnswers,
                    marks: { correctM, wrongM, blankM },
                    details: scanRes.answer_details || {},
                    flags: {
                        rollInferred,
                        duplicateRollInBatch,
                        seriesKnown,
                        rawSeries,
                        gradedSeries
                    }
                });
                const {
                    totalScore, correctCount, wrongCount, blankCount,
                    subjectStats, conceptStats, questionEvaluations, reviewReasons, multipleCount,
                    uncertainCount, lowConfidenceCount
                } = evaluation;

                const scoreData = {
                    totalScore,
                    maxScore: questions.length * correctM,
                    correctCount,
                    wrongCount,
                    blankCount,
                    multipleMarkedCount: multipleCount,
                    uncertainCount,
                    lowConfidenceCount,
                    totalQuestions: questions.length,
                    accuracyPercent: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0,
                    gradedAgainstSeries: gradedSeries,
                    needsReview: reviewReasons.length > 0,
                    reviewReasons
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
                    gradedAgainstSeries: gradedSeries,
                    needsReview: reviewReasons.length > 0,
                    reviewReasons,
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
                if (job) job.processed = i + 1;
            }
        }

        return {
            success: true,
            totalUploaded: files.length,
            processedCount: results.length,
            failedCount: errors.length,
            needsReviewCount: results.filter(r => r.needsReview).length,
            results,
            errors
        };
        };

        if (job) {
            processAll()
                .then(summary => { job.summary = summary; job.status = 'done'; })
                .catch(err => {
                    console.error('[OMR BATCH ERROR]:', err.message);
                    job.status = 'failed';
                    job.error = err.message;
                    files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
                });
            return res.status(202).json({ success: true, jobId: job.id, totalUploaded: files.length });
        }
        return res.json(await processAll());

    } catch (err) {
        console.error('[OMR BATCH ERROR]:', err.message);
        files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });
        return res.status(500).json({ msg: 'Internal error processing OMR sheets. Please try again; if it keeps happening, tell the administrator.' });
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
            WHERE paper_id = $1 AND ($2::boolean OR teacher_id = $3)
            ORDER BY (score_data->>'totalScore')::numeric DESC, roll_number ASC;
        `, [req.params.paperId.toString(), req.user.role === 'admin', String(req.user.id)]);

        const submissions = pgRes.rows.map((r, idx) => ({
            rank: idx + 1,
            id: r.id,
            rollNumber: r.roll_number,
            studentName: r.student_name || `Student ${r.roll_number}`,
            series: r.detected_series || 'P',
            needsReview: Boolean(r.score_data && r.score_data.needsReview),
            reviewReasons: (r.score_data && r.score_data.reviewReasons) || [],
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
            WHERE paper_id = $1 AND roll_number = $2 AND ($3::boolean OR teacher_id = $4)
            ORDER BY created_at DESC LIMIT 1;
        `, [req.params.paperId.toString(), req.params.rollNumber.toString(), req.user.role === 'admin', String(req.user.id)]);

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
        // A faculty member may only delete submissions they scanned themselves.
        const del = await pool.query(
            'DELETE FROM public.omr_submissions WHERE id = $1 AND ($2::boolean OR teacher_id = $3);',
            [req.params.id, req.user.role === 'admin', String(req.user.id)]
        );
        if (del.rowCount === 0) return res.status(404).json({ msg: 'Submission not found.' });
        return res.json({ msg: 'OMR submission deleted successfully.' });
    } catch (err) {
        console.error('[OMR DELETE ERROR]:', err.message);
        return res.status(500).json({ msg: 'Failed to delete submission.' });
    }
});

module.exports = router;
