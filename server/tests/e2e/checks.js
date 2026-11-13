// End-to-end API checks. Started by tests/e2e/run.js against a throwaway in-memory PostgreSQL (never a real database).
const B = process.env.E2E_BASE || 'http://127.0.0.1:5070';
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra ? '  -> ' + extra : ''}`); return cond; };
const call = async (method, path, { token, session, body, raw } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (session) headers['x-session-token'] = session;
  const res = await fetch(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

(async () => {
  // ── logins ───────────────────────────────────────────────────────────────
  const bad = await call('POST', '/api/auth/login', { body: { email: 'sapthagiripucollegedvg@gmail.com', password: 'nope' } });
  ok(bad.status === 400 && bad.data.msg === 'Invalid email or password.', 'admin: wrong password rejected with the uniform message');
  const adminLogin = await call('POST', '/api/auth/login', { body: { email: 'sapthagiripucollegedvg@gmail.com', password: 'local-test-admin-pass' } });
  ok(adminLogin.status === 200 && adminLogin.data.token, 'admin: login with the test password');
  const admin = adminLogin.data.token;
  const t1 = await call('POST', '/api/auth/login', { body: { email: 'physics@gmail.com', password: 'local-test-faculty-pass' } });
  ok(t1.status === 200, 'teacher (physics): login with seeded test password');
  const t2 = await call('POST', '/api/auth/login', { body: { email: 'chemistry@gmail.com', password: 'local-test-faculty-pass' } });
  const teacher1 = t1.data.token, teacher2 = t2.data.token;
  ok((await call('GET', '/api/auth/me', { token: teacher1 })).data.user.subject === 'Physics', 'GET /me returns the teacher');

  // ── faculty list and OMR access when users.omr_access does not exist (as in production) ───────────────
  const fac = await call('GET', '/api/admin/teachers', { token: admin });
  ok(fac.status === 200 && fac.data.length === 5 && fac.data.every(t => t.omrAccess === false), 'admin: faculty list returns all 5 teachers even without users.omr_access', JSON.stringify(fac.data).slice(0, 120));
  const tog = await call('PATCH', `/api/admin/teachers/${fac.data[0].id}/omr-access`, { token: admin, body: { enabled: true } });
  ok(tog.status === 409 && /migration 002/.test(tog.data.msg), 'admin: granting OMR access explains the missing migration instead of "teacher not found"', JSON.stringify(tog.data));
  ok((await call('GET', '/api/omr/papers', { token: teacher1 })).status === 403, 'OMR: teacher without access refused (column missing)');

  // ── question generation (reads the real question bank) ───────────────────
  const gen = await call('POST', '/api/questions/chapter-distribution', { token: teacher1, body: {
    subject: 'Physics', classes: '12', examType: 'NEET', chapterQuotas: { 'Atoms': 4, 'Alternating Current': 4, 'Current Electricity': 4 },
    typeAllocations: { mcq: 12 }, difficultyDistribution: { easy: 30, medium: 50, hard: 20 } } });
  ok(gen.status === 200 && gen.data.total === 12 && gen.data.complete, 'AutoFetch: 3 chapters x 4 = 12 delivered', JSON.stringify(gen.data?.distributionReport));
  const per = {}; (gen.data.questions || []).forEach(q => { per[q.chapter] = (per[q.chapter] || 0) + 1; });
  ok(Object.values(per).every(n => n === 4) && Object.keys(per).length === 3, 'AutoFetch: exactly 4 per chapter', JSON.stringify(per));
  const qs = gen.data.questions;

  // a NEET paper must fill up even when most of a chapter's questions carry the JEE tag (tag fallback), and show no shortfall
  const genBig = await call('POST', '/api/questions/chapter-distribution', { token: teacher1, body: {
    subject: 'Physics', classes: '12', examType: 'NEET', chapterQuotas: { 'Current Electricity': 25, 'Atoms': 20 },
    typeAllocations: { mcq: 45 }, difficultyDistribution: { easy: 30, medium: 50, hard: 20 } } });
  ok(genBig.status === 200 && genBig.data.total === 45 && genBig.data.complete, 'AutoFetch: NEET paper of 45 from two chapters is complete (exam-tag fallback)', JSON.stringify(genBig.data?.distributionReport).slice(0, 200));

  // ── papers: save, ownership, update, export ──────────────────────────────
  const paperBody = (title, questions, extra = {}) => ({ title, subject: 'Physics', examType: 'NEET', classes: ['12'], questions: questions.map(q => q._id), questionObjects: questions, totalQuestions: questions.length, status: 'Draft', ...extra });
  const saved = await call('POST', '/api/papers', { token: teacher1, body: paperBody('E2E Physics Paper', qs.slice(0, 8), { metadata: { pqrsSeed: 'seed-e2e-1' } }) });
  ok(saved.status === 200 && saved.data._id, 'teacher: save paper', JSON.stringify(saved.data).slice(0, 200));
  const paperId = saved.data._id;
  ok((await call('GET', `/api/papers/${paperId}`, { token: teacher1 })).status === 200, 'owner can read the paper');
  ok((await call('GET', `/api/papers/${paperId}`, { token: teacher2 })).status === 404, 'another teacher gets 404 for it');
  ok((await call('PUT', `/api/papers/${paperId}`, { token: teacher2, body: { title: 'hijack' } })).status === 404, 'another teacher cannot update it');
  ok((await call('DELETE', `/api/papers/${paperId}`, { token: teacher2 })).status === 404, 'another teacher cannot delete it');
  ok((await call('GET', `/api/papers/${paperId}`, { token: admin })).status === 200, 'admin can read it');
  const list = await call('GET', '/api/papers', { token: teacher2 });
  ok(list.status === 200 && !list.data.some(p => String(p._id) === String(paperId)), "teacher2's list does not include teacher1's paper");
  const upd = await call('PUT', `/api/papers/${paperId}`, { token: teacher1, body: { title: 'E2E Physics Paper (edited)' } });
  ok(upd.status === 200 && upd.data.title.includes('edited'), 'owner can update the paper', upd.data?.msg);
  const word = await call('GET', `/api/papers/${paperId}/export-word`, { token: teacher1, raw: true });
  ok(word.status === 200 && word.buf.slice(0, 2).toString() === 'PK', 'Word export returns a .docx', `status ${word.status}`);
  const pdf = await call('GET', `/api/papers/${paperId}/export-pdf`, { token: teacher1, raw: true });
  ok(pdf.status === 200 && pdf.buf.slice(0, 4).toString() === '%PDF', 'PDF export returns a PDF', `status ${pdf.status}`);
  ok((await call('GET', `/api/papers/${paperId}/export-pdf`, { token: teacher2, raw: true })).status === 404, 'PDF export refused for another teacher');

  // ── image proxy ───────────────────────────────────────────────────────────
  ok((await call('GET', '/api/papers/proxy-image?url=' + encodeURIComponent('http://127.0.0.1:5070/api/health'), {})).status === 400, 'image proxy refuses an internal URL');

  // ── exam from paper, student sitting ───────────────────────────────────────
  const ex = await call('POST', '/api/exams/from-paper', { token: admin, body: { paperId, title: 'E2E Exam', duration_minutes: 30 } });
  ok(ex.status === 200 && ex.data.exam, 'admin: create online exam from the paper', JSON.stringify(ex.data).slice(0, 200));
  const examId = ex.data.exam._id || ex.data.exam.id;
  const exFull = await call('GET', `/api/exams/${examId}`, { token: admin });
  ok(exFull.status === 200 && Array.isArray(exFull.data.questions), 'admin: exam fetch includes questions');
  ok((await call('GET', `/api/exams/${examId}`, { token: teacher1 })).status === 200, 'teacher can fetch exam (staff)');

  const lab = await call('POST', '/api/lab/login', { body: { labId: 'testlab', password: 'local-test-lab-pass' } });
  ok(lab.status === 200 && lab.data.token, 'lab: login with the configured terminal credentials');
  ok((await call('POST', '/api/lab/login', { body: { labId: 'lab001', password: 'lab@123' } })).status === 401, 'lab: old default credentials rejected');
  const stud = await call('GET', '/api/lab/student/T001');
  ok(stud.status === 200 && stud.data.name === 'Test Student One' && stud.data.email === '', 'lab: student lookup works, no e-mail returned', JSON.stringify(stud.data));
  ok((await call('GET', '/api/lab/student/NOPE999')).status === 404, 'lab: unknown roll number -> 404');
  ok((await call('GET', '/api/exams/lab-active')).data.exams.some(e => String(e._id) === String(examId)), 'exam appears in lab-active');

  const take = await call('GET', `/api/exams/${examId}/take?rollNumber=T001`);
  ok(take.status === 200 && take.data.questions.length === qs.slice(0, 8).length, 'take: questions delivered');
  ok(!JSON.stringify(take.data).includes('"answer"') && !JSON.stringify(take.data).includes('correct_option'), 'take: no answers leaked to the student');

  const start = await call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'T001', studentName: 'x' } });
  ok(start.status === 201 && start.data.session.sessionToken, 'start: session created with a session token', JSON.stringify(start.data).slice(0, 200));
  const sess = start.data.session, sid = String(sess._id), st = sess.sessionToken;
  ok(Number.isFinite(sess.remainingSeconds) && sess.remainingSeconds > 1700 && sess.remainingSeconds <= 1800, 'start: server-computed remaining time ~30 min', String(sess.remainingSeconds));
  const resume = await call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'T001' } });
  ok(resume.status === 200 && String(resume.data.session._id) === sid, 'start again resumes the same session');

  ok((await call('POST', `/api/exams/${examId}/session/save-progress`, { body: { sessionId: sid, answers: [] } })).status === 401, 'autosave without token -> 401');
  ok((await call('POST', `/api/exams/${examId}/submit`, { body: { sessionId: sid, answers: [] } })).status === 401, 'submit without token -> 401');
  ok((await call('GET', `/api/exams/${examId}/scorecard/${sid}`)).status === 401, 'scorecard without token -> 401');
  ok((await call('GET', `/api/exams/${examId}/leaderboard`)).status === 401, 'leaderboard without token -> 401');

  // answers: first 3 correct, one wrong, rest blank
  const key = (await call('GET', `/api/exams/admin/${examId}`, { token: admin })).data.questions || []; // hydrated, with answers
  const answerOf = q => { const a = String(q.correct_option ?? '').trim(); return /^[1-4]$/.test(a) ? 'ABCD'[Number(a) - 1] : a.toUpperCase().slice(0, 1); };
  // keep only option questions so the expected score is unambiguous

  const wrong = q => ({ A: 'B', B: 'C', C: 'D', D: 'A' }[answerOf(q)] || 'A');
  const optionIdx = key.map((q, i) => ((q.options || []).length >= 2 ? i : -1)).filter(i => i >= 0);
  const role = new Map(optionIdx.map((qi, n) => [qi, n]));
  const answers = key.map((q, i) => { const n = role.get(i); return { questionId: String(q._id || q.id), selectedOption: n === undefined ? null : (n < 3 ? answerOf(q) : (n === 3 ? wrong(q) : null)), markedForReview: false, visited: true, timeTaken: 5 }; });
  const saveP = await call('POST', `/api/exams/${examId}/session/save-progress`, { session: st, body: { sessionId: sid, answers: answers.slice(0, Math.max(...optionIdx.slice(0, 2)) + 1) } });
  ok(saveP.status === 200 && Number.isFinite(saveP.data.remainingSeconds), 'autosave with token works and returns server time', JSON.stringify(saveP.data).slice(0, 120));
  ok((await call('POST', `/api/exams/${examId}/session/save-progress`, { session: st, body: { sessionId: sid, answers: [] } })).status === 400, 'empty autosave rejected (cannot erase answers)');
  ok((await call('POST', `/api/exams/${examId}/submit`, { session: st, body: { sessionId: String(Number(sid) + 1), answers: [] } })).status === 403, "submit with another student's session number -> 403");

  // a student with a token for exam X cannot submit with an empty payload and lose autosaved work: send only q3.. and rely on merge
  const sub = await call('POST', `/api/exams/${examId}/submit`, { session: st, body: { sessionId: sid, answers: answers.slice(Math.max(...optionIdx.slice(0, 2)) + 1) } });
  ok(sub.status === 200, 'submit with token works', JSON.stringify(sub.data));
  const card = await call('GET', `/api/exams/${examId}/scorecard/${sid}`, { session: st });
  ok(card.status === 200, 'scorecard with token works');
  ok(card.data.correct === 3 && card.data.incorrect === 1, 'score: 3 correct (incl. the one autosaved earlier), 1 incorrect', `correct=${card.data.correct} incorrect=${card.data.incorrect} unattempted=${card.data.unattempted}`);
  ok(card.data.score === 3 * 4 - 1, 'score: +4 x3 -1 = 11', typeof card.data.score + ':' + JSON.stringify(card.data.score));
  ok(card.data.correct + card.data.incorrect + card.data.unattempted === card.data.totalQuestions, 'counts add up to the question total');
  ok((await call('POST', `/api/exams/${examId}/submit`, { session: st, body: { sessionId: sid, answers } })).data.msg === 'Already submitted', 'second submit is idempotent');
  ok((await call('GET', `/api/exams/${examId}/leaderboard`, { session: st })).status === 200, 'leaderboard with token works');
  const again = await call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'T001' } });
  ok(again.status === 409 && again.data.alreadyFinished && !again.data.disqualified, 'a student who already submitted cannot start a second sitting', JSON.stringify(again.data));
  const res = await call('GET', `/api/exams/${examId}/results`, { token: admin });
  ok(res.status === 200 && res.data[0].studentName === 'Test Student One' && res.data[0].rollNumber === 'T001' && typeof res.data[0].score === 'number', 'admin results: camelCase names, numeric score', JSON.stringify(res.data?.[0]).slice(0, 160));
  const an = await call('GET', `/api/exams/${examId}/analytics`, { token: admin });
  ok(an.status === 200 && an.data.length === key.length && an.data[0].correct === 1, 'analytics: per-question counts use the scoring rule', JSON.stringify(an.data?.[0]));
  const rep = await call('GET', `/api/exams/${examId}/pdf-report/${sid}`, { session: st, raw: true });
  ok(rep.status === 200 && rep.buf.slice(0, 4).toString() === '%PDF', 'PDF scorecard with token');
  ok((await call('GET', `/api/exams/${examId}/pdf-report/${sid}`, { token: admin, raw: true })).status === 200, 'PDF scorecard for admin');

  // ── second student: disqualification ──────────────────────────────────────
  const s2 = (await call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'T002' } })).data.session;
  ok((await call('POST', `/api/exams/${examId}/malpractice`, { body: { sessionId: String(s2._id), reason: 'tab switch' } })).status === 401, 'malpractice without token -> 401 (cannot disqualify others)');
  const mp = await call('POST', `/api/exams/${examId}/malpractice`, { session: s2.sessionToken, body: { sessionId: String(s2._id), reason: 'tab switch' } });
  ok(mp.status === 200, 'malpractice with token closes the session', JSON.stringify(mp.data).slice(0, 120));
  const after = await call('POST', `/api/exams/${examId}/session/save-progress`, { session: s2.sessionToken, body: { sessionId: String(s2._id), answers: [{ questionId: 'x', selectedOption: 'A' }] } });
  ok(after.status === 400, 'a disqualified session can no longer save answers', JSON.stringify(after.data));
  const restart = await call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'T002' } });
  ok(restart.status === 409 && restart.data.disqualified === true, 'a disqualified student cannot restart with a fresh session', JSON.stringify(restart.data));
  ok((await call('DELETE', `/api/exams/${examId}/sessions/${s2._id}`, { token: teacher1 })).status === 403, 'only an admin can reset an attempt');
  const reset = await call('DELETE', `/api/exams/${examId}/sessions/${s2._id}`, { token: admin });
  ok(reset.status === 200, 'admin can reset an attempt', JSON.stringify(reset.data));
  const again2 = await call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'T002' } });
  ok(again2.status === 201, 'after the reset the student can start again', JSON.stringify(again2.data).slice(0, 100));
  const res2 = await call('GET', `/api/exams/${examId}/results`, { token: admin });
  ok(res2.data.some(r => r.rollNumber === 'T001' && r.submitted), 'results list the finished student');

  // ── unknown student / exam window ───────────────────────────────────────────
  ok((await call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'NOPE999' } })).status === 403, 'unregistered roll number cannot start');

  // ── simultaneous starts for one student create exactly one sitting ────────────────
  const race = await Promise.all(Array.from({ length: 8 }, () => call('POST', `/api/exams/${examId}/start`, { body: { rollNumber: 'T003' } })));
  const ids = new Set(race.map(r => String(r.data?.session?._id)));
  ok(ids.size === 1 && race.filter(r => r.status === 201).length === 1 && race.every(r => r.status === 200 || r.status === 201), '8 simultaneous starts for one student -> one session, one 201', JSON.stringify(race.map(r => r.status)) + ' ids=' + [...ids].join(','));

  // ── scheduled window ────────────────────────────────────────────────────────
  const future = await call('POST', '/api/exams/from-paper', { token: admin, body: { paperId, title: 'Future exam', duration_minutes: 30, start_time: new Date(Date.now() + 3600e3).toISOString(), end_time: new Date(Date.now() + 7200e3).toISOString() } });
  const fid = future.data.exam._id || future.data.exam.id;
  const early = await call('POST', `/api/exams/${fid}/start`, { body: { rollNumber: 'T003' } });
  ok(early.status === 403 && /not started/.test(early.data.msg), 'exam before its start time cannot be started', JSON.stringify(early.data));

  // ── merge ───────────────────────────────────────────────────────────────────
  const p2 = await call('POST', '/api/papers', { token: teacher1, body: paperBody('E2E Paper B', qs.slice(8, 12)) });
  const merge = await call('POST', '/api/exams/merge', { token: admin, body: { title: 'E2E Merged', examType: 'NEET', paperIds: [p2.data._id, paperId] } });
  ok(merge.status === 201, 'merge: two papers', JSON.stringify(merge.data).slice(0, 200));
  ok(merge.data.exam.questions.length === 12 && merge.data.exam.sections.length === 1, 'merge: 12 questions, subject section counted', `q=${merge.data.exam?.questions?.length} sections=${merge.data.exam?.sections?.length}`);
  const cet = await call('POST', '/api/exams/merge', { token: admin, body: { title: 'E2E Merged CET', examType: 'CET', paperIds: [paperId] } });
  ok(cet.data.paper.total_marks === 8 || cet.data.paper.totalMarks === 8 || cet.data.exam.sections[0].markingRules.correct === 1, 'merge: CET marks follow the exam type', JSON.stringify(cet.data.exam?.sections?.[0]?.markingRules));

  // ── OMR key / access ────────────────────────────────────────────────────────
  ok((await call('GET', '/api/omr/papers', { token: teacher2 })).status === 403, 'OMR: teacher without OMR access refused');
  const key1 = await call('GET', `/api/omr/papers/${paperId}/key`, { token: admin });
  ok(key1.status === 200 && key1.data.seriesKeys && key1.data.seriesKeys.Q.length === 8, 'OMR: key endpoint returns P/Q/R/S keys', JSON.stringify(key1.data).slice(0, 160));

  // ── OMR: background scan job (a real sheet image through the real engine) ─────────────────────
  {
    const fs = require('fs');
    const img = fs.readFileSync(require('path').resolve(__dirname, '../../omr_engine/alignment_debug/jee/01_raw_camera.jpg'));
    const mk = () => { const f = new FormData(); f.append('paperId', String(paperId)); f.append('examType', 'NEET'); for (let i = 0; i < 2; i++) f.append('sheets', new Blob([img], { type: 'image/jpeg' }), `sheet${i}_20260${i}1.jpg`); return f; };
    const post = async (qs) => { const r = await fetch(B + '/api/omr/scan' + qs, { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: mk() }); return { status: r.status, data: await r.json().catch(() => null) }; };
    const started = await post('?async=true');
    ok(started.status === 202 && started.data.jobId, 'OMR async scan job: accepted at once with a job id', JSON.stringify(started.data).slice(0, 200));
    let job = null;
    for (let i = 0; i < 240; i++) { job = (await call('GET', `/api/omr/scan/jobs/${started.data.jobId}`, { token: admin })).data; if (job && job.status !== 'running') break; await new Promise(r => setTimeout(r, 1500)); }
    ok(job && job.status === 'done' && job.total === 2 && job.processed === 2, 'OMR async scan job: finishes and reports progress', JSON.stringify(job).slice(0, 300));
    ok(job && job.processedCount + job.failedCount === 2, 'OMR async scan job: every sheet is either scored or reported as failed', JSON.stringify(job).slice(0, 300));
    console.log('     (engine result:', JSON.stringify({ processed: job && job.processedCount, failed: job && job.failedCount, errors: job && job.errors && job.errors.map(e => e.error).slice(0, 1) }).slice(0, 240), ')');
    ok((await call('GET', `/api/omr/scan/jobs/${started.data.jobId}`, { token: teacher1 })).status === 403 || (await call('GET', `/api/omr/scan/jobs/${started.data.jobId}`, { token: teacher1 })).status === 404, 'OMR async scan job: another user cannot read it');
    ok((await call('GET', '/api/omr/scan/jobs/doesnotexist', { token: admin })).status === 404, 'OMR async scan job: unknown id is 404');
    const sync = await post('');
    ok(sync.status === 200 && sync.data.totalUploaded === 2, 'OMR sync scan still works (old clients)', JSON.stringify(sync.data).slice(0, 200));
  }

  // ── faculty management hardening, health, approval, bulk import ────────────────────────────────
  {
    // faculty management hardening
    const weak = await call('POST', '/api/admin/teachers', { token: admin, body: { name: 'Weak Pw', email: 'weak@example.com', password: 'short', subject: 'Physics' } });
    ok(weak.status === 400 && /8 characters/.test(weak.data.msg), 'faculty: a short password is refused');
    const badMail = await call('POST', '/api/admin/teachers', { token: admin, body: { name: 'Bad Mail', email: 'not-an-email', password: 'longenough1', subject: 'Physics' } });
    ok(badMail.status === 400, 'faculty: an invalid e-mail is refused');
    const badSubject = await call('POST', '/api/admin/teachers', { token: admin, body: { name: 'Bad Sub', email: 'sub@example.com', password: 'longenough1', subject: 'Astrology' } });
    ok(badSubject.status === 400, 'faculty: an unknown department is refused');
    const made = await call('POST', '/api/admin/teachers', { token: admin, body: { name: 'New Faculty', email: 'newfaculty@example.com', password: 'longenough1', subject: 'maths' } });
    ok(made.status === 200 && made.data.subject === 'Mathematics', 'faculty: created, "maths" stored as Mathematics', JSON.stringify(made.data).slice(0, 160));
    const pw = await call('PUT', `/api/admin/teachers/${made.data.id}/password`, { token: admin, body: { newPassword: 'anotherlong1' } });
    ok(pw.status === 200, 'faculty: password reset works');
    ok((await call('PUT', '/api/admin/teachers/999999/password', { token: admin, body: { newPassword: 'anotherlong1' } })).status === 404, 'faculty: password reset of an unknown id is a 404, not a fake success');
    ok((await call('POST', '/api/auth/login', { body: { email: 'newfaculty@example.com', password: 'anotherlong1' } })).status === 200, 'faculty: can sign in with the reset password');
    const delUnknown = await call('DELETE', '/api/admin/teachers/999999', { token: admin });
    ok(delUnknown.status === 404, 'faculty: deleting an unknown id is a 404');
    const adminRow = await call('GET', '/api/auth/me', { token: admin });
    ok((await call('DELETE', `/api/admin/teachers/${adminRow.data.user.id}`, { token: admin })).status === 404, 'faculty: the administrator account cannot be deleted from the faculty screen');
    ok((await call('DELETE', `/api/admin/teachers/${made.data.id}`, { token: admin })).status === 200, 'faculty: delete works');
    ok((await call('POST', '/api/auth/login', { body: { email: 'newfaculty@example.com', password: 'anotherlong1' } })).status === 400, 'faculty: a deleted account can no longer sign in');

    // health
    const health = await call('GET', '/api/health');
    ok(health.status === 200 && health.data.db === 'ok', 'health: reports the database as ok');

    // approval workflow
    const pap = await call('POST', '/api/papers', { token: teacher1, body: paperBody('Approval Paper', qs.slice(0, 4)) });
    const pid = pap.data._id;
    const appr = await call('PUT', `/api/papers/admin/${pid}/status`, { token: admin, body: { status: 'Approved' } });
    ok(appr.status === 200 && appr.data.status === 'Approved', 'approval: admin can approve a paper');
    ok((await call('PUT', `/api/papers/admin/${pid}/status`, { token: teacher1, body: { status: 'Approved' } })).status === 403, 'approval: a teacher cannot approve');
    ok((await call('PUT', `/api/papers/admin/${pid}/status`, { token: admin, body: { status: 'Whatever' } })).status === 400, 'approval: an invalid status is refused');
    await call('DELETE', `/api/papers/${pid}`, { token: teacher1 });

    // bulk import: invalid rows are reported, never silently saved
    const bulk = await call('POST', '/api/questions/bulk-import', { token: admin, body: { questions: [
        { question: 'No options here at all', type: 'MCQ', answer: 'A', subject: 'Physics' },
        { question: '', answer: 'A', subject: 'Physics' },
        { question: 'Has options but no answer', opt_a: 'x', opt_b: 'y', subject: 'Physics' },
        { question: 'Has everything but no subject', opt_a: 'x', opt_b: 'y', answer: 'A' }
    ] } });
    ok(bulk.status === 200 && bulk.data.count === 0 && bulk.data.skippedCount === 4, 'bulk import: all four bad rows are skipped and reported', JSON.stringify(bulk.data).slice(0, 300));
    ok((await call('POST', '/api/questions/bulk-import', { token: admin, body: { questions: new Array(5001).fill({}) } })).status === 413, 'bulk import: more than 5000 rows is refused');

    // OMR runtime check
    const oh = await call('GET', '/api/omr/health', { token: admin });
    ok(oh.status === 200 && oh.data.available === true, 'OMR health: the engine can run on this machine', JSON.stringify(oh.data));

    // plain-text 500s are gone: an unknown route is JSON
    const nf = await call('GET', '/api/does-not-exist', { token: admin });
    ok(nf.status === 404 && nf.data && nf.data.msg, 'unknown routes answer with a JSON message');
  }

  // ── cleanup of the draft ───────────────────────────────────────────────────
  ok((await call('DELETE', `/api/papers/${p2.data._id}`, { token: teacher1 })).status === 200, 'owner can delete own paper');

  // ── rate limits: a whole lab shares one IP ───────────────────────────────────
  const burst = async (n, fn) => { const r = await Promise.all(Array.from({ length: n }, fn)); return r.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {}); };
  const labPolling = await burst(400, async () => (await fetch(B + '/api/exams/lab-active')).status);
  ok(!labPolling[429] && labPolling[200] === 400, '400 lab-portal polls from one IP in a few seconds: none refused', JSON.stringify(labPolling));
  const general = await burst(350, async () => (await fetch(B + '/api/papers/proxy-image?url=x')).status);
  ok(general[429] > 0, 'the general per-address limit still applies to other endpoints', JSON.stringify(general));
  const autosaves = await burst(220, async () => (await fetch(B + `/api/exams/${examId}/session/save-progress`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': st }, body: JSON.stringify({ sessionId: sid, answers: [] }) })).status);
  ok(autosaves[429] > 0 && autosaves[429] < 220 && !autosaves[401], 'one session is capped (~180/min) without affecting the IP', JSON.stringify(autosaves));
  const otherSession = await fetch(B + `/api/exams/${examId}/leaderboard`, { headers: { 'x-session-token': s2.sessionToken } });
  ok(otherSession.status === 200, "another student's session is unaffected by the first one's burst", String(otherSession.status));

  // ── login lockout ───────────────────────────────────────────────────────────
  let last;
  for (let i = 0; i < 11; i++) last = await call('POST', '/api/auth/login', { body: { email: 'biology@gmail.com', password: 'wrong' + i } });
  ok(last.status === 429, 'login lockout after repeated failures', String(last.status));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('SCRIPT ERROR', e); process.exit(2); });
