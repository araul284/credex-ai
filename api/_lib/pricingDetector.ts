import { TOOLS } from '../../src/data/tools';
import type { AuditResult } from '../../src/types';
import { runAudit } from '../../src/lib/AuditEngine';
import { getAllAuditsWithEmail, markEmailSent, capturePricingSnapshot } from './supabase';
import { sendReAuditEmail } from '../../src/lib/email';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricingChange {
  toolId: string;
  toolName: string;
  planId: string;
  planName: string;
  oldPrice: number | null;
  newPrice: number | null;
  changeType: 'price_changed' | 'plan_added' | 'plan_removed';
}

export interface AffectedAudit {
  auditId: string;
  userEmail: string;
  oldFindings: AuditResult['findings'];
  newFindings: AuditResult['findings'];
  oldMonthlySavings: number;
  newMonthlySavings: number;
  changes: PricingChange[];
}

// ─── Compare two pricing snapshots ───────────────────────────────────────────

export function detectPricingChanges(
  oldSnapshot: Record<string, unknown>,
  newSnapshot: Record<string, unknown>,
): PricingChange[] {
  const changes: PricingChange[] = [];

  for (const tool of TOOLS) {
    const oldPlans = (oldSnapshot[tool.id] as Array<{
      id: string; name: string; pricePerSeat: number; flatPrice: number | null;
    }>) || [];
    const newPlans = (newSnapshot[tool.id] as Array<{
      id: string; name: string; pricePerSeat: number; flatPrice: number | null;
    }>) || [];

    const oldPlanMap = new Map(oldPlans.map(p => [p.id, p]));
    const newPlanMap = new Map(newPlans.map(p => [p.id, p]));

    // Plans present in both: check for price changes
    for (const [planId, newPlan] of newPlanMap.entries()) {
      const oldPlan = oldPlanMap.get(planId);
      if (!oldPlan) {
        changes.push({
          toolId: tool.id,
          toolName: tool.name,
          planId,
          planName: newPlan.name,
          oldPrice: null,
          newPrice: newPlan.pricePerSeat,
          changeType: 'plan_added',
        });
      } else if (
        oldPlan.pricePerSeat !== newPlan.pricePerSeat ||
        oldPlan.flatPrice !== newPlan.flatPrice
      ) {
        changes.push({
          toolId: tool.id,
          toolName: tool.name,
          planId,
          planName: newPlan.name,
          oldPrice: oldPlan.pricePerSeat,
          newPrice: newPlan.pricePerSeat,
          changeType: 'price_changed',
        });
      }
    }

    // Plans in old but not new: removed
    for (const [planId, oldPlan] of oldPlanMap.entries()) {
      if (!newPlanMap.has(planId)) {
        changes.push({
          toolId: tool.id,
          toolName: tool.name,
          planId,
          planName: oldPlan.name,
          oldPrice: oldPlan.pricePerSeat,
          newPrice: null,
          changeType: 'plan_removed',
        });
      }
    }
  }

  return changes;
}

// ─── Check if changes affect a specific audit's tools ────────────────────────

function changesAffectAudit(
  changes: PricingChange[],
  input: AuditResult['input'],
): PricingChange[] {
  const toolIds = new Set(input.tools.map(t => t.toolId));
  return changes.filter(c => toolIds.has(c.toolId as typeof input.tools[0]['toolId']));
}

// ─── Main detection + notification runner ────────────────────────────────────

export async function runPricingChangeDetection(): Promise<{
  checked: number;
  affected: number;
  emailsSent: number;
  changes: PricingChange[];
}> {
  const currentSnapshot = capturePricingSnapshot();
  const allAudits = await getAllAuditsWithEmail();

  const globalChanges = detectPricingChanges(
    // For a real system, you'd store the last-known snapshot in DB.
    // Here we detect per-audit by diffing the stored snapshot against current.
    {},
    currentSnapshot,
  );

  const affectedByUser = new Map<string, AffectedAudit[]>();

  for (const row of allAudits) {

    const relevantChanges = detectPricingChanges(row.pricingSnapshot, currentSnapshot);
    if (relevantChanges.length === 0) continue;

    // Re-run the audit with current pricing
    const newResult = runAudit(row.input);
    const oldMonthlySavings = row.findings.reduce((s, f) => s + f.monthlySavings, 0);

    const affected: AffectedAudit = {
      auditId: row.id,
      userEmail: row.userEmail,
      oldFindings: row.findings,
      newFindings: newResult.findings,
      oldMonthlySavings,
      newMonthlySavings: newResult.totalMonthlySavings,
      changes: relevantChanges,
    };

    const userList = affectedByUser.get(row.userEmail) || [];
    userList.push(affected);
    affectedByUser.set(row.userEmail, userList);
  }

  let emailsSent = 0;
  for (const [email, affectedAudits] of affectedByUser.entries()) {
    try {
      // Consolidate: pick the audit with the biggest savings delta as the primary
      const primary = affectedAudits.sort(
        (a, b) =>
          Math.abs(b.newMonthlySavings - b.oldMonthlySavings) -
          Math.abs(a.newMonthlySavings - a.oldMonthlySavings),
      )[0];

      await sendReAuditEmail({
        to: email,
        auditId: primary.auditId,
        oldFindings: primary.oldFindings,
        newFindings: primary.newFindings,
        oldMonthlySavings: primary.oldMonthlySavings,
        newMonthlySavings: primary.newMonthlySavings,
        changes: primary.changes,
        totalAuditsAffected: affectedAudits.length,
      });

      for (const a of affectedAudits) {
        await markEmailSent(a.auditId);
      }

      emailsSent++;
    } catch (err) {
      console.error(`Failed to send email to ${email}:`, err);
    }
  }

  return {
    checked: allAudits.length,
    affected: affectedByUser.size,
    emailsSent,
    changes: globalChanges,
  };
}