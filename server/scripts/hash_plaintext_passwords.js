/**
 * Finds user accounts whose password is stored unhashed and (optionally) replaces it with a bcrypt hash of the
 * SAME password, so nobody's login changes. Defaults to a dry run that changes nothing.
 *
 *   node scripts/hash_plaintext_passwords.js            # report only
 *   node scripts/hash_plaintext_passwords.js --apply    # hash them (back up the users table first)
 *
 * Only the number of accounts and their e-mail addresses are printed; passwords never are.
 */
const path = require('path');
// ENV_FILE selects another environment file (e.g. a throwaway local test database) instead of server/.env
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../config/postgres');

const isHash = v => typeof v === 'string' && /^\$2[aby]\$\d\d\$/.test(v);

(async () => {
    const apply = process.argv.includes('--apply');
    const { rows } = await pool.query('SELECT id, email, password FROM public.users ORDER BY id');
    const plain = rows.filter(r => r.password && !isHash(r.password));
    const empty = rows.filter(r => !r.password);

    console.log(`${rows.length} accounts: ${rows.length - plain.length - empty.length} hashed, ${plain.length} unhashed, ${empty.length} without a password.`);
    plain.forEach(r => console.log(`  unhashed: #${r.id} ${r.email}`));

    if (!apply) {
        console.log(plain.length ? '\nDry run. Re-run with --apply to hash these passwords (take a backup first).' : '\nNothing to do.');
        await pool.end();
        return;
    }

    let done = 0;
    for (const r of plain) {
        const hash = await bcrypt.hash(r.password, 10);
        // the WHERE clause on the old value makes this a no-op if the password changed in the meantime
        const res = await pool.query('UPDATE public.users SET password = $1 WHERE id = $2 AND password = $3', [hash, r.id, r.password]);
        done += res.rowCount;
    }
    console.log(`Hashed ${done} of ${plain.length} accounts.`);
    await pool.end();
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
