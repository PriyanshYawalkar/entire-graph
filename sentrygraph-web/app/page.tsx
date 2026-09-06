"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Route = { method: string; path: string; handler_name: string; authenticated: boolean; depth: number; regression_state: string };
type Alert = { code: string; severity: string; route: string; message: string };
type Scan = {
  report: { modified_symbols: { name: string; file?: string; line?: number }[]; max_depth: number; checkpoint: { intent?: string }; impacted_routes: Route[]; alerts: Alert[]; test_selection: { existing_tests: { name: string }[]; stubs: string[] }; local_risk_score: number };
  intelligence: { risk_score: number; classifications: string[]; recommendations: string[]; source: string };
};

const fixture: Scan = {
  report: {
    modified_symbols: [{ name: "sanitizeToken", file: "auth.go", line: 10 }], max_depth: 3,
    checkpoint: { intent: "internal profile refactor only" },
    impacted_routes: [
      { method: "GET", path: "/api/v1/profile", handler_name: "profileHandler", authenticated: true, depth: 2, regression_state: "existing test selected" },
      { method: "POST", path: "/api/v1/webhook", handler_name: "webhookHandler", authenticated: false, depth: 2, regression_state: "coverage stub required" },
    ],
    alerts: [
      { code: "SG-UNAUTH-ROUTE", severity: "high", route: "POST /api/v1/webhook", message: "Unauthenticated endpoint is in the structural blast radius." },
      { code: "SG-INTENT-SCOPE", severity: "high", route: "POST /api/v1/webhook", message: "Checkpoint claims an internal-only change, but a public handler is impacted." },
    ],
    test_selection: { existing_tests: [{ name: "TestProfileHandler" }], stubs: ["TestwebhookHandler_POST_Regression: assert authorization and input validation."] }, local_risk_score: 8,
  },
  intelligence: { risk_score: 8, classifications: ["Structural blast radius", "Unauthenticated route exposure", "BOLA / IDOR review"], recommendations: ["Run selected regression tests", "Assert object-level authorization and request validation"], source: "local-rules" },
};

const card = "rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-black/20";

export default function Home() {
  const [scan, setScan] = useState<Scan>(fixture);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("sanitizeToken");
  const [notice, setNotice] = useState("");
  const risk = scan.intelligence?.risk_score || scan.report.local_risk_score;
  const routes = scan.report.impacted_routes || [];
  const root = scan.report.modified_symbols[0]?.name || "selected symbol";
  const nodes = useMemo(() => [root, "processAuth", ...routes.map((route) => route.handler_name), ...scan.report.test_selection.existing_tests.map((test) => test.name)], [root, routes, scan.report.test_selection.existing_tests]);

  function runScan() { setBusy(true); setTimeout(() => { setBusy(false); setNotice(`Scan complete · ${routes.length} public surfaces found`); }, 800); }
  function importScan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { const raw = JSON.parse(String(reader.result)); const next = raw.report ? raw : { report: raw, intelligence: { risk_score: raw.local_risk_score, classifications: [], recommendations: [], source: "local-rules" } }; setScan(next); setNotice("Imported SentryGraph scan result"); } catch { setNotice("That file is not a SentryGraph JSON report"); } }; reader.readAsText(file);
  }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_18%_-10%,#203966_0,transparent_30%),#020617] p-4 md:p-7">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-400 text-xl text-slate-950 shadow-glow">✦</div><div><p className="text-xl font-bold tracking-tight">SentryGraph</p><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Entire Sentinel · Graph intelligence</p></div></div>
        <div className="flex gap-2"><label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-cyan-400 hover:text-white">Import scan JSON<input className="hidden" type="file" accept="application/json" onChange={importScan} /></label><button onClick={runScan} disabled={busy} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">{busy ? "Tracing graph…" : "Run security scan"}</button></div>
      </header>
      {notice && <div className="mb-4 rounded-lg border border-cyan-900 bg-cyan-950/60 px-3 py-2 text-sm text-cyan-100">{notice}</div>}
      <section className="mb-4 grid gap-4 lg:grid-cols-[1fr_360px]"><div className={`${card} p-6`}><p className="text-xs font-bold uppercase tracking-[.15em] text-cyan-300">Checkpoint-aware security review</p><h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">One internal change. {routes.length} public surfaces.</h1><p className="mt-3 max-w-2xl text-slate-400">Tracing <span className="font-semibold text-white">{root}</span> through actual call-graph relationships reveals every downstream route and its regression obligations.</p></div><aside className={`${card} border-violet-900/70 bg-violet-950/20 p-5`}><p className="text-xs font-bold uppercase tracking-[.15em] text-violet-300">Declared checkpoint intent</p><p className="mt-2 font-semibold text-white">“{scan.report.checkpoint.intent || "No intent supplied"}”</p><p className="mt-1 text-sm text-violet-200/70">Public routes conflict with an internal-only claim.</p><div className="mt-5 flex items-center gap-3"><strong className="text-3xl text-rose-300">{risk}/10</strong><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-400" style={{ width: `${risk * 10}%` }} /></div></div></aside></section>
      <section className="grid gap-4 lg:grid-cols-[1.75fr_1fr]"><article className={card}><div className="flex items-center justify-between p-5 pb-2"><div><h2 className="font-semibold">Structural blast radius</h2><p className="text-xs text-slate-500">Reverse CALLS traversal · select a graph node</p></div><span className="rounded-full border border-violet-700 bg-violet-950 px-2 py-1 text-xs font-semibold text-violet-200">depth {scan.report.max_depth}</span></div><Graph nodes={nodes} routes={routes} selected={selected} onSelect={setSelected} /></article><article className={card}><div className="p-5 pb-2"><h2 className="font-semibold">Impacted endpoints</h2><p className="text-xs text-slate-500">{routes.length} route{routes.length === 1 ? "" : "s"} require review</p></div><div className="px-3 pb-3">{routes.map((route) => <div key={`${route.method}${route.path}`} className="grid grid-cols-[42px_1fr_auto] items-center gap-2 border-t border-slate-800 px-2 py-3"><span className="text-xs font-bold text-cyan-300">{route.method}</span><span className="font-mono text-xs text-slate-200">{route.path}</span><span className={`text-xs ${route.authenticated ? "text-emerald-300" : "text-amber-300"}`}>{route.authenticated ? "authenticated" : "auth review"}</span></div>)}</div></article></section>
      <section className="mt-4 grid gap-4 md:grid-cols-3"><Panel title="Security invariants" subtitle="Evidence-backed local findings"><div>{scan.report.alerts.map((alert) => <div key={alert.code + alert.route} className="border-t border-slate-800 px-5 py-3"><p className="text-xs font-bold text-rose-300">{alert.code} · {alert.route}</p><p className="mt-1 text-xs text-slate-400">{alert.message}</p></div>)}</div></Panel><Panel title="Regression selection" subtitle="Tests linked by graph evidence"><div className="px-5 pb-4 text-xs text-slate-400">{scan.report.test_selection.existing_tests.map((test) => <p className="border-t border-slate-800 py-2" key={test.name}><span className="text-emerald-300">✓</span> {test.name} selected</p>)}{scan.report.test_selection.stubs.map((stub) => <p className="border-t border-slate-800 py-2" key={stub}><span className="text-amber-300">△</span> {stub}</p>)}</div></Panel><Panel title="Databricks intelligence" subtitle="Optional semantic risk enrichment"><div className="px-5 pb-4 text-xs text-slate-400">{[...(scan.intelligence.classifications || []), ...(scan.intelligence.recommendations || [])].map((item) => <p key={item} className="border-t border-slate-800 py-2"><span className="text-cyan-300">→</span> {item}</p>)}</div></Panel></section>
    </div>
  </main>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <article className={card}><div className="p-5 pb-3"><h2 className="font-semibold">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div>{children}</article>; }

