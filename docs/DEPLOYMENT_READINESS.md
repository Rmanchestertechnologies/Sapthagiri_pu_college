# Deployment readiness and operations

Status: **code ready, environment not yet verified.** The items marked ☐ must be done by someone with access to Render,
Supabase, Vercel and MongoDB Atlas; the code cannot do them.

## 1. Go-live checklist

### A. Render (API) — `sapthagiri-pu-college-api`
- ☐ `DATABASE_URL` is the working pooler address of the primary Supabase project (the host region must match the project).
  Check `https://sapthagiri-pu-college-api.onrender.com/api/health` → `{"status":"ok","db":"ok"}`. A 503 with
  `"db":"unreachable"` means this value (host, user or password) is wrong.
- ☐ Set: `JWT_SECRET` (long random, not a sentence), `ADMIN_PASSWORD`, the eight `DB_*_URL` question databases,
  `ALLOWED_ORIGINS=https://sapthagiri-pu-college-edg1.vercel.app` (never `*`), `TRUST_PROXY_HOPS=1`, `LAB_ID`,
  `LAB_PASSWORD`, `LAB_IP` (public address(es) of the lab), `DB_QBP_CONTROL_KEY`, `DB_SSL_CA` (Supabase CA).
- ☐ Optional: `CLOUDINARY_*` (image uploads), `GEMINI_API_KEY` (AI variants / text parsing), `PYTHON_BIN=python3`.
- ☐ Remove `MONGO_URI` (no longer used) and revoke that MongoDB user.
- ☐ After the deploy: open the OMR screen as admin. A red banner means the Python libraries did not install in the build
  (`render.yaml` installs them into `server/omr_engine/pylibs`); the banner names what is missing.
- ☐ Download one paper as PDF (confirms Chrome is found).

### A2. App database moved (2026-11-13)
The app's own tables (users, students, papers, online exams, blueprints, notifications, question usage) were copied from the
Physics Class 11 project to a **separate new Supabase project** (`pxtdwuripvmpmtvbztid`, pooler host `aws-0-ap-southeast-2`) with
`node server/scripts/move_app_data.js` (tested by `npm --prefix server run test:move`). The question databases were not copied
or changed, and the old database was only read. `DATABASE_URL` on Render now points at the new project (use its **pooler**
address: the direct `db.<ref>.supabase.co` address is IPv6-only). The new users table was emptied on purpose: the only login is the
built-in admin (`sapthagiripucollegedvg@gmail.com`, password = `ADMIN_PASSWORD`). The old copy (6 users, all rows) still exists in
the Physics 11 project and can be used as a fallback by pointing `DATABASE_URL` back at it.

### B. Supabase
- ☐ Take a backup / snapshot of the primary project.
- ☐ Run migrations: `cd server && node scripts/migrate.js` (shows pending), then `node scripts/migrate.js --apply`.
  Migration 004 is required for OMR results; 002 for per-faculty OMR permission; 003 and 001 are optional hardening / features.
- ☐ Run `node scripts/hash_plaintext_passwords.js` (dry run) and confirm no unhashed passwords.

### C. Credentials (everything that was ever committed is exposed)
- ☐ Rotate: all Supabase database passwords, the QBP control key, the MongoDB user, `JWT_SECRET`, `ADMIN_PASSWORD`, the lab
  password. Delete any downloaded `.env` files from personal folders.
- ☐ Optional but recommended: remove the old secrets from git history (needs a history rewrite; ask first).

### D. Vercel (site) — project `sapthagiri-pu-college-edg1`
- ✔ Deploys on every push; security headers and cache rules are in `vercel.json`.
- ☐ `client/.env.production` has `VITE_API_URL=https://sapthagiri-pu-college-api.onrender.com`; change it only together with
  `ALLOWED_ORIGINS` and `TRUST_PROXY_HOPS`.

## 2. Before each exam day

1. Health check green (above). Render free plans sleep: open the API address ten minutes before students arrive so the first
   request is not slow.
2. Check the lab: `LAB_IP` matches, a test student (not a real one) can sign in and open the exam, then reset that attempt
   (Results → *Reset attempt*).
3. Exam is `live`, start/end times correct, question count as expected (the card on the lab portal shows it).
4. Invigilator knows: a student who is disqualified or finished cannot restart; an admin resets one attempt from the Results
   page; a refresh resumes with answers and remaining time.

## 3. Daily / weekly

* Look at the Render logs for `[ERROR]`, `[UNHANDLED REJECTION]`, `[UNCAUGHT EXCEPTION]`.
* Supabase: confirm backups are enabled and check database size (the primary database is small).
* After every dependency change run: `npm --prefix server test`, `npm --prefix client test`, `npm --prefix server run test:e2e`.

## 4. Rollback

* **Code:** Render and Vercel keep previous deploys; roll back from their dashboards, or `git revert <commit>` and push.
* **Migrations:** each file ends with its rollback SQL (below the `DOWN` marker). 004 rollback drops stored OMR results — export first.
* **Question-bank edits:** `node scripts/question_bank_apply_fixes.js --rollback <backup_table> --db <key>`.

## 5. Capacity notes (measured or reasoned)

* Exam traffic is limited per exam session (180 requests/minute), not per address, so a whole lab behind one IP is fine
  (tested with 400 polls from one address).
* Autosave sends every 4 seconds only when answers changed (at least every 30 s); the portal polls the exam list every 15 s.
* The database pool for the primary database defaults to 10 connections (`DB_POOL_MAX`). Not load-tested with hundreds of
  simultaneous students; run a rehearsal with the real lab before a large exam.
* Free hosting plans have memory and cold-start limits; the PDF browser is capped at 3 simultaneous pages.

## 6. Honest limits

* OMR accuracy has not been measured; always use the review flags and spot-check scanned sheets.
* Browser monitoring (tab switches, full screen) discourages cheating but cannot prevent it.
* Students are identified by roll number only.
* Question-bank errors (see `docs/data/question_bank_review_list.csv`) still need faculty review.
* Nothing here has been run on Render itself by the author of this audit: the live API was last seen reporting its database
  unreachable, which points at the `DATABASE_URL` value.
