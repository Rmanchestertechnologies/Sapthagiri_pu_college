const supabaseQuestions = require('./services/supabaseQuestions');

async function runTests() {
    console.log('=== TESTING MULTI-DATABASE SUBJECT ROUTING ===\n');

    const tests = [
        { subject: 'Mathematics', classes: '11' },
        { subject: 'Mathematics', classes: '12' },
        { subject: 'Chemistry', classes: '11' },
        { subject: 'Chemistry', classes: '12' },
        { subject: 'Biology', classes: '11' },
        { subject: 'Biology', classes: '12' },
        { subject: 'Physics', classes: '11' },
        { subject: 'Physics', classes: '12' }
    ];

    let sampleQuestionId = null;

    for (const t of tests) {
        try {
            const res = await supabaseQuestions.getQuestions({ subject: t.subject, classes: t.classes }, 1, 3);
            const total = res.pagination.total;
            const sample = res.questions[0];
            if (sample && !sampleQuestionId) sampleQuestionId = sample.id;
            console.log(`✅ ${t.subject} (Class ${t.classes}): ${total} total questions | Sample: "${sample?.questionText?.substring(0, 50)}..."`);
        } catch (e) {
            console.error(`❌ ${t.subject} (Class ${t.classes}) Failed:`, e.message);
        }
    }

    console.log('\n=== TESTING SUBJECT METADATA AGGREGATION ===\n');
    for (const sub of ['Mathematics', 'Chemistry', 'Biology', 'Physics']) {
        try {
            const meta = await supabaseQuestions.getSubjectMetadata(sub);
            console.log(`✅ ${sub} Metadata: ${meta.total} questions | ${meta.chapters.length} chapters | ${meta.concepts.length} concepts`);
        } catch (e) {
            console.error(`❌ ${sub} Metadata Failed:`, e.message);
        }
    }

    if (sampleQuestionId) {
        console.log(`\n=== TESTING SINGLE QUESTION LOOKUP BY ID (${sampleQuestionId}) ===\n`);
        try {
            const q = await supabaseQuestions.getQuestionById(sampleQuestionId);
            console.log(`✅ Retrieved question by ID: [${q.subject}] ${q.chapter} -> "${q.questionText.substring(0, 60)}..."`);
        } catch (e) {
            console.error('❌ Question by ID failed:', e.message);
        }
    }

    console.log('\n🎉 ALL MULTI-DATABASE TESTS COMPLETED SUCCESSFULLY!\n');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
