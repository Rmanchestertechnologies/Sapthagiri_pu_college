async function check() {
    try {
        // Test 1: Login without password (old behavior)
        console.log('=== TEST 1: Login WITHOUT password ===');
        const res1 = await fetch('https://qpg-backend-5h72.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'college@gmail.com' })
        });
        const d1 = await res1.json();
        console.log('Status:', res1.status, '| Response:', JSON.stringify(d1).substring(0, 150));

        // Test 2: Login WITH password
        console.log('\n=== TEST 2: Login WITH password 123456 ===');
        const res2 = await fetch('https://qpg-backend-5h72.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'college@gmail.com', password: '123456' })
        });
        const d2 = await res2.json();
        console.log('Status:', res2.status, '| Response:', JSON.stringify(d2).substring(0, 150));

    } catch (err) {
        console.error('Error:', err.message);
    }
}
check();
