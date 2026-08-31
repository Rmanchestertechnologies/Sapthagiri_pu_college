const mongoose = require('mongoose');

async function test() {
    try {
        await mongoose.connect('mongodb+srv://yy6996843_db_user:N2oKnSiCAtk2Qgcy@cluster0.cii53av.mongodb.net/question_paper_system?retryWrites=true&w=majority&appName=Cluster0');
        
        const c1 = await mongoose.connection.db.collection('papers').countDocuments();
        const c2 = await mongoose.connection.db.collection('paper').countDocuments();
        console.log("Count in papers:", c1);
        console.log("Count in paper:", c2);
        
    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}

test();
