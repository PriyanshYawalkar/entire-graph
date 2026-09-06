import React, { useState, useEffect } from 'react';
import { GitCompare, AlertTriangle, CheckCircle, ShieldAlert, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DiffEntityChange, VerificationRecord } from '../types';
import { VerificationPromptModal, VerificationTarget } from './VerificationPromptModal';

export const DiffRiskViewer: React.FC = () => {
  const [diffData, setDiffData] = useState<{
    baseRef: string;
    headRef: string;
    changes: DiffEntityChange[];
    riskSummary: {
      totalChanges: number;
      highRiskChanges: number;
      signatureChanges: number;
      recommendation: string;
    };
  } | null>(null);

  const [verificationTarget, setVerificationTarget] = useState<VerificationTarget | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/graph/diff')
      .then(res => res.json())
      .then(data => setDiffData(data))
      .catch(console.error);
  }, []);

  const handleOpenVerification = (ch: DiffEntityChange) => {
    setVerificationTarget({
      id: ch.symbolName,
      title: `${ch.symbolName} (${ch.changeType})`,
      subtitle: ch.filePath,
      filePath: ch.filePath,
      suggestedVerifyCommand: ch.verificationAction,
      suggestedTestName: `Test${ch.symbolName.replace(/[^a-zA-Z0-9]/g, '')}_Regression`,
      existingRecord: ch.verificationRecord,
      partialReason: ch.isPartial ? 'Dynamic dispatch or reflection detected across call chain.' : undefined
    });
    setIsVerificationModalOpen(true);
  };

  const handleSaveVerification = (targetId: string, record: VerificationRecord) => {
    setDiffData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        changes: prev.changes.map(ch => {
          if (ch.symbolName === targetId) {
            return {
              ...ch,
              verificationRecord: record,
              evidenceTier: 'CONFIRMED_STRUCTURAL'
            };
          }
          return ch;
        })
      };
    });
  };

  const handleRevokeVerification = (targetId: string) => {
    setDiffData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        changes: prev.changes.map(ch => {
          if (ch.symbolName === targetId) {
            const copy = { ...ch };
            delete copy.verificationRecord;
            copy.evidenceTier = 'HEURISTIC_INCOMPLETE';
            return copy;
          }
          return ch;
        })
      };
    });
  };

  if (!diffData) {
    return (
      <div className="p-12 text-center text-neutral-400 font-mono text-sm">
        Loading entity change diff...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Entity-Level Diff & Dependent Risk</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-mono font-semibold">
              entire graph diff
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compares working tree against committed HEAD. Flags signature changes that break downstream callers.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-slate-500">Base:</span>
          <span className="text-slate-800 font-semibold">{diffData.baseRef}</span>
          <span className="text-slate-400">→</span>
          <span className="text-slate-500">Head:</span>
          <span className="text-indigo-600 font-bold">{diffData.headRef}</span>
        </div>
      </div>

      {/* Risk Summary Alert */}
      <div className="border border-amber-200 rounded-xl bg-amber-50 p-4 flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-amber-950 font-mono">Change Adjudication</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
              {diffData.riskSummary.highRiskChanges} High Risk Change(s)
            </span>
          </div>
          <p className="text-xs text-amber-900">
            {diffData.riskSummary.recommendation}
          </p>
        </div>
      </div>

      {/* Changes List */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase text-slate-600 font-bold tracking-wider">
          Changed Entities ({diffData.changes.length})
        </h3>

        {diffData.changes.map((ch, idx) => (
          <div
            key={idx}
            className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-xs hover:border-slate-300 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-sm font-bold text-slate-900">{ch.symbolName}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                  ch.changeType === 'SIGNATURE_CHANGED'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : ch.changeType === 'ADDED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {ch.changeType}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {ch.filePath}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                {ch.evidenceTier && (
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                    ch.evidenceTier === 'CONFIRMED_STRUCTURAL'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {ch.evidenceTier === 'CONFIRMED_STRUCTURAL' ? '✓ Structural' : '⚠️ Heuristic (Partial)'}
                  </span>
                )}
                <span className="text-slate-500 font-medium">Dependents:</span>
                <span className={`px-2 py-0.5 rounded-md font-bold ${
                  ch.dependentsCount > 15
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : ch.dependentsCount > 5
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {ch.dependentsCount} callers
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-700">
              {ch.diffSummary}
            </p>

            {ch.isPartial && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Partial Analysis Notice: </span>
                  <span>Dynamic dispatch or reflection detected. Static analysis cannot prove zero blast radius. Execute verification command prior to merge.</span>
                </div>
              </div>
            )}

            {/* Verification Record Card if verified */}
            {ch.verificationRecord && (
              <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Relationship ({ch.verificationRecord.method === 'MANUAL_CONFIRMATION' ? 'Manual Inspection' : 'Automated Test Case'})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenVerification(ch)}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold underline"
                  >
                    Edit / Revoke
                  </button>
                </div>
                <p className="text-slate-600 text-[11px]">
                  {ch.verificationRecord.method === 'MANUAL_CONFIRMATION'
                    ? `Attested by: ${ch.verificationRecord.verifiedBy} — "${ch.verificationRecord.manualRationale}"`
                    : `Linked test: ${ch.verificationRecord.linkedTestCase?.testName} (${ch.verificationRecord.linkedTestCase?.status})`}
                </p>
              </div>
            )}

            {/* Request Verification Action for Heuristic / Partial Items */}
            {(ch.evidenceTier === 'HEURISTIC_INCOMPLETE' || ch.isPartial) && !ch.verificationRecord && (
              <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                <button
                  id={`btn-diff-request-verification-${ch.symbolName.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  type="button"
                  onClick={() => handleOpenVerification(ch)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs hover:shadow transition-all"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Request Verification</span>
                </button>
                <span className="text-[11px] text-slate-500">
                  Confirm relationship manually or link an automated test case
                </span>
              </div>
            )}

            {ch.verificationAction && (
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-indigo-600 font-bold text-[11px]">VERIFY:</span>
                  <code className="text-slate-800 font-semibold truncate">{ch.verificationAction}</code>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(ch.verificationAction || '')}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-700 font-medium shrink-0 transition-colors shadow-2xs"
                >
                  Copy
                </button>
              </div>
            )}

            {ch.oldSignature && ch.newSignature && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-xs font-mono">
                  <div className="text-[10px] text-rose-700 font-bold uppercase mb-1">Old Signature</div>
                  <div className="text-slate-600 line-through truncate">{ch.oldSignature}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs font-mono">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase mb-1">New Signature</div>
                  <div className="text-slate-900 font-semibold truncate">{ch.newSignature}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Verification Prompt Modal */}
      <VerificationPromptModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        target={verificationTarget}
        onSaveVerification={handleSaveVerification}
        onRevokeVerification={handleRevokeVerification}
      />
    </div>
  );
};
