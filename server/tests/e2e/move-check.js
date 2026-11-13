/**
 * Proves scripts/move_app_data.js on two throw-away in-memory databases:  npm run test:move
 * Never touches a real database.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER = path.resolve(__dirname, '../..');
const SRC_PORT = 54341, TGT_PORT = 54342;
const SRC = `postgresql://postgres:postgres@127.0.0.1:${SRC_PORT}/postgres`;
const TGT = `postgresql://postgres:postgres@127.0.0.1:${TGT_PORT}/postgres`;
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra ? '  -> ' + String(extra).slice(0, 300) : ''}`); };

// Asynchronous on purpose: the in-memory databases live in THIS process, so a blocking call would freeze them.
function node(args, env) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, { cwd: SERVER, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, ...env } });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => { stderr += d; });
        const timer = setTimeout(() => child.kill(), 120000);
        child.on('exit', status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
    });
}

(async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
    const srcDb = await PGlite.create(), tgtDb = await PGlite.create();
    const srcServer = new PGLiteSocketServer({ db: srcDb, port: SRC_PORT, host: '127.0.0.1' });
    const tgtServer = new PGLiteSocketServer({ db: tgtDb, port: TGT_PORT, host: '127.0.0.1' });
    await srcServer.start(); await tgtServer.start();

    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qpg-move-'));
    const baseEnv = { NODE_ENV: 'development', DB_SSL: 'off', DB_POOL_MAX: '1', DB_POOL_IDLE_MS: '0' };
    const srcEnvFile = path.join(work, 'src.env');
    fs.writeFileSync(srcEnvFile, `DATABASE_URL=${SRC}\nNODE_ENV=development\nDB_SSL=off\nDB_POOL_MAX=1\nDB_POOL_IDLE_MS=0\n`);
    const toolEnv = { ...baseEnv, DATABASE_URL: SRC, NEW_DATABASE_URL: TGT, ENV_FILE: path.join(work, 'tool.env') };
    fs.writeFileSync(toolEnv.ENV_FILE, '# only the process environment is used\n');

    try {
        // source: the application's schema + sample data + a stand-in for the question table
        const init = await node([path.join(SERVER, 'scripts/init_db.js')], { ENV_FILE: srcEnvFile });
        ok(init.status === 0, 'source schema built by init_db.js', init.stderr + init.stdout.slice(-300));
        // the live database keys users by uuid, unlike the setup script (integer): reproduce that
        await srcDb.exec(`
            DROP TABLE public.users CASCADE;
            CREATE TABLE public.users (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text UNIQUE NOT NULL,
                password text, role text DEFAULT 'teacher', subject text DEFAULT '', created_at timestamptz DEFAULT now());
            CREATE INDEX idx_users_role ON public.users (role);
        `);
        await srcDb.exec(`
            INSERT INTO public.users (name, email, password, role, subject) VALUES
              ('Admin One','admin1@example.com','$2a$10$x','admin',''),('Faculty A','a@example.com','$2a$10$y','teacher','Physics'),('Faculty B','b@example.com','$2a$10$z','teacher','Chemistry');
            INSERT INTO public.students (name, roll_number, section, email) VALUES ('S One','R1','II-PUC A',''),('S Two','R2','II-PUC A','');
            INSERT INTO public.exam_sessions (exam_id, student_id, roll_number, answers, score) VALUES
              ('1','R1','R1','[{"questionId":"q1","selectedOption":"B","markedForReview":false}]'::jsonb, 4),('1','R2','R2','[]'::jsonb, 0);
            CREATE TABLE public.questions (id text primary key, question text);
            INSERT INTO public.questions VALUES ('q1','a question that must stay where it is');
        `);

        // safety: same database refused
        const same = await node([path.join(SERVER, 'scripts/move_app_data.js')], { ...toolEnv, NEW_DATABASE_URL: SRC });
        ok(same.status !== 0 && /same database/.test(same.stderr + same.stdout), 'refuses to move a database onto itself');

        // dry run changes nothing
        const dry = await node([path.join(SERVER, 'scripts/move_app_data.js')], toolEnv);
        ok(dry.status === 0 && /DRY RUN/.test(dry.stdout) && /users\s+3/.test(dry.stdout), 'dry run lists the tables and row counts', dry.stdout + dry.stderr);
        ok(/not copied\): .*questions/.test(dry.stdout), 'the question table is listed as "left where it is"');
        const tgtTables = (await tgtDb.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n;
        ok(tgtTables === 0, 'dry run left the target completely empty');

        // apply
        const applied = await node([path.join(SERVER, 'scripts/move_app_data.js'), '--apply'], toolEnv);
        ok(applied.status === 0 && /All tables match/.test(applied.stdout), 'apply copies everything and the counts match', applied.stdout.slice(-600) + applied.stderr);

        const q = async (sql) => (await tgtDb.query(sql)).rows;
        ok((await q('SELECT count(*)::int n FROM public.users'))[0].n === 3, 'target has the 3 users');
        ok((await q("SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name='id'"))[0].data_type === 'uuid', 'user ids kept their uuid type (same layout as the source)');
        ok((await q("SELECT count(*)::int n FROM pg_indexes WHERE tablename='users' AND indexname='idx_users_role'"))[0].n === 1, 'indexes were cloned');
        ok((await q("SELECT answers FROM public.exam_sessions WHERE roll_number='R1'"))[0].answers[0].selectedOption === 'B', 'JSON answers survived intact');
        ok((await q("SELECT to_regclass('public.questions') AS t"))[0].t === null, 'the question table was NOT copied');
        await tgtDb.exec("INSERT INTO public.users (name, email, password, role, subject) VALUES ('New','new@example.com','x','teacher','Physics')");
        ok((await q("SELECT count(*)::int n FROM public.users WHERE email='new@example.com'"))[0].n === 1, 'a new user can be added to the target (defaults work)');
        const maxSess = (await q('SELECT max(id)::int m FROM public.exam_sessions'))[0].m;
        await tgtDb.exec("INSERT INTO public.exam_sessions (exam_id, student_id, roll_number) VALUES ('2','R9','R9')");
        ok((await q("SELECT id::int i FROM public.exam_sessions WHERE roll_number='R9'"))[0].i > maxSess, 'integer sequences continue after the copied ids');
        await tgtDb.exec("DELETE FROM public.exam_sessions WHERE roll_number='R9'");
        ok((await srcDb.query('SELECT count(*)::int n FROM public.users')).rows[0].n === 3, 'the source database is unchanged');

        // repeat: refused without the flag, harmless with it
        const again = await node([path.join(SERVER, 'scripts/move_app_data.js'), '--apply'], toolEnv);
        ok(again.status !== 0 && /already contains application data/.test(again.stderr + again.stdout), 'a second run into a filled target is refused');
        await tgtDb.exec("DELETE FROM public.users WHERE email='new@example.com'");
        const again2 = await node([path.join(SERVER, 'scripts/move_app_data.js'), '--apply', '--allow-nonempty'], toolEnv);
        ok(again2.status === 0 && /All tables match/.test(again2.stdout), 'with --allow-nonempty a repeat run skips existing rows and still matches', again2.stdout.slice(-400) + again2.stderr);
    } catch (err) {
        fail++; console.log('FAIL  unexpected error:', err.message);
    } finally {
        try { await srcServer.stop(); await tgtServer.stop(); await srcDb.close(); await tgtDb.close(); } catch { /* closed */ }
        fs.rmSync(work, { recursive: true, force: true });
    }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
