const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    questionId: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    classes: [{ type: String, required: true }], // relaxed enum to allow flexible classes/subjects
    chapter: { type: String, required: true },
    concept: { type: String, required: true },
    subConcept: { type: String, default: '' },
    level: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    type: { type: String, required: true }, // relaxed enum to allow new question types
    questionText: { type: String, required: true },
    options: [{ type: String }], // For MCQ and option-based questions
    answer: { type: String }, // Stores MCQ option, True/False, or numerical value
    imageUrl: { type: String },
    solutionText: { type: String },
    solutionImageUrl: { type: String },
    questionTextTranslation: { type: String, default: '' },
    optionsTranslation: [{ type: String }],

    // Assertion & Reason fields
    assertion: { type: String, default: '' },
    reason: { type: String, default: '' },

    // Statement-Based fields
    statements: [{ type: String }],

    // Match the Following fields
    matchPairs: [{
        left: { type: String },
        right: { type: String }
    }],

    // Numerical-specific fields
    numericalTolerance: { type: Number, default: 0 },

    // Source Metadata
    sourceType: { type: String, enum: ['REGULAR', 'GT', 'PYQ'], default: 'REGULAR' },
    sourcePaperId: { type: mongoose.Schema.Types.ObjectId, refPath: 'sourceModel' },
    sourceModel: { type: String, enum: ['GrandTestPaper', 'PreviousYearPaper'] },
    sourcePaperName: { type: String, default: '' },
    sourceExam: { type: String, default: '' },
    sourceYear: { type: Number },
    sourceDisplayCode: { type: String, default: '' },
    academicYearLevel: { type: String, enum: ['FIRST_YEAR', 'SECOND_YEAR', ''], default: '' },

    // AI-Assisted conversion tracking
    convertedFromQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    conversionType: { type: String, default: '' },
    conversionTimestamp: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// ── Indexes for common query patterns ──────────────────────────────────────
QuestionSchema.index({ subject: 1, chapter: 1, type: 1, classes: 1 });
QuestionSchema.index({ subject: 1, level: 1 });
QuestionSchema.index({ sourceType: 1, sourcePaperId: 1 });
QuestionSchema.index({ createdBy: 1, subject: 1 });

module.exports = mongoose.model('Question', QuestionSchema);
