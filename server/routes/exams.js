const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Paper = require('../models/Paper');
const Question = require('../models/Question');
const OnlineExam = require('../models/OnlineExam');
const ExamSession = require('../models/ExamSession');
const BridgeKey = require('../models/BridgeKey');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { detectLabIp } = require('../middleware/labIp');
const supabaseQuestions = require('../services/supabaseQuestions');

// ─────────────────────────────────────────────────────────────────
const { createNotification } = require('./notifications');

// ADMIN: Commission a new Exam Assignment to Faculty
// POST /api/exams/commission
// ─────────────────────────────────────────────────────────────────
router.post('/commission', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, classes, subjectAssignments, instructions, duration_minutes } = req.body;

        // 1. Title validation
        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ msg: 'Exam title is required.' });
        }

        // 2. Subject assignments array validation
        if (!Array.isArray(subjectAssignments) || subjectAssignments.length === 0) {
            return res.status(400).json({ msg: 'At least one subject faculty assignment is required.' });
        }

        // 3. Safe createdBy resolution (MongoDB ObjectId vs legacy fallback)
        let createdBy = undefined;
        if (req.user && req.user.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
            createdBy = req.user.id;
        }

        // 4. Resolve and validate each faculty teacherId server-side against MongoDB User model
        const resolvedAssignments = [];
        for (const sa of subjectAssignments) {
            if (!sa || typeof sa !== 'object') continue;
            const subject = (sa.subject || '').trim();
            if (!subject) {
                return res.status(400).json({ msg: 'Subject is required for all assignments.' });
            }

            if (!sa.teacherId) {
                return res.status(400).json({ msg: `Please assign a faculty member for ${subject}.` });
            }

            const rawTeacherId = String(sa.teacherId).trim();
            if (!mongoose.Types.ObjectId.isValid(rawTeacherId)) {
                return res.status(400).json({ msg: `Invalid MongoDB faculty ID for ${subject}.` });
            }

            const teacher = await User.findOne({ _id: rawTeacherId, role: 'teacher' });
            if (!teacher) {
                return res.status(400).json({ msg: `Selected ${subject} faculty was not found.` });
            }

            resolvedAssignments.push({
                subject,
                teacherId: teacher._id,
                teacherName: teacher.name,
                teacherEmail: teacher.email,
                targetQuestions: Number(sa.targetQuestions) || 60,
                difficultyDistribution: sa.difficultyDistribution || { easy: 40, medium: 40, hard: 20 },
                status: 'Pending',
                assignedDate: new Date()
            });
        }

        if (resolvedAssignments.length === 0) {
            return res.status(400).json({ msg: 'No valid subject assignments provided.' });
        }

        // 5. Construct OnlineExam document
        const examData = {
            title: title.trim(),
            examType: ['JEE', 'NEET', 'CET'].includes(examType) ? examType : 'CET',
            classes: Array.isArray(classes) && classes.length > 0 ? classes : [classes || '12'],
            subjectAssignments: resolvedAssignments,
            instructions: instructions || '',
            duration_minutes: Number(duration_minutes) || 180,
            status: 'draft'
        };

        if (createdBy) {
            examData.createdBy = createdBy;
        }

        const newExam = new OnlineExam(examData);

        // Pre-validate before save
        const validationError = newExam.validateSync();
        if (validationError) {
            console.error('OnlineExam validation error:', validationError.message);
            return res.status(400).json({ msg: `Exam validation failed: ${validationError.message}` });
        }

        await newExam.save();

        // 6. Dispatch notifications safely
        for (const sa of resolvedAssignments) {
            if (sa.teacherId) {
                try {
                    await createNotification({
                        recipient_role: 'teacher',
                        recipient_id: sa.teacherId.toString(),
                        sender_id: req.user?.id ? String(req.user.id) : null,
                        sender_name: req.user?.name || 'Admin Office',
                        type: 'exam_assignment',
                        title: `New Paper Assignment: ${title.trim()}`,
                        message: `Admin assigned you to compile ${sa.targetQuestions} ${sa.subject} questions for ${title.trim()} (${examData.examType}).`,
                        metadata: {
                            examId: newExam._id.toString(),
                            examTitle: title.trim(),
                            subject: sa.subject,
                            targetQuestions: sa.targetQuestions,
                            examType: examData.examType,
                            classes: examData.classes
                        }
                    });
                } catch (notifErr) {
                    console.error('Teacher notification error (non-critical):', notifErr.message);
                }
            }
        }

        res.json({ msg: 'Exam successfully commissioned and dispatched to teachers', exam: newExam });
    } catch (err) {
        console.error('Commission Error:', {
            name: err.name,
            code: err.code,
            message: err.message,
            path: err.path,
            value: err.value
        });

        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors || {}).map(e => e.message).join('; ') || err.message;
            return res.status(400).json({ msg: `Exam validation failed: ${messages}` });
        }

        if (err.name === 'CastError') {
            return res.status(400).json({ msg: `Invalid MongoDB ID supplied for ${err.path}: ${err.value}` });
        }

        res.status(500).json({ msg: 'Server error commissioning exam' });
    }
});

