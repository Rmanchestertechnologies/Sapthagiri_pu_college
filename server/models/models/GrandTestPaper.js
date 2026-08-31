const mongoose = require('mongoose');

const GrandTestPaperSchema = new mongoose.Schema({
    title: { type: String, required: true },
    code: { type: String, required: true }, // e.g. GT-1, GT-2
    examType: { type: String, enum: ['JEE', 'NEET', 'CET'], required: true },
    academicYearLevel: { type: String, enum: ['FIRST_YEAR', 'SECOND_YEAR'], required: true },
    subject: { type: String, default: 'Mixed' }, // Mixed or specific subject
    originalFileUrl: { type: String, default: '' },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GrandTestPaper', GrandTestPaperSchema, 'grand_test_papers');
