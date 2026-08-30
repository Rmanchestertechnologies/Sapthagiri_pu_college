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
