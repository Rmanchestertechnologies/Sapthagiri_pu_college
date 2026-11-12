/**
 * TLS settings shared by every PostgreSQL pool.
 *
 * Supabase's pooler presents a certificate chain that Node does not trust by default, so verification
 * only works when the provider's CA certificate is supplied. Set DB_SSL_CA to the PEM text (use \n for
 * line breaks) or to the path of the .pem file and the connection is verified; without it the connection is
 * encrypted but the server's identity is NOT checked (a man-in-the-middle on the network path could read it).
 */
const fs = require('fs');

let warned = false;

function buildSsl() {
    // DB_SSL=off is for a local development database that has no TLS. It is ignored in production.
    if (process.env.DB_SSL === 'off' && process.env.NODE_ENV !== 'production') return false;
    const ca = process.env.DB_SSL_CA;
    if (ca) {
        const pem = ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : fs.readFileSync(ca, 'utf8');
        return { ca: pem, rejectUnauthorized: true };
    }
    if (!warned && process.env.NODE_ENV === 'production') {
        warned = true;
        console.warn('⚠️ DB_SSL_CA is not set: database connections are encrypted but the server certificate is not verified.');
    }
    return { rejectUnauthorized: false };
}

module.exports = { buildSsl };
