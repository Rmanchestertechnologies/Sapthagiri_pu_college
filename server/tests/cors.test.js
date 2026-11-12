/**
 * Browser access from another origin (the real deployment: SPA and API on different hosts).
 * A node client ignores CORS, so only the preflight headers can show these problems.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'unit-test-secret';
const request = require('supertest');
const app = require('../index');

const preflight = (path, headers) => request(app)
    .options(path)
    .set('Origin', 'https://app.example.com')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', headers);

describe('CORS preflight', () => {
    test('REGRESSION: the exam session header is allowed (without it every autosave / submit from a browser failed)', async () => {
        const res = await preflight('/api/exams/1/session/save-progress', 'content-type,x-session-token');
        expect(res.status).toBe(200);
        expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('x-session-token');
    });

    test('the usual headers stay allowed and credentials are supported', async () => {
        const res = await preflight('/api/papers', 'authorization,content-type');
        const allowed = String(res.headers['access-control-allow-headers']).toLowerCase();
        expect(allowed).toContain('authorization');
        expect(allowed).toContain('content-type');
        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    test('REGRESSION: the headers the SPA reads are exposed (question total, download file name, Retry-After)', async () => {
        const res = await request(app).get('/api/health').set('Origin', 'https://app.example.com');
        const exposed = String(res.headers['access-control-expose-headers']).toLowerCase();
        for (const h of ['x-total-count', 'content-disposition', 'retry-after']) expect(exposed).toContain(h);
    });
});
