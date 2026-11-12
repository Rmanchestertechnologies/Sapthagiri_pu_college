# Review findings (nothing in this list has been changed yet)

Scope of this pass: every client screen and component (lint plus reading the ones not tested before), all server leftovers,
the Python OMR engine (static checks, secrets, deployment), dependency audit, and a route-by-route match of client calls to
server routes. Items marked **(owner)** need an action outside the code.

Verified clean: no undefined variables anywhere in the client; all Python files compile; **127 of 128 client API calls match a
server route (the 128th is a false alarm of the checker)**; all `dangerouslySetInnerHTML` uses go through DOMPurify; no secrets in
the Python engine; no hard-coded passwords in the client.

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
