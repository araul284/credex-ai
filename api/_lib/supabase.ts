/**
 * api/_lib/supabase.ts
 *
 * Server-side Supabase client using the SERVICE ROLE key.
 * Never expose this key to the browser.
 *
 * Fix log vs original api/_lib/supabase.ts:
 *  - Fixed typo: "SUPABSE" → "SUPABASE" in env var names + error message
 *  - Made initialization lazy (don't throw at import time — crashes the
 *    Vercel function before handler runs, causing FUNCTION_INVOCATION_FAILED)
 *  - Added `unsubscribed` column to the SELECT so pricingDetector can filter
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditResult } from '../../src/types/index.js';
import { TOOLS } from '../../src/data/tools.js';

// ─── Lazy client — created on first use, not at module load time ─────────────
// Throwing at import time = FUNCTION_INVOCATION_FAILED before handler runs.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
      'Add them in Vercel → Settings → Environment Variables.',
    );
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ─── Pricing snapshot ─────────────────────────────────────────────────────────
export function capturePricingSnapshot(): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const tool of TOOLS) {
    snapshot[tool.id] = tool.plans.map(p => ({
      id: p.id,
      name: p.name,
      pricePerSeat: p.pricePerSeat,
      flatPrice: p.flatPrice ?? null,
    }));
  }
  return snapshot;
}

// ─── Fetch all audits that have an email address ──────────────────────────────
export async function getAllAuditsWithEmail(): Promise<Array<{
  id: string;
  userEmail: string;
  input: AuditResult['input'];
  findings: AuditResult['findings'];
  pricingSnapshot: Record<string, unknown>;
  createdAt: string;
  unsubscribed: boolean;
}>> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('audits')
    .select('id, user_email, input, findings, pricing_snapshot, created_at, unsubscribed')
    .not('user_email', 'is', null)
    .eq('unsubscribed', false);   // only people who haven't opted out

  if (error) {
    console.error('Supabase error in getAllAuditsWithEmail:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    userEmail: row.user_email,
    input: row.input,
    findings: row.findings,
    pricingSnapshot: row.pricing_snapshot || {},
    createdAt: row.created_at,
    unsubscribed: row.unsubscribed ?? false,
  }));
}

// ─── Mark email as sent ───────────────────────────────────────────────────────
export async function markEmailSent(auditId: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('audits')
    .update({ email_sent: true })
    .eq('id', auditId);

  if (error) console.error('markEmailSent error:', error);
}