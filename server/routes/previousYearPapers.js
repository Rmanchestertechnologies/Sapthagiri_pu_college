const express = require('express');
const router = express.Router();
const PreviousYearPaper = require('../models/PreviousYearPaper');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// @route   POST /api/previous-year-papers
// @desc    Create Previous Year paper metadata
// @access  Admin
router.post('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, year, subject, shift } = req.body;
        const pypPaper = new PreviousYearPaper({
            title,
            examType,
            year,
            subject: subject || 'Mixed',
            shift: shift || '',
            uploadedBy: req.user.id
        });
        await pypPaper.save();
        res.json(pypPaper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/previous-year-papers
// @desc    Get all Previous Year papers
// @access  Admin
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const papers = await PreviousYearPaper.find().populate('uploadedBy', 'name email').sort({ year: -1, createdAt: -1 });
        res.json(papers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/previous-year-papers/:id
// @desc    Get single Previous Year paper details with questions
// @access  Admin
router.get('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const paper = await PreviousYearPaper.findById(req.params.id)
            .populate('uploadedBy', 'name email')
            .populate('questions');
        if (!paper) return res.status(404).json({ msg: 'PYQ paper not found' });
        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/previous-year-papers/:id
// @desc    Update Previous Year paper details
// @access  Admin
router.put('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, year, subject, shift, questions } = req.body;
        const paper = await PreviousYearPaper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'PYQ paper not found' });

        if (title) paper.title = title;
        if (examType) paper.examType = examType;
        if (year) paper.year = year;
        if (subject) paper.subject = subject;
        if (shift) paper.shift = shift;
        if (questions) paper.questions = questions;

        await paper.save();
        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/previous-year-papers/:id
// @desc    Delete a PYQ paper (with dependency checks)
// @access  Admin
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const paper = await PreviousYearPaper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'PYQ paper not found' });

        // Dependency Check: dissociate questions
        await Question.updateMany(
            { sourcePaperId: paper._id, sourceType: 'PYQ' },
            { $unset: { sourcePaperId: 1 }, $set: { sourceType: 'REGULAR' } }
        );

        await PreviousYearPaper.findByIdAndDelete(req.params.id);
        res.json({ msg: 'PYQ paper deleted. Associated questions converted to REGULAR.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/previous-year-papers/:id/import
// @desc    Import confirmed questions list and link them to the PYQ paper
// @access  Admin
router.post('/:id/import', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) return res.status(400).json({ msg: 'Questions array is required.' });

        const pypPaper = await PreviousYearPaper.findById(req.params.id);
        if (!pypPaper) return res.status(404).json({ msg: 'PYQ paper not found.' });

        const importedIds = [];
        const duplicateWarnings = [];

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            
            // Check for duplicate check similarity
            const duplicate = await Question.findOne({
                questionText: q.questionText,
                subject: q.subject || pypPaper.subject
            });

            if (duplicate && !req.body.importAnyway) {
                duplicateWarnings.push({ index: i, text: q.questionText, duplicateId: duplicate._id });
                continue;
            }

            // Generate unique question ID
            const count = await Question.countDocuments();
            const subjectCode = (q.subject || pypPaper.subject || 'GEN').substring(0,3).toUpperCase();
            const questionId = `Q-${subjectCode}-PYQ-${Date.now()}-${count + 1}-${i}`;

            const newQ = new Question({
                questionId,
                subject: q.subject || pypPaper.subject || 'Chemistry',
                classes: q.classes || [pypPaper.examType], // e.g. ['NEET'] or ['JEE']
                chapter: q.chapter || 'General',
                concept: q.concept || 'General',
                subConcept: q.subConcept || '',
                level: q.level || 'medium',
                type: q.type || 'MCQ',
                questionText: q.questionText,
                options: q.options || [],
                answer: String(q.answer || ''),
                assertion: q.assertion || '',
                reason: q.reason || '',
                statements: q.statements || [],
                matchPairs: q.matchPairs || [],
                numericalTolerance: q.numericalTolerance || 0,
                imageUrl: q.imageUrl || '',
                solutionText: q.solutionText || '',
                
                // PYQ Source metadata
                sourceType: 'PYQ',
                sourcePaperId: pypPaper._id,
                sourceModel: 'PreviousYearPaper',
                sourcePaperName: pypPaper.title,
                sourceExam: pypPaper.examType,
                sourceYear: pypPaper.year,
                sourceDisplayCode: `${pypPaper.examType}-${pypPaper.year}`,
                createdBy: req.user.id
            });

            await newQ.save();
            importedIds.push(newQ._id);
        }

        if (duplicateWarnings.length > 0 && !req.body.importAnyway) {
            return res.json({
                msg: 'Potential duplicates found.',
                duplicates: duplicateWarnings,
                importedCount: importedIds.length
            });
        }

        // Link new question IDs to PreviousYearPaper
        pypPaper.questions = [...pypPaper.questions, ...importedIds];
        await pypPaper.save();

        res.json({
            msg: `Successfully imported ${importedIds.length} questions.`,
            questionsCount: pypPaper.questions.length
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
