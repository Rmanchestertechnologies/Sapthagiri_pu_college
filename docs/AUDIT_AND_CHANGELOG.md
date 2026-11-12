# Audit, Issue Register and Change Log

Dates: 2026-11-11 and 2026-11-12. Areas audited: question generation (AutoFetch), PQRS sets, answer-key
numbering, the online CBT portal, authentication and API permissions, the OMR route and evaluator, the
assignment generator, Excel/answer-key export, database routing, and lint-level correctness of the whole
client. **Not done:** the UI redesign, a visual check of PDF output, any measurement of OMR accuracy, performance
profiling, and an end-to-end exam run. See section 5.

## 1. How the audited parts connect

```
CommissionedExam.jsx (7-step wizard, teacher)
  Step 2-5 state: selectedChapters, chapterQuotas, typeAllocations, difficultyDistribution
  Auto Fetch  ──POST /api/questions/chapter-distribution──▶ routes/questions.js
                                                             └▶ services/supabaseQuestions.getQuestionsWithChapterQuotas
                                                                  ├▶ getQuestions()  (one random sample per chapter)
                                                                  │     └▶ config/subjectDatabases.getPoolsForQuery → 8 subject pools (+ QBP control)
                                                                  └▶ services/questionSelector.assembleByQuotas  (pure)
  Manual mode ──GET /api/questions?chapter=…──▶ getQuestions()
  Step 7: PaperRenderer ─┐
          A4AnswerKey    ├─ each derives the active P/Q/R/S set with utils/pqrsGenerator.generatePaperSet(master, set, startQNo)
          A4SolutionKey ─┘
```

Database topology (from `server/config/subjectDatabases.js`): one primary PostgreSQL database
(papers, exams, `question_usage`), eight subject pools keyed `phy|chem|math|bio` × `11|12`, and a
"QBP control" Supabase project for previous-year / grand-test questions. Botany and Zoology are
chapter subsets of the Biology pools. There are no cross-database transactions.

## 2. Issue register

Severity: CRITICAL = wrong exam content/keys, data loss, security. HIGH = broken core feature.

### Fixed in this pass

| ID | Sev | File | Problem and root cause | Fix | Test |
|----|-----|------|------------------------|-----|------|
| QG-01 | CRITICAL | `client/.../CommissionedExam.jsx` `executeFetch` | A 10/10/10 request could return 30 questions from one chapter. The paper was assembled in the browser from one GET per chapter. A chapter whose GET failed or returned nothing was logged to the console and treated as empty, then "Phase 3 global backfill" filled the whole deficit from whichever chapters did return rows. | Assembly moved to the server (`POST /api/questions/chapter-distribution`). A chapter is only ever filled from its own pool; shortfalls and database failures are returned in a report and shown in Step 7. | `server/tests/questionSelector.test.js` (regression test + live probe) |
| QG-02 | CRITICAL | `server/services/supabaseQuestions.js` `buildQueryFilters` | Chapter filter was split on commas. "Semiconductor Electronics: Materials, Devices and Simple Circuits" (Physics 12) therefore matched nothing, which triggered QG-01. | `parseChapterList`: arrays are taken as-is; a string is matched both whole and comma-split. | live probe |
| QG-03 | HIGH | `CommissionedExam.jsx` | `totalChapterQuestions` summed quotas of chapters that had since been deselected, inflating the target and feeding the backfill. | Total is computed over currently selected chapters only. | build |
| QG-04 | HIGH | `supabaseQuestions.js` `getQuestions` | Any query with a chapter filter was widened to both class databases, so class selection was not enforced. | `strictClass` option, used by quota generation. (GET path unchanged, see OPEN-02.) | live probe (Class 11 request for a Class 12 chapter returns 0 and says so) |
| QG-05 | HIGH | `CommissionedExam.jsx` | Difficulty percentages were only used as a filter; the 30/50/20 split was never applied. Candidates were always the newest 40 rows per chapter, so papers repeated. | Selector steers picks toward each level's remaining target and reports any deviation; candidates are a random sample of the chapter. | unit tests + live probe (9/15/6 delivered) |
| QG-06 | MEDIUM | `supabaseQuestions.js` | A failed subject database looked identical to an empty one. | `getQuestions` returns `dbError`; the quota endpoint turns it into a warning. | none (not exercised against a real outage) |
| AK-01 | CRITICAL | `CommissionedExam.jsx` | Opening the Answer Key or Solution Guide from the wizard referenced an undefined variable (`paperSettings`), throwing at render. The custom starting number could never reach either key. | Uses `settings.startQNo`. | lint `no-undef` clean, build |
| PQ-01 | CRITICAL | `CommissionedExam.jsx`, `pqrsGenerator.js` | The wizard permuted the paper for set Q/R/S, then PaperRenderer and both keys permuted that result again. Word export permuted once, so it disagreed with the preview; switching sets inside the key dialog produced a key for a paper that was never printed; edits made while a set was active overwrote the master order with a shuffled one. | Wizard passes the master paper; `generatePaperSet` restores the master before permuting, so calling it on a generated set is harmless (also covers `AdminPaperPreview.jsx`). | `client/tests/pqrsGenerator.test.mjs` regression test |
| PQ-02 | HIGH | `pqrsGenerator.js` | Option shuffle read `answer` before `correct_option`; the key reads `correct_option` first. Options were shuffled even when the answer could not be resolved, or when options referred to each other ("Both 1 and 2", "All of the above"). | Same precedence in both; such questions keep their option order. | unit tests |
| PQ-03 | MEDIUM | `pqrsGenerator.js`, `CommissionedExam.jsx` | Start number not passed to Word export or `generateAllPQRS`; stale `originalQNo` values were trusted. | Start number threaded through; `originalQNo` recomputed. | unit tests (start 1, 10, 25) |

