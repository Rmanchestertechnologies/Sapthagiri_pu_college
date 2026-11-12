import api from '../api';

/**
 * Download a file from an authenticated API route.
 *
 * The admin screens used to open `/api/...?token=<login token>` in a new tab, which puts the token in the browser
 * history, in server and proxy logs and in the Referer header. The request is made with the normal Authorization
 * header and the response is saved as a file instead.
 *
 * @returns {Promise<void>} rejects with a readable Error when the server refuses or fails
 */
export async function downloadFile(url, fallbackName = 'download') {
    let res;
    try {
        res = await api.get(url, { responseType: 'blob', timeout: 120000 });
    } catch (err) {
        // error bodies arrive as blobs too; read the server's message when there is one
        let msg = err.message;
        const data = err.response?.data;
        if (data instanceof Blob) {
            try { msg = JSON.parse(await data.text()).msg || msg; } catch { /* not JSON */ }
        }
        throw new Error(msg || 'Download failed');
    }

    // prefer the server's file name (Content-Disposition)
    const disposition = res.headers?.['content-disposition'] || '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;

    const href = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(href);
}
