const { join } = require('path');

/**
 * Puppeteer downloads its Chrome at install time. On the hosting platform the default location (the user's home folder) is
 * not kept between the build and the running service, so PDF export failed with "Could not find Chrome". Keeping the browser
 * inside the project folder, which is kept, fixes that. The same setting applies locally.
 */
module.exports = {
    cacheDirectory: join(__dirname, '.cache', 'puppeteer')
};
