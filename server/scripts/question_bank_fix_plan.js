/**
 * READ-ONLY. Produces a CSV of PROPOSED corrections for the subject question banks; it never updates a row.
 *
 *   node scripts/question_bank_fix_plan.js --csv plan.csv [--db phy_12]
 *
 * Columns: database, question_id, issue, action (SET = concrete proposal, REVIEW = a person decides), field, current,
 * proposed, confidence, note. Review the SET rows; applying them is a separate, explicitly approved step.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const { DB_CONFIGS, pools } = require('../config/subjectDatabases');
const { proposeFixes } = require('../services/questionFixPlan');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const CSV = arg('--csv', '');
const ONLY = arg('--db', '');
const BATCH = 2000;
const esc = v => `"${String(v).replace(/"/g, '""')}"`;

(async () => {
    if (!CSV) { console.error('Pass --csv <file> for the plan.'); process.exit(2); }
    const rows = [['database', 'question_id', 'issue', 'action', 'field', 'current', 'proposed', 'confidence', 'note']];
    const tally = {};
    for (const [key, cfg] of Object.entries(DB_CONFIGS)) {
        if (ONLY && key !== ONLY) continue;
        const entry = pools.get(key);
        if (!entry || !entry.pool) { console.log(`${key}: not configured - skipped`); continue; }
        const seen = new Set();
        let last = null;
        for (;;) {
            const res = last === null
                ? await entry.pool.query(`SELECT * FROM public.questions ORDER BY id LIMIT ${BATCH}`)
                : await entry.pool.query(`SELECT * FROM public.questions WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, [last]);
            if (!res.rows.length) break;
            for (const row of res.rows) {
                for (const f of proposeFixes(row, seen)) {
                    rows.push([key, row.id, f.issue, f.action, f.field, f.current, f.proposed, f.confidence, f.note]);
                    const t = `${f.issue}/${f.action}`;
                    tally[t] = (tally[t] || 0) + 1;
                }
            }
            last = res.rows[res.rows.length - 1].id;
            if (res.rows.length < BATCH) break;
        }
        console.log(`${cfg.name}: done`);
    }
    fs.writeFileSync(CSV, rows.map(r => r.map(esc).join(',')).join('\n') + '\n');
    console.log(`\nWrote ${rows.length - 1} proposed items to ${CSV} (nothing in any database was changed):`);
    for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${k}`);
    for (const e of pools.values()) { try { await e.pool.end(); } catch { /* closed */ } }
})().catch(e => { console.error('Plan failed:', e.message); process.exit(1); });
