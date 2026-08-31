const primaryPool = require('../config/postgres');
const {
    DB_CONFIGS,
    pools,
    normalizeSubject,
    normalizeClass,
    getPoolForTarget,
    getPoolsForQuery,
    getAllPools
} = require('../config/subjectDatabases');
const { sanitizeHtml } = require('../utils/sanitize');

const isTest = process.env.NODE_ENV === 'test';
const memoryTestQuestions = new Map();

// In-memory cache for subject metadata (5 min TTL)
const metadataCache = new Map();
const METADATA_TTL_MS = 5 * 60 * 1000;

// UUID to database key routing cache (e.g. 'uuid-123' -> 'math_11')
const MAX_UUID_CACHE_SIZE = 100000;
const uuidToDbKey = new Map();

function cacheQuestionDb(id, dbKey) {
    if (!id || !dbKey) return;
    if (uuidToDbKey.size >= MAX_UUID_CACHE_SIZE) {
        // Drop first 10,000 oldest keys
        const iter = uuidToDbKey.keys();
        for (let i = 0; i < 10000; i++) {
            const k = iter.next().value;
            if (k) uuidToDbKey.delete(k);
            else break;
        }
    }
    uuidToDbKey.set(String(id), dbKey);
}

/**
 * Universal tag cleaner to strip all internal difficulty and QPV/QBP metadata tags.
 */
