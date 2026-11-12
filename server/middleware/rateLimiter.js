/**
 * server/middleware/rateLimiter.js
 * Centralized rate-limiting configuration using express-rate-limit.
 */
const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

/** Unlimited login limiter (disabled per requirement) */
const loginLimiter = (req, res, next) => next();

/** PDF / export endpoint limiter — 20 per hour per IP */
const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    message: { msg: 'Export rate limit exceeded. Please wait before generating more PDFs.' }
});

/**
 * Student exam traffic: starting a sitting, autosave (every few seconds), submit, scorecard, the lab portal's polling and
 * the student lookup. All lab terminals usually share ONE public IP address, so counting them against the general
 * per-IP budget (300 requests a minute) made a lab of about fifteen students run out during an exam: autosaves and
 * submissions were refused with "Too many requests".
 */
const EXAM_TRAFFIC = /^\/api\/(exams\/(lab-active|[^/]+\/(start|take|session\/save-progress|submit|malpractice|scorecard\/[^/]+|pdf-report\/[^/]+|leaderboard))|lab\/(student|exams|login))/;
const isExamTraffic = (req) => EXAM_TRAFFIC.test(String(req.originalUrl || req.url || '').split('?')[0]);

/** General API limiter: 300 requests per minute per IP, for everything except student exam traffic */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isTest || isExamTraffic(req),
    message: { msg: 'Too many requests. Please slow down.' }
});

// A student holding a session token is limited per session (about 3 autosaves a second would still pass); anything
// without a token (start, take, portal polling) is limited per address with a budget sized for a whole lab.
const { ipKeyGenerator } = rateLimit;
const jwt = require('jsonwebtoken');
const sessionKey = (req) => {
    const t = req.header('x-session-token');
    if (t) {
        try { const p = jwt.decode(t); if (p && p.sid) return `sess:${p.sid}`; } catch { /* fall through to the address */ }
    }
    return `ip:${typeof ipKeyGenerator === 'function' ? ipKeyGenerator(req.ip || '') : (req.ip || '')}`;
};
const examLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: (req) => (req.header('x-session-token') ? 180 : 1500),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: sessionKey,
    skip: (req) => isTest || !isExamTraffic(req),
    message: { msg: 'Too many requests. Please wait a moment and try again.' }
});

module.exports = { loginLimiter, exportLimiter, apiLimiter, examLimiter, isExamTraffic };
