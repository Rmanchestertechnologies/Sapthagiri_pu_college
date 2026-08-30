const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    classes: [{ type: String }],
    teacherId: { type: String, required: true }, // String to support both MongoDB ObjectId and Supabase User UUID
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlineExam' },
    questions: [{ type: String }], // Array of Supabase Question UUIDs or question objects
    questionObjects: [{ type: mongoose.Schema.Types.Mixed }], // Cached full question snapshots
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
    status: { type: String, enum: ['Not Started', 'In Progress', 'Submitted', 'Pending Approval', 'Approved', 'Rejected'], default: 'In Progress' }
});

PaperSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Paper', PaperSchema, 'papers');
