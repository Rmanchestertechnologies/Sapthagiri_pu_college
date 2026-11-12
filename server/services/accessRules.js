/**
 * Who may touch what (pure functions, no database access).
 */

const sameId = (a, b) => a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);

/** Owner id(s) a paper row/object may carry, across the Postgres and legacy shapes. */
const paperOwnerIds = (paper) => [
    paper?.teacherId, paper?.teacher_id, paper?.created_by, paper?.createdBy, paper?.author_id
].filter(v => v !== undefined && v !== null && v !== '');

/**
 * Papers are private to the teacher who made them, except that
 *  - admins see everything, and
 *  - a teacher who has been assigned a subject of the commissioned exam the paper belongs to
 *    may read and edit that paper (multi-teacher drafts).
 * `exam` is the linked exam (or null/undefined when the paper has none).
 */
function canAccessPaper(user, paper, exam = null) {
    if (!user || !paper) return false;
    if (user.role === 'admin') return true;
    if (paperOwnerIds(paper).some(id => sameId(id, user.id))) return true;
    const assignments = Array.isArray(exam?.subjectAssignments) ? exam.subjectAssignments : [];
    return assignments.some(sa => sameId(sa?.teacherId, user.id));
}

/** Only the owner (or an admin) may delete. Assigned co-authors may not. */
function canDeletePaper(user, paper) {
    if (!user || !paper) return false;
    if (user.role === 'admin') return true;
    return paperOwnerIds(paper).some(id => sameId(id, user.id));
}

/** Papers an OMR operator may evaluate against: their own, plus papers that were approved/submitted. */
function canUseOmrPaper(user, paper) {
    if (!user || !paper) return false;
    if (user.role === 'admin') return true;
    if (paperOwnerIds(paper).some(id => sameId(id, user.id))) return true;
    return ['approved', 'submitted'].includes(String(paper.status || '').toLowerCase());
}

/**
 * Image proxy allow-list. The proxy is unauthenticated (it serves <img> tags), so it may only
 * fetch from known image hosts over https; otherwise it is an open relay into the server's
 * network (localhost, cloud metadata addresses, internal services).
 */
function isAllowedImageUrl(rawUrl, extraHosts = []) {
    let u;
    try { u = new URL(rawUrl); } catch { return false; }
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    if (u.port && u.port !== '443') return false;
    const host = u.hostname.toLowerCase();
    const allowed = ['res.cloudinary.com', ...extraHosts.map(h => String(h).trim().toLowerCase()).filter(Boolean)];
    if (allowed.includes(host)) return true;
    return host.endsWith('.supabase.co');
}

/** Parse ALLOWED_ORIGINS. Returns null when unset or "*" (meaning: no restriction configured). */
function parseAllowedOrigins(raw) {
    const list = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 0 || list.includes('*')) return null;
    return list.map(o => o.replace(/\/+$/, ''));
}

function isOriginAllowed(origin, allowedList) {
    if (!origin) return true; // same-origin / server-to-server / curl: no Origin header
    if (!allowedList) return true;
    return allowedList.includes(String(origin).replace(/\/+$/, ''));
}

module.exports = { sameId, paperOwnerIds, canAccessPaper, canDeletePaper, canUseOmrPaper, isAllowedImageUrl, parseAllowedOrigins, isOriginAllowed };
