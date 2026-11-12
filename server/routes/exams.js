const express = require('express');
const { contentDisposition } = require('../utils/contentDisposition');
const router = express.Router();
const crypto = require('crypto');
const storage = require('../services/postgresStorage');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { detectLabIp } = require('../middleware/labIp');
const pool = require('../config/postgres');
const { createNotification } = require('./notifications');
const cbt = require('../services/cbtScoring');
const { issueSessionToken, requireSessionAccess, requireLabNetworkIfConfigured, isStaffRequest } = require('../middleware/sessionToken');

// Runs `fn` after every earlier call with the same key has finished (per server process).
const serialLocks = new Map();
async function serialized(key, fn) {
    const previous = serialLocks.get(key) || Promise.resolve();
    const run = previous.catch(() => {}).then(fn);
    serialLocks.set(key, run);
    try { return await run; } finally { if (serialLocks.get(key) === run) serialLocks.delete(key); }
}

// Students can only open exams that have been published. Staff may preview drafts.
const STUDENT_VISIBLE_STATUSES = ['live', 'scheduled', 'active'];
const examOpenToStudent = (exam, req) => STUDENT_VISIBLE_STATUSES.includes(String(exam?.status || '').toLowerCase()) || (String(exam?.status || '').toLowerCase() === 'draft' && isStaffRequest(req));
// Was used below without being imported, so every ID-only paper silently fell back to its cached copy.
const supabaseQuestions = require('../services/supabaseQuestions');

