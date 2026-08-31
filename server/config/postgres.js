const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Primary & Pooler URLs
const POOLER_URL = 'postgresql://postgres.vukxgqkrersxcasdklda:Sapthagiri1@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
const DIRECT_URL = 'postgresql://postgres:Sapthagiri1@db.vukxgqkrersxcasdklda.supabase.co:5432/postgres';

let DATABASE_URL = process.env.DATABASE_URL || POOLER_URL;

// On platforms where direct IPv6 db.<ref>.supabase.co cannot resolve, prefer pooler
if (DATABASE_URL.includes('db.vukxgqkrersxcasdklda.supabase.co')) {
    DATABASE_URL = POOLER_URL;
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
