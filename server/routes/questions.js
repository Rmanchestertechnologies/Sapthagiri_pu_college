const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { sanitizeHtml, sanitizeArray } = require('../utils/sanitize');
const supabaseQuestions = require('../services/supabaseQuestions');

const { storage } = require('../config/cloudinary');

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    }
});

// @route   POST /api/questions
// @desc    Add a question to Supabase Question Bank
// @access  Teacher / Admin
router.post('/', [auth, checkRole(['admin', 'teacher']), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'solutionImage', maxCount: 1 }])], async (req, res) => {
    try {
        const allowedFields = [
            'questionText','type','subject','classes','chapter','concept',
            'subConcept','level','answer','options','solutionText','imageUrl',
            'solutionImageUrl','assertion','reason','sourceType','sourceExam',
            'questionTextTranslation', 'optionsTranslation'
        ];

        // Teacher's subject is always from their token — not from request body
        const subject = req.user.role === 'admin' ? (req.body.subject || 'Chemistry') : req.user.subject;

        const questionData = {
            subject,
            createdBy: req.user.id
        };
        allowedFields.forEach(f => {
            if (req.body[f] !== undefined) questionData[f] = req.body[f];
        });
        questionData.subject = subject;

        // Sanitize HTML fields
        if (questionData.questionText) questionData.questionText = sanitizeHtml(questionData.questionText);
        if (questionData.solutionText) questionData.solutionText = sanitizeHtml(questionData.solutionText);
        if (questionData.questionTextTranslation) questionData.questionTextTranslation = sanitizeHtml(questionData.questionTextTranslation);
        
        if (questionData.options) {
            if (typeof questionData.options === 'string') {
                try { questionData.options = JSON.parse(questionData.options); } catch(e) {}
            }
            questionData.options = sanitizeArray(questionData.options);
        }

        if (questionData.optionsTranslation) {
            if (typeof questionData.optionsTranslation === 'string') {
                try { questionData.optionsTranslation = JSON.parse(questionData.optionsTranslation); } catch(e) {}
            }
            questionData.optionsTranslation = sanitizeArray(questionData.optionsTranslation);
        }

        if (req.body.classes) {
            if (typeof req.body.classes === 'string') {
                if (req.body.classes.startsWith('[')) {
                    try { questionData.classes = JSON.parse(req.body.classes); } catch(e) { questionData.classes = [req.body.classes]; }
                } else {
                    questionData.classes = req.body.classes.split(',').map(c => c.trim()).filter(Boolean);
                }
            }
        }

        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                questionData.imageUrl = req.files.image[0].path;
            }
            if (req.files.solutionImage && req.files.solutionImage[0]) {
                questionData.solutionImageUrl = req.files.solutionImage[0].path;
            }
        }

        const question = await supabaseQuestions.createQuestion(questionData, req.user.id, req.user.name || 'User');
        res.json(question);
    } catch (err) {
        console.error('Add question error:', err.message);
        res.status(500).json({ msg: 'Server error adding question to Supabase.' });
    }
});

// @route   GET /api/questions
// @desc    Get questions filtered by subject, chapter, type, class from Supabase
// @access  Teacher / Admin
router.get('/', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { classes, chapter, concept, type, subject, search, level, usage } = req.query;
        let filters = {};

        // Subject-level access control — teachers can ONLY access their own subject
        if (req.user.role === 'teacher') {
            filters.subject = req.user.subject;
        } else if (subject) {
            filters.subject = subject;
        }

        if (classes) filters.classes = classes;
        if (chapter) filters.chapter = chapter;
        if (concept) filters.concept = concept;
        if (type) filters.type = type;
        if (search) filters.search = search;
        if (level) filters.level = level;
        if (usage) filters.usage = usage;

        // Pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(20000, parseInt(req.query.limit) || (req.query.paginated === 'true' ? 50 : 100)));

        const result = await supabaseQuestions.getQuestions(filters, page, limit);

        res.setHeader('X-Total-Count', result.pagination.total);
        res.setHeader('X-Total-Pages', result.pagination.pages);

        if (req.query.paginated === 'true') {
            return res.json(result);
        }

        // Return array by default for backward compatibility with frontend components expecting res.data array
        return res.json(result.questions);
    } catch (err) {
        console.error('[QUESTIONS GET] error:', err.message);
        res.status(500).json({ msg: 'Server error fetching questions from Supabase.' });
    }
});