// A session row must belong to the exam named in the URL; otherwise one exam's answers could be
// scored against another exam's key.
const sessionBelongsToExam = (session, examId) => String(session?.exam_id ?? session?.examId ?? '') === String(examId);

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
        res.status(500).json({ msg: 'Server error commissioning exam. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server error fetching assignments. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server error fetching commissioned exams. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Merge 3 or 4 papers into one OnlineExam
// POST /api/exams/merge
// ─────────────────────────────────────────────────────────────────
router.post('/merge', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, paperIds, instructions, start_time, end_time, duration_minutes, allowedStudents } = req.body;

        if (!paperIds || paperIds.length === 0) {
            return res.status(400).json({ msg: `At least 1 paper must be selected to merge.` });
        }

        const allPapers = await storage.getPapers();
        let papers = paperIds.map(id => allPapers.find(p => String(p._id || p.id) === String(id))).filter(Boolean);

        if (papers.length !== paperIds.length) {
            for (const id of paperIds) {
                if (!papers.some(p => String(p._id || p.id) === String(id))) {
                    try {
                        const fetched = await storage.getPaperById(id);
                        if (fetched) papers.push(fetched);
                    } catch (e) {}
                }
            }
            // Subject order is the order the admin selected, not the order the papers happened to be found in.
            const rank = new Map(paperIds.map((id, i) => [String(id), i]));
            papers.sort((a, b) => (rank.get(String(a._id || a.id)) ?? 1e9) - (rank.get(String(b._id || b.id)) ?? 1e9));
        }
        const missingPapers = paperIds.filter(id => !papers.some(p => String(p._id || p.id) === String(id)));

        if (papers.length === 0) {
            return res.status(404).json({ msg: `None of the requested subject papers were found to merge.` });
        }

        // Merge questions from all papers preserving subject sections
        const seen = new Set();
        const mergedQuestions = [];
        const sectionsMap = {};
        let duplicatesSkipped = 0;
        // Marks follow the exam type, the same rule the CBT scoring uses (CET/KCET +1/0, others +4/-1). The merge used
        // to hard-code 4 marks and -1 for every exam, so a merged CET paper printed 4 marks per question while the
        // online exam scored 1.
        const scheme = cbt.markingScheme({ examType: examType || 'CET' });

        for (const paper of papers) {
            let availableQuestions = [...(paper.questionObjects && paper.questionObjects.length > 0 ? paper.questionObjects : (paper.questions || []))];
            if (availableQuestions.length > 0 && typeof availableQuestions[0] === 'string') {
                try {
                    availableQuestions = await supabaseQuestions.getQuestionsByIds(availableQuestions);
                } catch (e) {
                    availableQuestions = paper.questionObjects || [];
                }
            }

            const defSecName = `${paper.subject || 'Subject'} - Section A`;
            if (!sectionsMap[defSecName]) {
                // counts are filled in after duplicates are removed (they used to be taken before, so they were wrong)
                sectionsMap[defSecName] = {
                    sectionName: defSecName,
                    numQuestions: 0,
                    allowedToAnswer: 0,
                    markingRules: { correct: scheme.correct, incorrect: scheme.incorrect, unattempted: scheme.unattempted }
                };
            }

            for (const q of availableQuestions) {
                const qid = String(q._id || q.id || Math.random());
                if (seen.has(qid)) { duplicatesSkipped++; continue; }
                {
                    seen.add(qid);
                    sectionsMap[defSecName].numQuestions++;
                    sectionsMap[defSecName].allowedToAnswer++;
                    mergedQuestions.push({
                        ...q,
                        questionId: qid,
                        _id: qid,
                        subject: q.subject || paper.subject || 'General',
                        chapter: q.chapter || '',
                        concept: q.concept || '',
                        questionText: q.questionText || q.question || '',
                        options: q.options || [],
                        answer: q.answer || '',
                        solution: q.solution || q.explanation || '',
                        imageUrl: q.imageUrl || q.diagramUrl || null,
                        marks: scheme.correct,
                        type: q.type || 'MCQ',
                        sectionName: defSecName,
                        questionTextTranslation: q.questionTextTranslation || '',
                        optionsTranslation: q.optionsTranslation || []
                    });
                }
            }
        }

        const effectiveExamType = examType || 'CET';
        const getDefaultInstructions = (type) => `This is a composite ${type} Examination containing ${papers.length} merged subject sections (${mergedQuestions.length} total questions). Read each question carefully before answering.`;

        // 1. Create Merged Online Exam
        const exam = await storage.createExam({
            title: title || `Merged ${effectiveExamType} Grand Exam`,
            examType: effectiveExamType,
            sourcePapers: paperIds,
            questions: mergedQuestions,
            sections: Object.values(sectionsMap),
            instructions: instructions || getDefaultInstructions(effectiveExamType),
            start_time: start_time || null,
            end_time: end_time || null,
            duration_minutes: duration_minutes || 180,
            status: start_time ? 'scheduled' : 'draft',
            shuffleQuestions: req.body.shuffleQuestions || false,
            examMode: req.body.examMode || 'ONLINE',
            allowedStudents: Array.isArray(allowedStudents) ? allowedStudents : [],
            createdBy: req.user.id
        });

        // 2. Create Merged Question Paper (Printable A4 QP with PQRS & Answer Key support)
        const mergedSubjectTitle = papers.map(p => p.subject).filter(Boolean).join(' • ') || 'Multi-Subject Composite';
        const mergedPaper = await storage.savePaper({
            title: title || `Merged ${effectiveExamType} Grand Assessment`,
            subject: mergedSubjectTitle,
            examType: effectiveExamType,
            classLevel: papers[0]?.classLevel || papers[0]?.class_level || '12',
            // every class that any source paper belongs to (it used to take only the first paper's)
            classes: [...new Set(papers.flatMap(p => (Array.isArray(p.classes) && p.classes.length ? p.classes : [p.classLevel || p.class_level || '12']).map(String)))],
            durationMinutes: duration_minutes || 180,
            duration: `${duration_minutes || 180} Minutes`,
            totalMarks: mergedQuestions.length * scheme.correct,
            questions: mergedQuestions,
            questionObjects: mergedQuestions,
            instructions: instructions || getDefaultInstructions(effectiveExamType),
            status: 'Approved',
            isMerged: true,
            sourcePapers: paperIds,
            examId: exam?._id || exam?.id || null,
            teacherId: req.user.id,
            createdBy: req.user.id
        });

        res.status(201).json({
            msg: 'Exam and Merged Question Paper created successfully!',
            exam,
            paper: mergedPaper,
            // what the merge did not include, so it is never silent
            warnings: [
                ...(missingPapers.length ? [`${missingPapers.length} selected paper(s) were not found and were skipped.`] : []),
                ...(duplicatesSkipped ? [`${duplicatesSkipped} duplicate question(s) appeared in more than one paper and were included once.`] : [])
            ]
        });
    } catch (err) {
        console.error('Merge error:', err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/exams/:id
// Get a single exam by ID
// ─────────────────────────────────────────────────────────────────
// Staff only: the response contains every question's answer. A lab-terminal token (role 'lab')
// passes `auth`, so without the role check a student terminal could read the answer key.
router.get('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        res.json(exam);
    } catch (err) {
        console.error('Fetch Exam By ID Error:', err);
        res.status(500).json({ msg: 'Server error fetching exam. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/exams/:id
// Update an exam by ID
// ─────────────────────────────────────────────────────────────────
router.put('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const updated = await storage.updateExam(req.params.id, req.body);
        if (!updated) return res.status(404).json({ msg: 'Exam not found' });
        res.json({ msg: 'Exam updated successfully', exam: updated });
    } catch (err) {
        console.error('Update Exam Error:', err);
        res.status(500).json({ msg: 'Server error updating exam. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
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
        if (!examOpenToStudent(exam, req)) {
            return res.status(403).json({ msg: 'Exam is not currently available.' });
        }

        const { email, rollNumber } = req.query;
        if (rollNumber) {
            const studentCheck = await pool.query(
                `SELECT name, roll_number, enrollment_no, section, class_level 
                 FROM public.students 
                 WHERE roll_number = $1 OR enrollment_no = $1 
                 LIMIT 1`,
                [String(rollNumber).trim().replace(/[\s\-_]/g, '')]
            );
            if (studentCheck.rows.length === 0) {
                return res.status(403).json({ msg: 'Access Denied: Unregistered Student ID. Only officially enrolled students are permitted to take examinations.' });
            }
        }
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Start session
// POST /api/exams/:id/start
// ─────────────────────────────────────────────────────────────────
router.post('/:id/start', detectLabIp, requireLabNetworkIfConfigured, async (req, res) => {
    try {
        const rawExam = await storage.getExamById(req.params.id);
        if (!rawExam) return res.status(404).json({ msg: 'Exam not found' });
        // Hydrate so composite exams (questions held in subject papers) get a real answer sheet.
        const exam = await hydrateExamQuestions(rawExam);

        // /start never checked the status at all: a draft or archived exam could be started by its id.
        if (!examOpenToStudent(exam, req)) {
            return res.status(403).json({ msg: 'Exam is not currently available.' });
        }

        // Timing is decided by the server clock, not the student's computer.
        const withTiming = (session) => ({
            ...session,
            startTime: session.start_time || session.startTime,
            serverTime: new Date().toISOString(),
            remainingSeconds: cbt.remainingSeconds(exam, session),
            // Required (header x-session-token) by submit, autosave, malpractice, scorecard and leaderboard.
            sessionToken: issueSessionToken(session, req.params.id)
        });

        let { studentName, studentEmail, rollNumber } = req.body;
        let verifiedName = studentName;
        let verifiedSection = '';

        if (rollNumber) {
            const studentCheck = await pool.query(
                `SELECT name, roll_number, enrollment_no, section, class_level, email 
                 FROM public.students 
                 WHERE roll_number = $1 OR enrollment_no = $1 
                 LIMIT 1`,
                [String(rollNumber).trim().replace(/[\s\-_]/g, '')]
            );
            if (studentCheck.rows.length === 0) {
                return res.status(403).json({ msg: 'Access Denied: Unregistered Student ID. Only officially enrolled students are permitted to take examinations.' });
            }
            const s = studentCheck.rows[0];
            verifiedName = s.name || studentName;
            verifiedSection = s.section || '';
            if (!studentEmail) studentEmail = s.email || `${s.enrollment_no || rollNumber}@student.sapthagiri.edu`;
        }

        if (exam.allowedStudents && exam.allowedStudents.length > 0) {
            if (!exam.allowedStudents.includes(rollNumber)) {
                return res.status(403).json({ msg: 'You are not authorized to take this exam.' });
            }
        }

        // The "is there a sitting?" check and the insert must not interleave for the same student: two requests arriving
        // together (a double click, a re-render that fires the call twice, two terminals) each found nothing and each created
        // a sitting, leaving duplicate open sessions. Requests for one student/exam now run one after another.
        const lockKey = `${req.params.id}:${rollNumber || studentEmail || 'anonymous'}`;
        const outcome = await serialized(lockKey, async () => {
            // Check for existing active session
            const existing = await storage.findActiveSession(req.params.id, studentEmail, rollNumber);
            if (existing) return { status: 200, body: { msg: 'Session resumed', session: withTiming(existing) } };

            // One attempt per student. A student who was disqualified (or who submitted) used to be able to reload the portal
            // and start a brand-new sitting with full time. An administrator can reset an attempt
            // (DELETE /api/exams/:id/sessions/:sessionId).
            const finished = await storage.findSubmittedSession(req.params.id, studentEmail, rollNumber);
            if (finished) {
                const disq = Boolean(finished.malpractice_flag || finished.malpracticeFlag);
                return {
                    status: 409,
                    body: {
                        msg: disq
                            ? 'You were disqualified from this exam and cannot restart it. Please meet the invigilator.'
                            : 'You have already submitted this exam.',
                        alreadyFinished: true,
                        disqualified: disq
                    }
                };
            }

            const windowError = cbt.startWindowError(exam);
            if (windowError) return { status: 403, body: { msg: windowError } };
            if ((exam.questions || []).length === 0) {
                return { status: 409, body: { msg: 'This exam has no questions yet. Please inform the invigilator.' } };
            }

            const studentId = rollNumber || studentEmail || 'anonymous';
            let examQuestions = exam.questions || [];
            if (exam.shuffleQuestions) {
                examQuestions = seededShuffle(examQuestions, `${studentId}-${exam._id}`);
            }

            const session = await storage.createSession({
                examId: req.params.id,
                studentId,
                studentName: verifiedName || 'Student',
                studentEmail: studentEmail || '',
                rollNumber: rollNumber || '',
                fromLabIp: req.isLabIp,
                clientIp: req.clientIp,
                answers: examQuestions.map((q, idx) => ({
                    questionId: cbt.questionKey(q, idx),
                    selectedOption: null,
                    markedForReview: false,
                    visited: false
                })),
                totalQuestions: examQuestions.length
            });

            return { status: 201, body: { msg: 'Session started', session: withTiming(session) } };
        });

        res.status(outcome.status).json(outcome.body);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Submit exam
// POST /api/exams/:id/submit
// ─────────────────────────────────────────────────────────────────
router.post('/:id/submit', detectLabIp, requireSessionAccess({ sessionFrom: 'body', allowStaff: false }), async (req, res) => {
    try {
        const { sessionId, answers } = req.body;

        const session = await storage.getSessionById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (!sessionBelongsToExam(session, req.params.id)) {
            return res.status(400).json({ msg: 'This session does not belong to this exam.' });
        }
        if (session.submitted) return res.json({ msg: 'Already submitted', session, sessionId: session._id });

        const rawExam = await storage.getExamById(req.params.id);
        if (!rawExam) return res.status(404).json({ msg: 'Exam not found' });
        const exam = await hydrateExamQuestions(rawExam);

        // Server-side timing is authoritative. A submission arriving after the deadline (plus a
        // short network grace) is scored from the answers autosaved before the deadline; answers
        // first sent after it are not accepted. Nothing the student saved in time is lost.
        const late = cbt.isPastDeadline(exam, session);
        const answerMap = cbt.mergeAnswers(session.answers, late ? [] : answers);
        const result = cbt.scoreExam(exam, answerMap);

        const updatedSession = await storage.updateSession(sessionId, {
            answers: result.answers.map(({ isCorrect, ...a }) => a),
            score: result.score,
            correct: result.correct,
            incorrect: result.incorrect,
            unattempted: result.unattempted,
            attempted: result.attempted,
            submitted: true,
            end_time: new Date(),
            weak_areas: result.weakAreas
        });

        res.json({
            msg: late ? 'Time was over: the exam was submitted with your last saved answers.' : 'Exam submitted successfully',
            late,
            sessionId: updatedSession._id
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Get scorecard
// GET /api/exams/:id/scorecard/:sessionId
// ─────────────────────────────────────────────────────────────────
router.get('/:id/scorecard/:sessionId', detectLabIp, requireSessionAccess({ sessionFrom: 'params' }), async (req, res) => {
    try {
        const session = await storage.getSessionById(req.params.sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (!sessionBelongsToExam(session, req.params.id)) {
            return res.status(404).json({ msg: 'Session not found' });
        }
        // The breakdown contains every correct answer, so it must not be readable while the
        // paper is still being written.
        if (!session.submitted) {
            return res.status(403).json({ msg: 'The scorecard is available after the exam is submitted.' });
        }

        const rawExam = await storage.getExamById(req.params.id);
        if (!rawExam) return res.status(404).json({ msg: 'Exam not found' });
        const exam = await hydrateExamQuestions(rawExam);

        const breakdown = (exam.questions || []).map((q, idx) => {
            const sid = cbt.questionKey(q, idx);
            const ans = (session.answers || []).find(a => String(a.questionId) === sid);
            return {
                questionId: sid,
                questionText: q.questionText,
                subject: q.subject,
                chapter: q.chapter,
                selectedOption: ans?.selectedOption || null,
                correctAnswer: q.answer,
                // same rule that produced the stored score
                isCorrect: cbt.isAnswerCorrect(q, ans?.selectedOption)
            };
        });

        res.json({
            sessionId: session._id,
            studentName: session.student_name || session.studentName,
            studentEmail: session.student_email || session.studentEmail,
            rollNumber: session.roll_number || session.rollNumber,
            examTitle: exam.title,
            examType: exam.examType,
            score: Number(session.score) || 0, // NUMERIC columns arrive as strings
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get all results for an exam
// GET /api/exams/:id/results
// ─────────────────────────────────────────────────────────────────
router.get('/:id/results', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const sessions = await storage.getSessionsByExam(req.params.id);
        // The admin screens read camelCase fields, but the rows are snake_case, so names, roll numbers and
        // dates showed as blank / "Invalid Date" (also in the Excel export). Numbers also arrive as strings
        // from the NUMERIC column. Both naming styles are returned.
        res.json(sessions.map(s => ({
            ...s,
            studentName: s.student_name ?? s.studentName,
            studentEmail: s.student_email ?? s.studentEmail,
            rollNumber: s.roll_number ?? s.rollNumber,
            totalQuestions: s.total_questions ?? s.totalQuestions,
            score: Number(s.score) || 0,
            createdAt: s.created_at ?? s.createdAt,
            startTime: s.start_time ?? s.startTime,
            endTime: s.end_time ?? s.endTime,
            weakAreas: s.weak_areas ?? s.weakAreas,
            malpracticeFlag: Boolean(s.malpractice_flag ?? s.malpracticeFlag),
            malpracticeReason: s.malpractice_reason ?? s.malpracticeReason ?? ''
        })));
    } catch (err) {
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get Question Analytics
// GET /api/exams/:id/analytics
// ─────────────────────────────────────────────────────────────────
router.get('/:id/analytics', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const rawExam = await storage.getExamById(req.params.id);
        if (!rawExam) return res.status(404).json({ msg: 'Exam not found' });
        const exam = await hydrateExamQuestions(rawExam);

        // Only finished sittings count, and "correct" uses the same rule as scoring (services/cbtScoring.js);
        // the old plain string comparison disagreed with the scores shown next to it.
        const sessions = (await storage.getSessionsByExam(req.params.id)).filter(s => s.submitted);

        const analytics = (exam.questions || []).map((q, i) => {
            let correct = 0, incorrect = 0, unattempted = 0;
            const sid = cbt.questionKey(q, i);

            sessions.forEach(session => {
                const ans = (session.answers || []).find(a => String(a.questionId) === sid);
                const selected = ans?.selectedOption ?? null;

                if (selected !== null && String(selected).trim() !== '') {
                    if (cbt.isAnswerCorrect(q, selected)) correct++;
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Reset one student's attempt (e.g. after a disqualification caused by a power cut)
// DELETE /api/exams/:id/sessions/:sessionId
// ─────────────────────────────────────────────────────────────────
router.delete('/:id/sessions/:sessionId', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const session = await storage.getSessionById(req.params.sessionId);
        if (!session || !sessionBelongsToExam(session, req.params.id)) return res.status(404).json({ msg: 'Session not found' });
        await storage.deleteSession(session._id);
        console.log(`[ADMIN] ${req.user.id} reset attempt ${session._id} (roll ${session.roll_number}) of exam ${req.params.id}`);
        res.json({ msg: 'Attempt reset. The student can start the exam again.' });
    } catch (err) {
        console.error('Reset attempt error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Generate Bridge Key
// POST /api/exams/:id/bridge-key
// ─────────────────────────────────────────────────────────────────
router.post('/:id/bridge-key', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        const examId = String(exam._id || exam.id);

        // Generate only once: reuse the key that already exists for this exam
        const existing = await pool.query(
            'SELECT key, expires_at FROM public.bridge_keys WHERE exam_id = $1 ORDER BY created_at ASC LIMIT 1',
            [examId]
        );
        if (existing.rows[0]) {
            return res.json({ msg: 'Bridge key retrieved', key: existing.rows[0].key, expiresAt: existing.rows[0].expires_at });
        }

        const key = crypto.randomBytes(24).toString('hex');
        // Same lifetime the original implementation chose (10 years, effectively static). Anyone holding the key can
        // read the exam with its answers and all results, so treat it like a password.
        const created = await storage.createBridgeKey(key, examId, exam.title, req.user.id, new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000));
        res.json({ msg: 'Bridge key generated', key, expiresAt: created?.expires_at || created?.expiresAt || null });
    } catch (err) {
        console.error('Bridge key error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// BRIDGE APP: Fetch results by key
// GET /api/exams/bridge/:key
// ─────────────────────────────────────────────────────────────────
router.get('/bridge/:key', async (req, res) => {
    try {
        const bridgeKey = await storage.getBridgeKey(req.params.key);
        if (!bridgeKey) return res.status(404).json({ msg: 'Invalid bridge key.' });
        if (bridgeKey.expires_at && new Date(bridgeKey.expires_at).getTime() < Date.now()) {
            return res.status(410).json({ msg: 'This bridge key has expired. Ask the administrator to generate a new one.' });
        }
        const examId = bridgeKey.exam_id || bridgeKey.examId;

        const sessions = (await storage.getSessionsByExam(examId)).filter(s => s.submitted);

        // Retrieve full exam data including questions and answers
        const rawExam = await storage.getExamById(examId);
        const exam = rawExam ? await hydrateExamQuestions(rawExam) : null;

        res.json({
            examTitle: bridgeKey.exam_title || bridgeKey.examTitle,
            exam,
            results: sessions.map(s => ({
                studentId: s.student_id,
                studentName: s.student_name,
                rollNumber: s.roll_number,
                studentEmail: s.student_email,
                score: Number(s.score),
                totalQuestions: s.total_questions,
                attempted: s.attempted,
                correct: s.correct,
                incorrect: s.incorrect,
                unattempted: s.unattempted,
                weakAreas: s.weak_areas,
                fromLabIp: s.from_lab_ip,
                clientIp: s.client_ip,
                submittedAt: s.end_time,
                malpracticeFlag: s.malpractice_flag || false,
                malpracticeReason: s.malpractice_reason || '',
                answers: s.answers
            }))
        });
    } catch (err) {
        console.error('Bridge fetch error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Report malpractice
// POST /api/exams/:id/malpractice
// ─────────────────────────────────────────────────────────────────
router.post('/:id/malpractice', detectLabIp, requireSessionAccess({ sessionFrom: 'body', allowStaff: false }), async (req, res) => {
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

        if (session && !sessionBelongsToExam(session, req.params.id)) {
            return res.status(400).json({ msg: 'This session does not belong to this exam.' });
        }
        if (session && session.submitted) {
            // Never re-open or re-flag a finished sitting.
            return res.json({ msg: 'Session already closed', session });
        }

        if (session) {
            // storage.saveSession never existed, so this route used to fail with a 500 and the
            // session stayed open: a disqualified student could simply resume the exam.
            session = await storage.updateSession(session._id, {
                submitted: true,
                end_time: new Date(),
                malpractice_flag: true,
                malpractice_reason: reason || 'Window blurred or switched tab'
            });
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
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT & ADMIN: Get leaderboard / results list for an exam
// GET /api/exams/:id/leaderboard
// ─────────────────────────────────────────────────────────────────
router.get('/:id/leaderboard', requireSessionAccess(), async (req, res) => {
    try {
        const sessions = await storage.getSessionsByExam(req.params.id);
        const filtered = sessions.filter(s => s.submitted).map(s => ({
            studentName: s.student_name || s.studentName,
            rollNumber: s.roll_number || s.rollNumber,
            score: Number(s.score) || 0,
            correct: s.correct,
            incorrect: s.incorrect,
            unattempted: s.unattempted,
            weakAreas: s.weak_areas || s.weakAreas,
            endTime: s.end_time || s.endTime
        }));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Save intermediate progress (Autosave / Recover)
// POST /api/exams/:id/session/save-progress
// ─────────────────────────────────────────────────────────────────
router.post('/:id/session/save-progress', requireSessionAccess({ sessionFrom: 'body', allowStaff: false }), async (req, res) => {
    try {
        const { sessionId, answers } = req.body;
        if (!sessionId) return res.status(400).json({ msg: 'Session ID is required' });

        const session = await storage.getSessionById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (!sessionBelongsToExam(session, req.params.id)) {
            return res.status(400).json({ msg: 'This session does not belong to this exam.' });
        }
        if (session.submitted) return res.status(400).json({ msg: 'Cannot save progress for submitted exam' });
        // An empty payload would erase everything saved so far; treat it as a client fault.
        if (!Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ msg: 'No answers supplied; previously saved answers were kept.' });
        }

        const exam = await storage.getExamById(req.params.id);
        if (exam && cbt.isPastDeadline(exam, session)) {
            return res.status(403).json({ msg: 'Time is over. Answers can no longer be changed.', timeOver: true });
        }

        // Merge per question so a partial payload never drops answers saved earlier.
        const merged = [...cbt.mergeAnswers(session.answers, answers).values()];
        const updated = await storage.updateSession(sessionId, { answers: merged });
        res.json({
            msg: 'Progress autosaved successfully',
            serverTime: new Date().toISOString(),
            remainingSeconds: exam ? cbt.remainingSeconds(exam, session) : null,
            session: updated
        });
    } catch (err) {
        console.error('Autosave error:', err);
        res.status(500).json({ msg: 'Server Error during autosave. Please try again; if it keeps happening, tell the administrator.' });
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
        res.setHeader('Content-Disposition', contentDisposition(exam.title, 'docx', 'Exam'));
        res.send(buffer);
    } catch (err) {
        console.error('Exam Word export error:', err.message);
        res.status(500).json({ msg: 'Server error exporting exam to Word.', error: err.message });
    }
});

// @route   GET /api/exams/:id/pdf-report/:sessionId
// @desc    Download PDF scorecard for an exam session
// @access  Student (own), Teacher, Admin, Lab
router.get('/:id/pdf-report/:sessionId', detectLabIp, requireSessionAccess({ sessionFrom: 'params' }), async (req, res) => {
    try {
        const session = await storage.getSessionById(req.params.sessionId);
        if (!session || !sessionBelongsToExam(session, req.params.id)) return res.status(404).json({ msg: 'Session not found' });
        if (!session.submitted) return res.status(403).json({ msg: 'The report is available after the exam is submitted.' });

        const exam = await storage.getExamById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const { generateReportPdf } = require('../services/pdfReport');
        const buffer = await generateReportPdf(session, exam);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', contentDisposition(session.student_name || session.studentName, 'pdf', 'Result'));
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
        res.setHeader('Content-Disposition', contentDisposition(`${exam.title}_Reports`, 'zip', 'Reports'));

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
