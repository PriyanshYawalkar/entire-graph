import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { INITIAL_SYMBOLS, INITIAL_RELATIONS, BENCHMARKS, MOCK_STATS, MOCK_DIFF_CHANGES } from './src/data/mockData';
import { SearchMatch, ImpactAnalysis } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'entire-graph',
      version: '0.4.0',
      runtime: 'node-22'
    });
  });

  // Capabilities
  app.get('/api/graph/capabilities', (req, res) => {
    res.json({
      version: '0.4.0',
      engine: 'entire-graph-local',
      languages: {
        semantic: [
          'go', 'typescript', 'javascript', 'python', 'rust',
          'c', 'cpp', 'csharp', 'java', 'ruby', 'php', 'swift', 'dart', 'kotlin'
        ],
        inventory: ['markdown', 'yaml', 'toml', 'json', 'sql', 'dockerfile', 'protobuf']
      },
      relationTypes: [
        'CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS',
        'HANDLES_ROUTE', 'USES_TYPE', 'PARAM_TYPE', 'RETURNS_TYPE', 'FIELD_OF'
      ],
      profiles: ['fast', 'full', 'syntax-only'],
      formats: ['agent', 'text', 'json', 'ndjson']
    });
  });

  // Symbols query
  app.get('/api/graph/symbols', (req, res) => {
    const { kind, language, path: filePath } = req.query;
    let result = [...INITIAL_SYMBOLS];
    if (kind) {
      result = result.filter(s => s.kind === kind);
    }
    if (language) {
      result = result.filter(s => s.language === language);
    }
    if (filePath) {
      result = result.filter(s => s.filePath.includes(String(filePath)));
    }
    res.json(result);
  });

  // Edges query
  app.get('/api/graph/edges', (req, res) => {
    const { from, to, relation } = req.query;
    let result = [...INITIAL_RELATIONS];
    if (from) {
      result = result.filter(e => e.fromId === from || e.fromName.toLowerCase() === String(from).toLowerCase());
    }
    if (to) {
      result = result.filter(e => e.toId === to || e.toName.toLowerCase() === String(to).toLowerCase());
    }
    if (relation) {
      result = result.filter(e => e.relation === relation);
    }
    res.json(result);
  });

  // Search
  app.post('/api/graph/search', (req, res) => {
    const { query = '', topK = 8, profile = 'fast', format = 'json', maxContextBytes = 4096 } = req.body;
    const lowerQ = String(query).toLowerCase().trim();
    const terms = lowerQ.split(/\s+/).filter(Boolean);

    const matches: SearchMatch[] = INITIAL_SYMBOLS.map(sym => {
      let score = 0;
      let matchedSnippet = sym.bodySnippet;

      // Exact name match
      if (sym.name.toLowerCase() === lowerQ) score += 50;
      else if (sym.name.toLowerCase().includes(lowerQ)) score += 30;

      // Partial terms
      terms.forEach(term => {
        if (sym.name.toLowerCase().includes(term)) score += 15;
        if (sym.signature.toLowerCase().includes(term)) score += 10;
        if (sym.docComment && sym.docComment.toLowerCase().includes(term)) score += 8;
        if (sym.bodySnippet.toLowerCase().includes(term)) score += 5;
        if (sym.filePath.toLowerCase().includes(term)) score += 4;
      });

      const callers = INITIAL_RELATIONS.filter(r => r.toId === sym.id).map(r => r.fromName);
      const callees = INITIAL_RELATIONS.filter(r => r.fromId === sym.id).map(r => r.toName);

      return {
        symbolId: sym.id,
        name: sym.name,
        filePath: sym.filePath,
        line: sym.lineStart,
        score: Math.min(100, score),
        confidence: score > 30 ? 'HIGH' : score > 10 ? 'MEDIUM' : 'LOW',
        kind: sym.kind,
        signature: sym.signature,
        matchedSnippet,
        reason: score > 30 ? 'High AST identifier & body match' : 'Partial keyword & context occurrence',
        callers,
        callees
      };
    })
      .filter(m => terms.length === 0 || m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(topK));

    // Handle format outputs
    if (format === 'agent') {
      const agentLines = [
        `[entire-graph search] latency=12ms profile=${profile} top_k=${matches.length}`,
        `Index: cache-hit | budget: ${maxContextBytes}B`,
        '',
        ...matches.map((m, idx) => 
          `#${idx + 1} [${m.confidence}] ${m.filePath}:${m.line} (${m.name})\n` +
          `   def: ${m.signature}\n` +
          `   callers: ${m.callers?.join(', ') || 'none'} | callees: ${m.callees?.join(', ') || 'none'}`
        ),
        '',
        `VERIFY: go test ./... -run TestSearch`
      ];
      return res.json({ format: 'agent', output: agentLines.join('\n'), matches });
    }

    if (format === 'text') {
      const textLines = [
        `Ranked Results for: "${query}"`,
        '-------------------------------------------------------',
        ...matches.map((m, idx) => 
          `${idx + 1}. ${m.filePath}:${m.line} -> ${m.signature}\n${m.matchedSnippet}\n`
        ),
        `VERIFY: go test ./... -run TestVerify`
      ];
      return res.json({ format: 'text', output: textLines.join('\n'), matches });
    }

    res.json({
      query,
      profile,
      topK,
      count: matches.length,
      matches,
      verifyCommand: 'go test ./... -run TestSearch'
    });
  });

  // Neighbors query
  app.get('/api/graph/neighbors', (req, res) => {
    const { symbol = '', direction = 'both', depth = '1', relation = 'CALLS' } = req.query;
    const lowerSym = String(symbol).toLowerCase();
    const target = INITIAL_SYMBOLS.find(s => s.name.toLowerCase() === lowerSym || s.id === symbol);

    if (!target) {
      return res.status(404).json({ error: `Symbol '${symbol}' not found` });
    }

    const maxDepth = Math.min(2, Math.max(1, parseInt(String(depth), 10) || 1));

    const incoming = INITIAL_RELATIONS.filter(r => r.toId === target.id);
    const outgoing = INITIAL_RELATIONS.filter(r => r.fromId === target.id);

    res.json({
      targetSymbol: target,
      direction,
      depth: maxDepth,
      relation,
      incoming: incoming.map(r => ({
        ...r,
        fromSymbol: INITIAL_SYMBOLS.find(s => s.id === r.fromId)
      })),
      outgoing: outgoing.map(r => ({
        ...r,
        toSymbol: INITIAL_SYMBOLS.find(s => s.id === r.toId)
      }))
    });
  });

  // Impact Analysis (Blast Radius)
  app.get('/api/graph/impact', (req, res) => {
    const { symbol = '' } = req.query;
    const target = INITIAL_SYMBOLS.find(s => s.name.toLowerCase() === String(symbol).toLowerCase() || s.id === symbol) || INITIAL_SYMBOLS[0];

    const directCallers = INITIAL_RELATIONS.filter(r => r.toId === target.id)
      .map(r => INITIAL_SYMBOLS.find(s => s.id === r.fromId))
      .filter((s): s is typeof INITIAL_SYMBOLS[0] => Boolean(s));

    const callees = INITIAL_RELATIONS.filter(r => r.fromId === target.id)
      .map(r => INITIAL_SYMBOLS.find(s => s.id === r.toId))
      .filter((s): s is typeof INITIAL_SYMBOLS[0] => Boolean(s));

    // Transitive callers
    const directCallerIds = new Set(directCallers.map(c => c.id));
    const transitiveCallers = INITIAL_RELATIONS.filter(r => directCallerIds.has(r.toId) && r.fromId !== target.id)
      .map(r => INITIAL_SYMBOLS.find(s => s.id === r.fromId))
      .filter((s): s is typeof INITIAL_SYMBOLS[0] => Boolean(s));

    const typeConsumers = INITIAL_SYMBOLS.filter(s => s.bodySnippet.includes(target.name) && s.id !== target.id);

    const siblings = INITIAL_SYMBOLS.filter(s => s.filePath === target.filePath && s.id !== target.id);

    const impact: ImpactAnalysis = {
      targetSymbol: target,
      riskScore: target.dependentsCount && target.dependentsCount > 15 ? 'HIGH' : target.dependentsCount && target.dependentsCount > 8 ? 'MEDIUM' : 'LOW',
      riskJustification: `${directCallers.length} direct caller(s), ${transitiveCallers.length} transitive caller(s), affecting ${target.dependentsCount || 0} total dependents across the repository.`,
      directCallers,
      transitiveCallers,
      callees,
      typeConsumers,
      coChangeFiles: [
        { path: target.filePath, coChangeFrequency: 1.0 },
        { path: 'internal/sem/parser.go', coChangeFrequency: 0.72 },
        { path: 'internal/cli/root.go', coChangeFrequency: 0.45 },
        { path: 'internal/sem/search_test.go', coChangeFrequency: 0.88 }
      ],
      siblings,
      verifyCommand: `go test ./${target.filePath.split('/')[0]}/${target.filePath.split('/')[1]} -run Test${target.name}`
    };

    res.json(impact);
  });

  // Diff Risk Analyzer
  app.get('/api/graph/diff', (req, res) => {
    res.json({
      baseRef: 'main',
      headRef: 'HEAD',
      changes: MOCK_DIFF_CHANGES,
      riskSummary: {
        totalChanges: MOCK_DIFF_CHANGES.length,
        highRiskChanges: MOCK_DIFF_CHANGES.filter(c => c.riskLevel === 'HIGH').length,
        signatureChanges: MOCK_DIFF_CHANGES.filter(c => c.changeType === 'SIGNATURE_CHANGED').length,
        recommendation: 'Run test suite: signature change on sem.ParseTreeSitterAST impacts 24 dependents.'
      }
    });
  });

  // Benchmarks & Stats
  app.get('/api/graph/benchmarks', (req, res) => {
    res.json({
      locomoBenchmarks: BENCHMARKS,
      stats: MOCK_STATS
    });
  });

  // SentryGraph Security Scan API (sentrygraph-buildathon)
  app.post('/api/sentry/scan', (req, res) => {
    const { symbol = 'sanitizeToken', intent = 'internal refactor only', depth = 3, databricks = false } = req.body;
    const lowerSym = String(symbol).toLowerCase();
    const target = INITIAL_SYMBOLS.find(s => s.name.toLowerCase() === lowerSym || s.id === symbol) || {
      id: 'sym-custom',
      name: symbol,
      qualifiedName: symbol,
      filePath: 'internal/auth/auth.go',
      lineStart: 10,
      lineEnd: 25,
      signature: `func ${symbol}() error`,
      kind: 'function',
      language: 'go',
      bodySnippet: `func ${symbol}() error { return nil }`
    };

    // Calculate impacted routes based on symbol characteristics
    const isDynamicSymbol = lowerSym.includes('plugin') || lowerSym.includes('dispatch') || lowerSym.includes('reflect');
    const isAuthRelated = lowerSym.includes('auth') || lowerSym.includes('token') || lowerSym.includes('session') || lowerSym.includes('login') || lowerSym.includes('sanitize');
    const isInternalClaim = String(intent).toLowerCase().includes('internal') || String(intent).toLowerCase().includes('refactor') || String(intent).toLowerCase().includes('cleanup');

    const impactedRoutes = isDynamicSymbol ? [
      {
        method: 'GET',
        path: '/api/v1/audit/logs',
        handler_name: 'auditHandler',
        authenticated: true,
        depth: 2,
        regression_state: 'existing test selected',
        evidence_tier: 'CONFIRMED_STRUCTURAL' as const,
        resolution: 'exact' as const,
        confidence: 1.0,
        is_partial: false,
        verification_path: {
          verifyCommand: 'VERIFY: go test -v ./internal/api/... -run TestAuditHandler',
          sourceRange: { filePath: 'internal/api/audit.go', startLine: 60, endLine: 80 },
          guidance: 'Deterministic AST edge confirmed: standard regression verification.',
          testFile: 'internal/api/audit_test.go'
        }
      },
      {
        method: 'POST',
        path: '/api/v1/plugins/webhook/ingest',
        handler_name: 'pluginWebhookHandler',
        authenticated: false,
        depth: 2,
        regression_state: 'coverage stub required',
        evidence_tier: 'HEURISTIC_INCOMPLETE' as const,
        resolution: 'dynamic_reflection' as const,
        confidence: 0.55,
        is_partial: true,
        partial_reason: 'Dynamic string lookup in plugin dispatch map at dispatcher.go:48',
        verification_path: {
          verifyCommand: 'VERIFY: go test -v ./internal/plugins/... -run TestPluginWebhookHandler_DynamicDispatchRegression',
          sourceRange: { filePath: 'internal/plugins/webhook.go', startLine: 85, endLine: 105 },
          guidance: 'Dynamic dispatch detected: run verification suite to assert unauthenticated route isolation.',
          testFile: 'internal/plugins/webhook_test.go'
        }
      },
      {
        method: 'POST',
        path: '/api/v1/plugins/admin/override',
        handler_name: 'adminOverrideHandler',
        authenticated: true,
        depth: 3,
        regression_state: 'coverage stub required',
        evidence_tier: 'HEURISTIC_INCOMPLETE' as const,
        resolution: 'dynamic_reflection' as const,
        confidence: 0.45,
        is_partial: true,
        partial_reason: 'Reflective method invocation MethodByName at dispatcher.go:52',
        verification_path: {
          verifyCommand: 'VERIFY: go test -v ./internal/plugins/... -run TestAdminOverrideHandler_DynamicDispatchRegression',
          sourceRange: { filePath: 'internal/plugins/admin.go', startLine: 110, endLine: 130 },
          guidance: 'Dynamic reflection in path: verify admin role boundary cannot be triggered by unvalidated payloads.',
          testFile: 'internal/plugins/admin_test.go'
        }
      }
    ] : [
      {
        method: 'GET',
        path: isAuthRelated ? '/api/v1/profile' : '/api/v1/data',
        handler_name: isAuthRelated ? 'profileHandler' : 'queryHandler',
        authenticated: true,
        depth: 2,
        regression_state: 'existing test selected',
        evidence_tier: 'CONFIRMED_STRUCTURAL' as const,
        resolution: 'exact' as const,
        confidence: 1.0,
        is_partial: false,
        verification_path: {
          verifyCommand: `VERIFY: go test -v ./internal/api/... -run Test${isAuthRelated ? 'Profile' : 'Data'}Handler`,
          sourceRange: { filePath: 'internal/api/handler.go', startLine: 50, endLine: 70 },
          guidance: 'Deterministic AST edge confirmed: standard regression verification.'
        }
      },
      {
        method: 'POST',
        path: isAuthRelated ? '/api/v1/webhook' : '/api/v1/sync',
        handler_name: isAuthRelated ? 'webhookHandler' : 'syncHandler',
        authenticated: false,
        depth: 2,
        regression_state: 'coverage stub required',
        evidence_tier: 'CONFIRMED_STRUCTURAL' as const,
        resolution: 'exact' as const,
        confidence: 1.0,
        is_partial: false,
        verification_path: {
          verifyCommand: `VERIFY: go test -v ./internal/api/... -run Test${isAuthRelated ? 'Webhook' : 'Sync'}Handler`,
          sourceRange: { filePath: 'internal/api/webhook.go', startLine: 80, endLine: 100 },
          guidance: 'Deterministic AST edge confirmed: standard regression verification.'
        }
      }
    ];

    if (depth >= 3 && isAuthRelated && !isDynamicSymbol) {
      impactedRoutes.push({
        method: 'POST',
        path: '/api/v1/auth/refresh',
        handler_name: 'refreshTokenHandler',
        authenticated: false,
        depth: 3,
        regression_state: 'coverage stub required',
        evidence_tier: 'CONFIRMED_STRUCTURAL' as const,
        resolution: 'exact' as const,
        confidence: 1.0,
        is_partial: false,
        verification_path: {
          verifyCommand: 'VERIFY: go test -v ./internal/api/... -run TestRefreshTokenHandler',
          sourceRange: { filePath: 'internal/api/refresh.go', startLine: 30, endLine: 50 },
          guidance: 'Deterministic AST edge confirmed: standard regression verification.'
        }
      });
    }

    const alerts = [];
    if (isDynamicSymbol) {
      alerts.push({
        code: 'SG-DYNAMIC-DISPATCH-UNRESOLVED',
        severity: 'high' as const,
        route: 'DYNAMIC_BOUNDARY',
        message: 'Dynamic dispatch and reflection encountered in AST traversal. Graph relationships must not be treated as certain without test verification.',
        evidence: 'Unresolved dynamic boundaries in internal/plugins/dispatcher.go:48. Safe fallback and verification paths engaged.'
      });
    }

    impactedRoutes.forEach(r => {
      if (!r.authenticated) {
        alerts.push({
          code: 'SG-UNAUTH-ROUTE',
          severity: 'high' as const,
          route: `${r.method} ${r.path}`,
          message: 'Unauthenticated endpoint is in the structural blast radius.',
          evidence: `Call chain to ${r.handler_name} [Tier: ${r.evidence_tier}, Confidence: ${r.confidence}]`
        });
      }
      if (isInternalClaim) {
        alerts.push({
          code: 'SG-INTENT-SCOPE',
          severity: 'high' as const,
          route: `${r.method} ${r.path}`,
          message: `Checkpoint claims an internal-only change ("${intent}"), but public handler "${r.handler_name}" is impacted.`,
          evidence: `Discrepancy: declared scope leaks into external route [Resolution: ${r.resolution}]`
        });
      }
    });

    const localRiskScore = Math.min(10, Math.max(2, 2 + impactedRoutes.length * 2 + alerts.length));

    const scanResult = {
      report: {
        modified_symbols: [{ name: target.name, file: target.filePath, line: target.lineStart }],
        max_depth: Number(depth),
        checkpoint: {
          intent: String(intent),
          declared_scope: [target.name]
        },
        completeness_status: isDynamicSymbol ? 'PARTIAL_ANALYSIS' : 'FULLY_RESOLVED',
        partial_analysis: {
          isPartial: isDynamicSymbol,
          detectedPatterns: isDynamicSymbol ? ['DYNAMIC_DISPATCH', 'REFLECTION'] : [],
          reasons: isDynamicSymbol
            ? ['Dynamic string lookup in plugin dispatch map at dispatcher.go:48 prevents deterministic AST call extraction.']
            : [],
          unresolvedCallSites: isDynamicSymbol ? [
            { filePath: 'internal/plugins/dispatcher.go', line: 48, detail: 'Dynamic plugin lookup: plugins[commandName].Process(ctx, payload)' }
          ] : [],
          safeFallbackActive: isDynamicSymbol,
          conservativeBoundingNote: isDynamicSymbol
            ? 'Conservative bounding fallback active: potential downstream routes included heuristically. Never assume 0 blast radius under dynamic dispatch.'
            : 'Full static AST resolution: all paths confirmed deterministic.'
        },
        evidence_breakdown: {
          confirmed_count: impactedRoutes.filter(r => r.evidence_tier === 'CONFIRMED_STRUCTURAL').length,
          heuristic_count: impactedRoutes.filter(r => r.evidence_tier === 'HEURISTIC_INCOMPLETE').length,
          verification_required_count: impactedRoutes.filter(r => r.regression_state.includes('stub')).length
        },
        impacted_routes: impactedRoutes,
        alerts,
        test_selection: {
          existing_tests: [{ name: `Test${target.name}Handler`, file: 'internal/api/handler_test.go' }],
          stubs: impactedRoutes.filter(r => r.regression_state.includes('stub')).map(r => 
            `Test${r.handler_name}_${r.method}_Regression: exercise ${r.method} ${r.path} and assert authorization + input validation`
          )
        },
        local_risk_score: localRiskScore
      },
      intelligence: {
        risk_score: localRiskScore,
        classifications: databricks
          ? (isDynamicSymbol ? ['Dynamic dispatch boundary', 'Incomplete static analysis', 'Databricks ML BOLA/IDOR risk heuristic'] : ['Structural blast radius', 'Unauthenticated route exposure', 'Databricks ML BOLA/IDOR risk heuristic'])
          : (isDynamicSymbol ? ['Dynamic dispatch boundary', 'Reflection risk', 'BOLA / IDOR review'] : ['Structural blast radius', 'Unauthenticated route exposure', 'BOLA / IDOR review']),
        recommendations: databricks
          ? ['Run selected regression tests', 'Enforce strict schema validation on unauthenticated webhooks', 'Verify zero privilege escalation via Databricks model evaluation']
          : ['Run selected regression tests', 'Assert object-level authorization and request validation'],
        source: databricks ? 'databricks' : 'local-rules'
      }
    };

    res.json(scanResult);
  });

  // CLI Command Runner
  app.post('/api/graph/cli-exec', (req, res) => {
    const { command = '' } = req.body;
    const cleanCmd = String(command).trim();

    if (cleanCmd.includes('sentry-scan')) {
      if (cleanCmd.includes('plugin') || cleanCmd.includes('dispatch') || cleanCmd.includes('reflect')) {
        res.json({
          exitCode: 0,
          output: `[entire-graph sentry-scan] symbol=processPluginPayload intent="internal plugin helper string cleanup only"
--------------------------------------------------------------------------------
COMPLETENESS STATUS: ⚠️  PARTIAL_ANALYSIS (Dynamic Dispatch & Reflection Encountered)
SAFE FALLBACK: ACTIVE (Conservative Bounding Applied)

EVIDENCE CLASSIFICATION SUMMARY:
  ✓ Confirmed Structural:  1 route (100% deterministic AST path)
  ⚠️ Heuristic Incomplete: 2 routes (dynamic dispatch / reflection)
  📋 Verification Claims:  3 test execution verification obligations

MODIFIED ROOT:
  processPluginPayload (internal/plugins/dispatcher.go:48)

PUBLIC SURFACE BLAST RADIUS (depth: 4):
  [CONFIRMED] [AUTH]   GET  /api/v1/audit/logs -> auditHandler (depth 2) [exact AST]
  [HEURISTIC] [UNAUTH] POST /api/v1/plugins/webhook/ingest -> pluginWebhookHandler (depth 2)
              ↳ Reason: Dynamic string lookup in plugin dispatch map at dispatcher.go:48
              ↳ Confidence: 0.55 (UNCERTAIN - DO NOT TREAT AS PROVEN)
              ↳ Action: VERIFY: go test -v ./internal/plugins/... -run TestPluginWebhookHandler_DynamicDispatchRegression
  [HEURISTIC] [AUTH]   POST /api/v1/plugins/admin/override -> adminOverrideHandler (depth 3)
              ↳ Reason: Reflective method invocation MethodByName at dispatcher.go:52
              ↳ Confidence: 0.45 (UNCERTAIN - DO NOT TREAT AS PROVEN)
              ↳ Action: VERIFY: go test -v ./internal/plugins/... -run TestAdminOverrideHandler_DynamicDispatchRegression

SECURITY ALERTS (3):
  * [SG-DYNAMIC-DISPATCH-UNRESOLVED] (high) DYNAMIC_BOUNDARY
    Dynamic dispatch and reflection encountered in AST traversal. Graph relationships must not be treated as certain without test verification.
  * [SG-UNAUTH-ROUTE] (high) POST /api/v1/plugins/webhook/ingest
    Unauthenticated endpoint is in the heuristic structural blast radius.
  * [SG-INTENT-SCOPE] (high) POST /api/v1/plugins/webhook/ingest
    Checkpoint claims an internal-only change ("internal plugin helper string cleanup only"), but dynamic handler is impacted.

ACTIONABLE VERIFICATION PATHS (Agents & Developers):
  1. VERIFY: go test -v ./internal/plugins/... -run TestPluginWebhookHandler_DynamicDispatchRegression
  2. VERIFY: go test -v ./internal/plugins/... -run TestAdminOverrideHandler_DynamicDispatchRegression

LOCAL RISK SCORE: 9/10 (conservative risk ceiling under partial static analysis)`
        });
        return;
      }

      res.json({
        exitCode: 0,
        output: `[entire-graph sentry-scan] symbol=sanitizeToken intent="internal profile refactor only"
--------------------------------------------------------------------------------
COMPLETENESS STATUS: ✓ FULLY_RESOLVED (100% Deterministic AST Analysis)

MODIFIED ROOT:
  sanitizeToken (internal/auth/auth.go:10)

PUBLIC SURFACE BLAST RADIUS (depth: 3):
  [CONFIRMED] [AUTH]   GET  /api/v1/profile -> profileHandler (depth 2) [existing test selected]
  [CONFIRMED] [UNAUTH] POST /api/v1/webhook -> webhookHandler (depth 2) [coverage stub required]

SECURITY ALERTS (2):
  * [SG-UNAUTH-ROUTE] (high) POST /api/v1/webhook
    Unauthenticated endpoint is in the structural blast radius.
  * [SG-INTENT-SCOPE] (high) POST /api/v1/webhook
    Checkpoint claims an internal-only change, but a public handler is impacted.

REGRESSION OBLIGATIONS:
  ✓ Existing Test: TestProfileHandler
  △ Stub Needed:   TestwebhookHandler_POST_Regression: exercise POST /api/v1/webhook

LOCAL RISK SCORE: 8/10 (deterministic local rules)
Intelligence: BOLA / IDOR review, unauthenticated route exposure`
      });
      return;
    }

    if (cleanCmd.includes('search')) {
      res.json({
        exitCode: 0,
        output: `[entire-graph search] query="${cleanCmd}" profile=fast top_k=3
Index: cache-hit (internal/sem.v1.cache)
Latency: 11.4ms | Tokens Saved: ~4,200

#1 [HIGH] internal/cli/search.go:42 (cli.ExecuteSearch)
   signature: func ExecuteSearch(ctx context.Context, repo string, query string, opts SearchOptions) (*SearchResult, error)
   match: Hybrid AST + BM25 ranking (score: 94.2)
   callers: 3 sites | callees: 4 sites

#2 [HIGH] internal/sem/search_matcher.go:18 (sem.NewQueryMatcher)
   signature: func NewQueryMatcher(query string, profile ProfileMode) *QueryMatcher
   match: CamelCase/snake_case query tokenizer

#3 [MEDIUM] internal/sem/search_needle.go:40 (sem.BudgetResults)
   signature: func BudgetResults(results []SearchHit, maxBytes int) []SearchHit
   match: Byte budget enforcement

VERIFY: go test ./internal/cli -run TestSearch`
      });
      return;
    }

    if (cleanCmd.includes('impact')) {
      res.json({
        exitCode: 0,
        output: `[entire-graph impact] symbol=sem.ParseTreeSitterAST depth=2
Index: cache-hit (0.8ms)

TARGET:
  sem.ParseTreeSitterAST (internal/sem/parser.go:64)
  Kind: function | Dependents: 24 (HIGH RISK)

DIRECT CALLERS (depth=1):
  * internal/sem/compact_snapshot.go:51 (sem.BuildCompactSnapshot)
  * internal/sem/search_matcher.go:22 (sem.NewQueryMatcher)

TRANSITIVE CALLERS (depth=2):
  * internal/cli/search.go:44 (cli.ExecuteSearch)

CO-CHANGE SITES (historical Git commits):
  * internal/sem/parser_test.go (94% co-change rate)
  * internal/cli/root.go (48% co-change rate)

VERIFY: go test ./internal/sem -run TestParseTreeSitterAST`
      });
      return;
    }

    if (cleanCmd.includes('neighbors')) {
      res.json({
        exitCode: 0,
        output: `[entire-graph neighbors] symbol=cli.ExecuteSearch relation=CALLS direction=both
Index: cache-hit

INCOMING (who calls ExecuteSearch):
  <- cmd/entire-graph/main.go:88 (cli.RunMain)

OUTGOING (what ExecuteSearch calls):
  -> internal/sem/search_matcher.go:18 (sem.NewQueryMatcher)
  -> internal/sem/search_needle.go:40 (sem.BudgetResults)
  -> internal/sem/call_scanners.go:88 (sem.TraceCallers)`
      });
      return;
    }

    if (cleanCmd.includes('stats')) {
      res.json({
        exitCode: 0,
        output: `Entire Graph Agent Efficiency Report
===============================================
Sessions Analyzed:             142 sessions
Graph Locating Invocations:    489 calls
Direct File Reads Replaced:    1,215 whole-file reads
Estimated Token Savings:       3,888,000 tokens (972 KB)
Graph-First Locate Rate:       88.4% of sessions
Average Query Latency:         14.2ms (all local, 0 model tokens)`
      });
      return;
    }

    res.json({
      exitCode: 0,
      output: `entire-graph v0.4.0 (commit #104 branch)
Available commands:
  search       Ranked code regions for query
  neighbors    Callers and callees of a symbol
  impact       One-shot blast radius for a symbol
  diff         Entity-level changes & dependent counts
  symbols      Full repo symbol inventory stream
  edges        Graph relation stream
  stats        Agent session token savings report
  capabilities Feature detection for semantic languages`
    });
  });

  // Vite Middleware for development, static fallback for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Entire Graph Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
