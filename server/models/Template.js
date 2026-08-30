const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
    filename: { type: String, default: '' },
    originalName: { type: String, default: '' },
    title: { type: String, required: true },
    description: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fileUrl: { type: String, default: '' },
    institutionName: { type: String, default: '' },
    address: { type: String, default: '' },
    headerText: { type: String, default: '' },
    instructions: { type: String, default: '' },
    footerText: { type: String, default: '' },
    watermarkText: { type: String, default: '' },
    templateType: { type: String, enum: ['LOGO', 'HEADER', 'FULL_PAPER'], default: 'FULL_PAPER' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Template', TemplateSchema);

