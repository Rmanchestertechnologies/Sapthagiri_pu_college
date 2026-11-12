const { isExamTraffic } = require('../middleware/rateLimiter');

const req = (url) => ({ originalUrl: url });

describe('which requests count as student exam traffic', () => {
    test('the endpoints a student terminal calls during a sitting', () => {
        for (const u of [
            '/api/exams/lab-active', '/api/exams/12/take?rollNumber=T001', '/api/exams/12/start',
            '/api/exams/12/session/save-progress', '/api/exams/12/submit', '/api/exams/12/malpractice',
            '/api/exams/12/scorecard/41', '/api/exams/12/pdf-report/41', '/api/exams/12/leaderboard',
            '/api/lab/student/T001', '/api/lab/exams?rollNumber=T001', '/api/lab/login',
        ]) expect(isExamTraffic(req(u))).toBe(true);
    });

    test('REGRESSION: everything else keeps the general per-address budget (staff, questions, papers, OMR, auth)', () => {
        for (const u of [
            '/api/exams', '/api/exams/12', '/api/exams/12/results', '/api/exams/12/analytics', '/api/exams/commission',
            '/api/exams/merge', '/api/exams/12/bridge-key', '/api/questions?limit=50', '/api/papers', '/api/omr/scan',
            '/api/auth/login', '/api/admin/teachers', '/api/notifications',
        ]) expect(isExamTraffic(req(u))).toBe(false);
    });

    test('query strings and a missing url do not break the check', () => {
        expect(isExamTraffic(req('/api/exams/12/submit?x=1'))).toBe(true);
        expect(isExamTraffic({})).toBe(false);
    });
});
