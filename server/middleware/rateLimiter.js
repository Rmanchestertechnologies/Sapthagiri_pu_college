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

/** General API limiter — 300 requests per minute per IP */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    message: { msg: 'Too many requests. Please slow down.' }
});

module.exports = { loginLimiter, exportLimiter, apiLimiter };
