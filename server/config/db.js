const mongoose = require('mongoose');

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not configured');
    }

    // Already connected
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    console.log('⏳ Connecting to MongoDB Atlas...');

    await mongoose.connect(process.env.MONGO_URI);

    // Verify that the connection is actually usable
    await mongoose.connection.db.admin().ping();

    console.log('✅ MongoDB Atlas Connected');

    return mongoose.connection;
};

module.exports = connectDB;