import React, { useState, useEffect } from 'react';
import { Award, Zap, ShieldCheck, Database, CheckCircle2, Info } from 'lucide-react';
import { BenchmarkSystem, GraphStats } from '../types';

export const BenchmarkComparison: React.FC = () => {
  const [data, setData] = useState<{ locomoBenchmarks: BenchmarkSystem[]; stats: GraphStats } | null>(null);

  useEffect(() => {
    fetch('/api/graph/benchmarks')
      .then(res => res.json())
      .then(data => setData(data))
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center text-neutral-400 font-mono text-sm">
        Loading benchmark comparisons...
      </div>
    );
  }

  const { locomoBenchmarks, stats } = data;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>LoCoMo Benchmark Comparison & Token Telemetry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Eight-system LoCoMo evaluation (1,540 questions, shared judge, 200-item retrieval budget).
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>94.74 Score with 0 Index Tokens</span>
        </div>
      </div>

      {/* Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-1 shadow-xs">
          <span className="text-xs text-slate-500 font-mono font-medium">Sessions Analyzed</span>
          <div className="text-2xl font-bold font-mono text-slate-900">{stats.sessionsAnalyzed}</div>
          <span className="text-[11px] text-slate-400">Agent transcripts</span>
        </div>
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-1 shadow-xs">
          <span className="text-xs text-slate-500 font-mono font-medium">Whole-File Reads Saved</span>
          <div className="text-2xl font-bold font-mono text-emerald-600">{stats.grepReadCallsReplaced.toLocaleString()}</div>
          <span className="text-[11px] text-slate-400">Replaced by graph queries</span>
        </div>
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-1 shadow-xs">
          <span className="text-xs text-slate-500 font-mono font-medium">Estimated Tokens Saved</span>
          <div className="text-2xl font-bold font-mono text-indigo-600">~3.88M</div>
          <span className="text-[11px] text-slate-400">Across active coding sessions</span>
        </div>
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-1 shadow-xs">
          <span className="text-xs text-slate-500 font-mono font-medium">Avg Query Latency</span>
          <div className="text-2xl font-bold font-mono text-slate-900">{stats.averageSearchLatencyMs}ms</div>
          <span className="text-[11px] text-slate-400">Local tree-sitter AST</span>
        </div>
      </div>

      {/* Benchmark Table */}
      <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            System Comparison Table
          </h3>
          <span className="text-xs font-mono text-slate-500">Ranked by LoCoMo Score</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">System</th>
                <th className="py-3 px-4 font-bold">LoCoMo Score</th>
                <th className="py-3 px-4 font-bold">Index-Time Tokens</th>
                <th className="py-3 px-4 font-bold">Version Tested</th>
                <th className="py-3 px-4 font-bold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {locomoBenchmarks.map((b, i) => (
                <tr
                  key={i}
                  className={`${b.isEntireGraph ? 'bg-emerald-50/50 font-bold text-slate-900' : 'hover:bg-slate-50/80 transition-colors'}`}
                >
                  <td className="py-3 px-4 flex items-center gap-2">
                    {b.isEntireGraph && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    )}
                    <span>{b.name}</span>
                  </td>
                  <td className="py-3 px-4 font-bold">
                    <div className="flex items-center gap-2">
                      <span className={b.isEntireGraph ? 'text-emerald-700' : 'text-slate-900'}>
                        {b.locomoScore.toFixed(2)}
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full ${b.isEntireGraph ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          style={{ width: `${(b.locomoScore / 100) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={b.tokensNumeric === 0 ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                      {b.indexTokens}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{b.version}</td>
                  <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs">{b.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclosures box */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-slate-900 block">Scientific Transparency & Reproducibility</span>
          <p className="leading-relaxed">
            As documented in <code className="text-indigo-700 font-semibold bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">LOCOMO-COMPARISON.md</code>, the 94.74 benchmark reflects the pre-merge #104 branch tested on 2026-08-14. Unlike systems requiring external model extraction (such as mem0 at 50.85M tokens), entire-graph relies entirely on local tree-sitter AST queries, providing deterministic, zero-egress offline operation.
          </p>
        </div>
      </div>
    </div>
  );
};
