/**
 * Exam-session tokens.
 *
 * The student CBT endpoints used to identify a sitting only by its session number (a sequential integer), so
 * anyone who could reach the API could overwrite, submit or disqualify another student's session or read
 * their scorecard. /start now returns a signed token bound to one session and one exam, and the endpoints that
 * act on a session require it. Administrators and teachers (normal JWT) may still read results.
 *
 * What this does NOT do: prove who the student is. A roll number is the only identity the lab portal collects,
 * so someone who knows it can still start/resume that student's sitting. Set LAB_IP so that /start is only
 * accepted from the lab network, and consider adding a student secret (date of birth, PIN).
 */
const jwt = require('jsonwebtoken');

const TYPE = 'exam-session';
const LIFETIME = '12h';

function issueSessionToken(session, examId) {
    return jwt.sign(
        { typ: TYPE, sid: String(session._id ?? session.id), eid: String(examId) },
        process.env.JWT_SECRET,
        { expiresIn: LIFETIME }
    );
}

const cleanToken = v => (!v || v === 'null' || v === 'undefined') ? undefined : v;

function readSessionToken(req) {
    return cleanToken(req.header('x-session-token')) || cleanToken(req.query?.st);
}

function readStaffToken(req) {
    const bearer = req.header('Authorization');
    return cleanToken(req.cookies?.auth_token)
        || (bearer && bearer.startsWith('Bearer ') ? cleanToken(bearer.split(' ')[1]) : undefined)
        || cleanToken(req.header('x-auth-token'));
}

function verify(token) {
    try { return jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
}

/**
 * @param {Object} opts
 * @param {'body'|'params'|null} opts.sessionFrom where the session id of the request lives (null: exam-level only)
 * @param {boolean} [opts.allowStaff=true] admins/teachers may pass without a session token
 */
const requireSessionAccess = ({ sessionFrom = null, allowStaff = true } = {}) => (req, res, next) => {
    if (!process.env.JWT_SECRET) {
        return res.status(503).json({ msg: 'The server is not configured (JWT_SECRET).' });
    }

    const st = readSessionToken(req);
    if (st) {
        const p = verify(st);
        if (p && p.typ === TYPE && String(p.eid) === String(req.params.id)) {
            if (!sessionFrom) { req.examSession = p; return next(); }
            const wanted = sessionFrom === 'body' ? req.body?.sessionId : req.params?.sessionId;
            const norm = v => String(v ?? '').replace(/^sess_/, '');
            if (norm(wanted) && norm(wanted) === norm(p.sid)) { req.examSession = p; return next(); }
            return res.status(403).json({ msg: 'This session token does not belong to that session.' });
        }
    }

    if (allowStaff) {
        const t = readStaffToken(req);
        const p = t && verify(t);
        if (p && ['admin', 'teacher'].includes(p.role)) { req.user = p; return next(); }
    }
    return res.status(401).json({ msg: 'A valid exam session is required. Please restart the exam from the lab portal.' });
};

/**
 * When LAB_IP is configured, starting a sitting is only allowed from those addresses. Unset (or "*") keeps
 * the old behaviour. Relies on `detectLabIp` having run first.
 */
const requireLabNetworkIfConfigured = (req, res, next) => {
    const configured = String(process.env.LAB_IP || '').split(',').map(s => s.trim()).filter(Boolean);
    if (configured.length === 0 || configured.includes('*')) return next();
    if (req.isLabIp) return next();
    return res.status(403).json({ msg: 'Exams can only be started from the lab network.', yourIp: req.clientIp });
};

module.exports = { issueSessionToken, requireSessionAccess, requireLabNetworkIfConfigured, TYPE };
