const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const OnlineExam = require('../models/OnlineExam');

const JWT_SECRET = process.env.JWT_SECRET || 'sapthagiri_pu_college_secret_key_davanagere_2026';

const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

describe('Exam Commission & Faculty Assignment Integration Test Suite', () => {
    let adminToken;
    let physicsTeacher;
    let physicsTeacherToken;
    let chemistryTeacher;
    let chemistryTeacherToken;
    const testExamsCreated = [];
    const testUsersCreated = [];

    beforeAll(async () => {
        // Admin Token (hardcoded 24-char ObjectId)
        const adminId = '000000000000000000000000';
        adminToken = generateToken({ id: adminId, role: 'admin' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Password123', salt);

        const testTimestamp = Date.now();
        // Physics Teacher
        physicsTeacher = await new User({
            name: 'Test Physics Teacher',
            email: `test.physics.${testTimestamp}@sapthagiri.edu.in`,
            password: hashedPassword,
            role: 'teacher',
            subject: 'Physics'
        }).save();
        testUsersCreated.push(physicsTeacher._id);

        physicsTeacherToken = generateToken({
            id: String(physicsTeacher._id),
            role: 'teacher',
            subject: 'Physics'
        });

        // Chemistry Teacher
        chemistryTeacher = await new User({
            name: 'Test Chemistry Teacher',
            email: `test.chem.${testTimestamp}@sapthagiri.edu.in`,
            password: hashedPassword,
            role: 'teacher',
            subject: 'Chemistry'
        }).save();
        testUsersCreated.push(chemistryTeacher._id);

        chemistryTeacherToken = generateToken({
            id: String(chemistryTeacher._id),
            role: 'teacher',
            subject: 'Chemistry'
        });
    });

    afterAll(async () => {
        if (testExamsCreated.length > 0) {
            await OnlineExam.deleteMany({ _id: { $in: testExamsCreated } });
        }
        if (testUsersCreated.length > 0) {
            await User.deleteMany({ _id: { $in: testUsersCreated } });
        }
    });

    test('TEST 1: Exam router is mounted at /api/exams', async () => {
        const res = await request(app)
            .get('/api/exams')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).not.toBe(404);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('TEST 2: POST /api/exams/commission exists and requires auth', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .send({});
        expect(res.status).toBe(401);
    });

    test('TEST 3: Authorized Admin can commission an exam', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'CET MOCK TEST 2026',
                examType: 'CET',
                classes: ['12'],
                duration_minutes: 180,
                subjectAssignments: [
                    {
                        subject: 'Physics',
                        teacherId: physicsTeacher._id,
                        teacherName: physicsTeacher.name,
                        teacherEmail: physicsTeacher.email,
                        targetQuestions: 60
                    }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body.msg).toContain('commissioned');
        expect(res.body.exam).toBeDefined();
        expect(res.body.exam.title).toBe('CET MOCK TEST 2026');
        if (res.body.exam?._id) testExamsCreated.push(res.body.exam._id);
    });

    test('TEST 4: Unauthorized request (teacher or guest) is rejected from commissioning', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${physicsTeacherToken}`)
            .send({
                title: 'Unauthorized Test',
                examType: 'CET'
            });
        expect(res.status).toBe(403);
    });

    test('TEST 5: MongoDB faculty _id is used in subject assignment', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'NEET Practice 1',
                examType: 'NEET',
                subjectAssignments: [
                    {
                        subject: 'Physics',
                        teacherId: physicsTeacher._id,
                        targetQuestions: 45
                    }
                ]
            });
        expect(res.status).toBe(200);
        const createdAssignment = res.body.exam.subjectAssignments[0];
        expect(String(createdAssignment.teacherId)).toBe(String(physicsTeacher._id));
        if (res.body.exam?._id) testExamsCreated.push(res.body.exam._id);
    });

    test('TEST 6: Invalid exam title or data returns controlled 400', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: '' // Missing title
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toBe('Exam title is required.');
    });

    test('TEST 7: Created exam persists correctly in MongoDB', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'JEE ADVANCED MOCK TEST',
                examType: 'JEE',
                classes: ['12'],
                subjectAssignments: [
                    { subject: 'Physics', teacherId: physicsTeacher._id, targetQuestions: 25 }
                ]
            });
        const examId = res.body.exam._id;
        testExamsCreated.push(examId);
        const found = await OnlineExam.findById(examId);
        expect(found).not.toBeNull();
        expect(found.title).toBe('JEE ADVANCED MOCK TEST');
        expect(found.examType).toBe('JEE');
    });

    test('TEST 8: Frontend response shape contains { exam: ... }', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Response Structure Verification',
                examType: 'CET',
                subjectAssignments: [
                    { subject: 'Physics', teacherId: physicsTeacher._id, targetQuestions: 60 }
                ]
            });
        expect(res.body).toHaveProperty('exam');
        expect(res.body.exam).toHaveProperty('_id');
        if (res.body.exam?._id) testExamsCreated.push(res.body.exam._id);
    });

    test('TEST 9: Created faculty appears in GET /api/admin/teachers', async () => {
        const res = await request(app)
            .get('/api/admin/teachers')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const foundPhysics = res.body.find(t => t.email === physicsTeacher.email);
        expect(foundPhysics).toBeDefined();
        expect(foundPhysics._id).toBe(String(physicsTeacher._id));
    });

    test('TEST 10: Subject filtering matches active teachers', async () => {
        const res = await request(app)
            .get('/api/admin/teachers')
            .set('Authorization', `Bearer ${adminToken}`);
        const physicsOnly = res.body.filter(t => (t.subject || '').toLowerCase() === 'physics');
        const chemOnly = res.body.filter(t => (t.subject || '').toLowerCase() === 'chemistry');
        expect(physicsOnly.some(t => t.email === physicsTeacher.email)).toBe(true);
        expect(chemOnly.some(t => t.email === chemistryTeacher.email)).toBe(true);
    });

    test('TEST 11: Revoked/deleted faculty is removed from MongoDB and list', async () => {
        // Create a temporary teacher specifically to test deletion
        const tempTeacher = await new User({
            name: 'Temp Teacher to Delete',
            email: `temp.delete.${Date.now()}@sapthagiri.edu.in`,
            password: 'pwd',
            role: 'teacher',
            subject: 'Biology'
        }).save();

        const deleteRes = await request(app)
            .delete(`/api/admin/teachers/${tempTeacher._id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(deleteRes.status).toBe(200);

        const listRes = await request(app)
            .get('/api/admin/teachers')
            .set('Authorization', `Bearer ${adminToken}`);
        const found = listRes.body.find(t => t.email === tempTeacher.email);
        expect(found).toBeUndefined();
    });

    test('TEST 12: GET /api/exams/:id works for assigned faculty (Create Paper flow)', async () => {
        // Commission exam
        const commRes = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'CET Physics Assigned Mock',
                examType: 'CET',
                subjectAssignments: [
                    { subject: 'Physics', teacherId: physicsTeacher._id, targetQuestions: 60 }
                ]
            });
        const examId = commRes.body.exam._id;
        testExamsCreated.push(examId);

        // Fetch exam as assigned teacher
        const examRes = await request(app)
            .get(`/api/exams/${examId}`)
            .set('Authorization', `Bearer ${physicsTeacherToken}`);
        expect(examRes.status).toBe(200);
        expect(examRes.body.title).toBe('CET Physics Assigned Mock');
        expect(examRes.body._id).toBe(String(examId));
    });

    test('TEST 13: Unrelated faculty cannot access another assignment', async () => {
        // Commission exam assigned ONLY to Physics teacher
        const commRes = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'CET Physics Only Mock',
                examType: 'CET',
                subjectAssignments: [
                    { subject: 'Physics', teacherId: physicsTeacher._id, targetQuestions: 60 }
                ]
            });
        const examId = commRes.body.exam._id;
        testExamsCreated.push(examId);

        // Chemistry teacher attempts to fetch
        const examRes = await request(app)
            .get(`/api/exams/${examId}`)
            .set('Authorization', `Bearer ${chemistryTeacherToken}`);
        expect(examRes.status).toBe(403);
    });

    test('TEST 14: Existing exam list GET /api/exams/commissioned works', async () => {
        const listRes = await request(app)
            .get('/api/exams/commissioned')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(listRes.status).toBe(200);
        expect(Array.isArray(listRes.body)).toBe(true);
    });

    test('TEST 15: Existing Admin & Faculty authentication works with MongoDB', async () => {
        // 1. Admin login
        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'sapthagiripucollegedvg@gmail.com',
                password: process.env.ADMIN_PASSWORD || 'Sapthagiri1'
            });
        expect(adminLoginRes.status).toBe(200);
        expect(adminLoginRes.body.user.role).toBe('admin');

        // 2. Faculty login (MongoDB primary lookup)
        const teacherLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: physicsTeacher.email,
                password: 'Password123'
            });
        expect(teacherLoginRes.status).toBe(200);
        expect(teacherLoginRes.body.user.role).toBe('teacher');
        expect(teacherLoginRes.body.user.subject).toBe('Physics');
    });

    test('TEST 16: PostgreSQL UUID supplied as teacherId returns 400, not 500 CastError', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'UUID Teacher Test',
                examType: 'CET',
                subjectAssignments: [
                    {
                        subject: 'Physics',
                        teacherId: '550e8400-e29b-41d4-a716-446655440000', // Postgres UUID
                        targetQuestions: 60
                    }
                ]
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toContain('Invalid MongoDB faculty ID');
    });

    test('TEST 17: Legacy PostgreSQL UUID admin ID in token does not cause CastError in createdBy', async () => {
        const legacyAdminToken = generateToken({
            id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a', // Postgres UUID
            role: 'admin'
        });

        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${legacyAdminToken}`)
            .send({
                title: 'Legacy Admin Commission Test',
                examType: 'CET',
                subjectAssignments: [
                    {
                        subject: 'Physics',
                        teacherId: physicsTeacher._id,
                        targetQuestions: 60
                    }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body.exam).toBeDefined();
        expect(res.body.exam.title).toBe('Legacy Admin Commission Test');
        if (res.body.exam?._id) testExamsCreated.push(res.body.exam._id);
    });

    test('TEST 18: CET commissioning with 4 subjects resolves and creates all 4 assignments', async () => {
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Full CET 4-Subject Exam',
                examType: 'CET',
                classes: ['12'],
                subjectAssignments: [
                    { subject: 'Physics', teacherId: physicsTeacher._id, targetQuestions: 60 },
                    { subject: 'Chemistry', teacherId: chemistryTeacher._id, targetQuestions: 60 },
                    { subject: 'Mathematics', teacherId: physicsTeacher._id, targetQuestions: 60 },
                    { subject: 'Biology', teacherId: chemistryTeacher._id, targetQuestions: 60 }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body.exam.subjectAssignments.length).toBe(4);
        if (res.body.exam?._id) testExamsCreated.push(res.body.exam._id);
    });

    test('TEST 19: Nonexistent MongoDB teacher ObjectId returns controlled 400', async () => {
        const fakeValidObjectId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post('/api/exams/commission')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Nonexistent Teacher Test',
                examType: 'JEE',
                subjectAssignments: [
                    { subject: 'Physics', teacherId: fakeValidObjectId, targetQuestions: 25 }
                ]
            });
        expect(res.status).toBe(400);
        expect(res.body.msg).toContain('Selected Physics faculty was not found.');
    });
});

