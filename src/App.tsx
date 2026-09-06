import React, { useState } from 'react';
import { Header } from './components/Header';
import { SentryGraphDashboard } from './components/SentryGraphDashboard';
import { SearchPanel } from './components/SearchPanel';
import { GraphVisualizer } from './components/GraphVisualizer';
import { ImpactAnalyzer } from './components/ImpactAnalyzer';
import { SymbolsExplorer } from './components/SymbolsExplorer';
import { DiffRiskViewer } from './components/DiffRiskViewer';
import { TerminalRunner } from './components/TerminalRunner';
import { BenchmarkComparison } from './components/BenchmarkComparison';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('sentry');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ExecuteSearch');

  const handleInspectSymbol = (name: string) => {
    setSelectedSymbol(name);
    setActiveTab('graph');
  };

  const handleInspectImpact = (name: string) => {
    setSelectedSymbol(name);
    setActiveTab('impact');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'sentry' && (
          <SentryGraphDashboard />
        )}

        {activeTab === 'search' && (
          <SearchPanel
            onInspectSymbol={handleInspectSymbol}
            onInspectImpact={handleInspectImpact}
          />
        )}

        {activeTab === 'graph' && (
          <GraphVisualizer
            initialSymbol={selectedSymbol}
            onInspectImpact={handleInspectImpact}
          />
        )}

        {activeTab === 'impact' && (
          <ImpactAnalyzer
            initialSymbol={selectedSymbol}
            onInspectNeighbors={handleInspectSymbol}
          />
        )}

        {activeTab === 'symbols' && (
          <SymbolsExplorer
            onInspectNeighbors={handleInspectSymbol}
            onInspectImpact={handleInspectImpact}
          />
        )}

        {activeTab === 'diff' && (
          <DiffRiskViewer />
        )}

        {activeTab === 'terminal' && (
          <TerminalRunner />
        )}

        {activeTab === 'benchmarks' && (
          <BenchmarkComparison />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            entire-graph • Offline static code analysis provider for coding agents
          </div>
          <div className="flex items-center gap-3">
            <span>Schema v1.x (frozen)</span>
            <span>•</span>
            <span>No Egress / No Models</span>
            <span>•</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Port 3000 Active
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
