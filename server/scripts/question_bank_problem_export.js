/**
 * READ-ONLY. Lists every question that cannot print correctly, with its id, so teachers can fix the rows in the bank.
 *
 *   node scripts/question_bank_problem_export.js [--out ../docs/data/question_bank_problems.csv] [--db phy_12]
 *
 * Two kinds of rows:
 *   RENDER   a part of the question does not print cleanly (maths cut off / unpaired $ / empty equation ...)
 *   FLAGGED  the question is kept out of generated papers (identical options, key points at nothing, incomplete A/R ...)
 * The file opens in Excel (UTF-8 with BOM). Nothing is written to the database.
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const { DB_CONFIGS, pools } = require('../config/subjectDatabases');
const { mapSupabaseToQuestion } = require('../services/supabaseQuestions');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ONLY = arg('--db', '');
const OUT = path.resolve(process.cwd(), arg('--out', path.resolve(__dirname, '../../docs/data/question_bank_problems.csv')));
const clientSrc = path.resolve(__dirname, '../../client/src');

const WHAT = {
    DUPLICATE_OPTIONS: 'Two or more options read exactly the same',
    AR_INCOMPLETE: 'Assertion-reason question: the Reason (or Assertion) is missing',
    KEY_NOT_AN_OPTION: 'The marked answer is a value that matches none of the options',
    KEY_EMPTY_OPTION: 'The marked answer points at an empty option',
    OPTION_GAP: 'An option is missing between two others',
    MATCH_KEY_UNKNOWN: 'Match question: only a letter key and no options, so the right match is unknown',
    NUMERICAL_NO_ANSWER: 'Numerical question has no answer',
    DIAGRAM_MISSING: 'Needs a diagram that was never added ("[DIAGRAM REQUIRED]")',
};

const stripKatex = (html) => {
    let out = ''; let i = 0;
    while (i < html.length) {
        const k = html.indexOf('<span class="katex', i);
        if (k < 0) { out += html.slice(i); break; }
        out += html.slice(i, k);
        let depth = 0; let j = html.length;
        const re = /<span\b|<\/span>/g; re.lastIndex = k;
        let m;
        while ((m = re.exec(html)) !== null) { depth += m[0] === '</span>' ? -1 : 1; if (depth === 0) { j = re.lastIndex; break; } }
        i = j;
    }
    return out;
};
const csv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

(async () => {
    const P = await import(pathToFileURL(path.join(clientSrc, 'utils/mathPipeline.js')).href);
    const L = await import(pathToFileURL(path.join(clientSrc, 'components/question/layout.js')).href);
    const PA = await import(pathToFileURL(path.join(clientSrc, 'components/question/parsing.js')).href);
    const lines = [['kind', 'database', 'question_id', 'subject', 'class', 'chapter', 'problem', 'part', 'text_of_that_part', 'question_start'].map(csv).join(',')];
    let render = 0; let flagged = 0;
    for (const key of Object.keys(DB_CONFIGS)) {
        if (ONLY && key !== ONLY) continue;
        const entry = pools.get(key);
        if (!entry) continue;
        let rows; try { rows = (await entry.pool.query('SELECT * FROM public.questions')).rows; } catch { continue; }
        for (const row of rows) {
            let q; try { q = mapSupabaseToQuestion(row); } catch { continue; }
            const meta = [key, row.id, row.subject || '', row.klass || '', row.chapter || ''];
            const start = String(row.question || '').slice(0, 120);
            if (q.keyProblem) {
                flagged++;
                lines.push(['FLAGGED', ...meta, WHAT[q.keyProblem] || q.keyProblem, '', '', start].map(csv).join(','));
            }
            const found = [];
            const check = (part, raw) => {
                if (raw == null || String(raw).trim() === '') return;
                const html = P.processMathOnly(String(raw));
                const visible = stripKatex(html).replace(/<[^>]+>/g, ' ');
                if (html.includes('katex-error') || html.includes('inline-math font-medium')) found.push(['The equation cannot be typeset (cut off, unbalanced braces or an unknown command) and prints as plain text', part, raw]);
                else if (/\$|\\[a-zA-Z]{2,}|[A-Za-z0-9]_\{|\^\{|\\\\/.test(visible)) found.push(['Raw LaTeX / a stray $ is left on the paper (an unpaired $ or a cut-off equation)', part, raw]);
            };
            check('question', PA.cleanQuestionText(q.questionText));
            (q.options || []).forEach((o, i) => check(`option ${i + 1}`, L.cleanOptionText(String(o))));
            if (q.type === 'STATEMENT_BASED') (q.statements || []).forEach((s, i) => check(`statement ${i + 1}`, s.text));
            if (q.type === 'ASSERTION_REASON') { check('assertion', q.assertion); check('reason', q.reason); }
            if (q.type === 'MATCH_FOLLOWING') { (q.columnA || []).forEach((c, i) => check(`column I item ${i + 1}`, c)); (q.columnB || []).forEach((c, i) => check(`column II item ${i + 1}`, c)); }
            check('solution', q.solutionText);
            const seen = new Set();
            for (const [problem, part, raw] of found) {
                const k = part.replace(/ \d+$/, '') + problem;
                if (seen.has(k)) continue; seen.add(k);
                render++;
                lines.push(['RENDER', ...meta, problem, part, String(raw).slice(0, 160), start].map(csv).join(','));
            }
        }
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
    console.log(`Written ${OUT}`);
    console.log(`RENDER rows: ${render}   FLAGGED rows: ${flagged}   (a question can appear in both)`);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
