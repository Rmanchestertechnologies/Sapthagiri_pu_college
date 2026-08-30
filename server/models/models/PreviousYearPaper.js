const mongoose = require('mongoose');

const PreviousYearPaperSchema = new mongoose.Schema({
    title: { type: String, required: true },
    examType: { type: String, enum: ['JEE', 'NEET', 'CET'], required: true },
    year: { type: Number, required: true },
    subject: { type: String, default: 'Mixed' },
    shift: { type: String, default: '' }, // For JEE sessions/shifts
    originalFileUrl: { type: String, default: '' },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PreviousYearPaper', PreviousYearPaperSchema, 'previous_year_papers');
