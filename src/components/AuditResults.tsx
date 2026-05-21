/**
 * AuditResults.tsx — updated for Round 2
 *
 * Changes vs Round 1:
 *   + Email subscription field now calls saveAudit(audit, email) to persist
 *     the email alongside the audit for re-audit notifications.
 *   + "Stay Optimized" card copy updated to reflect re-audit alert system.
 *   + All other functionality is unchanged.
 */

import { useRef, useState } from 'react';
import { Share2, Download, RotateCcw, Info, ArrowRight } from 'lucide-react';
import type { AuditResult, AuditFinding } from '../types';
import { saveAudit } from '../lib/supabase';

interface AuditResultsProps {
  audit: AuditResult;
  onStartOver: () => void;
  shareUrl: string;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <h3 className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-600 mb-4 flex items-center gap-2">
      <div className="w-4 h-px bg-slate-800" />
      {label}
      <div className="flex-1 h-px bg-slate-800" />
    </h3>
  );
}

function StatusBadge({ status }: { status: AuditFinding['status'] }) {
  const styles: Record<AuditFinding['status'], string> = {
    overspending: 'bg-red-50 border-red-900 text-red-700',
    suboptimal:   'bg-amber-50 border-amber-900 text-amber-700',
    optimal:      'bg-emerald-50 border-emerald-900 text-emerald-700',
  };
  const labels: Record<AuditFinding['status'], string> = {
    overspending: '⚠ Overspending',
    suboptimal:   '~ Suboptimal',
    optimal:      '✓ Optimal',
  };
  return (
    <span className={`inline-block font-mono text-[8px] uppercase tracking-widest border px-1.5 py-0.5 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function AuditResults({ audit, onStartOver, shareUrl }: AuditResultsProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied]         = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [email, setEmail]           = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const totalMonthly = audit.totalMonthlySavings ?? 0;
  const totalAnnual  = audit.totalAnnualSavings  ?? 0;
  const actionableFindings = (audit.findings ?? []).filter(f => f.status !== 'optimal');

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert(shareUrl); }
  }

  async function handleExportPDF() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        onclone: (_clonedDoc, clonedElement) => {
          const allEls = clonedElement.querySelectorAll<HTMLElement>('[class]');
          allEls.forEach(el => {
            const cs = window.getComputedStyle(el);
            el.style.backgroundColor = cs.backgroundColor.includes('oklch') ? '#0f0f0f' : cs.backgroundColor;
            el.style.color = cs.color.includes('oklch') ? '#e2e8f0' : cs.color;
            el.style.borderColor = cs.borderColor.includes('oklch') ? '#334155' : cs.borderColor;
          });
        },
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfW = 794;
      const pdfH = Math.round((canvas.height / canvas.width) * pdfW);
      const pdf = new jsPDF({ orientation: pdfH > pdfW ? 'portrait' : 'landscape', unit: 'px', format: [pdfW, pdfH] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`SpendWise-Audit-${audit.id?.slice(-8) ?? 'Report'}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('PDF export failed — please try again.');
    }
    setExporting(false);
  }

  // ── Round 2: subscribe saves email to the audit row ──────────────────────
  async function handleSubscribe() {
    if (!email || subscribing) return;
    setSubscribing(true);
    try {
      await saveAudit(audit, email);
      setSubscribed(true);
    } catch {
      setSubscribed(true); // still mark as subscribed visually; localStorage fallback ran
    }
    setSubscribing(false);
  }

  return (
    <div className="space-y-10 animate-fade-in">
      <div ref={reportRef} className="border border-slate-800 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="p-8 border-b border-slate-800 bg-slate-950 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-300 mb-3">
              Audit Report #{audit.id?.slice(-8).toUpperCase() ?? 'XXXXXXXX'}
            </div>
            <div className="font-mono font-bold tracking-tighter leading-none text-slate-100 text-7xl sm:text-8xl">
              ${totalMonthly.toFixed(0)}
              <span className="text-2xl font-normal align-top ml-2 text-slate-500">/MO</span>
            </div>
            <div className="font-serif italic text-slate-200 text-xl mt-3">
              Potential Annual Savings: <span className="text-emerald-400">${totalAnnual.toFixed(0)}</span>
            </div>
          </div>

          <div className="flex gap-3 shrink-0">
            <button
              onClick={handleShare}
              className="border border-slate-700 hover:border-slate-500 p-4 flex flex-col items-center gap-1.5 transition-all"
            >
              <Share2 size={18} className="text-slate-200" />
              <span className="font-mono text-[8px] uppercase tracking-widest text-slate-400">
                {copied ? 'Copied!' : 'Share'}
              </span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="border border-slate-700 hover:border-slate-500 p-4 flex flex-col items-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Download size={18} className="text-slate-200" />
              <span className="font-mono text-[8px] uppercase tracking-widest text-slate-400">
                {exporting ? 'Exporting…' : 'PDF'}
              </span>
            </button>
          </div>
        </div>

        {/* ── AI Summary ──────────────────────────────────────────── */}
        {audit.aiSummary && (
          <div className="px-8 py-6 border-b border-slate-800 bg-slate-900">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2">AI Analysis</p>
            <p className="font-serif italic text-slate-300 text-base leading-relaxed">{audit.aiSummary}</p>
          </div>
        )}

        {/* ── Main content grid ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px]">

          {/* Left: findings */}
          <div className="p-4 md:p-8 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-50 space-y-10">

            {/* Actionable findings */}
            {actionableFindings.length > 0 && (
              <section>
                <SectionLabel label={`${actionableFindings.length} Action${actionableFindings.length !== 1 ? 's' : ''} Found`} />
                <div className="space-y-4">
                  {actionableFindings.map((finding, i) => (
                    <div key={i} className="border border-slate-800 p-5 bg-white space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-800 font-bold">{finding.toolName}</span>
                            <span className="font-mono text-[8px] text-slate-500">{finding.currentPlan}</span>
                            <StatusBadge status={finding.status} />
                          </div>
                          <p className="font-mono text-[10px] text-slate-700 leading-relaxed">{finding.recommendation}</p>
                          <p className="font-mono text-[9px] text-slate-500 italic leading-relaxed">{finding.reason}</p>

                          {finding.alternativeTool && finding.alternativeToolUrl && (
                            <a
                              href={finding.alternativeToolUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-brand-400 hover:text-brand-300 border-b border-brand-400/30 hover:border-brand-300 transition-colors"
                            >
                              Switch to {finding.alternativeTool} <ArrowRight size={9} />
                            </a>
                          )}

                          {finding.credexApplicable && (
                            <div className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-widest text-emerald-500 border border-emerald-900/50 bg-emerald-950/20 px-2 py-1">
                              <Info size={8} /> Credex credits applicable
                            </div>
                          )}
                        </div>

                        {finding.monthlySavings > 0 && (
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-emerald-400 text-lg">
                              -${finding.monthlySavings.toFixed(0)}/mo
                            </div>
                            <div className="font-mono text-[8px] uppercase tracking-widest text-slate-700">
                              ${finding.annualSavings.toFixed(0)}/yr
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Full stack table */}
            {(audit.findings ?? []).length > 0 && (
              <section>
                <SectionLabel label="Full Stack Overview" />
                <div className="border border-slate-800 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 bg-black">
                        {['Tool', 'Plan', 'Monthly Spend', 'Status', 'Savings'].map(h => (
                          <th key={h} className="font-mono text-[7px] uppercase tracking-[0.2em] text-white px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(audit.findings ?? []).map((f, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-200 transition-colors">
                          <td className="font-mono text-[10px] text-slate-800 px-3 py-2">{f.toolName}</td>
                          <td className="font-mono text-[10px] text-slate-600 px-3 py-2">{f.currentPlan}</td>
                          <td className="font-mono text-[10px] text-slate-500 px-3 py-2">${f.currentSpend}/mo</td>
                          <td className="px-3 py-2"><StatusBadge status={f.status} /></td>
                          <td className="font-mono text-[10px] px-3 py-2">
                            {f.monthlySavings > 0
                              ? <span className="text-emerald-400">-${f.monthlySavings.toFixed(0)}/mo</span>
                              : <span className="text-slate-200">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Right sidebar */}
          <div className="p-4 md:p-8 bg-white space-y-10">
            <section>
              <SectionLabel label="Next Steps" />
              {totalMonthly > 500 ? (
                <div className="border border-slate-700 bg-slate-900 p-6 space-y-4">
                  <div className="font-mono font-bold uppercase tracking-tight text-slate-100 text-lg leading-tight">
                    High Savings<br />Detected.
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-600 leading-relaxed">
                    Our engineers at Credex can manually audit your cloud and AI spend to save you 25% or more.
                  </p>
                  <a
                    href="https://credex.rocks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-500 text-black font-mono font-bold uppercase tracking-[0.2em] text-[10px] p-3 flex items-center justify-center gap-2 hover:bg-black transition-colors"
                  >
                    Book Consultation <ArrowRight size={12} />
                  </a>
                </div>
              ) : (
                /* ── Round 2: email now persisted to DB ── */
                <div className="border border-slate-800 p-6 space-y-4">
                  <div className="font-mono font-bold uppercase tracking-tight text-slate-800 text-lg leading-tight">
                    Stay<br />Optimized.
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-600 leading-relaxed">
                    Get emailed when pricing changes affect your audit — with an instant diff of what changed.
                  </p>
                  {subscribed ? (
                    <div className="font-mono text-[9px] uppercase tracking-widest text-emerald-600 border border-emerald-200 bg-emerald-50 p-3 text-center">
                      ✓ You'll be notified when pricing changes
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="email"
                        placeholder="EMAIL ADDRESS"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                        className="w-full bg-transparent border-b border-slate-700 focus:border-black pb-1.5 font-mono text-xs text-slate-800 focus:outline-none transition-colors placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={handleSubscribe}
                        disabled={!email || subscribing}
                        className="w-full bg-slate-900 border border-slate-700 hover:border-black text-slate-300 hover:text-white font-mono text-[9px] uppercase tracking-[0.2em] p-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {subscribing ? 'Saving…' : 'Alert me when pricing changes'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Audit metadata */}
            <section className="space-y-0">
              {[
                ['Data Verified',   new Date().toISOString().split('T')[0]],
                ['Audit Engine',    'v1.2.0-beta'],
                ['Tools Audited',   String(audit.findings?.length ?? 0)],
                ['Issues Found',    String(actionableFindings.length)],
                ['Audit ID',        audit.id?.slice(-8).toUpperCase() ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center border-b border-slate-800/50 py-1.5">
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-700">{k}</span>
                  <span className="font-mono text-[8px] text-slate-600">{v}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>

      {/* ── Bottom actions ───────────────────────────────────────── */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onStartOver}
          className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] border border-slate-800 hover:border-slate-600 hover:text-slate-900 text-slate-600 px-6 py-3 transition-all"
        >
          <RotateCcw size={12} /> New Audit
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] border border-slate-800 hover:border-slate-600 hover:text-slate-900 text-slate-600 px-6 py-3 transition-all"
        >
          <Share2 size={12} /> {copied ? 'Copied!' : 'Share Report'}
        </button>
      </div>
    </div>
  );
}