/**
 * Safety helpers for the server-side PDF generators (headless Chrome).
 *
 * The generators build an HTML document from database content (titles, instructions, student details, question
 * text) and let Chrome render it on the API server. Without these guards, markup in any of those fields runs inside
 * that browser with the server's network access: scripts, requests to internal addresses, local files.
 */
const { isAllowedImageUrl } = require('./accessRules');

const escapeHtml = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * No JavaScript, and only data: URLs and allow-listed https image hosts may load. Everything else
 * (file:, http:, internal addresses, other hosts) is aborted.
 */
async function hardenPage(page) {
    await page.setJavaScriptEnabled(false);
    const extra = String(process.env.IMAGE_PROXY_HOSTS || '').split(',');
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const url = req.url();
        if (url.startsWith('data:') || url === 'about:blank' || isAllowedImageUrl(url, extra)) return req.continue();
        return req.abort('blockedbyclient');
    });
}

module.exports = { escapeHtml, hardenPage };
