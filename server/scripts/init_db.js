const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const poolerUrl = 'postgresql://postgres.vukxgqkrersxcasdklda:Sapthagiri1@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
const directUrl = 'postgresql://postgres:Sapthagiri1@db.vukxgqkrersxcasdklda.supabase.co:5432/postgres';

async function init() {
    console.log('Connecting to Supabase PostgreSQL...');
    let pool;
    try {
        pool = new Pool({ connectionString: poolerUrl, ssl: { rejectUnauthorized: false } });
        await pool.query('SELECT 1');
        console.log('✅ Connected via Supabase pooler!');
    } catch (e) {
        console.log('Pooler attempt failed, trying direct connection...');
        pool = new Pool({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
        await pool.query('SELECT 1');
        console.log('✅ Connected via direct URL!');
    }

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

    // Seed Admin Account
    const adminEmail = 'sapthagiripucollegedvg@gmail.com';
    const adminPassword = 'Sapthagiri1';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existingAdmin = await pool.query('SELECT * FROM public.users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
        await pool.query(`
            INSERT INTO public.users (name, email, password, role, subject)
            VALUES ($1, $2, $3, $4, $5)
        `, ['Sapthagiri Admin', adminEmail, hashedPassword, 'admin', 'Administration']);
        console.log('✅ Seeded Admin user: ' + adminEmail);
    } else {
        await pool.query(`
            UPDATE public.users SET password = $1 WHERE email = $2
        `, [hashedPassword, adminEmail]);
        console.log('✅ Updated Admin user password: ' + adminEmail);
    }

    // Seed Faculty Accounts with Sapthagiri1
    const faculty = [
        { name: 'Physics Faculty', email: 'physics@gmail.com', subject: 'Physics' },
        { name: 'Chemistry Faculty', email: 'chemistry@gmail.com', subject: 'Chemistry' },
        { name: 'Biology Faculty', email: 'biology@gmail.com', subject: 'Biology' },
        { name: 'Maths Faculty', email: 'maths@gmail.com', subject: 'Maths' },
        { name: 'Mathematics Faculty', email: 'mathematics@gmail.com', subject: 'Mathematics' }
    ];

    for (const f of faculty) {
        const existing = await pool.query('SELECT * FROM public.users WHERE email = $1', [f.email]);
        if (existing.rows.length === 0) {
            await pool.query(`
                INSERT INTO public.users (name, email, password, role, subject)
                VALUES ($1, $2, $3, 'teacher', $4)
            `, [f.name, f.email, hashedPassword, f.subject]);
            console.log('✅ Seeded Faculty user: ' + f.email);
        } else {
            await pool.query(`
                UPDATE public.users SET password = $1, subject = $2 WHERE email = $3
            `, [hashedPassword, f.subject, f.email]);
            console.log('✅ Updated Faculty user password: ' + f.email);
        }
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
