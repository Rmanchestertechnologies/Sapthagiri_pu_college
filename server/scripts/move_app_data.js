/**
 * Moves the application's OWN tables (users, papers, exams, sessions, students, results ...) from the current primary database
 * into a new, separate database, so the question databases hold questions only.
 *
 *   node scripts/move_app_data.js            # DRY RUN: connects, lists tables and row counts, changes nothing
 *   node scripts/move_app_data.js --apply    # builds the schema in the new database and copies the rows
 *
 * Environment (server/.env):
 *   DATABASE_URL      the current primary database (the SOURCE; it is only ever READ)
 *   NEW_DATABASE_URL  the new, empty database (the TARGET)
 *
 * Options: --tables=users,papers   copy only these tables      --allow-nonempty   target may already contain rows
 *          --reset-target           first drop the application tables (and the migration record) that already exist in the TARGET,
 *                                   e.g. left over from an earlier attempt. Only ever touches the target.
 *
 * What it never does: it never writes to, alters or deletes anything in the source; it never copies the question tables
 * (`questions`) or any table that is not on the application list below. Copying is repeatable: rows that already exist in the
 * target are skipped (ON CONFLICT DO NOTHING), so running it again after a failure is safe.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });

// Tables that belong to the application. Anything else in the source database (the question bank in particular) stays put.
const APP_TABLES = [
    'users', 'students', 'templates', 'papers', 'online_exams', 'exam_sessions', 'exam_blueprints', 'notifications',
    'bridge_keys', 'audit_logs', 'omr_submissions', 'grand_test_papers', 'grand_test_questions',
    'previous_year_papers', 'previous_year_questions', 'question_usage'
];

const APPLY = process.argv.includes('--apply');
const ALLOW_NONEMPTY = process.argv.includes('--allow-nonempty');
const RESET_TARGET = process.argv.includes('--reset-target');
const only = (process.argv.find(a => a.startsWith('--tables=')) || '').replace('--tables=', '').split(',').map(s => s.trim()).filter(Boolean);
const SOURCE = process.env.DATABASE_URL;
const TARGET = process.env.NEW_DATABASE_URL;

function describe(url) {
    try { const u = new URL(url); return `${u.hostname}${u.pathname}`; } catch { return '(unreadable address)'; }
}
function sameDatabase(a, b) {
    try {
        const x = new URL(a), y = new URL(b);
        return x.hostname === y.hostname && x.port === y.port && x.pathname === y.pathname && decodeURIComponent(x.username) === decodeURIComponent(y.username);
    } catch { return false; }
}
function sslOption() {
    if (process.env.DB_SSL === 'off' && process.env.NODE_ENV !== 'production') return false;
    return { rejectUnauthorized: false };
}
const quote = id => '"' + String(id).replace(/"/g, '""') + '"';

async function connect(url, label) {
    const client = new Client({ connectionString: url, ssl: sslOption(), connectionTimeoutMillis: 15000 });
    try { await client.connect(); } catch (err) { throw new Error(`Cannot connect to the ${label} database (${describe(url)}): ${err.message}`); }
    return client;
}

async function listTables(client) {
    const r = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
    return r.rows.map(x => x.table_name);
}
async function countRows(client, table) {
    return Number((await client.query(`SELECT count(*)::bigint AS n FROM public.${quote(table)}`)).rows[0].n);
}
async function columnsOf(client, table) {
    const r = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table]);
    return r.rows;
}

/**
 * Rebuilds the source tables in the target with the SAME columns, types, defaults, keys and indexes, read from the source's
 * catalog. The setup script cannot be used for this: the live database's layout (for example uuid ids) is not the one the
 * setup script creates, and the application has always run against the live layout.
 */
const SEQ_IN_DEFAULT = /nextval\('(?:public\.)?"?([A-Za-z0-9_]+)"?'::regclass\)/;

