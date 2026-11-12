/**
 * One shared headless browser for all PDF generation (papers and score reports).
 *
 *  - Launch is serialised: two requests arriving together used to start two browsers; the second was never closed.
 *  - A browser that crashed or was killed (out of memory on a small host) is detected through `connected` / the
 *    `disconnected` event and replaced on the next request instead of failing every later export.
 *  - At most MAX_PAGES pages render at once; others wait, so a burst of "download all scorecards" cannot exhaust memory.
 *  - PUPPETEER_EXECUTABLE_PATH (read by puppeteer itself) lets a container use a system Chromium.
 */
const puppeteer = require('puppeteer');

const MAX_PAGES = Number(process.env.PDF_MAX_PAGES) || 3;
let browserPromise = null;
let active = 0;
const waiting = [];

async function launch() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    browser.on('disconnected', () => {
        if (browserPromise) browserPromise = null;   // next request starts a fresh browser
    });
    return browser;
}

async function getBrowser() {
    if (browserPromise) {
        try {
            const b = await browserPromise;
            if (b.connected) return b;
        } catch { /* launch failed earlier: try again below */ }
        browserPromise = null;
    }
    browserPromise = launch();
    try {
        return await browserPromise;
    } catch (err) {
        browserPromise = null;
        throw err;
    }
}

function acquire() {
    if (active < MAX_PAGES) { active++; return Promise.resolve(); }
    return new Promise(resolve => waiting.push(resolve));
}

function release() {
    const next = waiting.shift();
    if (next) next();          // the slot passes straight to the next waiter
    else active--;
}

/**
 * Runs `fn(page)` on a fresh page of the shared browser and always closes the page afterwards.
 */
async function withPage(fn) {
    await acquire();
    let page = null;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);
        return await fn(page);
    } finally {
        if (page) { try { await page.close(); } catch { /* browser already gone */ } }
        release();
    }
}

async function closeBrowser() {
    if (!browserPromise) return;
    try { const b = await browserPromise; await b.close(); } catch { /* already closed */ }
    browserPromise = null;
}

module.exports = { withPage, closeBrowser };
