/**
 * Exam-session tokens: who may act on a session. No database required.
 */
process.env.JWT_SECRET = 'unit-test-secret';
const jwt = require('jsonwebtoken');
const { issueSessionToken, requireSessionAccess, requireLabNetworkIfConfigured } = require('../middleware/sessionToken');

const run = (mw, req) => new Promise(resolve => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b, passed: false }); } };
    const full = { params: {}, query: {}, body: {}, cookies: {}, header(n) { return (this.headers || {})[n.toLowerCase()]; }, ...req };
    mw(full, res, () => resolve({ code: 200, passed: true, req: full }));
});

const session = { id: 41 };
const tokenFor = (examId, sess = session) => issueSessionToken(sess, examId);
const staff = (role) => jwt.sign({ id: '5', role }, process.env.JWT_SECRET);

describe('requireSessionAccess - body-bound (submit / autosave / malpractice)', () => {
    const mw = requireSessionAccess({ sessionFrom: 'body', allowStaff: false });

    test('own session token passes', async () => {
        const r = await run(mw, { params: { id: '9' }, body: { sessionId: '41' }, headers: { 'x-session-token': tokenFor(9) } });
        expect(r.passed).toBe(true);
    });
    test('REGRESSION: no token at all is rejected (the old endpoints accepted a bare session number)', async () => {
        const r = await run(mw, { params: { id: '9' }, body: { sessionId: '41' } });
        expect(r.code).toBe(401);
    });
    test("another student's session number is rejected", async () => {
        const r = await run(mw, { params: { id: '9' }, body: { sessionId: '42' }, headers: { 'x-session-token': tokenFor(9) } });
        expect(r.code).toBe(403);
    });
    test('a token for a different exam is rejected', async () => {
        const r = await run(mw, { params: { id: '10' }, body: { sessionId: '41' }, headers: { 'x-session-token': tokenFor(9) } });
        expect(r.code).toBe(401);
    });
    test("staff JWT cannot submit on a student's behalf", async () => {
        const r = await run(mw, { params: { id: '9' }, body: { sessionId: '41' }, headers: { authorization: `Bearer ${staff('admin')}` } });
        expect(r.code).toBe(401);
    });
    test('forged, expired and wrong-type tokens are rejected', async () => {
        const forged = jwt.sign({ typ: 'exam-session', sid: '41', eid: '9' }, 'another-secret');
        const expired = jwt.sign({ typ: 'exam-session', sid: '41', eid: '9' }, process.env.JWT_SECRET, { expiresIn: -10 });
        const wrongType = jwt.sign({ sid: '41', eid: '9', role: 'teacher' }, process.env.JWT_SECRET);
        for (const t of [forged, expired, wrongType, 'garbage', 'null']) {
            const r = await run(mw, { params: { id: '9' }, body: { sessionId: '41' }, headers: { 'x-session-token': t } });
            expect(r.code).toBe(401);
        }
    });
    test('"sess_" prefixed ids are accepted for the same session', async () => {
        const r = await run(mw, { params: { id: '9' }, body: { sessionId: 'sess_41' }, headers: { 'x-session-token': tokenFor(9) } });
        expect(r.passed).toBe(true);
    });
});

describe('requireSessionAccess - scorecard (session in URL, staff allowed)', () => {
    const mw = requireSessionAccess({ sessionFrom: 'params' });
    test('own token and staff JWTs (header or ?token=) pass; an anonymous caller does not', async () => {
        expect((await run(mw, { params: { id: '9', sessionId: '41' }, headers: { 'x-session-token': tokenFor(9) } })).passed).toBe(true);
        expect((await run(mw, { params: { id: '9', sessionId: '41' }, query: { st: tokenFor(9) } })).passed).toBe(true);
        expect((await run(mw, { params: { id: '9', sessionId: '41' }, headers: { authorization: `Bearer ${staff('admin')}` } })).passed).toBe(true);
        // a login token in the URL is no longer accepted
        expect((await run(mw, { params: { id: '9', sessionId: '41' }, query: { token: staff('teacher') } })).code).toBe(401);
        expect((await run(mw, { params: { id: '9', sessionId: '41' } })).code).toBe(401);
    });
    test("REGRESSION: a student cannot read a neighbour's scorecard by changing the number in the URL", async () => {
        const r = await run(mw, { params: { id: '9', sessionId: '42' }, headers: { 'x-session-token': tokenFor(9) } });
        expect(r.code).toBe(403);
    });
    test('lab-terminal and unknown-role JWTs are not staff', async () => {
        for (const role of ['lab', 'student', undefined]) {
            const r = await run(mw, { params: { id: '9', sessionId: '41' }, headers: { authorization: `Bearer ${staff(role)}` } });
            expect(r.code).toBe(401);
        }
    });
});

describe('leaderboard (exam-level)', () => {
    const mw = requireSessionAccess();
    test('any session of that exam may read it; other exams and anonymous callers may not', async () => {
        expect((await run(mw, { params: { id: '9' }, headers: { 'x-session-token': tokenFor(9) } })).passed).toBe(true);
        expect((await run(mw, { params: { id: '8' }, headers: { 'x-session-token': tokenFor(9) } })).code).toBe(401);
        expect((await run(mw, { params: { id: '9' } })).code).toBe(401);
    });
});

describe('configuration', () => {
    test('no JWT secret: refuses everything', async () => {
        const saved = process.env.JWT_SECRET; delete process.env.JWT_SECRET;
        const r = await run(requireSessionAccess(), { params: { id: '9' } });
        process.env.JWT_SECRET = saved;
        expect(r.code).toBe(503);
    });
    test('LAB_IP configured: /start only from the lab network; unset or "*": open', async () => {
        const saved = process.env.LAB_IP;
        process.env.LAB_IP = '203.0.113.7';
        expect((await run(requireLabNetworkIfConfigured, { isLabIp: true })).passed).toBe(true);
        const denied = await run(requireLabNetworkIfConfigured, { isLabIp: false, clientIp: '198.51.100.2' });
        expect(denied.code).toBe(403);
        process.env.LAB_IP = '*';
        expect((await run(requireLabNetworkIfConfigured, { isLabIp: false })).passed).toBe(true);
        delete process.env.LAB_IP;
        expect((await run(requireLabNetworkIfConfigured, { isLabIp: false })).passed).toBe(true);
        if (saved !== undefined) process.env.LAB_IP = saved;
    });
});
