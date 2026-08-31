// const dns = require('dns');
// try {
//     dns.setServers(['8.8.8.8', '1.1.1.1']);
// } catch (err) {}
const mongoose = require('mongoose');
const Question = require('./models/Question');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await Question.countDocuments();
        console.log(`Total questions in Mongo: ${count}`);
        
        // Find questions containing math symbols or LaTeX backslashes
        const mathQs = await Question.find({
            $or: [
                { questionText: /[\u03B1-\u03C9\u2200-\u22FF\\\[\\\$]/ },
                { questionText: /∑|√|α|β|π|θ|≤|≥|≠|∞/ }
            ]
        }).limit(20);
        
        console.log(`Found ${mathQs.length} sample math questions:`);
        for (const q of mathQs) {
            console.log(`ID: ${q.questionId} | Subj: ${q.subject}`);
            console.log(`Text: ${q.questionText}`);
            console.log(`Options:`, q.options);
            console.log(`Solution: ${q.solutionText}`);
            console.log('----------------------------------------------------');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}
check();
