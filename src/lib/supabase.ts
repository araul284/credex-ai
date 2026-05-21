import { createClient } from '@supabase/supabase-js';
import type { AuditResult, LeadCapture } from '../types';
import { TOOLS } from '../data/tools';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ─── Pricing snapshot: serialize current TOOLS pricing for change detection ──
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

// ─── Save audit to Supabase (Round 2: includes userEmail + pricingSnapshot) ──
export async function saveAudit(
  audit: AuditResult,
  userEmail?: string,
): Promise<void> {
  const pricingSnapshot = capturePricingSnapshot();

  if (!supabase) {
    // localStorage fallback
    const audits = JSON.parse(localStorage.getItem('sw_audits') || '{}');
    audits[audit.id] = { ...audit, userEmail, pricingSnapshot };
    localStorage.setItem('sw_audits', JSON.stringify(audits));
    return;
  }

  await supabase.from('audits').upsert({
    id: audit.id,
    input: audit.input,
    findings: audit.findings,
    total_monthly_savings: audit.totalMonthlySavings,
    total_annual_savings: audit.totalAnnualSavings,
    ai_summary: audit.aiSummary,
    is_optimal: audit.isOptimal,
    created_at: audit.createdAt,
    user_email: userEmail ?? null,
    pricing_snapshot: pricingSnapshot,
    email_sent: false,
  });
}

// ─── Load audit by ID ─────────────────────────────────────────────────────────
export async function loadAudit(id: string): Promise<AuditResult | null> {
  if (!supabase) {
    const audits = JSON.parse(localStorage.getItem('sw_audits') || '{}');
    return audits[id] || null;
  }

  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    input: data.input,
    findings: data.findings,
    totalMonthlySavings: data.total_monthly_savings,
    totalAnnualSavings: data.total_annual_savings,
    aiSummary: data.ai_summary,
    isOptimal: data.is_optimal,
    createdAt: data.created_at,
  };
}

// ─── Load audit row with full metadata (for diff / re-audit) ─────────────────
export async function loadAuditRow(id: string): Promise<{
  audit: AuditResult;
  pricingSnapshot: Record<string, unknown>;
  userEmail: string | null;
} | null> {
  if (!supabase) {
    const audits = JSON.parse(localStorage.getItem('sw_audits') || '{}');
    const row = audits[id];
    if (!row) return null;
    return {
      audit: row,
      pricingSnapshot: row.pricingSnapshot || {},
      userEmail: row.userEmail || null,
    };
  }
 
  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single();
 
  if (error || !data) return null;
 
  // Supabase can return JSON columns as strings or objects depending on
  // the client version and column type. Parse safely either way.
  function parseJsonField<T>(field: unknown): T {
    if (typeof field === 'string') {
      try { return JSON.parse(field) as T; } catch { return field as T; }
    }
    return field as T;
  }
 
  return {
    audit: {
      id: data.id,
      input: parseJsonField(data.input),
      findings: parseJsonField(data.findings),
      totalMonthlySavings: data.total_monthly_savings,
      totalAnnualSavings: data.total_annual_savings,
      aiSummary: data.ai_summary,
      isOptimal: data.is_optimal,
      createdAt: data.created_at,
    },
    pricingSnapshot: parseJsonField(data.pricing_snapshot) || {},
    userEmail: data.user_email || null,
  };
}

// ─── Save lead ────────────────────────────────────────────────────────────────
export async function saveLead(lead: LeadCapture): Promise<void> {
  if (!supabase) {
    const leads = JSON.parse(localStorage.getItem('sw_leads') || '[]');
    leads.push({ ...lead, savedAt: new Date().toISOString() });
    localStorage.setItem('sw_leads', JSON.stringify(leads));
    return;
  }

  await supabase.from('leads').insert({
    email: lead.email,
    company_name: lead.companyName,
    role: lead.role,
    team_size: lead.teamSize,
    audit_id: lead.auditId,
    captured_at: new Date().toISOString(),
  });
}

// ─── Fetch all audits with email for change detection ────────────────────────
export async function getAllAuditsWithEmail(): Promise<Array<{
  id: string;
  userEmail: string;
  input: AuditResult['input'];
  findings: AuditResult['findings'];
  pricingSnapshot: Record<string, unknown>;
  createdAt: string;
  unsubscribed: boolean;
}>> {
  if (!supabase) {
    const audits = JSON.parse(localStorage.getItem('sw_audits') || '{}');
    return Object.values(audits as Record<string, Record<string, unknown>>)
      .filter((a) => (a as { userEmail?: string }).userEmail)
      .map((a) => ({
        id: a.id as string,
        userEmail: a.userEmail as string,
        input: a.input as AuditResult['input'],
        findings: a.findings as AuditResult['findings'],
        pricingSnapshot: (a.pricingSnapshot as Record<string, unknown>) || {},
        createdAt: a.createdAt as string,
        unsubscribed: false,
      }));
  }

  const { data, error } = await supabase
    .from('audits')
    .select('id, user_email, input, findings, pricing_snapshot, created_at, unsubscribed')
    .not('user_email', 'is', null);

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    userEmail: row.user_email,
    input: row.input,
    findings: row.findings,
    pricingSnapshot: row.pricing_snapshot || {},
    createdAt: row.created_at,
    unsubscribed: row.unsubscribed || false,
  }));
}

// ─── Mark audit email as sent ─────────────────────────────────────────────────
export async function markEmailSent(auditId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('audits').update({ email_sent: true }).eq('id', auditId);
}

// ─── Unsubscribe a user from re-audit emails ──────────────────────────────────
export async function unsubscribeEmail(email: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('audits').update({ unsubscribed: true }).eq('user_email', email);
}