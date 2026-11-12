# Review findings and their resolution

Scope of this pass: every client screen and component (lint plus reading the ones not tested before), all server leftovers,
the Python OMR engine (static checks, secrets, deployment), dependency audit, and a route-by-route match of client calls to
server routes. Items marked **(owner)** need an action outside the code.

Verified clean: no undefined variables anywhere in the client; all Python files compile; **127 of 128 client API calls match a
server route (the 128th is a false alarm of the checker)**; all `dangerouslySetInnerHTML` uses go through DOMPurify; no secrets in
the Python engine; no hard-coded passwords in the client.

## Resolution (all items below were worked on in the follow-up commit)

| ID | Result |
|----|--------|
| RV-01, RV-02, RV-03 | **Fixed.** Server dependencies: 0 critical, 0 high (was 2 and 20). `proxy-addr`, `multer`, `cloudinary` 2.x, `puppeteer` 25 upgraded; PDF export re-verified. Remaining: 3 moderate (`archiver` via `readdir-glob`, only used for globbing which the app does not do) and 1 low (`katex` trust setting, not used). |
| RV-04 | **Fixed.** All MongoDB code, models, `mongoose`, `express-mongo-sanitize` (it silently deleted any JSON key containing a dot, e.g. an Excel column "Q. No"), the DNS override and the integration suite that needed it were removed. Login no longer has a second user store; a database outage now answers 503 "service unavailable" instead of "wrong password". |
| RV-05 | **Fixed in code, needs one deploy.** `omr_engine/requirements.txt` added (verified by following every import from `scan_cli.py`); `render.yaml` build installs the libraries into `omr_engine/pylibs`; `GET /api/omr/health` and the scan route tell the user plainly when Python or a library is missing; the scan screen shows a banner. The install mechanism was verified locally; it has not been run on Render itself. |
| RV-06 | **Fixed.** Client: 0 critical, 0 high (was 1 and 10). `xlsx` (no fix available) replaced by `exceljs`, lazy-loaded, with formula-injection protection on exports and size/row limits on imports. 1 low (`katex`) remains. |
| RV-07 | **Fixed in config, owner must confirm.** `render.yaml` now lists every variable the server reads and sets `TRUST_PROXY_HOPS=2` for the Vercel → Render path. Caveat that cannot be removed by code: if the API is also used directly at its onrender.com address, a forged `X-Forwarded-For` can bypass the lab-network check. |
| RV-08 | **Fixed.** Stale Vercel function entry and `server/vercel.json` removed; the root `vercel.json` (SPA + rewrite to Render) is kept. |
| RV-09, RV-13 | **Fixed.** Neutral login placeholder; faculty e-mail hint removed. |
| RV-10 | **Fixed.** Exam commissioning uses the signed-in user's name/e-mail; the misleading "assigned to faculty" message corrected. |
| RV-11 | **Fixed.** Throw-away debug scripts removed (root `find_*`, `test_*`, `check_*`, `server/check_*`, `server/test_*`). |
| RV-12 | **Accepted.** `sanitize.js` `sanitize()` is not used to render HTML; the renderer (`MathRenderer`) already passes through DOMPurify. An image-host allow-list there would risk hiding legitimate question images, so it was not applied. |
| RV-14 | **Fixed.** Admin paper preview has Approve / Reject buttons (server route existed). |
| RV-15 | **Fixed.** Bridge score colour uses the share of correct answers, valid for every marking scheme. |
| RV-16 | **Fixed.** `/lab` exam list has a live clock, guarded storage parsing; unused state removed. |
| RV-17 | **Fixed.** The MongoDB-based suite was replaced by `npm run test:e2e` (self-contained: in-memory PostgreSQL + the real server, ~100 checks). |
| RV-18 | **Fixed.** A failed PDF export shows the error instead of printing the page. |
| RV-19, RV-20 | **Fixed.** Duration parsed to a number; dead code removed from `SubjectDetails`. |
| RV-21 | **Fixed (the useful ones).** OMR result delete button added; bulk Excel/CSV import now has its screen (it existed in code with no way to open it). Remaining unused server routes (`PATCH papers/:id/section`, `PUT exams/:id`, blueprint/PYQ updates) are kept as harmless API. |
| RV-22 | **Not changed - needs your decision.** Students are identified by roll number only. A second factor needs data the system does not hold (e.g. date of birth). The invented e-mail address remains only as a fallback label. |
| RV-23 | **Fixed** for the three real violations (pie chart, refs in render, impure `Date.now()`); the rest are React-Compiler advisories shown as warnings. |
| RV-24 | **Fixed.** All 103 `alert()` calls now show a non-blocking toast; error boundary sends each user type to the right home. |
| RV-25 | **Fixed.** `npm run lint`: 0 errors (was 20+), 70 unused imports removed; 301 advisory warnings remain (style / compiler hints). |
| RV-26 | **Tooling done, data not changed.** `question_bank_apply_fixes.js` (dry run, backup table, rollback) tested on a throw-away database; the plan contains no safe automatic fix, so faculty must review `docs/data/question_bank_review_list.csv`. Bulk import now rejects the same kinds of rows (no options, no answer, no subject). |
| RV-27 | **Partly fixed.** Markdown markers removed in Word output; garbled source tables are a data problem. |
| RV-28 | **Not possible without your sheets.** OMR accuracy still unmeasured. |
| RV-29 | **Partly.** Requirements moved into `omr_engine`; the untracked `scratch/` folder (98 MB) was left alone because it is your data. |

