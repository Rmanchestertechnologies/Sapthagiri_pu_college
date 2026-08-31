const mongoose = require('mongoose');

/**
 * AuditLog — records all significant security and data events.
 * Used for: login/logout, failed logins, question CRUD, paper generation,
 *            answer key access, PDF export, exam management.
 */
const AuditLogSchema = new mongoose.Schema({
    // Who did it
    userId:    { type: String, default: 'anonymous' }, // String to handle hardcoded admin
    userEmail: { type: String, default: '' },
    role:      { type: String, default: 'unknown' },

    // What they did
    action: {
        type: String,
        required: true,
        enum: [
            'login', 'logout', 'failed_login',
            'question_create', 'question_update', 'question_delete',
            'paper_create', 'paper_update', 'paper_delete',
            'exam_create', 'exam_update', 'exam_delete',
            'answer_key_access', 'pdf_export', 'paper_download',
            'grand_test_access', 'template_upload', 'template_delete',
            'user_create', 'user_update', 'user_delete',
            'exam_session_start', 'exam_session_submit',
            'security_event'  // rate limit hit, injection attempt, etc.
        ]
    },

    // Resource affected
    resource:   { type: String, default: '' }, // 'question', 'paper', 'exam', etc.
    resourceId: { type: String, default: '' }, // MongoDB ObjectId as string

    // Request context
    ip:        { type: String, default: '' },
    userAgent: { type: String, default: '' },
    method:    { type: String, default: '' },
    path:      { type: String, default: '' },

    // Optional extra data (non-sensitive)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Result
    success: { type: Boolean, default: true },
    details: { type: String, default: '' },

    createdAt: { type: Date, default: Date.now, index: true }
});

// Indexes for querying audit logs efficiently
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
