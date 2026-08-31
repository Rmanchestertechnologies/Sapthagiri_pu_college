const mongoose = require('mongoose');

const ExamBlueprintSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    examType: { type: String, enum: ['JEE', 'NEET', 'CET', 'KCET'], required: true },
    subjects: [{
        subjectName: { type: String, required: true }, // e.g. Physics, Chemistry, Botany, Zoology, Mathematics, Biology
        totalQuestions: { type: Number, required: true },
        sections: [{
            sectionName: { type: String, required: true }, // Section A, Section B
            numQuestions: { type: Number, required: true },
            allowedToAnswer: { type: Number }, // e.g. answer 10 out of 15
            questionTypes: [{ type: String }], // MCQ, NUMERICAL, ASSERTION_REASON, etc.
            markingRules: {
                correct: { type: Number, default: 4 },
                incorrect: { type: Number, default: -1 },
                unattempted: { type: Number, default: 0 }
            }
        }]
    }],
    durationMinutes: { type: Number, default: 180 },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamBlueprint', ExamBlueprintSchema, 'exam_blueprints');
