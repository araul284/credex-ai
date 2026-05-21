-- ============================================================
-- SpendWise Round 2 Migration (updated)
-- Adds the `unsubscribed` column that was missing from the
-- original migration but is referenced in the code.
-- Safe to re-run — all statements are idempotent.
-- ============================================================

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

  -- THIS WAS MISSING from your original migration.sql but the code queries it.
  -- Without it, Supabase returns an error and the function crashes.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='audits' AND column_name='unsubscribed'
  ) THEN
    ALTER TABLE audits ADD COLUMN unsubscribed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audits_user_email
  ON audits (user_email)
  WHERE user_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audits_email_sent
  ON audits (email_sent)
  WHERE email_sent = FALSE;

-- Leads table (unchanged from Round 1)
CREATE TABLE IF NOT EXISTS leads (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT NOT NULL,
  company_name TEXT,
  role         TEXT,
  team_size    INTEGER,
  audit_id     TEXT REFERENCES audits(id) ON DELETE SET NULL,
  captured_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read by id" ON audits;
CREATE POLICY "Public read by id"
  ON audits FOR SELECT
  USING (true);

-- Required for browser writes (saveAudit called from AuditResults with anon key)
DROP POLICY IF EXISTS "Anon insert and update" ON audits;
CREATE POLICY "Anon insert and update"
  ON audits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verify: run this after migration
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'audits'
-- ORDER BY ordinal_position;