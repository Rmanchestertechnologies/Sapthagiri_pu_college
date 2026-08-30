const pool = require('../config/postgres');
const supabase = require('../config/supabase');
const { sanitizeHtml } = require('../utils/sanitize');

const isTest = process.env.NODE_ENV === 'test';
const memoryTestQuestions = new Map();

// In-memory cache for subject metadata (5 min TTL)
const metadataCache = new Map();
const METADATA_TTL_MS = 5 * 60 * 1000;

/**
 * Universal tag cleaner to strip all internal difficulty and QPV/QBP metadata tags.
 */
function cleanDifficultyTags(text) {
    if (!text || typeof text !== 'string') return '';
    // Matches [QPV_DIFFICULTY:Easy], [QBP_DIFFICULTY:Medium], [DIFFICULTY:Hard], [QPV_...:...]
    return text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();
}

/**
 * Extracts difficulty level ('easy', 'medium', 'hard') from solution or question text.
 */
function extractDifficulty(solutionText, questionText) {
    const diffRegex = /\[(?:QPV_|QBP_)?DIFFICULTY:\s*([A-Za-z]+)\]/i;
    const match = (solutionText || '').match(diffRegex) || (questionText || '').match(diffRegex);
    if (match && match[1]) {
        return match[1].toLowerCase();
    }
    return 'medium';
}

/**
 * Maps a Supabase/Postgres `questions` table record to the frontend/system Question DTO.
 */
function mapSupabaseToQuestion(row, usageMap = null) {
    if (!row) return null;

    // Map q_type format: 'mcq_single' / 'mcq' -> 'MCQ', 'numerical' -> 'NUMERICAL', etc.
    let type = 'MCQ';
    const qTypeLower = (row.q_type || '').toLowerCase();
    if (qTypeLower.includes('numerical')) {
        type = 'NUMERICAL';
    } else if (qTypeLower.includes('assertion')) {
        type = 'ASSERTION_REASON';
    } else if (qTypeLower.includes('match')) {
        type = 'MATCH_FOLLOWING';
    } else if (qTypeLower.includes('statement')) {
        type = 'STATEMENT_BASED';
    } else if (qTypeLower.includes('true') || qTypeLower.includes('false')) {
        type = 'TRUE_FALSE';
    }

    // Build options array from all possible column variations
    const rawOptions = [];
    if (row.opt_a) rawOptions.push(row.opt_a);
    if (row.opt_b) rawOptions.push(row.opt_b);
    if (row.opt_c) rawOptions.push(row.opt_c);
    if (row.opt_d) rawOptions.push(row.opt_d);

    if (rawOptions.length === 0) {
        if (row.option_a) rawOptions.push(row.option_a);
        if (row.option_b) rawOptions.push(row.option_b);
        if (row.option_c) rawOptions.push(row.option_c);
        if (row.option_d) rawOptions.push(row.option_d);
    }

    if (rawOptions.length === 0 && row.options) {
        if (Array.isArray(row.options)) {
            rawOptions.push(...row.options);
        } else if (typeof row.options === 'string') {
            try {
                const parsed = JSON.parse(row.options);
                if (Array.isArray(parsed)) rawOptions.push(...parsed);
            } catch (e) {}
        }
    }

    if (rawOptions.length === 0 && row.options_json) {
        try {
            const parsed = typeof row.options_json === 'string' ? JSON.parse(row.options_json) : row.options_json;
            if (Array.isArray(parsed)) rawOptions.push(...parsed);
        } catch (e) {}
    }

    // Sanitize option texts
    const options = rawOptions.map(cleanDifficultyTags).filter(Boolean);

    // Map answer
    let answer = row.correct_option || row.num_answer || '';
    if (row.correct_option && options.length > 0) {
        const idx = parseInt(row.correct_option) - 1;
        if (idx >= 0 && idx < options.length) {
            answer = options[idx];
        }
    }

    // Map exams to classes array (e.g. ['JEE'], ['12'])
    const classesList = [];
    if (Array.isArray(row.exams) && row.exams.length > 0) {
        classesList.push(...row.exams);
    }
    if (row.klass && !classesList.includes(row.klass)) {
        classesList.push(`Class ${row.klass}`);
    }
    if (classesList.length === 0) classesList.push('JEE', 'NEET');

    // Extract difficulty level and clean markers
    const level = extractDifficulty(row.solution_text, row.question);
    const cleanSolution = cleanDifficultyTags(row.solution_text || '');
    const cleanQuestion = cleanDifficultyTags(row.question || '');

    // Resolve usage information if available
    const qIdStr = (row.id || '').toString();
    const usage = (usageMap && usageMap.get(qIdStr)) || null;

    return {
        _id: row.id,
        id: row.id,
        questionId: row.id,
        subject: row.subject || 'Physics',
        classes: classesList,
        chapter: row.chapter || 'General',
        concept: row.topic || row.chapter || 'General',
        subConcept: '',
        level: level,
        type: type,
        q_type: row.q_type,
        questionText: cleanQuestion,
        imageUrl: row.image_url || row.imageUrl || null,
        solutionImageUrl: row.solution_image_url || row.solutionImageUrl || null,
        options: options,
        answer: answer,
        correct_option: row.correct_option,
        num_answer: row.num_answer,
        solutionText: cleanSolution,
        questionTextTranslation: cleanDifficultyTags(row.question_text_translation || ''),
        optionsTranslation: Array.isArray(row.options_translation) ? row.options_translation.map(cleanDifficultyTags) : [],
        assertion: cleanDifficultyTags(row.assertion || ''),
        reason: cleanDifficultyTags(row.reason || ''),
        column_a: row.column_a || [],
        column_b: row.column_b || [],
        match_options: row.match_options || {},
        sourceType: 'REGULAR',
        sourceExam: Array.isArray(row.exams) ? row.exams.join(', ') : '',
        createdBy: row.created_by,
        createdByName: row.created_by_name || 'Admin',
        createdAt: row.created_at || new Date().toISOString(),
        // Usage history attributes
        usedCount: usage ? parseInt(usage.used_count) || 0 : 0,
        lastUsedAt: usage ? usage.last_used_at : null,
        lastUsedTeacher: usage ? usage.last_teacher_name : '',
        lastUsedExam: usage ? usage.last_exam_name : '',
        lastUsedDate: usage ? usage.last_exam_date : null,
        usageHistory: usage && Array.isArray(usage.usage_history) ? usage.usage_history : []
    };
}

