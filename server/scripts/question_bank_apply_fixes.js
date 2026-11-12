/**
 * Applies a REVIEWED question-bank fix plan. Dry run by default: it only lists what it would change.
 *
 *   node scripts/question_bank_apply_fixes.js --plan reviewed.csv                 # dry run
 *   node scripts/question_bank_apply_fixes.js --plan reviewed.csv --apply         # change the rows
 *   node scripts/question_bank_apply_fixes.js --rollback questions_fix_backup_20261112   # undo one run (needs --db key)
 *
 * Safety:
 *  - Only `SET correct_option` items (A-D) are ever applied; everything else in the plan is ignored.
 *  - A row is changed only if its current correct_option still equals the plan's `current` value and the chosen option exists.
 *  - Before the first change, the old values are copied into public.questions_fix_backup_<date> in the same database, inside
 *    one transaction per database; --rollback restores them.
 *  - Take a database backup (Supabase dashboard) before using --apply on production.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const { DB_CONFIGS, pools } = require('../config/subjectDatabases');
const { readPlan, applicableItems, checkAgainstRow } = require('../services/questionFixApply');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes('--apply');
const PLAN = arg('--plan', '');
const ROLLBACK = arg('--rollback', '');
const ONLY = arg('--db', '');

function stamp() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }

(async () => {
    if (ROLLBACK) {
        if (!ONLY) { console.error('--rollback needs --db <key> (e.g. phy_12).'); process.exit(2); }
        if (!/^questions_fix_backup_\d{8}$/.test(ROLLBACK)) { console.error('Backup table name must look like questions_fix_backup_YYYYMMDD.'); process.exit(2); }
        const entry = pools.get(ONLY);
        if (!entry) { console.error(`${ONLY}: not configured.`); process.exit(2); }
        const client = await entry.pool.connect();
        try {
            await client.query('BEGIN');
            const r = await client.query(`UPDATE public.questions q SET correct_option = b.old_correct_option FROM public.${ROLLBACK} b WHERE q.id = b.id`);
            await client.query('COMMIT');
            console.log(`${ONLY}: restored ${r.rowCount} row(s) from ${ROLLBACK}.`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Rollback failed, nothing changed:', err.message);
            process.exitCode = 1;
        } finally { client.release(); }
        for (const e of pools.values()) { try { await e.pool.end(); } catch { /* closed */ } }
        return;
    }

    if (!PLAN) { console.error('Pass --plan <reviewed.csv>.'); process.exit(2); }
    const items = applicableItems(readPlan(fs.readFileSync(PLAN, 'utf8')));
    console.log(`${items.length} applicable item(s) in the plan (only "SET correct_option" items count).`);
    const byDb = {};
    for (const it of items) (byDb[it.database] = byDb[it.database] || []).push(it);

    for (const [key, list] of Object.entries(byDb)) {
        if (ONLY && key !== ONLY) continue;
        const entry = pools.get(key);
        if (!entry || !DB_CONFIGS[key]) { console.log(`${key}: not configured, skipped.`); continue; }
        const client = await entry.pool.connect();
        try {
            const okItems = [];
            for (const it of list) {
                const res = await client.query('SELECT * FROM public.questions WHERE id = $1', [it.question_id]);
                const verdict = checkAgainstRow(it, res.rows[0]);
                if (verdict.ok) okItems.push(it);
                else console.log(`  skip ${key} ${it.question_id}: ${verdict.reason}`);
            }
            console.log(`${key}: ${okItems.length} of ${list.length} can be applied.`);
            if (!APPLY || okItems.length === 0) continue;

            const backup = `questions_fix_backup_${stamp()}`;
            await client.query('BEGIN');
            await client.query(`CREATE TABLE IF NOT EXISTS public.${backup} (id text PRIMARY KEY, old_correct_option text, saved_at timestamptz DEFAULT now())`);
            for (const it of okItems) {
                await client.query(
                    `INSERT INTO public.${backup} (id, old_correct_option) SELECT id::text, correct_option FROM public.questions WHERE id = $1 ON CONFLICT (id) DO NOTHING`,
                    [it.question_id]
                );
                await client.query('UPDATE public.questions SET correct_option = $1 WHERE id = $2 AND correct_option IS NOT DISTINCT FROM $3',
                    [it.proposed.trim(), it.question_id, it.current === '' ? null : it.current]);
            }
            await client.query('COMMIT');
            console.log(`${key}: applied ${okItems.length}. Old values saved in public.${backup} (undo: --rollback ${backup} --db ${key}).`);
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch { /* no open transaction */ }
            console.error(`${key}: failed, nothing was changed:`, err.message);
            process.exitCode = 1;
        } finally { client.release(); }
    }
    if (!APPLY) console.log('\nDry run only. Add --apply to change the rows (after taking a database backup).');
    for (const e of pools.values()) { try { await e.pool.end(); } catch { /* closed */ } }
})().catch(err => { console.error('Failed:', err.message); process.exit(1); });
