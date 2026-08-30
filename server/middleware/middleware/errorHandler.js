/**
 * server/middleware/errorHandler.js
 * Global error handler — never exposes raw stack traces or err.message to clients.
 */
const errorHandler = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV !== 'production';

    // Log full error internally
    console.error(`[ERROR] ${req.method} ${req.path} —`, err.message || err);
    if (isDev) console.error(err.stack);

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ msg: 'Validation failed', errors: messages });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({ msg: `Duplicate value for ${field}.` });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ msg: 'Invalid token.' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: 'Token has expired. Please log in again.' });
    }

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ msg: 'File too large. Maximum size is 5MB.' });
    }

    // Generic
    const statusCode = err.statusCode || err.status || 500;
    const message = statusCode < 500
        ? (err.message || 'Bad request.')
        : 'An internal server error occurred.';

    res.status(statusCode).json({ msg: message });
};

module.exports = errorHandler;
