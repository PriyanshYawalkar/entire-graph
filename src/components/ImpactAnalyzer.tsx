import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, Flame, GitCommit, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { ImpactAnalysis, CodeSymbol } from '../types';

interface ImpactAnalyzerProps {
  initialSymbol?: string;
  onInspectNeighbors: (symbolName: string) => void;
}

export const ImpactAnalyzer: React.FC<ImpactAnalyzerProps> = ({ initialSymbol = 'ParseTreeSitterAST', onInspectNeighbors }) => {
  const [symbolName, setSymbolName] = useState(initialSymbol);
  const [allSymbols, setAllSymbols] = useState<CodeSymbol[]>([]);
  const [impactData, setImpactData] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/graph/symbols')
      .then(res => res.json())
      .then(data => setAllSymbols(data))
      .catch(console.error);
  }, []);

  const loadImpact = (name: string) => {
    setLoading(true);
    fetch(`/api/graph/impact?symbol=${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => setImpactData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadImpact(symbolName);
  }, [symbolName]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>One-Shot Blast Radius & Impact Analysis</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono font-semibold">
              entire graph impact
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Everything known about modifying a symbol: callers, type consumers, historical Git co-changes, and verification suite.
          </p>
        </div>

        {/* Symbol Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium font-mono">Target:</span>
          <select
            value={symbolName}
            onChange={(e) => setSymbolName(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono font-medium focus:outline-none focus:border-indigo-500 shadow-xs"
          >
            {allSymbols.map(s => (
              <option key={s.id} value={s.name}>
                {s.qualifiedName} ({s.dependentsCount || 0} deps)
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-sm flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Computing blast radius...</span>
        </div>
      ) : impactData ? (
        <div className="space-y-6">
          {/* Risk Overview Card */}
          <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold font-mono text-slate-900">
                    {impactData.targetSymbol.qualifiedName}
                  </h3>
                  <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${getRiskColor(impactData.riskScore)}`}>
                    {impactData.riskScore} RISK
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {impactData.targetSymbol.filePath}:{impactData.targetSymbol.lineStart} • {impactData.targetSymbol.signature}
                </p>
              </div>

              {impactData.verifyCommand && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 font-mono text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-emerald-700 block font-bold">VERIFICATION REQUIREMENT</span>
                    <span className="font-semibold">{impactData.verifyCommand}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950">Blast Radius Assessment: </span>
                <span className="text-amber-900">{impactData.riskJustification}</span>
              </div>
            </div>
          </div>

          {/* Impact Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Direct & Transitive Callers */}
            <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Callers at Risk</span>
                </h4>
                <span className="text-xs font-mono text-slate-500 font-medium">
                  {impactData.directCallers.length + impactData.transitiveCallers.length} total
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-mono text-slate-500 font-medium">DIRECT (depth=1):</div>
                {impactData.directCallers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No direct callers</p>
                ) : (
                  impactData.directCallers.map(c => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-slate-900">{c.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{c.filePath}:{c.lineStart}</div>
                      </div>
                      <button
                        onClick={() => onInspectNeighbors(c.name)}
                        className="text-[11px] font-mono text-indigo-600 font-semibold hover:underline flex items-center gap-0.5"
                      >
                        inspect <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))
                )}

                {impactData.transitiveCallers.length > 0 && (
                  <>
                    <div className="text-[11px] font-mono text-slate-500 font-medium pt-2">TRANSITIVE (depth=2):</div>
                    {impactData.transitiveCallers.map(c => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-200/80 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono text-xs text-slate-800 font-medium">{c.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{c.filePath}:{c.lineStart}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Type Consumers & Callees */}
            <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>Type Consumers & Callees</span>
                </h4>
                <span className="text-xs font-mono text-slate-500 font-medium">
                  {impactData.callees.length + impactData.typeConsumers.length} items
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-mono text-slate-500 font-medium">OUTGOING CALLEES:</div>
                {impactData.callees.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No outgoing callees</p>
                ) : (
                  impactData.callees.map(c => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-slate-900">{c.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{c.filePath}</div>
                      </div>
                    </div>
                  ))
                )}

                <div className="text-[11px] font-mono text-slate-500 font-medium pt-2">TYPE CONSUMERS:</div>
                {impactData.typeConsumers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No external type consumers</p>
                ) : (
                  impactData.typeConsumers.map(c => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-200/80 flex items-center justify-between"
                    >
                      <div className="truncate">
                        <div className="font-mono text-xs text-slate-800 font-medium truncate">{c.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">{c.filePath}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Historical Git Co-Change Files */}
            <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-purple-600" />
                  <span>Historical Co-Changes</span>
                </h4>
                <span className="text-xs font-mono text-slate-500 font-medium">From Git logs</span>
              </div>

              <p className="text-xs text-slate-500">
                Files that statistically change together when this file is modified:
              </p>

              <div className="space-y-2">
                {impactData.coChangeFiles.map((f, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between font-mono text-xs shadow-2xs"
                  >
                    <span className="text-slate-800 font-medium truncate mr-2">{f.path}</span>
                    <span className="text-indigo-600 font-bold text-[11px] shrink-0">
                      {Math.round(f.coChangeFrequency * 100)}% co-change
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