// ─────────────────────────────────────────────────────────────────
// TEACHER / ADMIN: Get active exam assignments delegated to current user
// GET /api/exams/my-assignments
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// TEACHER / ADMIN: Get active exam assignments delegated to current user
// GET /api/exams/my-assignments
// ─────────────────────────────────────────────────────────────────
router.get('/my-assignments', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const userSubject = req.user.subject;

        let query = {};
        if (userRole === 'admin') {
            query = {};
        } else {
            query = {
                $or: [
                    { 'subjectAssignments.teacherId': userId },
                    { 'subjectAssignments.subject': new RegExp(`^${userSubject}$`, 'i') },
                    { 'subjectAssignments.subject': new RegExp(userSubject || 'Physics', 'i') }
                ]
            };
        }

        const exams = await OnlineExam.find(query)
            .sort({ createdAt: -1 })
            .populate('subjectAssignments.submittedPaperId')
            .populate('createdBy', 'name email');

        res.json(exams);
    } catch (err) {
        console.error('Fetch Assignments Error:', err);
        res.status(500).json({ msg: 'Server error fetching assignments' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get all commissioned exams with real-time per-subject status & full question hydration
// GET /api/exams/commissioned
// ─────────────────────────────────────────────────────────────────
router.get('/commissioned', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exams = await OnlineExam.find({})
            .sort({ createdAt: -1 })
            .populate('subjectAssignments.submittedPaperId')
            .populate('createdBy', 'name email');

        // Also resolve all questions for submitted papers to provide genuine real-time data
        const allPapers = await Paper.find({}).sort({ createdAt: -1 });

        const enrichedExams = await Promise.all(exams.map(async (exam) => {
            const exObj = exam.toObject();
            let allExamQuestions = [];

            if (Array.isArray(exObj.subjectAssignments)) {
                for (const sa of exObj.subjectAssignments) {
                    let paper = sa.submittedPaperId;

                    // Fallback: if not explicitly linked, match by exam title & subject
                    if (!paper) {
                        const matchedPaper = allPapers.find(p => 
                            p.title && p.title.toLowerCase().includes(exObj.title.toLowerCase()) &&
                            (p.subject || '').toLowerCase().includes((sa.subject || '').toLowerCase())
                        );
                        if (matchedPaper) {
                            paper = matchedPaper;
                            // Auto link in background
                            try {
                                const dbExam = await OnlineExam.findById(exObj._id);
                                if (dbExam) {
                                    const dbSa = dbExam.subjectAssignments.id(sa._id);
                                    if (dbSa) {
                                        dbSa.submittedPaperId = matchedPaper._id;
                                        await dbExam.save();
                                    }
                                }
                            } catch (e) {
                                console.error('Auto link error:', e);
                            }
                        }
                    }

                    if (paper && Array.isArray(paper.questions) && paper.questions.length > 0) {
                        // If questions are string IDs, fetch from Supabase
                        let resolvedQuestions = [];
                        if (typeof paper.questions[0] === 'string') {
                            resolvedQuestions = await supabaseQuestions.getQuestionsByIds(paper.questions);
                        } else {
                            resolvedQuestions = paper.questions;
                        }

                        // Attach resolved questions to paper
                        paper.questions = resolvedQuestions;
                        sa.submittedPaperId = paper;
                        sa.questionsCount = resolvedQuestions.length;
                        sa.status = resolvedQuestions.length >= (sa.targetQuestions || 60) ? 'Completed' : 'In Progress';

                        // Ensure each question has subject assigned
                        resolvedQuestions.forEach(q => {
                            if (!q.subject) q.subject = sa.subject;
                            allExamQuestions.push(q);
                        });
                    } else {
                        sa.questionsCount = 0;
                    }
                }
            }

            // Include any questions directly in the exam
            if (Array.isArray(exObj.questions) && exObj.questions.length > 0) {
                exObj.questions.forEach(q => allExamQuestions.push(q));
            }

            exObj.allQuestions = allExamQuestions;
            exObj.totalQuestionsAdded = allExamQuestions.length;
            return exObj;
        }));

        res.json(enrichedExams);
    } catch (err) {
        console.error('Fetch Commissioned Error:', err);
        res.status(500).json({ msg: 'Server error fetching commissioned exams' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Merge 3 papers into one OnlineExam
// POST /api/exams/merge
// ─────────────────────────────────────────────────────────────────
router.post('/merge', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, paperIds, instructions, start_time, end_time, duration_minutes, allowedStudents } = req.body;

        if (!['JEE', 'NEET', 'CET'].includes(examType)) {
            return res.status(400).json({ msg: 'Invalid exam type. Must be JEE, NEET, or CET.' });
        }
        
        const reqCount = examType === 'JEE' ? 3 : 4;

        if (!paperIds || paperIds.length === 0) {
            return res.status(400).json({ msg: `At least 1 paper must be selected.` });
        }

        // Fetch all selected papers with questions populated
        console.log("Merge Request - paperIds:", paperIds);
        const { Types: { ObjectId } } = require('mongoose');
        const objectIds = paperIds.map(id => typeof id === 'string' ? new ObjectId(id) : id);
        const papers = await Paper.find({ _id: { $in: objectIds } }).populate('questions');
        console.log("Merge Request - Found papers:", papers.length);

        if (papers.length !== paperIds.length) {
            return res.status(404).json({ msg: `One or more papers not found. Expected ${paperIds.length}, found ${papers.length}.` });
        }

        // Validate subjects (DISABLED FOR TESTING)
        /*
        const subjectsFound = papers.map(p => p.subject.toLowerCase().trim());
        let requiredSubjects = [];
        if (examType === 'JEE') requiredSubjects = ['physics', 'chemistry', 'mathematics'];
        if (examType === 'NEET') requiredSubjects = ['physics', 'chemistry', 'botany', 'zoology'];
        if (examType === 'CET') requiredSubjects = ['physics', 'chemistry', 'mathematics', 'biology'];

        const missingSubjects = requiredSubjects.filter(sub => !subjectsFound.some(found => found.includes(sub)));
        if (missingSubjects.length > 0) {
            return res.status(400).json({ msg: `Missing required subjects for ${examType}: ${missingSubjects.join(', ')}` });
        }

        // Validate question counts per subject
        const expectedQCount = examType === 'JEE' ? 25 : examType === 'NEET' ? 50 : 60; // JEE = 25 (20 MCQs + 5 Numerical), CET = 60
        for (const p of papers) {
            if (p.questions.length !== expectedQCount) {
                return res.status(400).json({ msg: `Paper '${p.title}' (${p.subject}) has ${p.questions.length} questions. ${examType} requires exactly ${expectedQCount} questions per subject.` });
            }
        }
        */

        // Merge questions from all papers, preserving sections and translations
        const seen = new Set();
        const mergedQuestions = [];
        const sectionsMap = {};

        for (const paper of papers) {
            let availableQuestions = [...paper.questions];
            
            if (paper.pattern && paper.pattern.length > 0) {
                paper.pattern.forEach(sec => {
                    const uniqueSecName = `${paper.subject} - ${sec.sectionName}`;
                    
                    if (!sectionsMap[uniqueSecName]) {
                        const isSectionB = sec.sectionName.toLowerCase().endsWith('b');
                        let allowedToAnswer = 0;
                        if (isSectionB) {
                            const subClean = paper.subject.toLowerCase().trim();
                            allowedToAnswer = (subClean === 'mathematics' || subClean === 'maths') ? 5 : 10;
                        }

                        sectionsMap[uniqueSecName] = {
                            sectionName: uniqueSecName,
                            numQuestions: sec.numQuestions || 0,
                            allowedToAnswer,
                            markingRules: {
                                correct: sec.marks / sec.numQuestions || 4,
                                incorrect: -1,
                                unattempted: 0
                            }
                        };
                    }

                    let secQuestions = [];
                    if (sec.type) {
                        secQuestions = availableQuestions.filter(q => q.type === sec.type).slice(0, sec.numQuestions);
                        const usedIds = new Set(secQuestions.map(q => q._id.toString()));
                        availableQuestions = availableQuestions.filter(q => !usedIds.has(q._id.toString()));
                    } else {
                        secQuestions = availableQuestions.slice(0, sec.numQuestions);
                        availableQuestions = availableQuestions.slice(sec.numQuestions);
                    }

                    secQuestions.forEach(q => {
                        if (!seen.has(q._id.toString())) {
                            seen.add(q._id.toString());
                            mergedQuestions.push({
                                questionId: q._id,
                                subject: q.subject,
                                chapter: q.chapter,
                                concept: q.concept,
                                questionText: q.questionText,
                                options: q.options || [],
                                answer: q.answer,
                                imageUrl: q.imageUrl,
                                marks: sec.marks / sec.numQuestions || 4,
                                type: q.type || 'MCQ',
                                sectionName: uniqueSecName,
                                questionTextTranslation: q.questionTextTranslation || '',
                                optionsTranslation: q.optionsTranslation || []
                            });
                        }
                    });
                });
            } else {
                // Fallback for papers without patterns
                const defSecName = `${paper.subject} - Section A`;
                if (!sectionsMap[defSecName]) {
                    sectionsMap[defSecName] = {
                        sectionName: defSecName,
                        numQuestions: paper.questions.length,
                        allowedToAnswer: 0,
                        markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                    };
                }

                for (const q of paper.questions) {
                    if (!seen.has(q._id.toString())) {
                        seen.add(q._id.toString());
                        mergedQuestions.push({
                            questionId: q._id,
                            subject: q.subject,
                            chapter: q.chapter,
                            concept: q.concept,
                            questionText: q.questionText,
                            options: q.options || [],
                            answer: q.answer,
                            imageUrl: q.imageUrl,
                            marks: 4,
                            type: q.type || 'MCQ',
                            sectionName: defSecName,
                            questionTextTranslation: q.questionTextTranslation || '',
                            optionsTranslation: q.optionsTranslation || []
                        });
                    }
                }
            }
        }

        const exam = new OnlineExam({
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

        await exam.save();
        res.status(201).json({ msg: 'Exam created successfully', exam });
    } catch (err) {
        console.error('Merge error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Create exam from a Grand Test paper
// POST /api/exams/from-grand-test
// ─────────────────────────────────────────────────────────────────
router.post('/from-grand-test', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { grandTestId, title, instructions, start_time, end_time, duration_minutes, allowedStudents } = req.body;

        const GrandTestPaper = require('../models/GrandTestPaper');
        const Question = require('../models/Question');

        const gt = await GrandTestPaper.findById(grandTestId).populate('questions');
        if (!gt) return res.status(404).json({ msg: 'Grand Test not found' });

        const mergedQuestions = gt.questions.map(q => ({
            questionId: q._id,
            subject: q.subject,
            chapter: q.chapter,
            concept: q.concept,
            questionText: q.questionText,
            options: q.options || [],
            answer: q.answer,
            imageUrl: q.imageUrl || null,
            marks: q.type === 'NUMERICAL' ? 4 : 4,
            negativeMarks: q.type === 'NUMERICAL' ? 0 : 1,
            type: q.type || 'MCQ'
        }));

        const getDefaultInstructions = (examType) => `This is a ${examType} Grand Test. Read all questions carefully.`;

        const exam = new OnlineExam({
            title: title || gt.title,
            examType: gt.examType,
            sourcePapers: [],
            sourceGrandTest: grandTestId,
            questions: mergedQuestions,
            instructions: instructions || getDefaultInstructions(gt.examType),
            start_time: start_time || null,
            end_time: end_time || null,
            duration_minutes: duration_minutes || 180,
            status: start_time ? 'scheduled' : 'draft',
            examMode: req.body.examMode || 'ONLINE',
            allowedStudents: Array.isArray(allowedStudents) ? allowedStudents : [],
            createdBy: req.user.id
        });

        await exam.save();
        res.status(201).json({ msg: 'Grand Test Exam created successfully', exam });
    } catch (err) {
        console.error('Grand Test exam creation error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: List all online exams
// GET /api/exams
// ─────────────────────────────────────────────────────────────────
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
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

        const exams = await OnlineExam.find()
            .select('-questions.answer') // Don't leak answers in list view
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email');
        res.json(exams);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get single exam (full, with answers for admin)
// GET /api/exams/admin/:id
// ─────────────────────────────────────────────────────────────────
router.get('/admin/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        res.json(exam);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});
// ─────────────────────────────────────────────────────────────────
// TEACHER / ADMIN: Get single commissioned exam by ID
// GET /api/exams/:id
// Access: admin (full) or teacher assigned to this exam
// ─────────────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ msg: 'Invalid exam ID format.' });
        }

        const exam = await OnlineExam.findById(id)
            .select('-questions.answer')
            .populate('createdBy', 'name email');

        if (!exam) {
            return res.status(404).json({ msg: 'Exam not found.' });
        }

        const userId = String(req.user.id);
        const userRole = req.user.role;

        if (userRole === 'admin') {
            return res.json(exam);
        }

        // Teacher: only if assigned to this exam
        const isAssigned = (exam.subjectAssignments || []).some(
            sa => sa.teacherId && String(sa.teacherId) === userId
        );
        if (!isAssigned) {
            return res.status(403).json({ msg: 'Access denied: you are not assigned to this exam.' });
        }

        return res.json(exam);
    } catch (err) {
        console.error('GET /api/exams/:id error:', { name: err.name, code: err.code, message: err.message });
        res.status(500).json({ msg: 'Server error fetching exam.' });
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
        update.updatedAt = new Date();

        const exam = await OnlineExam.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        res.json({ msg: 'Exam updated', exam });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Delete exam
// DELETE /api/exams/:id
// ─────────────────────────────────────────────────────────────────
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        
        await OnlineExam.findByIdAndDelete(req.params.id);
        await ExamSession.deleteMany({ examId: req.params.id });
        
        res.json({ msg: 'Exam deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
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
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });
        if (!['live', 'scheduled'].includes(exam.status)) {
            return res.status(403).json({ msg: 'Exam is not currently available.' });
        }

        const { email, rollNumber } = req.query;
        const studentId = rollNumber || email || 'anonymous';
        let examQuestions = exam.questions;
        if (exam.shuffleQuestions) {
            examQuestions = seededShuffle(exam.questions, `${studentId}-${exam._id}`);
        }

        // Strip answers before sending to student
        const safeExam = {
            _id: exam._id,
            title: exam.title,
            examType: exam.examType,
            instructions: exam.instructions,
            duration_minutes: exam.duration_minutes,
            start_time: exam.start_time,
            end_time: exam.end_time,
            questions: examQuestions.map(q => ({
                _id: q._id,
                questionId: q.questionId,
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
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Start session
// POST /api/exams/:id/start
// ─────────────────────────────────────────────────────────────────
router.post('/:id/start', detectLabIp, async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const { studentName, studentEmail, rollNumber } = req.body;

        if (exam.allowedStudents && exam.allowedStudents.length > 0) {
            if (!exam.allowedStudents.includes(rollNumber)) {
                return res.status(403).json({ msg: 'You are not authorized to take this exam.' });
            }
        }

        // Check for existing active session
        const existing = await ExamSession.findOne({
            examId: req.params.id,
            studentEmail,
            submitted: false
        });
        if (existing) return res.json({ msg: 'Session resumed', session: existing });

        const studentId = rollNumber || studentEmail || 'anonymous';
        let examQuestions = exam.questions;
        if (exam.shuffleQuestions) {
            examQuestions = seededShuffle(exam.questions, `${studentId}-${exam._id}`);
        }

        const session = new ExamSession({
            examId: req.params.id,
            studentId,
            studentName: studentName || 'Student',
            studentEmail: studentEmail || '',
            rollNumber: rollNumber || '',
            fromLabIp: req.isLabIp,
            clientIp: req.clientIp,
            startTime: new Date(),
            answers: examQuestions.map(q => ({
                questionId: q._id,
                selectedOption: null,
                markedForReview: false,
                visited: false
            })),
            totalQuestions: examQuestions.length
        });

        await session.save();
        res.status(201).json({ msg: 'Session started', session });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Submit exam
// POST /api/exams/:id/submit
// ─────────────────────────────────────────────────────────────────
router.post('/:id/submit', detectLabIp, async (req, res) => {
    try {
        const { sessionId, answers } = req.body;

        const session = await ExamSession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (session.submitted) return res.json({ msg: 'Already submitted', session, sessionId: session._id });

        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        // Build answer map from submission
        const answerMap = {};
        if (answers && Array.isArray(answers)) {
            answers.forEach(a => { answerMap[a.questionId] = a; });
        }

        // Section attempts bookkeeping for JEE/NEET optional rules
        const sectionAttemptsCounts = {}; // Track number of graded questions in this section
        const allowedSections = {}; // Map section name to allowed count
        if (exam.sections && Array.isArray(exam.sections)) {
            exam.sections.forEach(sec => {
                if (sec.allowedToAnswer > 0) {
                    allowedSections[sec.sectionName] = sec.allowedToAnswer;
                    sectionAttemptsCounts[sec.sectionName] = 0;
                }
            });
        }

        // Compute analytics
        let score = 0, correct = 0, incorrect = 0, unattempted = 0;
        const weakMap = {};

        const ExamBlueprint = require('../models/ExamBlueprint.js');
        let blueprint = null;
        try {
            if (exam.blueprintId) {
                blueprint = await ExamBlueprint.findById(exam.blueprintId);
            }
        } catch (e) {
            console.error('Failed to load blueprint for grading:', e);
        }

        const processedAnswers = exam.questions.map(q => {
            const sid = q._id.toString();
            const submitted = answerMap[sid];
            let selected = submitted?.selectedOption || null;
            const markedForReview = submitted?.markedForReview || false;
            const timeTaken = submitted?.timeTaken || 0;

            const secName = q.sectionName;
            const isAttempted = selected !== null && selected !== '';
            
            if (isAttempted && secName && allowedSections[secName] !== undefined) {
                const maxAllowed = allowedSections[secName];
                if (sectionAttemptsCounts[secName] >= maxAllowed) {
                    // Exceeded the allowed answers for this choice section! Ignore this answer.
                    selected = null;
                } else {
                    sectionAttemptsCounts[secName]++;
                }
            }

            // Load marking rules (fallback to JEE standard 4, -1, 0)
            let correctMarks = 4;
            let incorrectMarks = -1;
            let unattemptedMarks = 0;

            if (blueprint) {
                const bpSubject = blueprint.subjects.find(s => s.subjectName.toLowerCase().trim() === (q.subject || '').toLowerCase().trim());
                if (bpSubject && bpSubject.sections) {
                    const bpSection = bpSubject.sections.find(sec => (sec.sectionName || '').toLowerCase().trim() === (q.sectionName || '').toLowerCase().trim());
                    if (bpSection && bpSection.markingRules) {
                        correctMarks = bpSection.markingRules.correct !== undefined ? bpSection.markingRules.correct : 4;
                        incorrectMarks = bpSection.markingRules.incorrect !== undefined ? bpSection.markingRules.incorrect : -1;
                        unattemptedMarks = bpSection.markingRules.unattempted !== undefined ? bpSection.markingRules.unattempted : 0;
                    }
                }
            }

            let result = 'unattempted';
            if (selected !== null && selected !== '') {
                let isCorrect = false;

                // 1. Numerical match with tolerance
                const tolerance = q.numericalTolerance || 0;
                const parsedSelected = parseFloat(selected);
                const parsedAnswer = parseFloat(q.answer);
                if (!isNaN(parsedSelected) && !isNaN(parsedAnswer)) {
                    if (Math.abs(parsedSelected - parsedAnswer) <= (tolerance + 1e-9)) {
                        isCorrect = true;
                    }
                }

                // 2. Exact match
                if (!isCorrect && selected.toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) {
                    isCorrect = true;
                }

                // 3. Option index / letter match
                if (!isCorrect && q.options && q.options.length > 0) {
                    const letters = ['A', 'B', 'C', 'D'];
                    const selectedIdx = letters.indexOf(selected.toString().toUpperCase());
                    if (selectedIdx !== -1 && q.options[selectedIdx]) {
                        if (q.options[selectedIdx].toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) {
                            isCorrect = true;
                        }
                    }
                    const correctIdx = letters.indexOf(q.answer.toString().toUpperCase());
                    if (correctIdx !== -1 && q.options[correctIdx]) {
                        if (selected.toString().trim().toLowerCase() === q.options[correctIdx].toString().trim().toLowerCase()) {
                            isCorrect = true;
                        }
                    }
                }

                if (isCorrect) {
                    score += correctMarks;
                    correct++;
                    result = 'correct';
                } else {
                    score += incorrectMarks;
                    incorrect++;
                    result = 'incorrect';
                    // Track weak areas
                    const key = `${q.subject}::${q.chapter}`;
                    if (!weakMap[key]) weakMap[key] = { subject: q.subject, chapter: q.chapter, incorrect: 0 };
                    weakMap[key].incorrect++;
                }
            } else {
                score += unattemptedMarks;
                unattempted++;
            }

            return { questionId: q._id, selectedOption: selected, markedForReview, visited: submitted ? true : false, timeTaken };
        });

        const weakAreas = Object.values(weakMap).sort((a, b) => b.incorrect - a.incorrect);

        session.answers = processedAnswers;
        session.endTime = new Date();
        session.submitted = true;
        session.score = score;
        session.correct = correct;
        session.incorrect = incorrect;
        session.unattempted = unattempted;
        session.attempted = correct + incorrect;
        session.weakAreas = weakAreas;
        session.fromLabIp = req.isLabIp;
        session.clientIp = req.clientIp;

        await session.save();
        res.json({ msg: 'Exam submitted successfully', sessionId: session._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STUDENT: Get scorecard (IP-conditional answer key)
// GET /api/exams/:id/scorecard/:sessionId
// ─────────────────────────────────────────────────────────────────
router.get('/:id/scorecard/:sessionId', detectLabIp, async (req, res) => {
    try {
        const session = await ExamSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        if (exam.examMode === 'OFFLINE') {
            return res.status(403).json({ msg: 'Access denied: Scorecard is not available for offline exams.' });
        }

        const isLab = (session.fromLabIp || req.isLabIp) && process.env.LAB_IP !== '*';

        // Build question-level breakdown
        const originalQuestionIds = exam.questions.map(q => q.questionId).filter(Boolean);
        const originalQuestions = await supabaseQuestions.getQuestionsByIds(originalQuestionIds);
        const originalQuestionsMap = {};
        originalQuestions.forEach(oq => {
            const qId = (oq.id || oq._id || oq.questionId).toString();
            originalQuestionsMap[qId] = oq;
        });

        const breakdown = exam.questions.map(q => {
            const ans = session.answers.find(a => a.questionId?.toString() === q._id?.toString());
            const origQ = q.questionId ? originalQuestionsMap[q.questionId.toString()] : null;
            const entry = {
                _id: q._id,
                questionId: q.questionId,
                questionText: q.questionText,
                subject: q.subject,
                chapter: q.chapter,
                options: q.options,
                selectedOption: ans?.selectedOption || null,
                markedForReview: ans?.markedForReview || false,
                timeTaken: ans?.timeTaken || 0,
                solutionText: origQ?.solutionText || '',
                solutionImageUrl: origQ?.solutionImageUrl || '',
                type: q.type || 'MCQ'
            };

            // Always expose correct answer since answerKeyHidden is false
            entry.correctAnswer = q.answer;

            return entry;
        });

        res.json({
            sessionId: session._id,
            studentName: session.studentName,
            studentEmail: session.studentEmail,
            rollNumber: session.rollNumber,
            examTitle: exam.title,
            examType: exam.examType,
            score: session.score,
            totalQuestions: session.totalQuestions,
            attempted: session.attempted,
            correct: session.correct,
            incorrect: session.incorrect,
            unattempted: session.unattempted,
            weakAreas: session.weakAreas,
            isLabSession: isLab,
            answerKeyHidden: false, // User requested answers to be shown after submission
            breakdown
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get all results for an exam
// GET /api/exams/:id/results
// ─────────────────────────────────────────────────────────────────
router.get('/:id/results', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true })
            .sort({ score: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Get Question Analytics
// GET /api/exams/:id/analytics
// ─────────────────────────────────────────────────────────────────
router.get('/:id/analytics', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true });
        
        const analytics = exam.questions.map((q, i) => {
            let correct = 0, incorrect = 0, unattempted = 0;

            sessions.forEach(session => {
                const ans = session.answers.find(a => a.questionId?.toString() === q._id?.toString());
                const selected = ans?.selectedOption || null;
                
                if (selected !== null && selected !== '') {
                    const parsedSelected = parseFloat(selected);
                    const parsedAnswer = parseFloat(q.answer);
                    const isNumericMatch = !isNaN(parsedSelected) && !isNaN(parsedAnswer) && Math.abs(parsedSelected - parsedAnswer) < 1e-9;
                    const isExactMatch = selected.toString().trim().toLowerCase() === q.answer?.toString().trim().toLowerCase();

                    if (isNumericMatch || isExactMatch) {
                        correct++;
                    } else {
                        incorrect++;
                    }
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
        res.status(500).json({ msg: 'Server Error' });
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
        const session = await ExamSession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        session.submitted = true;
        session.endTime = new Date();
        session.malpracticeFlag = true;
        session.malpracticeReason = reason || 'Window blurred or switched tab';

        await session.save();
        res.json({ msg: 'Malpractice reported and session locked', session });
    } catch (err) {
        console.error('Error reporting malpractice:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: Delete online exam
// DELETE /api/exams/:id
// ─────────────────────────────────────────────────────────────────
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const examId = req.params.id;
        
        // 1. Delete the exam
        const exam = await OnlineExam.findByIdAndDelete(examId);
        if (!exam) {
            return res.status(404).json({ msg: 'Exam not found' });
        }

        // 2. Delete all exam sessions associated with it
        await ExamSession.deleteMany({ examId });

        // 3. Delete any bridge keys associated with it
        await BridgeKey.deleteMany({ examId });

        res.json({ msg: 'Exam deleted successfully' });
    } catch (err) {
        console.error('Error deleting exam:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// STUDENT & ADMIN: Get leaderboard / results list for an exam
// GET /api/exams/:id/leaderboard
// ─────────────────────────────────────────────────────────────────
router.get('/:id/leaderboard', async (req, res) => {
    try {
        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true })
            .select('studentName rollNumber score correct incorrect unattempted weakAreas endTime')
            .sort({ score: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Helpers
// ─────────────────────────────────────────────────────────────────
function getDefaultInstructions(examType) {
    return `General Instructions for ${examType} Exam:
1. The clock will be set at the server. The countdown timer at the top right corner of the screen will display the remaining time for you to complete the examination.
2. When the timer reaches zero, the examination will end by itself. You need not terminate the examination.
3. To answer a question, click on one of the option buttons.
4. To deselect a chosen answer, click on the chosen option again or click the CLEAR RESPONSE button.
5. To save your answer, you MUST click the SAVE & NEXT button.
6. To mark a question for review, click the MARK FOR REVIEW & NEXT button.
7. Marking Scheme: +4 for Correct, -1 for Incorrect, 0 for Unattempted.
8. The Question Palette on the right shows the status of each question.`;
}

// ─────────────────────────────────────────────────────────────────
// STUDENT: Save intermediate progress (Autosave / Recover)
// POST /api/exams/:id/session/save-progress
// ─────────────────────────────────────────────────────────────────
router.post('/:id/session/save-progress', async (req, res) => {
    try {
        const { sessionId, answers } = req.body;
        if (!sessionId) return res.status(400).json({ msg: 'Session ID is required' });

        const session = await ExamSession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (session.submitted) return res.status(400).json({ msg: 'Cannot save progress for submitted exam' });

        if (answers && Array.isArray(answers)) {
            session.answers = answers.map(a => ({
                questionId: a.questionId,
                selectedOption: a.selectedOption || null,
                markedForReview: a.markedForReview || false,
                visited: a.visited || false,
                timeTaken: a.timeTaken || 0
            }));
        }

        await session.save();
        res.json({ msg: 'Progress autosaved successfully', session });
    } catch (err) {
        console.error('Autosave error:', err);
        res.status(500).json({ msg: 'Server Error during autosave' });
    }
});

// @route   GET /api/exams/:id/export-word
// @desc    Export online exam to Word (.docx)
// @access  Admin
router.get('/:id/export-word', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const OnlineExam = require('../models/OnlineExam');
        const exam = await OnlineExam.findById(req.params.id);
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
            const Template = require('../models/Template');
            template = await Template.findById(exam.templateId);
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
        const session = await ExamSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        if (req.user.role === 'student' && session.studentEmail !== req.user.email) {
            return res.status(403).json({ msg: 'Access denied: You can only download your own scorecard.' });
        }

        const { generateReportPdf } = require('../services/pdfReport');
        const buffer = await generateReportPdf(session, exam);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${session.studentName?.replace(/\s+/g, '_') || 'Result'}.pdf"`);
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
        const exam = await OnlineExam.findById(req.params.id);
        if (!exam) return res.status(404).json({ msg: 'Exam not found' });

        const sessions = await ExamSession.find({ examId: req.params.id, submitted: true });
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
            const filename = `${session.studentName?.replace(/\s+/g, '_') || session.studentEmail}_Result.pdf`;
            archive.append(pdfBuffer, { name: filename });
        }

        await archive.finalize();
    } catch (err) {
        console.error('Zip reports error:', err.message);
        res.status(500).json({ msg: 'Server error generating zip reports.', error: err.message });
    }
});

module.exports = router;
