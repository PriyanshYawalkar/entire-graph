import React, { useState } from 'react';
import { Terminal as TermIcon, Play, Copy, Check, Sparkles } from 'lucide-react';

export const TerminalRunner: React.FC = () => {
  const [command, setCommand] = useState('entire graph search --query "AST parser" --profile full --format agent');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const presets = [
    { label: 'Search (Agent Format)', cmd: 'entire graph search --query "how is search executed" --format agent' },
    { label: 'Impact Blast Radius', cmd: 'entire graph impact --symbol sem.ParseTreeSitterAST --depth 2' },
    { label: 'Trace Callers', cmd: 'entire graph neighbors --symbol ExecuteSearch --relation CALLS' },
    { label: 'Entity Diff Risk', cmd: 'entire graph diff --base main --head HEAD' },
    { label: 'Token Savings Stats', cmd: 'entire graph stats --repo .' },
    { label: 'Capabilities', cmd: 'entire graph capabilities' }
  ];

  const runCommand = async (cmdToRun?: string) => {
    const activeCmd = cmdToRun || command;
    setLoading(true);
    try {
      const res = await fetch('/api/graph/cli-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: activeCmd })
      });
      const data = await res.json();
      setOutput(data.output || 'Command executed successfully.');
    } catch (err) {
      setOutput(`Error executing command: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TermIcon className="w-5 h-5 text-indigo-600" />
            <span>Coding Agent CLI Workbench</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test the exact commands and compact telemetry format provided to Claude Code, Cursor, and custom coding agents.
          </p>
        </div>

        <span className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
          CLI Plugin: <strong className="text-indigo-600 font-bold">entire graph</strong>
        </span>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-500 font-medium mr-1">Presets:</span>
        {presets.map((p, i) => (
          <button
            key={i}
            onClick={() => {
              setCommand(p.cmd);
              runCommand(p.cmd);
            }}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5 hover:border-slate-300 font-medium"
          >
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Command Input Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs shadow-2xs">
          <span className="text-indigo-600 font-bold">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runCommand()}
            placeholder="entire graph search --query '...'"
            className="w-full bg-transparent text-slate-900 focus:outline-none placeholder-slate-400 font-mono font-medium"
          />
        </div>
        <button
          onClick={() => runCommand()}
          disabled={loading}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>Execute</span>
        </button>
      </div>

      {/* Terminal Display */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-md">
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs font-mono text-slate-400 ml-2 font-medium">stdout (interactive agent pipe)</span>
          </div>

          <button
            onClick={handleCopy}
            className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <pre className="p-5 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed min-h-[360px] max-h-[500px] scrollbar-thin">
          {output || `$ ${command}\n\n// Press 'Execute' or select a preset to run the command.`}
        </pre>
      </div>
    </div>
  );
};
