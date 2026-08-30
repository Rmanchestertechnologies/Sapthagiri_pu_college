const mongoose = require('mongoose');

const BridgeKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlineExam', required: true },
    examTitle: { type: String },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 days
});

module.exports = mongoose.model('BridgeKey', BridgeKeySchema, 'bridge_keys');