### Fixed in the CBT pass

At the time of this audit `exam_sessions` held 0 rows: the CBT portal has not yet been used on
the PostgreSQL store, which is consistent with the defects below going unnoticed.

| ID | Sev | File | Problem and root cause | Fix | Test |
|----|-----|------|------------------------|-----|------|
| CBT-01 | CRITICAL | `server/routes/exams.js` `GET /:id` | Returned the full exam including answers to any valid token. Lab-terminal tokens (role `lab`) pass `auth`, so a student terminal could read the key. | Restricted to admin/teacher (the only client caller is the teacher wizard). | routes load |
| CBT-02 | CRITICAL | `exams.js` scorecard, pdf-report | The scorecard, which lists every correct answer, was served for sessions that were still in progress. | 403 until the session is submitted; session must belong to the exam. | code review |
| CBT-03 | CRITICAL | `client/.../ExamEngine.jsx`, `exams.js` `/start` | The countdown read `session.startTime`; the server sends `start_time`. Remaining time was `NaN`, so the clock showed NaN and auto-submit never fired. | Server returns `remainingSeconds` from its own clock; client uses it and resyncs on each autosave. | `cbtScoring.test.js` timing |
| CBT-04 | CRITICAL | `exams.js` `/malpractice` | Called `storage.saveSession`, which does not exist. Every report failed with 500 and the session stayed open, so a disqualified student could resume. | Uses `updateSession`; never re-flags a closed session. | routes load |
| CBT-05 | CRITICAL | `exams.js` `/submit` | Numerical answers were also compared as option labels: a typed "21" matched a key of "12". A key that was literally the option "Both A and B" accepted A or B. | `services/cbtScoring.js`: numerical compared as numbers only; option text checked before label parsing. | regression tests |
| CBT-06 | CRITICAL | `exams.js` `/submit`, `/start` | Composite exams (questions held in subject papers; 20 of 26 exams have an empty `questions` array) were not hydrated, so they started with 0 questions and scored 0. | Hydrated in start, submit and scorecard; start refuses an exam with no questions. | not exercised end-to-end |
| CBT-07 | HIGH | `exams.js` `/submit`, `/save-progress` | Submission used only the posted answers; an empty or partial payload discarded autosaved work. Autosave with an empty array erased the session. | Answers are merged per question; empty autosave is rejected. | regression tests |
| CBT-08 | HIGH | `ExamEngine.jsx` | Auto-submit at time-up ran from a stale timer closure and sent the answers as they were when the student last changed question. A failed submit gave no message. | Submit reads the latest answers; failure is shown and auto-submit retries; offline indicator for failed autosave. | build |
| CBT-09 | HIGH | `exams.js` `/submit`, `/save-progress` | No server-side time limit, and a session could be submitted against a different exam id. | Deadline = session start + duration, capped by scheduled end, plus 2 min grace. Late submissions are scored from answers saved in time. Session/exam match enforced. Start refused outside the scheduled window. | timing tests |
| CBT-10 | HIGH | `exams.js` scorecard | Per-question "correct" used plain string equality, disagreeing with the stored score. | Same function as scoring. | unit test |
| CBT-11 | HIGH | `exams.js` bridge routes | Referenced `OnlineExam`, `BridgeKey`, `ExamSession`, none imported: both endpoints always returned 500. | Rewritten on the PostgreSQL storage layer. | routes load only |
| CBT-12 | MEDIUM | `exams.js` | `supabaseQuestions` used without import (ID-only papers silently fell back to cached copies); weak areas were never stored because `[] || x` kept the empty array. | Import added; correct key passed. | routes load |
| CBT-13 | LOW | `ExamEngine.jsx` | `currentIdx` undefined (would throw for a diagram question without an id). | Uses `current`. | lint |

