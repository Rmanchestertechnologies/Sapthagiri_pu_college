/**
 * public.users.omr_access is read by the faculty list, the session restore (/me) and the OMR permission check, and
 * written by the admin "OMR access" toggle. The production table does NOT have this column (checked), so those
 * SELECTs failed: the admin faculty list came back empty and no teacher could ever be granted OMR access.
 *
 * Reads go through this expression, which yields false when the column is absent and the real value once
 * migration 002 has added it. Alias the table as `u`. Writes still need the column (see routes/admin.js).
 */
const OMR_ACCESS_SQL = "COALESCE((to_jsonb(u) ->> 'omr_access')::boolean, false)";

/** Postgres error code for "column does not exist" */
const UNDEFINED_COLUMN = '42703';

module.exports = { OMR_ACCESS_SQL, UNDEFINED_COLUMN };