Also fixed while doing this: Chrome for PDF export is stored inside the project (`.puppeteerrc.cjs`) so it survives the build on Render; one shared, bounded browser for all PDFs (no double launch, replaced after a crash); `/api/health` really checks the database and answers 503 when it is down; graceful shutdown, keep-alive timeouts and process-level error handlers; all 500 responses use a generic message (details stay in the server log) and always JSON; faculty create/delete/password-reset validate input and no longer report success when nothing happened (the administrator account cannot be deleted from that screen); Gemini key moved from the URL to a header; empty-while-loading state on the faculty question list; bulk import reports skipped rows; scripts that target a throw-away database (`ENV_FILE`) can no longer pick up the real `.env`.

## A. Security and deployment (fix first)

| ID | Sev | Where | Finding | Proposed fix |
|----|-----|-------|---------|--------------|
| RV-01 | CRITICAL | `server` dependency `proxy-addr` (via Express) | IP spoofing through IPv4-mapped IPv6 trust subnet. The lab-network restriction (`LAB_IP`) and the per-address rate limits rely on the client address. | `npm audit fix` (non-breaking), re-run tests. |
| RV-02 | CRITICAL | `server` `mongoose` | Prototype-pollution advisories. Mongoose is only a legacy fallback (see RV-04). | Remove Mongo code and the dependency (RV-04) rather than upgrade. |
| RV-03 | HIGH | `server` deps: `multer`, `cloudinary`, `multer-storage-cloudinary`, `puppeteer` chain, `sanitize-html`, `archiver`, `body-parser`, others (20 high in total) | Upload denial-of-service, argument injection, XSS in sanitiser, etc. | Upgrade in one batch (`npm audit fix`, then `puppeteer@25`, `cloudinary@2.11`, `archiver@7`), run all tests and the PDF/ZIP/Word exports. |
| RV-04 | HIGH | `index.js`, `config/db.js`, `routes/auth.js:116`, `routes/admin.js`, `services/postgresStorage.js`, `models/*`, 3 `check_*.js` | Legacy MongoDB path still live when `MONGO_URI` is set (`render.yaml` still lists it). **Login falls back to a second user store in MongoDB**; a faculty member removed from PostgreSQL but still present in MongoDB could sign in. Admin deletes/updates are mirrored "non-blocking" and can fail silently. Exams are dual-written. | Remove the Mongo code, models, `MONGO_URI` and the dependency; delete the dead integration suite (RV-17). |
| RV-05 | HIGH | `render.yaml` | Runtime is `node` with `npm install` only. **The OMR engine needs Python 3 with `opencv-python-headless`, `numpy`, `onnxruntime`; none is installed on Render, so OMR scanning cannot work in production.** The only requirements files are in an untracked `scratch/omr-scanner/` folder. | Add `server/omr_engine/requirements.txt`, and either a Docker deploy (Node + Python) or a separate OMR service; set `PYTHON_BIN`. **(owner)** decision on hosting. |
| RV-06 | HIGH | client deps | `dompurify` critical (the IN_PLACE hook advisories; the app does not use that mode, so exposure is low but it is the app's XSS guard), `axios`, `react-router-dom`, `vite`, `postcss` high; `xlsx` high **with no fix available**. | `npm audit fix`; replace `xlsx` (e.g. `exceljs`) or accept the risk for admin-only exports. |
| RV-07 | MEDIUM | `render.yaml` / `vercel.json` | Traffic is Vercel → Render (two proxies). `TRUST_PROXY_HOPS` must match or `req.ip` is a proxy address, which breaks `LAB_IP` and per-IP limits. `render.yaml` lacks `LAB_IP`, `LAB_ID`, `LAB_PASSWORD`, `DB_QBP_CONTROL_KEY`, `DB_SSL_CA`, `TRUST_PROXY_HOPS`, `DB_POOL_MAX`, `PYTHON_BIN`, and hard-codes a `SUPABASE_URL`. | Document and add the keys (values set in the dashboard), test the real client address behind both proxies. **(owner)** |
| RV-08 | MEDIUM | `server/vercel.json`, `api/index.js` | Stale: the backend runs on Render, but a Vercel function entry (with a BOM) and a server `vercel.json` remain. Root `vercel.json` rewrites to `sapthagiri-pu-college-api.onrender.com`, while old scripts use `qpg-backend-5h72.onrender.com`. | Delete the unused entry and confirm the single backend host. |
| RV-09 | MEDIUM | `UnifiedLogin.jsx` | The login placeholder shows the real admin e-mail. | Neutral placeholder. |
| RV-10 | MEDIUM | `SubjectDetails.jsx:117`, `AdminDashboard.jsx:311` | Admin e-mail and name hard-coded into every "commission exam" assignment, and all subjects are assigned to the admin account although the message says "assigned to faculty". | Take the subject's real faculty (or let the admin pick) and read the identity from the logged-in user. |
| RV-11 | MEDIUM | `server/test_production_*.js`, root `find_*.js`, `test_*.js`, `check_*.js`, `scratch/test_*` | Throw-away scripts that log in to the production URL, use Mongo models, or query the question databases. | Delete (they are not referenced anywhere). |
| RV-12 | LOW | `sanitize.js` | Allows `img` with remote `src` and `style`: tracking pixels / layout injection from bank content. | Restrict `src` to the image proxy / own storage. |
| RV-13 | LOW | `CreateTeacher.jsx` | Lists the pre-seeded faculty e-mails on screen. | Remove the hint. |

## B. Functional gaps and bugs

| ID | Sev | Where | Finding | Proposed fix |
|----|-----|-------|---------|--------------|
| RV-14 | HIGH | papers workflow | **Approval workflow is half-built.** Teacher papers are created "Pending Approval"; the server has `PUT /api/papers/admin/:id/status`, but no screen calls it, so papers stay Pending forever (`SubjectDetails`, `SavedPapers` show the badge only). | Add Approve / Reject buttons for admins (or drop the status). **(owner)** decide the intended workflow. |
| RV-15 | MEDIUM | `BridgeApp.jsx:27` | Score colour assumes +4 per question, so CET (+1) and negative-marked results are always red/amber. | Use the exam's marking scheme or the maximum from the server. |
| RV-16 | MEDIUM | `LabExamList.jsx` (the `/lab` flow) | `now` is computed once per render: an "upcoming" exam never turns live without a reload; `JSON.parse(localStorage lab_user)` is unguarded (a corrupt value crashes the page); full-screen is requested after an await so browsers refuse it. Two parallel student entry flows exist (`/lab-exam` and `/lab`). | Add the 1-second clock like `StudentLabPortal`, guard the parse, request full screen from the click handler, and keep one flow. |
| RV-17 | MEDIUM | `server/tests/exam_commission_flow.test.js`, `tests/setup.js`, `npm test` | The "integration suite" is written for MongoDB models; `npm test` cannot work against the current PostgreSQL app. | Remove, or rewrite against a throw-away PostgreSQL. (The 81-check API script used in this audit can be added to the repo.) |
| RV-18 | MEDIUM | `SavedPapers.jsx:325` | If the PDF export fails it silently calls `window.print()`, printing the whole dashboard page with no error. | Show the error instead. |
| RV-19 | MEDIUM | `SubjectDetails.jsx:80` | `duration_minutes: paper.duration || 180` where `duration` can be a string such as "180 Minutes" (as the Word export expects) → NaN sent to the server. | Parse to a number. |
| RV-20 | LOW | `SubjectDetails.jsx` | Dead code: `{true && ...}`, unused `activeTab`, `assignedTeachers`, `creator`; fuzzy subject matching. | Clean up. |
| RV-21 | LOW | routes without a screen | `PATCH /papers/:id/section`, `DELETE /omr/submissions/:id`, `PUT /exams/:id`, `PUT /exam-blueprints/:id`, `GET /exam-blueprints/:id`, `PUT /previous-year-papers/:id`, `GET /admin/questions-daily-stats`. | Add UI (OMR scan delete is the useful one) or remove. |
| RV-22 | LOW | `StudentLabPortal.jsx`, `LabExamList.jsx` | A student is identified by roll number only (no PIN/DOB); anyone who knows a classmate's number can start that student's one attempt. A missing e-mail is replaced by an invented `…@student.sapthagiri.edu`. | Add a second factor **(owner)**; do not invent e-mails. |
| RV-23 | LOW | `PaperAnalysisModal.jsx:37`, `ExamEngine.jsx:434`, `StudentLabPortal.jsx:27` | React rule violations (variable reassigned in render, ref read in render, `Date.now()` in render). Work today, fragile with the React compiler. | Refactor. |
| RV-24 | LOW | 103 `alert()` calls | Blocking browser dialogs for errors/success throughout. | Replace with an inline toast component. |
| RV-25 | LOW | client lint | 171 unused variables/imports, 127 useless regex escapes, 39 set-state-in-effect, 17 missing hook dependencies, 20 fast-refresh export warnings. | One cleanup pass; no behaviour change intended. |

## C. Data and engine

| ID | Sev | Where | Finding | Proposed fix |
|----|-----|-------|---------|--------------|
| RV-26 | HIGH | question banks | About 6 400 flagged rows, **171 with an invalid `correct_option`** (students would be marked wrong), 3 609 `[UNCLEAR]`, 1 922 duplicates, 501 duplicate options, 98 without options, 60 empty. No row has a safe automatic fix. List: `docs/data/question_bank_review_list.csv`. | Faculty review with the CSV; then an approved, backed-up update script. **(owner)** |
| RV-27 | MEDIUM | `wordExport.js` | Match-the-following questions stored as a garbled markdown table yield wrong column items; layout in Microsoft Word itself was not viewed. | Fix at the data source; check the file in Word. |
| RV-28 | MEDIUM | OMR engine (33 000 lines Python) | Only run on one sample sheet; accuracy unknown. Review flags exist (`OMR_REVIEW_GAP`). Loads `tensorflow` only in training scripts, runtime needs only onnxruntime. | Scan 50–100 labelled real sheets, measure, tune. **(owner)** supplies sheets. |
| RV-29 | LOW | repo | `scratch/` (98 MB, untracked) holds a second copy of the OMR project and requirements; `server/omr_engine/alignment_debug` and 3 model/reference files are large. | Move requirements into `omr_engine`, then delete `scratch/`. |

## D. Still open from earlier passes

Credential rotation and git-history purge (OPEN-07, OPEN-18); migrations 001–004 not applied to production; `DB_SSL_CA` (OPEN-20);
`LAB_IP` unset (OPEN-11); policy decisions on disqualification score and per-exam marking rules (OPEN-15, OPEN-16); admin class
filter on GET `/api/questions` and QBP rows (OPEN-02, OPEN-04); stable P/Q/R/S seed for unsaved papers (OPEN-26); Grand Test /
previous-year import endpoints (501) pending migration 001 (OPEN-27).

## E. Not covered even now

Visual behaviour of the paper wizard / A4 engine on other browsers and printers; load testing with a full lab (hundreds of
simultaneous students); Render cold-start behaviour; the content of every one of the 28 000 client lines was not read — the
unread parts were covered by lint, route matching and pattern searches only.
