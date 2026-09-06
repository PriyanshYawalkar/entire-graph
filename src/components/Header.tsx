import React from 'react';
import { Network, ShieldCheck, Zap, Terminal, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'sentry', label: 'SentryGraph Security', icon: '🛡️' },
    { id: 'search', label: 'Search & Locate', icon: '🔍' },
    { id: 'graph', label: 'Graph & Callers', icon: '🕸️' },
    { id: 'impact', label: 'Impact Radius', icon: '💥' },
    { id: 'symbols', label: 'Symbol Inventory', icon: '📇' },
    { id: 'diff', label: 'Diff & Risk', icon: '🧬' },
    { id: 'terminal', label: 'Agent CLI Terminal', icon: '💻' },
    { id: 'benchmarks', label: 'Benchmarks (LoCoMo)', icon: '📊' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-xs">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">entire-graph</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-medium">
                  v0.4.0
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-medium">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  0 Index Tokens
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Offline Code Graph & AST Search for Coding Agents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>LoCoMo: <strong className="text-slate-900 font-semibold">94.74 (#1)</strong></span>
              </div>
              <div className="w-px h-3 bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Latency: <strong className="text-slate-900 font-semibold">~14ms</strong></span>
              </div>
            </div>

            <button
              onClick={() => onTabChange('terminal')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>CLI Workbench</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-100">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
