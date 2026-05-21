/**
 * DiffPage.tsx
 *
 * Route: /audit/:id/diff
 *
 * Loads the stored audit (by ID from URL param), re-runs it against current
 * pricing, and renders the DiffView component.
 *
 * This is the page users land on when they click "View Full Diff" in the
 * re-audit notification email.
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TrendingDown } from 'lucide-react';
import type { AuditResult } from '../types';
import DiffView from '../components/DiffView';
import { loadAuditRow } from '../lib/supabase';
import { runAudit } from '../lib/AuditEngine';

export default function DiffPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [oldAudit, setOldAudit] = useState<AuditResult | null>(null);
  const [newAudit, setNewAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) { setNotFound(true); setLoading(false); return; }

      const row = await loadAuditRow(id);
      if (!row) { setNotFound(true); setLoading(false); return; }

      setOldAudit(row.audit);

      // Re-run audit with current pricing
      const reRun = runAudit(row.audit.input);
      setNewAudit(reRun);
      setLoading(false);
    }
    load();
  }, [id]);

  function handleReRunFull() {
    // Navigate to home — SpendForm will be pre-populated from localStorage
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border border-slate-800 border-t-brand-500 animate-spin mx-auto mb-4" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Loading audit diff…
          </p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center border border-slate-800 p-12 bg-white">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="font-mono font-bold text-xl text-slate-800 mb-2 uppercase tracking-wider">
            Audit not found
          </h1>
          <p className="text-slate-600 text-xs font-mono mb-6">
            This audit may have expired or the link is incorrect.
          </p>
          <Link
            to="/"
            className="bg-black text-white font-mono text-xs uppercase tracking-widest px-6 py-3 inline-block hover:bg-slate-800 transition-colors"
          >
            Run your own audit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-black flex flex-col">

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b border-black bg-slate-100/90"
        style={{ backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <TrendingDown size={22} className="text-black" />
            <span className="font-mono font-bold text-[20px] text-black uppercase tracking-tighter">
              SpendWise.
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
              Re-Audit Diff
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest bg-amber-100 border border-amber-300 text-amber-700 px-2 py-0.5 rounded">
              Pricing Updated
            </span>
          </div>
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-10 pb-24 w-full">

        {/* Diff notice */}
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-600 mb-8 border border-slate-800 px-4 py-2.5 bg-white">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
          Pricing changed · comparing your saved audit vs current recommendations
        </div>

        {oldAudit && newAudit && (
          <DiffView
            oldAudit={oldAudit}
            newAudit={newAudit}
            onReRunFull={handleReRunFull}
          />
        )}
      </main>
    </div>
  );
}