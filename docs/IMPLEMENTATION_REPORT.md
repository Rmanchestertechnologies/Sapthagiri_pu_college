# Implementation report

What was done to the project, why, how it was checked, and what remains. Companion documents: `ARCHITECTURE.md` (how it
works), `AUDIT_AND_CHANGELOG.md` (issue register and file-level change log), `REVIEW_FINDINGS.md` (second review and its
resolution), `DEPLOYMENT_READINESS.md` (what to do before and after going live).

Baseline = commit `e4c1070` (before the audit). Since then: 9 commits; 203 files touched (about +19 600 / −7 600 lines
including generated lock files, tests and docs); 57 files added, 57 removed (mostly the legacy MongoDB models and debug scripts).

## 1. Method

Understand → trace → identify → plan → implement → test → verify, in that order, per area. Fixes were made at the root
cause (server first, then the screen that depends on it). Each fix was checked by a test, by running the real server
against a throw-away database, or by driving the real screen in a browser; where none of these was possible it is listed
under "not verified". No production database was changed by this work.

## 2. What was done, by area

| Area | Main problems found | Result |
|---|---|---|
| **Question generation (AutoFetch)** | Chapter quotas ignored (30 questions from one chapter instead of 3×10); duplicates; option-less questions in NEET/CET; chapter name variants. | New pure selector `questionSelector.js`, server-side quotas, generation report on screen, case-insensitive chapters, strict class routing. |
| **P/Q/R/S sets and keys** | Browser and server shuffles could disagree; unsaved papers differed from saved ones. | One seeded algorithm in both places, parity test, seed stored with the paper, key computed from the same seed for OMR. |
| **Answer key / solution / numbering** | Custom start number ignored in places. | Start number honoured everywhere; set-aware keys. |
| **Assignments** | Missing fields and per-chapter loading. | Student details, class, marks, date, instructions, balanced auto-pick. |
| **Merge** | Marks and section counts wrong after de-duplication. | Marks by exam type, counts after dedupe, class union, warnings. |
| **Online exam** | Client re-initialised each second (request storm), autosave never ran, reload disqualified students, restart gave a fresh sitting, duplicate sessions, scoring compared text not the letter, CORS blocked the session header, shared lab IP exhausted rate limits. | All fixed on the server and the screen; one attempt per student; admin can reset one; scoring authoritative on the server. |
| **OMR** | One long request for a whole batch, no review flags, grading against the wrong series, missing results table, Python not checked. | Background jobs with polling, series-aware grading, review flags, results table + migration, runtime health check with a plain message. |
| **Security** | Secrets committed, student endpoints unauthenticated, SSRF in the image proxy, hostile titles in PDFs, second user store (MongoDB), guessable defaults, 2 critical + 20 high server advisories, 1 critical + 10 high client advisories. | Secrets removed (rotation still needed), per-session tokens, allow-lists, hardened PDF generator, MongoDB removed, advisories fixed (0 critical/high now). |
| **Exports** | Raw LaTeX in Word, header errors on unicode titles, unsafe spreadsheet cells, `xlsx` advisory. | Fraction/Greek/ordinal conversion, safe download headers, `exceljs` with formula protection. |
| **Question bank page** | Loaded 20 000 questions twice per visit. | Server-side paging, filters, loading and error states. |
| **Faculty management** | Delete / reset reported success when nothing changed; weak passwords; admin deletable. | Validated, honest results, 404 for unknown ids. |
| **UI / UX** | Overflowing phone layouts, blocking pop-ups, instructions describing features that do not exist, first question never "visited", options clickable only by a small radio, inconsistent step numbering, "empty" shown while loading. | Responsive admin shell, toasts, truthful instructions, correct visit tracking, clickable option rows, one stepper (5 or 6 steps), loading states. |
| **Structure** | `QuestionBlock.jsx` 2 654 lines, `PaperRenderer.jsx` 1 011, `ExamManagement.jsx` 1 337. | Split into focused files (`components/question/*`, `paper-renderer/*`, `pages/admin/exam-management/*`, ...) with identical rendered output (checked by fingerprint). |
| **Operations** | No migrations process, no health check, shared-IP rate limits, PDF Chrome lost between build and run. | Migration runner, real health check, bounded PDF browser, Chrome cached in the project, graceful shutdown. |

## 3. Database and migration notes

No schema or data in production was changed. Four additive migrations are written, tested on a throw-away database
(applied twice, idempotent) and **not applied to production**:

| # | What | Needed for |
|---|---|---|
| 001 | Grand-test / previous-year question tables | Those import endpoints (currently answer 501). |
| 002 | `users.omr_access` | Per-faculty OMR permission (production lacks the column; the server tolerates that). |
| 003 | Unique index: one open session per student and exam | Database-level guarantee against duplicate sittings (server lock already prevents them in one process). |
| 004 | `omr_submissions` table | **Storing OMR scan results; the table does not exist in production, so OMR cannot save results there until this runs.** |

Apply with `node server/scripts/migrate.js` (dry run) then `--apply`, after a Supabase backup. 003 needs no duplicate
open sessions: run the check query written at the top of the file first (production had zero sessions when checked).

## 4. API changes

New: `GET /api/health` (database check), `GET /api/omr/health`, `POST /api/omr/scan?async=true`, `GET /api/omr/scan/jobs/:id`,
`DELETE /api/exams/:id/sessions/:sessionId` (reset an attempt), `POST /api/questions/chapter-distribution`.
Changed behaviour (existing fields unchanged): student exam endpoints need the session token; `/start` answers 409 when the
student already finished; faculty password minimum is 8 characters and departments are validated; bulk import skips invalid rows
and reports them; every 500 returns a generic JSON message; login answers 503 when the database is down.
Removed: nothing a screen used.

## 5. Test results (final run)

| Suite | Result |
|---|---|
| Server unit tests (`npm --prefix server test`) | 17 suites, **152 passed** |
| Client tests (`npm --prefix client test`) | **29 passed** |
| End-to-end (`npm --prefix server run test:e2e`) | **100 checks passed** against the real server and a throw-away PostgreSQL (logins, exam flow, scoring, rate limits, merge, faculty management, approval, bulk import, OMR scan job through the real engine) |
| Client build / lint | build succeeds; lint 0 errors (315 advisory warnings) |
| Dependency audit | server 0 critical / 0 high (3 moderate, 1 low); client 0 critical / 0 high (1 low) |
| Browser checks | student exam flow, wizard auto fetch (45 of 45), assignments, admin screens, import modal, toasts, phone-width admin screens, split-file preview fingerprint identical before and after |

## 6. Files

Full file-level list: `git diff --stat e4c1070..HEAD` and the change log in `AUDIT_AND_CHANGELOG.md`. Largest groups: server
tests (20), server services (16), admin pages (13), paper components (13), routes (12), scripts (7), middleware (7), config (7).

## 7. Known issues and limits

* Migrations 001–004 are not applied; credentials that were once committed must be rotated; Render must have the correct
  `DATABASE_URL` (the live API reported the database unreachable at the last check).
* OMR accuracy is unmeasured; Word output was checked by content, not in Microsoft Word; match-the-following questions stored as
  a garbled table keep wrong items (data problem).
* Question bank: about 6 400 flagged rows (171 with an invalid `correct_option`); none could be fixed automatically
  (`docs/data/question_bank_review_list.csv`).
* Students are identified by roll number only. The paper wizard's main component and the admin dashboard home are still very
  large. Grand-test / previous-year import returns 501.

## 8. Deployment readiness

See `DEPLOYMENT_READINESS.md`. Short version: the code is ready; the environment and data steps listed there are not done yet.