function Graph({ nodes, routes, selected, onSelect }: { nodes: string[]; routes: Route[]; selected: string; onSelect: (name: string) => void }) {
  const positions = [{ x: 42, y: 164 }, { x: 265, y: 164 }, { x: 510, y: 67 }, { x: 510, y: 222 }, { x: 510, y: 320 }];
  return <div className="overflow-x-auto bg-[linear-gradient(#14203a_1px,transparent_1px),linear-gradient(90deg,#14203a_1px,transparent_1px)] bg-[size:28px_28px]"><svg className="h-[390px] min-w-[720px] w-full" viewBox="0 0 740 390" role="img" aria-label="SentryGraph call graph">{nodes.slice(1).map((_, index) => <line key={index} x1={index === 0 ? 192 : 410} y1={index === 0 ? 193 : 193} x2={positions[index + 1]?.x || 510} y2={(positions[index + 1]?.y || 320) + 29} stroke={index > 0 && !routes[index - 1]?.authenticated ? "#fb7185" : "#3b82a8"} strokeDasharray={index > 0 && !routes[index - 1]?.authenticated ? "6 5" : undefined} strokeWidth="2" />)}{nodes.map((node, index) => { const pos = positions[index] || positions[4]; const risk = index > 1 && !routes[index - 2]?.authenticated; return <g key={node} onClick={() => onSelect(node)} className="cursor-pointer"><rect x={pos.x} y={pos.y} width="166" height="58" rx="10" fill={selected === node ? "#164e63" : risk ? "#431b2c" : index > 2 ? "#12342f" : "#13304a"} stroke={selected === node ? "#67e8f9" : risk ? "#fb7185" : "#477aa0"} /><text x={pos.x + 13} y={pos.y + 24} fill="white" fontSize="12" fontWeight="700">{node.slice(0, 22)}</text><text x={pos.x + 13} y={pos.y + 43} fill="#94a3b8" fontSize="10">{index === 0 ? "modified symbol" : index === 1 ? "depth 1" : risk ? "risk surface" : "downstream handler"}</text>{risk && <text x={pos.x + 125} y={pos.y + 22} fill="#fda4af" fontSize="10">RISK</text>}</g>; })}</svg></div>;
}
