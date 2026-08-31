const puppeteer = require('puppeteer');

let browser = null;

async function getBrowser() {
    if (browser && browser.process() && browser.process().signalCode === null) {
        return browser;
    }
    // Launch headless Chromium
    browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    return browser;
}

/**
 * Render a LaTeX formula to a PNG image buffer using Puppeteer & KaTeX
 * @param {string} latex - Raw LaTeX formula
 * @param {boolean} isBlock - Inline or Block displayMode
 * @returns {Promise<{buffer: Buffer, width: number, height: number} | null>}
 */
const getMathPng = async (latex, isBlock = false) => {
    try {
        const b = await getBrowser();
        const page = await b.newPage();
        
        // Construct HTML content loading KaTeX from local node_modules (optional) or official CDN
        await page.setContent(`
          <!DOCTYPE html>
          <html>
          <head>
              <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.css">
              <script src="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.js"></script>
              <style>
                  body {
                      margin: 0;
                      padding: 2px;
                      display: inline-block;
                      background-color: white;
                  }
                  #math {
                      display: inline-block;
                      font-size: 20px; /* High resolution */
                      font-family: Cambria, Georgia, serif;
                  }
              </style>
          </head>
          <body>
              <div id="math"></div>
          </body>
          </html>
        `);
        
        await page.evaluate((l, bMode) => {
            window.katex.render(l, document.getElementById('math'), {
                displayMode: bMode,
                throwOnError: false
            });
        }, latex, isBlock);

        const element = await page.$('#math');
        if (!element) {
            await page.close();
            return null;
        }

        const buffer = await element.screenshot({ type: 'png', omitBackground: true });
        const boundingBox = await element.boundingBox();
        
        await page.close();
        return {
            buffer,
            width: boundingBox ? boundingBox.width : 100,
            height: boundingBox ? boundingBox.height : 30
        };
    } catch (err) {
        console.error('Puppeteer LaTeX render error:', err);
        return null;
    }
};

module.exports = {
    getMathPng
};
