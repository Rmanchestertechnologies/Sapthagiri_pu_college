-- 001: storage for Grand Test and previous-year question lists
--
-- STATUS: NOT APPLIED. Written for review; nothing runs it automatically.
-- Apply with:   node scripts/migrate.js --apply      (a dry run is the default)
-- Roll back with the "DOWN" section at the bottom (run it by hand).
--
-- Why: public.grand_test_papers and public.previous_year_papers hold only paper metadata. The import / replace /
-- remove-question endpoints (routes/grandTests.js, previousYearPapers.js) used MongoDB models that no longer exist
-- in this deployment and now answer 501. The Grand Test screen also cannot save a template, code, subject or year
-- level because there are no columns for them.
--
-- Compatibility: purely additive. No existing column, row or index is changed, so the current API and the
-- admin screens keep working before and after. New columns are nullable / defaulted.
-- Questions themselves stay in the question databases; these tables store only references (question id +
-- the database it lives in) and, optionally, a JSON snapshot so a paper survives edits to the question bank.

-- ── UP ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.grand_test_papers
    ADD COLUMN IF NOT EXISTS code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS subject VARCHAR(100) DEFAULT 'Mixed',
    ADD COLUMN IF NOT EXISTS academic_year_level VARCHAR(50),
    ADD COLUMN IF NOT EXISTS template_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS public.grand_test_questions (
    id              SERIAL PRIMARY KEY,
    grand_test_id   INTEGER NOT NULL REFERENCES public.grand_test_papers(id) ON DELETE CASCADE,
    question_id     TEXT NOT NULL,                 -- id in its question database (kept as the original identifier)
    source_db       TEXT,                          -- e.g. phy_12, chem_11, qbp_control
    position        INTEGER NOT NULL,              -- 1-based order inside the grand test
    snapshot        JSONB,                         -- optional copy of the question as imported
    created_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (grand_test_id, question_id),
    UNIQUE (grand_test_id, position)
);
CREATE INDEX IF NOT EXISTS idx_grand_test_questions_gt ON public.grand_test_questions(grand_test_id);

ALTER TABLE public.previous_year_papers
    ADD COLUMN IF NOT EXISTS template_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS public.previous_year_questions (
    id              SERIAL PRIMARY KEY,
    paper_id        INTEGER NOT NULL REFERENCES public.previous_year_papers(id) ON DELETE CASCADE,
    question_id     TEXT NOT NULL,
    source_db       TEXT,
    position        INTEGER NOT NULL,
    snapshot        JSONB,
    created_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (paper_id, question_id),
    UNIQUE (paper_id, position)
);
CREATE INDEX IF NOT EXISTS idx_previous_year_questions_paper ON public.previous_year_questions(paper_id);

-- ── DOWN (manual rollback; destroys any rows written to the new tables/columns) ───────
-- DROP TABLE IF EXISTS public.previous_year_questions;
-- DROP TABLE IF EXISTS public.grand_test_questions;
-- ALTER TABLE public.previous_year_papers DROP COLUMN IF EXISTS template_id;
-- ALTER TABLE public.grand_test_papers
--     DROP COLUMN IF EXISTS template_id, DROP COLUMN IF EXISTS academic_year_level,
--     DROP COLUMN IF EXISTS subject, DROP COLUMN IF EXISTS code;
