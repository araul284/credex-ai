# Round 2 Reflection

## 1. What was the most uncomfortable trade-off you made because of the time pressure?

The most uncomfortable trade-off was keeping the email subscription write
path in the browser using the Supabase anon key instead of routing it through
a server-side API endpoint. The specific trade-off: `handleSubscribe` in
`AuditResults.tsx` calls `supabase.upsert()` directly from the client, which
means the user's email address is written to the database through a
publicly-visible key. With the right RLS policy this is manageable, but it
means anyone who inspects the network tab can see the Supabase URL, the anon
key, and construct their own writes to the `audits` table. The correct
implementation is a `POST /api/save-email` serverless route that accepts the
audit ID and email, validates both, and writes using the service role key
which never leaves the server. I knew this was the wrong pattern while writing
it. I made the call to ship it anyway because building and debugging the
detection job, the email template, and the diff view already consumed the
available time. The security gap is real, not theoretical.

## 2. If we extended the deadline by another 24 hours right now, what's the first thing you'd do?

Move the email capture to a server-side API route. Specifically: create
`api/save-email.ts` that accepts `{ auditId, email }` in the request body,
validates that the audit ID exists in the database, sanitizes the email, and
writes `user_email` and `pricing_snapshot` using the service role key. Then
update `handleSubscribe` in `AuditResults.tsx` to call `POST /api/save-email`
instead of writing to Supabase directly from the browser. This is the single
change that makes the feature production-safe rather than demo-safe. Everything
else — better error handling in the diff view, the public pricing-changes page,
test coverage for `detectPricingChanges` — is lower priority than closing the
gap where user emails are currently written through a client-exposed key.

## 3. What's one thing your Round 1 self made harder for your Round 2 self?

The `input` and `findings` fields on the `audits` table were stored without
explicit column types in Supabase — they went in as whatever `JSON.stringify`
produced and came back as strings in some client versions, objects in others.
Round 1 never read these fields back from the database, so it never mattered.
Round 2 reads them constantly: the detection job re-runs `runAudit(row.input)`,
the diff page passes `findings` directly to `DiffView`. Both broke silently
when the fields came back as strings — `runAudit` received `"{\"tools\":...}"`
instead of `{tools: [...]}` and produced an empty result with no error. The
fix was a `parseJsonField` helper that detects string-vs-object at runtime.
Round 1 should have defined these columns as `jsonb` explicitly in the schema
and added a single integration test that round-tripped an audit through
Supabase. That test would have caught the type mismatch in minutes instead of
the hour it took to trace a blank page back to a JSON parsing bug.