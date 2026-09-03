const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const storage = require('../services/postgresStorage');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { detectLabIp } = require('../middleware/labIp');
const supabaseQuestions = require('../services/supabaseQuestions');
const { createNotification } = require('./notifications');

// ─────────────────────────────────────────────────────────────────
// ADMIN: Commission a new Exam Assignment to Faculty
// POST /api/exams/commission
// ─────────────────────────────────────────────────────────────────
router.post('/commission', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, classes, subjectAssignments, instructions, duration_minutes } = req.body;
        if (!title) return res.status(400).json({ msg: 'Exam title is required.' });

        const newExam = await storage.createExam({
            title,
            examType: ['JEE', 'NEET', 'CET'].includes(examType) ? examType : 'CET',
            classes: Array.isArray(classes) ? classes : [classes || '12'],
            subjectAssignments: subjectAssignments || [],
            instructions: instructions || '',
            duration_minutes: duration_minutes || 180,
            status: 'draft',
            createdBy: req.user.id
        });

        // Dispatch notifications to assigned teachers in PostgreSQL
        if (Array.isArray(subjectAssignments)) {
            for (const sa of subjectAssignments) {
                if (sa.teacherId) {
                    try {
                        await createNotification({
                            recipient_role: 'teacher',
                            recipient_id: String(sa.teacherId),
                            sender_id: req.user.id,
                            sender_name: req.user.name || 'Admin Office',
                            type: 'exam_assignment',
                            title: `New Paper Assignment: ${title}`,
                            message: `Admin assigned you to compile ${sa.targetQuestions || 60} ${sa.subject} questions for ${title} (${examType || 'CET'}).`,
                            metadata: {
                                examId: newExam._id,
                                examTitle: title,
                                subject: sa.subject,
                                targetQuestions: sa.targetQuestions || 60,
                                examType: examType || 'CET',
                                classes: classes || ['12']
                            }
                        });
                    } catch (notifErr) {
                        console.error('Teacher notification error:', notifErr.message);
                    }
                }
            }
        }

        res.json({ msg: 'Exam successfully commissioned and dispatched to teachers', exam: newExam });
    } catch (err) {
        console.error('Commission Error:', err);
        res.status(500).json({ msg: 'Server error commissioning exam: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// TEACHER / ADMIN: Get active exam assignments delegated to current user
// GET /api/exams/my-assignments
// ─────────────────────────────────────────────────────────────────
router.get('/my-assignments', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const userSubject = req.user.subject;

        let exams = [];
        if (userRole === 'admin') {
            exams = await storage.getExams();
        } else {
            exams = await storage.getTeacherAssignments(userId, userSubject);
        }

        // Also resolve submitted papers for each assignment
        const allPapers = await storage.getPapers();
        for (const ex of exams) {
            if (Array.isArray(ex.subjectAssignments)) {
                for (const sa of ex.subjectAssignments) {
                    if (sa.submittedPaperId) {
                        const matchedPaper = allPapers.find(p => String(p._id || p.id) === String(sa.submittedPaperId));
                        if (matchedPaper) {
                            sa.submittedPaperId = matchedPaper;
                            sa.status = 'Completed';
                        }
                    } else {
                        // Fallback: match by title & subject
                        const matchedPaper = allPapers.find(p =>
                            p.title && p.title.toLowerCase().includes(ex.title.toLowerCase()) &&
                            (p.subject || '').toLowerCase().includes((sa.subject || '').toLowerCase())
                        );
                        if (matchedPaper) {
                            sa.submittedPaperId = matchedPaper;
                            sa.status = 'Completed';
                        }
                    }
                }
            }
        }

        res.json(exams);
    } catch (err) {
        console.error('Fetch Assignments Error:', err);
        res.status(500).json({ msg: 'Server error fetching assignments: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get all commissioned exams with real-time per-subject status & full question hydration
// GET /api/exams/commissioned
// ─────────────────────────────────────────────────────────────────
router.get('/commissioned', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exams = await storage.getExams();
        const allPapers = await storage.getPapers();

        const enrichedExams = await Promise.all(exams.map(async (exam) => {
            let allExamQuestions = [];

            if (Array.isArray(exam.subjectAssignments)) {
                for (const sa of exam.subjectAssignments) {
                    let paper = null;
                    if (sa.submittedPaperId) {
                        paper = allPapers.find(p => String(p._id || p.id) === String(sa.submittedPaperId));
                    }
                    if (!paper) {
                        paper = allPapers.find(p => 
                            p.title && p.title.toLowerCase().includes(exam.title.toLowerCase()) &&
                            (p.subject || '').toLowerCase().includes((sa.subject || '').toLowerCase())
                        );
                    }

                    if (paper && Array.isArray(paper.questions) && paper.questions.length > 0) {
                        let resolvedQuestions = [];
                        if (typeof paper.questions[0] === 'string') {
                            try {
                                resolvedQuestions = await supabaseQuestions.getQuestionsByIds(paper.questions);
                            } catch (e) {
                                resolvedQuestions = paper.questionObjects || [];
                            }
                        } else {
                            resolvedQuestions = paper.questions;
                        }

                        sa.submittedPaperId = { ...paper, questions: resolvedQuestions };
                        sa.questionsCount = resolvedQuestions.length;
                        sa.status = resolvedQuestions.length >= (sa.targetQuestions || 60) ? 'Completed' : 'In Progress';

                        resolvedQuestions.forEach(q => {
                            if (!q.subject) q.subject = sa.subject;
                            allExamQuestions.push(q);
                        });
                    } else if (paper && Array.isArray(paper.questionObjects) && paper.questionObjects.length > 0) {
                        sa.submittedPaperId = paper;
                        sa.questionsCount = paper.questionObjects.length;
                        sa.status = paper.questionObjects.length >= (sa.targetQuestions || 60) ? 'Completed' : 'In Progress';
                        paper.questionObjects.forEach(q => {
                            if (!q.subject) q.subject = sa.subject;
                            allExamQuestions.push(q);
                        });
                    } else {
                        sa.questionsCount = 0;
                    }
                }
            }

            if (Array.isArray(exam.questions) && exam.questions.length > 0) {
                exam.questions.forEach(q => allExamQuestions.push(q));
            }

            exam.allQuestions = allExamQuestions;
            exam.totalQuestionsAdded = allExamQuestions.length;
            return exam;
        }));

        res.json(enrichedExams);
    } catch (err) {
        console.error('Fetch Commissioned Error:', err);
        res.status(500).json({ msg: 'Server error fetching commissioned exams: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Merge 3 or 4 papers into one OnlineExam
// POST /api/exams/merge
// ─────────────────────────────────────────────────────────────────
router.post('/merge', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, paperIds, instructions, start_time, end_time, duration_minutes, allowedStudents } = req.body;

        if (!['JEE', 'NEET', 'CET'].includes(examType)) {
            return res.status(400).json({ msg: 'Invalid exam type. Must be JEE, NEET, or CET.' });
        }

        if (!paperIds || paperIds.length === 0) {
            return res.status(400).json({ msg: `At least 1 paper must be selected.` });
        }

        const allPapers = await storage.getPapers();
        const papers = paperIds.map(id => allPapers.find(p => String(p._id || p.id) === String(id))).filter(Boolean);

        if (papers.length !== paperIds.length) {
            return res.status(404).json({ msg: `One or more papers not found. Expected ${paperIds.length}, found ${papers.length}.` });
        }

        // Merge questions from all papers
        const seen = new Set();
        const mergedQuestions = [];
        const sectionsMap = {};

        for (const paper of papers) {
            let availableQuestions = [...(paper.questions || [])];
            if (availableQuestions.length > 0 && typeof availableQuestions[0] === 'string') {
                try {
                    availableQuestions = await supabaseQuestions.getQuestionsByIds(availableQuestions);
                } catch (e) {
                    availableQuestions = paper.questionObjects || [];
                }
            }

            const defSecName = `${paper.subject} - Section A`;
            if (!sectionsMap[defSecName]) {
                sectionsMap[defSecName] = {
                    sectionName: defSecName,
                    numQuestions: availableQuestions.length,
                    allowedToAnswer: 0,
                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                };
            }

            for (const q of availableQuestions) {
                const qid = String(q._id || q.id || Math.random());
                if (!seen.has(qid)) {
                    seen.add(qid);
                    mergedQuestions.push({
                        questionId: qid,
                        subject: q.subject || paper.subject,
                        chapter: q.chapter || '',
                        concept: q.concept || '',
                        questionText: q.questionText || q.question || '',
                        options: q.options || [],
                        answer: q.answer || '',
                        imageUrl: q.imageUrl || null,
                        marks: 4,
                        type: q.type || 'MCQ',
                        sectionName: defSecName,
                        questionTextTranslation: q.questionTextTranslation || '',
                        optionsTranslation: q.optionsTranslation || []
                    });
                }
            }
        }

        const getDefaultInstructions = (type) => `This is a ${type} Examination. Read each question carefully before answering.`;

        const exam = await storage.createExam({
            title: title || `Merged ${examType} Exam`,
            examType,
            sourcePapers: paperIds,
            questions: mergedQuestions,
            sections: Object.values(sectionsMap),
            instructions: instructions || getDefaultInstructions(examType),
            start_time: start_time || null,
            end_time: end_time || null,
            duration_minutes: duration_minutes || 180,
            status: start_time ? 'scheduled' : 'draft',
            shuffleQuestions: req.body.shuffleQuestions || false,
            examMode: req.body.examMode || 'ONLINE',
            allowedStudents: Array.isArray(allowedStudents) ? allowedStudents : [],
            createdBy: req.user.id
        });

        res.status(201).json({ msg: 'Exam created successfully', exam });
    } catch (err) {
        console.error('Merge error:', err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Create exam from a Grand Test paper
// POST /api/exams/from-grand-test
// ─────────────────────────────────────────────────────────────────
router.post('/from-grand-test', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { grandTestId, title, instructions, start_time, end_time, duration_minutes, allowedStudents } = req.body;

        const grandTests = await storage.getGrandTests();
        const gt = grandTests.find(g => String(g._id || g.id) === String(grandTestId));
        if (!gt) return res.status(404).json({ msg: 'Grand Test not found' });

        const getDefaultInstructions = (examType) => `This is a ${examType} Grand Test. Read all questions carefully.`;

        const exam = await storage.createExam({
            title: title || gt.title,
            examType: gt.examType,
            sourcePapers: [],
            sourceGrandTest: grandTestId,
            questions: [],
            instructions: instructions || getDefaultInstructions(gt.examType),
            start_time: start_time || null,
            end_time: end_time || null,
            duration_minutes: duration_minutes || 180,
            status: start_time ? 'scheduled' : 'draft',
            examMode: req.body.examMode || 'ONLINE',
            allowedStudents: Array.isArray(allowedStudents) ? allowedStudents : [],
            createdBy: req.user.id
        });

        res.status(201).json({ msg: 'Grand Test Exam created successfully', exam });
    } catch (err) {
        console.error('Grand Test exam creation error:', err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: List all online exams
// GET /api/exams
// ─────────────────────────────────────────────────────────────────
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exams = await storage.getExams();
        const safeExams = exams.map(e => ({
            ...e,
            questions: (e.questions || []).map(q => {
                const { answer, ...safeQ } = q;
                return safeQ;
            })
        }));
        res.json(safeExams);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT LAB PORTAL: Get all online CBT exams selected by admin
// GET /api/exams/lab-active
// Public access for lab terminals
// ─────────────────────────────────────────────────────────────────
router.get('/lab-active', async (req, res) => {
    try {
        const exams = await storage.getExams();
        const now = Date.now();

        // Filter to online exams: only exams where isOnlineVisible is true and not draft/archived
        const onlineExams = exams.filter(e => {
            const status = String(e.status || '').toLowerCase();
            const isVis = e.isOnlineVisible !== false && status !== 'draft' && status !== 'archived';
            return isVis;
        });

        const safeList = onlineExams.map(e => {
            const start = e.start_time ? new Date(e.start_time).getTime() : null;
            const duration = e.duration_minutes || 180;
            const end = e.end_time ? new Date(e.end_time).getTime() : (start ? start + duration * 60000 : null);

            return {
                _id: String(e._id || e.id),
                id: String(e.id || e._id),
                title: e.title,
                examType: e.examType || 'CET',
                classes: e.classes || ['12'],
                duration_minutes: duration,
                start_time: e.start_time || null,
                end_time: e.end_time || null,
                totalQuestions: Array.isArray(e.questions) ? e.questions.length : (e.totalQuestions || 60),
                status: e.status || 'live',
                isOnlineVisible: e.isOnlineVisible !== false,
                instructions: e.instructions || ''
            };
        });

        res.json({
            serverTime: new Date().toISOString(),
            exams: safeList
        });
    } catch (err) {
        console.error('Lab Active Exams Error:', err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Toggle Online Exam Visibility for an exam
// PUT /api/exams/:id/toggle-online-visibility
// ─────────────────────────────────────────────────────────────────
router.put('/:id/toggle-online-visibility', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        
        const currentVis = exam.isOnlineVisible !== false && exam.status !== 'draft' && exam.status !== 'archived';
        const newVis = !currentVis;
        const newStatus = newVis ? (exam.start_time ? 'scheduled' : 'live') : 'draft';
        
        const updated = await storage.updateExam(req.params.id, {
            isOnlineVisible: newVis,
            status: newStatus
        });
        res.json({ msg: `Exam online visibility updated to ${newVis ? 'Visible' : 'Hidden'}`, exam: updated });
    } catch (err) {
        console.error('Toggle visibility error:', err);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Create & publish an online CBT exam directly from a teacher paper
// POST /api/exams/from-paper
// ─────────────────────────────────────────────────────────────────
router.post('/from-paper', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { paperId, title, duration_minutes, start_time, end_time, instructions } = req.body;
        if (!paperId) return res.status(400).json({ msg: 'Paper ID is required' });

        const paper = await storage.getPaperById(paperId);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        const examTitle = title || paper.title || `${paper.subject} Online Examination`;
        const qList = Array.isArray(paper.questions) ? paper.questions : [];

        const newExam = await storage.createExam({
            title: examTitle,
            examType: paper.examType || (paper.classes && paper.classes.includes('NEET') ? 'NEET' : 'CET'),
            classes: Array.isArray(paper.classes) ? paper.classes : ['12'],
            duration_minutes: Number(duration_minutes) || paper.duration || 180,
            start_time: start_time || null,
            end_time: end_time || null,
            instructions: instructions || paper.instructions || '',
            questions: qList,
            totalQuestions: qList.length,
            status: 'live',
            isOnlineVisible: true,
            createdBy: req.user.id
        });

        res.json({ msg: 'Exam successfully created and enabled for Online CBT', exam: newExam });
    } catch (err) {
        console.error('Create from paper error:', err);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// Helper to hydrate full questions for composite/commissioned exams or string-ID questions
async function hydrateExamQuestions(exam) {
    if (!exam) return exam;
    const eObj = exam.toObject ? exam.toObject() : { ...exam };
    let questions = Array.isArray(eObj.questions) ? [...eObj.questions] : [];

    // 1. If questions is empty, but subjectAssignments has submitted papers, merge questions from all assignments!
    if (questions.length === 0 && Array.isArray(eObj.subjectAssignments) && eObj.subjectAssignments.length > 0) {
        const allPapers = await storage.getPapers();
        for (const sa of eObj.subjectAssignments) {
            let paper = null;
            if (sa.submittedPaperId) {
                paper = allPapers.find(p => String(p._id || p.id) === String(sa.submittedPaperId));
            }
            if (!paper) {
                paper = allPapers.find(p =>
                    p.title && p.title.toLowerCase().includes(eObj.title.toLowerCase()) &&
                    (p.subject || '').toLowerCase().includes((sa.subject || '').toLowerCase())
                );
            }
            if (paper && Array.isArray(paper.questions) && paper.questions.length > 0) {
                let paperQuestions = paper.questions;
                if (typeof paperQuestions[0] === 'string') {
                    try {
                        paperQuestions = await supabaseQuestions.getQuestionsByIds(paperQuestions);
                    } catch (err) {
                        paperQuestions = paper.questionObjects || [];
                    }
                }
                paperQuestions.forEach(q => {
                    const qClone = typeof q === 'object' && q !== null ? { ...q } : { questionText: String(q) };
                    if (!qClone.subject) qClone.subject = sa.subject;
                    questions.push(qClone);
                });
            } else if (paper && Array.isArray(paper.questionObjects) && paper.questionObjects.length > 0) {
                paper.questionObjects.forEach(q => {
                    const qClone = typeof q === 'object' && q !== null ? { ...q } : { questionText: String(q) };
                    if (!qClone.subject) qClone.subject = sa.subject;
                    questions.push(qClone);
                });
            }
        }
    } else if (questions.length > 0 && typeof questions[0] === 'string') {
        // 2. If questions contains string IDs, resolve them from Supabase!
        try {
            const resolved = await supabaseQuestions.getQuestionsByIds(questions);
            if (resolved && resolved.length > 0) {
                const map = new Map(resolved.map(q => [String(q._id || q.id), q]));
                const ordered = questions.map(id => map.get(String(id))).filter(Boolean);
                questions = ordered.length > 0 ? ordered : resolved;
            }
        } catch (err) {
            console.error('Error hydrating exam questions by id:', err.message);
        }
    }

    eObj.questions = questions;
    return eObj;
}

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get single exam (full, with answers for admin)
// GET /api/exams/admin/:id
// ─────────────────────────────────────────────────────────────────
router.get('/admin/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const rawExam = await storage.getExamById(req.params.id);
        if (!rawExam) return res.status(404).json({ msg: 'Exam not found' });
        const exam = await hydrateExamQuestions(rawExam);
        res.json(exam);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Update exam config (timing, instructions, status)
// PUT /api/exams/:id/config
// ─────────────────────────────────────────────────────────────────
router.put('/:id/config', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { start_time, end_time, duration_minutes, instructions, status, allowedStudents, examMode } = req.body;
        const update = {};
        if (start_time !== undefined) update.start_time = start_time;
        if (end_time !== undefined) update.end_time = end_time;
        if (duration_minutes !== undefined) update.duration_minutes = duration_minutes;
        if (instructions !== undefined) update.instructions = instructions;
        if (status !== undefined) update.status = status;
        if (examMode !== undefined) update.examMode = examMode;
        if (allowedStudents !== undefined) update.allowedStudents = Array.isArray(allowedStudents) ? allowedStudents : [];

        const exam = await storage.updateExam(req.params.id, update);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        res.json({ msg: 'Exam updated', exam });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Delete exam
// DELETE /api/exams/:id
// ─────────────────────────────────────────────────────────────────
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        await storage.deleteExam(req.params.id);
        await storage.deleteSessionsByExam(req.params.id);
        res.json({ msg: 'Exam deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// Seeded shuffle helper for deterministic question order
const seededShuffle = (arr, seed) => {
    let m = arr.length, t, i;
    let seedNum = 0;
    for (let charIdx = 0; charIdx < seed.length; charIdx++) {
        seedNum += seed.charCodeAt(charIdx);
    }
    const random = () => {
        let x = Math.sin(seedNum++) * 10000;
        return x - Math.floor(x);
    };
    const shuffled = [...arr];
    while (m) {
        i = Math.floor(random() * m--);
        t = shuffled[m];
        shuffled[m] = shuffled[i];
        shuffled[i] = t;
    }
    return shuffled;
};

// ─────────────────────────────────────────────────────────────────
// STUDENT: Get exam for taking (NO answers)
// GET /api/exams/:id/take
// ─────────────────────────────────────────────────────────────────
router.get('/:id/take', detectLabIp, async (req, res) => {
    try {
        const rawExam = await storage.getExamById(req.params.id);
        if (!rawExam) return res.status(404).json({ msg: 'Exam not found' });
        const exam = await hydrateExamQuestions(rawExam);
        if (!['live', 'scheduled', 'draft'].includes(exam.status)) {
            return res.status(403).json({ msg: 'Exam is not currently available.' });
        }

        const { email, rollNumber } = req.query;
        const studentId = rollNumber || email || 'anonymous';
        let examQuestions = exam.questions || [];
        if (exam.shuffleQuestions) {
            examQuestions = seededShuffle(examQuestions, `${studentId}-${exam._id}`);
        }

        // Strip answers before sending to student
        const safeExam = {
            _id: exam._id,
            id: exam.id,
            title: exam.title,
            examType: exam.examType,
            instructions: exam.instructions,
            duration_minutes: exam.duration_minutes,
            start_time: exam.start_time,
            end_time: exam.end_time,
            questions: examQuestions.map((q, idx) => ({
                _id: String(q._id || q.id || q.questionId || idx),
                questionId: q.questionId || q._id || q.id || idx,
                subject: q.subject,
                chapter: q.chapter,
                concept: q.concept,
                questionText: q.questionText,
                options: q.options,
                imageUrl: q.imageUrl,
                marks: q.marks,
                type: q.type || 'MCQ'
            }))
        };
        res.json(safeExam);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Start session
// POST /api/exams/:id/start
// ─────────────────────────────────────────────────────────────────
router.post('/:id/start', detectLabIp, async (req, res) => {
    try {
        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const { studentName, studentEmail, rollNumber } = req.body;

        if (exam.allowedStudents && exam.allowedStudents.length > 0) {
            if (!exam.allowedStudents.includes(rollNumber)) {
                return res.status(403).json({ msg: 'You are not authorized to take this exam.' });
            }
        }

        // Check for existing active session
        const existing = await storage.findActiveSession(req.params.id, studentEmail, rollNumber);
        if (existing) return res.json({ msg: 'Session resumed', session: existing });

        const studentId = rollNumber || studentEmail || 'anonymous';
        let examQuestions = exam.questions || [];
        if (exam.shuffleQuestions) {
            examQuestions = seededShuffle(examQuestions, `${studentId}-${exam._id}`);
        }

        const session = await storage.createSession({
            examId: req.params.id,
            studentId,
            studentName: studentName || 'Student',
            studentEmail: studentEmail || '',
            rollNumber: rollNumber || '',
            fromLabIp: req.isLabIp,
            clientIp: req.clientIp,
            answers: examQuestions.map((q, idx) => ({
                questionId: String(q._id || q.id || q.questionId || idx),
                selectedOption: null,
                markedForReview: false,
                visited: false
            })),
            totalQuestions: examQuestions.length
        });

        res.status(201).json({ msg: 'Session started', session });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

function parseAnswerIndicesExam(rawAns, options = []) {
    if (rawAns === null || rawAns === undefined) return [];
    if (Array.isArray(rawAns)) {
        const set = new Set();
        rawAns.forEach(item => {
            parseAnswerIndicesExam(item, options).forEach(idx => set.add(idx));
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

    if (/^[1-4]{2,4}$/.test(str)) {
        str.split('').forEach(d => indicesSet.add(parseInt(d, 10) - 1));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    if (/^[A-Da-d]{2,4}$/.test(str)) {
        str.toUpperCase().split('').forEach(ch => indicesSet.add(ch.charCodeAt(0) - 65));
        return Array.from(indicesSet).sort((a, b) => a - b);
    }

    const splitTokens = str.split(/[,;&/|\s]+|\band\b|\bor\b/i).map(t => t.trim().replace(/[\(\)\[\]\.]/g, '')).filter(Boolean);
    if (splitTokens.length > 1) {
        let allRecognized = true;
        const tempIndices = [];
        for (const token of splitTokens) {
            if (/^[1-4]$/.test(token)) tempIndices.push(parseInt(token, 10) - 1);
            else if (/^[A-Da-d]$/.test(token)) tempIndices.push(token.toUpperCase().charCodeAt(0) - 65);
            else { allRecognized = false; break; }
        }
        if (allRecognized && tempIndices.length > 0) {
            tempIndices.forEach(idx => indicesSet.add(idx));
            return Array.from(indicesSet).sort((a, b) => a - b);
        }
    }

    if (/^[1-4]$/.test(str)) return [parseInt(str, 10) - 1];
    const singleLetter = str.match(/^[\(]?([A-Da-d])[\)\.]?$/);
    if (singleLetter) return [singleLetter[1].toUpperCase().charCodeAt(0) - 65];

    return [];
}

// ─────────────────────────────────────────────────────────────────
// STUDENT: Submit exam
// POST /api/exams/:id/submit
// ─────────────────────────────────────────────────────────────────
router.post('/:id/submit', detectLabIp, async (req, res) => {
    try {
        const { sessionId, answers } = req.body;

        const session = await storage.getSessionById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (session.submitted) return res.json({ msg: 'Already submitted', session, sessionId: session._id });

        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const answerMap = {};
        if (answers && Array.isArray(answers)) {
            answers.forEach(a => { answerMap[String(a.questionId)] = a; });
        }

        let score = 0, correct = 0, incorrect = 0, unattempted = 0;
        const weakMap = {};

        const processedAnswers = (exam.questions || []).map((q, idx) => {
            const sid = String(q._id || q.id || q.questionId || idx);
            const submitted = answerMap[sid];
            let selected = submitted?.selectedOption || null;
            const markedForReview = submitted?.markedForReview || false;
            const timeTaken = submitted?.timeTaken || 0;

            let isAttempted = selected !== null && selected !== '';
            const isKcetExam = (exam.examType === 'CET' || exam.examType === 'KCET');
            let correctMarks = isKcetExam ? 1 : 4;
            let incorrectMarks = isKcetExam ? 0 : -1;
            let unattemptedMarks = 0;

            if (isAttempted) {
                let isCorrect = false;
                const parsedSelected = parseFloat(selected);
                const parsedAnswer = parseFloat(q.answer);
                if (!isNaN(parsedSelected) && !isNaN(parsedAnswer)) {
                    if (Math.abs(parsedSelected - parsedAnswer) <= 1e-9) isCorrect = true;
                }
                if (!isCorrect && String(selected).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) {
                    isCorrect = true;
                }
                if (!isCorrect) {
                    const selIndices = parseAnswerIndicesExam(selected, q.options || []);
                    const ansIndices = parseAnswerIndicesExam(q.answer, q.options || []);
                    if (selIndices.length > 0 && ansIndices.length > 0 && selIndices.some(idx => ansIndices.includes(idx))) {
                        isCorrect = true;
                    }
                }

                if (isCorrect) {
                    score += correctMarks;
                    correct++;
                } else {
                    score += incorrectMarks;
                    incorrect++;
                    const key = `${q.subject || 'Subject'}::${q.chapter || 'Chapter'}`;
                    if (!weakMap[key]) weakMap[key] = { subject: q.subject, chapter: q.chapter, incorrect: 0 };
                    weakMap[key].incorrect++;
                }
            } else {
                score += unattemptedMarks;
                unattempted++;
            }

            return { questionId: sid, selectedOption: selected, markedForReview, visited: submitted ? true : false, timeTaken };
        });

        const weakAreas = Object.values(weakMap).sort((a, b) => b.incorrect - a.incorrect);

        const updatedSession = await storage.updateSession(sessionId, {
            answers: processedAnswers,
            score,
            correct,
            incorrect,
            unattempted,
            attempted: correct + incorrect,
            submitted: true,
            end_time: new Date(),
            weakAreas
        });

        res.json({ msg: 'Exam submitted successfully', sessionId: updatedSession._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Get scorecard
// GET /api/exams/:id/scorecard/:sessionId
// ─────────────────────────────────────────────────────────────────
router.get('/:id/scorecard/:sessionId', detectLabIp, async (req, res) => {
    try {
        const session = await storage.getSessionById(req.params.sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const breakdown = (exam.questions || []).map((q, idx) => {
            const sid = String(q._id || q.id || q.questionId || idx);
            const ans = (session.answers || []).find(a => String(a.questionId) === sid);
            return {
                questionId: sid,
                questionText: q.questionText,
                subject: q.subject,
                chapter: q.chapter,
                selectedOption: ans?.selectedOption || null,
                correctAnswer: q.answer,
                isCorrect: ans && ans.selectedOption && String(ans.selectedOption).trim().toLowerCase() === String(q.answer).trim().toLowerCase()
            };
        });

        res.json({
            sessionId: session._id,
            studentName: session.student_name || session.studentName,
            studentEmail: session.student_email || session.studentEmail,
            rollNumber: session.roll_number || session.rollNumber,
            examTitle: exam.title,
            examType: exam.examType,
            score: session.score,
            totalQuestions: session.total_questions || session.totalQuestions,
            attempted: session.attempted,
            correct: session.correct,
            incorrect: session.incorrect,
            unattempted: session.unattempted,
            weakAreas: session.weak_areas || session.weakAreas,
            breakdown
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get all results for an exam
// GET /api/exams/:id/results
// ─────────────────────────────────────────────────────────────────
router.get('/:id/results', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const sessions = await storage.getSessionsByExam(req.params.id);
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get Question Analytics
// GET /api/exams/:id/analytics
// ─────────────────────────────────────────────────────────────────
router.get('/:id/analytics', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const sessions = await storage.getSessionsByExam(req.params.id);

        const analytics = (exam.questions || []).map((q, i) => {
            let correct = 0, incorrect = 0, unattempted = 0;
            const sid = String(q._id || q.id || q.questionId || i);

            sessions.forEach(session => {
                const ans = (session.answers || []).find(a => String(a.questionId) === sid);
                const selected = ans?.selectedOption || null;

                if (selected !== null && selected !== '') {
                    const isExactMatch = String(selected).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
                    if (isExactMatch) correct++;
                    else incorrect++;
                } else {
                    unattempted++;
                }
            });

            return {
                questionNumber: i + 1,
                subject: q.subject,
                correct,
                incorrect,
                unattempted,
                total: sessions.length
            };
        });

        res.json(analytics);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Generate Bridge Key
// POST /api/exams/:id/bridge-key
// ─────────────────────────────────────────────────────────────────
router.post('/:id/bridge-key', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        // Generate only once: check if a bridge key already exists for this exam
        let bridgeKey = await BridgeKey.findOne({ examId: exam._id });
        if (bridgeKey) {
            return res.json({ msg: 'Bridge key retrieved', key: bridgeKey.key, expiresAt: bridgeKey.expiresAt });
        }

        const key = crypto.randomBytes(24).toString('hex');
        bridgeKey = new BridgeKey({
            key,
            examId: exam._id,
            examTitle: exam.title,
            generatedBy: req.user.id,
            expiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000) // 10 years (static)
        });
        await bridgeKey.save();
        res.json({ msg: 'Bridge key generated', key, expiresAt: bridgeKey.expiresAt });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// BRIDGE APP: Fetch results by key
// GET /api/exams/bridge/:key
// ─────────────────────────────────────────────────────────────────
router.get('/bridge/:key', async (req, res) => {
    try {
        const bridgeKey = await BridgeKey.findOne({ key: req.params.key });
        if (!bridgeKey) return res.status(404).json({ msg: 'Invalid bridge key.' });

        const sessions = await ExamSession.find({ examId: bridgeKey.examId, submitted: true })
            .sort({ score: -1 });

        // Retrieve full exam data including questions and answers
        const exam = await OnlineExam.findById(bridgeKey.examId);

        res.json({
            examTitle: bridgeKey.examTitle,
            exam,
            results: sessions.map(s => ({
                studentId: s.studentId,
                studentName: s.studentName,
                rollNumber: s.rollNumber,
                studentEmail: s.studentEmail,
                score: s.score,
                totalQuestions: s.totalQuestions,
                attempted: s.attempted,
                correct: s.correct,
                incorrect: s.incorrect,
                unattempted: s.unattempted,
                weakAreas: s.weakAreas,
                fromLabIp: s.fromLabIp,
                clientIp: s.clientIp,
                submittedAt: s.endTime,
                malpracticeFlag: s.malpracticeFlag || false,
                malpracticeReason: s.malpracticeReason || '',
                answers: s.answers
            }))
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Report malpractice
// POST /api/exams/:id/malpractice
// ─────────────────────────────────────────────────────────────────
router.post('/:id/malpractice', detectLabIp, async (req, res) => {
    try {
        const { sessionId, reason } = req.body;
        let session = null;

        if (sessionId) {
            session = await storage.getSessionById(sessionId);
        }
        if (!session && req.params.id) {
            const sessions = await storage.getSessionsByExam(req.params.id);
            session = sessions.find(s => String(s._id || s.id) === String(sessionId));
        }

        if (session) {
            session.submitted = true;
            session.endTime = new Date();
            session.end_time = session.endTime;
            session.malpracticeFlag = true;
            session.malpractice_flag = true;
            session.malpracticeReason = reason || 'Window blurred or switched tab';
            session.malpractice_reason = reason || 'Window blurred or switched tab';
            await storage.saveSession(session);
        }

        const exam = await storage.getExamById(req.params.id);
        const sName = session?.studentName || session?.student_name || 'Candidate';
        const sRoll = session?.rollNumber || session?.roll_number || 'N/A';
        const examTitle = exam?.title || 'Online Exam';
        const violationReason = reason || 'Window blurred or switched tab';

        // Dispatch immediate Admin notification for cheating detection
        try {
            await createNotification({
                recipient_role: 'admin',
                type: 'malpractice_alert',
                title: '🚨 Cheating / Malpractice Detected',
                message: `Student ${sName} (Reg/Roll: ${sRoll}) was disqualified from exam "${examTitle}". Violation: ${violationReason}.`,
                metadata: {
                    examId: req.params.id,
                    sessionId: String(sessionId || session?._id || session?.id),
                    studentName: sName,
                    rollNumber: sRoll,
                    reason: violationReason,
                    detectedAt: new Date().toISOString()
                }
            });
        } catch (notifErr) {
            console.error('Error creating malpractice notification:', notifErr.message);
        }

        res.json({ msg: 'Malpractice reported and session locked', session });
    } catch (err) {
        console.error('Error reporting malpractice:', err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT & ADMIN: Get leaderboard / results list for an exam
// GET /api/exams/:id/leaderboard
// ─────────────────────────────────────────────────────────────────
router.get('/:id/leaderboard', async (req, res) => {
    try {
        const sessions = await storage.getSessionsByExam(req.params.id);
        const filtered = sessions.filter(s => s.submitted).map(s => ({
            studentName: s.student_name || s.studentName,
            rollNumber: s.roll_number || s.rollNumber,
            score: s.score,
            correct: s.correct,
            incorrect: s.incorrect,
            unattempted: s.unattempted,
            weakAreas: s.weak_areas || s.weakAreas,
            endTime: s.end_time || s.endTime
        }));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Save intermediate progress (Autosave / Recover)
// POST /api/exams/:id/session/save-progress
// ─────────────────────────────────────────────────────────────────
router.post('/:id/session/save-progress', async (req, res) => {
    try {
        const { sessionId, answers } = req.body;
        if (!sessionId) return res.status(400).json({ msg: 'Session ID is required' });

        const session = await storage.getSessionById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (session.submitted) return res.status(400).json({ msg: 'Cannot save progress for submitted exam' });

        const updated = await storage.updateSession(sessionId, { answers: answers || [] });
        res.json({ msg: 'Progress autosaved successfully', session: updated });
    } catch (err) {
        console.error('Autosave error:', err);
        res.status(500).json({ msg: 'Server Error during autosave: ' + err.message });
    }
});

// @route   GET /api/exams/:id/export-word
// @desc    Export online exam to Word (.docx)
// @access  Admin
router.get('/:id/export-word', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found.' });

        const paperAdapter = {
            title: exam.title,
            subject: exam.questions?.[0]?.subject || 'Mixed',
            classes: [exam.examType],
            questions: exam.questions,
            pattern: exam.sections
        };

        let template = null;
        if (exam.templateId) {
            const templates = await storage.getTemplates();
            template = templates.find(t => String(t._id || t.id) === String(exam.templateId));
        }

        const { generatePaperDoc } = require('../services/wordExport');
        const buffer = await generatePaperDoc(paperAdapter, template);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${exam.title.replace(/\s+/g, '_')}.docx"`);
        res.send(buffer);
    } catch (err) {
        console.error('Exam Word export error:', err.message);
        res.status(500).json({ msg: 'Server error exporting exam to Word.', error: err.message });
    }
});

// @route   GET /api/exams/:id/pdf-report/:sessionId
// @desc    Download PDF scorecard for an exam session
// @access  Student (own), Teacher, Admin
router.get('/:id/pdf-report/:sessionId', auth, async (req, res) => {
    try {
        const session = await storage.getSessionById(req.params.sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const { generateReportPdf } = require('../services/pdfReport');
        const buffer = await generateReportPdf(session, exam);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${(session.student_name || session.studentName || 'Result').replace(/\s+/g, '_')}.pdf"`);
        res.send(buffer);
    } catch (err) {
        console.error('PDF report error:', err.message);
        res.status(500).json({ msg: 'Server error generating PDF report.', error: err.message });
    }
});

// @route   GET /api/exams/:id/download-all-reports
// @desc    Download zip of all scorecards for an exam
// @access  Admin
router.get('/:id/download-all-reports', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const sessions = (await storage.getSessionsByExam(req.params.id)).filter(s => s.submitted);
        if (sessions.length === 0) {
            return res.status(400).json({ msg: 'No completed exam sessions found for this exam.' });
        }

        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${exam.title.replace(/\s+/g, '_')}_Reports.zip"`);

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(res);

        const { generateReportPdf } = require('../services/pdfReport');

        for (const session of sessions) {
            const pdfBuffer = await generateReportPdf(session, exam);
            const filename = `${(session.student_name || session.studentName || 'student').replace(/\s+/g, '_')}_Result.pdf`;
            archive.append(pdfBuffer, { name: filename });
        }

        await archive.finalize();
    } catch (err) {
        console.error('Zip reports error:', err.message);
        res.status(500).json({ msg: 'Server error generating zip reports.', error: err.message });
    }
});

module.exports = router;
