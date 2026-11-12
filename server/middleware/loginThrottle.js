/**
 * Failed-login throttle (in memory, per server process).
 *
 * The previous login limiter was a no-op, so passwords could be guessed without limit. This one only counts
 * FAILED attempts, so normal use is never slowed down, and it is deliberately lenient because a school shares
 * a few public IP addresses:
 *   - 10 failures per account (+ address) in 15 minutes, then that account is locked for the rest of the window
 *   - 100 failures per address in 15 minutes across all accounts (password spraying)
 * A successful login clears the account's counter. State is lost on restart and not shared between instances;
 * move it to the database or Redis if the API is ever scaled out.
 */
const WINDOW_MS = 15 * 60 * 1000;
const PER_ACCOUNT_LIMIT = 10;
const PER_ADDRESS_LIMIT = 100;

function createThrottle({ now = () => Date.now(), windowMs = WINDOW_MS, perAccount = PER_ACCOUNT_LIMIT, perAddress = PER_ADDRESS_LIMIT } = {}) {
    const accounts = new Map(); // key -> { count, first }
    const addresses = new Map();

    const live = (map, key) => {
        const e = map.get(key);
        if (!e) return null;
        if (now() - e.first > windowMs) { map.delete(key); return null; }
        return e;
    };
    const bump = (map, key) => {
        const e = live(map, key);
        if (e) e.count += 1; else map.set(key, { count: 1, first: now() });
    };
    const accountKey = (ip, email) => `${ip}|${String(email || '').toLowerCase()}`;

    return {
        /** @returns {{blocked:boolean, retryAfterSeconds:number}} */
        check(ip, email) {
            const a = live(accounts, accountKey(ip, email));
            const d = live(addresses, ip);
            let wait = 0;
            if (a && a.count >= perAccount) wait = Math.max(wait, a.first + windowMs - now());
            if (d && d.count >= perAddress) wait = Math.max(wait, d.first + windowMs - now());
            return { blocked: wait > 0, retryAfterSeconds: Math.ceil(wait / 1000) };
        },
        fail(ip, email) { bump(accounts, accountKey(ip, email)); bump(addresses, ip); },
        succeed(ip, email) { accounts.delete(accountKey(ip, email)); },
        /** drop expired entries (called occasionally to keep memory bounded) */
        sweep() {
            for (const map of [accounts, addresses]) for (const [k, e] of map) if (now() - e.first > windowMs) map.delete(k);
        },
        size() { return accounts.size + addresses.size; }
    };
}

const loginThrottle = createThrottle();
setInterval(() => loginThrottle.sweep(), 5 * 60 * 1000).unref();

module.exports = { createThrottle, loginThrottle, WINDOW_MS, PER_ACCOUNT_LIMIT, PER_ADDRESS_LIMIT };
