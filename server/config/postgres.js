const { Pool } = require('pg');
const dotenv = require('dotenv');
const { buildSsl } = require('./dbSsl');

// ENV_FILE (used by scripts that target a throwaway database) must be the ONLY environment file read
dotenv.config(process.env.ENV_FILE ? { path: process.env.ENV_FILE } : undefined);

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
    // DB_POOL_MAX lets a local single-connection test database be used (default 20)
    max: Number(process.env.DB_POOL_MAX) > 0 ? Number(process.env.DB_POOL_MAX) : 20,
    // DB_POOL_IDLE_MS=0 keeps connections open (needed by a single-connection local test database)
    idleTimeoutMillis: process.env.DB_POOL_IDLE_MS !== undefined && process.env.DB_POOL_IDLE_MS !== '' && Number(process.env.DB_POOL_IDLE_MS) >= 0 ? Number(process.env.DB_POOL_IDLE_MS) : 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = pool;
