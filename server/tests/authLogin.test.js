/**
 * Login handler behaviour with fake requests (no network, no database).
 * Covers the admin path and the configuration guards.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@127.0.0.1:1/x';
const router = require('../routes/auth.js');

const layer = router.stack.find(l => l.route && l.route.path === '/login' && l.route.methods.post);
const handler = layer.route.stack[layer.route.stack.length - 1].handle;

const call = (body) => new Promise(resolve => {
    const res = {
        code: 200, cookies: [],
        status(c) { this.code = c; return this; },
        cookie(...a) { this.cookies.push(a); },
        json(d) { resolve({ code: this.code, body: d, cookies: this.cookies }); }
    };
    handler({ body }, res);
});

const ADMIN = 'sapthagiripucollegedvg@gmail.com';
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('login configuration guards', () => {
    test('no JWT secret: refuses to issue a token (no built-in secret)', async () => {
        delete process.env.JWT_SECRET;
        process.env.ADMIN_PASSWORD = 'pw-for-test';
        const r = await call({ email: ADMIN, password: 'pw-for-test' });
        expect(r.code).toBe(503);
        expect(r.body.token).toBeUndefined();
    });

    test('no admin password configured: admin login disabled, the old default password does not work', async () => {
        process.env.JWT_SECRET = 'secret-for-test';
        delete process.env.ADMIN_PASSWORD;
        const r = await call({ email: ADMIN, password: 'Sapthagiri1' });
        expect(r.code).toBe(503);
        expect(r.body.token).toBeUndefined();
    });
});

describe('admin login', () => {
    beforeEach(() => { process.env.JWT_SECRET = 'secret-for-test'; process.env.ADMIN_PASSWORD = 'pw-for-test'; });

    test('correct password: token and cookie issued', async () => {
        const r = await call({ email: ` ${ADMIN.toUpperCase()} `, password: 'pw-for-test' });
        expect(r.code).toBe(200);
        expect(typeof r.body.token).toBe('string');
        expect(r.cookies.length).toBe(1);
        expect(r.body.user.role).toBe('admin');
    });

    test('wrong password, empty password and wrong types are rejected without a token', async () => {
        expect((await call({ email: ADMIN, password: 'nope' })).code).toBe(400);
        expect((await call({ email: ADMIN, password: '' })).code).toBe(400);
        expect((await call({ email: ADMIN, password: 123 })).code).toBe(400);
        expect((await call({ email: {}, password: 'x' })).code).toBe(400);
        expect((await call(undefined)).code).toBe(400);
        const r = await call({ email: ADMIN, password: 'nope' });
        expect(r.body.token).toBeUndefined();
        expect(r.body.msg).toBe('Invalid email or password.');
    });
});
