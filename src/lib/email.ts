/**
 * email.ts
 *
 * Sends re-audit notification emails via Resend.
 * Set RESEND_API_KEY in your environment.
 * From address must be a verified domain in your Resend account.
 *
 * Falls back to console.log in development when RESEND_API_KEY is absent.
 */

import type { AuditFinding } from '../types';
import type { PricingChange } from './pricingDetector';

export interface ReAuditEmailPayload {
  to: string;
  auditId: string;
  oldFindings: AuditFinding[];
  newFindings: AuditFinding[];
  oldMonthlySavings: number;
  newMonthlySavings: number;
  changes: PricingChange[];
  totalAuditsAffected: number;
}

// ─── Build the diff table rows ────────────────────────────────────────────────

function buildDiffRows(
  oldFindings: AuditFinding[],
  newFindings: AuditFinding[],
): string {
  const rows: string[] = [];

  for (const newF of newFindings) {
    const oldF = oldFindings.find(f => f.toolId === newF.toolId);
    const changed =
      !oldF ||
      oldF.status !== newF.status ||
      Math.abs((oldF.monthlySavings || 0) - (newF.monthlySavings || 0)) > 0.5;

    const rowBg = changed ? '#fef9c3' : '#ffffff';
    const badge =
      newF.status === 'overspending'
        ? '<span style="color:#b91c1c;font-weight:bold;">⚠ Overspending</span>'
        : newF.status === 'suboptimal'
        ? '<span style="color:#b45309;">~ Suboptimal</span>'
        : '<span style="color:#15803d;">✓ Optimal</span>';

    const oldBadge = oldF
      ? oldF.status === 'overspending'
        ? '⚠ Overspending'
        : oldF.status === 'suboptimal'
        ? '~ Suboptimal'
        : '✓ Optimal'
      : '—';

    const savingsDelta =
      oldF && changed
        ? ` (was $${oldF.monthlySavings.toFixed(0)})`
        : '';

    rows.push(`
      <tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 12px;font-family:monospace;font-size:12px;">${newF.toolName}</td>
        <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#64748b;">${oldBadge}</td>
        <td style="padding:10px 12px;font-family:monospace;font-size:11px;">${badge}</td>
        <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#059669;">
          ${newF.monthlySavings > 0 ? `-$${newF.monthlySavings.toFixed(0)}/mo${savingsDelta}` : '—'}
        </td>
      </tr>
    `);
  }

  return rows.join('');
}

// ─── Build the pricing changes list ──────────────────────────────────────────

function buildChangesHtml(changes: PricingChange[]): string {
  return changes
    .map(c => {
      if (c.changeType === 'price_changed') {
        const dir = (c.newPrice ?? 0) > (c.oldPrice ?? 0) ? '↑' : '↓';
        return `<li style="margin-bottom:6px;font-size:13px;"><strong>${c.toolName}</strong> ${c.planName}: $${c.oldPrice}/seat → $${c.newPrice}/seat <span style="color:${dir === '↑' ? '#dc2626' : '#15803d'}">${dir}</span></li>`;
      }
      if (c.changeType === 'plan_added') {
        return `<li style="margin-bottom:6px;font-size:13px;"><strong>${c.toolName}</strong> new plan added: ${c.planName}</li>`;
      }
      return `<li style="margin-bottom:6px;font-size:13px;"><strong>${c.toolName}</strong> plan removed: ${c.planName}</li>`;
    })
    .join('');
}

// ─── HTML email template ──────────────────────────────────────────────────────

