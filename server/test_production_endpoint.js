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
        const gtData = await gtRes.json();
        console.log('Grand Tests Count:', gtData.length);
        console.log('Grand Tests details:', JSON.stringify(gtData, null, 2));
    } catch (err) {
        console.error('Error fetching from production:', err.message);
    }
}
check();
