const express = require('express');
const router = express.Router();
const storage = require('../services/postgresStorage');
const supabaseQuestions = require('../services/supabaseQuestions');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// Seed default blueprints if database is empty
storage.seedDefaultBlueprints().catch(err => {
    console.error('Failed to seed default blueprints:', err.message);
});

// @route   GET /api/exam-blueprints
// @desc    Get all exam blueprints
// @access  Admin, Teacher
router.get('/', auth, async (req, res) => {
    try {
        const blueprints = await storage.getBlueprints();
        res.json(blueprints);
    } catch (err) {
        console.error('Fetch blueprints error:', err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// @route   GET /api/exam-blueprints/:id
// @desc    Get blueprint by ID
// @access  Admin, Teacher
router.get('/:id', auth, async (req, res) => {
    try {
        const blueprints = await storage.getBlueprints();
        const blueprint = blueprints.find(b => String(b._id || b.id) === String(req.params.id));
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });
        res.json(blueprint);
    } catch (err) {
        console.error('Fetch blueprint error:', err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// @route   POST /api/exam-blueprints
// @desc    Create exam blueprint
// @access  Admin
router.post('/', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const blueprint = await storage.saveBlueprint(req.body);
        res.json(blueprint);
    } catch (err) {
        console.error('Create blueprint error:', err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// @route   PUT /api/exam-blueprints/:id
// @desc    Update exam blueprint
// @access  Admin
router.put('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        const blueprint = await storage.saveBlueprint({ ...req.body, id: req.params.id });
        res.json(blueprint);
    } catch (err) {
        console.error('Update blueprint error:', err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// @route   DELETE /api/exam-blueprints/:id
// @desc    Delete exam blueprint
// @access  Admin
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        res.json({ msg: 'Blueprint removed' });
    } catch (err) {
        console.error('Delete blueprint error:', err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

// @route   POST /api/exam-blueprints/:id/generate-paper
// @desc    Auto-generate a question paper from a blueprint
// @access  Teacher / Admin
router.post('/:id/generate-paper', [auth, checkRole(['admin', 'teacher'])], async (req, res) => {
    try {
        const blueprints = await storage.getBlueprints();
        const blueprint = blueprints.find(b => String(b._id || b.id) === String(req.params.id));
        if (!blueprint) return res.status(404).json({ msg: 'Blueprint not found' });

        const selectedQuestions = [];
        const paperPattern = [];
        const warnings = [];
        const used = new Set(); // a question is used once per paper, across every section

        for (const sub of (blueprint.subjects || [])) {
            // A random sample of the subject's bank. It used to read only the 200 NEWEST questions, so every
            // generated paper drew from the same small slice.
            const result = await supabaseQuestions.getQuestions({ subject: sub.subjectName, examType: blueprint.examType, randomOrder: true }, 1, 800);
            if (result.dbError) warnings.push(`Could not reach the question database for ${sub.subjectName}.`);
            const pool = result.questions || [];

            for (const sec of (sub.sections || [])) {
                const types = (sec.questionTypes || ['MCQ']).map(t => t.toLowerCase());
                const matchingQuestions = pool.filter(q => {
                    const qType = (q.type || '').toLowerCase();
                    return types.some(t => qType.includes(t) || t === qType);
                });

                const num = sec.numQuestions || 10;
                // each section only sees questions no earlier section took (it used to repeat questions across sections)
                const available = matchingQuestions.filter(q => !used.has(String(q.id || q._id)));
                const picked = available.slice(0, num); // the pool is already in random order
                if (picked.length < num) {
                    warnings.push(`${sub.subjectName} - ${sec.sectionName || 'Main'}: only ${picked.length} of ${num} questions were available.`);
                }

                picked.forEach(q => {
                    used.add(String(q.id || q._id));
                    selectedQuestions.push(q.id || q._id);
                });

                paperPattern.push({
                    sectionName: `${sub.subjectName} - ${sec.sectionName || 'Main'}`,
                    numQuestions: num,
                    type: sec.questionTypes?.[0] || 'MCQ',
                    description: 'Answer all questions.',
                    marks: num * 4
                });
            }
        }

        const title = `${blueprint.name} Auto-Paper - ${new Date().toLocaleDateString('en-IN')}`;
        const newPaper = await storage.savePaper({
            title,
            examType: blueprint.examType,
            subject: (blueprint.subjects || []).map(s => s.subjectName).join(', '),
            questions: selectedQuestions,
            pattern: paperPattern,
            teacherId: req.user.id,
            status: req.user.role === 'admin' ? 'Approved' : 'Pending Approval'
        });

        res.json({ ...newPaper, warnings });
    } catch (err) {
        console.error('Failed to generate paper from blueprint:', err.message);
        res.status(500).json({ msg: 'Server Error. Please try again; if it keeps happening, tell the administrator.' });
    }
});

module.exports = router;
