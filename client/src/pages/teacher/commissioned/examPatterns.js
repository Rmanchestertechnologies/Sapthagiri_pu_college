export const EXAM_PATTERNS = {
    NEET: {
        id: 'NEET',
        title: 'NEET (National Eligibility Entrance Test)',
        badge: 'Medical UG',
        subjects: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
        defaultTotal: 45,
        marksPerQ: 4,
        supportsNumerical: false,
    },
    JEE: {
        id: 'JEE',
        title: 'JEE Main (Joint Entrance Examination)',
        badge: 'Engineering',
        subjects: ['Physics', 'Chemistry', 'Mathematics'],
        defaultTotal: 25,
        marksPerQ: 4,
        supportsNumerical: true,
    },
    CET: {
        id: 'CET',
        title: 'KCET (Karnataka Common Entrance Test)',
        badge: 'Karnataka CET',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
        defaultTotal: 60,
        marksPerQ: 1,
        supportsNumerical: false,
    },
    ASSIGNMENT: {
        id: 'ASSIGNMENT',
        title: 'Institutional Assignment / Practice Paper',
        badge: 'Assignment',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'All Subjects'],
        defaultTotal: 30,
        marksPerQ: 1,
        supportsNumerical: true,
        isAssignment: true,
    },
    CUSTOM: {
        id: 'CUSTOM',
        title: 'Custom Single / Multi-Subject Assessment',
        badge: 'Freeform / Custom',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology'],
        defaultTotal: 50,
        marksPerQ: 1,
        supportsNumerical: true,
    }
};

export const normalizeSubjectName = (sub) => {
    if (!sub) return 'General';
    const s = String(sub).trim().toLowerCase();
    if (s.includes('math')) return 'Mathematics';
    if (s.includes('physic') || s === 'phy') return 'Physics';
    if (s.includes('chem')) return 'Chemistry';
    if (s.includes('botan')) return 'Botany';
    if (s.includes('zool')) return 'Zoology';
    if (s.includes('bio')) return 'Biology';
    return sub.trim();
};

export const getQCategory = (q, isJee = false) => {
    if (!q) return 'mcq';
    const t = (q.type || q.q_type || '').toUpperCase();
    const txt = `${q.questionText || q.question || ''}`;
    if (isJee && (t === 'NUMERICAL' || (!q.options?.length && !q.opt_a && !q.opt_b && q.num_answer))) return 'numerical';
    if (t === 'ASSERTION_REASON' || /Assertion\s*(?:\(A\))?[:\-]/i.test(txt)) return 'ar';
    if (t === 'MATCH_FOLLOWING' || t.includes('MATCH') || /Column\s*(?:I|1|A)\b/i.test(txt) || /Match the following/i.test(txt)) return 'match';

    // Comprehensive diagram detection: checks question text, imageUrl, diagram_urls, and options!
    const allOptStrings = [q.opt_a, q.opt_b, q.opt_c, q.opt_d, ...(Array.isArray(q.options) ? q.options : [])].filter(Boolean);
    const hasOptionDiag = allOptStrings.some(opt => {
        const s = typeof opt === 'object' ? (opt.text || opt.value || '') : String(opt || '');
        return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/res\.cloudinary\.com\//i.test(s);
    });
    const hasDiagram = (
        t === 'DIAGRAM_BASED' ||
        Boolean(q.imageUrl || q.image_url) ||
        (Array.isArray(q.diagram_urls) && q.diagram_urls.length > 0) ||
        (Array.isArray(q.diagramUrls) && q.diagramUrls.length > 0) ||
        /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/res\.cloudinary\.com\//i.test(txt) ||
        hasOptionDiag
    );

    if (t === 'STATEMENT_BASED' || /Statement\s*(?:I|1|A)\b/i.test(txt)) return 'stmt';
    if (hasDiagram) return 'diag';
    return 'mcq';
};

export const isCetQ = (q) => {
    const qExams = (Array.isArray(q.classes) ? q.classes : []).concat(Array.isArray(q.exams) ? q.exams : []);
    const srcExam = String(q.sourceExam || '').toUpperCase();
    const qText = String(q.questionText || q.question || '').toUpperCase();
    return qExams.some(e => ['CET', 'KCET'].includes(String(e).toUpperCase())) ||
           srcExam.includes('CET') || srcExam.includes('KCET') ||
           qText.includes('[KCET') || qText.includes('(KCET') ||
           qText.includes('[CET') || qText.includes('(CET');
};
