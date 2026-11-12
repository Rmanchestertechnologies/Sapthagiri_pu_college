-- 002: users.omr_access
--
-- STATUS: NOT APPLIED to production. Apply with:  node scripts/migrate.js --apply   (dry run is the default)
--
-- Why: the faculty list, the session restore (/api/auth/me), the OMR permission check and the admin "OMR access" toggle
-- all use public.users.omr_access, but the production users table has no such column (its columns: id, name, email,
-- password_hash, role, subject, status, is_active, login_limit, created_at, updated_at, last_login, password).
-- The application now reads the flag defensively (false when the column is missing), so nothing breaks before this is
-- applied, but OMR access cannot be granted to a teacher until it is.
--
-- Compatibility: additive and nullable-with-default; existing rows get FALSE (nobody gains access).

-- ── UP ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS omr_access BOOLEAN DEFAULT FALSE;

-- ── DOWN (manual rollback; forgets who had OMR access) ────────────────────────────
-- ALTER TABLE public.users DROP COLUMN IF EXISTS omr_access;