function buildEmailHtml(payload: ReAuditEmailPayload): string {
  const {
    auditId,
    oldMonthlySavings,
    newMonthlySavings,
    changes,
    oldFindings,
    newFindings,
    to,
  } = payload;

  const baseUrl = process.env.APP_URL || 'https://spendwise-roan-six.vercel.app';
  const reAuditUrl = `${baseUrl}/audit/${auditId}/diff`;

  const delta = newMonthlySavings - oldMonthlySavings;
  const deltaText =
    delta > 0
      ? `+$${delta.toFixed(0)}/mo more savings available`
      : delta < 0
      ? `$${Math.abs(delta).toFixed(0)}/mo less savings (prices improved)`
      : 'Same savings potential';

  const diffRows = buildDiffRows(oldFindings, newFindings);
  const changesHtml = buildChangesHtml(changes);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your AI spend audit is out of date</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border:1px solid #e2e8f0;">

    <!-- Header -->
    <div style="background:#000;padding:24px 32px;display:flex;align-items:center;gap:12px;">
      <span style="font-family:monospace;font-size:20px;font-weight:bold;color:#fff;letter-spacing:-0.05em;">SpendWise.</span>
      <span style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8;">Re-Audit Alert</span>
    </div>

    <!-- Body -->
    <div style="padding:32px;">

      <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#64748b;margin:0 0 16px;">Pricing has changed since your last audit</p>

      <h1 style="font-size:28px;font-weight:800;color:#0f172a;margin:0 0 8px;letter-spacing:-0.03em;">
        ${deltaText}
      </h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 28px;">
        ${changes.length} tool pricing change${changes.length !== 1 ? 's' : ''} affect your saved audit.
        Here's what moved and how it changes your recommendations.
      </p>

      <!-- What changed -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;margin-bottom:28px;">
        <p style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#64748b;margin:0 0 12px;">What changed</p>
        <ul style="margin:0;padding-left:18px;color:#334155;">
          ${changesHtml}
        </ul>
      </div>

      <!-- Diff table -->
      <p style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#64748b;margin:0 0 12px;">Your recommendations — old vs new</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
            <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;">Tool</th>
            <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;">Was</th>
            <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;">Now</th>
            <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;">Savings</th>
          </tr>
        </thead>
        <tbody>
          ${diffRows}
        </tbody>
      </table>

      <!-- Savings summary -->
      <div style="display:flex;gap:16px;margin-bottom:28px;">
        <div style="flex:1;border:1px solid #e2e8f0;padding:16px;text-align:center;">
          <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#94a3b8;margin-bottom:4px;">Old Savings</div>
          <div style="font-size:24px;font-weight:800;color:#64748b;">$${oldMonthlySavings.toFixed(0)}/mo</div>
        </div>
        <div style="display:flex;align-items:center;color:#94a3b8;font-size:20px;">→</div>
        <div style="flex:1;border:1px solid #059669;background:#f0fdf4;padding:16px;text-align:center;">
          <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#059669;margin-bottom:4px;">New Savings</div>
          <div style="font-size:24px;font-weight:800;color:#059669;">$${newMonthlySavings.toFixed(0)}/mo</div>
        </div>
      </div>

      <!-- CTA -->
      <a href="${reAuditUrl}" style="display:block;background:#000;color:#fff;text-align:center;padding:16px 24px;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.2em;text-decoration:none;font-weight:bold;margin-bottom:28px;">
        View Full Diff &amp; Re-Run Audit →
      </a>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">

      <p style="font-size:12px;color:#94a3b8;margin:0;">
        You're receiving this because you subscribed to SpendWise re-audit alerts.<br> 
        <a href="${baseUrl}" style="color:#64748b;">SpendWise</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Send via Resend ──────────────────────────────────────────────────────────

export async function sendReAuditEmail(payload: ReAuditEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev: log to console
    console.log('[email] Would send re-audit email to:', payload.to);
    console.log('[email] Audit ID:', payload.auditId);
    console.log('[email] Changes:', payload.changes);
    return;
  }

  const html = buildEmailHtml(payload);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'SpendWise <alerts@spendwise-roan-six.vercel.app>',
      to: payload.to,
      subject: `⚠ Your AI spend audit is out of date — ${payload.changes.length} pricing change${payload.changes.length !== 1 ? 's' : ''} detected`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${res.status} ${err}`);
  }
}