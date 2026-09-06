import React, { useState } from 'react';
import { Search, SlidersHorizontal, ArrowRight, Play, CheckCircle2, AlertCircle, FileCode } from 'lucide-react';
import { SearchMatch } from '../types';

interface SearchPanelProps {
  onInspectSymbol: (symbolName: string) => void;
  onInspectImpact: (symbolName: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onInspectSymbol, onInspectImpact }) => {
  const [query, setQuery] = useState('execute search AST query');
  const [profile, setProfile] = useState<'fast' | 'full' | 'syntax-only'>('full');
  const [format, setFormat] = useState<'agent' | 'text' | 'json'>('agent');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [rawOutput, setRawOutput] = useState<string>('');
  const [verifyCmd, setVerifyCmd] = useState<string>('go test ./... -run TestSearch');

  const handleSearch = async (overrideQ?: string) => {
    const q = overrideQ !== undefined ? overrideQ : query;
    setLoading(true);
    try {
      const res = await fetch('/api/graph/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          profile,
          format,
          topK,
          maxContextBytes: 4096
        })
      });
      const data = await res.json();
      if (data.matches) {
        setResults(data.matches);
      }
      if (data.output) {
        setRawOutput(data.output);
      } else {
        setRawOutput(JSON.stringify(data, null, 2));
      }
      if (data.verifyCommand) {
        setVerifyCmd(data.verifyCommand);
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
    }
  };

  // Run initial search
  React.useEffect(() => {
    handleSearch('execute search');
  }, []);

  const sampleQueries = [
    'ExecuteSearch AST query',
    'parse tree sitter grammar',
    'compute impact radius callers',
    'compact snapshot NDJSON',
    'diff analyze dependent count'
  ];

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Hybrid AST & Ranked Semantic Search</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-medium">
              Working Tree Default
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked source regions for coding agent tasks. Searches bodies, camelCase identifiers, signatures, and graph neighbors.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="font-semibold text-indigo-700">Resolution First</span>
          <span className="text-slate-300">•</span>
          <span>No Model Calls</span>
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code in plain language (e.g., 'where is search executed', 'tree-sitter parse')..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>Search</span>
          </button>
        </form>

        {/* Quick query chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-500 font-medium mr-1">Try:</span>
          {sampleQueries.map((sq) => (
            <button
              key={sq}
              onClick={() => {
                setQuery(sq);
                handleSearch(sq);
              }}
              className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Controls: Profile, Format, Top-K */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium">Profile:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                {(['fast', 'full', 'syntax-only'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProfile(p)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
                      profile === p ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Output Format:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                {(['agent', 'text', 'json'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
                      format === fmt ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Top-K:</span>
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 font-mono text-[11px] shadow-xs"
              >
                <option value={3}>3 hits</option>
                <option value={5}>5 hits</option>
                <option value={8}>8 hits</option>
                <option value={15}>15 hits</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono font-medium">
            Byte-budgeted context output
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranked Hits List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Ranked Hits</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-semibold">
                {results.length} found
              </span>
            </h3>
            {verifyCmd && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>VERIFY: {verifyCmd}</span>
              </div>
            )}
          </div>

          {results.length === 0 ? (
            <div className="p-8 text-center border border-slate-200 rounded-xl bg-white text-slate-500 shadow-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" />
              <p className="text-sm">No matches found for query. Try another search query above.</p>
            </div>
          ) : (
            results.map((hit, idx) => (
              <div
                key={hit.symbolId}
                className="border border-slate-200 rounded-xl bg-white hover:border-slate-300 transition-all p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-indigo-700 font-bold">#{idx + 1}</span>
                      <span className="font-bold text-sm text-slate-900 font-mono">{hit.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        hit.confidence === 'HIGH'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {hit.confidence} CONFIDENCE
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {hit.kind}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
                      <FileCode className="w-3.5 h-3.5 text-slate-400" />
                      <span>{hit.filePath}:{hit.line}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onInspectSymbol(hit.name)}
                      className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono flex items-center gap-1 transition-colors font-medium"
                      title="View callers and callees"
                    >
                      <span>Callers</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onInspectImpact(hit.name)}
                      className="text-xs px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-mono flex items-center gap-1 transition-colors font-semibold"
                      title="Analyze blast radius"
                    >
                      <span>Impact</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Signature */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 overflow-x-auto font-medium">
                  {hit.signature}
                </div>

                {/* Snippet */}
                <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-100 overflow-x-auto leading-relaxed scrollbar-thin">
                  {hit.matchedSnippet}
                </pre>

                {/* Callers & Callees hints */}
                {(hit.callers?.length || hit.callees?.length) ? (
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500 pt-1">
                    {hit.callers && hit.callers.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700">Callers ({hit.callers.length}):</span>{' '}
                        <span className="text-slate-600">{hit.callers.join(', ')}</span>
                      </div>
                    )}
                    {hit.callees && hit.callees.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700">Callees ({hit.callees.length}):</span>{' '}
                        <span className="text-slate-600">{hit.callees.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Agent Raw Output Console */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Agent Output Preview</span>
              <span className="text-xs font-mono text-slate-500 font-normal">
                ({format} format)
              </span>
            </h3>
            <span className="text-[11px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Ready for Agent Context
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-100 overflow-x-auto whitespace-pre leading-relaxed h-[520px] scrollbar-thin shadow-xs">
            {rawOutput || '// Run a search query to view agent context payload'}
          </div>
        </div>
      </div>
    </div>
  );
};
