/**
 * READ-ONLY. Runs the client's real option-cleaning and answer-resolution code over the question bank and reports rows that
 * would print wrongly. Nothing is written anywhere.
 *
 *   node scripts/question_bank_render_check.js [--limit 4000] [--db phy_12] [--samples 3]
 *
 * Checks, per question with options:
 *   LOST_DIGIT      cleaning an option removed a digit that belongs to its value ("1.5 m" -> "5 m")
 *   KEY_NOT_OPTION  the correct_option letter points at an option that does not exist or is empty
 *   KEY_DISAGREES   correct_option and the answer text point at different options
 *   LABEL_MISMATCH  the printed key label, the key code and the ticked option are not the same option
 */
const path = require('path');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const { DB_CONFIGS, pools } = require('../config/subjectDatabases');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const LIMIT = Number(arg('--limit', '4000'));
const ONLY = arg('--db', '');
const SAMPLES = Number(arg('--samples', '3'));

(async () => {
    const S = await import(pathToFileURL(path.resolve(__dirname, '../../client/src/utils/sanitize.js')).href);
    const totals = {};
    let rowsTotal = 0;
    for (const [key, cfg] of Object.entries(DB_CONFIGS)) {
        if (ONLY && key !== ONLY) continue;
        const entry = pools.get(key);
        if (!entry) { console.log(`${key}: not configured`); continue; }
        const res = await entry.pool.query(`SELECT * FROM public.questions WHERE opt_a IS NOT NULL ORDER BY id LIMIT ${LIMIT}`);
        const counts = {}; const samples = {};
        const flag = (code, row, note) => { counts[code] = (counts[code] || 0) + 1; totals[code] = (totals[code] || 0) + 1; (samples[code] = samples[code] || []).length < SAMPLES && samples[code].push(`${row.id}${note ? ' ' + note : ''}`); };
        for (const row of res.rows) {
            const options = [row.opt_a, row.opt_b, row.opt_c, row.opt_d].filter(o => o != null);
            const q = { options, correct_option: row.correct_option, answer: row.answer, classes: ['NEET'] };
            // digits of a value must survive cleaning
            for (const o of options) {
                const cleaned = S.cleanOptionText(o);
                const lead = /^\s*([1-4])\.([0-9])/.exec(String(o));
                if (lead && !String(cleaned).trimStart().startsWith(lead[1] + '.' + lead[2])) { flag('LOST_DIGIT', row, JSON.stringify(String(o).slice(0, 24)) + ' -> ' + JSON.stringify(String(cleaned).slice(0, 24))); break; }
            }
            const letter = String(row.correct_option || '').trim().toUpperCase();
            if (/^[A-D]$/.test(letter)) {
                const idx = letter.charCodeAt(0) - 65;
                if (!options[idx] || !String(options[idx]).trim()) { flag('KEY_NOT_OPTION', row, `letter ${letter}`); continue; }
                const byText = S.parseAnswerIndices(row.answer, options);
                if (row.answer && byText.length === 1 && byText[0] !== idx && String(row.answer).trim().length > 4) flag('KEY_DISAGREES', row, `letter ${letter} vs answer text index ${byText[0]}`);
                const ticked = [0, 1, 2, 3].filter(i => S.isOptionCorrect(q, i));
                const code = S.getResolvedAnswerCode(q);
                const label = S.getResolvedAnswerLabel(q);
                if (ticked.length !== 1 || ticked[0] !== idx || code !== label) flag('LABEL_MISMATCH', row, `idx ${idx} ticked ${ticked} code ${code} label ${label}`);
            }
        }
        rowsTotal += res.rows.length;
        console.log(`\n== ${cfg.name} (${key}): ${res.rows.length} questions checked`);
        for (const [c, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${c}   e.g. ${samples[c].join(' | ')}`);
        if (!Object.keys(counts).length) console.log('   no problems found');
    }
    console.log(`\nTOTAL: ${rowsTotal} questions checked.`, Object.keys(totals).length ? JSON.stringify(totals) : 'No problems found.');
    for (const e of pools.values()) { try { await e.pool.end(); } catch { /* closed */ } }
})().catch(err => { console.error('Failed:', err.message); process.exit(1); });
