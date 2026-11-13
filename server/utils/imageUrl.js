/**
 * Removes the invisible characters that some question-bank rows carry inside image addresses (non-breaking spaces around a hyphen,
 * zero-width characters). With them the address points at a file that does not exist. Same rule as the browser's resolveImageUrl.
 */
function cleanImageUrl(url) {
    if (typeof url !== 'string') return url;
    return url
        .replace(/[\u00a0\s]*-[\u00a0]+\s*/g, '-')
        .replace(/[\u00a0\u200b-\u200d\u2060\ufeff]+/g, '')
        .trim();
}

module.exports = { cleanImageUrl };