// @route   GET /api/questions/meta
// @desc    Get metadata (total count, distinct chapters, distinct topics) for subject
// @access  Teacher / Admin
router.get('/meta', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const subject = req.user.role === 'teacher' ? req.user.subject : (req.query.subject || '');
        const meta = await supabaseQuestions.getSubjectMetadata(subject);
        res.json(meta);
    } catch (err) {
        console.error('[QUESTIONS META] error:', err.message);
        res.status(500).json({ msg: 'Server error fetching question metadata.' });
    }
});

// @route   GET /api/questions/:id
// @desc    Get a single question by ID from Supabase or MongoDB
// @access  Teacher / Admin
router.get('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            const question = await Question.findById(req.params.id);
            if (!question) return res.status(404).json({ msg: 'Question not found in MongoDB.' });
            if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
                return res.status(403).json({ msg: 'Access denied: this question belongs to a different subject.' });
            }
            return res.json(question);
        }

        const question = await supabaseQuestions.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found.' });

        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
            return res.status(403).json({ msg: 'Access denied: this question belongs to a different subject.' });
        }

        res.json(question);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error fetching question.' });
    }
});

// @route   DELETE /api/questions/:id
// @desc    Delete a question from Supabase or MongoDB
// @access  Teacher / Admin
router.delete('/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            const question = await Question.findById(req.params.id);
            if (!question) return res.status(404).json({ msg: 'Question not found in MongoDB.' });
            if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
                return res.status(403).json({ msg: 'Access denied: this question belongs to a different subject.' });
            }
            await Question.findByIdAndDelete(req.params.id);
            return res.json({ msg: 'Question removed from MongoDB.' });
        }

        const question = await supabaseQuestions.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found.' });

        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
            return res.status(403).json({ msg: 'Access denied: this question belongs to a different subject.' });
        }

        await supabaseQuestions.deleteQuestion(req.params.id);
        res.json({ msg: 'Question removed from Supabase.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error deleting question.' });
    }
});

// @route   POST /api/questions/update/:id
// @desc    Update a question in Supabase or MongoDB
// @access  Teacher / Admin
router.post('/update/:id', [auth, checkRole(['admin', 'teacher']), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'solutionImage', maxCount: 1 }])], async (req, res) => {
    try {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            let question = await Question.findById(req.params.id);
            if (!question) return res.status(404).json({ msg: 'Question not found in MongoDB.' });

            if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
                return res.status(403).json({ msg: 'Access denied: not authorized to edit this subject question.' });
            }

            const fieldsToUpdate = [
                'questionText', 'options', 'answer', 'chapter', 'concept', 
                'subConcept', 'level', 'type', 'solutionText', 'assertion', 
                'reason', 'statements', 'matchPairs', 'numericalTolerance',
                'questionTextTranslation', 'optionsTranslation'
            ];
            
            fieldsToUpdate.forEach(field => {
                if (req.body[field] !== undefined) {
                    if (field === 'options' && typeof req.body[field] === 'string') {
                        try {
                            question.options = JSON.parse(req.body[field]);
                        } catch (e) {
                            question.options = req.body[field];
                        }
                    } else if (field === 'optionsTranslation' && typeof req.body[field] === 'string') {
                        try {
                            question.optionsTranslation = JSON.parse(req.body[field]);
                        } catch (e) {
                            question.optionsTranslation = req.body[field];
                        }
                    } else if (field === 'statements' && typeof req.body[field] === 'string') {
                        try {
                            question.statements = JSON.parse(req.body[field]);
                        } catch (e) {
                            question.statements = req.body[field];
                        }
                    } else if (field === 'matchPairs' && typeof req.body[field] === 'string') {
                        try {
                            question.matchPairs = JSON.parse(req.body[field]);
                        } catch (e) {
                            question.matchPairs = req.body[field];
                        }
                    } else {
                        question[field] = req.body[field];
                    }
                }
            });

            if (req.files) {
                if (req.files.image && req.files.image[0]) {
                    question.imageUrl = req.files.image[0].path;
                }
                if (req.files.solutionImage && req.files.solutionImage[0]) {
                    question.solutionImageUrl = req.files.solutionImage[0].path;
                }
            }

            await question.save();
            return res.json(question);
        }

        let question = await supabaseQuestions.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({ msg: 'Question not found.' });

        if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
            return res.status(403).json({ msg: 'Access denied: not authorized to edit this subject question.' });
        }

        const questionData = { ...req.body };

        const updated = await supabaseQuestions.updateQuestion(req.params.id, questionData, req.user.id, req.user.name || 'User');
        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error updating question.' });
    }
});

