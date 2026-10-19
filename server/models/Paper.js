const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    subject: { type: String, required: true }, // Physics / Chemistry / Mathematics / Biology
    questions: [{ type: String }], // ordered array of question IDs
    questionObjects: [{ type: mongoose.Schema.Types.Mixed }], // snapshots
    status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'SAVED'], default: 'NOT_STARTED' },
    updated_at: { type: Date, default: Date.now }
}, { _id: false });

const PaperSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, default: 'General' },
    exam_type: { 
        type: String, 
        enum: ['JEE_PCM', 'NEET_PCB', 'CET_PCMB', 'JEE', 'NEET', 'CET', 'KCET', 'ASSIGNMENT'], 
        default: 'JEE_PCM' 
    },
    examType: { type: String },
    classes: [{ type: String }],
    teacherId: { type: String, required: true }, // String to support both MongoDB ObjectId and Supabase User UUID
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlineExam' },
    questions: [{ type: String }], // Array of Supabase Question UUIDs or question objects
    questionObjects: [{ type: mongoose.Schema.Types.Mixed }], // Cached full question snapshots
    sections: [SectionSchema], // Structured section state for multi-teacher asynchronous workflow
    templateId: { type: String },
    difficultyDistribution: {
        easy: { type: Number, default: 40 },
        medium: { type: Number, default: 40 },
        hard: { type: Number, default: 20 }
    },
    pattern: [{
        sectionName: String,
        numQuestions: Number,
        type: { type: String },
        description: String,
        marks: Number
    }],
    isAssignment: { type: Boolean, default: false },
    duration: { type: String },
    startQNo: { type: Number, default: 1 },
    endQNo: { type: Number },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    status: { 
        type: String, 
        enum: ['DRAFT', 'COMPLETED', 'Not Started', 'In Progress', 'Submitted', 'Pending Approval', 'Approved', 'Rejected'], 
        default: 'DRAFT' 
    }
});

PaperSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Paper', PaperSchema, 'papers');
