import React, { useState, useMemo, ChangeEvent } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Terminal, 
  Play, 
  Upload, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  ArrowRight, 
  AlertTriangle, 
  FileCode, 
  CheckCircle2, 
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { SentryScan, SentryRoute, EvidenceTier, VerificationRecord } from '../types';
import { SENTRY_FIXTURES } from '../data/sentryFixtures';
import { VerificationPromptModal, VerificationTarget } from './VerificationPromptModal';

const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-xs";

export const SentryGraphDashboard: React.FC = () => {
  const [currentScenarioKey, setCurrentScenarioKey] = useState<string>('tokenSanitizer');
  const [scan, setScan] = useState<SentryScan>(SENTRY_FIXTURES.tokenSanitizer.scan);
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState("Showing the included security-review fixture (Token Sanitizer).");
  const [selectedNode, setSelectedNode] = useState<string>('sanitizeToken');
  const [copiedCli, setCopiedCli] = useState(false);
  const [showCustomScanDialog, setShowCustomScanDialog] = useState(false);

  // Verification Prompt Modal state
  const [verificationTarget, setVerificationTarget] = useState<VerificationTarget | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  // Custom scan form state
  const [customSymbol, setCustomSymbol] = useState('sanitizeToken');
  const [customIntent, setCustomIntent] = useState('internal auth refactor only');
  const [customDepth, setCustomDepth] = useState(3);
  const [useDatabricks, setUseDatabricks] = useState(false);
  const [scanningLive, setScanningLive] = useState(false);

  const routes = scan.report.impacted_routes ?? [];
  const tests = scan.report.test_selection?.existing_tests ?? [];
  const risk = scan.intelligence?.risk_score ?? scan.report.local_risk_score;
  const root = scan.report.modified_symbols[0]?.name ?? "selected symbol";
  const modifiedSymbol = scan.report.modified_symbols[0];

  // Derive nodes for the call graph
  const graphNodes = useMemo(() => {
    const intermediate = root === 'sanitizeToken' ? 'processAuth' : root === 'evictSession' ? 'syncSessionCache' : 'evalContext';
    return [
      root,
      intermediate,
      ...routes.map((route) => route.handler_name),
      ...tests.map((test) => test.name)
    ];
  }, [root, routes, tests]);

  const handleRunDemo = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setNotice(`Trace complete: ${routes.length} public surface${routes.length === 1 ? '' : 's'} require review.`);
    }, 650);
  };

  const handleSelectScenario = (key: string) => {
    const scenario = SENTRY_FIXTURES[key];
    if (scenario) {
      setCurrentScenarioKey(key);
      setScan(scenario.scan);
      setSelectedNode(scenario.scan.report.modified_symbols[0]?.name || 'root');
      setNotice(`Loaded scenario: ${scenario.label}.`);
    }
  };

  const handleImportScan = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const imported: SentryScan = raw.report ? raw : {
          report: raw,
          intelligence: {
            risk_score: raw.local_risk_score || 5,
            classifications: ['Imported JSON structure'],
            recommendations: ['Review reachable endpoints manually'],
            source: 'local-rules'
          }
        };
        setScan(imported);
        setSelectedNode(imported.report.modified_symbols?.[0]?.name ?? 'selected symbol');
        setNotice(`Imported ${file.name}. Reviewing live scan evidence.`);
      } catch {
        setNotice("File is not a valid SentryGraph scan report JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleExportScan = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scan, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sentry-scan-${root}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRunLiveScan = async () => {
    setScanningLive(true);
    try {
      const res = await fetch('/api/sentry/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: customSymbol,
          intent: customIntent,
          depth: customDepth,
          databricks: useDatabricks
        })
      });
      if (res.ok) {
        const data: SentryScan = await res.json();
        setScan(data);
        setSelectedNode(data.report.modified_symbols[0]?.name || customSymbol);
        setShowCustomScanDialog(false);
        setNotice(`Live scan executed for "${customSymbol}" with intent "${customIntent}".`);
      } else {
        setNotice("Live scan returned an error. Using current fixture.");
      }
    } catch {
      setNotice("Could not connect to live scan endpoint.");
    } finally {
      setScanningLive(false);
    }
  };

  const cliCommand = `./entire-graph sentry-scan --repo . --symbol ${root} --intent "${scan.report.checkpoint?.intent || 'internal refactor'}" ${scan.intelligence?.source === 'databricks' ? '--databricks ' : ''}--format json`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleOpenVerification = (route: SentryRoute) => {
    const suggestedCmd = route.verification_path?.verifyCommand;
    let suggestedTestName: string | undefined;
    if (suggestedCmd && suggestedCmd.includes('-run ')) {
      suggestedTestName = suggestedCmd.split('-run ')[1]?.trim();
    }
    setVerificationTarget({
      id: `${route.method}-${route.path}`,
      title: `${route.method} ${route.path}`,
      subtitle: route.handler_name,
      filePath: route.verification_path?.sourceRange?.filePath || 'internal/plugins/webhook.go',
      line: route.verification_path?.sourceRange?.startLine,
      confidence: route.confidence,
      partialReason: route.partial_reason,
      suggestedVerifyCommand: suggestedCmd,
      suggestedTestName: suggestedTestName,
      suggestedTestFile: route.verification_path?.testFile,
      existingRecord: route.verification_record
    });
    setIsVerificationModalOpen(true);
  };

  const handleSaveVerification = (targetId: string, record: VerificationRecord) => {
    setScan(prevScan => {
      const updatedRoutes = (prevScan.report.impacted_routes || []).map(r => {
        if (`${r.method}-${r.path}` === targetId) {
          return {
            ...r,
            verification_record: record
          };
        }
        return r;
      });

      const heuristicUnverifiedCount = updatedRoutes.filter(
        r => r.evidence_tier === 'HEURISTIC_INCOMPLETE' && !r.verification_record
      ).length;
      const confirmedTotal = updatedRoutes.filter(
        r => r.evidence_tier === 'CONFIRMED_STRUCTURAL' || !!r.verification_record
      ).length;

      return {
        ...prevScan,
        report: {
          ...prevScan.report,
          impacted_routes: updatedRoutes,
          evidence_breakdown: {
            confirmed_count: confirmedTotal,
            heuristic_count: heuristicUnverifiedCount,
            verification_required_count: updatedRoutes.filter(r => r.regression_state.includes('stub') && !r.verification_record).length
          }
        }
      };
    });

    const desc = record.method === 'MANUAL_CONFIRMATION'
      ? `manual confirmation by ${record.verifiedBy}`
      : `linking test "${record.linkedTestCase?.testName}"`;
    setNotice(`✓ Verified relationship for ${targetId.replace('-', ' ')} via ${desc}.`);
  };

  const handleRevokeVerification = (targetId: string) => {
    setScan(prevScan => {
      const updatedRoutes = (prevScan.report.impacted_routes || []).map(r => {
        if (`${r.method}-${r.path}` === targetId) {
          const updated = { ...r };
          delete updated.verification_record;
          return updated;
        }
        return r;
      });

      const heuristicUnverifiedCount = updatedRoutes.filter(
        r => r.evidence_tier === 'HEURISTIC_INCOMPLETE' && !r.verification_record
      ).length;
      const confirmedTotal = updatedRoutes.filter(
        r => r.evidence_tier === 'CONFIRMED_STRUCTURAL' && !r.verification_record
      ).length;

      return {
        ...prevScan,
        report: {
          ...prevScan.report,
          impacted_routes: updatedRoutes,
          evidence_breakdown: {
            confirmed_count: confirmedTotal,
            heuristic_count: heuristicUnverifiedCount,
            verification_required_count: updatedRoutes.filter(r => r.regression_state.includes('stub')).length
          }
        }
      };
    });
    setNotice(`Reverted verification for ${targetId.replace('-', ' ')} back to heuristic finding.`);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Brand Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-base font-black text-white shadow-xs">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">SentryGraph</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                entire sentinel
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Checkpoint-Aware Security Blast-Radius Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Local Evidence Engine Active</span>
          </div>

          <button
            onClick={() => setShowCustomScanDialog(!showCustomScanDialog)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span>Configure Scan</span>
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wider uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Checkpoint-Aware Security Review</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Prove what a code change can reach.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl font-normal">
            SentryGraph follows a changed symbol through the Entire call graph, exposes every affected API route, and compares the structural evidence with the developer’s declared intent.
          </p>

          {/* Action Row */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleRunDemo}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? "Tracing graph…" : "Run included demo"}</span>
            </button>

            {/* Scenario dropdown */}
            <div className="relative inline-block">
              <select
                value={currentScenarioKey}
                onChange={(e) => handleSelectScenario(e.target.value)}
                className="appearance-none bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
              >
                {Object.entries(SENTRY_FIXTURES).map(([k, sc]) => (
                  <option key={k} value={k}>Scenario: {sc.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>

            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors">
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Import scan JSON</span>
              <input className="hidden" type="file" accept="application/json" onChange={handleImportScan} />
            </label>

            <button
              onClick={handleExportScan}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Export SentryGraph scan report JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500 font-medium">
            Import output from <code className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-slate-800 font-mono">entire graph sentry-scan --format json</code> or run live scans directly.
          </p>
        </div>

        {/* The Evidence Chain Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs relative overflow-hidden">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500 mb-4">
            The Evidence Chain
          </p>
          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700">
                01
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Graph slice</p>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  Reverse CALLS traversal finds every reachable public handler through the code graph.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700">
                02
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Intent check</p>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  Checkpoint claims are tested against actual blast radius to detect unauthorized surface exposure.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700">
                03
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Review action</p>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  Risks, selected tests, and missing coverage become a decision-ready brief for human & agent review.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Scan Config Modal / Dropdown Panel */}
      {showCustomScanDialog && (
        <div className="border border-indigo-200 bg-white rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 font-mono">Custom SentryGraph Scan Configurator</h3>
            </div>
            <button
              onClick={() => setShowCustomScanDialog(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Target Symbol:</label>
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. sanitizeToken"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Declared Checkpoint Intent:</label>
              <input
                type="text"
                value={customIntent}
                onChange={(e) => setCustomIntent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. internal profile refactor only"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Max Depth: ({customDepth})</label>
              <input
                type="range"
                min="1"
                max="6"
                value={customDepth}
                onChange={(e) => setCustomDepth(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={useDatabricks}
                onChange={(e) => setUseDatabricks(e.target.checked)}
                className="accent-indigo-600 rounded"
              />
              <span>Enable Databricks AI semantic classification (falls back to local rules)</span>
            </label>

            <button
              onClick={handleRunLiveScan}
              disabled={scanningLive}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
            >
              {scanningLive ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>Execute Sentry Scan</span>
            </button>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <section aria-label="Scan status" className="grid gap-3 sm:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modified symbol</p>
          <p className="mt-2 truncate text-xl font-bold tracking-tight text-slate-900 font-mono">
            {root}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 font-mono">
            {modifiedSymbol?.file ? `${modifiedSymbol.file}:${modifiedSymbol.line || 1}` : "from active scan"}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Public surfaces</p>
          <p className="mt-2 truncate text-xl font-bold tracking-tight text-indigo-700 font-mono">
            {routes.length} route{routes.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            Reverse traversal · depth {scan.report.max_depth}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Review alerts</p>
          <p className={`mt-2 truncate text-xl font-bold tracking-tight font-mono ${
            (scan.report.alerts?.length ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"
          }`}>
            {scan.report.alerts?.length ?? 0} alert{(scan.report.alerts?.length ?? 0) === 1 ? '' : 's'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            Evidence-backed invariants
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk score</p>
          <p className={`mt-2 truncate text-xl font-bold tracking-tight font-mono ${
            risk >= 7 ? "text-rose-600" : risk >= 4 ? "text-amber-600" : "text-emerald-600"
          }`}>
            {risk}/10
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {scan.intelligence?.source === "databricks" ? "Databricks enrichment" : "Deterministic local rules"}
          </p>
        </article>
      </section>

      {/* Evidence Tier Classification Summary Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
              <span>Evidence Tier Separation</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                scan.report.completeness_status === 'PARTIAL_ANALYSIS'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {scan.report.completeness_status || 'FULLY_RESOLVED'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly distinguishes confirmed AST structures from heuristic claims requiring test verification.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono font-medium text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Confirmed Structural: <strong>{scan.report.evidence_breakdown?.confirmed_count ?? routes.filter(r => r.evidence_tier !== 'HEURISTIC_INCOMPLETE').length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-mono font-medium text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Heuristic / Incomplete: <strong>{scan.report.evidence_breakdown?.heuristic_count ?? routes.filter(r => r.evidence_tier === 'HEURISTIC_INCOMPLETE').length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-mono font-medium text-indigo-800">
              <Terminal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Verification Claims: <strong>{scan.report.evidence_breakdown?.verification_required_count ?? routes.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Partial Analysis Warning Banner if applicable */}
        {(scan.report.completeness_status === 'PARTIAL_ANALYSIS' || scan.report.partial_analysis?.isPartial) && (
          <div className="mt-3 p-3.5 rounded-lg bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <span>INCOMPLETE GRAPH ANALYSIS DETECTED</span>
                  <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded font-mono uppercase">Safe Fallback Active</span>
                </div>
                <p className="leading-relaxed">
                  This repository contains dynamic dispatch, reflection, or generated code that static analysis cannot fully resolve. SentryGraph does not present these relationships as certain; relationships below are marked as heuristic and conservative bounding has been engaged.
                </p>
                {scan.report.partial_analysis?.reasons && (
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-900 font-mono text-[11px] pt-1">
                    {scan.report.partial_analysis.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {scan.report.partial_analysis?.unresolvedCallSites && scan.report.partial_analysis.unresolvedCallSites.length > 0 && (
              <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="font-semibold text-amber-900">Unresolved Call Sites:</span>
                {scan.report.partial_analysis.unresolvedCallSites.map((site, i) => (
                  <span key={i} className="bg-white/80 border border-amber-200 px-2 py-0.5 rounded text-amber-800">
                    {site.filePath}:{site.line}
                  </span>
                ))}
              </div>
            )}

            {routes.some(r => r.evidence_tier === 'HEURISTIC_INCOMPLETE' && !r.verification_record) && (
              <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  Action Required: {routes.filter(r => r.evidence_tier === 'HEURISTIC_INCOMPLETE' && !r.verification_record).length} heuristic route(s) require verification before merge.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const firstUnverified = routes.find(r => r.evidence_tier === 'HEURISTIC_INCOMPLETE' && !r.verification_record);
                    if (firstUnverified) handleOpenVerification(firstUnverified);
                  }}
                  className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Review & Verify Heuristics</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Live Notice Status Line */}
      <div role="status" className="text-xs sm:text-sm text-slate-700 bg-indigo-50/70 border border-indigo-100 rounded-lg py-2 px-3 flex items-center gap-2">
        <span className="text-indigo-600 animate-pulse font-bold">●</span>
        <span className="font-medium">{notice}</span>
      </div>

      {/* Main Analysis Section: Blast Radius Graph + Decision Brief */}
      <section className="grid gap-5 lg:grid-cols-[1.6fr_.85fr]">
        {/* Interactive SVG Blast Radius Graph */}
        <article className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5 bg-slate-50/50">
            <div>
              <p className="text-sm font-bold text-slate-900">Structural blast radius</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Click a node to inspect the route path from the changed symbol.
              </p>
            </div>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-mono font-semibold text-indigo-700">
              ENTIRE GRAPH
            </span>
          </div>

          <SentryGraphView
            nodes={graphNodes}
            routes={routes}
            selected={selectedNode}
            onSelect={setSelectedNode}
          />

          <div className="border-t border-slate-200 px-5 py-4 text-xs font-mono text-slate-600 flex items-center justify-between bg-slate-50/50">
            <div>
              <span className="font-semibold text-slate-900">Selected evidence: </span>
              <span className="text-indigo-700 font-medium">
                {selectedNode === root
                  ? `Changed symbol "${root}" is the root of this review.`
                  : `"${selectedNode}" is reachable from "${root}" in this scan.`}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Interactive SVG</span>
          </div>
        </article>

        {/* Decision Brief */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Decision brief</p>
            <p className="mt-2 text-lg font-bold leading-snug text-slate-900">
              An internal-only claim reaches {routes.length} public surface{routes.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
              Declared checkpoint intent
            </p>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-indigo-950 font-mono">
              “{scan.report.checkpoint?.intent || "No intent was supplied."}”
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-mono text-slate-700 font-bold uppercase tracking-wider">
              Reachable HTTP Routes ({routes.length})
            </p>

            {routes.map((route, i) => (
              <div key={`${route.method}-${route.path}-${i}`} className="border-t border-slate-100 pt-3 text-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-slate-900 font-medium">
                    <span className={`mr-2 font-bold ${
                      route.method === 'GET' ? 'text-indigo-600' : route.method === 'POST' ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {route.method}
                    </span>
                    <span>{route.path}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    {route.verification_record ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        Verified ({route.verification_record.method === 'MANUAL_CONFIRMATION' ? 'Manual' : 'Test Linked'})
                      </span>
                    ) : route.evidence_tier === 'HEURISTIC_INCOMPLETE' ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        ⚠️ Heuristic {route.confidence ? `(${Math.round(route.confidence * 100)}%)` : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ Structural
                      </span>
                    )}
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-medium ${
                      route.authenticated
                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                        : "text-rose-700 bg-rose-50 border border-rose-200 font-semibold"
                    }`}>
                      {route.authenticated ? "authenticated" : "review auth"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Handler: {route.handler_name}</span>
                  <span className={route.regression_state.includes('stub') ? 'text-amber-700 font-medium' : 'text-emerald-700'}>
                    {route.regression_state}
                  </span>
                </div>

                {route.partial_reason && (
                  <div className="p-2 rounded bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 leading-snug">
                    <span className="font-bold">Dynamic Dispatch: </span>
                    <span>{route.partial_reason}</span>
                  </div>
                )}

                {/* Verification Record Details Card if verified */}
                {route.verification_record && (
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] space-y-1 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Verification Attestation Confirmed
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenVerification(route)}
                        className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold underline underline-offset-2"
                      >
                        Edit / Manage
                      </button>
                    </div>
                    {route.verification_record.method === 'MANUAL_CONFIRMATION' ? (
                      <p className="text-slate-700">
                        <strong>By:</strong> {route.verification_record.verifiedBy} ·{' '}
                        <strong>Decision:</strong> {route.verification_record.decision === 'CONFIRMED_REACHABLE' ? 'True Positive (Reachable)' : 'Guarded / Safe'}
                        <br />
                        <span className="italic text-slate-600">"{route.verification_record.manualRationale}"</span>
                      </p>
                    ) : (
                      <p className="text-slate-700">
                        <strong>Linked Test:</strong> {route.verification_record.linkedTestCase?.testName}
                        <br />
                        <span className="text-slate-600">Command: <code>{route.verification_record.linkedTestCase?.verifyCommand}</code></span>
                      </p>
                    )}
                  </div>
                )}

                {/* Request Verification Action Button for Heuristic Findings */}
                {route.evidence_tier === 'HEURISTIC_INCOMPLETE' && !route.verification_record && (
                  <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      id={`btn-request-verification-${route.method}-${route.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                      type="button"
                      onClick={() => handleOpenVerification(route)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-2xs hover:shadow-xs transition-all"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Request Verification</span>
                    </button>
                    <span className="text-[10px] text-slate-500 font-sans">
                      Manually confirm relationship or link automated test case
                    </span>
                  </div>
                )}

                {route.verification_path && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-indigo-700">Verification Path:</span>
                      {route.verification_path.sourceRange && (
                        <span className="text-slate-500">
                          {route.verification_path.sourceRange.filePath}:{route.verification_path.sourceRange.startLine}
                        </span>
                      )}
                    </div>
                    {route.verification_path.guidance && (
                      <p className="text-slate-600 font-sans text-xs">
                        {route.verification_path.guidance}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                      <code className="text-indigo-950 font-bold truncate">
                        {route.verification_path.verifyCommand}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(route.verification_path?.verifyCommand || '')}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] text-slate-700 font-semibold shrink-0 transition-colors shadow-2xs"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {routes.length === 0 && (
              <p className="text-xs text-slate-500 italic">No exposed HTTP routes were found in this scan.</p>
            )}
          </div>
        </aside>
      </section>

      {/* 3 Columns: Security Invariants, Regression Obligations, Semantic Enrichment */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* 01 Security Invariants */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div>
            <p className="text-xs font-bold tracking-[.16em] text-indigo-600 font-mono">01</p>
            <h3 className="mt-1 font-bold text-slate-900">Security invariants</h3>
            <p className="text-xs text-slate-500">Findings that require reviewer attention.</p>
          </div>

          <div className="space-y-3">
            {(scan.report.alerts ?? []).map((alert, idx) => (
              <div key={`${alert.code}-${alert.route}-${idx}`} className="border-l-3 border-rose-500 bg-rose-50/80 px-3.5 py-3 rounded-r-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 font-mono">{alert.code}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                    {alert.severity}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-800 font-semibold">{alert.route}</div>
                <p className="text-xs leading-relaxed text-slate-700">{alert.message}</p>
              </div>
            ))}

            {!scan.report.alerts?.length && (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No policy mismatch detected.</span>
              </div>
            )}
          </div>
        </article>

        {/* 02 Regression Obligations */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div>
            <p className="text-xs font-bold tracking-[.16em] text-indigo-600 font-mono">02</p>
            <h3 className="mt-1 font-bold text-slate-900">Regression obligations</h3>
            <p className="text-xs text-slate-500">Test selection is derived from graph relationships.</p>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Selected Tests</span>
            {tests.map((test) => (
              <div key={test.name} className="flex items-start gap-2 text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                <span className="truncate">{test.name}</span>
              </div>
            ))}

            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block pt-2">Generated Coverage Stubs</span>
            {scan.report.test_selection?.stubs.map((stub, i) => (
              <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                <span className="text-amber-600 font-bold shrink-0">△</span>
                <span>{stub}</span>
              </div>
            ))}
          </div>
        </article>

        {/* 03 Semantic Enrichment */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div>
            <p className="text-xs font-bold tracking-[.16em] text-indigo-600 font-mono">03</p>
            <h3 className="mt-1 font-bold text-slate-900">Semantic enrichment</h3>
            <p className="text-xs text-slate-500">Optional Databricks analysis, safely fallible.</p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
              <span>Source Engine:</span>
              <span className="text-indigo-700 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{scan.intelligence?.source || 'local-rules'}</span>
            </div>

            <div className="space-y-2">
              {[...(scan.intelligence?.classifications ?? []), ...(scan.intelligence?.recommendations ?? [])].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-indigo-600 font-bold shrink-0">→</span>
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}

              {!(scan.intelligence?.classifications?.length || scan.intelligence?.recommendations?.length) && (
                <p className="text-xs text-slate-500 italic p-3">Local rules remain the evidence source.</p>
              )}
            </div>
          </div>
        </article>
      </section>

      {/* CLI Helper Callout */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 truncate">
          <Terminal className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-slate-500 font-semibold">Terminal Command:</span>
          <code className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate font-semibold">{cliCommand}</code>
        </div>
        <button
          onClick={handleCopyCli}
          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1.5 shrink-0 font-semibold"
        >
          {copiedCli ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedCli ? 'Copied' : 'Copy CLI'}</span>
        </button>
      </div>

      {/* Verification Prompt Modal for Heuristic Findings */}
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

/* SVG Graph Component matching bright theme */
function SentryGraphView({
  nodes,
  routes,
  selected,
  onSelect
}: {
  nodes: string[];
  routes: SentryRoute[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const positions = [
    { x: 38, y: 152 },
    { x: 238, y: 152 },
    { x: 450, y: 52 },
    { x: 450, y: 190 },
    { x: 450, y: 328 },
    { x: 650, y: 100 },
    { x: 650, y: 250 }
  ];

  return (
    <div className="overflow-x-auto bg-[linear-gradient(rgba(226,232,240,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,.7)_1px,transparent_1px)] bg-[size:28px_28px] bg-slate-50/70 rounded-b-xl border-t border-slate-100">
      <svg className="h-[400px] min-w-[720px] w-full" viewBox="0 0 720 400" role="img" aria-label="SentryGraph call graph">
        {/* Draw connections */}
        {nodes.slice(1).map((_, index) => {
          const destination = positions[index + 1] ?? positions[4];
          const matchedRoute = routes[index - 1];
          const isHeuristic = matchedRoute?.evidence_tier === 'HEURISTIC_INCOMPLETE';
          const risky = index > 0 && !matchedRoute?.authenticated;

          const strokeColor = risky 
            ? "#e11d48" 
            : isHeuristic 
            ? "#f59e0b" 
            : "#6366f1";

          const dashPattern = isHeuristic 
            ? "5 5" 
            : risky 
            ? "6 4" 
            : undefined;

          return (
            <line
              key={index}
              x1={index === 0 ? 190 : 390}
              y1="181"
              x2={destination.x}
              y2={destination.y + 28}
              stroke={strokeColor}
              strokeDasharray={dashPattern}
              strokeWidth={risky || isHeuristic ? "2.5" : "2"}
              opacity={risky ? "0.9" : "0.75"}
            />
          );
        })}

        {/* Draw node rects */}
        {nodes.map((node, index) => {
          const position = positions[index] ?? positions[4];
          const matchedRoute = routes[index - 2];
          const isHeuristic = matchedRoute?.evidence_tier === 'HEURISTIC_INCOMPLETE';
          const risky = index > 1 && !matchedRoute?.authenticated;
          const active = selected === node;

          const fill = active
            ? "#eef2ff"
            : isHeuristic
            ? "#fffbeb"
            : risky
            ? "#fff1f2"
            : index > 2
            ? "#f0fdf4"
            : "#ffffff";

          const stroke = active
            ? "#4f46e5"
            : isHeuristic
            ? "#f59e0b"
            : risky
            ? "#f43f5e"
            : index > 2
            ? "#10b981"
            : "#cbd5e1";

          const label =
            index === 0
              ? "changed symbol"
              : index === 1
              ? "call chain"
              : isHeuristic
              ? "dynamic reflection"
              : risky
              ? "security review"
              : index > 2
              ? "selected test"
              : "HTTP handler";

          return (
            <g
              key={`${node}-${index}`}
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => onSelect(node)}
            >
              <rect
                x={position.x}
                y={position.y}
                width="168"
                height="62"
                rx="10"
                fill={fill}
                stroke={stroke}
                strokeWidth={active || isHeuristic ? "2.5" : "1.5"}
                filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))"
              />
              <text
                x={position.x + 12}
                y={position.y + 24}
                fill="#0f172a"
                fontSize="11"
                fontWeight="700"
                fontFamily="monospace"
              >
                {node.length > 17 ? `${node.slice(0, 15)}...` : node}
              </text>
              <text
                x={position.x + 12}
                y={position.y + 44}
                fill={isHeuristic ? "#b45309" : "#64748b"}
                fontSize="10"
                fontWeight="500"
                fontFamily="sans-serif"
              >
                {label}
              </text>
              {isHeuristic ? (
                <text
                  x={position.x + 95}
                  y={position.y + 23}
                  fill="#b45309"
                  fontSize="9"
                  fontWeight="800"
                  fontFamily="monospace"
                >
                  HEURISTIC
                </text>
              ) : risky ? (
                <text
                  x={position.x + 125}
                  y={position.y + 23}
                  fill="#e11d48"
                  fontSize="9"
                  fontWeight="800"
                  fontFamily="monospace"
                >
                  RISK
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
