import type { AuditInput, AuditFinding, AuditResult, ToolEntry, UseCase } from '../types/index.js';
import { TOOL_MAP } from '../data/tools.js';
import { nanoid } from 'nanoid';

// ─── Helper: calculate effective monthly cost ───────────────────────────────
function effectiveMonthlyCost(entry: ToolEntry): number {
  // User-reported spend takes precedence (for API tools billed by usage)
  if (entry.monthlySpend > 0) return entry.monthlySpend;

  const tool = TOOL_MAP.get(entry.toolId);
  if (!tool) return 0;
  const plan = tool.plans.find(p => p.id === entry.plan);
  if (!plan) return 0;

  if (plan.flatPrice !== undefined) return plan.flatPrice;
  return plan.pricePerSeat * entry.seats;
}

// ─── Rule: is Team plan justified? ─────────────────────────────────────────
// Team plans add admin tooling; for <5 users they rarely pay off
function isTeamPlanJustified(seats: number, teamSize: number): boolean {
  return seats >= 5 || teamSize >= 10;
}

// ─── Rule: IDE tool overlap ─────────────────────────────────────────────────
// Paying for both Cursor and GitHub Copilot is almost always waste
function detectIDEOverlap(tools: ToolEntry[]): Set<string> {
  const ideTools = tools.filter(t => ['cursor', 'github_copilot', 'windsurf'].includes(t.toolId));
  if (ideTools.length > 1) return new Set(ideTools.map(t => t.toolId));
  return new Set();
}

// ─── Rule: chat tool redundancy ────────────────────────────────────────────
// Paying for ChatGPT Plus AND Claude Pro with similar use case = overlap
function detectChatOverlap(tools: ToolEntry[], useCase: UseCase): boolean {
  const chatTools = tools.filter(t => ['claude', 'chatgpt', 'gemini'].includes(t.toolId) && t.plan !== 'free');
  return chatTools.length > 1 && useCase !== 'mixed';
}