function isUuid(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Maps a system/frontend question object to Supabase database row format.
 */
function mapQuestionToSupabase(dto, userId = null, userName = 'Admin') {
    const qType = (dto.type || 'MCQ').toLowerCase();
    const isNumerical = qType === 'numerical';

    let optionsArr = Array.isArray(dto.options) ? dto.options : [];
    if (typeof dto.options === 'string') {
        try { optionsArr = JSON.parse(dto.options); } catch(e) { optionsArr = []; }
    }
    if (!Array.isArray(optionsArr)) optionsArr = [];

    const optA = cleanDifficultyTags(optionsArr[0] || '');
    const optB = cleanDifficultyTags(optionsArr[1] || '');
    const optC = cleanDifficultyTags(optionsArr[2] || '');
    const optD = cleanDifficultyTags(optionsArr[3] || '');

    let correctOpt = '';
    if (optionsArr.length > 0 && dto.answer) {
        const idx = optionsArr.findIndex(opt => opt === dto.answer);
        if (idx !== -1) correctOpt = String(idx + 1);
    }

    const klassVal = Array.isArray(dto.classes)
        ? (dto.classes.find(c => c.includes('11') || c.includes('12')) || '12').replace(/Class\s*/i, '')
        : '12';

    const examsList = Array.isArray(dto.classes)
        ? dto.classes.filter(c => ['JEE', 'NEET', 'CET', 'JEE Main', 'JEE Advanced'].includes(c))
        : ['JEE'];

    if (examsList.length === 0) examsList.push('JEE');

    const validUserId = isUuid(userId) ? userId : null;

    // Append difficulty tag to solution text for database storage preservation
    const levelTag = dto.level ? `[QBP_DIFFICULTY:${dto.level.charAt(0).toUpperCase() + dto.level.slice(1)}]` : '';
    const cleanSolution = cleanDifficultyTags(dto.solutionText || '');
    const solutionWithTag = levelTag ? `${cleanSolution}\n${levelTag}` : cleanSolution;

    return {
        subject: dto.subject || 'Physics',
        klass: klassVal,
        chapter: dto.chapter || 'General',
        topic: dto.concept || dto.subConcept || 'General',
        exams: examsList,
        q_type: isNumerical ? 'numerical' : 'mcq_single',
        question: sanitizeHtml(cleanDifficultyTags(dto.questionText || '')),
        opt_a: sanitizeHtml(optA),
        opt_b: sanitizeHtml(optB),
        opt_c: sanitizeHtml(optC),
        opt_d: sanitizeHtml(optD),
        assertion: sanitizeHtml(cleanDifficultyTags(dto.assertion || '')),
        reason: sanitizeHtml(cleanDifficultyTags(dto.reason || '')),
        num_answer: isNumerical ? (dto.answer || '') : '',
        correct_option: correctOpt,
        solution_text: sanitizeHtml(solutionWithTag),
        created_by: validUserId,
        created_by_name: userName,
        updated_by: validUserId,
        updated_by_name: userName,
        updated_at: new Date().toISOString()
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries & API Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query questions with indexed filters, pagination, and batch usage lookup.
 */
async function getQuestions(filters = {}, page = 1, limit = 50) {
    if (isTest && memoryTestQuestions.size > 0) {
        let list = Array.from(memoryTestQuestions.values());
        if (filters.subject) list = list.filter(q => q.subject.toLowerCase() === filters.subject.toLowerCase());
        return {
            questions: list,
            pagination: { page: Number(page), limit: Number(limit), total: list.length, pages: 1 }
        };
    }

    const requestedLimit = Math.max(1, Math.min(20000, Number(limit) || 50));
    const requestedPage = Math.max(1, Number(page) || 1);
    const offset = (requestedPage - 1) * requestedLimit;

    const whereClauses = [];
    const values = [];
    let paramIndex = 1;

    // 1. Subject filter
    if (filters.subject) {
        const sub = (filters.subject || '').trim().toLowerCase();
        if (sub.includes('math')) {
            whereClauses.push(`q.subject IN ('Maths', 'Mathematics', 'Math', 'MATHEMATICS', 'MATHS')`);
        } else if (sub.includes('physic')) {
            whereClauses.push(`q.subject IN ('Physics', 'PHYSICS')`);
        } else if (sub.includes('chem')) {
            whereClauses.push(`q.subject IN ('Chemistry', 'CHEMISTRY')`);
        } else if (sub.includes('bio')) {
            whereClauses.push(`q.subject IN ('Biology', 'BIOLOGY')`);
        } else {
            whereClauses.push(`q.subject ILIKE $${paramIndex++}`);
            values.push(`%${filters.subject}%`);
        }
    }

    // 2. Class filter
    if (filters.classes) {
        const classesArr = Array.isArray(filters.classes) ? filters.classes : filters.classes.split(',');
        const klassVals = [];
        const examVals = [];
        classesArr.forEach(c => {
            const clean = c.replace(/Class\s*/i, '').trim();
            if (['11', '12'].includes(clean)) {
                klassVals.push(clean);
            } else if (clean) {
                examVals.push(clean);
            }
        });

        if (klassVals.length > 0) {
            whereClauses.push(`q.klass = ANY($${paramIndex++}::text[])`);
            values.push(klassVals);
        }
        if (examVals.length > 0) {
            whereClauses.push(`q.exams && $${paramIndex++}::text[]`);
            values.push(examVals);
        }
    }

    // 3. Chapter filter
    if (filters.chapter) {
        const chapters = Array.isArray(filters.chapter) ? filters.chapter : filters.chapter.split(',').map(c => c.trim()).filter(Boolean);
        if (chapters.length > 0) {
            whereClauses.push(`q.chapter = ANY($${paramIndex++}::text[])`);
            values.push(chapters);
        }
    }

    // 4. Topic / Concept filter
    if (filters.concept) {
        const concepts = Array.isArray(filters.concept) ? filters.concept : filters.concept.split(',').map(c => c.trim()).filter(Boolean);
        if (concepts.length > 0) {
            whereClauses.push(`q.topic = ANY($${paramIndex++}::text[])`);
            values.push(concepts);
        }
    }

    // 5. Question Type filter
    if (filters.type) {
        const typeArr = Array.isArray(filters.type) ? filters.type : filters.type.split(',').map(t => t.trim().toLowerCase());
        const qTypes = [];
        typeArr.forEach(t => {
            if (t.includes('numerical')) qTypes.push('numerical');
            else if (t.includes('assertion')) qTypes.push('assertion_reason', 'assertion');
            else if (t.includes('match')) qTypes.push('match', 'match_following');
            else if (t.includes('mcq')) qTypes.push('mcq_single', 'mcq', 'mcq_multiple');
        });
        if (qTypes.length > 0) {
            whereClauses.push(`q.q_type = ANY($${paramIndex++}::text[])`);
            values.push([...new Set(qTypes)]);
        }
    }

    // 6. Level / Difficulty filter
    if (filters.level) {
        const levelArr = Array.isArray(filters.level) ? filters.level : filters.level.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
        if (levelArr.length > 0) {
            const levelPatterns = levelArr.map(lvl => {
                const cap = lvl.charAt(0).toUpperCase() + lvl.slice(1).toLowerCase();
                return `%DIFFICULTY:${cap}%`;
            });
            whereClauses.push(`(q.solution_text ILIKE ANY($${paramIndex}::text[]) OR q.question ILIKE ANY($${paramIndex++}::text[]))`);
            values.push(levelPatterns);
        }
    }

    // 7. Search text filter (uses full text search index or ILIKE)
    if (filters.search && filters.search.trim()) {
        const searchStr = filters.search.trim();
        whereClauses.push(`(q.question ILIKE $${paramIndex} OR q.chapter ILIKE $${paramIndex} OR q.topic ILIKE $${paramIndex++})`);
        values.push(`%${searchStr}%`);
    }

    // 8. Usage filter (All, Never Used, Used Before)
    if (filters.usage) {
        const u = filters.usage.toString().toLowerCase().trim();
        if (u === 'never_used' || u === 'never') {
            whereClauses.push(`NOT EXISTS (SELECT 1 FROM public.question_usage qu WHERE qu.question_id = q.id)`);
        } else if (u === 'used_before' || u === 'used') {
            whereClauses.push(`EXISTS (SELECT 1 FROM public.question_usage qu WHERE qu.question_id = q.id)`);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
        const queryValues = [...values, requestedLimit, offset];
        const limitParam = `$${queryValues.length - 1}`;
        const offsetParam = `$${queryValues.length}`;

        const unifiedSql = `
            WITH filtered AS (
                SELECT 
                    q.id, q.subject, q.klass, q.chapter, q.topic, q.exams,
                    q.q_type, q.question, q.opt_a, q.opt_b, q.opt_c, q.opt_d,
                    q.assertion, q.reason, q.correct_option, q.num_answer,
                    q.solution_text, q.created_by, q.created_by_name, q.created_at,
                    count(*) OVER() AS full_count
                FROM public.questions q
                ${whereSql}
                ORDER BY q.created_at DESC
                LIMIT ${limitParam} OFFSET ${offsetParam}
            )
            SELECT 
                f.*,
                qu_agg.used_count,
                qu_agg.last_used_at,
                qu_agg.last_teacher_name,
                qu_agg.last_exam_name,
                qu_agg.last_exam_date,
                qu_agg.usage_history
            FROM filtered f
            LEFT JOIN LATERAL (
                SELECT 
                    count(*)::bigint AS used_count,
                    max(qu.used_at) AS last_used_at,
                    (array_agg(qu.teacher_name ORDER BY qu.used_at DESC))[1] AS last_teacher_name,
                    (array_agg(qu.exam_name ORDER BY qu.used_at DESC))[1] AS last_exam_name,
                    (array_agg(qu.exam_date ORDER BY qu.used_at DESC))[1] AS last_exam_date,
                    jsonb_agg(
                        jsonb_build_object(
                            'id', qu.id,
                            'paper_id', qu.paper_id,
                            'teacher_id', qu.teacher_id,
                            'teacher_name', qu.teacher_name,
                            'exam_name', qu.exam_name,
                            'exam_date', qu.exam_date,
                            'used_at', qu.used_at
                        ) ORDER BY qu.used_at DESC
                    ) AS usage_history
                FROM public.question_usage qu
                WHERE qu.question_id = f.id
            ) qu_agg ON true;
        `;

        const res = await pool.query(unifiedSql, queryValues);
        const rows = res.rows;

        if (rows.length === 0) {
            // Check if there are truly 0 or just beyond offset
            const countCheck = await pool.query(`SELECT count(*)::bigint as total FROM public.questions q ${whereSql};`, values);
            const total = parseInt(countCheck.rows[0]?.total || 0, 10);
            return {
                questions: [],
                pagination: { page: requestedPage, limit: requestedLimit, total: total, pages: Math.ceil(total / requestedLimit) }
            };
        }

        const total = parseInt(rows[0].full_count, 10);

        const mappedQuestions = rows.map(r => {
            const usage = {
                used_count: r.used_count || 0,
                last_used_at: r.last_used_at,
                last_teacher_name: r.last_teacher_name,
                last_exam_name: r.last_exam_name,
                last_exam_date: r.last_exam_date,
                usage_history: r.usage_history || []
            };
            const uMap = new Map([[r.id.toString(), usage]]);
            return mapSupabaseToQuestion(r, uMap);
        });

        return {
            questions: mappedQuestions,
            pagination: {
                page: requestedPage,
                limit: requestedLimit,
                total: total,
                pages: Math.ceil(total / requestedLimit)
            }
        };
    } catch (err) {
        console.error('[POSTGRES] getQuestions error:', err.message);
        return { questions: [], pagination: { page: requestedPage, limit: requestedLimit, total: 0, pages: 0 } };
    }
}

/**
 * High-speed cached metadata query (zero-egress RPC).
 */
async function getSubjectMetadata(subject = '') {
    const cacheKey = (subject || 'ALL').trim().toLowerCase();
    const cached = metadataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < METADATA_TTL_MS)) {
        return cached.data;
    }

    try {
        const subParam = subject ? subject.trim() : null;
        const res = await pool.query(
            `SELECT public.get_subject_meta($1) as meta;`,
            [subParam]
        );

        const meta = res.rows[0]?.meta || { total: 0, chapters: [], concepts: [] };
        const result = {
            total: parseInt(meta.total) || 0,
            chapters: Array.isArray(meta.chapters) ? meta.chapters : [],
            concepts: Array.isArray(meta.concepts) ? meta.concepts : []
        };

        metadataCache.set(cacheKey, { timestamp: Date.now(), data: result });
        return result;
    } catch (err) {
        console.error('[POSTGRES] getSubjectMetadata error:', err.message);
        return { total: 0, chapters: [], concepts: [] };
    }
}

/**
 * Get a single question by UUID with usage history attached.
 */
async function getQuestionById(id) {
    if (isTest && memoryTestQuestions.has(id)) {
        return memoryTestQuestions.get(id);
    }
    if (!isUuid(id)) return null;

    try {
        const res = await pool.query(
            `SELECT * FROM public.questions WHERE id = $1 LIMIT 1;`,
            [id]
        );
        if (res.rows.length === 0) return null;

        const usageRes = await pool.query(
            `SELECT * FROM public.get_questions_usage($1::uuid[]);`,
            [[id]]
        );
        const usageMap = new Map();
        if (usageRes.rows.length > 0) {
            usageMap.set(id.toString(), usageRes.rows[0]);
        }

        return mapSupabaseToQuestion(res.rows[0], usageMap);
    } catch (err) {
        console.error('[POSTGRES] getQuestionById error:', err.message);
        return null;
    }
}

/**
 * Batch lookup questions by UUIDs with usage history.
 */
async function getQuestionsByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    if (isTest) {
        return ids.map(id => memoryTestQuestions.get(id)).filter(Boolean);
    }

    const validUuids = ids.filter(isUuid);
    if (validUuids.length === 0) return [];

    try {
        const res = await pool.query(
            `SELECT * FROM public.questions WHERE id = ANY($1::uuid[]);`,
            [validUuids]
        );

        const usageRes = await pool.query(
            `SELECT * FROM public.get_questions_usage($1::uuid[]);`,
            [validUuids]
        );
        const usageMap = new Map();
        usageRes.rows.forEach(u => usageMap.set(u.question_id.toString(), u));

        return res.rows.map(r => mapSupabaseToQuestion(r, usageMap));
    } catch (err) {
        console.error('[POSTGRES] getQuestionsByIds error:', err.message);
        return [];
    }
}

/**
 * Record usage of questions in a paper / exam.
 */
async function recordQuestionUsage(questionIds, paperId, teacherId, teacherName, examName, examDate) {
    if (!Array.isArray(questionIds) || questionIds.length === 0) return;

    const validUuids = questionIds.map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(isUuid);
    if (validUuids.length === 0) return;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const insertQuery = `
                INSERT INTO public.question_usage (
                    question_id, paper_id, teacher_id, teacher_name, exam_name, exam_date, used_at
                ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), NOW());
            `;
            for (const qId of validUuids) {
                await client.query(insertQuery, [
                    qId,
                    paperId.toString(),
                    teacherId ? teacherId.toString() : null,
                    teacherName || 'Faculty',
                    examName || 'Assessment',
                    examDate || null
                ]);
            }
            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[POSTGRES] recordQuestionUsage error:', err.message);
    }
}

