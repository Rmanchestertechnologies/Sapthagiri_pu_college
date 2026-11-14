/**
 * Unfinished paper (wizard) drafts: what a teacher has chosen so far, kept on the server so a closed laptop, a power cut or a
 * different computer never loses it. One draft per person per "context" key (a commissioned exam's subject block, or "free").
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

const KEY_RE = /^[A-Za-z0-9:_.-]{1,120}$/;
const MAX_BYTES = 4 * 1024 * 1024;
const STALE_DAYS = 45;
let ready = false;

async function ensureTable() {
    if (ready) return;
    await pool.query(`CREATE TABLE IF NOT EXISTS public.wizard_drafts (
        user_id text NOT NULL,
        draft_key text NOT NULL,
        state jsonb NOT NULL,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, draft_key)
    )`);
    ready = true;
}

const guard = [auth, checkRole(['admin', 'teacher'])];
const who = (req) => String(req.user.id);

// list my drafts (no heavy state), newest first; drafts untouched for 45 days are dropped
router.get('/', guard, async (req, res) => {
    try {
        await ensureTable();
        await pool.query(`DELETE FROM public.wizard_drafts WHERE updated_at < now() - interval '${STALE_DAYS} days'`);
        const r = await pool.query('SELECT draft_key, meta, updated_at FROM public.wizard_drafts WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20', [who(req)]);
        res.json(r.rows.map(x => ({ key: x.draft_key, meta: x.meta, updatedAt: x.updated_at })));
    } catch (err) {
        console.error('Drafts list error:', err.message);
        res.status(500).json({ msg: 'Could not read your drafts.' });
    }
});

router.get('/:key', guard, async (req, res) => {
    try {
        if (!KEY_RE.test(req.params.key)) return res.status(400).json({ msg: 'Invalid draft key.' });
        await ensureTable();
        const r = await pool.query('SELECT state, meta, updated_at FROM public.wizard_drafts WHERE user_id = $1 AND draft_key = $2', [who(req), req.params.key]);
        if (!r.rows[0]) return res.status(404).json({ msg: 'No draft.' });
        res.json({ state: r.rows[0].state, meta: r.rows[0].meta, updatedAt: r.rows[0].updated_at });
    } catch (err) {
        console.error('Draft read error:', err.message);
        res.status(500).json({ msg: 'Could not read the draft.' });
    }
});

router.put('/:key', guard, async (req, res) => {
    try {
        if (!KEY_RE.test(req.params.key)) return res.status(400).json({ msg: 'Invalid draft key.' });
        const { state, meta } = req.body || {};
        if (!state || typeof state !== 'object' || Array.isArray(state)) return res.status(400).json({ msg: 'A draft needs a "state" object.' });
        const text = JSON.stringify(state);
        if (Buffer.byteLength(text) > MAX_BYTES) return res.status(413).json({ msg: 'The draft is too large to keep.' });
        await ensureTable();
        await pool.query(
            `INSERT INTO public.wizard_drafts (user_id, draft_key, state, meta, updated_at) VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
             ON CONFLICT (user_id, draft_key) DO UPDATE SET state = EXCLUDED.state, meta = EXCLUDED.meta, updated_at = now()`,
            [who(req), req.params.key, text, JSON.stringify(meta && typeof meta === 'object' ? meta : {})]
        );
        res.json({ saved: true, at: new Date().toISOString() });
    } catch (err) {
        console.error('Draft save error:', err.message);
        res.status(500).json({ msg: 'Could not save the draft.' });
    }
});

router.delete('/:key', guard, async (req, res) => {
    try {
        if (!KEY_RE.test(req.params.key)) return res.status(400).json({ msg: 'Invalid draft key.' });
        await ensureTable();
        await pool.query('DELETE FROM public.wizard_drafts WHERE user_id = $1 AND draft_key = $2', [who(req), req.params.key]);
        res.json({ deleted: true });
    } catch (err) {
        console.error('Draft delete error:', err.message);
        res.status(500).json({ msg: 'Could not delete the draft.' });
    }
});

module.exports = router;
