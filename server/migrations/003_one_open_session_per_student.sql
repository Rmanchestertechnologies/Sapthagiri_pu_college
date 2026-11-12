-- 003: at most one OPEN sitting per student and exam
--
-- STATUS: NOT APPLIED to production. Apply with:  node scripts/migrate.js --apply   (dry run is the default)
--
-- Why: the start-of-exam check and the insert are now serialised inside one server process, which stops duplicates from
-- a double request. This constraint makes the database enforce it as well (several server instances, restarts), and the
-- server already treats a unique violation as "resume the existing sitting".
--
-- Before applying: if duplicate open sittings already exist the index cannot be created. This lists them:
--   SELECT exam_id, roll_number, count(*) FROM public.exam_sessions WHERE submitted = false AND roll_number <> ''
--   GROUP BY 1, 2 HAVING count(*) > 1;
-- Reset the extras from Results > "Reset attempt" (or delete the rows) first. Production currently has 0 sessions.
--
-- Compatibility: additive (an index only); rows are not changed.

-- ── UP ───────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_sessions_one_open
    ON public.exam_sessions (exam_id, roll_number)
    WHERE submitted = false AND roll_number <> '';

-- ── DOWN ──────────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.uq_exam_sessions_one_open;
