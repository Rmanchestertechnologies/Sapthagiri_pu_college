/**
 * Checks that the OMR scanner can actually run on this host: a Python interpreter with the engine's libraries.
 * Without it every sheet failed one by one with a long Python traceback; now the scan screen and the scan route say so up
 * front, in plain words, and the result is cached for a minute so the check does not slow down normal use.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHECK_CODE = 'import cv2, numpy, onnxruntime, PIL';
const CACHE_MS = 60 * 1000;
let cached = null;

function pythonBin() {
    return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
}

/**
 * Environment for the Python process. Libraries installed at build time into omr_engine/pylibs (the hosting platform keeps
 * the project folder between build and run, but not the user-level site-packages) are added to PYTHONPATH.
 */
function pythonEnv() {
    const libs = path.resolve(__dirname, '../omr_engine/pylibs');
    if (!fs.existsSync(libs)) return process.env;
    const sep = path.delimiter;
    return { ...process.env, PYTHONPATH: process.env.PYTHONPATH ? `${libs}${sep}${process.env.PYTHONPATH}` : libs };
}

function checkOmrRuntime({ force = false, exec = execFile } = {}) {
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.result);
    return new Promise(resolve => {
        exec(pythonBin(), ['-c', CHECK_CODE], { timeout: 20000, env: pythonEnv() }, (error, stdout, stderr) => {
            let result;
            if (!error) {
                result = { available: true, python: pythonBin() };
            } else if (error.code === 'ENOENT') {
                result = {
                    available: false,
                    python: pythonBin(),
                    reason: `Python was not found on the server (looked for "${pythonBin()}"). Install Python 3, or set PYTHON_BIN.`
                };
            } else {
                const missing = /No module named '([^']+)'/.exec(String(stderr || error.message));
                result = {
                    available: false,
                    python: pythonBin(),
                    reason: missing
                        ? `The Python library "${missing[1]}" is not installed on the server. Run: pip install -r server/omr_engine/requirements.txt`
                        : 'The OMR engine could not be started on the server.'
                };
            }
            cached = { at: Date.now(), result };
            resolve(result);
        });
    });
}

module.exports = { checkOmrRuntime, pythonBin, pythonEnv };
