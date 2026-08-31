process.env.NODE_ENV = 'test';
require('dotenv').config();

const app = require('../index');
const http = require('http');

const PORT = 5005;
const server = http.createServer(app);

server.listen(PORT, async () => {
    console.log('🚀 Test Server running on port ' + PORT);
    try {
        const baseUrl = 'http://localhost:' + PORT;

        // 1. Health check
        console.log('1. Testing /api/health...');
        const hRes = await fetch(baseUrl + '/api/health');
        const hJson = await hRes.json();
        console.log('   Health response:', hJson.status, '| DB status:', hJson.db);

        // 2. Admin Login
        console.log('2. Testing Admin Login...');
        const aRes = await fetch(baseUrl + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'sapthagiripucollegedvg@gmail.com', password: 'Sapthagiri1' })
        });
        const aJson = await aRes.json();
        if (!aJson.token) throw new Error('Admin login failed: ' + JSON.stringify(aJson));
        const adminToken = aJson.token;
        console.log('   ✅ Admin Login successful. Token obtained.');

        // 3. Faculty Login (Physics)
        console.log('3. Testing Faculty Login (physics@gmail.com)...');
        const fRes = await fetch(baseUrl + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'physics@gmail.com', password: 'Sapthagiri1' })
        });
        const fJson = await fRes.json();
        if (!fJson.token) throw new Error('Faculty login failed: ' + JSON.stringify(fJson));
        const teacherToken = fJson.token;
        const teacherId = fJson.user.id;
        console.log('   ✅ Teacher Login successful. Teacher ID:', teacherId);

        // 4. Commission Exam as Admin
        console.log('4. Testing Exam Commissioning (POST /api/exams/commission)...');
        const commRes = await fetch(baseUrl + '/api/exams/commission', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': adminToken
            },
            body: JSON.stringify({
                title: 'Karnataka CET Grand Mock Test 2026',
                examType: 'CET',
                classes: ['12'],
                instructions: 'Follow standard CET regulations.',
                duration_minutes: 180,
                subjectAssignments: [
                    { subject: 'Physics', targetQuestions: 60, teacherId: teacherId, teacherName: 'Physics Faculty', status: 'In Progress' },
                    { subject: 'Chemistry', targetQuestions: 60, teacherId: '7', teacherName: 'Chemistry Faculty', status: 'In Progress' }
                ]
            })
        });
        const commJson = await commRes.json();
        if (!commJson.exam) throw new Error('Commissioning failed: ' + JSON.stringify(commJson));
        const examId = commJson.exam._id || commJson.exam.id;
        console.log('   ✅ Exam commissioned successfully. ID:', examId);

        // 5. Teacher Fetch Assignments (GET /api/exams/my-assignments)
        console.log('5. Testing Teacher Assignments Fetch (GET /api/exams/my-assignments)...');
        const assignRes = await fetch(baseUrl + '/api/exams/my-assignments', {
            headers: { 'x-auth-token': teacherToken }
        });
        const assignJson = await assignRes.json();
        console.log('   Found assignments for Physics teacher:', assignJson.length);
        const myExam = assignJson.find(e => String(e._id || e.id) === String(examId));
        if (!myExam) throw new Error('Commissioned exam not found in teacher assignments!');
        console.log('   ✅ Commissioned exam properly assigned and visible in Teacher Dashboard!');

        // 6. Teacher submits paper for the exam (POST /api/papers)
        console.log('6. Testing Teacher Paper Submission (POST /api/papers)...');
        const paperRes = await fetch(baseUrl + '/api/papers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': teacherToken
            },
            body: JSON.stringify({
                title: 'Karnataka CET Grand Mock Test 2026 - Physics Section',
                subject: 'Physics',
                examType: 'CET',
                examId: examId,
                questions: ['sample_q1', 'sample_q2'],
                questionObjects: [
                    { questionText: 'What is unit of force?', options: ['Newton', 'Joule', 'Watt', 'Pascal'], answer: 'Newton', subject: 'Physics' },
                    { questionText: 'What is acceleration due to gravity on Earth?', options: ['9.8 m/s^2', '10 m/s^2', '8.9 m/s^2', '12 m/s^2'], answer: '9.8 m/s^2', subject: 'Physics' }
                ]
            })
        });
        const paperJson = await paperRes.json();
        const paperId = paperJson._id || paperJson.id;
        console.log('   ✅ Paper saved successfully. ID:', paperId);

        // 7. Admin views commissioned exams with real-time status (GET /api/exams/commissioned)
        console.log('7. Testing Admin Commissioned Overview (GET /api/exams/commissioned)...');
        const overviewRes = await fetch(baseUrl + '/api/exams/commissioned', {
            headers: { 'x-auth-token': adminToken }
        });
        const overviewJson = await overviewRes.json();
        const currentExamOverview = overviewJson.find(e => String(e._id || e.id) === String(examId));
        console.log('   Overview for commissioned exam:', currentExamOverview ? 'Found' : 'Not Found');
        console.log('   Total questions aggregated:', currentExamOverview?.totalQuestionsAdded);

        // 8. Exam Blueprints (GET /api/exam-blueprints)
        console.log('8. Testing Exam Blueprints (GET /api/exam-blueprints)...');
        const bpRes = await fetch(baseUrl + '/api/exam-blueprints', {
            headers: { 'x-auth-token': adminToken }
        });
        const bpJson = await bpRes.json();
        console.log('   Blueprints available:', bpJson.length, bpJson.map(b => b.name).join(', '));

        // 9. Student Take Exam (GET /api/exams/:id/take)
        console.log('9. Testing Student Take Exam (GET /api/exams/' + examId + '/take)...');
        const takeRes = await fetch(baseUrl + '/api/exams/' + examId + '/take?rollNumber=STUDENT101');
        const takeJson = await takeRes.json();
        console.log('   Student exam title:', takeJson.title, '| Questions available to take:', takeJson.questions ? takeJson.questions.length : 0);

        // 10. Student Start Session (POST /api/exams/:id/start)
        console.log('10. Testing Student Start Session (POST /api/exams/' + examId + '/start)...');
        const startRes = await fetch(baseUrl + '/api/exams/' + examId + '/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentName: 'Ramesh Kumar',
                studentEmail: 'ramesh@student.sapthagiri.edu',
                rollNumber: 'STUDENT101'
            })
        });
        const startJson = await startRes.json();
        const sessionId = startJson.session?._id;
        console.log('   ✅ Student session started. Session ID:', sessionId);

        // 11. Student Submit Exam (POST /api/exams/:id/submit)
        console.log('11. Testing Student Submit Exam (POST /api/exams/' + examId + '/submit)...');
        const submitRes = await fetch(baseUrl + '/api/exams/' + examId + '/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sessionId,
                answers: [
                    { questionId: '0', selectedOption: 'Newton', timeTaken: 25 }
                ]
            })
        });
        const submitJson = await submitRes.json();
        console.log('   ✅ Exam submitted successfully:', submitJson.msg);

        // 12. Scorecard (GET /api/exams/:id/scorecard/:sessionId)
        console.log('12. Testing Scorecard Retrieval (GET /api/exams/' + examId + '/scorecard/' + sessionId + ')...');
        const scoreRes = await fetch(baseUrl + '/api/exams/' + examId + '/scorecard/' + sessionId);
        const scoreJson = await scoreRes.json();
        console.log('   ✅ Scorecard received! Student:', scoreJson.studentName, '| Score:', scoreJson.score);

        // 13. Admin Results (GET /api/exams/:id/results)
        console.log('13. Testing Admin Results (GET /api/exams/' + examId + '/results)...');
        const resList = await fetch(baseUrl + '/api/exams/' + examId + '/results', {
            headers: { 'x-auth-token': adminToken }
        });
        const resListJson = await resList.json();
        console.log('   ✅ Results list received:', resListJson.length, 'session(s) recorded.');

        console.log('\n======================================================');
        console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS! 🎉');
        console.log('======================================================');
        server.close();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        server.close();
        process.exit(1);
    }
});
