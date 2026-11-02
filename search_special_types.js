const { getPoolsForQuery } = require('./server/config/subjectDatabases');

async function searchSpecialTypes() {
    console.log('Searching all tables for special types...');
    const pools = getPoolsForQuery('Physics', 'Both');
    for (const p of pools) {
        console.log(`Checking pool ${p.name}...`);
        const res = await p.pool.query(`
            SELECT q_type, count(*) as count 
            FROM public.questions 
            GROUP BY q_type;
        `);
        console.log(`Pool ${p.name} q_types:`, res.rows);

        const txtSearch = await p.pool.query(`
            SELECT 
                count(*) FILTER (WHERE question ILIKE '%Assertion%' AND question ILIKE '%Reason%') as assertion_count,
                count(*) FILTER (WHERE question ILIKE '%Match%' OR question ILIKE '%Column I%') as match_count,
                count(*) FILTER (WHERE question ILIKE '%Statement I%' OR question ILIKE '%Statement-I%') as stmt_count
            FROM public.questions;
        `);
        console.log(`Pool ${p.name} text search counts:`, txtSearch.rows[0]);
    }
}

searchSpecialTypes();