| LAB-01 | CRITICAL | `server/routes/lab.js` `/login`, `client/src/pages/lab/LabLogin.jsx` | Lab login accepted built-in IDs and passwords alongside the configured ones, signed tokens with a built-in secret when `JWT_SECRET` was unset, and the login page printed the default password. | Only `LAB_ID` / `LAB_PASSWORD` from the environment are accepted (constant-time compare); 503 when they or `JWT_SECRET` are unset; hints removed from the page. **`LAB_ID` and `LAB_PASSWORD` are not set in `server/.env` or `render.yaml`, so lab login is refused until they are added.** | handler exercised with fake requests: 7 cases |

### Fixed in the API / OMR / client pass

| ID | Sev | File | Problem and root cause | Fix | Test |
|----|-----|------|------------------------|-----|------|
| API-01 | CRITICAL | `server/routes/auth.js` | Admin password fell back to a built-in default and tokens were signed with a built-in secret when the environment variables were unset; unknown e-mail and wrong password gave different messages (account enumeration); passwords compared with `===`. | No fallbacks (503 when unset), one message for both failures, constant-time compare. | `authLogin.test.js`, live request |
| API-02 | CRITICAL | `server/routes/papers.js` `GET /proxy-image` | Public endpoint fetched any URL the caller supplied (internal addresses, cloud metadata, other hosts): server-side request forgery and an open relay. | Allow-list (https, Cloudinary, `*.supabase.co`, `IMAGE_PROXY_HOSTS`), no redirects, image content type only, 15 MB cap, 15 s timeout. | `securityAndOmr.test.js` (17 URLs), live request |
| API-03 | CRITICAL | `server/routes/papers.js` | Any teacher could read, edit, export or delete any other teacher's paper by id. | Owner, admin or a teacher assigned to the linked exam may read/edit; only owner/admin may delete; ownership fields are ignored in update bodies. Others get 404. | `securityAndOmr.test.js` |
| API-04 | CRITICAL | `server/routes/omr.js` | Sheets were graded against the **master** question order whatever series (P/Q/R/S) the student sat, so every Q/R/S sheet was marked against the wrong key. | `services/pqrsKeys.js` (server port of the generator) builds the key of the detected series. The browser and server generators are compared on random papers in `client/tests/pqrsServerParity.test.mjs`. Unknown/unreadable series is graded as P and flagged. | parity test, evaluator tests |
| API-05 | HIGH | `server/routes/omr.js` | "MULTIPLE" (several bubbles filled) was treated as an ordinary answer; an invented roll number (`ROLL-…` or from the file name) was stored without any marker; non-numeric marks produced `NaN` scores; any OMR user could read the key of any paper and read or delete any submission; `::int` cast failed for fractional scores. | Per-sheet `needsReview` and `reviewReasons`; marks validated; paper access and submission ownership enforced; `::numeric`; `PYTHON_BIN` / `python3` on non-Windows. | `securityAndOmr.test.js` |
| API-06 | HIGH | `server/routes/grandTests.js`, `previousYearPapers.js`, `templates.js` | DELETE of a grand test, previous-year paper and template answered "deleted" without deleting; PUT inserted a **new row** each time; import / replace / remove-question referenced models that were never imported and always failed with a generic 500. | Real deletes (admin only), in-place updates, and an explicit 501 for the question endpoints that need a migration. | route load, syntax |
| API-07 | HIGH | `server/routes/exams.js` | Admin results returned snake_case rows, so names, roll numbers and dates were blank / "Invalid Date" in the results screen and Excel export; analytics used a different correctness rule than scoring and counted unfinished sittings; bridge keys were never checked for expiry and the rewritten key route silently shortened their life to 7 days. | Both naming styles returned; analytics uses `cbtScoring`; expiry enforced; key lifetime kept at the original 10 years. | cbt tests |
| API-08 | HIGH | `server/routes/notifications.js` | Any user could mark any notification read. | Restricted to the recipient (admins also their role's broadcasts). | code review |
| API-09 | HIGH | `server/routes/lab.js` | `GET /student/:rollNumber` was public and returned a student's name, SATS number and e-mail for any roll number. | Lab-IP restricted (needs `LAB_IP`), e-mail no longer returned. | live request |
| API-10 | MEDIUM | `server/index.js` | CORS reflected every origin with credentials. | `ALLOWED_ORIGINS` is honoured; a start-up warning appears while it is unset. **Still open until you set it.** | `securityAndOmr.test.js`, live request |
| DB-01 | HIGH | `server/config/subjectDatabases.js` | A subject that matched no database (e.g. "General") fell through and queried all eight, returning another subject's questions. | Returns no pools and logs; callers report "none available". | routing table checked |
| CL-01 | HIGH | `AssignmentGenerator.jsx` | Opening the Answer Key or Solutions from an assignment threw (`selectedClass`, `setName` undefined). The assignment was hard-wired to class 12 and had no instructions, submission date, marks or student detail lines. | Fixed, and added: class (11/12, also filters the question bank), marks per question, submission date, instructions, printed Name / Class / Register No. lines; saved with the assignment. | build |
| CL-02 | MEDIUM | `AddQuestion.jsx`, `PaperRenderer.jsx` | Bulk-import handler used state that was never declared; marks field referenced an undefined `paper`. | Declared / removed. The bulk-import handler is still not connected to any button. | lint `no-undef` = 0 |
| CL-03 | MEDIUM | `A4PaperEngine.jsx`, `PaperRenderer.jsx` | Watermark opacity and size were hard-coded although the requirements ask for adjustable ones. | Settings: show/hide, opacity 0–40 %, size 20–250 %, also applied in print CSS. | build |
| CL-04 | MEDIUM | `CommissionedExam.jsx` | Every "Save" created another copy of the paper; the paper had no id in the wizard, so sets Q/R/S shown there could never match the saved paper, the key or OMR. | Re-save updates one paper; id feeds the set seed; a banner warns that Q/R/S are a preview until saved. | client tests |
| CL-05 | LOW | `PaperQuestionEditorModals.jsx`, `QuestionBlock.jsx` | Components returned before calling hooks (34 lint errors). React 19 does **not** crash on this (checked in a browser with a control case), so this is robustness, not a runtime fix. | Guard moved to a wrapper. | browser harness (removed) |
| REPO-01 | LOW | `server/middleware/middleware/`, `server/models/models/` | 19 tracked duplicate files, referenced nowhere. | Deleted (recoverable from git). | app starts, tests pass |

### Fixed in the second security / export / performance pass

| ID | Sev | File | Problem and root cause | Fix | Test |
|----|-----|------|------------------------|-----|------|
| SEC-01 | CRITICAL | `config/postgres.js`, `subjectDatabases.js`, `scripts/init_db.js`, `render.yaml`, `.env.example`, tests | Database passwords, a Supabase secret key (base64-encoded), JWT secret and admin password were in source. `config/postgres.js` also replaced `DATABASE_URL` with its built-in URL whenever the variable named an older project. | All connection strings and keys now come from the environment only; a missing value logs a clear error instead of falling back. `render.yaml` marks them `sync: false`; `.env.example` has placeholders. **Render's `DATABASE_URL` must be the same value as your local `.env` before the next deploy**, and `DB_QBP_CONTROL_KEY` must be added (previous-year/grand-test questions are unavailable without it). | app starts; quota query against the live bank |
| SEC-02 | CRITICAL | `scripts/init_db.js` | Re-running `npm run init:db` reset the admin AND all five faculty passwords to a fixed default. | Seeds only missing accounts, passwords from `ADMIN_PASSWORD` / `SEED_FACULTY_PASSWORD`, never updates existing ones. | syntax |
| SEC-03 | CRITICAL | `routes/exams.js`, `middleware/sessionToken.js` | The student endpoints (`submit`, `save-progress`, `malpractice`, `scorecard`, `pdf-report`, `leaderboard`) were identified only by a sequential session number. | `/start` returns a signed token bound to one session and exam; those endpoints require it (staff JWT also accepted for the read-only ones); the exam screen sends it automatically. With `LAB_IP` set, `/start` is accepted only from the lab network. **Remaining weakness:** a roll number is the only student identity, so someone who knows it can still start/resume that student's sitting. | `sessionToken.test.js` (13), live requests (6 × 401) |
| SEC-04 | HIGH | `routes/auth.js`, `middleware/loginThrottle.js` | No limit on password guesses; unhashed passwords accepted. | 10 failures per account+address and 100 per address in 15 minutes lock out (successes never count); unhashed passwords refused after checking that none exist (`scripts/hash_plaintext_passwords.js` found 0 of 6 accounts). | `loginThrottle.test.js`, `authLogin.test.js` |
| SEC-05 | HIGH | `services/pdfReport.js`, `pdfPaperExport.js` | Student e-mail, titles and instructions were put into HTML rendered by headless Chrome on the server. Markup in them ran with the server's network access. With the old code a crafted e-mail made 3 requests to an internal address; now 0. | Values escaped; JavaScript disabled; only data: URLs and allow-listed https image hosts load; pages are closed in `finally` (they leaked on error). | measured with a local trap server |
| SEC-06 | MEDIUM | git index | `IPU ENROLL & SATS NO.pdf` and `IIPU ENROLL & SATS NO.pdf` (about 440 student records, referenced by nothing) were tracked. | Untracked, ignored; local copies kept. History still contains them (OPEN-07). | - |
| SEC-07 | LOW | `routes/questions.js` | Subject checks compared raw names, so the seeded "Maths" teacher was refused every Mathematics question; `generate-variant` had no subject check. | `sameSubjectArea` (Maths = Mathematics, Biology covers Botany/Zoology); check added. | `securityAndOmr.test.js` |
| PDF-01 | HIGH | `utils/latexPreRenderer.js` | Equations printed as raw red LaTeX in the server PDF (`\dfrac`, `\int`, `\sum`, `\vec`, `\pm`): the auto-wrap step wrapped commands that were already inside `$...$`. Seen in a rendered sample, fixed, and re-rendered correctly. | Wrap only text outside existing math. | `latexPreRenderer.test.js` (7) + before/after render |
| MRG-01 | HIGH | `routes/exams.js` merge | A merged CET paper printed 4 marks per question and a -1 rule while the online exam scored +1/0; section question counts were taken before duplicates were removed; the merged paper took only the first paper's classes; subject order changed when papers had to be fetched individually; skipped papers were silent. | Marks follow the exam type; counts after de-duplication; union of classes; selected order kept; `warnings` returned. | `mergeExam.test.js` (5) |
| BP-01 | MEDIUM | `routes/examBlueprints.js` | Blueprint papers drew only from the 200 newest questions of a subject, repeated questions across sections and ignored shortfalls. | Random sample of 800, one use per paper, `warnings` for shortfalls. | syntax |
| OMR-01 | MEDIUM | `scan_cli.py`, `omrEvaluator.js` | The engine's `UNCERTAIN` result (faint/partial mark) was scored as a wrong answer, and its confidence data was thrown away. | `UNCERTAIN` is left unscored and flagged; per-question confidence is passed through and low-confidence answers are flagged (marks unchanged). | `securityAndOmr.test.js` |
| PERF-01 | MEDIUM | `client/src/App.jsx` | The whole app shipped as one 1.99 MB script that every lab terminal had to download first. | Per-page lazy loading: entry chunk 280 KB. The login, lab login and student portal pages were opened from the production build. | build, browser check |
| PERF-02 | MEDIUM | `AssignmentGenerator.jsx` | Downloaded up to 20 000 questions per visit; Auto-pick took a plain shuffle, so one big chapter could supply most of an assignment. | Chapter list from `/api/questions/meta`, questions loaded only for ticked chapters, even per-chapter auto-pick, error and empty states. Not driven in a browser with real data. | lint, build |
| SEC-08 | HIGH | `AdminPaperPreview.jsx`, `AdminResults.jsx`, `ExamManagement.jsx`, `middleware/auth.js` | The login token was put in the URL of four download links (browser history, logs, Referer). | Authenticated downloads (`utils/downloadFile.js`); the server no longer accepts a token in the URL or body. | `sessionToken.test.js`, build |
| CL-06 | HIGH | `PaperRenderer.jsx` | Editing, swapping or deleting a question while set Q, R or S was shown applied the displayed position to the master list, so the wrong question changed (confirmed by reading the code; set views are shuffled and cannot be mapped back). | These actions are done on Set P (a message says so); layout changes are mapped to the right question by id. | lint, build |
| MIG-01 | - | `server/migrations/`, `scripts/migrate.js` | No migration process. | Runner (dry run by default; records applied files; one transaction each). The first migration is not applied. A dry run briefly created an empty bookkeeping table in the live database; it was removed and the runner fixed to be read-only. | dry run |
| DEAD-01 | LOW | `utils/mathToImage.js`, four scripts with passwords | Unreferenced code (the former loaded scripts from a CDN into Chrome); scripts contained database and admin passwords. | Deleted. | `git grep` found no references |

### Open (found, not fixed)

| ID | Sev | File | Problem | Recommended correction |
|----|-----|------|---------|------------------------|
| OPEN-02 | MEDIUM | `supabaseQuestions.js` `getQuestions` | GET `/api/questions` with a chapter filter still ignores the class filter (manual mode, replacement modal). | Apply `strictClass` once those screens are verified. |
| OPEN-03 | MEDIUM | `supabaseQuestions.js` `buildQueryFilters` | For Botany/Zoology an unrecognised chapter widens to the whole syllabus. Guarded in quota generation only. | Match nothing instead. |
| OPEN-04 | MEDIUM | `supabaseQuestions.js` | QBP-control rows are not filtered by class or exam, and `type` is matched with a raw `ilike`. | Apply the same filters as subject pools. |
| OPEN-07 | HIGH | git history | The two enrolment / SATS lists (about 440 students) were committed. They are now untracked and ignored, but they remain in every earlier commit. | Remove them from history (`git filter-repo`) and force-push, or delete the repository's history copies on the host. Needs you: it rewrites history. |
| OPEN-11 | HIGH | `server/middleware/labIp.js` | `LAB_IP` is not set, so the lab login is reachable from any address (the middleware defaults to `*`). | Set `LAB_IP` to the lab network's public address(es). |
| OPEN-18 | CRITICAL | credentials already published | Every password and key that was committed (primary and eight subject database passwords, MongoDB user, JWT secret, admin password, the QBP control key, a second MongoDB user in a deleted script) is still in git history and must be treated as exposed. The code no longer contains any of them. | **Rotate all of them** (Supabase, Atlas, Render), put the new values in Render's dashboard and your local `.env`, then purge history. Until then the exposure is unchanged. |
| OPEN-14 | MEDIUM | `server/middleware/labIp.js` | Client IP is taken from `X-Forwarded-For`, which the caller controls unless a trusted proxy overwrites it. | Use Express `trust proxy` with the real proxy chain. |
| OPEN-15 | MEDIUM | `exams.js` `/malpractice` | A disqualified session keeps score 0 and its answers are not scored. Whether disqualification should also record a score is a policy decision. | Decide and document. |
| OPEN-16 | MEDIUM | `exams.js` `/take`, `/start` | Exams in `draft` status can be taken; marks per question and negative marking are fixed by exam type (+1/0 for CET, +4/-1 otherwise) and ignore any per-exam setting. `shuffleQuestions` with id-less questions would mis-key answers (no exam uses it today). | Decide intended rules. |
| OPEN-17 | LOW | `client/src/pages/exam/Scorecard.jsx` | Recomputes correctness in the browser instead of using the server's `isCorrect`. Bridge keys are never expired. | Use server verdict; enforce `expires_at`. |
| OPEN-20 | HIGH | `config/dbSsl.js` | Database TLS certificates are not verified: Supabase's chain is rejected by Node (checked: `self-signed certificate in certificate chain`). Verification is now available but needs the provider's CA certificate. | Download the Supabase CA, set `DB_SSL_CA` (text or file path). |
| OPEN-23 | MEDIUM | `omr_engine/`, `omrEvaluator.js` | The engine's per-question confidence is now passed through and low-confidence or uncertain reads are flagged, but the review threshold (`OMR_REVIEW_GAP`, default 0.15) is a starting point, and no labelled set of real sheets exists to measure accuracy. The engine was only run on the blank reference sheet. | Scan a labelled batch of real sheets, measure, tune the threshold, and only then quote an accuracy. |
| OPEN-24 | MEDIUM | `routes/omr.js` | A batch scans sheets one after another inside one HTTP request (up to 100 × up to 60 s); hosting timeouts will cut large batches off. | Queue the work and poll. |
| OPEN-26 | MEDIUM | `CommissionedExam.jsx`, `pqrsGenerator.js` | The P/Q/R/S seed is the paper id, so a set printed before the paper was saved differs from the saved paper's set. Changing the seed would change sets already printed, so it was left and a warning added. | Decide on a stable seed stored with the paper (needs a column or `metadata` field). |
| OPEN-27 | MEDIUM | `server/migrations/001_grand_test_and_pyq_questions.sql` | Grand Test / previous-year question storage does not exist. The migration is written (additive, with a rollback) and was checked by running it inside a rolled-back transaction on temporary tables, but it is **not applied**, and the import/replace/remove endpoints still answer 501 until code for them is written. | Approve, back up, run `node scripts/migrate.js --apply`, then implement the endpoints. |
| OPEN-28 | LOW | `server/` | `MONGO_URI`'s host does not resolve from this machine, so the legacy MongoDB store may be gone; the root `find_*.js` / `test_*.js` debug scripts remain. | Confirm and delete. |
| OPEN-10 | LOW | `server/tests/exam_commission_flow.test.js` | The integration suite connects to the databases in `.env` and was not run. | Point it at a test database. |

## 3. Change log

| File | Change |
|------|--------|
| `server/services/questionSelector.js` (new) | Pure selection engine: chapter quotas → duplicates → types → difficulty, seedable, with per-chapter/type/difficulty report. |
| `server/services/supabaseQuestions.js` | `parseChapterList`; `strictClass`, `randomOrder`, `dbError` on `getQuestions`; `getQuestionsWithChapterQuotas` rewritten on top of the selector. |
| `server/routes/questions.js` | `POST /chapter-distribution` validates input and accepts `typeAllocations`, `excludeIds`, `seed`. |
| `client/src/pages/teacher/CommissionedExam.jsx` | Auto Fetch calls the endpoint; generation summary in Step 7; master paper passed to renderer and keys; `startQNo` fix. |
| `client/src/utils/pqrsGenerator.js` | Idempotent set generation, safe option shuffle, start number in `generateAllPQRS`. |
| `server/tests/questionSelector.test.js`, `server/tests/noop.setup.js`, `client/tests/pqrsGenerator.test.mjs` (new) | 20 + 18 tests. |
| `client/package.json`, `server/package.json` | `npm test` (client), `npm run test:unit` (server). |
| `server/services/cbtScoring.js` (new) | Pure CBT rules: answer comparison, marking, autosave merge, deadline and start window. |
| `server/routes/exams.js` | CBT-01 to CBT-12: staff-only exam fetch, hydrated start/submit/scorecard, server timing, session/exam match, working malpractice and bridge routes, removed the route-local answer parser. |
| `client/src/pages/exam/ExamEngine.jsx` | Server-driven countdown, latest answers on auto-submit, submit retry and error banner, offline indicator. |
| `server/tests/cbtScoring.test.js` (new) | 25 tests. |

| `server/services/accessRules.js`, `omrEvaluator.js`, `pqrsKeys.js` (new) | Ownership rules, image allow-list, CORS parsing; OMR scoring and review flags; server P/Q/R/S keys. |
| `server/routes/auth.js`, `papers.js`, `omr.js`, `lab.js`, `notifications.js`, `templates.js`, `grandTests.js`, `previousYearPapers.js`, `exams.js` (results, analytics, bridge), `index.js`, `middleware/errorHandler.js` | API-01 to API-10. |
| `server/services/postgresStorage.js` | `updateGrandTest`, `deleteGrandTest`, `updatePreviousYearPaper`, `deletePreviousYearPaper`, `deleteTemplate`; `createBridgeKey` takes an expiry. |
| `server/config/subjectDatabases.js` | DB-01. |
| `client/src/pages/teacher/AssignmentGenerator.jsx`, `AddQuestion.jsx`, `CommissionedExam.jsx` | CL-01, CL-02, CL-04. |
| `client/src/components/A4PaperEngine.jsx`, `PaperRenderer.jsx`, `PaperQuestionEditorModals.jsx`, `QuestionBlock.jsx` | CL-03, CL-05, assignment details block. |
| `server/middleware/middleware/`, `server/models/models/` | Deleted (REPO-01). |
| `README.md` | Rewritten from the code (the old one described React 18, a `server.js` that does not exist and unmeasured claims). |
| `server/tests/securityAndOmr.test.js`, `authLogin.test.js`, `client/tests/pqrsServerParity.test.mjs` (new) | 17 + 4 server tests, 7 parity tests. |

### API change

`POST /api/questions/chapter-distribution` (teacher/admin). No screen called it before this pass.

Request: `{ subject, classes, examType, chapterQuotas: {chapter: n}, typeAllocations?, difficultyDistribution?, concepts?, excludeIds?, seed? }`

Response: `{ questions, total, requestedTotal, complete, distributionReport: {chapter: {requested, delivered, available, shortfall}}, typeReport, difficultyReport, warnings[], databaseError? }`

CBT responses gained fields (existing fields unchanged): `/start` returns `session.remainingSeconds`,
`session.serverTime`, `session.startTime`; `/session/save-progress` returns `remainingSeconds`,
`serverTime`; `/submit` returns `late`. New refusals: `/start` 403 outside the scheduled window and
409 for an exam without questions; scorecard and pdf-report 403 before submission; save-progress
403 after the deadline and 400 for an empty payload; `GET /api/exams/:id` 403 for non-staff.

Other API changes: `POST /api/omr/scan` response gains `needsReviewCount` and, per sheet, `gradedAgainstSeries`,
`needsReview`, `reviewReasons`; `GET /api/omr/papers/:id/key` gains `seriesKeys` (P/Q/R/S); `GET /api/exams/:id/results`
returns camelCase fields as well; `GET /api/exams/bridge/:key` returns 410 for an expired key; `PUT /api/grand-tests/:id`
returns 409 when `templateId` is sent; the grand-test / previous-year import, remove and replace endpoints return 501;
`GET /api/lab/student/:rollNumber` no longer returns the e-mail; unknown/missing credentials for login return 503.

Behaviour changes: `concepts` is now a preference, not a filter; difficulty is unconstrained when
omitted (it used to default to 40/40/20); `subject` is required for admins. No database schema or
data was changed.

## 4. Verification performed

Latest run:

* `npm --prefix server run test:unit` → 8 suites, **102 passed** (selection 20, CBT 25, security / OMR / access / subject areas 22, login and lockout 5, session tokens 13, login throttle 6, math 7, merge 5).
* `npm --prefix client test` → **25 passed**. `npm --prefix client run build` succeeds; ESLint: 0 undefined variables, 0 hook-order errors.
* Started the real server with the environment-only configuration and ran a quota query against the live question bank (6 of 6, complete). Refused unauthenticated calls to all six student endpoints (401).
* Rendered a sample paper through the server's own PDF exporter before and after the math fix and looked at both pages; sent a hostile scorecard through the old and new report generator against a local trap server (3 requests before, 0 after).
* Read-only database checks: no unhashed passwords (0 of 6), question tables are small (8–11 k rows) with usable indexes and 2–3 ms chapter queries, so the database is not the bottleneck.
* Opened the production build in a browser: login, lab portal and lab terminal pages render with lazy loading.

Not verified: no exam was sat end-to-end; the wizard, assignment, merge and OMR screens were not driven with real data (needs a login); no authenticated request was made against the live API; OMR accuracy; the integration suite; Word export output; behaviour on Render.

## 5. Not done

* **UI/UX redesign.** Not started. Only functional UI changes were made. A redesign needs your direction on the visual language and a way to review authenticated screens; doing it blind risks breaking working screens.
* **Credential rotation and history purge** (OPEN-18, OPEN-07), setting `ALLOWED_ORIGINS`, `LAB_IP`, `LAB_ID`, `LAB_PASSWORD`, `DB_SSL_CA`, `DB_QBP_CONTROL_KEY` in Render, and applying the migration: owner actions.
* **OMR**: accuracy measurement and the engine's ~30 000 lines of Python.
* **Word export** fidelity (it converts LaTeX to Unicode text, by design) and the remaining admin screens (`AdminQuestionBank`, `SubjectDetails`, `ExamManagement`, `BridgeApp`): permissions checked, logic not reviewed.
* Student identity beyond a roll number (SEC-03 note) and the policy decisions OPEN-15, OPEN-16.
