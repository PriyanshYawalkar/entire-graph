import React, { useState, useEffect } from 'react';
import { Network, ArrowRight, ArrowDownLeft, ArrowUpRight, Search, Layers, FileCode, Check } from 'lucide-react';
import { CodeSymbol, CodeRelation, RelationType } from '../types';

interface GraphVisualizerProps {
  initialSymbol?: string;
  onInspectImpact: (symbolName: string) => void;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ initialSymbol = 'ExecuteSearch', onInspectImpact }) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
  const [direction, setDirection] = useState<'both' | 'in' | 'out'>('both');
  const [depth, setDepth] = useState<number>(1);
  const [relation, setRelation] = useState<RelationType | 'ALL'>('CALLS');
  const [symbolData, setSymbolData] = useState<{
    targetSymbol?: CodeSymbol;
    incoming: (CodeRelation & { fromSymbol?: CodeSymbol })[];
    outgoing: (CodeRelation & { toSymbol?: CodeSymbol })[];
  }>({ incoming: [], outgoing: [] });
  const [allSymbols, setAllSymbols] = useState<CodeSymbol[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/graph/symbols')
      .then(res => res.json())
      .then(data => setAllSymbols(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    setLoading(true);
    fetch(`/api/graph/neighbors?symbol=${encodeURIComponent(selectedSymbol)}&direction=${direction}&depth=${depth}&relation=${relation}`)
      .then(res => res.json())
      .then(data => {
        setSymbolData(data);
      })
      .catch(err => console.error('Failed to fetch neighbors', err))
      .finally(() => setLoading(false));
  }, [selectedSymbol, direction, depth, relation]);

  const target = symbolData.targetSymbol;

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Symbol Neighbors & Relational Graph</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-semibold">
              entire graph neighbors
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct incoming/outgoing relations (CALLS, IMPORTS, EXTENDS, USES_TYPE) with call site definitions.
          </p>
        </div>

        {/* Quick Symbol Switcher */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-600 font-medium font-mono">Symbol:</span>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono font-medium focus:outline-none focus:border-indigo-500 shadow-xs"
          >
            {allSymbols.map(s => (
              <option key={s.id} value={s.name}>
                {s.qualifiedName} ({s.kind})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Direction */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Direction:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
              {(['both', 'in', 'out'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] capitalize transition-colors ${
                    direction === d ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d === 'in' ? 'Incoming (Callers)' : d === 'out' ? 'Outgoing (Callees)' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          {/* Depth */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Depth:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
              {[1, 2].map(d => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                    depth === d ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d} Hop{d > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Relation Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Relation:</span>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value as any)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono text-[11px] shadow-xs"
            >
              <option value="CALLS">CALLS</option>
              <option value="USES_TYPE">USES_TYPE</option>
              <option value="IMPORTS">IMPORTS</option>
              <option value="ALL">ALL RELATIONS</option>
            </select>
          </div>
        </div>

        {target && (
          <button
            onClick={() => onInspectImpact(target.name)}
            className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-mono text-xs flex items-center gap-1.5 transition-colors font-semibold shadow-xs"
          >
            <span>Analyze Blast Radius for {target.name}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Visual Interactive Graph Canvas */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 min-h-[440px] flex flex-col justify-center items-center relative overflow-hidden shadow-xs">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 font-mono text-sm">
            <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Tracing graph paths...</span>
          </div>
        ) : target ? (
          <div className="w-full max-w-4xl relative z-10 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              {/* Incoming Callers Column */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-600 font-semibold flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-indigo-600" />
                  <span>Callers (Incoming)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {symbolData.incoming.length}
                  </span>
                </div>

                {symbolData.incoming.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs font-mono text-center bg-white/60">
                    No incoming callers at depth {depth}
                  </div>
                ) : (
                  symbolData.incoming.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => setSelectedSymbol(rel.fromName)}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 cursor-pointer transition-all space-y-1 shadow-xs group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {rel.fromName}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {rel.relation}
                        </span>
                      </div>
                      {rel.callSite && (
                        <p className="text-[11px] font-mono text-slate-500 truncate">
                          {rel.callSite.filePath}:{rel.callSite.line}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Center Target Node */}
              <div className="flex flex-col items-center">
                <div className="w-full p-5 rounded-2xl border-2 border-indigo-600 bg-white shadow-md text-center space-y-2 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs">
                    Target Symbol
                  </div>
                  <div className="font-mono text-base font-bold text-slate-900">{target.name}</div>
                  <div className="text-xs font-mono text-indigo-600 font-semibold">{target.qualifiedName}</div>
                  <div className="text-[11px] font-mono text-slate-500 pt-1 flex items-center justify-center gap-2">
                    <span>{target.filePath}:{target.lineStart}</span>
                    <span>•</span>
                    <span className="capitalize">{target.kind}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 text-left line-clamp-2">
                    {target.docComment || target.signature}
                  </div>
                </div>
              </div>

              {/* Outgoing Callees Column */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-600 font-semibold flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-indigo-600" />
                  <span>Callees (Outgoing)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {symbolData.outgoing.length}
                  </span>
                </div>

                {symbolData.outgoing.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs font-mono text-center bg-white/60">
                    No outgoing calls found
                  </div>
                ) : (
                  symbolData.outgoing.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => setSelectedSymbol(rel.toName)}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 cursor-pointer transition-all space-y-1 shadow-xs group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {rel.toName}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {rel.relation}
                        </span>
                      </div>
                      {rel.callSite && (
                        <p className="text-[11px] font-mono text-slate-500 truncate">
                          calls {rel.toName}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Symbol Code Inspector */}
      {target && (
        <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-600" />
              <span>Source Definition: {target.name}</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {target.filePath}:{target.lineStart}-{target.lineEnd}
            </span>
          </div>
          <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-100 overflow-x-auto leading-relaxed scrollbar-thin shadow-xs">
            {target.bodySnippet}
          </pre>
        </div>
      )}
    </div>
  );
};
