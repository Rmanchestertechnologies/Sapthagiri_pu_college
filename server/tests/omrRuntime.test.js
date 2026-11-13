const { checkOmrRuntime, pythonEnv } = require('../services/omrRuntime');

const run = (error, stderr = '') => ({ force: true, exec: (bin, args, opts, cb) => cb(error, '', stderr) });

describe('OMR runtime check', () => {
    test('available when the libraries import', async () => {
        const r = await checkOmrRuntime(run(null));
        expect(r.available).toBe(true);
    });

    test('Python missing is explained in plain words', async () => {
        const r = await checkOmrRuntime(run(Object.assign(new Error('spawn python3 ENOENT'), { code: 'ENOENT' })));
        expect(r.available).toBe(false);
        expect(r.reason).toMatch(/Python was not found/);
        expect(r.reason).toMatch(/PYTHON_BIN/);
    });

    test('a missing library names the library and the fix', async () => {
        const r = await checkOmrRuntime(run(new Error('exit 1'), "ModuleNotFoundError: No module named 'cv2'"));
        expect(r.available).toBe(false);
        expect(r.reason).toMatch(/"cv2"/);
        expect(r.reason).toMatch(/requirements\.txt/);
    });

    test('a timeout is reported as "took too long", not as a missing engine, and is retried soon', async () => {
        const timedOut = Object.assign(new Error('killed'), { killed: true, signal: 'SIGTERM' });
        const r = await checkOmrRuntime({ force: true, exec: (b, a, o, cb) => cb(timedOut, '', '') });
        expect(r.available).toBe(false);
        expect(r.reason).toMatch(/took too long/);
        expect(r.reason).not.toMatch(/not installed|not found/);
        expect(r.transient).toBe(true);
    });

    test('the answer is cached for a minute and can be forced fresh', async () => {
        const calls = [];
        const exec = (bin, args, opts, cb) => { calls.push(1); cb(null, '', ''); };
        await checkOmrRuntime({ force: true, exec });
        await checkOmrRuntime({ exec });
        expect(calls).toHaveLength(1);
        await checkOmrRuntime({ force: true, exec });
        expect(calls).toHaveLength(2);
    });

    test('pythonEnv keeps the normal environment', () => {
        expect(pythonEnv().PATH || pythonEnv().Path).toBeDefined();
    });
});
