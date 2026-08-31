const pool = require('../config/postgres');
const mongoose = require('mongoose');

// Helper: map a Postgres online_exams row to standard JS object
function mapExamRow(r) {
    if (!r) return null;
    return {
        _id: String(r.id),
        id: r.id,
        title: r.title,
        examType: r.exam_type,
        blueprintId: r.blueprint_id,
        sourcePapers: r.source_papers || [],
        questions: r.questions || [],
        instructions: r.instructions || '',
        start_time: r.start_time,
        end_time: r.end_time,
        duration_minutes: r.duration_minutes,
        status: r.status || 'draft',
        shuffleQuestions: r.shuffle_questions,
        examMode: r.exam_mode || 'ONLINE',
        sections: r.sections || [],
        subjectAssignments: (r.subject_assignments || []).map((sa, idx) => ({
            _id: sa._id || `sa_${r.id}_${idx}`,
            subject: sa.subject,
            teacherId: sa.teacherId ? String(sa.teacherId) : undefined,
            teacherName: sa.teacherName,
            teacherEmail: sa.teacherEmail,
            targetQuestions: sa.targetQuestions || 60,
            difficultyDistribution: sa.difficultyDistribution || { easy: 40, medium: 40, hard: 20 },
            submittedPaperId: sa.submittedPaperId ? String(sa.submittedPaperId) : null,
            status: sa.status || 'Pending',
            assignedDate: sa.assignedDate || r.created_at
        })),
        classes: r.classes || ['12'],
        allowedStudents: r.allowed_students || [],
        createdBy: r.created_by ? { _id: String(r.created_by), name: 'Admin', email: 'sapthagiripucollegedvg@gmail.com' } : null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
    };
}

