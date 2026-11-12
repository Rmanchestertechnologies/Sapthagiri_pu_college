const path = require('path');
// ENV_FILE selects another environment file (e.g. a throwaway local test database) instead of server/.env
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { buildSsl } = require('../config/dbSsl');

// Connection strings come from the environment (DATABASE_URL, optionally DIRECT_DATABASE_URL). They used to be
// written into this file together with the password.
const poolerUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_DATABASE_URL;

async function init() {
    if (!poolerUrl && !directUrl) throw new Error('Set DATABASE_URL (and optionally DIRECT_DATABASE_URL) in server/.env first.');
    const target = (u) => { try { const x = new URL(u); return `${x.hostname}:${x.port || 5432}`; } catch { return '(unparseable)'; } };
    const max = Number(process.env.DB_POOL_MAX) > 0 ? Number(process.env.DB_POOL_MAX) : 10;
    // The script connects to DATABASE_URL, or to DIRECT_DATABASE_URL when run with --direct. It used to fall back to
    // the other URL on ANY failure, so a failed connection to a test database silently ran the schema script against
    // the production one.
    const useDirect = process.argv.includes('--direct');
    const url = useDirect ? directUrl : poolerUrl;
    if (!url) throw new Error(useDirect ? 'DIRECT_DATABASE_URL is not set.' : 'DATABASE_URL is not set.');
    console.log(`Connecting to ${target(url)} (${useDirect ? 'DIRECT_DATABASE_URL' : 'DATABASE_URL'})...`);
    const pool = new Pool({ connectionString: url, ssl: buildSsl(), max });
    await pool.query('SELECT 1');
    console.log('✅ Connected');

    // 1. Users Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'teacher',
            subject VARCHAR(100),
            phone VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Created users table');

    // 2. Papers Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.papers (
            id SERIAL PRIMARY KEY,
            paper_id VARCHAR(100) UNIQUE,
            title VARCHAR(255) NOT NULL,
            subject VARCHAR(100) NOT NULL,
            class_level VARCHAR(50),
            exam_type VARCHAR(50) DEFAULT 'CET',
            duration_minutes INTEGER DEFAULT 60,
            total_marks INTEGER DEFAULT 60,
            instructions TEXT,
            questions JSONB DEFAULT '[]'::jsonb,
            versions JSONB DEFAULT '{}'::jsonb,
            layout_settings JSONB DEFAULT '{}'::jsonb,
            created_by VARCHAR(255),
            author_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'Finalized',
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Created papers table');

    // 3. Templates Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            subject VARCHAR(100),
            exam_type VARCHAR(50),
            class_level VARCHAR(50),
            duration_minutes INTEGER DEFAULT 60,
            total_marks INTEGER DEFAULT 60,
            header_config JSONB DEFAULT '{}'::jsonb,
            sections JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Created templates table');

    // 4. Exam Blueprints Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.exam_blueprints (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            exam_type VARCHAR(50) NOT NULL,
            duration_minutes INTEGER DEFAULT 180,
            subjects JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Created exam_blueprints table');

    // 5. Notifications Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.notifications (
            id SERIAL PRIMARY KEY,
            recipient_role VARCHAR(50) DEFAULT 'admin',
            recipient_id VARCHAR(255),
            sender_id VARCHAR(255),
            sender_name VARCHAR(255),
            question_id VARCHAR(255),
            related_paper_id VARCHAR(255),
            type VARCHAR(50),
            title VARCHAR(255) NOT NULL,
            message TEXT,
            difficulty VARCHAR(50),
            metadata JSONB DEFAULT '{}'::jsonb,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            read_at TIMESTAMP WITH TIME ZONE
        );
    `);
    console.log('✅ Created notifications table');

    // 6. Audit Logs Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.audit_logs (
            id SERIAL PRIMARY KEY,
            action VARCHAR(100) NOT NULL,
            actor_id VARCHAR(255),
            actor_role VARCHAR(50),
            details JSONB DEFAULT '{}'::jsonb,
            ip_address VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Created audit_logs table');

    // 7. Grand Tests Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.grand_test_papers (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            exam_type VARCHAR(50) NOT NULL,
            pdf_path TEXT,
            class_level VARCHAR(50),
            total_questions INTEGER DEFAULT 180,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Created grand_test_papers table');

    // 8. Previous Year Papers Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.previous_year_papers (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            exam_type VARCHAR(50) NOT NULL,
            year INTEGER,
            subject VARCHAR(100),
            pdf_path TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Created previous_year_papers table');

    // 9. Question Usage Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.question_usage (
            id SERIAL PRIMARY KEY,
            question_id UUID NOT NULL,
            paper_id VARCHAR(255),
            teacher_id VARCHAR(255),
            teacher_name VARCHAR(255),
            exam_name VARCHAR(255),
            exam_date DATE DEFAULT CURRENT_DATE,
            used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_question_usage_qid ON public.question_usage(question_id);
    `);
    console.log('✅ Created question_usage table');

    // 10. Online Exams Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.online_exams (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            exam_type VARCHAR(50) DEFAULT 'CET',
            blueprint_id VARCHAR(255),
            source_papers JSONB DEFAULT '[]'::jsonb,
            questions JSONB DEFAULT '[]'::jsonb,
            instructions TEXT DEFAULT '',
            start_time TIMESTAMP WITH TIME ZONE,
            end_time TIMESTAMP WITH TIME ZONE,
            duration_minutes INTEGER DEFAULT 180,
            status VARCHAR(50) DEFAULT 'draft',
            shuffle_questions BOOLEAN DEFAULT FALSE,
            exam_mode VARCHAR(50) DEFAULT 'ONLINE',
            sections JSONB DEFAULT '[]'::jsonb,
            subject_assignments JSONB DEFAULT '[]'::jsonb,
            classes JSONB DEFAULT '["12"]'::jsonb,
            allowed_students JSONB DEFAULT '[]'::jsonb,
            created_by VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_online_exams_status ON public.online_exams(status);
    `);
    console.log('✅ Created online_exams table');

    // 11. Exam Sessions Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.exam_sessions (
            id SERIAL PRIMARY KEY,
            exam_id VARCHAR(255) NOT NULL,
            student_id VARCHAR(255) NOT NULL,
            student_name VARCHAR(255) DEFAULT 'Student',
            student_email VARCHAR(255) DEFAULT '',
            roll_number VARCHAR(100) DEFAULT '',
            from_lab_ip BOOLEAN DEFAULT FALSE,
            client_ip VARCHAR(100) DEFAULT '',
            start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            end_time TIMESTAMP WITH TIME ZONE,
            submitted BOOLEAN DEFAULT FALSE,
            answers JSONB DEFAULT '[]'::jsonb,
            score NUMERIC DEFAULT 0,
            total_questions INTEGER DEFAULT 0,
            attempted INTEGER DEFAULT 0,
            correct INTEGER DEFAULT 0,
            incorrect INTEGER DEFAULT 0,
            unattempted INTEGER DEFAULT 0,
            weak_areas JSONB DEFAULT '[]'::jsonb,
            malpractice_flag BOOLEAN DEFAULT FALSE,
            malpractice_reason TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON public.exam_sessions(exam_id);
    `);
    console.log('✅ Created exam_sessions table');

    // OMR scan results (same definition as migrations/004_omr_submissions.sql)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.omr_submissions (
            id SERIAL PRIMARY KEY,
            paper_id TEXT NOT NULL,
            teacher_id TEXT NOT NULL,
            roll_number TEXT NOT NULL,
            student_name TEXT,
            detected_series TEXT,
            detected_answers JSONB DEFAULT '{}'::jsonb,
            correct_answers JSONB DEFAULT '[]'::jsonb,
            score_data JSONB DEFAULT '{}'::jsonb,
            subject_scores JSONB DEFAULT '{}'::jsonb,
            concept_analysis JSONB DEFAULT '[]'::jsonb,
            image_path TEXT,
            scan_status TEXT DEFAULT 'processed',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_omr_submissions_paper ON public.omr_submissions (paper_id);
    `);
    console.log('✅ Created omr_submissions table');

    // 12. Students Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.students (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            roll_number VARCHAR(100) UNIQUE NOT NULL,
            section VARCHAR(50) DEFAULT 'II-PUC',
            email VARCHAR(255) DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_students_roll ON public.students(roll_number);
    `);
    console.log('✅ Created students table');

    // 13. Bridge Keys Table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.bridge_keys (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            exam_id VARCHAR(255) NOT NULL,
            exam_title VARCHAR(255),
            generated_by VARCHAR(255),
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
        );
    `);
    console.log('✅ Created bridge_keys table');

    // 14. Ensure columns on public.papers
    await pool.query(`
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(255);
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS exam_id VARCHAR(255);
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS question_objects JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS template_id VARCHAR(255);
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS pattern JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS difficulty_distribution JSONB DEFAULT '{"easy":40,"medium":40,"hard":20}'::jsonb;
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS is_assignment BOOLEAN DEFAULT FALSE;
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS duration VARCHAR(50);
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS start_q_no INTEGER DEFAULT 1;
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS end_q_no INTEGER;
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS classes JSONB DEFAULT '["12"]'::jsonb;
    `);
    console.log('✅ Ensured papers columns');

    // Columns the application uses that the CREATE TABLE statements above did not include. They exist in the production
    // database (checked against it, names and types) but a database built from this script lacked them, so saving a
    // paper, toggling exam visibility and the lab student lookup all failed on a fresh install.
    await pool.query(`
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS omr_access BOOLEAN DEFAULT FALSE;
        ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.online_exams ADD COLUMN IF NOT EXISTS is_online_visible BOOLEAN DEFAULT TRUE;
        ALTER TABLE public.students ADD COLUMN IF NOT EXISTS enrollment_no VARCHAR(100);
        ALTER TABLE public.students ADD COLUMN IF NOT EXISTS sats_no VARCHAR(100);
        ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_level VARCHAR(50) DEFAULT 'II-PUC';
    `);
    console.log('✅ Ensured application columns (papers.sections, online_exams.is_online_visible, students.*)');

    // Seed accounts. Passwords come from the environment, and EXISTING accounts are never modified: this
    // script used to reset the admin and all five faculty passwords to a fixed default every time it ran.
    const adminEmail = 'sapthagiripucollegedvg@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
        const existingAdmin = await pool.query('SELECT 1 FROM public.users WHERE email = $1', [adminEmail]);
        if (existingAdmin.rows.length === 0) {
            await pool.query(`
                INSERT INTO public.users (name, email, password, role, subject)
                VALUES ($1, $2, $3, $4, $5)
            `, ['Sapthagiri Admin', adminEmail, await bcrypt.hash(adminPassword, 10), 'admin', 'Administration']);
            console.log('✅ Seeded Admin user: ' + adminEmail);
        } else {
            console.log('ℹ️ Admin user already exists; left unchanged.');
        }
    } else {
        console.log('ℹ️ ADMIN_PASSWORD is not set; admin user not seeded.');
    }

    // Optional starter faculty accounts, only when SEED_FACULTY_PASSWORD is provided.
    const facultyPassword = process.env.SEED_FACULTY_PASSWORD;
    if (facultyPassword) {
        const hashedFaculty = await bcrypt.hash(facultyPassword, 10);
        const faculty = [
            { name: 'Physics Faculty', email: 'physics@gmail.com', subject: 'Physics' },
            { name: 'Chemistry Faculty', email: 'chemistry@gmail.com', subject: 'Chemistry' },
            { name: 'Biology Faculty', email: 'biology@gmail.com', subject: 'Biology' },
            { name: 'Maths Faculty', email: 'maths@gmail.com', subject: 'Maths' },
            { name: 'Mathematics Faculty', email: 'mathematics@gmail.com', subject: 'Mathematics' }
        ];
        for (const f of faculty) {
            const existing = await pool.query('SELECT 1 FROM public.users WHERE email = $1', [f.email]);
            if (existing.rows.length === 0) {
                await pool.query(`
                    INSERT INTO public.users (name, email, password, role, subject)
                    VALUES ($1, $2, $3, 'teacher', $4)
                `, [f.name, f.email, hashedFaculty, f.subject]);
                console.log('✅ Seeded Faculty user: ' + f.email);
            } else {
                console.log('ℹ️ Faculty user already exists; left unchanged: ' + f.email);
            }
        }
    } else {
        console.log('ℹ️ SEED_FACULTY_PASSWORD is not set; starter faculty accounts not seeded.');
    }

    // Seed Welcome Notification
    const notifCount = await pool.query('SELECT COUNT(*) FROM public.notifications');
    if (parseInt(notifCount.rows[0].count, 10) === 0) {
        await pool.query(`
            INSERT INTO public.notifications (recipient_role, title, message, type)
            VALUES ('admin', 'Welcome to Sapthagiri PU College Question Paper Generator', 'System initialized with official college branding and Supabase PostgreSQL persistence.', 'SYSTEM')
        `);
        console.log('✅ Seeded welcome notification');
    }

    console.log('🎉 Supabase PostgreSQL Database Initialized Successfully!');
    await pool.end();
}

init().catch(err => {
    console.error('❌ Init error:', err);
    process.exit(1);
});
