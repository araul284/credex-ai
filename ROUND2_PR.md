# feat: add re-audit on pricing change with email notifications

## What this PR does

Adds persistent audit storage tied to a user's email, a pricing-change detection job, and a re-audit notification system. When tool pricing changes (e.g. Cursor raises prices, a new Claude plan launches), users who subscribed to their audit are emailed a consolidated diff showing old vs. new recommendations and a one-click link to a live comparison view at `/audit/:id/diff`.

## Why

A one-time audit snapshot becomes misleading the moment pricing shifts — and AI tool pricing changes frequently. A user who audited six months ago may be making decisions based on stale data. This feature makes SpendWise useful as an ongoing service, not just a one-shot calculator. The core assumption is that a user willing to enter their email after seeing savings is highly motivated — meaning notification click-through should be high.

## How it works

```
User submits audit
  → runAudit() produces AuditResult
  → generateAISummary() called
  → AuditResults rendered
  → User enters email in "Stay Optimized" sidebar card
  → saveAudit(audit, email) called
      → Supabase: upserts row with user_email + pricing_snapshot (JSON of all plan prices at submission time)

Cron (Monday 09:00 UTC, via vercel.json) or manual POST /api/detect-changes
  → getAllAuditsWithEmail() — fetches rows where user_email IS NOT NULL and unsubscribed = FALSE
  → For each row: detectPricingChanges(storedSnapshot, currentSnapshot)
      → Diffs plan prices / additions / removals per tool
  → If changes found: runAudit(storedInput) with current TOOLS data → newResult
  → Group affected audits by user email (consolidate: 1 email per user)
  → sendReAuditEmail() via Resend API
      → HTML email: what changed, old vs new recommendation table (highlighted rows), savings delta, CTA button → /audit/:id/diff
  → markEmailSent(auditId) per row

User clicks email CTA → /audit/:id/diff (DiffPage)
  → loadAuditRow(id) — fetches stored audit
  → runAudit(storedInput) — re-runs against current pricing
  → DiffView renders: changed findings expanded, unchanged collapsed, savings delta headline
  → "Re-Run Full Audit" → navigate('/') with localStorage-restored form state
```

**New files:**
- `src/lib/pricingDetector.ts` — change detection + notification orchestration
- `src/lib/email.ts` — Resend email builder + sender
- `src/components/DiffView.tsx` — diff UI component
- `src/pages/DiffPage.tsx` — `/audit/:id/diff` route
- `api/detect-changes.ts` — Vercel serverless route (manual trigger + cron entry)
- `api/unsubscribe.ts` — one-click unsubscribe endpoint
- `supabase/migration_round2.sql` — adds 4 new columns to `audits` table

**Modified files:**
- `src/lib/supabase.ts` — `saveAudit` now accepts `userEmail` + captures pricing snapshot; adds `getAllAuditsWithEmail`, `markEmailSent`, `unsubscribeEmail`, `loadAuditRow`
- `src/components/AuditResults.tsx` — email subscription now calls `saveAudit(audit, email)` (was a no-op `setSubscribed(true)`)
- `src/App.tsx` — adds `/audit/:id/diff` route

## What I cut

- **Unsubscribe in the email itself** — the unsubscribe link is present (`/api/unsubscribe?email=...`) and the endpoint works. What I cut was a more graceful "You've been unsubscribed" branded page — it currently returns minimal HTML. The mechanism is correct; the polish is not there.

- **"What changed in AI tooling this week" public page** — this is the bonus item and would be a straightforward read of a `pricing_changes` log table, but that table doesn't exist yet. The detection engine computes diffs transiently; persisting them is the one missing piece. Cut to ship the four required features cleanly.

- **Admin dashboard** — skipped entirely. Supabase's built-in table editor serves the same need during the internship period. Building a custom dashboard would have taken 4–6 hours and delivered no user-facing value in this window.

