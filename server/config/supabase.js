const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vukxgqkrersxcasdklda.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'dummy_sapthagiri_key';

let supabase;
try {
    if (SUPABASE_URL && SUPABASE_URL.startsWith('http') && SUPABASE_SECRET_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    } else {
        throw new Error('Valid URL and Key not provided');
    }
} catch (e) {
    console.warn('⚠️ Supabase JS client fallback initialized:', e.message);
    supabase = {
        from: () => ({
            select: () => Promise.resolve({ data: [], error: null }),
            insert: () => Promise.resolve({ data: [], error: null }),
            update: () => Promise.resolve({ data: [], error: null }),
            delete: () => Promise.resolve({ data: [], error: null })
        })
    };
}

module.exports = supabase;
