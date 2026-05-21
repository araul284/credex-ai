-- ============================================================
-- SpendWise Round 2 Migration
-- Run this in your Supabase SQL editor before deploying.
-- ============================================================

-- 1. Add new columns to existing `audits` table
--    (idempotent: uses IF NOT EXISTS equivalents via DO blocks)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='audits' AND column_name='user_email'
  ) THEN
    ALTER TABLE audits ADD COLUMN user_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='audits' AND column_name='pricing_snapshot'
  ) THEN
    ALTER TABLE audits ADD COLUMN pricing_snapshot JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='audits' AND column_name='email_sent'
  ) THEN
    ALTER TABLE audits ADD COLUMN email_sent BOOLEAN DEFAULT FALSE;
  END IF;

END $$;

-- 2. Index on user_email for efficient per-user queries
CREATE INDEX IF NOT EXISTS idx_audits_user_email
  ON audits (user_email)
  WHERE user_email IS NOT NULL;

-- 3. Index on email_sent for the detection job (only re-check unsent)
CREATE INDEX IF NOT EXISTS idx_audits_email_sent
  ON audits (email_sent)
  WHERE email_sent = FALSE;

-- 4. Ensure the `leads` table exists (from Round 1, kept as-is)
CREATE TABLE IF NOT EXISTS leads (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT NOT NULL,
  company_name TEXT,
  role         TEXT,
  team_size    INTEGER,
  audit_id     TEXT REFERENCES audits(id) ON DELETE SET NULL,
  captured_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS policies — keep audits publicly readable by ID (for share links),
--    but restrict writes to service role only.
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read by id" ON audits;
CREATE POLICY "Public read by id"
  ON audits FOR SELECT
  USING (true);

-- Writes go through service role key only (server-side API routes).
-- The anon key used by the browser cannot INSERT/UPDATE.
-- If you want browser writes, enable this policy:
-- CREATE POLICY "Anon insert" ON audits FOR INSERT WITH CHECK (true);

-- 6. Verification query — run after migration to confirm columns exist:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'audits' ORDER BY ordinal_position;