// ─── Core audit engine ──────────────────────────────────────────────────────
export function runAudit(input: AuditInput): AuditResult {
  const { tools, teamSize, useCase } = input;
  const findings: AuditFinding[] = [];
  const ideOverlap = detectIDEOverlap(tools);
  const chatOverlap = detectChatOverlap(tools, useCase);

  for (const entry of tools) {
    const tool = TOOL_MAP.get(entry.toolId);
    if (!tool) continue;

    const currentPlan = tool.plans.find(p => p.id === entry.plan);
    if (!currentPlan) continue;

    const currentSpend = effectiveMonthlyCost(entry);
    let suggestedSpend = currentSpend;
    let status: AuditFinding['status'] = 'optimal';
    let recommendation = 'No changes needed.';
    let reason = 'Your plan is well-matched to your usage.';
    let alternativeTool: string | undefined;
    let alternativeToolUrl: string | undefined;
    let credexApplicable = false;

    // ── Cursor ──────────────────────────────────────────────────────────────
    if (entry.toolId === 'cursor') {
      if (ideOverlap.size > 1) {
        // Has overlap with other IDE tools
        const competingIDE = tools.find(t => t.toolId !== 'cursor' && ideOverlap.has(t.toolId));
        const competingCost = competingIDE ? effectiveMonthlyCost(competingIDE) : 0;
        if (competingCost > 0 && currentSpend > 0) {
          suggestedSpend = 0;
          status = 'overspending';
          recommendation = `Drop ${currentPlan.name} — you already pay for ${TOOL_MAP.get(competingIDE!.toolId)?.name}.`;
          reason = `Running two AI coding assistants in parallel adds cost without proportional benefit. ${TOOL_MAP.get(competingIDE!.toolId)?.name} already covers your completions and chat workflow. Keep whichever you use more actively.`;
        }
      } else if (entry.plan === 'business' && !isTeamPlanJustified(entry.seats, teamSize)) {
        // Business plan for tiny team
        suggestedSpend = 20 * entry.seats;
        status = 'overspending';
        recommendation = `Downgrade to Cursor Pro ($20/user/mo) — you have ${entry.seats} seats.`;
        reason = `Cursor Business adds SSO, admin panel, and usage analytics — features that matter at 10+ developers. With ${entry.seats} user(s), the $${(currentSpend - suggestedSpend).toFixed(0)}/mo premium buys you admin tooling you're unlikely to use.`;
        credexApplicable = true;
      } else if (useCase !== 'coding' && currentSpend > 20 * entry.seats) {
        suggestedSpend = 0;
        alternativeTool = 'Claude Pro';
        alternativeToolUrl = 'https://claude.ai/upgrade';
        status = 'suboptimal';
        recommendation = `Consider switching to Claude Pro for your ${useCase} workload.`;
        reason = `Cursor is purpose-built for code completion and is most valuable for active programming workflows. For ${useCase} tasks, a general-purpose model like Claude Pro at $20/seat likely covers your needs without the IDE overhead.`;
      }
    }

    // ── GitHub Copilot ──────────────────────────────────────────────────────
    if (entry.toolId === 'github_copilot') {
      if (ideOverlap.size > 1) {
        const competingIDE = tools.find(t => t.toolId !== 'github_copilot' && ideOverlap.has(t.toolId));
        if (competingIDE && effectiveMonthlyCost(competingIDE) > 0 && currentSpend > 0) {
          // Compare: Copilot Individual ($10) vs Cursor Pro ($20) — keep cheaper per seat
          const copilotCostPerSeat = currentPlan.pricePerSeat;
          const cursorCostPerSeat = 20;
          if (copilotCostPerSeat <= cursorCostPerSeat) {
            suggestedSpend = 0;
            status = 'overspending';
            recommendation = `Drop Cursor — GitHub Copilot Individual at $10/seat is cheaper for the same workflow.`;
            reason = `Both tools provide inline completions and AI chat in VS Code / JetBrains. GitHub Copilot Individual is $10/seat vs Cursor Pro at $20/seat. Consolidating saves $${(effectiveMonthlyCost(tools.find(t => t.toolId === 'cursor')!) - 0).toFixed(0)}/mo with no capability loss for standard coding tasks.`;
          }
        }
      } else if (entry.plan === 'enterprise' && !isTeamPlanJustified(entry.seats, teamSize)) {
        suggestedSpend = 19 * entry.seats;
        status = 'overspending';
        recommendation = `Downgrade to Copilot Business ($19/user/mo).`;
        reason = `Copilot Enterprise adds fine-tuning on your codebase — valuable at 50+ developers. With ${entry.seats} user(s), you're paying $${(currentSpend - suggestedSpend).toFixed(0)}/mo for customisation features that need scale to justify.`;
        credexApplicable = true;
      }
    }

    // ── Claude ──────────────────────────────────────────────────────────────
    if (entry.toolId === 'claude') {
      if (entry.plan === 'team' && !isTeamPlanJustified(entry.seats, teamSize)) {
        suggestedSpend = 20 * entry.seats; // Pro per seat
        status = 'overspending';
        recommendation = `Switch ${entry.seats} user(s) to Claude Pro ($20/seat) — Team plan minimum is 5 seats.`;
        reason = `Claude Team requires a 5-seat minimum and adds workspace management for larger organisations. With ${entry.seats} user(s), you can achieve the same model access with individual Pro plans at $20/seat, saving $${(currentSpend - suggestedSpend).toFixed(0)}/mo.`;
      } else if (entry.plan === 'max' && useCase === 'coding') {
        suggestedSpend = 20 * entry.seats;
        status = 'suboptimal';
        recommendation = `Downgrade to Claude Pro — Max tier is for extreme context, not typical coding.`;
        reason = `Claude Max provides 20× the usage ceiling and extended context windows — primarily valuable for legal/research workflows processing hundreds of pages. For coding, Pro's 5× usage is rarely a bottleneck. Save $${(currentSpend - suggestedSpend).toFixed(0)}/mo.`;
        credexApplicable = true;
      } else if (chatOverlap && entry.plan !== 'free') {
        status = 'suboptimal';
        recommendation = `You're paying for Claude and another chat AI. Pick one for primary use.`;
        reason = `With ${useCase} as your primary use case, consolidating to one chat AI tool reduces cognitive overhead and spend. Claude is particularly strong for writing, analysis, and research.`;
        suggestedSpend = currentSpend; // still pay this, drop the other
      }
    }

    // ── ChatGPT ─────────────────────────────────────────────────────────────
    if (entry.toolId === 'chatgpt') {
      if (entry.plan === 'team' && !isTeamPlanJustified(entry.seats, teamSize)) {
        suggestedSpend = 20 * entry.seats; // Plus per seat
        status = 'overspending';
        recommendation = `Switch to ChatGPT Plus ($20/seat) — Team has a 2-seat minimum but adds unnecessary overhead for small teams.`;
        reason = `ChatGPT Team adds workspace management and shared settings. For ${entry.seats} user(s), individual Plus plans give you the same model access (GPT-4o, DALL-E) without the admin overhead, saving $${(currentSpend - suggestedSpend).toFixed(0)}/mo.`;
      } else if (chatOverlap && entry.plan !== 'free') {
        const claudeTool = tools.find(t => t.toolId === 'claude');
        if (claudeTool) {
          status = 'suboptimal';
          recommendation = `You're paying for ChatGPT and Claude. Consider consolidating.`;
          reason = `Both tools overlap significantly for ${useCase} tasks. ChatGPT Plus adds image generation (DALL-E) and web browse; Claude Pro excels at long-form writing and analysis. If you use image gen actively, keep ChatGPT Plus; otherwise Claude Pro likely covers 90% of needs.`;
        }
      }
    }

    // ── Anthropic / OpenAI API ──────────────────────────────────────────────
    if (entry.toolId === 'anthropic_api' || entry.toolId === 'openai_api') {
      if (currentSpend > 500) {
        status = 'overspending';
        credexApplicable = true;
        recommendation = `You're spending $${currentSpend}/mo on API — Credex credits could cut this by 20–40%.`;
        reason = `At $${currentSpend}/mo, you're a prime candidate for discounted AI infrastructure credits. Credex sources credits from companies that overforecast compute, passing savings directly to teams like yours. At this spend level, the potential savings are significant.`;
        suggestedSpend = currentSpend * 0.7; // conservative 30% saving estimate
      } else if (currentSpend > 100) {
        credexApplicable = true;
        status = 'suboptimal';
        recommendation = `Consider Credex credits to reduce your API bill by 15–30%.`;
        reason = `API costs at $${currentSpend}/mo are meaningful but manageable. Discounted credits through Credex could trim 15–30% off this with no code changes required — same API endpoint, lower effective rate.`;
        suggestedSpend = currentSpend * 0.8;
      }
    }

    // ── Gemini ──────────────────────────────────────────────────────────────
    if (entry.toolId === 'gemini') {
      if (chatOverlap && entry.plan !== 'free') {
        status = 'suboptimal';
        recommendation = `You're paying for Gemini alongside another AI. Consolidate your stack.`;
        reason = `Gemini Advanced excels at Google Workspace integration and long-context tasks (2M tokens). If your team lives in Docs/Sheets, it earns its keep; otherwise Claude or ChatGPT likely covers your ${useCase} workflow more cost-effectively.`;
      } else if (entry.plan === 'business' && !isTeamPlanJustified(entry.seats, teamSize)) {
        suggestedSpend = 20 * entry.seats;
        status = 'overspending';
        recommendation = `Downgrade to Gemini Advanced ($20/seat).`;
        reason = `Gemini Business/Workspace tier adds enterprise data protection and admin controls. For ${entry.seats} user(s) at a startup stage, Advanced at $20/seat provides the same Gemini 1.5 Pro access without the enterprise overhead.`;
      }
    }

    // ── Windsurf ─────────────────────────────────────────────────────────────
    if (entry.toolId === 'windsurf') {
      if (ideOverlap.size > 1) {
        suggestedSpend = 0;
        status = 'overspending';
        const other = tools.find(t => t.toolId !== 'windsurf' && ideOverlap.has(t.toolId));
        recommendation = `Drop Windsurf — you already pay for ${TOOL_MAP.get(other!.toolId)?.name}.`;
        reason = `Running multiple AI IDE tools creates context-switching overhead and duplicates cost. Windsurf and Cursor overlap almost entirely in capability. Consolidate to the one your team prefers.`;
      }
    }

    const monthlySavings = Math.max(0, currentSpend - suggestedSpend);
    findings.push({
      toolId: entry.toolId,
      toolName: tool.name,
      currentPlan: currentPlan.name,
      currentSpend,
      status,
      recommendation,
      alternativeTool,
      alternativeToolUrl,
      suggestedSpend,
      monthlySavings,
      annualSavings: monthlySavings * 12,
      reason,
      credexApplicable,
    });
  }

  const totalMonthlySavings = findings.reduce((sum, f) => sum + f.monthlySavings, 0);
  const totalAnnualSavings = totalMonthlySavings * 12;
  const isOptimal = totalMonthlySavings < 10;

  return {
    id: nanoid(10),
    input,
    findings,
    totalMonthlySavings,
    totalAnnualSavings,
    createdAt: new Date().toISOString(),
    isOptimal,
  };
}