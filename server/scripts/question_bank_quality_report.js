/**
 * READ-ONLY data-quality report for the subject question banks.
 *
 *   node scripts/question_bank_quality_report.js                 # summary for every configured subject database
 *   node scripts/question_bank_quality_report.js --samples 5     # show 5 example ids per issue (default 3)
 *   node scripts/question_bank_quality_report.js --csv report.csv  # also write one row per flagged question
 *   node scripts/question_bank_quality_report.js --db phy_12     # only one database key (see config/subjectDatabases.js)
 *
 * It only runs SELECT statements, in batches, and never modifies a row. The rules live in services/questionQuality.js and are
 * deliberately conservative: a flagged question is a candidate for a person to review, not proven to be wrong.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const { DB_CONFIGS, pools } = require('../config/subjectDatabases');
const { ISSUES, checkRow } = require('../services/questionQuality');

const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SAMPLES = Math.max(0, parseInt(arg('--samples', '3'), 10) || 3);
const CSV = arg('--csv', '');
const ONLY = arg('--db', '');
const BATCH = 2000;

(async () => {
    const csvRows = [['database', 'question_id', 'issues']];
    const totals = {};
    let grandRows = 0;
    let grandFlagged = 0;

    for (const [key, cfg] of Object.entries(DB_CONFIGS)) {
        if (ONLY && key !== ONLY) continue;
        const entry = pools.get(key);
        if (!entry || !entry.pool) {
            console.log(`\n== ${cfg.name} (${key}): not configured (set ${cfg.envVar}) - skipped`);
            continue;
        }
        const seenTexts = new Set();
        const counts = {};
        const samples = {};
        let rows = 0;
        let flagged = 0;
        let lastId = null;
        try {
            for (;;) {
                const res = lastId === null
                    ? await entry.pool.query(`SELECT * FROM public.questions ORDER BY id LIMIT ${BATCH}`)
                    : await entry.pool.query(`SELECT * FROM public.questions WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, [lastId]);
                if (res.rows.length === 0) break;
                for (const row of res.rows) {
                    rows++;
                    const issues = checkRow(row, seenTexts);
                    if (issues.length) {
                        flagged++;
                        if (CSV) csvRows.push([key, row.id, issues.join('|')]);
                        for (const code of issues) {
                            counts[code] = (counts[code] || 0) + 1;
                            totals[code] = (totals[code] || 0) + 1;
                            (samples[code] = samples[code] || []).length < SAMPLES && samples[code].push(row.id);
                        }
                    }
                }
                lastId = res.rows[res.rows.length - 1].id;
                if (res.rows.length < BATCH) break;
            }
        } catch (err) {
            console.log(`\n== ${cfg.name} (${key}): could not be read - ${err.message}`);
            continue;
        }
        grandRows += rows;
        grandFlagged += flagged;
        console.log(`\n== ${cfg.name} (${key}): ${rows} questions, ${flagged} flagged (${rows ? ((flagged / rows) * 100).toFixed(1) : 0}%)`);
        for (const [code, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
            console.log(`   ${String(n).padStart(6)}  ${code} - ${ISSUES[code]}`);
            if (SAMPLES) console.log(`           e.g. ${samples[code].join(', ')}`);
        }
    }

    console.log(`\nTOTAL: ${grandRows} questions read, ${grandFlagged} flagged. (Read-only; nothing was changed.)`);
    for (const [code, n] of Object.entries(totals).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(6)}  ${code}`);
    if (CSV) {
        const esc = v => `"${String(v).replace(/"/g, '""')}"`;
        fs.writeFileSync(CSV, csvRows.map(r => r.map(esc).join(',')).join('\n') + '\n');
        console.log(`Wrote ${csvRows.length - 1} rows to ${CSV}`);
    }
    for (const entry of pools.values()) { try { await entry.pool.end(); } catch { /* already closed */ } }
})().catch(err => { console.error('Report failed:', err.message); process.exit(1); });
