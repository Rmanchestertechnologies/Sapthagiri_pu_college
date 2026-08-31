const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {}
const mongoose = require('mongoose');
const Question = require('./models/Question');
const Paper = require('./models/Paper');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const papers = await Paper.find().populate('questions');
    console.log(`Found ${papers.length} papers:`);
    for (const p of papers) {
        console.log(`Paper: ${p.title} (${p.subject}) - ID: ${p._id} - Questions Count: ${p.questions.length}`);
        const sampleQs = p.questions.slice(0, 3).map(q => `${q.chapter} | ${q.questionText.substring(0, 40)}...`);
        console.log(`  Sample Qs:`, sampleQs);
    }
    await mongoose.disconnect();
}
check();
