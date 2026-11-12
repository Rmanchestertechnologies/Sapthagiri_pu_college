-- 004: public.omr_submissions (stored OMR scan results)
--
-- STATUS: NOT APPLIED to production. Apply with:  node scripts/migrate.js --apply   (dry run is the default)
--
-- Why: routes/omr.js reads and writes public.omr_submissions, but no script in the repository created it, so a database
-- built from scripts/init_db.js failed every scan with `relation "public.omr_submissions" does not exist`. If the production
-- database already has the table (it may have been created by hand), CREATE TABLE IF NOT EXISTS leaves it untouched; compare
-- its columns with the ones below before relying on it.
--
-- Compatibility: additive. Columns are exactly those used by routes/omr.js.

-- ── UP ───────────────────────────────────────────────────────────────────────────
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

-- ── DOWN ──────────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.omr_submissions;   -- destroys stored scan results
