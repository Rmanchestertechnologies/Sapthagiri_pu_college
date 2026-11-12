const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret';
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-only-admin-password';
    process.env.NODE_ENV = 'test';

    if (process.env.MONGO_URI && mongoose.connection.readyState === 0) {
        try {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('Connected to MongoDB Atlas for integration testing');
        } catch (err) {
            console.error('Test DB connection error:', err.message);
        }
    }
});

afterAll(async () => {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    } catch (err) {
        console.warn('DB disconnect error:', err.message);
    }
});
