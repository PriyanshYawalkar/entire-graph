import React, { useState, useEffect } from 'react';
import { Search, FileCode, Filter, ExternalLink, Code } from 'lucide-react';
import { CodeSymbol, SymbolKind } from '../types';

interface SymbolsExplorerProps {
  onInspectNeighbors: (symbolName: string) => void;
  onInspectImpact: (symbolName: string) => void;
}

export const SymbolsExplorer: React.FC<SymbolsExplorerProps> = ({ onInspectNeighbors, onInspectImpact }) => {
  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<string>('ALL');
  const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbol | null>(null);

  useEffect(() => {
    fetch('/api/graph/symbols')
      .then(res => res.json())
      .then(data => {
        setSymbols(data);
        if (data.length > 0) setSelectedSymbol(data[0]);
      })
      .catch(console.error);
  }, []);

  const filteredSymbols = symbols.filter(s => {
    const matchesQuery = s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.filePath.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.signature.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesKind = selectedKind === 'ALL' || s.kind === selectedKind;
    return matchesQuery && matchesKind;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Symbol Inventory & Definitions</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-semibold">
              entire graph symbols
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full inventory of functions, methods, structs, and interfaces parsed with tree-sitter.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500">
          Total Symbols: <strong className="text-slate-900 font-bold">{symbols.length}</strong>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter symbols or file paths..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600 font-medium font-mono">Kind:</span>
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono text-xs shadow-xs"
          >
            <option value="ALL">ALL KINDS</option>
            <option value="function">function</option>
            <option value="method">method</option>
            <option value="struct">struct</option>
            <option value="interface">interface</option>
          </select>
        </div>
      </div>

      {/* Master Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Symbols List */}
        <div className="border border-slate-200 rounded-xl bg-white p-3 space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin shadow-xs">
          {filteredSymbols.map(sym => {
            const isSelected = selectedSymbol?.id === sym.id;
            return (
              <div
                key={sym.id}
                onClick={() => setSelectedSymbol(sym)}
                className={`p-3 rounded-lg border cursor-pointer transition-all space-y-1.5 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900 truncate">
                    {sym.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 capitalize font-medium">
                    {sym.kind}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  {sym.filePath}:{sym.lineStart}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Symbol Details */}
        <div className="lg:col-span-2 border border-slate-200 rounded-xl bg-white p-5 space-y-4 shadow-xs">
          {selectedSymbol ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-base font-bold text-slate-900">
                      {selectedSymbol.name}
                    </h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize font-medium">
                      {selectedSymbol.kind}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-indigo-600 font-semibold mt-1">
                    {selectedSymbol.qualifiedName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onInspectNeighbors(selectedSymbol.name)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-medium transition-colors"
                  >
                    View Callers
                  </button>
                  <button
                    onClick={() => onInspectImpact(selectedSymbol.name)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-mono font-semibold transition-colors shadow-xs"
                  >
                    Blast Radius
                  </button>
                </div>
              </div>

              {/* Signature */}
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                  Signature
                </span>
                <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 overflow-x-auto font-medium">
                  {selectedSymbol.signature}
                </pre>
              </div>

              {/* Doc Comment */}
              {selectedSymbol.docComment && (
                <div className="space-y-1">
                  <span className="text-[11px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                    Doc Comment
                  </span>
                  <p className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans">
                    {selectedSymbol.docComment}
                  </p>
                </div>
              )}

              {/* Implementation Snippet */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                    Source Range ({selectedSymbol.lineStart}-{selectedSymbol.lineEnd})
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                    {selectedSymbol.filePath}
                  </span>
                </div>
                <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-100 overflow-x-auto leading-relaxed scrollbar-thin max-h-[280px] shadow-xs">
                  {selectedSymbol.bodySnippet}
                </pre>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 text-xs py-12">
              Select a symbol to inspect its declaration and source.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
