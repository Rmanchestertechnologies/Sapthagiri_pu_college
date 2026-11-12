const { createThrottle } = require('../middleware/loginThrottle');

const make = (overrides = {}) => {
    let t = 1_000_000;
    const clock = { now: () => t, advance: ms => { t += ms; } };
    return { clock, th: createThrottle({ now: clock.now, ...overrides }) };
};

describe('login throttle', () => {
    test('nine failures are allowed; the tenth locks the account until the window ends', () => {
        const { th, clock } = make();
        for (let i = 0; i < 9; i++) th.fail('1.1.1.1', 'a@x.com');
        expect(th.check('1.1.1.1', 'a@x.com').blocked).toBe(false);
        th.fail('1.1.1.1', 'a@x.com');
        const g = th.check('1.1.1.1', 'a@x.com');
        expect(g.blocked).toBe(true);
        expect(g.retryAfterSeconds).toBeGreaterThan(0);
        expect(g.retryAfterSeconds).toBeLessThanOrEqual(900);
        clock.advance(15 * 60 * 1000 + 1);
        expect(th.check('1.1.1.1', 'a@x.com').blocked).toBe(false);
    });

    test('is per account and address: another account or address is unaffected', () => {
        const { th } = make();
        for (let i = 0; i < 10; i++) th.fail('1.1.1.1', 'a@x.com');
        expect(th.check('1.1.1.1', 'b@x.com').blocked).toBe(false);
        expect(th.check('2.2.2.2', 'a@x.com').blocked).toBe(false);
    });

    test('e-mail case does not create a second counter', () => {
        const { th } = make();
        for (let i = 0; i < 5; i++) th.fail('1.1.1.1', 'A@X.com');
        for (let i = 0; i < 5; i++) th.fail('1.1.1.1', 'a@x.COM');
        expect(th.check('1.1.1.1', 'a@x.com').blocked).toBe(true);
    });

    test('a successful login clears the account counter', () => {
        const { th } = make();
        for (let i = 0; i < 9; i++) th.fail('1.1.1.1', 'a@x.com');
        th.succeed('1.1.1.1', 'a@x.com');
        for (let i = 0; i < 9; i++) th.fail('1.1.1.1', 'a@x.com');
        expect(th.check('1.1.1.1', 'a@x.com').blocked).toBe(false);
    });

    test('password spraying: many accounts from one address is blocked at the address limit', () => {
        const { th } = make();
        for (let i = 0; i < 100; i++) th.fail('9.9.9.9', `user${i}@x.com`);
        expect(th.check('9.9.9.9', 'fresh@x.com').blocked).toBe(true);
        expect(th.check('8.8.8.8', 'fresh@x.com').blocked).toBe(false);
    });

    test('old entries are swept', () => {
        const { th, clock } = make();
        th.fail('1.1.1.1', 'a@x.com');
        expect(th.size()).toBeGreaterThan(0);
        clock.advance(16 * 60 * 1000);
        th.sweep();
        expect(th.size()).toBe(0);
    });
});
