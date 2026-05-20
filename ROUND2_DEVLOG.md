## 2026-05-20 14:40 — Start planning

Read Round 2 assignment specifications fully. Outlined 4 must-work features: persistent audit storage, pricing-change detection, notification emails, and diff view on re-run.


## 2026-05-20 15:10 — Git workflow research

Never made a PR before. Learned `checkout -b` creates branch, PR stays open for review. Understood not to merge. Risk: branching from wrong base, but verified with git log that I'm on main. 10 min.


## 2026-05-20 15:20 — Architecture outline

Mapped files to touch: new tables in supabase/migrations, aoi/admin/update-pricing.ts, api/cron/detect-changes.ts, src/lib/pricing.ts, src/lib/audit-store.ts, src/pages/RerunAuditPage.tsx (are subjected to change as they are what I thought of the expected architecture).

Note: In college for exam from 10:00-15:00, no laptop. Used phone notes for planning only. No code written yet.

## 2026-05-20 16:00 — Commute + rest

Travel time home. 3h no coding. Will start DB migration first thing.


## 2026-05-20 19:50 — Start coding

