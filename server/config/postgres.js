const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Primary Active Supabase Pooler URL (Physics 11 Database with support tables)
const PRIMARY_ACTIVE_URL = 'postgresql://postgres.pfnlbyjsjxttdachegne:SubClass11Physics@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL.includes('vukxgqkrersxcasdklda')) {
    DATABASE_URL = PRIMARY_ACTIVE_URL;
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = pool;
