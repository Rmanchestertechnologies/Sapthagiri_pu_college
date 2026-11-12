/**
 * Minimal migration runner for the primary database.
 *
 *   node scripts/migrate.js            # dry run: lists pending migrations, changes nothing
 *   node scripts/migrate.js --apply    # applies pending migrations, each in its own transaction
 *
 * Migrations live in server/migrations/NNN_name.sql. Only the part above the "-- ── DOWN" marker is executed.
 * Applied files are recorded in public.schema_migrations, so running it twice is harmless. Take a backup before
 * --apply on production.
 */
const fs = require('fs');
const path = require('path');
// ENV_FILE selects another environment file (e.g. a throwaway local test database) instead of server/.env
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const pool = require('../config/postgres');

const DIR = path.resolve(__dirname, '../migrations');

(async () => {
    const apply = process.argv.includes('--apply');
    // A dry run must not change the database, so the bookkeeping table is only created with --apply.
    const exists = (await pool.query("SELECT to_regclass('public.schema_migrations') AS t")).rows[0].t;
    if (!exists && apply) {
        await pool.query(`
            CREATE TABLE public.schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )`);
    }
    const done = new Set(exists || apply
        ? (await pool.query('SELECT name FROM public.schema_migrations')).rows.map(r => r.name)
        : []);
    const files = fs.readdirSync(DIR).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const pending = files.filter(f => !done.has(f));

    console.log(`${files.length} migration(s): ${files.length - pending.length} applied, ${pending.length} pending.`);
    pending.forEach(f => console.log('  pending:', f));
    if (!apply) {
        console.log(pending.length ? '\nDry run. Re-run with --apply to run the pending migrations (back up first).' : '\nNothing to do.');
        await pool.end();
        return;
    }

    for (const f of pending) {
        const full = fs.readFileSync(path.join(DIR, f), 'utf8');
        const up = full.split(/^-- ── DOWN/m)[0];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(up);
            await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [f]);
            await client.query('COMMIT');
            console.log('✅ applied', f);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('❌ failed', f, '-', e.message, '(rolled back)');
            process.exitCode = 1;
            break;
        } finally {
            client.release();
        }
    }
    await pool.end();
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