async function cloneSchema(src, tgt, tables, targetRows) {
    const created = [];
    for (const t of tables) {
        const exists = (await tgt.query('SELECT to_regclass($1) AS r', [`public.${quote(t)}`])).rows[0].r;
        if (exists && (targetRows[t] || 0) > 0) continue;                       // keep a table that already holds data (--allow-nonempty)
        if (exists) await tgt.query(`DROP TABLE public.${quote(t)} CASCADE`);   // an empty table, e.g. left by an earlier failed run
        const cols = (await src.query(`
            SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull,
                   pg_get_expr(d.adbin, d.adrelid) AS dflt
            FROM pg_attribute a
            LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
            ORDER BY a.attnum`, [`public.${quote(t)}`])).rows;
        // sequences used by defaults must exist before the table
        for (const col of cols) {
            const m = col.dflt && SEQ_IN_DEFAULT.exec(col.dflt);
            if (m) await tgt.query(`CREATE SEQUENCE IF NOT EXISTS public.${quote(m[1])}`);
        }
        const defs = cols.map(col => `${quote(col.name)} ${col.type}${col.dflt ? ' DEFAULT ' + col.dflt : ''}${col.notnull ? ' NOT NULL' : ''}`);
        const cons = (await src.query("SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass AND contype IN ('p','u','c') ORDER BY contype DESC, conname", [`public.${quote(t)}`])).rows;
        for (const k of cons) defs.push(`CONSTRAINT ${quote(k.conname)} ${k.def}`);
        await tgt.query(`CREATE TABLE public.${quote(t)} (\n  ${defs.join(',\n  ')}\n)`);
        // indexes that do not back a constraint
        const idx = (await src.query("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE conrelid = $2::regclass)", [t, `public.${quote(t)}`])).rows;
        for (const i of idx) await tgt.query(i.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS '));
        created.push(t);
    }
    // foreign keys, only between tables that are all being copied
    for (const t of tables) {
        if (!created.includes(t)) continue;
        const fks = (await src.query("SELECT conname, pg_get_constraintdef(oid) AS def, confrelid::regclass::text AS ref FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'", [`public.${quote(t)}`])).rows;
        for (const f of fks) {
            const refName = f.ref.replace(/^public\./, '').replace(/"/g, '');
            if (!tables.includes(refName)) continue;
            try { await tgt.query(`ALTER TABLE public.${quote(t)} ADD CONSTRAINT ${quote(f.conname)} ${f.def}`); }
            catch (err) { console.log(`  (foreign key ${f.conname} on ${t} not added: ${err.message})`); }
        }
    }
    return created;
}

function runScript(script, args, envFile) {
    const res = spawnSync(process.execPath, [path.resolve(__dirname, script), ...args], {
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, ENV_FILE: envFile },
        encoding: 'utf8'
    });
    if (res.status !== 0) {
        const out = `${script} failed:\n${(res.stdout || '').slice(-800)}\n${(res.stderr || '').slice(-800)}`;
        const err = new Error(out);
        err.transient = /timeout|ECONNRESET|ETIMEDOUT|terminated/i.test(out);
        throw err;
    }
}

/** Runs a project script, trying again (up to 4 times) when the failure is only a dropped or slow connection. */
function runScriptWithRetry(script, args, envFile) {
    for (let attempt = 1; ; attempt++) {
        try { return runScript(script, args, envFile); }
        catch (err) {
            if (!err.transient || attempt >= 4) throw err;
            console.log(`  (connection problem, trying again: attempt ${attempt + 1} of 4)`);
        }
    }
}

(async () => {
    if (!SOURCE) throw new Error('DATABASE_URL (the current primary database) is not set.');
    if (!TARGET) throw new Error('NEW_DATABASE_URL (the new database) is not set. Add it to server/.env.');
    if (sameDatabase(SOURCE, TARGET)) throw new Error('NEW_DATABASE_URL points at the same database as DATABASE_URL. Nothing to move.');

    console.log(`Source (read only): ${describe(SOURCE)}`);
    console.log(`Target (new)      : ${describe(TARGET)}\n`);

    const src = await connect(SOURCE, 'source');
    const srcTables = await listTables(src);
    const wanted = (only.length ? only : APP_TABLES).filter(t => srcTables.includes(t));
    const notCopied = srcTables.filter(t => !wanted.includes(t));
    const srcCounts = {};
    for (const t of wanted) srcCounts[t] = await countRows(src, t);

    let tgt = await connect(TARGET, 'target');
    if (RESET_TARGET && APPLY) {
        // only the application tables and the migration record, only in the target
        for (const t of [...APP_TABLES, 'schema_migrations']) await tgt.query(`DROP TABLE IF EXISTS public.${quote(t)} CASCADE`);
        console.log('Reset: dropped the application tables found in the TARGET (the source was not touched).');
    }
    const tgtTables = await listTables(tgt);
    const tgtAppRows = {};
    for (const t of tgtTables.filter(x => APP_TABLES.includes(x))) tgtAppRows[t] = await countRows(tgt, t);
    await tgt.end();
    const nonEmpty = Object.entries(tgtAppRows).filter(([, n]) => n > 0);

    console.log('Tables to copy (rows in source):');
    for (const t of wanted) console.log(`  ${t.padEnd(26)} ${String(srcCounts[t]).padStart(7)}`);
    console.log(`\nLeft where they are (not copied): ${notCopied.length ? notCopied.join(', ') : '(none)'}`);
    console.log(`Target currently has ${tgtTables.length} table(s)` + (nonEmpty.length ? `, with data in: ${nonEmpty.map(([t, n]) => `${t} (${n})`).join(', ')}` : ', no application data.'));

    if (nonEmpty.length && !ALLOW_NONEMPTY) throw new Error('The target already contains application data. Use an empty database, or pass --allow-nonempty if you know why.');
    if (!APPLY) {
        console.log('\nDRY RUN: nothing was changed. Run again with --apply to build the schema and copy the rows.');
        await src.end();
        return;
    }

    // 1. schema: same layout as the source, then the project's migrations (OMR results table, OMR access column ...)
    console.log('\n1/3 Building the same tables in the new database ...');
    const tgtSchema = await connect(TARGET, 'target');
    const created = await cloneSchema(src, tgtSchema, wanted, tgtAppRows);
    await tgtSchema.end();
    console.log(`  created: ${created.join(', ') || '(none)'}`);
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'move-app-data-'));
    const envFile = path.join(work, 'target.env');
    fs.writeFileSync(envFile, [`DATABASE_URL=${TARGET}`, `NODE_ENV=${process.env.NODE_ENV || 'production'}`, process.env.DB_SSL ? `DB_SSL=${process.env.DB_SSL}` : '', 'DB_POOL_MAX=1', 'DB_POOL_IDLE_MS=0'].filter(Boolean).join('\n') + '\n');
    try {
        console.log('  applying the project migrations to the new database ...');
        runScriptWithRetry('migrate.js', ['--apply'], envFile);
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }

    // 2. rows
    console.log('2/3 Copying rows ...');
    tgt = await connect(TARGET, 'target');
    const report = [];
    for (const t of wanted) {
        const srcCols = await columnsOf(src, t);
        const tgtCols = await columnsOf(tgt, t);
        if (tgtCols.length === 0) { report.push({ t, error: 'table missing in the target after the schema step' }); continue; }
        const tgtSet = new Map(tgtCols.map(c => [c.column_name, c.data_type]));
        const cols = srcCols.filter(c => tgtSet.has(c.column_name));
        const skippedCols = srcCols.filter(c => !tgtSet.has(c.column_name)).map(c => c.column_name);
        const colList = cols.map(c => quote(c.column_name)).join(', ');
        const orderCol = cols.find(c => c.column_name === 'id') ? ' ORDER BY "id"' : '';
        let copied = 0;
        const batch = 500;
        for (let offset = 0; ; offset += batch) {
            const rows = (await src.query(`SELECT ${colList} FROM public.${quote(t)}${orderCol} LIMIT ${batch} OFFSET ${offset}`)).rows;
            if (rows.length === 0) break;
            await tgt.query('BEGIN');
            try {
                for (const row of rows) {
                    const values = cols.map(c => {
                        const v = row[c.column_name];
                        if (v !== null && v !== undefined && (tgtSet.get(c.column_name) === 'json' || tgtSet.get(c.column_name) === 'jsonb')) return JSON.stringify(v);
                        return v;
                    });
                    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
                    const r = await tgt.query(`INSERT INTO public.${quote(t)} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
                    copied += r.rowCount;
                }
                await tgt.query('COMMIT');
            } catch (err) {
                await tgt.query('ROLLBACK');
                throw new Error(`Copying ${t} failed: ${err.message}. Nothing from this batch was kept; fix the cause and run again.`);
            }
        }
        // serial columns continue after the highest copied value
        for (const c of cols) {
            const dflt = (await tgt.query('SELECT pg_get_expr(d.adbin, d.adrelid) AS e FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum WHERE a.attrelid = $1::regclass AND a.attname = $2', [`public.${quote(t)}`, c.column_name])).rows[0];
            const sm = dflt && SEQ_IN_DEFAULT.exec(dflt.e);
            const seq = sm ? `public.${quote(sm[1])}` : null;
            if (seq) await tgt.query(`SELECT setval($1, GREATEST(COALESCE((SELECT MAX(${quote(c.column_name)}) FROM public.${quote(t)}), 0), 1), (SELECT MAX(${quote(c.column_name)}) FROM public.${quote(t)}) IS NOT NULL)`, [seq]);
        }
        report.push({ t, copied, skippedCols });
        console.log(`  ${t.padEnd(26)} copied ${String(copied).padStart(6)}${skippedCols.length ? `  (columns not in the new schema, skipped: ${skippedCols.join(', ')})` : ''}`);
    }

    // 3. verify
    console.log('3/3 Checking the row counts ...');
    let bad = 0;
    for (const t of wanted) {
        const a = srcCounts[t];
        const b = await countRows(tgt, t);
        const ok = a === b;
        if (!ok) bad++;
        console.log(`  ${t.padEnd(26)} source ${String(a).padStart(6)}   new ${String(b).padStart(6)}   ${ok ? 'OK' : 'DIFFERENT'}`);
    }
    await src.end();
    await tgt.end();
    if (bad) { console.error(`\n${bad} table(s) differ. The old database was not touched; do not switch yet.`); process.exit(1); }
    console.log('\nAll tables match. The old database was not changed. Next: set DATABASE_URL (in Render and server/.env) to the new address.');
})().catch(err => { console.error('\nSTOPPED:', err.message); process.exit(1); });