function cleanDifficultyTags(text) {
    if (!text || typeof text !== 'string') return '';
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

function isUuid(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Maps a Supabase/Postgres `questions` table record to the frontend/system Question DTO.
 */
function mapSupabaseToQuestion(row, usageMap = null) {
    if (!row) return null;

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

    const options = rawOptions.map(cleanDifficultyTags).filter(Boolean);

    let answer = row.correct_option || row.num_answer || '';
    if (row.correct_option && options.length > 0) {
        const idx = parseInt(row.correct_option, 10) - 1;
        if (idx >= 0 && idx < options.length) {
            answer = options[idx];
        }
    }

    const classesList = [];
    if (Array.isArray(row.exams) && row.exams.length > 0) {
        classesList.push(...row.exams);
    }
    if (row.klass && !classesList.includes(row.klass)) {
        classesList.push(`Class ${row.klass}`);
    }
    if (classesList.length === 0) classesList.push('JEE', 'NEET');

    const level = extractDifficulty(row.solution_text, row.question);
    const cleanSolution = cleanDifficultyTags(row.solution_text || '');
    const cleanQuestion = cleanDifficultyTags(row.question || '');

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
        usedCount: usage ? parseInt(usage.used_count, 10) || 0 : 0,
        lastUsedAt: usage ? usage.last_used_at : null,
        lastUsedTeacher: usage ? usage.last_teacher_name : '',
        lastUsedExam: usage ? usage.last_exam_name : '',
        lastUsedDate: usage ? usage.last_exam_date : null,
        usageHistory: usage && Array.isArray(usage.usage_history) ? usage.usage_history : []
    };
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

/**
 * Fetch usage map for a list of question UUIDs from primary database.
 */
async function fetchUsageMap(questionIds) {
    const validUuids = (questionIds || []).filter(isUuid);
    const usageMap = new Map();
    if (validUuids.length === 0) return usageMap;

    try {
        const res = await primaryPool.query(`
            SELECT 
                qu.question_id,
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
            WHERE qu.question_id = ANY($1::uuid[])
            GROUP BY qu.question_id;
        `, [validUuids]);

        for (const row of res.rows) {
            usageMap.set(row.question_id.toString(), row);
        }
    } catch (e) {
        // Graceful non-blocking fallback if usage table is idle
        // console.warn('[USAGE] Lookup notice:', e.message);
    }

    return usageMap;
}

/**
 * Build WHERE clauses and values for a question query.
 */
function buildQueryFilters(filters) {
    const whereClauses = [];
    const values = [];
    let paramIndex = 1;

    // Chapter filter
    if (filters.chapter) {
        const chapters = Array.isArray(filters.chapter) ? filters.chapter : filters.chapter.split(',').map(c => c.trim()).filter(Boolean);
        if (chapters.length > 0) {
            whereClauses.push(`q.chapter = ANY($${paramIndex++}::text[])`);
            values.push(chapters);
        }
    }

    // Topic / Concept filter
    if (filters.concept) {
        const concepts = Array.isArray(filters.concept) ? filters.concept : filters.concept.split(',').map(c => c.trim()).filter(Boolean);
        if (concepts.length > 0) {
            whereClauses.push(`q.topic = ANY($${paramIndex++}::text[])`);
            values.push(concepts);
        }
    }

    // Question Type filter
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

    // Level / Difficulty filter
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

    // Search text filter
    if (filters.search && filters.search.trim()) {
        const searchStr = filters.search.trim();
        whereClauses.push(`(q.question ILIKE $${paramIndex} OR q.chapter ILIKE $${paramIndex} OR q.topic ILIKE $${paramIndex++})`);
        values.push(`%${searchStr}%`);
    }

    return { whereClauses, values };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries & API Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query questions with multi-database routing, indexed filters, and usage history.
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

    const targetPoolEntries = getPoolsForQuery(filters.subject, filters.classes);
    const { whereClauses, values } = buildQueryFilters(filters);
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
        // Query target pools in parallel
        const poolResults = await Promise.all(
            targetPoolEntries.map(async (entry) => {
                try {
                    // 1. Fetch total matching count
                    const countRes = await entry.pool.query(
                        `SELECT count(*)::bigint as total FROM public.questions q ${whereSql};`,
                        values
                    );
                    const total = parseInt(countRes.rows[0]?.total || 0, 10);

                    // 2. Fetch rows
                    // For single target pool: limit/offset applied directly in SQL
                    // For multi-pool union: fetch up to (offset + requestedLimit) to allow accurate global sorting
                    const queryLimit = targetPoolEntries.length === 1 ? requestedLimit : (offset + requestedLimit);
                    const queryOffset = targetPoolEntries.length === 1 ? offset : 0;

                    const queryValues = [...values, queryLimit, queryOffset];
                    const limitParam = `$${queryValues.length - 1}`;
                    const offsetParam = `$${queryValues.length}`;

                    const sql = `
                        SELECT 
                            q.id, q.subject, q.klass, q.chapter, q.topic, q.exams,
                            q.q_type, q.question, q.opt_a, q.opt_b, q.opt_c, q.opt_d,
                            q.assertion, q.reason, q.correct_option, q.num_answer,
                            q.solution_text, q.created_by, q.created_by_name, q.created_at
                        FROM public.questions q
                        ${whereSql}
                        ORDER BY q.created_at DESC
                        LIMIT ${limitParam} OFFSET ${offsetParam};
                    `;

                    const rowsRes = await entry.pool.query(sql, queryValues);
                    
                    // Cache UUIDs to this pool key
                    for (const r of rowsRes.rows) {
                        cacheQuestionDb(r.id, entry.key);
                    }

                    return {
                        total,
                        rows: rowsRes.rows,
                        dbKey: entry.key
                    };
                } catch (err) {
                    console.error(`[POOL ERROR - ${entry.name}]:`, err.message);
                    return { total: 0, rows: [], dbKey: entry.key };
                }
            })
        );

        // Aggregate counts & rows
        const grandTotal = poolResults.reduce((acc, r) => acc + r.total, 0);

        let mergedRows = [];
        if (targetPoolEntries.length === 1) {
            mergedRows = poolResults[0].rows;
        } else {
            // Merge all rows, sort descending by created_at, apply global pagination
            for (const pr of poolResults) {
                mergedRows.push(...pr.rows);
            }
            mergedRows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            mergedRows = mergedRows.slice(offset, offset + requestedLimit);
        }

        // Fetch usage data from primary database
        const qIds = mergedRows.map(r => r.id);
        const usageMap = await fetchUsageMap(qIds);

        // Filter by usage if specified ('never_used' or 'used_before')
        if (filters.usage) {
            const u = filters.usage.toString().toLowerCase().trim();
            if (u === 'never_used' || u === 'never') {
                mergedRows = mergedRows.filter(r => !usageMap.has(r.id.toString()));
            } else if (u === 'used_before' || u === 'used') {
                mergedRows = mergedRows.filter(r => usageMap.has(r.id.toString()));
            }
        }

        const mappedQuestions = mergedRows.map(r => mapSupabaseToQuestion(r, usageMap));

        return {
            questions: mappedQuestions,
            pagination: {
                page: requestedPage,
                limit: requestedLimit,
                total: grandTotal,
                pages: Math.ceil(grandTotal / requestedLimit)
            }
        };
    } catch (err) {
        console.error('[DATABASE] getQuestions error:', err.message);
        return {
            questions: [],
            pagination: { page: requestedPage, limit: requestedLimit, total: 0, pages: 0 }
        };
    }
}

/**
 * Fast cached metadata query across subject databases.
 */
async function getSubjectMetadata(subject = '', klass = null) {
    const normSub = normalizeSubject(subject) || 'ALL';
    const normKlass = normalizeClass(klass) || 'ALL';
    const cacheKey = `${normSub.toLowerCase()}_${normKlass.toLowerCase()}`;

    const cached = metadataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < METADATA_TTL_MS)) {
        return cached.data;
    }

    try {
        const targetPools = getPoolsForQuery(subject, klass);

        const results = await Promise.all(
            targetPools.map(async (entry) => {
                try {
                    const [countRes, chaptersRes, conceptsRes] = await Promise.all([
                        entry.pool.query('SELECT count(*)::bigint as total FROM public.questions;'),
                        entry.pool.query('SELECT DISTINCT chapter FROM public.questions WHERE chapter IS NOT NULL ORDER BY chapter;'),
                        entry.pool.query('SELECT DISTINCT chapter, topic as name FROM public.questions WHERE chapter IS NOT NULL AND topic IS NOT NULL ORDER BY chapter, topic;')
                    ]);

                    return {
                        total: parseInt(countRes.rows[0]?.total || 0, 10),
                        chapters: chaptersRes.rows.map(r => r.chapter).filter(Boolean),
                        concepts: conceptsRes.rows.map(r => ({ chapter: r.chapter, name: r.name })).filter(c => c.name)
                    };
                } catch (e) {
                    console.error(`[META ERROR - ${entry.name}]:`, e.message);
                    return { total: 0, chapters: [], concepts: [] };
                }
            })
        );

        let total = 0;
        const chaptersSet = new Set();
        const conceptsList = [];

        for (const r of results) {
            total += r.total;
            r.chapters.forEach(ch => chaptersSet.add(ch));
            conceptsList.push(...r.concepts);
        }

        // Deduplicate concepts by chapter + name
        const conceptSeen = new Set();
        const distinctConcepts = [];
        for (const c of conceptsList) {
            const key = `${c.chapter}:::${c.name}`;
            if (!conceptSeen.has(key)) {
                conceptSeen.add(key);
                distinctConcepts.push(c);
            }
        }

        const result = {
            total,
            chapters: Array.from(chaptersSet).sort(),
            concepts: distinctConcepts
        };

        metadataCache.set(cacheKey, { timestamp: Date.now(), data: result });
        return result;
    } catch (err) {
        console.error('[METADATA] getSubjectMetadata error:', err.message);
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
        let targetDbKey = uuidToDbKey.get(String(id));
        let foundRow = null;

        if (targetDbKey && pools.has(targetDbKey)) {
            const poolEntry = pools.get(targetDbKey);
            const res = await poolEntry.pool.query('SELECT * FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
            if (res.rows.length > 0) {
                foundRow = res.rows[0];
            }
        }

        // If not found in cached pool, search all pools in parallel
        if (!foundRow) {
            const all = getAllPools();
            const lookups = await Promise.all(
                all.map(async (entry) => {
                    try {
                        const res = await entry.pool.query('SELECT * FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
                        if (res.rows.length > 0) {
                            return { row: res.rows[0], key: entry.key };
                        }
                    } catch (e) {}
                    return null;
                })
            );

            const match = lookups.find(Boolean);
            if (match) {
                foundRow = match.row;
                cacheQuestionDb(id, match.key);
            }
        }

        if (!foundRow) return null;

        const usageMap = await fetchUsageMap([id]);
        return mapSupabaseToQuestion(foundRow, usageMap);
    } catch (err) {
        console.error('[DATABASE] getQuestionById error:', err.message);
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
        const foundRowsMap = new Map();

        // 1. Group cached UUIDs by known DB key
        const byPool = new Map();
        const uncached = [];

        for (const id of validUuids) {
            const key = uuidToDbKey.get(String(id));
            if (key && pools.has(key)) {
                if (!byPool.has(key)) byPool.set(key, []);
                byPool.get(key).push(id);
            } else {
                uncached.push(id);
            }
        }

        // 2. Query known pools
        const knownPromises = Array.from(byPool.entries()).map(async ([key, pIds]) => {
            const entry = pools.get(key);
            try {
                const res = await entry.pool.query('SELECT * FROM public.questions WHERE id = ANY($1::uuid[]);', [pIds]);
                res.rows.forEach(r => foundRowsMap.set(r.id.toString(), r));
            } catch (e) {
                console.error(`[BATCH ERROR - ${key}]:`, e.message);
            }
        });

        // 3. For any uncached IDs, query all pools in parallel
        const uncachedPromises = uncached.length > 0 ? getAllPools().map(async (entry) => {
            try {
                const res = await entry.pool.query('SELECT * FROM public.questions WHERE id = ANY($1::uuid[]);', [uncached]);
                res.rows.forEach(r => {
                    foundRowsMap.set(r.id.toString(), r);
                    cacheQuestionDb(r.id, entry.key);
                });
            } catch (e) {}
        }) : [];

        await Promise.all([...knownPromises, ...uncachedPromises]);

        // 4. Fetch usage
        const foundUuids = Array.from(foundRowsMap.keys());
        const usageMap = await fetchUsageMap(foundUuids);

        // 5. Return ordered according to requested IDs
        return validUuids
            .map(id => foundRowsMap.get(id.toString()))
            .filter(Boolean)
            .map(r => mapSupabaseToQuestion(r, usageMap));
    } catch (err) {
        console.error('[DATABASE] getQuestionsByIds error:', err.message);
        return [];
    }
}

/**
 * Record usage of questions in a paper / exam into primary database.
 */
async function recordQuestionUsage(questionIds, paperId, teacherId, teacherName, examName, examDate) {
    if (!Array.isArray(questionIds) || questionIds.length === 0) return;

    const validUuids = questionIds.map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(isUuid);
    if (validUuids.length === 0) return;

    try {
        const client = await primaryPool.connect();
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
                    paperId ? paperId.toString() : null,
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
        console.error('[PRIMARY DB] recordQuestionUsage error:', err.message);
    }
}

/**
 * Create a question in the appropriate subject/class database.
 */
async function createQuestion(dto, userId = null, userName = 'Admin') {
    const payload = mapQuestionToSupabase(dto, userId, userName);

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

    const targetPoolEntry = getPoolForTarget(payload.subject, payload.klass);

    const insertSql = `
        INSERT INTO public.questions (
            subject, klass, chapter, topic, exams, q_type,
            question, opt_a, opt_b, opt_c, opt_d, assertion, reason,
            num_answer, correct_option, solution_text,
            created_by, created_by_name, updated_by, updated_by_name, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18, $19, $20, $21
        )
        RETURNING *;
    `;

    const values = [
        payload.subject, payload.klass, payload.chapter, payload.topic, payload.exams, payload.q_type,
        payload.question, payload.opt_a, payload.opt_b, payload.opt_c, payload.opt_d, payload.assertion, payload.reason,
        payload.num_answer, payload.correct_option, payload.solution_text,
        payload.created_by, payload.created_by_name, payload.updated_by, payload.updated_by_name, payload.updated_at
    ];

    const res = await targetPoolEntry.pool.query(insertSql, values);
    const row = res.rows[0];

    cacheQuestionDb(row.id, targetPoolEntry.key);
    metadataCache.clear();

    return mapSupabaseToQuestion(row);
}

/**
 * Update an existing question in its database.
 */
async function updateQuestion(id, dto, userId = null, userName = 'Admin') {
    if (isTest && memoryTestQuestions.has(id)) {
        const existing = memoryTestQuestions.get(id);
        const updated = { ...existing, ...dto };
        memoryTestQuestions.set(id, updated);
        return updated;
    }

    let targetDbKey = uuidToDbKey.get(String(id));
    let targetPoolEntry = targetDbKey ? pools.get(targetDbKey) : null;

    if (!targetPoolEntry) {
        // Find which pool has it
        for (const entry of getAllPools()) {
            const check = await entry.pool.query('SELECT id FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
            if (check.rows.length > 0) {
                targetPoolEntry = entry;
                cacheQuestionDb(id, entry.key);
                break;
            }
        }
    }

    if (!targetPoolEntry) {
        throw new Error(`Question ${id} not found in any database.`);
    }

    const payload = mapQuestionToSupabase(dto, userId, userName);

    const updateSql = `
        UPDATE public.questions SET
            subject = $1, klass = $2, chapter = $3, topic = $4, exams = $5, q_type = $6,
            question = $7, opt_a = $8, opt_b = $9, opt_c = $10, opt_d = $11,
            assertion = $12, reason = $13, num_answer = $14, correct_option = $15,
            solution_text = $16, updated_by = $17, updated_by_name = $18, updated_at = $19
        WHERE id = $20
        RETURNING *;
    `;

    const values = [
        payload.subject, payload.klass, payload.chapter, payload.topic, payload.exams, payload.q_type,
        payload.question, payload.opt_a, payload.opt_b, payload.opt_c, payload.opt_d,
        payload.assertion, payload.reason, payload.num_answer, payload.correct_option,
        payload.solution_text, payload.updated_by, payload.updated_by_name, payload.updated_at,
        id
    ];

    const res = await targetPoolEntry.pool.query(updateSql, values);
    metadataCache.clear();

    return mapSupabaseToQuestion(res.rows[0]);
}

/**
 * Delete a question from its database.
 */
async function deleteQuestion(id) {
    if (isTest) {
        memoryTestQuestions.delete(id);
        return true;
    }

    let targetDbKey = uuidToDbKey.get(String(id));
    let targetPoolEntry = targetDbKey ? pools.get(targetDbKey) : null;

    if (!targetPoolEntry) {
        for (const entry of getAllPools()) {
            const check = await entry.pool.query('SELECT id FROM public.questions WHERE id = $1 LIMIT 1;', [id]);
            if (check.rows.length > 0) {
                targetPoolEntry = entry;
                break;
            }
        }
    }

    if (!targetPoolEntry) {
        throw new Error(`Question ${id} not found.`);
    }

    await targetPoolEntry.pool.query('DELETE FROM public.questions WHERE id = $1;', [id]);
    uuidToDbKey.delete(String(id));
    metadataCache.clear();

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
