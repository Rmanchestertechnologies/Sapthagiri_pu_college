/**
 * server/middleware/permissions.js
 * Centralized RBAC permission constants and role-permission matrix.
 */

const PERMISSIONS = {
    // Question permissions
    QUESTION_READ:   'question:read',
    QUESTION_CREATE: 'question:create',
    QUESTION_UPDATE: 'question:update',
    QUESTION_DELETE: 'question:delete',

    // Paper permissions
    PAPER_CREATE: 'paper:create',
    PAPER_READ:   'paper:read',
    PAPER_UPDATE: 'paper:update',
    PAPER_DELETE: 'paper:delete',

    // Exam permissions
    EXAM_CREATE:  'exam:create',
    EXAM_MANAGE:  'exam:manage',
    EXAM_READ:    'exam:read',

    // Answer key / solution permissions
    ANSWER_KEY_READ:   'answerkey:read',
    SOLUTION_READ:     'solution:read',

    // Template permissions
    TEMPLATE_UPLOAD:  'template:upload',
    TEMPLATE_DELETE:  'template:delete',
    TEMPLATE_READ:    'template:read',

    // User management
    USER_CREATE: 'user:create',
    USER_READ:   'user:read',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',

    // Audit
    AUDIT_READ: 'audit:read',

    // Grand Tests / PYQ
    GRAND_TEST_READ:   'grandtest:read',
    GRAND_TEST_MANAGE: 'grandtest:manage',

    // Admin full
    ADMIN_FULL: 'admin:full',
};

const ROLE_PERMISSIONS = {
    admin: Object.values(PERMISSIONS), // All permissions

    teacher: [
        PERMISSIONS.QUESTION_READ,
        PERMISSIONS.QUESTION_CREATE,
        PERMISSIONS.QUESTION_UPDATE,
        PERMISSIONS.QUESTION_DELETE,
        PERMISSIONS.PAPER_CREATE,
        PERMISSIONS.PAPER_READ,
        PERMISSIONS.PAPER_UPDATE,
        PERMISSIONS.PAPER_DELETE,
        PERMISSIONS.TEMPLATE_READ,
        PERMISSIONS.GRAND_TEST_READ,
        PERMISSIONS.EXAM_READ,
    ],

    lab: [
        PERMISSIONS.EXAM_READ,
    ]
};

/**
 * Middleware factory: checks if user has required permission.
 * Usage: router.get('/route', auth, requirePermission('question:read'), handler)
 */
const requirePermission = (permission) => (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ msg: 'Authentication required.' });

    const perms = ROLE_PERMISSIONS[role] || [];
    if (!perms.includes(permission)) {
        return res.status(403).json({ msg: `Access denied. Required permission: ${permission}` });
    }
    next();
};

/**
 * Check if a user has a given permission (programmatic check, no middleware).
 */
const hasPermission = (role, permission) => {
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.includes(permission);
};

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, requirePermission, hasPermission };
