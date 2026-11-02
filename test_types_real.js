const { getQuestions } = require('./server/services/supabaseQuestions');

async function testTypes() {
    console.log('Querying 1000 Physics questions...');
    const result = await getQuestions({ subject: 'Physics' }, 1, 1000);
    const qs = result.questions || [];
    console.log('Total questions returned:', qs.length);
    
    const typesCount = {};
    const detectedCategories = { ar: 0, match: 0, stmt: 0, diag: 0, mcq: 0 };
    
    qs.forEach(q => {
        const t = (q.type || q.q_type || 'none').toUpperCase();
        typesCount[t] = (typesCount[t] || 0) + 1;
        
        const txt = `${q.questionText || q.question || ''}`;
        if (t === 'ASSERTION_REASON' || /Assertion\s*(?:\(A\))?[:\-]/i.test(txt)) detectedCategories.ar++;
        else if (t === 'MATCH_FOLLOWING' || t.includes('MATCH') || /Column\s*(?:I|1|A)\b/i.test(txt)) detectedCategories.match++;
        else if (t === 'STATEMENT_BASED' || /Statement\s*(?:I|1|A)\b/i.test(txt)) detectedCategories.stmt++;
        else if (t === 'DIAGRAM_BASED' || q.imageUrl || q.image_url || /\{\{IMG::|!\[|<img/i.test(txt)) detectedCategories.diag++;
        else detectedCategories.mcq++;
    });

    console.log('Explicit q.type counts:', typesCount);
    console.log('Detected category counts in 1000 questions:', detectedCategories);
}

testTypes();
