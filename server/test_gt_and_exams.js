async function check() {
    try {
        // Login
        const loginRes = await fetch('https://qpg-backend-5h72.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'college@gmail.com', password: '123456' })
        });
        const { token } = await loginRes.json();
        console.log('✅ Logged in. Token obtained.');

        // Test grand-tests
        console.log('\n=== Testing /api/grand-tests ===');
        const gtRes = await fetch('https://qpg-backend-5h72.onrender.com/api/grand-tests', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Status:', gtRes.status);
        if (gtRes.status === 200) {
            const data = await gtRes.json();
            console.log('Grand Tests Count:', data.length);
            data.forEach(gt => console.log(' -', gt.title, '|', gt.examType, '|', gt.questions?.length || 0, 'questions'));
        } else {
            const text = await gtRes.text();
            console.log('Response:', text.substring(0, 300));
        }

        // Test exams
        console.log('\n=== Testing /api/exams ===');
        const examRes = await fetch('https://qpg-backend-5h72.onrender.com/api/exams', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Status:', examRes.status);
        if (examRes.status === 200) {
            const exams = await examRes.json();
            console.log('Exams Count:', exams.length);
        } else {
            const text = await examRes.text();
            console.log('Response:', text.substring(0, 300));
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}
check();