// Helper: map a Postgres papers row to standard JS object
function mapPaperRow(r) {
    if (!r) return null;
    return {
        _id: String(r.id),
        id: r.id,
        paper_id: r.paper_id,
        title: r.title,
        subject: r.subject,
        class_level: r.class_level,
        classes: r.classes || [r.class_level || '12'],
        exam_type: r.exam_type || 'CET',
        examType: r.exam_type || 'CET',
        duration_minutes: r.duration_minutes,
        duration: r.duration || `${r.duration_minutes || 60} mins`,
        total_marks: r.total_marks,
        instructions: r.instructions || '',
        questions: r.questions || [],
        questionObjects: r.question_objects || [],
        versions: r.versions || {},
        layout_settings: r.layout_settings || {},
        created_by: r.created_by,
        author_id: r.author_id,
        teacherId: r.teacher_id || r.created_by || r.author_id,
        examId: r.exam_id,
        templateId: r.template_id,
        pattern: r.pattern || [],
        difficultyDistribution: r.difficulty_distribution || { easy: 40, medium: 40, hard: 20 },
        isAssignment: r.is_assignment || false,
        startQNo: r.start_q_no || 1,
        endQNo: r.end_q_no,
        status: r.status || 'Finalized',
        metadata: r.metadata || {},
        createdAt: r.created_at,
        updatedAt: r.updated_at
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMS
// ─────────────────────────────────────────────────────────────────────────────

async function createExam(examData) {
    const {
        title,
        examType = 'CET',
        blueprintId = null,
        sourcePapers = [],
        questions = [],
        instructions = '',
        start_time = null,
        end_time = null,
        duration_minutes = 180,
        status = 'draft',
        shuffleQuestions = false,
        examMode = 'ONLINE',
        sections = [],
        subjectAssignments = [],
        classes = ['12'],
        allowedStudents = [],
        createdBy = null
    } = examData;

    const res = await pool.query(`
        INSERT INTO public.online_exams (
            title, exam_type, blueprint_id, source_papers, questions,
            instructions, start_time, end_time, duration_minutes, status,
            shuffle_questions, exam_mode, sections, subject_assignments,
            classes, allowed_students, created_by
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17
        ) RETURNING *
    `, [
        title,
        examType,
        blueprintId ? String(blueprintId) : null,
        JSON.stringify(sourcePapers),
        JSON.stringify(questions),
        instructions,
        start_time,
        end_time,
        duration_minutes,
        status,
        shuffleQuestions,
        examMode,
        JSON.stringify(sections),
        JSON.stringify(subjectAssignments),
        JSON.stringify(Array.isArray(classes) ? classes : [classes]),
        JSON.stringify(allowedStudents),
        createdBy ? String(createdBy) : null
    ]);

    const exam = mapExamRow(res.rows[0]);

    // Secondary sync to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
        try {
            const OnlineExam = require('../models/OnlineExam');
            const mExam = new OnlineExam({
                ...examData,
                _id: new mongoose.Types.ObjectId()
            });
            await mExam.save();
        } catch (mErr) {
            console.warn('[STORAGE] MongoDB exam sync notice:', mErr.message);
        }
    }

    return exam;
}

async function getExams() {
    const res = await pool.query('SELECT * FROM public.online_exams ORDER BY created_at DESC');
    return res.rows.map(mapExamRow);
}

async function getExamById(id) {
    if (!id) return null;
    const cleanId = String(id).replace(/^exam_/, '');
    const isNum = /^\d+$/.test(cleanId);
    let res;
    if (isNum) {
        res = await pool.query('SELECT * FROM public.online_exams WHERE id = $1', [parseInt(cleanId, 10)]);
    } else {
        res = await pool.query('SELECT * FROM public.online_exams WHERE id::text = $1 OR title = $2', [cleanId, cleanId]);
    }
    return res.rows[0] ? mapExamRow(res.rows[0]) : null;
}

async function updateExam(id, updateData) {
    if (!id) return null;
    const current = await getExamById(id);
    if (!current) return null;

    const merged = { ...current, ...updateData };

    const res = await pool.query(`
        UPDATE public.online_exams SET
            title = $1,
            exam_type = $2,
            blueprint_id = $3,
            source_papers = $4,
            questions = $5,
            instructions = $6,
            start_time = $7,
            end_time = $8,
            duration_minutes = $9,
            status = $10,
            shuffle_questions = $11,
            exam_mode = $12,
            sections = $13,
            subject_assignments = $14,
            classes = $15,
            allowed_students = $16,
            updated_at = NOW()
        WHERE id = $17
        RETURNING *
    `, [
        merged.title,
        merged.examType || merged.exam_type || 'CET',
        merged.blueprintId ? String(merged.blueprintId) : null,
        JSON.stringify(merged.sourcePapers || []),
        JSON.stringify(merged.questions || []),
        merged.instructions || '',
        merged.start_time || null,
        merged.end_time || null,
        merged.duration_minutes || 180,
        merged.status || 'draft',
        merged.shuffleQuestions || false,
        merged.examMode || 'ONLINE',
        JSON.stringify(merged.sections || []),
        JSON.stringify(merged.subjectAssignments || []),
        JSON.stringify(merged.classes || ['12']),
        JSON.stringify(merged.allowedStudents || []),
        current.id
    ]);

    return mapExamRow(res.rows[0]);
}

async function deleteExam(id) {
    if (!id) return false;
    const cleanId = String(id).replace(/^exam_/, '');
    const isNum = /^\d+$/.test(cleanId);
    if (isNum) {
        await pool.query('DELETE FROM public.online_exams WHERE id = $1', [parseInt(cleanId, 10)]);
    } else {
        await pool.query('DELETE FROM public.online_exams WHERE id::text = $1', [cleanId]);
    }
    return true;
}

async function getTeacherAssignments(userId, userSubject) {
    const allExams = await getExams();
    const cleanSubject = (userSubject || '').toLowerCase().trim();
    const cleanUserId = String(userId || '');

    return allExams.filter(exam => {
        if (!Array.isArray(exam.subjectAssignments)) return false;
        return exam.subjectAssignments.some(sa => {
            const saTeacherId = String(sa.teacherId || '');
            const saSub = (sa.subject || '').toLowerCase().trim();
            const teacherMatch = cleanUserId && saTeacherId === cleanUserId;
            const subMatch = cleanSubject && (
                saSub === cleanSubject ||
                (cleanSubject.includes('math') && saSub.includes('math')) ||
                (cleanSubject.includes('bio') && saSub.includes('bio')) ||
                (cleanSubject.includes('chem') && saSub.includes('chem')) ||
                (cleanSubject.includes('physic') && saSub.includes('physic'))
            );
            return teacherMatch || subMatch;
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAPERS
// ─────────────────────────────────────────────────────────────────────────────

async function savePaper(paperData) {
    const {
        paper_id = `paper_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title,
        subject,
        class_level = '12',
        classes = ['12'],
        exam_type = 'CET',
        examType = 'CET',
        duration_minutes = 60,
        total_marks = 60,
        instructions = '',
        questions = [],
        questionObjects = [],
        versions = {},
        layout_settings = {},
        created_by,
        author_id,
        teacherId,
        examId = null,
        templateId = null,
        pattern = [],
        difficultyDistribution = { easy: 40, medium: 40, hard: 20 },
        isAssignment = false,
        duration = '60 mins',
        startQNo = 1,
        endQNo = null,
        status = 'In Progress',
        metadata = {}
    } = paperData;

    const tId = teacherId || created_by || author_id;

    const res = await pool.query(`
        INSERT INTO public.papers (
            paper_id, title, subject, class_level, exam_type,
            duration_minutes, total_marks, instructions, questions,
            versions, layout_settings, created_by, author_id,
            status, metadata, teacher_id, exam_id, question_objects,
            template_id, pattern, difficulty_distribution, is_assignment,
            duration, start_q_no, end_q_no, classes
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17, $18,
            $19, $20, $21, $22,
            $23, $24, $25, $26
        ) RETURNING *
    `, [
        paper_id,
        title,
        subject,
        class_level,
        exam_type || examType,
        duration_minutes,
        total_marks,
        instructions,
        JSON.stringify(questions),
        JSON.stringify(versions),
        JSON.stringify(layout_settings),
        tId ? String(tId) : null,
        tId ? String(tId) : null,
        status,
        JSON.stringify(metadata),
        tId ? String(tId) : null,
        examId ? String(examId) : null,
        JSON.stringify(questionObjects),
        templateId ? String(templateId) : null,
        JSON.stringify(pattern),
        JSON.stringify(difficultyDistribution),
        isAssignment,
        duration,
        startQNo,
        endQNo,
        JSON.stringify(classes)
    ]);

    const paper = mapPaperRow(res.rows[0]);

    // Secondary sync to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
        try {
            const Paper = require('../models/Paper');
            const mPaper = new Paper({
                ...paperData,
                teacherId: String(tId)
            });
            await mPaper.save();
        } catch (mErr) {
            console.warn('[STORAGE] MongoDB paper sync notice:', mErr.message);
        }
    }

    return paper;
}

async function getPapers(teacherId = null) {
    let res;
    if (teacherId) {
        res = await pool.query(
            'SELECT * FROM public.papers WHERE teacher_id = $1 OR created_by = $1 OR author_id = $1 ORDER BY created_at DESC',
            [String(teacherId)]
        );
    } else {
        res = await pool.query('SELECT * FROM public.papers ORDER BY created_at DESC');
    }
    return res.rows.map(mapPaperRow);
}

async function getPaperById(id) {
    if (!id) return null;
    const cleanId = String(id).replace(/^paper_/, '');
    const isNum = /^\d+$/.test(cleanId);
    let res;
    if (isNum) {
        res = await pool.query('SELECT * FROM public.papers WHERE id = $1', [parseInt(cleanId, 10)]);
    } else {
        res = await pool.query('SELECT * FROM public.papers WHERE id::text = $1 OR paper_id = $2', [cleanId, cleanId]);
    }
    return res.rows[0] ? mapPaperRow(res.rows[0]) : null;
}

async function updatePaper(id, updateData) {
    if (!id) return null;
    const current = await getPaperById(id);
    if (!current) return null;

    const merged = { ...current, ...updateData };

    const res = await pool.query(`
        UPDATE public.papers SET
            title = $1,
            subject = $2,
            class_level = $3,
            exam_type = $4,
            duration_minutes = $5,
            total_marks = $6,
            instructions = $7,
            questions = $8,
            versions = $9,
            layout_settings = $10,
            status = $11,
            metadata = $12,
            question_objects = $13,
            template_id = $14,
            pattern = $15,
            difficulty_distribution = $16,
            is_assignment = $17,
            duration = $18,
            start_q_no = $19,
            end_q_no = $20,
            classes = $21,
            updated_at = NOW()
        WHERE id = $22
        RETURNING *
    `, [
        merged.title,
        merged.subject,
        merged.class_level || merged.classLevel,
        merged.exam_type || merged.examType,
        merged.duration_minutes || merged.durationMinutes,
        merged.total_marks || merged.totalMarks,
        merged.instructions,
        JSON.stringify(merged.questions || []),
        JSON.stringify(merged.versions || {}),
        JSON.stringify(merged.layout_settings || {}),
        merged.status,
        JSON.stringify(merged.metadata || {}),
        JSON.stringify(merged.questionObjects || []),
        merged.templateId ? String(merged.templateId) : null,
        JSON.stringify(merged.pattern || []),
        JSON.stringify(merged.difficultyDistribution || {}),
        merged.isAssignment || false,
        merged.duration || '60 mins',
        merged.startQNo || 1,
        merged.endQNo || null,
        JSON.stringify(merged.classes || ['12']),
        current.id
    ]);

    return mapPaperRow(res.rows[0]);
}

async function deletePaper(id) {
    if (!id) return false;
    const cleanId = String(id).replace(/^paper_/, '');
    const isNum = /^\d+$/.test(cleanId);
    if (isNum) {
        await pool.query('DELETE FROM public.papers WHERE id = $1', [parseInt(cleanId, 10)]);
    } else {
        await pool.query('DELETE FROM public.papers WHERE id::text = $1 OR paper_id = $2', [cleanId, cleanId]);
    }
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAM BLUEPRINTS
// ─────────────────────────────────────────────────────────────────────────────

async function getBlueprints() {
    const res = await pool.query('SELECT * FROM public.exam_blueprints ORDER BY created_at DESC');
    return res.rows.map(r => ({
        _id: String(r.id),
        id: r.id,
        name: r.name,
        examType: r.exam_type,
        durationMinutes: r.duration_minutes,
        subjects: r.subjects || [],
        createdAt: r.created_at
    }));
}

async function saveBlueprint(data) {
    const res = await pool.query(`
        INSERT INTO public.exam_blueprints (name, exam_type, duration_minutes, subjects)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [data.name, data.examType || data.exam_type || 'CET', data.durationMinutes || 180, JSON.stringify(data.subjects || [])]);

    const r = res.rows[0];
    return {
        _id: String(r.id),
        id: r.id,
        name: r.name,
        examType: r.exam_type,
        durationMinutes: r.duration_minutes,
        subjects: r.subjects || [],
        createdAt: r.created_at
    };
}

async function seedDefaultBlueprints() {
    try {
        const countRes = await pool.query('SELECT COUNT(*) FROM public.exam_blueprints');
        if (parseInt(countRes.rows[0].count, 10) === 0) {
            console.log('🌱 Seeding default blueprints in PostgreSQL...');
            const defaultBlueprints = [
                {
                    name: 'NEET Default (180 Qs)',
                    exam_type: 'NEET',
                    duration_minutes: 180,
                    subjects: [
                        { subjectName: 'Physics', totalQuestions: 45, sections: [{ sectionName: 'Physics Section', numQuestions: 45, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }] },
                        { subjectName: 'Chemistry', totalQuestions: 45, sections: [{ sectionName: 'Chemistry Section', numQuestions: 45, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }] },
                        { subjectName: 'Biology', totalQuestions: 90, sections: [{ sectionName: 'Biology Section', numQuestions: 90, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }] }
                    ]
                },
                {
                    name: 'KCET Default (60 Qs per paper)',
                    exam_type: 'CET',
                    duration_minutes: 80,
                    subjects: [
                        { subjectName: 'Physics', totalQuestions: 60, sections: [{ sectionName: 'Physics Section', numQuestions: 60, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } }] },
                        { subjectName: 'Chemistry', totalQuestions: 60, sections: [{ sectionName: 'Chemistry Section', numQuestions: 60, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } }] },
                        { subjectName: 'Mathematics', totalQuestions: 60, sections: [{ sectionName: 'Mathematics Section', numQuestions: 60, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } }] },
                        { subjectName: 'Biology', totalQuestions: 60, sections: [{ sectionName: 'Biology Section', numQuestions: 60, markingRules: { correct: 1, incorrect: 0, unattempted: 0 } }] }
                    ]
                },
                {
                    name: 'JEE Main Default (75 Qs)',
                    exam_type: 'JEE',
                    duration_minutes: 180,
                    subjects: [
                        { subjectName: 'Physics', totalQuestions: 25, sections: [{ sectionName: 'Physics MCQs', numQuestions: 20, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }, { sectionName: 'Physics Numericals', numQuestions: 5, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }] },
                        { subjectName: 'Chemistry', totalQuestions: 25, sections: [{ sectionName: 'Chemistry MCQs', numQuestions: 20, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }, { sectionName: 'Chemistry Numericals', numQuestions: 5, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }] },
                        { subjectName: 'Mathematics', totalQuestions: 25, sections: [{ sectionName: 'Mathematics MCQs', numQuestions: 20, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }, { sectionName: 'Mathematics Numericals', numQuestions: 5, markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }] }
                    ]
                }
            ];

            for (const bp of defaultBlueprints) {
                await pool.query(`
                    INSERT INTO public.exam_blueprints (name, exam_type, duration_minutes, subjects)
                    VALUES ($1, $2, $3, $4)
                `, [bp.name, bp.exam_type, bp.duration_minutes, JSON.stringify(bp.subjects)]);
            }
            console.log('✅ Seeded default blueprints in PostgreSQL!');
        }
    } catch (e) {
        console.warn('[STORAGE] Blueprint seeding notice:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAND TESTS & PYQs & TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

async function getGrandTests() {
    const res = await pool.query('SELECT * FROM public.grand_test_papers ORDER BY created_at DESC');
    return res.rows.map(r => ({
        _id: String(r.id),
        id: r.id,
        title: r.title,
        examType: r.exam_type,
        classLevel: r.class_level,
        pdfPath: r.pdf_path,
        totalQuestions: r.total_questions || 180,
        createdAt: r.created_at
    }));
}

async function saveGrandTest(data) {
    const res = await pool.query(`
        INSERT INTO public.grand_test_papers (title, exam_type, class_level, pdf_path, total_questions)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [data.title, data.examType || data.exam_type || 'CET', data.classLevel || data.class_level || '12', data.pdfPath || null, data.totalQuestions || 180]);
    const r = res.rows[0];
    return {
        _id: String(r.id),
        id: r.id,
        title: r.title,
        examType: r.exam_type,
        classLevel: r.class_level,
        pdfPath: r.pdf_path,
        totalQuestions: r.total_questions || 180,
        createdAt: r.created_at
    };
}

async function getPreviousYearPapers() {
    const res = await pool.query('SELECT * FROM public.previous_year_papers ORDER BY year DESC, created_at DESC');
    return res.rows.map(r => ({
        _id: String(r.id),
        id: r.id,
        title: r.title,
        examType: r.exam_type,
        year: r.year,
        subject: r.subject,
        pdfPath: r.pdf_path,
        createdAt: r.created_at
    }));
}

async function savePreviousYearPaper(data) {
    const res = await pool.query(`
        INSERT INTO public.previous_year_papers (title, exam_type, year, subject, pdf_path)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [data.title, data.examType || data.exam_type || 'CET', data.year || new Date().getFullYear(), data.subject || 'All', data.pdfPath || null]);
    const r = res.rows[0];
    return {
        _id: String(r.id),
        id: r.id,
        title: r.title,
        examType: r.exam_type,
        year: r.year,
        subject: r.subject,
        pdfPath: r.pdf_path,
        createdAt: r.created_at
    };
}

async function getTemplates() {
    const res = await pool.query('SELECT * FROM public.templates ORDER BY created_at DESC');
    return res.rows.map(r => ({
        _id: String(r.id),
        id: r.id,
        name: r.name,
        subject: r.subject,
        examType: r.exam_type,
        classLevel: r.class_level,
        durationMinutes: r.duration_minutes,
        totalMarks: r.total_marks,
        headerConfig: r.header_config || {},
        sections: r.sections || [],
        createdAt: r.created_at
    }));
}

async function saveTemplate(data) {
    const res = await pool.query(`
        INSERT INTO public.templates (name, subject, exam_type, class_level, duration_minutes, total_marks, header_config, sections)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [
        data.name || data.title || 'Standard Template',
        data.subject || null,
        data.examType || data.exam_type || 'CET',
        data.classLevel || data.class_level || '12',
        data.durationMinutes || data.duration_minutes || 60,
        data.totalMarks || data.total_marks || 60,
        JSON.stringify(data.headerConfig || {}),
        JSON.stringify(data.sections || [])
    ]);
    const r = res.rows[0];
    return {
        _id: String(r.id),
        id: r.id,
        name: r.name,
        subject: r.subject,
        examType: r.exam_type,
        classLevel: r.class_level,
        durationMinutes: r.duration_minutes,
        totalMarks: r.total_marks,
        headerConfig: r.header_config || {},
        sections: r.sections || [],
        createdAt: r.created_at
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAM SESSIONS & STUDENTS & BRIDGE KEYS
// ─────────────────────────────────────────────────────────────────────────────

async function createSession(sessionData) {
    const {
        examId, studentId, studentName = 'Student', studentEmail = '',
        rollNumber = '', fromLabIp = false, clientIp = '',
        answers = [], totalQuestions = 0
    } = sessionData;

    const res = await pool.query(`
        INSERT INTO public.exam_sessions (
            exam_id, student_id, student_name, student_email,
            roll_number, from_lab_ip, client_ip, answers, total_questions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `, [
        String(examId), String(studentId), studentName, studentEmail,
        rollNumber, fromLabIp, clientIp, JSON.stringify(answers), totalQuestions
    ]);
    const r = res.rows[0];
    return { ...r, _id: String(r.id), answers: r.answers || [] };
}

async function findActiveSession(examId, studentEmail, rollNumber) {
    let res;
    if (rollNumber) {
        res = await pool.query(
            'SELECT * FROM public.exam_sessions WHERE exam_id = $1 AND roll_number = $2 AND submitted = false LIMIT 1',
            [String(examId), rollNumber]
        );
    } else if (studentEmail) {
        res = await pool.query(
            'SELECT * FROM public.exam_sessions WHERE exam_id = $1 AND student_email = $2 AND submitted = false LIMIT 1',
            [String(examId), studentEmail]
        );
    }
    if (res && res.rows[0]) {
        const r = res.rows[0];
        return { ...r, _id: String(r.id), answers: r.answers || [] };
    }
    return null;
}

async function getSessionById(id) {
    if (!id) return null;
    const cleanId = String(id).replace(/^sess_/, '');
    const isNum = /^\d+$/.test(cleanId);
    let res;
    if (isNum) {
        res = await pool.query('SELECT * FROM public.exam_sessions WHERE id = $1', [parseInt(cleanId, 10)]);
    } else {
        res = await pool.query('SELECT * FROM public.exam_sessions WHERE id::text = $1', [cleanId]);
    }
    if (res.rows[0]) {
        const r = res.rows[0];
        return { ...r, _id: String(r.id), answers: r.answers || [] };
    }
    return null;
}

async function updateSession(id, updateData) {
    const current = await getSessionById(id);
    if (!current) return null;
    const merged = { ...current, ...updateData };

    const res = await pool.query(`
        UPDATE public.exam_sessions SET
            answers = $1,
            score = $2,
            attempted = $3,
            correct = $4,
            incorrect = $5,
            unattempted = $6,
            submitted = $7,
            end_time = $8,
            weak_areas = $9,
            malpractice_flag = $10,
            malpractice_reason = $11
        WHERE id = $12
        RETURNING *
    `, [
        JSON.stringify(merged.answers || []),
        merged.score || 0,
        merged.attempted || 0,
        merged.correct || 0,
        merged.incorrect || 0,
        merged.unattempted || 0,
        merged.submitted || false,
        merged.end_time || (merged.submitted ? new Date() : null),
        JSON.stringify(merged.weak_areas || merged.weakAreas || []),
        merged.malpractice_flag || merged.malpracticeFlag || false,
        merged.malpractice_reason || merged.malpracticeReason || '',
        current.id
    ]);
    const r = res.rows[0];
    return { ...r, _id: String(r.id), answers: r.answers || [] };
}

async function getSessionsByExam(examId) {
    const res = await pool.query(
        'SELECT * FROM public.exam_sessions WHERE exam_id = $1 ORDER BY score DESC, created_at ASC',
        [String(examId)]
    );
    return res.rows.map(r => ({ ...r, _id: String(r.id), answers: r.answers || [] }));
}

async function deleteSessionsByExam(examId) {
    await pool.query('DELETE FROM public.exam_sessions WHERE exam_id = $1', [String(examId)]);
}

async function createBridgeKey(key, examId, examTitle, generatedBy) {
    const res = await pool.query(`
        INSERT INTO public.bridge_keys (key, exam_id, exam_title, generated_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [key, String(examId), examTitle, String(generatedBy)]);
    return res.rows[0];
}

async function getBridgeKey(key) {
    const res = await pool.query('SELECT * FROM public.bridge_keys WHERE key = $1', [key]);
    return res.rows[0] || null;
}

module.exports = {
    // Exams
    createExam,
    getExams,
    getExamById,
    updateExam,
    deleteExam,
    getTeacherAssignments,

    // Papers
    savePaper,
    getPapers,
    getPaperById,
    updatePaper,
    deletePaper,

    // Sessions & Bridge
    createSession,
    findActiveSession,
    getSessionById,
    updateSession,
    getSessionsByExam,
    deleteSessionsByExam,
    createBridgeKey,
    getBridgeKey,

    // Blueprints
    getBlueprints,
    saveBlueprint,
    seedDefaultBlueprints,

    // Grand Tests & PYQs & Templates
    getGrandTests,
    saveGrandTest,
    getPreviousYearPapers,
    savePreviousYearPaper,
    getTemplates,
    saveTemplate
};
