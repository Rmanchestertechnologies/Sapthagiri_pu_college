const express = require('express');
const router = express.Router();
const storage = require('../services/postgresStorage');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// @route   POST /api/previous-year-papers
// @desc    Create Previous Year paper metadata
// @access  Admin
router.post('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { title, examType, year, subject, shift } = req.body;
        const pypPaper = await storage.savePreviousYearPaper({
            title,
            examType,
            year: year || new Date().getFullYear(),
            subject: subject || 'Mixed',
            shift: shift || '',
            uploadedBy: req.user.id
        });
        res.json(pypPaper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// @route   GET /api/previous-year-papers
// @desc    Get all Previous Year papers
// @access  Admin
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const papers = await storage.getPreviousYearPapers();
        res.json(papers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// @route   GET /api/previous-year-papers/:id
// @desc    Get single Previous Year paper details
// @access  Admin
router.get('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const papers = await storage.getPreviousYearPapers();
        const paper = papers.find(p => String(p._id || p.id) === String(req.params.id));
        if (!paper) return res.status(404).json({ msg: 'PYQ paper not found' });
        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// @route   PUT /api/previous-year-papers/:id
// @desc    Update Previous Year paper details
// @access  Admin
router.put('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const paper = await storage.savePreviousYearPaper({ ...req.body, id: req.params.id });
        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// @route   DELETE /api/previous-year-papers/:id
// @desc    Delete a PYQ paper
// @access  Admin
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        res.json({ msg: 'PYQ paper deleted.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: ' + err.message);
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
