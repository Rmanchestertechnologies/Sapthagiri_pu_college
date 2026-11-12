// The shared PDF browser: one launch for concurrent requests, replacement after a crash, bounded concurrency.
jest.mock('puppeteer', () => ({ launch: jest.fn() }));
const puppeteer = require('puppeteer');

function fakeBrowser() {
    const handlers = {};
    const browser = {
        connected: true,
        on: (ev, fn) => { handlers[ev] = fn; },
        newPage: jest.fn(async () => ({ setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, close: jest.fn(async () => {}) })),
        close: jest.fn(async () => { browser.connected = false; }),
        crash: () => { browser.connected = false; handlers.disconnected && handlers.disconnected(); }
    };
    return browser;
}

describe('pdfBrowser', () => {
    let withPage, closeBrowser;
    beforeEach(() => {
        jest.resetModules();
        jest.doMock('puppeteer', () => puppeteer);
        puppeteer.launch.mockReset();
        ({ withPage, closeBrowser } = require('../services/pdfBrowser'));
    });

    test('simultaneous requests share one browser launch', async () => {
        const b = fakeBrowser();
        puppeteer.launch.mockImplementation(async () => { await new Promise(r => setTimeout(r, 20)); return b; });
        await Promise.all([1, 2, 3].map(() => withPage(async () => 'ok')));
        expect(puppeteer.launch).toHaveBeenCalledTimes(1);
        expect(b.newPage).toHaveBeenCalledTimes(3);
    });

    test('a crashed browser is replaced on the next request', async () => {
        const first = fakeBrowser();
        const second = fakeBrowser();
        puppeteer.launch.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
        await withPage(async () => 1);
        first.crash();
        await withPage(async () => 2);
        expect(puppeteer.launch).toHaveBeenCalledTimes(2);
        expect(second.newPage).toHaveBeenCalledTimes(1);
    });

    test('a failed launch does not poison later requests', async () => {
        const b = fakeBrowser();
        puppeteer.launch.mockRejectedValueOnce(new Error('no chrome')).mockResolvedValueOnce(b);
        await expect(withPage(async () => 1)).rejects.toThrow('no chrome');
        await expect(withPage(async () => 'fine')).resolves.toBe('fine');
    });

    test('at most three pages render at once and the page is closed even when rendering throws', async () => {
        const b = fakeBrowser();
        const pages = [];
        b.newPage = jest.fn(async () => { const p = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, close: jest.fn(async () => {}) }; pages.push(p); return p; });
        puppeteer.launch.mockResolvedValue(b);
        let running = 0, peak = 0;
        const job = async (fail) => withPage(async () => {
            running++; peak = Math.max(peak, running);
            await new Promise(r => setTimeout(r, 15));
            running--;
            if (fail) throw new Error('render failed');
            return 'done';
        });
        const results = await Promise.allSettled([job(false), job(true), job(false), job(false), job(false), job(false)]);
        expect(peak).toBeLessThanOrEqual(3);
        expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
        pages.forEach(p => expect(p.close).toHaveBeenCalled());
        await closeBrowser();
    });
});
