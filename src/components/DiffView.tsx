/**
 * DiffView.tsx
 *
 * Shows a side-by-side diff of an old audit vs a re-run audit.
 * Used on /audit/:id/diff — the page the user lands on from the re-audit email.
 *
 * Design follows the existing SpendWise brutalist editorial aesthetic.
 */

import { useState } from 'react';
import { ArrowRight, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import type { AuditFinding, AuditResult } from '../types';

interface DiffViewProps {
  oldAudit: AuditResult;
  newAudit: AuditResult;
  onReRunFull: () => void;
}

type DiffStatus = 'improved' | 'worsened' | 'unchanged' | 'new';

interface FindingDiff {
  toolId: string;
  toolName: string;
  old: AuditFinding | null;
  new: AuditFinding | null;
  diffStatus: DiffStatus;
  savingsDelta: number; // positive = more savings now
}

function computeDiffs(
  oldFindings: AuditFinding[],
  newFindings: AuditFinding[],
): FindingDiff[] {
  const allToolIds = new Set([
    ...oldFindings.map(f => f.toolId),
    ...newFindings.map(f => f.toolId),
  ]);

  return Array.from(allToolIds).map(toolId => {
    const oldF = oldFindings.find(f => f.toolId === toolId) ?? null;
    const newF = newFindings.find(f => f.toolId === toolId) ?? null;

    const oldSavings = oldF?.monthlySavings ?? 0;
    const newSavings = newF?.monthlySavings ?? 0;
    const savingsDelta = newSavings - oldSavings;

    let diffStatus: DiffStatus = 'unchanged';
    if (!oldF) {
      diffStatus = 'new';
    } else if (
      oldF.status !== newF?.status ||
      Math.abs(savingsDelta) > 0.5 ||
      oldF.recommendation !== newF?.recommendation
    ) {
      diffStatus = savingsDelta > 0.5 ? 'improved' : 'worsened';
    }

    return {
      toolId,
      toolName: (newF ?? oldF)!.toolName,
      old: oldF,
      new: newF,
      diffStatus,
      savingsDelta,
    };
  });
}

function StatusPill({ status }: { status: AuditFinding['status'] }) {
  const map: Record<AuditFinding['status'], { label: string; cls: string }> = {
    overspending: { label: '⚠ Overspending', cls: 'bg-red-50 border-red-300 text-red-700' },
    suboptimal:   { label: '~ Suboptimal',   cls: 'bg-amber-50 border-amber-300 text-amber-700' },
    optimal:      { label: '✓ Optimal',      cls: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-block font-mono text-[8px] uppercase tracking-widest border px-1.5 py-0.5 ${cls}`}>
      {label}
    </span>
  );
}

function DiffRow({ diff, expanded, onToggle }: {
  diff: FindingDiff;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isChanged = diff.diffStatus !== 'unchanged';

  const rowBg = isChanged
    ? diff.diffStatus === 'improved'
      ? 'bg-emerald-50/50 border-emerald-200'
      : diff.diffStatus === 'worsened'
      ? 'bg-red-50/50 border-red-200'
      : 'bg-amber-50/30 border-amber-200'
    : 'bg-white border-slate-200';

  const deltaIcon =
    diff.diffStatus === 'improved' ? (
      <TrendingDown size={12} className="text-emerald-500" />
    ) : diff.diffStatus === 'worsened' ? (
      <TrendingUp size={12} className="text-red-500" />
    ) : (
      <Minus size={12} className="text-slate-400" />
    );

  return (
    <div className={`border rounded mb-2 transition-all ${rowBg}`}>
      {/* Row header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {deltaIcon}
        <span className="font-mono text-xs font-bold text-slate-800 flex-1">
          {diff.toolName}
        </span>

        {/* Old status → new status */}
        <div className="flex items-center gap-2 shrink-0">
          {diff.old ? <StatusPill status={diff.old.status} /> : <span className="font-mono text-[8px] text-slate-400">—</span>}
          <ArrowRight size={10} className="text-slate-400" />
          {diff.new ? <StatusPill status={diff.new.status} /> : <span className="font-mono text-[8px] text-slate-400">removed</span>}
        </div>

        {/* Savings delta */}
        {diff.diffStatus !== 'unchanged' && (
          <span className={`font-mono text-xs font-bold ml-3 ${diff.savingsDelta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {diff.savingsDelta > 0 ? '+' : ''}{diff.savingsDelta.toFixed(0)}/mo
          </span>
        )}

        {expanded ? <ChevronUp size={12} className="text-slate-500 ml-2" /> : <ChevronDown size={12} className="text-slate-500 ml-2" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-200 grid grid-cols-2 divide-x divide-slate-200">
          <div className="p-4 space-y-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500 mb-2">Previous recommendation</p>
            {diff.old ? (
              <>
                <p className="font-mono text-[10px] text-slate-700">{diff.old.recommendation}</p>
                <p className="font-mono text-[9px] text-slate-500 italic">{diff.old.reason}</p>
                <p className="font-mono text-[10px] text-slate-600 mt-1">${diff.old.currentSpend}/mo current · saves ${diff.old.monthlySavings.toFixed(0)}/mo</p>
              </>
            ) : (
              <p className="font-mono text-[10px] text-slate-400 italic">Not in previous audit</p>
            )}
          </div>
          <div className="p-4 space-y-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500 mb-2">New recommendation</p>
            {diff.new ? (
              <>
                <p className="font-mono text-[10px] text-slate-700">{diff.new.recommendation}</p>
                <p className="font-mono text-[9px] text-slate-500 italic">{diff.new.reason}</p>
                <p className="font-mono text-[10px] text-slate-600 mt-1">${diff.new.currentSpend}/mo current · saves ${diff.new.monthlySavings.toFixed(0)}/mo</p>
              </>
            ) : (
              <p className="font-mono text-[10px] text-slate-400 italic">Not in new audit</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiffView({ oldAudit, newAudit, onReRunFull }: DiffViewProps) {
  const diffs = computeDiffs(oldAudit.findings, newAudit.findings);
  const changed = diffs.filter(d => d.diffStatus !== 'unchanged');
  const unchanged = diffs.filter(d => d.diffStatus === 'unchanged');

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(changed.map(d => d.toolId)),
  );
  const [showUnchanged, setShowUnchanged] = useState(false);

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const savingsDelta = newAudit.totalMonthlySavings - oldAudit.totalMonthlySavings;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Headline ───────────────────────────────────────────── */}
      <div className="border border-slate-800 bg-slate-950 p-8">
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400 mb-3">
          Pricing has changed since your audit
        </div>
        <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-end">
          <div>
            <div className="flex items-end gap-4 mb-2">
              <div className="text-center">
                <div className="font-mono text-[8px] uppercase tracking-widest text-slate-500 mb-1">Was</div>
                <div className="font-mono font-bold text-slate-500 text-4xl">
                  ${oldAudit.totalMonthlySavings.toFixed(0)}<span className="text-base font-normal">/mo</span>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-600 mb-2" />
              <div className="text-center">
                <div className="font-mono text-[8px] uppercase tracking-widest text-emerald-400 mb-1">Now</div>
                <div className="font-mono font-bold text-slate-100 text-6xl">
                  ${newAudit.totalMonthlySavings.toFixed(0)}<span className="text-2xl font-normal text-slate-400">/mo</span>
                </div>
              </div>
            </div>
            <div className={`font-serif italic text-lg ${savingsDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {savingsDelta >= 0 ? '+' : ''}{savingsDelta.toFixed(0)}/mo vs. your previous audit
            </div>
          </div>

          <button
            onClick={onReRunFull}
            className="ml-auto bg-emerald-500 text-black font-mono font-bold uppercase tracking-[0.2em] text-xs px-6 py-3 flex items-center gap-2 hover:bg-emerald-400 transition-colors shrink-0"
          >
            Re-Run Full Audit <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Changed findings ────────────────────────────────────── */}
      {changed.length > 0 && (
        <section>
          <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-600 flex items-center gap-2 mb-4">
            <div className="w-4 h-px bg-slate-800" />
            {changed.length} recommendation{changed.length !== 1 ? 's' : ''} changed
            <div className="flex-1 h-px bg-slate-800" />
          </h2>
          {changed.map(diff => (
            <DiffRow
              key={diff.toolId}
              diff={diff}
              expanded={expandedIds.has(diff.toolId)}
              onToggle={() => toggleExpanded(diff.toolId)}
            />
          ))}
        </section>
      )}

      {/* ── Unchanged findings ──────────────────────────────────── */}
      {unchanged.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowUnchanged(v => !v)}
            className="w-full flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-500 hover:text-slate-700 transition-colors mb-2"
          >
            <div className="w-4 h-px bg-slate-800" />
            {unchanged.length} unchanged tool{unchanged.length !== 1 ? 's' : ''}
            {showUnchanged ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            <div className="flex-1 h-px bg-slate-800" />
          </button>
          {showUnchanged && (
            <div className="opacity-60">
              {unchanged.map(diff => (
                <DiffRow
                  key={diff.toolId}
                  diff={diff}
                  expanded={expandedIds.has(diff.toolId)}
                  onToggle={() => toggleExpanded(diff.toolId)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Re-run CTA ──────────────────────────────────────────── */}
      <div className="border border-slate-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-mono font-bold uppercase tracking-tight text-slate-800">Want to adjust your inputs?</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mt-1">
            Start a fresh audit with updated team size or tools.
          </p>
        </div>
        <button
          onClick={onReRunFull}
          className="bg-black text-white font-mono font-bold uppercase tracking-[0.2em] text-xs px-6 py-3 flex items-center gap-2 hover:bg-slate-800 transition-colors shrink-0"
        >
          New Audit <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}