const express = require('express');
const router = express.Router();
const Paper = require('../models/Paper');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const supabaseQuestions = require('../services/supabaseQuestions');
const { createNotification } = require('./notifications');

// Helper to record question usage and notify admin
async function handlePaperFinalization(paper, user, exam = null) {
    try {
        const qList = Array.isArray(paper.questions) ? paper.questions : [];
        if (qList.length > 0) {
            const examTitle = exam ? exam.title : (paper.title || 'Question Paper');
            const examDate = (exam && exam.examDate) ? new Date(exam.examDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            await supabaseQuestions.recordQuestionUsage(
                qList,
                paper._id.toString(),
                user.id,
                user.name || 'Faculty',
                examTitle,
                examDate
            );
        }

        if (user && user.role === 'teacher') {
            await createNotification({
                recipient_role: 'admin',
                sender_id: user.id,
                sender_name: user.name || 'Faculty',
                related_paper_id: paper._id.toString(),
                type: 'paper_submission',
                title: 'New Work Submitted for Review',
                message: `Teacher ${user.name || 'Faculty'} submitted ${paper.title || 'Question Paper'} for review.`,
                metadata: {
                    subject: paper.subject,
                    questionsCount: qList.length,
                    examTitle: exam ? exam.title : paper.title,
                    submittedAt: new Date().toISOString()
                }
            });
        }
    } catch (e) {
        console.error('Error in handlePaperFinalization:', e.message);
    }
}

// Helper to populate paper questions from Supabase if stored as IDs
async function populatePaperQuestions(paper) {
    const pObj = paper.toObject ? paper.toObject() : paper;
    if (Array.isArray(pObj.questions) && pObj.questions.length > 0) {
        // If questions are already full question objects with questionText or question
        if (typeof pObj.questions[0] === 'object' && (pObj.questions[0].questionText || pObj.questions[0].question)) {
            return pObj;
        }
        const stringIds = pObj.questions.map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
        if (stringIds.length > 0 && typeof pObj.questions[0] === 'string') {
            try {
                const fetched = await supabaseQuestions.getQuestionsByIds(stringIds);
                if (fetched && fetched.length > 0) {
                    const fetchedMap = new Map(fetched.map(q => [(q._id || q.id).toString(), q]));
                    const ordered = stringIds.map(id => fetchedMap.get(id.toString())).filter(Boolean);
                    pObj.questions = ordered.length > 0 ? ordered : fetched;
                } else if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0) {
                    pObj.questions = pObj.questionObjects;
                }
            } catch (fetchErr) {
                console.error('Error populating paper questions:', fetchErr.message);
                if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0) {
                    pObj.questions = pObj.questionObjects;
                }
            }
        }
    } else if (Array.isArray(pObj.questionObjects) && pObj.questionObjects.length > 0) {
        pObj.questions = pObj.questionObjects;
    }
    return pObj;
}

// @route   POST /api/papers
// @desc    Save a paper (stores Supabase question IDs and paper pattern)
// @access  Teacher / Admin
router.post('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { examId, ...rest } = req.body;
        const paperData = {
            ...rest,
            subject: req.user.role === 'admin' ? (req.body.subject || 'Physics') : (req.user.subject || 'Physics'),
            teacherId: req.user.id
        };

        const paper = new Paper(paperData);
        await paper.save();

        // If linked to an exam via examId or matching title, update OnlineExam's subjectAssignment
        const OnlineExam = require('../models/OnlineExam');
        let exam = null;
        if (examId) {
            exam = await OnlineExam.findById(examId);
        } else if (paper.title) {
            // Find exam where title is part of paper.title
            const exams = await OnlineExam.find({}).sort({ createdAt: -1 });
            exam = exams.find(e => paper.title.toLowerCase().includes(e.title.toLowerCase()));
        }

        if (exam) {
            const subName = (paper.subject || '').toLowerCase().trim();
            const assignment = exam.subjectAssignments.find(sa => {
                const saSub = (sa.subject || '').toLowerCase().trim();
                return saSub === subName ||
                       (subName.includes('math') && saSub.includes('math')) ||
                       (subName.includes('bio') && saSub.includes('bio')) ||
                       (subName.includes('physic') && saSub.includes('physic')) ||
                       (subName.includes('chem') && saSub.includes('chem'));
            });

            if (assignment) {
                assignment.submittedPaperId = paper._id;
                assignment.teacherId = req.user.id;
                assignment.teacherName = req.user.name || assignment.teacherName;
                assignment.teacherEmail = req.user.email || assignment.teacherEmail;
                const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
                assignment.status = qCount >= (assignment.targetQuestions || 60) ? 'Completed' : 'In Progress';
                await exam.save();
            }
        }

        // Record question usage & notify admin
        await handlePaperFinalization(paper, req.user, exam);

        res.json(paper);
    } catch (err) {
        console.error('Save paper error:', err.message);
        res.status(500).json({ msg: 'Server error saving paper.' });
    }
});

// @route   GET /api/papers/admin/all
// @desc    Get all papers with resolved Supabase questions (Admin)
// @access  Admin
router.get('/admin/all', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const papers = await Paper.find().sort({ createdAt: -1 });
        const populated = await Promise.all(papers.map(populatePaperQuestions));
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT /api/papers/admin/:id/status
// @desc    Update paper status (Admin)
// @access  Admin
router.put('/admin/:id/status', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Pending Approval', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ msg: 'Invalid status' });
        }

        const paper = await Paper.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true }
        );

        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET /api/papers
