const fs = require('fs');
const content = fs.readFileSync('client/src/pages/teacher/CommissionedExam.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
    if (l.includes('QUESTIONS FROM EACH QUESTION TYPE') || l.includes('Step 5') || l.includes('generatePaper') || l.includes('fetchQuestions') || l.includes('/api/questions') || l.includes('typeAllocations')) {
        console.log(`Line ${i+1}: ${l.trim().slice(0, 100)}`);
    }
});
