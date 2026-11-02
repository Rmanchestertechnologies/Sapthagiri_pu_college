const fs = require('fs');
const s = fs.readFileSync('server/services/supabaseQuestions.js', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
    if (l.includes('getQuestions =') || l.includes('function getQuestions') || l.includes('limit =') || l.includes('Math.min(')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
