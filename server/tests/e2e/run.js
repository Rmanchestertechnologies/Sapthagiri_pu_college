/**
 * End-to-end test runner:  npm run test:e2e
 *
 * Starts a throw-away in-memory PostgreSQL (PGlite) on a local port, builds the schema with scripts/init_db.js, seeds three test
 * students, starts the REAL API server against it, runs tests/e2e/checks.js (about 80 checks through HTTP: logins, exam
 * creation, the student exam flow, scoring, rate limits, merge, OMR scan job, ...) and shuts everything down.
 *
 * It never touches a real application database. It does need the eight READ-ONLY subject question database URLs
 * (DB_*_11_URL / DB_*_12_URL) in server/.env, because the checks generate papers from the real question bank.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER = path.resolve(__dirname, '../..');
const DB_PORT = 54329;
const SERVE = process.argv.includes('--serve');   // keep running for manual work (UI review) instead of running the checks
const API_PORT = SERVE ? 5000 : 5070;              // 5000 is what `npm run dev` in client/ proxies to

function questionDbUrls() {
    const out = {};
    const envPath = path.join(SERVER, '.env');
    if (!fs.existsSync(envPath)) return out;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = /^(DB_(?:MATH|CHEM|BIO|PHY)_(?:11|12)_URL)=(.*)$/.exec(line.trim());
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
}

function runNode(args, env, cwd) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
        child.on('exit', code => resolve(code ?? 1));
    });
}

async function waitForHealth(timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        try {
            const r = await fetch(`http://127.0.0.1:${API_PORT}/api/health`);
            if (r.ok) return true;
        } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

(async () => {
    const dbUrls = questionDbUrls();
    if (Object.keys(dbUrls).length < 8) {
        console.error('server/.env must contain the eight DB_*_URL question database addresses (read-only use). Found ' + Object.keys(dbUrls).length + '.');
        process.exit(2);
    }

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpg-e2e-'));
    const baseEnv = {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
        DB_SSL: 'off',
        DB_POOL_MAX: '1',          // the in-memory database serves one connection at a time
        DB_POOL_IDLE_MS: '0',
        JWT_SECRET: 'local-test-jwt-secret',
        ADMIN_PASSWORD: 'local-test-admin-pass',
        LAB_ID: 'TESTLAB',
        LAB_PASSWORD: 'local-test-lab-pass',
        ALLOWED_ORIGINS: '',
        SEED_FACULTY_PASSWORD: 'local-test-faculty-pass'
    };
    // An environment file that contains ONLY the test values: nothing from the real server/.env can leak in.
    const envFile = path.join(workDir, 'env.test');
    fs.writeFileSync(envFile, Object.entries(baseEnv).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    const childEnv = {
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
        ...baseEnv, ...dbUrls, ENV_FILE: envFile
    };

    const { PGlite } = await import('@electric-sql/pglite');
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
    const db = await PGlite.create();
    const dbServer = new PGLiteSocketServer({ db, port: DB_PORT, host: '127.0.0.1' });
    await dbServer.start();
    console.log(`[e2e] throw-away database on 127.0.0.1:${DB_PORT}`);

    let apiChild = null;
    let exitCode = 1;
    try {
        if (await runNode([path.join(SERVER, 'scripts/init_db.js')], childEnv, workDir) !== 0) throw new Error('schema setup failed');

        // test students; the users table loses omr_access to mimic a database that has not had migration 002 yet
        await db.exec(`
            INSERT INTO public.students (name, roll_number, section, email, enrollment_no, sats_no, class_level) VALUES
              ('Test Student One','T001','II-PUC A','','T001','SATS001','II-PUC'),
              ('Test Student Two','T002','II-PUC A','','T002','SATS002','II-PUC'),
              ('Test Student Three','T003','II-PUC B','','T003','SATS003','II-PUC')
            ON CONFLICT DO NOTHING;
            ALTER TABLE public.users DROP COLUMN IF EXISTS omr_access;
        `);

        apiChild = spawn(process.execPath, [path.join(SERVER, 'index.js')], { cwd: workDir, env: childEnv, stdio: 'inherit' });
        if (!await waitForHealth(60000)) throw new Error('the API server did not become healthy');
        console.log('[e2e] API server is up; running checks');

        if (SERVE) {
            console.log('[sandbox] Ready. API on http://127.0.0.1:' + API_PORT + '  (throw-away database, nothing real is touched)');
            console.log('[sandbox] Start the site with:  npm --prefix client run dev   then open http://localhost:5173');
            console.log('[sandbox] Admin: sapthagiripucollegedvg@gmail.com / local-test-admin-pass');
            console.log('[sandbox] Teachers: physics@gmail.com, chemistry@gmail.com ... / local-test-faculty-pass');
            console.log('[sandbox] Students (lab portal): T001, T002, T003   Lab login: TESTLAB / local-test-lab-pass');
            console.log('[sandbox] Press Ctrl+C to stop.');
            await new Promise(resolve => { process.on('SIGINT', resolve); process.on('SIGTERM', resolve); });
            exitCode = 0;
        } else {
            exitCode = await runNode([path.join(__dirname, 'checks.js')], { ...childEnv, E2E_BASE: `http://127.0.0.1:${API_PORT}` }, SERVER);
        }
    } catch (err) {
        console.error('[e2e] setup error:', err.message);
    } finally {
        if (apiChild) apiChild.kill();
        try { await dbServer.stop(); } catch { /* already stopped */ }
        try { await db.close(); } catch { /* already closed */ }
        fs.rmSync(workDir, { recursive: true, force: true });
    }
    process.exit(exitCode);
})();
