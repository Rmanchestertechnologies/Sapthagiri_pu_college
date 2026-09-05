const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

/**
 * 8 Dedicated Subject Databases Configuration
 * Each subject and class has its own isolated Supabase PostgreSQL database.
 */
const DB_CONFIGS = {
    math_11: {
        key: 'math_11',
        subject: 'Mathematics',
        klass: '11',
        name: 'Mathematics Class 11',
        projectId: 'lhnwhbhnexxifuuqnzho',
        envVar: 'DB_MATH_11_URL',
        defaultUrl: 'postgresql://postgres.lhnwhbhnexxifuuqnzho:SubClass11Maths@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    },
    math_12: {
        key: 'math_12',
        subject: 'Mathematics',
        klass: '12',
        name: 'Mathematics Class 12',
        projectId: 'lukbqotnuxoznnrsdqvz',
        envVar: 'DB_MATH_12_URL',
        defaultUrl: 'postgresql://postgres.lukbqotnuxoznnrsdqvz:SubClass12Maths@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    },
    chem_11: {
        key: 'chem_11',
        subject: 'Chemistry',
        klass: '11',
        name: 'Chemistry Class 11',
        projectId: 'tloqcflffxrrlbxyphtb',
        envVar: 'DB_CHEM_11_URL',
        defaultUrl: 'postgresql://postgres.tloqcflffxrrlbxyphtb:SubClass11Chemistry@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
    },
    chem_12: {
        key: 'chem_12',
        subject: 'Chemistry',
        klass: '12',
        name: 'Chemistry Class 12',
        projectId: 'dptruxcqfapmcmbxyobx',
        envVar: 'DB_CHEM_12_URL',
        defaultUrl: 'postgresql://postgres.dptruxcqfapmcmbxyobx:SubClass12Chemistry@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    },
    bio_11: {
        key: 'bio_11',
        subject: 'Biology',
        klass: '11',
        name: 'Biology Class 11',
        projectId: 'tcoaxdpzvzssnkclpvkt',
        envVar: 'DB_BIO_11_URL',
        defaultUrl: 'postgresql://postgres.tcoaxdpzvzssnkclpvkt:SubClass11Biology@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
    },
    bio_12: {
        key: 'bio_12',
        subject: 'Biology',
        klass: '12',
        name: 'Biology Class 12',
        projectId: 'zxxvxddkncoluvidbtpf',
        envVar: 'DB_BIO_12_URL',
        defaultUrl: 'postgresql://postgres.zxxvxddkncoluvidbtpf:SubClass12Biology@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
    },
    phy_11: {
        key: 'phy_11',
        subject: 'Physics',
        klass: '11',
        name: 'Physics Class 11',
        projectId: 'pfnlbyjsjxttdachegne',
        envVar: 'DB_PHY_11_URL',
        defaultUrl: 'postgresql://postgres.pfnlbyjsjxttdachegne:SubClass11Physics@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
    },
    phy_12: {
        key: 'phy_12',
        subject: 'Physics',
        klass: '12',
        name: 'Physics Class 12',
        projectId: 'fnbgbtvnqmccpvgpphua',
        envVar: 'DB_PHY_12_URL',
        defaultUrl: 'postgresql://postgres.fnbgbtvnqmccpvgpphua:SubClass12Physics@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    }
};

const pools = new Map();

for (const [key, cfg] of Object.entries(DB_CONFIGS)) {
    const connStr = process.env[cfg.envVar] || cfg.defaultUrl;
    const pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
        console.error(`[Pool error - ${cfg.name}]:`, err.message);
    });

    pools.set(key, {
        ...cfg,
        pool
    });
}

const BOTANY_CHAPTERS = [
    'The Living World',
    'Biological Classification',
    'Plant Kingdom',
    'Morphology of Flowering Plants',
    'Anatomy of Flowering Plants',
    'Cell: The Unit of Life',
    'Cell Cycle and Cell Division',
    'Photosynthesis in Higher Plants',
    'Respiration in Plants',
    'Plant Growth and Development',
    'Sexual Reproduction in Flowering Plants',
    'Principles of Inheritance and Variation',
    'Molecular Basis of Inheritance',
    'Microbes in Human Welfare',
    'Biotechnology: Principles and Processes',
    'Biotechnology and its Applications',
    'Organisms and Populations',
    'Biodiversity and Conservation'
];

const ZOOLOGY_CHAPTERS = [
    'Animal Kingdom',
    'Structural Organisation in Animals',
    'Biomolecules',
    'Breathing and Exchange of Gases',
    'Body Fluids and Circulation',
    'Excretory Products and their Elimination',
    'Excretory Products and Their Elimination',
    'Locomotion and Movement',
    'Neural Control and Coordination',
    'Chemical Coordination and Integration',
    'Human Reproduction',
    'Reproductive Health',
    'Evolution',
    'Human Health and Disease'
];

function normalizeSubject(sub) {
    if (!sub || typeof sub !== 'string') return null;
    const clean = sub.trim().toLowerCase();
    if (clean.includes('math')) return 'Mathematics';
    if (clean.includes('physic')) return 'Physics';
    if (clean.includes('chem')) return 'Chemistry';
    if (clean.includes('botany')) return 'Botany';
    if (clean.includes('zoology')) return 'Zoology';
    if (clean.includes('bio')) return 'Biology';
    return sub.trim();
}

function normalizeClass(klass) {
    if (!klass) return null;
    if (Array.isArray(klass)) {
        const has11 = klass.some(k => String(k).includes('11'));
        const has12 = klass.some(k => String(k).includes('12'));
        if (has11 && has12) return 'both';
        if (has11) return '11';
        if (has12) return '12';
        return null;
    }
    const str = String(klass).toLowerCase();
    if (str.includes('both') || (str.includes('11') && str.includes('12'))) return 'both';
    if (str.includes('11')) return '11';
    if (str.includes('12')) return '12';
    return null;
}

function getPoolForTarget(subject, klass = '12') {
    const normSub = normalizeSubject(subject);
    const normKlass = normalizeClass(klass) || '12';
    const effectiveKlass = normKlass === 'both' ? '12' : normKlass;

    let prefix = 'phy';
    if (normSub === 'Mathematics') prefix = 'math';
    else if (normSub === 'Chemistry') prefix = 'chem';
    else if (normSub === 'Biology' || normSub === 'Botany' || normSub === 'Zoology') prefix = 'bio';
    else if (normSub === 'Physics') prefix = 'phy';

    const key = `${prefix}_${effectiveKlass}`;
    return pools.get(key) || pools.get('phy_12');
}

function getPoolsForQuery(subject, klass) {
    const normSub = normalizeSubject(subject);
    const normKlass = normalizeClass(klass);

    const all = Array.from(pools.values());

    let filtered = all;

    if (normSub) {
        if (normSub === 'Botany' || normSub === 'Zoology' || normSub === 'Biology') {
            filtered = filtered.filter(p => p.subject.toLowerCase() === 'biology');
        } else {
            filtered = filtered.filter(p => p.subject.toLowerCase() === normSub.toLowerCase());
        }
    }

    if (normKlass && normKlass !== 'both') {
        filtered = filtered.filter(p => p.klass === normKlass);
    }

    return filtered.length > 0 ? filtered : all;
}

function getAllPools() {
    return Array.from(pools.values());
}

module.exports = {
    DB_CONFIGS,
    pools,
    BOTANY_CHAPTERS,
    ZOOLOGY_CHAPTERS,
    normalizeSubject,
    normalizeClass,
    getPoolForTarget,
    getPoolsForQuery,
    getAllPools
};
