const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'auth_token';

const auth = (req, res, next) => {
    // Helper to sanitize token values
    const cleanToken = (val) => {
        if (!val || val === 'null' || val === 'undefined') return undefined;
        return val;
    };

    // 1. Try HttpOnly cookie first (new secure method)
    let token = cleanToken(req.cookies?.[COOKIE_NAME]);

    // 2. Fall back to Authorization: Bearer header (for backward compatibility + API clients)
    if (!token) {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = cleanToken(authHeader.split(' ')[1]);
        }
    }

    // 3. Fall back to x-auth-token header (legacy)
    if (!token) {
        token = cleanToken(req.header('x-auth-token'));
    }

    // 4. Fall back to query parameter (e.g. for file downloads)
    if (!token) {
        token = cleanToken(req.query?.token);
    }

    // 5. Fall back to request body parameter
    if (!token) {
        token = cleanToken(req.body?.token);
    }

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        if (e.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: 'Token has expired. Please log in again.' });
        }
        return res.status(401).json({ msg: 'Token is not valid.' });
    }
};

module.exports = auth;
