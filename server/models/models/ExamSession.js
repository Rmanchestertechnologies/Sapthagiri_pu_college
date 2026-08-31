const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId },
    selectedOption: { type: String, default: null },
    markedForReview: { type: Boolean, default: false },
    visited: { type: Boolean, default: false },
    timeTaken: { type: Number, default: 0 } // seconds
}, { _id: false });

const ExamSessionSchema = new mongoose.Schema({
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlineExam', required: true },
    studentId: { type: String, required: true }, // can be lab student id
    studentName: { type: String, default: 'Student' },
    studentEmail: { type: String, default: '' },
    rollNumber: { type: String, default: '' },
    fromLabIp: { type: Boolean, default: false },
    clientIp: { type: String, default: '' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    submitted: { type: Boolean, default: false },
    answers: [AnswerSchema],
    // Computed on submission
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    unattempted: { type: Number, default: 0 },
    weakAreas: [{ subject: String, chapter: String, incorrect: Number }],
    malpracticeFlag: { type: Boolean, default: false },
    malpracticeReason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamSession', ExamSessionSchema, 'exam_sessions');
