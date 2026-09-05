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

const CLASS_11_BOTANY_CHAPTERS = [
    'The Living World',
    'Biological Classification',
    'Plant Kingdom',
    'Morphology of Flowering Plants',
    'Anatomy of Flowering Plants',
    'Cell: The Unit of Life',
    'Cell Cycle and Cell Division',
    'Photosynthesis in Higher Plants',
    'Respiration in Plants',
    'Plant Growth and Development'
];

const CLASS_11_ZOOLOGY_CHAPTERS = [
    'Animal Kingdom',
    'Structural Organisation in Animals',
    'Biomolecules',
    'Breathing and Exchange of Gases',
    'Body Fluids and Circulation',
    'Excretory Products and Their Elimination',
    'Locomotion and Movement',
    'Neural Control and Coordination',
    'Chemical Coordination and Integration'
];

const CLASS_12_BOTANY_CHAPTERS = [
    'Sexual Reproduction in Flowering Plants',
    'Principles of Inheritance and Variation',
    'Molecular Basis of Inheritance',
    'Microbes in Human Welfare',
    'Biotechnology: Principles and Processes',
    'Biotechnology and Its Applications',
    'Organisms and Populations',
    'Ecosystem',
    'Biodiversity and Conservation'
];

const CLASS_12_ZOOLOGY_CHAPTERS = [
    'Human Reproduction',
    'Reproductive Health',
    'Evolution',
    'Human Health and Disease',
    'Biotechnology: Principles and Processes',
    'Biotechnology and Its Applications'
];

const BOTANY_CHAPTERS = [
    ...CLASS_11_BOTANY_CHAPTERS,
    ...CLASS_12_BOTANY_CHAPTERS
];

const ZOOLOGY_CHAPTERS = [
    ...CLASS_11_ZOOLOGY_CHAPTERS,
    ...CLASS_12_ZOOLOGY_CHAPTERS
];