// @desc    Get all papers of a teacher (or all if admin) with resolved Supabase questions
// @access  Teacher, Admin
router.get('/', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'teacher') {
            const uId = req.user.id?.toString();
            query = {
                $or: [
                    { teacherId: uId },
                    { teacherId: req.user.id },
                    { teacherId: { $in: [uId, req.user.id] } },
                    { subject: req.user.subject }
                ]
            };
        }
        const papers = await Paper.find(query).sort({ createdAt: -1 });
        const populated = await Promise.all(papers.map(populatePaperQuestions));
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET /api/papers/:id
// @desc    Get a single paper with populated Supabase questions
// @access  Teacher, Admin
router.get('/:id', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        // Access check: teacher can access if admin, or own paper, or same subject, or assigned to exam
        if (req.user.role === 'teacher') {
            const tIdStr = paper.teacherId ? paper.teacherId.toString() : '';
            const uIdStr = req.user.id ? req.user.id.toString() : '';
            const matchesTeacher = tIdStr && uIdStr && tIdStr === uIdStr;
            const matchesSubject = paper.subject && req.user.subject && paper.subject.toLowerCase() === req.user.subject.toLowerCase();

            if (!matchesTeacher && !matchesSubject) {
                if (paper.examId) {
                    const OnlineExam = require('../models/OnlineExam');
                    const exam = await OnlineExam.findById(paper.examId);
                    const isAssigned = exam && exam.subjectAssignments.some(sa => sa.teacherId && sa.teacherId.toString() === uIdStr);
                    if (!isAssigned) {
                        return res.status(403).json({ msg: 'Access denied: not your paper.' });
                    }
                } else if (paper.teacherId) {
                    return res.status(403).json({ msg: 'Access denied: not your paper.' });
                }
            }
        }

        const populated = await populatePaperQuestions(paper);
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT /api/papers/:id
// @desc    Update an existing paper by ID
// @access  Teacher, Admin
router.put('/:id', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        let paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        if (req.user.role === 'teacher') {
            const tIdStr = paper.teacherId ? paper.teacherId.toString() : '';
            const uIdStr = req.user.id ? req.user.id.toString() : '';
            const matchesTeacher = tIdStr && uIdStr && tIdStr === uIdStr;
            const matchesSubject = paper.subject && req.user.subject && paper.subject.toLowerCase() === req.user.subject.toLowerCase();

            if (!matchesTeacher && !matchesSubject && !paper.teacherId) {
                paper.teacherId = req.user.id;
            } else if (!matchesTeacher && !matchesSubject) {
                return res.status(403).json({ msg: 'Access denied: not your paper.' });
            }
        }

        const { title, questions, questionObjects, pattern, templateId, difficultyDistribution, status, classes, isAssignment, duration, startQNo, endQNo } = req.body;
        if (title) paper.title = title;
        if (questions) paper.questions = questions;
        if (questionObjects) paper.questionObjects = questionObjects;
        if (pattern) paper.pattern = pattern;
        if (templateId !== undefined) paper.templateId = templateId;
        if (difficultyDistribution) paper.difficultyDistribution = difficultyDistribution;
        if (status) paper.status = status;
        if (classes) paper.classes = classes;
        if (isAssignment !== undefined) paper.isAssignment = isAssignment;
        if (duration !== undefined) paper.duration = duration;
        if (startQNo !== undefined) paper.startQNo = startQNo;
        if (endQNo !== undefined) paper.endQNo = endQNo;
        paper.updatedAt = new Date();

        await paper.save();

        // Sync with parent OnlineExam if linked
        if (paper.examId) {
            const OnlineExam = require('../models/OnlineExam');
            const exam = await OnlineExam.findById(paper.examId);
            if (exam) {
                const subName = (paper.subject || '').toLowerCase().trim();
                const assignment = exam.subjectAssignments.find(sa => {
                    const saSub = (sa.subject || '').toLowerCase().trim();
                    return saSub === subName ||
                           (subName.includes('math') && saSub.includes('math')) ||
                           (subName.includes('bio') && saSub.includes('bio')) ||
                           (subName.includes('physic') && saSub.includes('physic')) ||
                           (subName.includes('chem') && saSub.includes('chem'));
                });
                if (assignment) {
                    assignment.submittedPaperId = paper._id;
                    const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
                    assignment.status = qCount >= (assignment.targetQuestions || 60) ? 'Completed' : (qCount > 0 ? 'In Progress' : 'Not Started');
                    await exam.save();
                }
            }
        }

        // Record question usage & notify admin
        await handlePaperFinalization(paper, req.user);

        const populated = await populatePaperQuestions(paper);
        res.json(populated);
    } catch (err) {
        console.error('Update paper error:', err.message);
        res.status(500).json({ msg: 'Server error updating paper.' });
    }
});

// @route   GET /api/papers/:id/export-word
// @desc    Export paper to Word (.docx)
// @access  Teacher, Admin
router.get('/:id/export-word', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found.' });

        if (req.user.role === 'teacher' && paper.teacherId.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Access denied: not your paper.' });
        }

        const populatedPaper = await populatePaperQuestions(paper);

        let template = null;
        if (paper.templateId) {
            const Template = require('../models/Template');
            template = await Template.findById(paper.templateId);
        }

        const { generatePaperDoc } = require('../services/wordExport');
        const buffer = await generatePaperDoc(populatedPaper, template);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/\s+/g, '_')}.docx"`);
        res.send(buffer);
    } catch (err) {
        console.error('Word export error:', err.message);
        res.status(500).json({ msg: 'Server error exporting paper to Word.', error: err.message });
    }
});

// @route   DELETE /api/papers/:id
// @desc    Delete a paper
// @access  Teacher, Admin
router.delete('/:id', [auth, checkRole(['teacher', 'admin'])], async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Paper not found' });

        if (req.user.role !== 'admin' && paper.teacherId.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Access denied' });
        }

        await Paper.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Paper removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
