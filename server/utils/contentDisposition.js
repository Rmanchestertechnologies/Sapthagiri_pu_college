/**
 * Builds a safe `Content-Disposition: attachment` header value.
 *
 * Titles and student names used to be placed straight into the header. Node refuses header values that contain characters
 * above Latin-1 (an en dash in "Physics – Unit Test", a Kannada name) or control characters, so the download failed with a
 * 500 AFTER the file had been generated. A quote or a line break in the name could also break out of the header.
 *
 * The plain `filename` is limited to safe ASCII; the full name is sent in `filename*` (RFC 5987) for browsers that read it.
 */
function contentDisposition(name, extension, fallback = 'download') {
    const raw = String(name == null ? '' : name).trim();
    const ascii = raw
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9._-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 120) || fallback;
    const utf8 = encodeURIComponent(raw.replace(/[\r\n\0]/g, ' ').replace(/\s+/g, '_').slice(0, 120) || fallback)
        .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    return `attachment; filename="${ascii}.${extension}"; filename*=UTF-8''${utf8}.${extension}`;
}

module.exports = { contentDisposition };
