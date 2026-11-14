# Runbook — keeping the site healthy for 1–1.5 years

Read this once; keep it. Everything here is something a person can do from a web dashboard, no coding needed.

## 1. Updating the site without upsetting anyone
1. **System page → Maintenance mode** (admin → left menu → *System*). Write a message, pick how long, press **Turn on maintenance**.
   Teachers and visitors see *"Updates are going on"*; it re-checks by itself and **reopens the site the moment you turn it off**.
   A timed switch-on turns itself off, so it can never be forgotten. You (admin) keep full access while it is on.
2. Students **already inside an exam** can keep saving and can still submit — nobody loses an exam. Do not start maintenance during an exam anyway.
3. If you cannot reach the System page: on **Render → Environment**, set `MAINTENANCE_MODE=1` (optionally `MAINTENANCE_MESSAGE=...`), save.
   Remove it to go live again. *Staff sign-in* (link at the bottom of the maintenance screen) lets an admin sign in while the site is closed.
4. A deploy or restart of the API (Render) is **handled automatically**: if the API does not answer three checks in a row (about 30 s) the same
   "Updates are going on" screen appears, and the site reopens by itself when the API is back. Reads are also retried a few times before any error is shown.
5. Front-end-only release window with no server involved: set `VITE_MAINTENANCE=1` on Vercel and redeploy; remove it and redeploy to reopen.

## 2. Weekly / monthly checks (10 minutes)
| When | What | Where |
|---|---|---|
| Weekly | Open **System** page: Server *Running*, Database *Connected*. | Admin → System |
| Weekly | Skim the API logs for `[CLIENT ERROR]` lines (a screen error on someone's browser) and `ERROR` lines. | Render → Logs |
| Monthly | Confirm the last automatic backup exists. | Supabase → Database → Backups |
| Monthly | Check disk/DB size is below the plan limit. | Supabase → Reports |
| Before each exam day | Run one test sitting from a lab computer; confirm `LAB_IP` is the lab's current public address. | Lab PC / Render env |

Set up a free uptime monitor (UptimeRobot / BetterStack) on `https://<your-api>/api/health` — it answers `503` when the database is unreachable, so you
get an email before anyone complains. Also monitor the Vercel site URL.

## 3. Things that expire or run out (calendar them)
- **Admin password** and **`JWT_SECRET`**: change at least once a year (changing `JWT_SECRET` signs everyone out once).
- **Database passwords** (Supabase): rotate yearly or when anyone who knew them leaves; update `DATABASE_URL` and the 8 question-database settings on Render.
- **Render / Vercel / Supabase plans**: free tiers sleep or pause after inactivity. Use a paid plan, or keep the uptime monitor above (it pings every few minutes).
- **Domain / SSL**: renew the domain if you use your own; Vercel and Render renew certificates themselves.
- **Supabase project pause**: a free project pauses after ~1 week of no activity — the monitor prevents that.

## 4. If something is wrong
| Symptom | First thing to try |
|---|---|
| Everyone sees "Updates are going on" | System page → is maintenance ON? Or Render → is the service running? Check Render logs. |
| Login says wrong password for the admin | Render env `ADMIN_PASSWORD` (the single admin login). |
| Papers are short / questions missing | System page health; then Render logs for `DB_` errors (a question database address changed or its password was rotated). |
| A teacher sees a "display error" screen | Render logs → `[CLIENT ERROR]` line shows the page and message. Send it to the developer. |
| Student cannot start an exam | `LAB_IP` doesn't match the lab's public address, or the exam is not scheduled/visible. |
| Exports (Word/PDF/OMR) fail on Render | Render → Logs; the build step installs the browser/Python libraries — redeploy once. |

## 5. Deploy / rollback
- Push to `main` on GitHub: Vercel (website) and Render (API) deploy automatically.
- **Rollback**: Render → Deploys → pick the previous green deploy → *Rollback*. Vercel → Deployments → previous → *Promote to Production*.
- Database changes are applied by the `migrations` files; none run by themselves on a live database.

## 6. Known, accepted items
- `npm audit`: two low/moderate findings remain in third-party packages (KaTeX `trust` option — the site never enables it; `minimatch` inside the zip library — used only with fixed file names, never with user-supplied patterns). Forcing the suggested "fixes" would downgrade the zip library and risk exports, so they are left until the libraries publish a safe update.
- Grand Test and Previous-Year paper **question import** buttons answer "not available" until their database migration is applied (they are documented 501 responses, not errors).

## 7. Dependency policy
Do not run `npm update` on a live site. Once a year (off-season): create a branch, update, run `npm test` in `client` and `server`, run `npm run test:e2e` in `server`, deploy to a preview, then merge.
Node 20–24 is supported (`engines`).
