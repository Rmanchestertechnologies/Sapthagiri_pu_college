/**
 * Applies (or undoes) a reviewed list of maths-typing repairs to the subject banks.
 *
 *   node scripts/question_bank_maths_repair.js <plan.json> --backup <backup.json>            dry run: checks every row, writes nothing
 *   node scripts/question_bank_maths_repair.js <plan.json> --backup <backup.json> --apply    backs up every row first, then writes
 *   node scripts/question_bank_maths_repair.js <plan.json> --backup <backup.json> --undo     puts the backed-up text back
 *
 * plan.json: { plan: [{ db, id, updated_at, changes: [{ field, before, after }] }] }
 * Safety: a row is written only if it has not been edited since the plan was made (updated_at and every "before" text
 * still match) and the safe write path (fixQuestionFields) would store exactly the reviewed text. Each write is read back.
 */
const path = require('path'); const fs = require('fs');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env'), quiet: true });
const { pools } = require('../config/subjectDatabases');
const { fixQuestionFields, cleanDifficultyTags } = require('../services/supabaseQuestions');
const { sanitizeHtml } = require('../utils/sanitize');

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const planFile = process.argv[2];
const backupFile = arg('--backup');
const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');
const EDITOR = 'Maths typing repair (reviewed)';

const markers = (s) => (String(s || '').match(/\[QBP_(?:TYPE|DATA|DIFFICULTY):[^\]\r\n]*\]/gi) || []);
/** What fixQuestionFields would store for this field (same steps as buildFixUpdate). */
function stored(field, value, currentSolution) {
    const v = sanitizeHtml(String(value));
    if (field === 'solution_text') return [cleanDifficultyTags(v).trim(), ...markers(currentSolution)].filter(Boolean).join('\n');
    return v;
}
const same = (field, a, b) => (field === 'solution_text' ? String(a).trim() === String(b).trim() : a === b);

(async () => {
    if (!planFile || !backupFile) { console.log('usage: <plan.json> --backup <backup.json> [--apply | --undo]'); process.exit(2); }
    const { plan } = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    const read = async (db, id) => (await pools.get(db).pool.query('SELECT * FROM public.questions WHERE id = $1', [id])).rows[0];

    if (UNDO) {
        const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        let restored = 0;
        for (const p of plan) {
            const orig = backup.rows.find(r => r.db === p.db && r.row.id === p.id);
            const cur = await read(p.db, p.id);
            if (!orig || !cur) { console.log('SKIP (missing)', p.db, p.id); continue; }
            const fields = {};
            for (const c of p.changes) { if (same(c.field, cur[c.field], stored(c.field, c.after, cur.solution_text))) fields[c.field] = orig.row[c.field]; else console.log('SKIP field edited since repair', p.db, p.id, c.field); }
            if (Object.keys(fields).length) { await fixQuestionFields(p.id, fields, null, `${EDITOR} - undone`); restored++; }
        }
        console.log('restored', restored, 'questions');
        process.exit(0);
    }

    // 1. check every row
    const ready = []; const skipped = [];
    for (const p of plan) {
        const cur = await read(p.db, p.id);
        if (!cur) { skipped.push([p, 'question no longer exists']); continue; }
        if (String(new Date(cur.updated_at).toISOString()) !== String(new Date(p.updated_at).toISOString())) { skipped.push([p, 'edited since the plan was made']); continue; }
        const bad = p.changes.find(c => cur[c.field] !== c.before);
        if (bad) { skipped.push([p, `${bad.field} changed since the plan`]); continue; }
        const altered = p.changes.find(c => !same(c.field, stored(c.field, c.after, cur.solution_text), c.after));
        if (altered) { skipped.push([p, `${altered.field} would not be stored exactly as reviewed`]); continue; }
        ready.push({ p, cur });
    }
    console.log(`ready: ${ready.length}   skipped: ${skipped.length}`);
    for (const [p, why] of skipped) console.log('  SKIP', p.db, p.id, '-', why);
    if (!APPLY) { console.log('dry run: nothing written (add --apply)'); process.exit(0); }

    // 2. back up every row that will change, before any write
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), note: 'Full rows before the maths typing repair. Undo: --undo', rows: ready.map(({ p, cur }) => ({ db: p.db, row: cur })) }, null, 1));
    const check = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    if (check.rows.length !== ready.length) { console.log('backup could not be verified; nothing written'); process.exit(1); }
    console.log('backup written:', backupFile, `(${check.rows.length} rows)`);

    // 3. write through the safe path and read each one back
    let ok = 0;
    for (const { p } of ready) {
        const fields = Object.fromEntries(p.changes.map(c => [c.field, c.after]));
        try {
            await fixQuestionFields(p.id, fields, null, EDITOR);
            const after = await read(p.db, p.id);
            const wrong = p.changes.find(c => !same(c.field, after[c.field], c.after));
            if (wrong) console.log('  CHECK FAILED', p.db, p.id, wrong.field); else ok++;
        } catch (e) { console.log('  WRITE FAILED', p.db, p.id, e.message); }
    }
    console.log(`written and read back correctly: ${ok} of ${ready.length}`);
    process.exit(ok === ready.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
