const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GrandTestPaper = require('../models/GrandTestPaper');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const supabaseQuestions = require('../services/supabaseQuestions');

// @route   POST /api/grand-tests
// @desc    Create Grand Test paper metadata
// @access  Admin
router.post('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { title, code, examType, academicYearLevel, subject } = req.body;
        const existing = await GrandTestPaper.findOne({ code, examType });
        if (existing) {
            return res.status(400).json({ msg: `Grand Test with code ${code} for ${examType} already exists.` });
        }
        const gtPaper = new GrandTestPaper({
            title,
            code,
            examType,
            academicYearLevel,
            subject: subject || 'Mixed',
            templateId: req.body.templateId || null,
            uploadedBy: req.user.id
        });
        await gtPaper.save();
        res.json(gtPaper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/grand-tests
// @desc    Get all Grand Test papers
// @access  Admin
router.get('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const papers = await GrandTestPaper.find().populate('uploadedBy', 'name email').sort({ createdAt: -1 });
        res.json(papers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/grand-tests/:id
// @desc    Get a single Grand Test paper details with populated questions
// @access  Admin
router.get('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const paper = await GrandTestPaper.findById(req.params.id)
            .populate('uploadedBy', 'name email')
            .populate('questions');
        if (!paper) return res.status(404).json({ msg: 'Grand Test not found' });
        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/grand-tests/:id
// @desc    Update Grand Test paper metadata
// @access  Admin
router.put('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { title, code, examType, academicYearLevel, subject, questions, templateId } = req.body;
        const paper = await GrandTestPaper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Grand Test not found' });

        if (title) paper.title = title;
        if (code) paper.code = code;
        if (examType) paper.examType = examType;
        if (academicYearLevel) paper.academicYearLevel = academicYearLevel;
        if (subject) paper.subject = subject;
        if (questions) paper.questions = questions;
        if (templateId !== undefined) paper.templateId = templateId;

        await paper.save();
        res.json(paper);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/grand-tests/:id
// @desc    Delete a Grand Test paper (with dependency checks)
// @access  Admin
router.delete('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const paper = await GrandTestPaper.findById(req.params.id);
        if (!paper) return res.status(404).json({ msg: 'Grand Test not found' });

        // Dependency Check: are any of the questions from this GT referenced in standard papers or exams?
        // We do a soft-delete/warning or just remove the GT reference in the questions
        await Question.updateMany(
            { sourcePaperId: paper._id, sourceType: 'GT' },
            { $unset: { sourcePaperId: 1 }, $set: { sourceType: 'REGULAR' } }
        );

        await GrandTestPaper.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Grand Test paper deleted. Associated questions converted to REGULAR.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/grand-tests/parse-text
// @desc    Use Gemini AI to parse raw pasted text into structured questions
// @access  Admin
router.post('/parse-text', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { text, examType, subject } = req.body;
        if (!text) return res.status(400).json({ msg: 'Text is required for parsing' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ msg: 'Gemini API Key is not configured.' });
        }

        const prompt = `You are a professional coaching-institute question parser.
Analyze the following pasted exam text containing multiple questions. Extract each question and structure them as a JSON array of question objects.

Each question object must follow this schema structure:
- type: MCQ, ASSERTION_REASON, STATEMENT_BASED, TRUE_FALSE, MATCH_FOLLOWING, NUMERICAL, or DIAGRAM_BASED.
- questionText: The full body of the question (use raw HTML for mathematical symbols, indices, sub/sup, etc. if present in text, e.g. H<sub>2</sub>O).
- options: Array of strings (usually 4 elements, empty for NUMERICAL).
- answer: Correct answer index or exact value (e.g. Option text or A/B/C/D option choice, True/False, or exact number for numerical).
- chapter: Deduce the chapter name if possible, or leave empty if not clear.
- concept: Deduce the specific concept if possible, or leave empty if not clear.
- subConcept: Deduce the sub-concept if possible, or leave empty if not clear.
- level: easy, medium, or hard.
- assertion: (Assertion & Reason only)
- reason: (Assertion & Reason only)
- statements: Array of statement strings (Statement-Based only)
- matchPairs: Array of { left: String, right: String } (Match the Following only)

Output ONLY a valid JSON array of these objects. Do not include markdown code block syntax (like \`\`\`json) or any preamble or explanation. Just return the raw JSON array.

Input Text:
${text}`;

        const fetchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!fetchResponse.ok) {
            const err = await fetchResponse.json();
            return res.status(502).json({ msg: 'Gemini parsing failed', error: err });
        }

        const data = await fetchResponse.json();
        let rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean up markdown wrapper if returned
        rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const parsedQuestions = JSON.parse(rawJson);
            res.json(parsedQuestions);
        } catch (parseErr) {
            console.error('Failed to parse Gemini output:', rawJson);
            res.status(500).json({ msg: 'Gemini returned invalid JSON structure.', rawResponse: rawJson });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/grand-tests/:id/import
// @desc    Import confirmed questions list and link them to the GT paper
// @access  Admin
router.post('/:id/import', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) return res.status(400).json({ msg: 'Questions array is required.' });

        const gtPaper = await GrandTestPaper.findById(req.params.id);
        if (!gtPaper) return res.status(404).json({ msg: 'Grand Test paper not found.' });

        const importedIds = [];
        const duplicateWarnings = [];

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            
            // Check for duplicate check similarity (questionText similarity)
            const duplicate = await Question.findOne({
                questionText: q.questionText,
                subject: q.subject || gtPaper.subject
            });

            if (duplicate && !req.body.importAnyway) {
                duplicateWarnings.push({ index: i, text: q.questionText, duplicateId: duplicate._id });
                continue;
            }

            // Generate unique question ID
            const count = await Question.countDocuments();
            const subjectCode = (q.subject || gtPaper.subject || 'GEN').substring(0,3).toUpperCase();
            const questionId = `Q-${subjectCode}-GT-${Date.now()}-${count + 1}-${i}`;

            const newQ = new Question({
                questionId,
                subject: q.subject || gtPaper.subject || 'Chemistry',
                classes: q.classes || [gtPaper.examType], // e.g. ['NEET'] or ['JEE']
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
                
                // GT Source metadata
                sourceType: 'GT',
                sourcePaperId: gtPaper._id,
                sourceModel: 'GrandTestPaper',
                sourcePaperName: gtPaper.title,
                sourceExam: gtPaper.examType,
                sourceDisplayCode: `${gtPaper.code}`,
                academicYearLevel: gtPaper.academicYearLevel,
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

        // Link new question IDs to GrandTestPaper
        gtPaper.questions = [...gtPaper.questions, ...importedIds];
        await gtPaper.save();

        res.json({
            msg: `Successfully imported ${importedIds.length} questions.`,
            questionsCount: gtPaper.questions.length
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/grand-tests/:id/questions/:questionId
// @desc    Remove a question from a Grand Test
// @access  Admin
router.delete('/:id/questions/:questionId', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const gtPaper = await GrandTestPaper.findById(req.params.id);
        if (!gtPaper) return res.status(404).json({ msg: 'Grand Test paper not found.' });

        // Remove from questions array
        gtPaper.questions = gtPaper.questions.filter(qId => qId.toString() !== req.params.questionId);
        await gtPaper.save();

        // Delete the question itself if it is a GT question
        await Question.deleteOne({ _id: req.params.questionId });

        res.json({ msg: 'Question removed from Grand Test.', questionsCount: gtPaper.questions.length });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/grand-tests/:id/questions/:oldQuestionId/replace
// @desc    Replace a question in a Grand Test with a question from the DB
// @access  Admin / Teacher
router.post('/:id/questions/:oldQuestionId/replace', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { dbQuestionId, source } = req.body;
        if (!dbQuestionId) return res.status(400).json({ msg: 'Database question ID is required.' });

        const gtPaper = await GrandTestPaper.findById(req.params.id);
        if (!gtPaper) return res.status(404).json({ msg: 'Grand Test paper not found.' });

        // Verify old question is in the paper
        const oldIndex = gtPaper.questions.findIndex(qId => qId.toString() === req.params.oldQuestionId);
        if (oldIndex === -1) {
            return res.status(400).json({ msg: 'Old question not found in this Grand Test.' });
        }

        // Fetch the new question
        let newQuestionData;
        if (source === 'supabase' || !mongoose.Types.ObjectId.isValid(dbQuestionId)) {
            const supabaseQ = await supabaseQuestions.getQuestionById(dbQuestionId);
            if (!supabaseQ) return res.status(404).json({ msg: 'Question not found in Supabase question bank.' });
            newQuestionData = supabaseQ;
        } else {
            const mongoQ = await Question.findById(dbQuestionId);
            if (!mongoQ) return res.status(404).json({ msg: 'Question not found in MongoDB question bank.' });
            newQuestionData = mongoQ.toObject();
        }

        // Generate a unique question ID
        const count = await Question.countDocuments();
        const subjectCode = (newQuestionData.subject || gtPaper.subject || 'GEN').substring(0, 3).toUpperCase();
        const questionId = `Q-${subjectCode}-GT-${Date.now()}-${count + 1}`;

        // Create a new MongoDB question document based on the fetched question data
        const newQ = new Question({
            questionId,
            subject: newQuestionData.subject || gtPaper.subject || 'Chemistry',
            classes: newQuestionData.classes || [gtPaper.examType],
            chapter: newQuestionData.chapter || 'General',
            concept: newQuestionData.concept || 'General',
            subConcept: newQuestionData.subConcept || '',
            level: newQuestionData.level || 'medium',
            type: newQuestionData.type || 'MCQ',
            questionText: newQuestionData.questionText || newQuestionData.question || '',
            options: newQuestionData.options || [],
            answer: String(newQuestionData.answer || newQuestionData.correct_option || ''),
            assertion: newQuestionData.assertion || '',
            reason: newQuestionData.reason || '',
            statements: newQuestionData.statements || [],
            matchPairs: newQuestionData.matchPairs || [],
            numericalTolerance: newQuestionData.numericalTolerance || 0,
            imageUrl: newQuestionData.imageUrl || '',
            solutionText: newQuestionData.solutionText || newQuestionData.solution_text || '',
            
            sourceType: 'GT',
            sourcePaperId: gtPaper._id,
            sourceModel: 'GrandTestPaper',
            sourcePaperName: gtPaper.title,
            sourceExam: gtPaper.examType,
            sourceDisplayCode: `${gtPaper.code}`,
            academicYearLevel: gtPaper.academicYearLevel,
            createdBy: req.user.id
        });

        await newQ.save();

        // Update Grand Test paper
        gtPaper.questions[oldIndex] = newQ._id;
        await gtPaper.save();

        // Delete the old question document from MongoDB if it is a GT question
        await Question.deleteOne({ _id: req.params.oldQuestionId });

        res.json({ msg: 'Question replaced successfully.', newQuestion: newQ });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
