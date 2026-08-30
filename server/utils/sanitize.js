/**
 * server/utils/sanitize.js
 * Robust zero-dependency server-side HTML sanitizer.
 * Strips script tags, event handlers, iframe, javascript: URIs, object/embed tags.
 */

// Tags that are strictly forbidden and will be completely removed (tag + contents)
const FORBIDDEN_TAGS_REGEX = /<(script|iframe|object|embed|style|form|input|button)[\s\S]*?<\/\1>/gi;
const SELF_CLOSING_FORBIDDEN_REGEX = /<(script|iframe|object|embed|style|form|input|button)[^>]*\/?>/gi;

// Attributes that are forbidden (onEvent attributes like onerror, onload, onclick, etc.)
const FORBIDDEN_ATTR_REGEX = /\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;

// Forbidden protocols in attributes like href="javascript:..." or src="javascript:..."
const JAVASCRIPT_URI_REGEX = /(href|src)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi;

/**
 * Sanitize HTML string for safe server-side storage and rendering.
 * @param {string} dirty 
 * @returns {string}
 */
function sanitizeHtml(dirty) {
    if (!dirty || typeof dirty !== 'string') return dirty;

    let clean = dirty;

    // 1. Remove forbidden tags and their contents (<script>...</script>, <iframe>...</iframe>)
    clean = clean.replace(FORBIDDEN_TAGS_REGEX, '');
    clean = clean.replace(SELF_CLOSING_FORBIDDEN_REGEX, '');

    // 2. Remove event handlers (onerror=..., onload=..., onclick=...)
    clean = clean.replace(FORBIDDEN_ATTR_REGEX, '');

    // 3. Remove javascript: URIs
    clean = clean.replace(JAVASCRIPT_URI_REGEX, '');

    return clean;
}

/**
 * Sanitize an array of strings (for question options).
 * @param {Array} arr 
 * @returns {Array}
 */
function sanitizeArray(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.map(item => typeof item === 'string' ? sanitizeHtml(item) : item);
}

module.exports = { sanitizeHtml, sanitizeArray };