const BIOLOGY_SYLLABUS = {
    class_11: {
        botany: [
            {
                chapter: 'The Living World',
                concepts: [
                    'Diversity in the Living World',
                    'Taxonomic Categories'
                ]
            },
            {
                chapter: 'Biological Classification',
                concepts: [
                    'Kingdom Monera',
                    'Kingdom Protista',
                    'Kingdom Fungi',
                    'Kingdom Plantae',
                    'Kingdom Animalia',
                    'Viruses, Viroids, Prions and Lichens'
                ]
            },
            {
                chapter: 'Plant Kingdom',
                concepts: [
                    'Algae',
                    'Bryophytes',
                    'Pteridophytes',
                    'Gymnosperms',
                    'Angiosperms'
                ]
            },
            {
                chapter: 'Morphology of Flowering Plants',
                concepts: [
                    'The Root',
                    'The Stem',
                    'The Leaf',
                    'The Inflorescence',
                    'The Flower',
                    'The Fruit',
                    'The Seed',
                    'Semi-technical Description of a Typical Flowering Plant',
                    'Description of Some Important Families'
                ]
            },
            {
                chapter: 'Anatomy of Flowering Plants',
                concepts: [
                    'The Tissue System',
                    'Anatomy of Dicotyledonous and Monocotyledonous Plants'
                ]
            },
            {
                chapter: 'Cell: The Unit of Life',
                concepts: [
                    'What is a Cell?',
                    'Cell Theory',
                    'An Overview of Cell',
                    'Prokaryotic Cells',
                    'Eukaryotic Cells'
                ]
            },
            {
                chapter: 'Cell Cycle and Cell Division',
                concepts: [
                    'Cell Cycle',
                    'M Phase',
                    'Significance of Mitosis',
                    'Meiosis',
                    'Significance of Meiosis'
                ]
            },
            {
                chapter: 'Photosynthesis in Higher Plants',
                concepts: [
                    'What do we Know?',
                    'Early Experiments',
                    'Where does Photosynthesis take place?',
                    'How many Pigments are involved in Photosynthesis?',
                    'What is Light Reaction?',
                    'The Electron Transport',
                    'Where are the ATP and NADPH Used?',
                    'The C4 Pathway',
                    'Photorespiration',
                    'Factors affecting Photosynthesis'
                ]
            },
            {
                chapter: 'Respiration in Plants',
                concepts: [
                    'Do Plants Breathe?',
                    'Glycolysis',
                    'Fermentation',
                    'Aerobic Respiration',
                    'The Respiratory Balance Sheet',
                    'Amphibolic Pathway',
                    'Respiratory Quotient'
                ]
            },
            {
                chapter: 'Plant Growth and Development',
                concepts: [
                    'Growth',
                    'Differentiation, Dedifferentiation and Redifferentiation',
                    'Development',
                    'Plant Growth Regulators'
                ]
            }
        ],
        zoology: [
            {
                chapter: 'Animal Kingdom',
                concepts: [
                    'Basis of Classification',
                    'Classification of Animals'
                ]
            },
            {
                chapter: 'Structural Organisation in Animals',
                concepts: [
                    'Organ and Organ System',
                    'Frogs'
                ]
            },
            {
                chapter: 'Biomolecules',
                concepts: [
                    'How to Analyse Chemical Composition?',
                    'Primary and Secondary Metabolites',
                    'Biomacromolecules',
                    'Proteins',
                    'Polysaccharides',
                    'Nucleic Acids',
                    'Structure of Proteins',
                    'Enzymes'
                ]
            },
            {
                chapter: 'Breathing and Exchange of Gases',
                concepts: [
                    'Respiratory Organs',
                    'Mechanism of Breathing',
                    'Exchange of Gases',
                    'Transport of Gases',
                    'Regulation of Respiration',
                    'Disorders of Respiratory System'
                ]
            },
            {
                chapter: 'Body Fluids and Circulation',
                concepts: [
                    'Blood',
                    'Lymph (Tissue Fluid)',
                    'Circulatory Pathways',
                    'Double Circulation',
                    'Regulation of Cardiac Activity',
                    'Disorders of Circulatory System'
                ]
            },
            {
                chapter: 'Excretory Products and Their Elimination',
                concepts: [
                    'Human Excretory System',
                    'Urine Formation',
                    'Function of the Tubules',
                    'Mechanism of Concentration of the Filtrate',
                    'Regulation of Kidney Function',
                    'Micturition',
                    'Role of Other Organs in Excretion',
                    'Disorders of the Excretory System'
                ]
            },
            {
                chapter: 'Locomotion and Movement',
                concepts: [
                    'Types of Movement',
                    'Muscle',
                    'Skeletal System',
                    'Joints',
                    'Disorders of Muscular and Skeletal System'
                ]
            },
            {
                chapter: 'Neural Control and Coordination',
                concepts: [
                    'Neural System',
                    'Human Neural System',
                    'Neuron as Structural and Functional Unit of Neural System',
                    'Central Neural System'
                ]
            },
            {
                chapter: 'Chemical Coordination and Integration',
                concepts: [
                    'Endocrine Glands and Hormones',
                    'Human Endocrine System',
                    'Hormones of Heart, Kidney and Gastrointestinal Tract',
                    'Mechanism of Hormone Action'
                ]
            }
        ]
    },
    class_12: {
        botany: [
            {
                chapter: 'Sexual Reproduction in Flowering Plants',
                concepts: [
                    'Flower – A Fascinating Organ of Angiosperms',
                    'Pre-fertilisation: Structures and Events',
                    'Double Fertilisation',
                    'Post-fertilisation: Structures and Events',
                    'Apomixis and Polyembryony'
                ]
            },
            {
                chapter: 'Principles of Inheritance and Variation',
                concepts: [
                    "Mendel's Laws of Inheritance",
                    'Inheritance of One Gene',
                    'Inheritance of Two Genes',
                    'Polygenic Inheritance',
                    'Pleiotropy',
                    'Sex Determination',
                    'Mutation',
                    'Genetic Disorders'
                ]
            },
            {
                chapter: 'Molecular Basis of Inheritance',
                concepts: [
                    'The DNA',
                    'The Search for Genetic Material',
                    'RNA World',
                    'Replication',
                    'Transcription',
                    'Genetic Code',
                    'Translation',
                    'Regulation of Gene Expression',
                    'Human Genome Project',
                    'DNA Fingerprinting'
                ]
            },
            {
                chapter: 'Microbes in Human Welfare',
                concepts: [
                    'Microbes in Household Products',
                    'Microbes in Industrial Products',
                    'Microbes in Sewage Treatment',
                    'Microbes in Production of Biogas',
                    'Microbes as Biocontrol Agents',
                    'Microbes as Biofertilisers'
                ]
            },
            {
                chapter: 'Biotechnology: Principles and Processes',
                concepts: [
                    'Principles of Biotechnology',
                    'Tools of Recombinant DNA Technology',
                    'Processes of Recombinant DNA Technology'
                ]
            },
            {
                chapter: 'Biotechnology and Its Applications',
                concepts: [
                    'Biotechnological Applications in Agriculture',
                    'Biotechnological Applications in Medicine',
                    'Transgenic Animals',
                    'Ethical Issues'
                ]
            },
            {
                chapter: 'Organisms and Populations',
                concepts: [
                    'Populations'
                ]
            },
            {
                chapter: 'Ecosystem',
                concepts: [
                    'Ecosystem – Structure and Function',
                    'Productivity',
                    'Decomposition',
                    'Energy Flow',
                    'Ecological Pyramids'
                ]
            },
            {
                chapter: 'Biodiversity and Conservation',
                concepts: [
                    'Biodiversity',
                    'Biodiversity Conservation'
                ]
            }
        ],
        zoology: [
            {
                chapter: 'Human Reproduction',
                concepts: [
                    'The Male Reproductive System',
                    'The Female Reproductive System',
                    'Gametogenesis',
                    'Menstrual Cycle',
                    'Fertilisation and Implantation',
                    'Pregnancy and Embryonic Development',
                    'Parturition and Lactation'
                ]
            },
            {
                chapter: 'Reproductive Health',
                concepts: [
                    'Reproductive Health – Problems and Strategies',
                    'Population Explosion and Birth Control',
                    'Medical Termination of Pregnancy (MTP)',
                    'Sexually Transmitted Infections (STIs)',
                    'Infertility'
                ]
            },
            {
                chapter: 'Evolution',
                concepts: [
                    'Origin of Life',
                    'Evolution of Life Forms – A Theory',
                    'What are the Evidences for Evolution?',
                    'What is Adaptive Radiation?',
                    'Biological Evolution',
                    'Mechanism of Evolution',
                    'Hardy-Weinberg Principle',
                    'A Brief Account of Evolution',
                    'Origin and Evolution of Man'
                ]
            },
            {
                chapter: 'Human Health and Disease',
                concepts: [
                    'Common Diseases in Humans',
                    'Immunity',
                    'AIDS',
                    'Cancer',
                    'Drugs and Alcohol Abuse'
                ]
            },
            {
                chapter: 'Biotechnology: Principles and Processes',
                concepts: [
                    'Principles of Biotechnology',
                    'Tools of Recombinant DNA Technology',
                    'Processes of Recombinant DNA Technology'
                ]
            },
            {
                chapter: 'Biotechnology and Its Applications',
                concepts: [
                    'Biotechnological Applications in Agriculture',
                    'Biotechnological Applications in Medicine',
                    'Transgenic Animals',
                    'Ethical Issues'
                ]
            }
        ]
    }
};

function canonicalizeChapter(name) {
    if (!name || typeof name !== 'string') return '';
    const clean = name.trim();
    const lower = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check all syllabus chapters
    for (const ch of [...BOTANY_CHAPTERS, ...ZOOLOGY_CHAPTERS]) {
        if (ch.toLowerCase().replace(/[^a-z0-9]/g, '') === lower) {
            return ch;
        }
    }
    return clean;
}

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
    CLASS_11_BOTANY_CHAPTERS,
    CLASS_11_ZOOLOGY_CHAPTERS,
    CLASS_12_BOTANY_CHAPTERS,
    CLASS_12_ZOOLOGY_CHAPTERS,
    BOTANY_CHAPTERS,
    ZOOLOGY_CHAPTERS,
    BIOLOGY_SYLLABUS,
    canonicalizeChapter,
    normalizeSubject,
    normalizeClass,
    getPoolForTarget,
    getPoolsForQuery,
    getAllPools
};
