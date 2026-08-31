const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {}
const mongoose = require('mongoose');
const OnlineExam = require('./models/OnlineExam');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const exams = await OnlineExam.find().sort({ createdAt: -1 });
    console.log(`Found ${exams.length} exams:`);
    for (const e of exams) {
        console.log(`Exam: ${e.title} - ID: ${e._id} - Status: ${e.status} - Qs Count: ${e.questions?.length} - Created: ${e.createdAt}`);
        if (e.questions && e.questions.length > 0) {
            console.log(`  Sample Qs:`, e.questions.slice(0, 3).map(q => `${q.subject} | ${q.chapter} | ${q.questionText.substring(0, 45)}...`));
        }
    }
    await mongoose.disconnect();
}
check();