- **Re-running with a new Anthropic API summary on diff** — the DiffPage re-runs `runAudit()` but does not call `generateAISummary()` on the new result. The diff view doesn't need the summary; adding it would add latency and an API call on every diff page load. Cut deliberately.

- **Automated test coverage for email + detection** — the detection logic (`detectPricingChanges`) is pure and easily unit-testable, but I didn't write those tests in this window. See "What's tested" below.

## How to test it manually

1. **Deploy the PR** (or run locally with `npm run dev`).

2. **Run the Supabase migration** in the SQL editor:
   ```
   supabase/migration_round2.sql
   ```

3. **Submit an audit** on the homepage — add Cursor Business (2 seats) + Anthropic API ($600/mo spend). Click "Run Audit Engine".

4. **Enter your email** in the "Stay Optimized" sidebar card and click "Alert me when pricing changes". Verify in Supabase → Table Editor → `audits` that the row now has `user_email` and `pricing_snapshot` populated.

5. **Simulate a pricing change** — in `src/data/tools.ts`, find the Cursor `pro` plan and change `pricePerSeat` from `20` to `25`. Save. (This is how you'd ship a real pricing update — edit the file and redeploy.)

6. **Trigger detection** manually:
   ```bash
   curl -X POST https://YOUR_DEPLOY_URL/api/detect-changes \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
   Or omit the header if `CRON_SECRET` is not set (dev mode).

7. **Check your inbox** — you should receive a re-audit email from the `RESEND_FROM` address. It will show the Cursor Pro price change and the updated savings figure.

8. **Click the CTA button** in the email → lands on `/audit/:id/diff`. Verify:
   - Changed tools are expanded with old vs new recommendation
   - Unchanged tools are collapsed under "X unchanged tools"
   - Savings delta headline matches the arithmetic
   - "Re-Run Full Audit" navigates to `/` with the form pre-populated from localStorage

9. **Test unsubscribe** — visit `/api/unsubscribe?email=YOUR_EMAIL` directly. Verify `unsubscribed = true` in Supabase. Re-run detection — no email should be sent.

10. **Revert the price change** in `tools.ts` when done testing.

### Environment variables needed

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (existing) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (existing) |
| `VITE_ANTHROPIC_API_KEY` | AI summary (existing) |
| `RESEND_API_KEY` | Resend email sending (new) |
| `RESEND_FROM` | e.g. `SpendWise <alerts@yourdomain.com>` (new) |
| `CRON_SECRET` | Protects the detect-changes endpoint (new, optional in dev) |
| `APP_URL` | Base URL for email links, e.g. `https://spendwise.vercel.app` (new) |

## What's tested

- All existing Round 1 unit tests in `audit.test.ts` still pass — the audit engine was not modified.
- `detectPricingChanges()` is a pure function (snapshot in → changes out) and is straightforward to unit test. I didn't write those tests due to time. First tests I'd add:
  - Price increase on a known plan → returns `price_changed` entry
  - No changes between identical snapshots → returns empty array
  - Plan added in new snapshot → returns `plan_added` entry
  - Plan removed → returns `plan_removed` entry

## Open questions / risks

- **Supabase anon key write access**: The current `supabase.ts` uses the anon key for both reads and writes. For production, `saveAudit` with the email should use the service role key (via a server-side API route) so the email address is never sent through the browser to a world-readable endpoint. In this 36-hour build, writes go directly from the browser — acceptable for a demo, not for production.

- **Pricing snapshot staleness**: The detection job diffs `tools.ts` at job-run time against the stored snapshot. If you deploy a pricing change but the cron doesn't run for 7 days, users won't be notified until then. A manual trigger endpoint mitigates this, but it's a process dependency, not a technical guarantee.

- **Email deliverability**: Using Resend's free tier with a custom domain requires DNS verification. If `RESEND_FROM` is a non-verified domain, emails will bounce silently. The fallback is `console.log` in development, but there's no retry or dead-letter queue — a failed send is lost.