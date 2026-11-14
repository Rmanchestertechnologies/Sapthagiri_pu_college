
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');


// ── Security Middleware
const helmet = require('helmet');
const { apiLimiter, examLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const maintenance = require('./services/maintenance');
const { parseAllowedOrigins, isOriginAllowed } = require('./services/accessRules');

// ── Routes
const authRoutes = require('./routes/auth.js');
const adminRoutes = require('./routes/admin.js');
const questionRoutes = require('./routes/questions.js');
const paperRoutes = require('./routes/papers.js');
const templateRoutes = require('./routes/templates.js');
const grandTestRoutes = require('./routes/grandTests.js');
const previousYearPaperRoutes = require('./routes/previousYearPapers.js');
const examBlueprintRoutes = require('./routes/examBlueprints.js');
const notificationRoutes = require('./routes/notifications.js');
const examRoutes = require('./routes/exams.js');
const labRoutes = require('./routes/lab.js');
const omrRoutes = require('./routes/omr.js');
const draftRoutes = require('./routes/drafts.js');

dotenv.config();

const app = express();
// Number of reverse proxies in front of the API (Render's load balancer = 1). Used for req.ip, the lab-network check and
// rate limiting; set TRUST_PROXY_HOPS if another proxy (CDN) is added.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) >= 0 && process.env.TRUST_PROXY_HOPS !== undefined && process.env.TRUST_PROXY_HOPS !== '' ? Number(process.env.TRUST_PROXY_HOPS) : 1);

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: Helmet — HTTP security headers
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Permit all origins (Vercel deployments, custom domains, localhost)
// ─────────────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGINS="https://app.example.com,https://other.example.com" restricts cross-origin access.
// While it is unset or "*", every origin is reflected back WITH credentials, which lets any website
// make authenticated requests as a logged-in user. Set it in production.
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
if (!allowedOrigins && process.env.NODE_ENV === 'production') {
    console.warn('⚠️ ALLOWED_ORIGINS is not restricted: any website can call this API with the user\'s cookies. Set ALLOWED_ORIGINS.');
}
app.use(cors({
    origin: (origin, callback) => {
        callback(null, isOriginAllowed(origin, allowedOrigins));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // x-session-token carries the exam-session token. It was missing here, so from a browser on another origin (the real
    // deployment: the SPA on one host, the API on another) every autosave, submit and scorecard request failed the
    // CORS preflight. The exposed headers let the SPA read the question total, download file names and Retry-After.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-session-token', 'Origin', 'Accept'],
    exposedHeaders: ['X-Total-Count', 'X-Total-Pages', 'Content-Disposition', 'Retry-After'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// ─────────────────────────────────────────────────────────────────────────────
// Body Parsing — Strict size limits
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: NoSQL Injection Protection
// Strips $ and . from req.body, req.query, req.params
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING — Global API limiter
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Static Files
// ─────────────────────────────────────────────────────────────────────────────
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory at:', uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        institution: 'Sapthagiri PU College, Davanagere',
        message: 'Sapthagiri PU College Question Paper Generator API is running',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Health check: answers 503 when the primary database cannot be reached, so the platform's probe can restart the service
// instead of leaving a server running that fails every request.
app.get('/api/health', async (req, res) => {
    let db = 'ok';
    try {
        const pool = require('./config/postgres');
        await Promise.race([
            pool.query('SELECT 1'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
    } catch (err) {
        db = 'unreachable';
    }
    res.status(db === 'ok' ? 200 : 503).json({
        institution: 'Sapthagiri PU College',
        status: db === 'ok' ? 'ok' : 'degraded',
        db,
        uptime: Math.floor(process.uptime()),
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Public: is the site in maintenance? (the website polls this to show "updates going on" and to come back by itself)
app.get('/api/maintenance', async (req, res) => {
    const s = await maintenance.getState();
    res.set('Cache-Control', 'no-store');
    res.json({ on: s.on, message: s.message, until: s.until });
});

// Public: browser errors land in the server log (so problems on a teacher's screen are visible in Render's logs).
// Small body, per-address budget, never stores anything, never fails the page that sent it.
const clientLogHits = new Map();
app.post('/api/client-log', (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const rec = clientLogHits.get(ip) || { n: 0, at: now };
    if (now - rec.at > 60000) { rec.n = 0; rec.at = now; }
    rec.n += 1;
    clientLogHits.set(ip, rec);
    if (clientLogHits.size > 5000) clientLogHits.clear();
    if (rec.n <= 20) {
        const b = req.body || {};
        const clip = (v, n) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').slice(0, n);
        console.error(`[CLIENT ERROR] ${clip(b.kind, 20)} | ${clip(b.message, 300)} | page=${clip(b.page, 120)} | build=${clip(b.build, 20)} | ${clip(b.stack, 400)}`);
    }
    res.status(204).end();
});

// While maintenance is ON every other API call answers 503 {maintenance:true,message} (admins, sign-in and in-progress exam sittings are exempt)
app.use('/api', maintenance.maintenanceGate());

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/', apiLimiter);  // general budget per address (student exam traffic is excluded)
app.use('/api/', examLimiter); // student exam traffic: per session, or a lab-sized budget per address
app.use('/api/admin', adminRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/grand-tests', grandTestRoutes);
app.use('/api/previous-year-papers', previousYearPaperRoutes);
app.use('/api/exam-blueprints', examBlueprintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/omr', omrRoutes);
app.use('/api/drafts', draftRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ msg: `Route not found: ${req.method} ${req.path}` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler (no stack traces to client)
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Database + Server Start (Skipped in test environment)
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
    // ── Async startup: check the database, then start listening ──────────────────
    (async () => {
        // 1. Warm up Supabase PostgreSQL pool (subject question databases)
        try {
            const pool = require('./config/postgres');
            await pool.query('SELECT 1');
            console.log('✅ Supabase PostgreSQL Connected for Sapthagiri PU College');
            const storage = require('./services/postgresStorage');
            await storage.seedDefaultBlueprints();
        } catch (pgErr) {
            console.warn('⚠️ Supabase PostgreSQL connection notice:', pgErr.message);
        }

        // 2. Start the HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Sapthagiri PU College QPG Server running on port ${PORT}`);
        });
        // Platform load balancers keep connections open for about 60 s; Node closes idle ones after 5 s by default, which
        // shows up as sporadic 502 errors on the next request over a reused connection.
        server.keepAliveTimeout = 65 * 1000;
        server.headersTimeout = 66 * 1000;

        // Finish in-flight requests on a restart or deploy instead of cutting students off mid-submit.
        const shutdown = (signal) => {
            console.log(`${signal} received: closing the server`);
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(0), 10000).unref();
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    })();

    // A promise rejected somewhere that nothing awaits must not take the whole exam server down; it is logged instead.
    process.on('unhandledRejection', (reason) => {
        console.error('[UNHANDLED REJECTION]', reason && reason.stack ? reason.stack : reason);
    });
    // After an uncaught exception the process state is unknown: log it and exit so the platform restarts a clean process.
    process.on('uncaughtException', (err) => {
        console.error('[UNCAUGHT EXCEPTION]', err && err.stack ? err.stack : err);
        setTimeout(() => process.exit(1), 500).unref();
    });
}

module.exports = app; // Exported for supertest
