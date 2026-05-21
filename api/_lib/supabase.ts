import { createClient } from '@supabase/supabase-js';
import type { AuditResult } from '../../src/types';
import { TOOLS } from '../../src/data/tools.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABSE_URL or SUPABSE_SERVICE_ROLE_KEY')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {persistSession: false}
});

// ─── Fetch all audits with email for change detection ────────────────────────
export async function getAllAuditsWithEmail(): Promise<Array<{
  id: string;
  userEmail: string;
  input: AuditResult['input'];
  findings: AuditResult['findings'];
  pricingSnapshot: Record<string, unknown>;
  createdAt: string;
}>> {
  const { data, error } = await supabaseAdmin
    .from('audits')
    .select('id, user_email, input, findings, pricing_snapshot, created_at')
    .not('user_email', 'is', null);

  if(error) {
    console.error('Supabse arror in getAllAuditsWithEmail:', error);
    throw error;
  }

  return (data || []).map(audit => ({
    id: audit.id,
    userEmail: audit.user_email,
    input: audit.input,
    findings: audit.findings,
    pricingSnapshot: audit.pricing_snapshot || {},
    createdAt: audit.created_at,
  }));
}

// ─── Mark audit email as sent ─────────────────────────────────────────────────
export async function markEmailSent(auditId: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('audits').update({ email_sent: true }).eq('id', auditId);
}

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