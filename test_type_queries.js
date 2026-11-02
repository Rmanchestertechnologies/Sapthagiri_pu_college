const { getPoolsForQuery } = require('./server/config/subjectDatabases');

async function testTypeQueries() {
    const pools = getPoolsForQuery('Physics', 'Both');
    const p = pools[1]; // Class 12
    console.log('Testing specific type queries on Physics Class 12...');

    // 1. AR
    const arRes = await p.pool.query(`
        SELECT id, q_type, question FROM public.questions 
        WHERE (q_type IN ('assertion_reason', 'assertion') OR (question ILIKE '%Assertion%' AND question ILIKE '%Reason%'))
        LIMIT 5;
    `);
    console.log('AR found:', arRes.rows.length);

    // 2. Match
    const matchRes = await p.pool.query(`
        SELECT id, q_type, question FROM public.questions 
        WHERE (q_type IN ('match', 'match_following') OR question ILIKE '%Column I%' OR question ILIKE '%Match the following%')
        LIMIT 5;
    `);
    console.log('Match found:', matchRes.rows.length);

    // 3. Statement
    const stmtRes = await p.pool.query(`
        SELECT id, q_type, question FROM public.questions 
        WHERE (q_type IN ('statement_based', 'statement') OR question ILIKE '%Statement I%' OR question ILIKE '%Statement 1%')
        LIMIT 5;
    `);
    console.log('Statement found:', stmtRes.rows.length);
}

testTypeQueries();