async function createQuestion(dto, userId = null, userName = 'Admin') {
    const payload = mapQuestionToSupabase(dto, userId, userName);
    payload.created_at = new Date().toISOString();

    if (isTest) {
        const fakeId = `q_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const mapped = {
            _id: fakeId,
            id: fakeId,
            questionId: fakeId,
            subject: dto.subject || 'Physics',
            classes: dto.classes || ['JEE'],
            chapter: dto.chapter || 'General',
            concept: dto.concept || 'General',
            type: dto.type || 'MCQ',
            questionText: sanitizeHtml(cleanDifficultyTags(dto.questionText || '')),
            options: (dto.options || []).map(cleanDifficultyTags),
            answer: dto.answer || '',
            solutionText: sanitizeHtml(cleanDifficultyTags(dto.solutionText || '')),
            questionTextTranslation: dto.questionTextTranslation || '',
            optionsTranslation: dto.optionsTranslation || [],
            createdBy: userId,
            createdAt: payload.created_at
        };
        memoryTestQuestions.set(fakeId, mapped);
        return mapped;
    }

    const { data, error } = await supabase
        .from('questions')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error('[SUPABASE] createQuestion error:', error.message);
        throw new Error(error.message);
    }

    // Invalidate cache
    metadataCache.clear();
    return mapSupabaseToQuestion(data);
}

async function updateQuestion(id, dto, userId = null, userName = 'Admin') {
    if (isTest && memoryTestQuestions.has(id)) {
        const existing = memoryTestQuestions.get(id);
        const updated = { ...existing, ...dto };
        memoryTestQuestions.set(id, updated);
        return updated;
    }

    const payload = mapQuestionToSupabase(dto, userId, userName);

    const { data, error } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[SUPABASE] updateQuestion error:', error.message);
        throw new Error(error.message);
    }

    return mapSupabaseToQuestion(data);
}

async function deleteQuestion(id) {
    if (isTest) {
        memoryTestQuestions.delete(id);
        return true;
    }

    const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[SUPABASE] deleteQuestion error:', error.message);
        throw new Error(error.message);
    }

    return true;
}

module.exports = {
    getQuestions,
    getQuestionById,
    getQuestionsByIds,
    getSubjectMetadata,
    recordQuestionUsage,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    mapSupabaseToQuestion,
    mapQuestionToSupabase,
    cleanDifficultyTags
};
