const { Pool } = require('pg');
const dotenv = require('dotenv');
const { buildSsl } = require('./dbSsl');

dotenv.config();

// The primary database comes from DATABASE_URL only. The previous version contained a built-in connection
// string (with its password) and silently replaced DATABASE_URL with it when the variable named an older
// project, so the environment could not be changed without editing the source.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. The primary database is unavailable.');
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: buildSsl(),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = pool;
