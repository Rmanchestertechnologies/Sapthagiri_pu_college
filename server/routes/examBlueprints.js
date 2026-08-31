const express = require('express');
const router = express.Router();
const ExamBlueprint = require('../models/ExamBlueprint');
const Paper = require('../models/Paper');
const supabaseQuestions = require('../services/supabaseQuestions');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// Seed default blueprints if database is empty
async function seedDefaultBlueprints() {
    try {
        const count = await ExamBlueprint.countDocuments();
        if (count === 0) {
            console.log('🌱 Seeding default blueprints...');
            const blueprints = [
                {
                    name: 'NEET Default',
                    examType: 'NEET',
                    durationMinutes: 180,
                    subjects: [
                        {
                            subjectName: 'Botany',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Botany Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Zoology',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Zoology Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Physics',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Physics Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Chemistry',
                            totalQuestions: 45,
                            sections: [{
                                sectionName: 'Chemistry Section',
                                numQuestions: 45,
                                questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING', 'DIAGRAM_BASED'],
                                markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                            }]
                        }
                    ]
                },
                {
                    name: 'JEE Default',
                    examType: 'JEE',
                    durationMinutes: 180,
                    subjects: [
                        {
                            subjectName: 'Physics',
                            totalQuestions: 25,
                            sections: [
                                {
                                    sectionName: 'Physics Section A (MCQ)',
                                    numQuestions: 20,
                                    questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                },
                                {
                                    sectionName: 'Physics Section B (Numerical)',
                                    numQuestions: 5,
                                    questionTypes: ['NUMERICAL'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                }
                            ]
                        },
                        {
                            subjectName: 'Chemistry',
                            totalQuestions: 25,
                            sections: [
                                {
                                    sectionName: 'Chemistry Section A (MCQ)',
                                    numQuestions: 20,
                                    questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                },
                                {
                                    sectionName: 'Chemistry Section B (Numerical)',
                                    numQuestions: 5,
                                    questionTypes: ['NUMERICAL'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                }
                            ]
                        },
                        {
                            subjectName: 'Mathematics',
                            totalQuestions: 25,
                            sections: [
                                {
                                    sectionName: 'Mathematics Section A (MCQ)',
                                    numQuestions: 20,
                                    questionTypes: ['MCQ', 'ASSERTION_REASON', 'STATEMENT_BASED', 'TRUE_FALSE', 'MATCH_FOLLOWING'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                },
                                {
                                    sectionName: 'Mathematics Section B (Numerical)',
                                    numQuestions: 5,
                                    questionTypes: ['NUMERICAL'],
                                    markingRules: { correct: 4, incorrect: -1, unattempted: 0 }
                                }
                            ]
                        }
                    ]
                },
                {
                    name: 'CET Default (KCET)',
                    examType: 'KCET',
                    durationMinutes: 180,
                    subjects: [
                        {
                            subjectName: 'Physics',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Physics Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Chemistry',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Chemistry Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Mathematics',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Mathematics Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        },
                        {
                            subjectName: 'Biology',
                            totalQuestions: 60,
                            sections: [{
                                sectionName: 'Biology Section',
                                numQuestions: 60,
                                questionTypes: ['MCQ'],
                                markingRules: { correct: 1, incorrect: 0, unattempted: 0 }
                            }]
                        }
                    ]
                }
            ];
            await ExamBlueprint.insertMany(blueprints);
            console.log('✅ Seeding blueprints completed.');
        }
    } catch (err) {
        console.error('Failed to seed default blueprints:', err);
    }
}
seedDefaultBlueprints();

// @route   GET /api/exam-blueprints
// @desc    Get all exam blueprints
// @access  Admin, Teacher
router.get('/', auth, async (req, res) => {
    try {
        const blueprints = await ExamBlueprint.find();
        res.json(blueprints);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/exam-blueprints/:id
// @desc    Get blueprint by ID
// @access  Admin, Teacher
router.get('/:id', auth, async (req, res) => {
    try {
        const blueprint = await ExamBlueprint.findById(req.params.id);
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });
        res.json(blueprint);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/exam-blueprints
// @desc    Create exam blueprint
// @access  Admin
router.post('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { name, examType, subjects, durationMinutes, active } = req.body;
        
        let blueprint = await ExamBlueprint.findOne({ name });
        if (blueprint) return res.status(400).json({ msg: 'Blueprint name already exists' });

        blueprint = new ExamBlueprint({
            name,
            examType,
            subjects,
            durationMinutes,
            active
        });

        await blueprint.save();
        res.json(blueprint);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/exam-blueprints/:id
// @desc    Update exam blueprint
// @access  Admin
router.put('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const { name, examType, subjects, durationMinutes, active } = req.body;
        const blueprint = await ExamBlueprint.findById(req.params.id);
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });

        if (name) blueprint.name = name;
        if (examType) blueprint.examType = examType;
        if (subjects) blueprint.subjects = subjects;
        if (durationMinutes) blueprint.durationMinutes = durationMinutes;
        if (active !== undefined) blueprint.active = active;

        await blueprint.save();
        res.json(blueprint);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/exam-blueprints/:id
// @desc    Delete exam blueprint
// @access  Admin
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const blueprint = await ExamBlueprint.findById(req.params.id);
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });

        await ExamBlueprint.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Blueprint removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/exam-blueprints/:id/generate-paper
// @desc    Auto-generate a question paper from a blueprint
// @access  Teacher / Admin
router.post('/:id/generate-paper', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const blueprint = await ExamBlueprint.findById(req.params.id);
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });

        const selectedQuestions = [];
        const paperPattern = [];

        // For each subject and section, query question bank
        for (const sub of blueprint.subjects) {
            // Retrieve questions for this subject from question bank (limit 2000 to get a wide pool)
            const result = await supabaseQuestions.getQuestions({ subject: sub.subjectName }, 1, 2000);
            const pool = result.questions || [];

            for (const sec of sub.sections) {
                // Filter pool by question types
                const types = sec.questionTypes.map(t => t.toLowerCase());
                const matchingQuestions = pool.filter(q => {
                    const qType = (q.type || '').toLowerCase();
                    return types.some(t => {
                        if (t === 'mcq' && qType.includes('mcq')) return true;
                        if (t === 'numerical' && qType.includes('numerical')) return true;
                        if (t === 'assertion_reason' && qType.includes('assertion')) return true;
                        if (t === 'statement_based' && qType.includes('statement')) return true;
                        if (t === 'match_following' && qType.includes('match')) return true;
                        return qType === t;
                    });
                });

                if (matchingQuestions.length < sec.numQuestions) {
                    console.warn(`Not enough questions of type ${sec.questionTypes} for ${sub.subjectName} Section ${sec.sectionName}.`);
                }

                // Shuffle and pick
                const shuffled = matchingQuestions.sort(() => 0.5 - Math.random());
                const picked = shuffled.slice(0, sec.numQuestions);
                
                picked.forEach(q => {
                    selectedQuestions.push(q.id || q._id);
                });

                paperPattern.push({
                    sectionName: `${sub.subjectName} - ${sec.sectionName}`,
                    numQuestions: sec.numQuestions,
                    type: sec.questionTypes[0] || 'MCQ',
                    description: sec.allowedToAnswer ? `Answer any ${sec.allowedToAnswer} questions.` : 'Answer all questions.',
                    marks: sec.numQuestions * (sec.markingRules?.correct || 4)
                });
            }
        }

        if (selectedQuestions.length === 0) {
            return res.status(400).json({ msg: 'Could not fetch any questions matching blueprint criteria.' });
        }

        const title = `${blueprint.name} Auto-Paper - ${new Date().toLocaleDateString('en-IN')}`;
        const newPaper = new Paper({
            title,
            examType: blueprint.examType,
            academicYearLevel: 'SECOND_YEAR', // default
            subject: blueprint.subjects.map(s => s.subjectName).join(', '),
            questions: selectedQuestions,
            pattern: paperPattern,
            teacherId: req.user.id,
            status: req.user.role === 'admin' ? 'Approved' : 'Pending Approval'
        });

        await newPaper.save();
        res.json(newPaper);
    } catch (err) {
        console.error('Failed to generate paper from blueprint:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
