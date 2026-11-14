/**
 * READ-ONLY. Run it after every bulk import of questions (and whenever the maths/rendering code changes):
 *
 *   npm run check:bank            (all subject banks)
 *   node scripts/question_bank_math_check.js --db phy_12
 *
 * It renders every maths snippet in the bank with KaTeX the way the client does, and checks that
 *   1. every tag and attribute KaTeX produces is allowed by the client's sanitiser (a dropped attribute made every square
 *      root vanish once), and
 *   2. the snippet parses (after the client's own normalisation),
 * then maps every question the way the paper builder does and counts the structural problems per question type.
 * Nothing is written. Exit code 1 means a rendering problem that needs fixing in the code; data problems only print counts.
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const { DB_CONFIGS, pools } = require('../config/subjectDatabases');
const { mapSupabaseToQuestion } = require('../services/supabaseQuestions');
const katex = require('katex');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ONLY = arg('--db', '');

const clientSrc = path.resolve(__dirname, '../../client/src');
const rendererSource = fs.readFileSync(path.join(clientSrc, 'components/MathRenderer.jsx'), 'utf8');
const list = (name) => new Set([...(rendererSource.match(new RegExp(name + ':\\s*\\[([\\s\\S]*?)\\]'))[1]).matchAll(/'([^']+)'/g)].map(m => m[1].toLowerCase()));

(async () => {
    const { normalizeEquation } = await import(pathToFileURL(path.join(clientSrc, 'utils/mathNormalize.js')).href);
    const TAGS = list('ALLOWED_TAGS');
    const ATTRS = list('ALLOWED_ATTR');

    const snippets = new Map();
    const issues = {}; const samples = {}; const byType = {};
    const bad = (k, s) => { issues[k] = (issues[k] || 0) + 1; (samples[k] = samples[k] || []); if (samples[k].length < 3) samples[k].push(s); };
    const addMath = (text, where) => {
        if (!text || typeof text !== 'string') return;
        for (const m of text.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g)) {
            const s = (m[1] || m[2] || '').trim();
            if (s && !snippets.has(s)) snippets.set(s, where);
        }
    };

    let rows = 0;
    for (const key of Object.keys(DB_CONFIGS)) {
        if (ONLY && key !== ONLY) continue;
        const entry = pools.get(key);
        if (!entry) { console.log(`${key}: not configured, skipped`); continue; }
        let res;
        try { res = (await entry.pool.query('SELECT * FROM public.questions')).rows; } catch (e) { console.log(`${key}: cannot read (${e.message}), skipped`); continue; }
        for (const row of res) {
            rows++;
            const id = `${key} ${row.id}`;
            for (const f of ['question', 'opt_a', 'opt_b', 'opt_c', 'opt_d', 'assertion', 'reason']) addMath(row[f], `${id} ${f}`);
            let q;
            try { q = mapSupabaseToQuestion(row); } catch (e) { bad('MAPPER_THROWS', `${id}: ${e.message}`); continue; }
            byType[q.type] = (byType[q.type] || 0) + 1;
            const opts = (q.options || []).map(o => String(o == null ? '' : o));
            if (q.keyProblem) bad(`flagged:${q.keyProblem}`, id);
            if (['MCQ', 'DIAGRAM_BASED', 'ASSERTION_REASON', 'STATEMENT_BASED', 'MATCH_FOLLOWING'].includes(q.type)) {
                if (opts.length < 4) bad(`${q.type}: fewer than 4 options`, id);
                if (!q.keyProblem && !q.correct_option && !q.answer) bad(`${q.type}: no key`, id);
            }
            if (q.type === 'MATCH_FOLLOWING' && opts.some(o => /Statement I/i.test(o))) bad('MATCH typed with statement options (mapper bug)', id);
            if ([q.questionText, ...opts].some(t => /\[QBP_|\[QPV_|QBP_DATA/i.test(String(t || '')))) bad('internal marker visible', id);
        }
    }

    let parseErrors = 0; let dropped = 0;
    const errKinds = {}; const dropKinds = {};
    for (const [s, where] of snippets) {
        let html;
        try { html = katex.renderToString(normalizeEquation(s), { output: 'html', throwOnError: true, strict: 'ignore' }); } catch (e) {
            parseErrors++;
            const k = String(e.message).replace(/\s+/g, ' ').replace(/at position.*/, '').slice(0, 80);
            (errKinds[k] = errKinds[k] || []).push(`${where}: ${s.slice(0, 60)}`);
            continue;
        }
        for (const t of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
            const tag = t[1].toLowerCase();
            if (!TAGS.has(tag)) { dropped++; (dropKinds[`<${tag}>`] = dropKinds[`<${tag}>`] || []).push(where); }
            for (const a of t[2].matchAll(/\s([A-Za-z:-]+)=/g)) {
                const at = a[1].toLowerCase();
                if (!ATTRS.has(at)) { dropped++; (dropKinds[`${tag}@${at}`] = dropKinds[`${tag}@${at}`] || []).push(where); }
            }
        }
    }

    console.log(`\nQuestions: ${rows}   distinct maths snippets: ${snippets.size}`);
    console.log('By type:', JSON.stringify(byType));
    console.log(`\nMaths that does not parse: ${parseErrors} (these fall back to plain text on the paper; fix the source text)`);
    for (const [k, v] of Object.entries(errKinds).sort((a, b) => b[1].length - a[1].length).slice(0, 8)) console.log(`  ${v.length}x ${k}  e.g. ${v[0]}`);
    console.log(`\nSanitiser would drop ${dropped} tags/attributes KaTeX needs (must be 0)`);
    for (const [k, v] of Object.entries(dropKinds)) console.log(`  ${v.length}x ${k}  e.g. ${v[0]}`);
    console.log('\nStructure / data problems (flagged rows are kept out of generated papers):');
    for (const [k, v] of Object.entries(issues).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(6)}  ${k}   e.g. ${samples[k][0]}`);

    const codeProblems = dropped + (issues.MAPPER_THROWS || 0) + (issues['MATCH typed with statement options (mapper bug)'] || 0) + (issues['internal marker visible'] || 0);
    console.log(codeProblems ? `\nFAIL: ${codeProblems} rendering/code problem(s) above.` : '\nOK: nothing the code needs to fix.');
    process.exit(codeProblems ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
