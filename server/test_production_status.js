async function check() {
    try {
        console.log('Logging in to production backend...');
        const loginRes = await fetch('https://qpg-backend-5h72.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'college@gmail.com' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('✅ Logged in successfully. Token obtained.');

        console.log('Fetching grand tests from production backend...');
        const gtRes = await fetch('https://qpg-backend-5h72.onrender.com/api/grand-tests', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Response status:', gtRes.status);
        console.log('Response headers:', [...gtRes.headers.entries()]);
        const text = await gtRes.text();
        console.log('Response body preview:', text.substring(0, 500));
    } catch (err) {
        console.error('Error fetching from production:', err.message);
    }
}
check();
