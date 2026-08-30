/**
 * server/middleware/mongoSanitize.js
 * Express 5 compatible NoSQL injection sanitizer.
 * Express 5 makes req.query read-only (getter), so standard express-mongo-sanitize
 * throws TypeError. This custom sanitizer mutates objects in-place safely.
 */

function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
    }

    for (const key of Object.keys(obj)) {
        // Strip keys starting with $ or containing . (NoSQL operator injection)
        if (key.startsWith('$') || key.includes('.')) {
            console.warn(`[SECURITY] Sanitized NoSQL injection key: ${key}`);
            delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitize(obj[key]);
        }
    }
    return obj;
}

function mongoSanitizeExpress5(req, res, next) {
    if (req.body) sanitize(req.body);
    if (req.params) sanitize(req.params);
    if (req.query) sanitize(req.query);
    next();
}

module.exports = mongoSanitizeExpress5;
