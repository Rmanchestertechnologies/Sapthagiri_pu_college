const supabaseQuestions = require('./services/supabaseQuestions');

async function testService() {
    console.log('Testing Supabase questions service...');
    try {
        const result = await supabaseQuestions.getQuestions({ subject: 'Physics' }, 1, 5);
        console.log('✅ Fetched Physics questions count:', result.questions.length);
        console.log('Pagination info:', result.pagination);
        console.log('First mapped question:', {
            id: result.questions[0].id,
            subject: result.questions[0].subject,
            chapter: result.questions[0].chapter,
            type: result.questions[0].type,
            optionsCount: result.questions[0].options.length,
            answer: result.questions[0].answer,
            questionPreview: result.questions[0].questionText.substring(0, 100)
        });
    } catch (err) {
        console.error('Service test error:', err.message);
    }
}

testService();
