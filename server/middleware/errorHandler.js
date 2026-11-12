/**
 * server/middleware/errorHandler.js
 * Global error handler — never exposes raw stack traces or err.message to clients.
 */
const errorHandler = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV !== 'production';

    // Log full error internally
    console.error(`[ERROR] ${req.method} ${req.path} —`, err.message || err);
    if (isDev) console.error(err.stack);

    // Request body problems
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ msg: 'The request body is not valid JSON.' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ msg: 'The request is too large.' });
    }

    // PostgreSQL errors (SQLSTATE codes)
    if (err.code === '23505') {
        return res.status(409).json({ msg: 'This record already exists.' });
    }
    if (err.code === '23503') {
        return res.status(409).json({ msg: 'This record is linked to other data and cannot be changed this way.' });
    }
    if (err.code === '22P02' || err.code === '22003') {
        return res.status(400).json({ msg: 'One of the values sent is not in a valid format.' });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ msg: 'Invalid token.' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: 'Token has expired. Please log in again.' });
    }

    // Multer (upload) errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ msg: 'File too large. Please upload a smaller file.' });
    }
    if (typeof err.code === 'string' && err.code.startsWith('LIMIT_')) {
        return res.status(400).json({ msg: 'The upload was rejected (too many files, fields or an unexpected field).' });
    }

    // Generic
    const statusCode = err.statusCode || err.status || 500;
    const message = statusCode < 500
        ? (err.message || 'Bad request.')
        : 'An internal server error occurred.';

    res.status(statusCode).json({ msg: message });
};

module.exports = errorHandler;
