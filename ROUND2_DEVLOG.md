## 2026-05-20 14:40 — Start planning

Read Round 2 assignment specifications fully. Outlined 4 must-work features: persistent audit storage, pricing-change detection, notification emails, and diff view on re-run.


## 2026-05-20 15:10 — Git workflow research

Never made a PR before. Learned `checkout -b` creates branch, PR stays open for review. Understood not to merge. Risk: branching from wrong base, but verified with git log that I'm on main. 10 min.


## 2026-05-20 15:20 — Architecture outline

Mapped files to touch: new tables in supabase/migrations, api/admin/update-pricing.ts, api/cron/detect-changes.ts, src/lib/pricingDetector.ts, src/lib/audit-store.ts, src/pages/RerunAuditPage.tsx (are subjected to change as they are what I thought of the expected architecture).

Note: In college for exam from 10:00-15:00, no laptop. Used phone notes for planning only. No code written yet.

## 2026-05-20 16:00 — Commute + rest

Travel time home. 3h no coding. Will start DB migration first thing.


## 2026-05-20 19:50 — Start DB schema

Updated Supabase.ts for audit storage of user emails and pricing changes. Started coding by writing the migration `202605202043_round2_reaudit.sql`. Added `user_email`, `pricing_snapshot`, and `email_sent` to the `audits` table, with `IF NOT EXISTS` so it is safe to re-run.


## 2026-05-20 20:45 — Added email trigger and pricing change detection

Built out `email.ts` for Resend and wrote `pricingDetector.ts` to actually compare the old vs new pricing and trigger the email. Also had to tweak `tsconfig.json` to include node types since `process.env` was throwing TS errors.


## 2026-05-20 21:40 — Vercel cron endpoint

Created the serverless endpoint at `api/cron/detect-changes.ts` to run the detector. Pulled in `@vercel/node` so I could type the request and response properly. Added auth with a `CRON_SECRET` env var because Vercel crons are public by default. Also updated `vercel.json` to schedule it for 9am UTC every Monday and kept the SPA rewrites intact so the React routes don't break.


## 2026-05-20 23:00 — Hit blocker

Couldn't push due to branching issue. Paused the project and slept from 23:00 to 7:30.


## 2026-05-21 8:45 — Fix branching issue

Figured that the branch was created locally but never made it to GitHub.


## 2026-05-21 8:50 — Hit issue with cron endpoint

Tried implementing `/api/cron/detect-changes` to run automated re-audits for price tracking. 

**What I attempted:**

1. Moved business logic from `src/lib` to `api/_lib/` because Vercel serverless functions can't from `src/` due to Vite/browser dependecies.

2. Fix `import.meta.env` references by replacing with  `process.env`.

3. Removed `localStorage` calls from backend code.

4. Added `.js` extensions to imports for ESM compatibilty.

Pausing backend work. The ESM + TypeScript + Vercel config needs deeper research. Frontend and core audit engine work fine (made sure that nothing breaks from round 1). Will revisit cron jobs later or use any other external service like. Spent 4h trying to debug the issue (unsuccessful).

Update 14:00 to 15:30 : Resolved, see below.


## 2026-05-21 13:00 — UI addition

Wrote the UI for Diff view so that when they click on re-run link, they see their original audit and the new audit side-by-side.

## 2026-05-21 14:00 — Fix cron endpoint issue

Revisited the cron after pausing it. Fixed `FUNCTION_INVOCATION_FAILED` crash. Added `.js` extensions to imports that I had missed earlier. Disabled Vercel Deployment Protection on Preview to test and now `/api/cron/detect-changes` now runs and returns 200 with correct auth. Spent ~1h debugging.


## 2026-05-21 15:30 — Email arrival on inbox

Cron shipped audits with null email due to which the email never arrived to the user's mail as `handleSubscribe` in `AuditResults` — the upsert resets `email_sent: false` every time, which would wipe a previously sent flag. More critically, errors were silently swallowed. Fixed that by calling `supabase` directly instead of going through `saveAudit` which resets `email_sent`. 

The Diff page rendered blank. The issue was in the Supabase row, `input` and `findings` were stored as JSON strings, but `DiffPage` passes them directly to runAudit() and DiffView as if they were already objects. When the function got a string where it expects {tools: [...]}, everything silently failed and the page rendered blank. The fix was adding a `parseJsonField` helper that detects whether a column came back as a string or object and handles both cases.


## 2026-05-21 16:00 — Documentation

Wrote down in the documentation files.