// @route   POST /api/questions/convert-numerical/:id
// @desc    Convert an MCQ question into a Numerical question (clear options, change type)
// @access  Teacher / Admin
router.post('/convert-numerical/:id', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            // MongoDB update
            const question = await Question.findById(req.params.id);
            if (!question) return res.status(404).json({ msg: 'Question not found in MongoDB.' });

            if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
                return res.status(403).json({ msg: 'Access denied: not authorized to edit this subject question.' });
            }

            question.type = 'numerical';
            question.options = [];
            question.optionsTranslation = [];
            await question.save();
            return res.json({ msg: 'Question converted to Numerical successfully.', question });
        } else {
            // Supabase update
            const question = await supabaseQuestions.getQuestionById(req.params.id);
            if (!question) return res.status(404).json({ msg: 'Question not found in Supabase.' });

            if (req.user.role !== 'admin' && question.subject !== req.user.subject) {
                return res.status(403).json({ msg: 'Access denied: not authorized to edit this subject question.' });
            }

            // Map and update in Supabase
            const updatedData = {
                type: 'numerical',
                options: [],
                optionsTranslation: [],
                answer: question.answer // Keep the existing correct answer as numerical value
            };

            const updated = await supabaseQuestions.updateQuestion(req.params.id, updatedData, req.user.id, req.user.name || 'User');
            return res.json({ msg: 'Question converted to Numerical successfully.', question: updated });
        }
    } catch (err) {
        console.error('Convert numerical error:', err.message);
        res.status(500).json({ msg: 'Server error converting question to numerical.', error: err.message });
    }
});

// @route   POST /api/questions/:id/generate-variant
// @desc    Use Gemini AI to create a similar variant of a question
// @access  Teacher / Admin
router.post('/:id/generate-variant', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        let question;
        let isMongo = false;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            question = await Question.findById(req.params.id);
            isMongo = true;
        } else {
            question = await supabaseQuestions.getQuestionById(req.params.id);
        }

        if (!question) return res.status(404).json({ msg: 'Question not found.' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ msg: 'Gemini API Key is not configured.' });
        }

        const prompt = `You are a professional coaching-institute exam editor.
Create a new question that is a VARIANT of the following input question.
The variant must test the exact same concept and sub-concept with the same difficulty level, but should use DIFFERENT numerical values, names, options, or a slightly different context so it is not identical.
Do not change the structure of the options format (MCQ or Numerical, matching the input type).

Input Question:
Type: ${question.type || question.q_type}
Question Text: ${question.questionText || question.question}
Options: ${JSON.stringify(question.options || [])}
Correct Answer: ${question.answer || question.correct_option || question.num_answer}

Provide the output as a clean JSON object following this format:
{
  "questionText": "...",
  "options": ["...", "...", "...", "..."], // Empty if type is numerical
  "answer": "..." // Correct option index value/text or numerical answer
}

Output ONLY this JSON block. Do not include markdown code block formatting (like \`\`\`json) or any explanations.`;

        const fetchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!fetchResponse.ok) {
            const err = await fetchResponse.json();
            return res.status(502).json({ msg: 'Gemini API call failed', error: err });
        }

        const data = await fetchResponse.json();
        let rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(rawJson);

        // Map back to the system question structure
        const variantData = {
            subject: question.subject,
            classes: question.classes,
            chapter: question.chapter,
            concept: question.concept || 'General',
            subConcept: question.subConcept || '',
            level: question.level || 'medium',
            type: question.type || 'MCQ',
            questionText: parsed.questionText,
            options: parsed.options || [],
            answer: String(parsed.answer || ''),
            solutionText: `Variant of question ${question.questionId}`,
            createdBy: req.user.id
        };

        if (isMongo) {
            // If it was a MongoDB question (like in a GT), we can save it as a new MongoDB Question
            const count = await Question.countDocuments();
            const subjectCode = (variantData.subject || 'GEN').substring(0, 3).toUpperCase();
            const questionId = `Q-${subjectCode}-VAR-${Date.now()}-${count + 1}`;
            
            const newQ = new Question({
                ...variantData,
                questionId,
                sourceType: question.sourceType,
                sourcePaperId: question.sourcePaperId,
                sourceModel: question.sourceModel,
                sourcePaperName: question.sourcePaperName,
                sourceExam: question.sourceExam,
                sourceDisplayCode: question.sourceDisplayCode,
                academicYearLevel: question.academicYearLevel
            });
            await newQ.save();
            return res.json(newQ);
        } else {
            // Save to Supabase Question Bank
            const newQ = await supabaseQuestions.createQuestion(variantData, req.user.id, req.user.name || 'User');
            return res.json(newQ);
        }
    } catch (err) {
        console.error('Generate variant error:', err);
        res.status(500).json({ msg: 'Server error generating question variant.' });
    }
});

// @route   POST /api/questions/bulk-import
// @desc    Bulk import questions with AI schema-mapping cleanup
// @access  Teacher / Admin
router.post('/bulk-import', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) return res.status(400).json({ msg: 'Questions array is required.' });

        const getValCI = (obj, keys) => {
            const objKeys = Object.keys(obj);
            for (const k of keys) {
                const matchedKey = objKeys.find(ok => ok.toLowerCase().replace(/[\s_-]+/g, '') === k.toLowerCase().replace(/[\s_-]+/g, ''));
                if (matchedKey !== undefined) return obj[matchedKey];
            }
            return undefined;
        };

        const imported = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            
            let qText = getValCI(q, ['questionText', 'question', 'text', 'question_text', 'questioncontent']) || '';
            if (!qText) continue;

            let qType = getValCI(q, ['type', 'qtype', 'questiontype', 'q_type']) || 'MCQ';
            
            let options = getValCI(q, ['options']) || [];
            if (typeof options === 'string') {
                try { options = JSON.parse(options); } catch(e) { options = options.split(',').map(o => o.trim()); }
            }
            if (options.length === 0) {
                const aVal = getValCI(q, ['opt_a', 'option_a', 'optiona', 'a', 'A']);
                const bVal = getValCI(q, ['opt_b', 'option_b', 'optionb', 'b', 'B']);
                const cVal = getValCI(q, ['opt_c', 'option_c', 'optionc', 'c', 'C']);
                const dVal = getValCI(q, ['opt_d', 'option_d', 'optiond', 'd', 'D']);
                if (aVal !== undefined || bVal !== undefined || cVal !== undefined || dVal !== undefined) {
                    options = [aVal || '', bVal || '', cVal || '', dVal || ''].filter(Boolean);
                }
            }
            
            let answer = String(getValCI(q, ['answer', 'correct_option', 'correct', 'correctoption', 'ans']) || '');
            let classes = getValCI(q, ['classes', 'class', 'classes_level']) || ['12'];
            if (typeof classes === 'string') {
                classes = classes.split(',').map(c => c.trim());
            }

            const transText = getValCI(q, ['questionTextTranslation', 'translation', 'translatedQuestionText', 'translatedQuestion', 'translated_text', 'hindi', 'kannada', 'tamil', 'telugu']) || '';
            let transOptions = getValCI(q, ['optionsTranslation', 'translatedOptions', 'translated_options']) || [];
            if (typeof transOptions === 'string') {
                try { transOptions = JSON.parse(transOptions); } catch(e) { transOptions = transOptions.split(',').map(o => o.trim()); }
            }
            if (transOptions.length === 0) {
                const taVal = getValCI(q, ['trans_opt_a', 'translated_option_a', 'translated_optiona', 'trans_a', 'trans_A']);
                const tbVal = getValCI(q, ['trans_opt_b', 'translated_option_b', 'translated_optionb', 'trans_b', 'trans_B']);
                const tcVal = getValCI(q, ['trans_opt_c', 'translated_option_c', 'translated_optionc', 'trans_c', 'trans_C']);
                const tdVal = getValCI(q, ['trans_opt_d', 'translated_option_d', 'translated_optiond', 'trans_d', 'trans_D']);
                if (taVal !== undefined || tbVal !== undefined || tcVal !== undefined || tdVal !== undefined) {
                    transOptions = [taVal || '', tbVal || '', tcVal || '', tdVal || ''].filter(Boolean);
                }
            }

            const newQData = {
                questionText: qText,
                type: qType,
                options,
                answer,
                subject: req.user.role === 'admin' ? (getValCI(q, ['subject', 'subj']) || 'Chemistry') : req.user.subject,
                chapter: getValCI(q, ['chapter', 'chap']) || 'General',
                concept: getValCI(q, ['concept', 'conc']) || 'General',
                level: getValCI(q, ['level', 'difficulty']) || 'medium',
                solutionText: getValCI(q, ['solutionText', 'solution', 'explanation']) || '',
                classes,
                questionTextTranslation: transText,
                optionsTranslation: transOptions
            };

            const saved = await supabaseQuestions.createQuestion(newQData, req.user.id, req.user.name || 'User');
            imported.push(saved);
        }

        res.json({ msg: `Successfully imported ${imported.length} questions.`, count: imported.length });
    } catch (err) {
        console.error('Bulk import error:', err);
        res.status(500).json({ msg: 'Server error during bulk question import.' });
    }
});

module.exports = router;
