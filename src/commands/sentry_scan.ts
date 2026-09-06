/**
 * SentryGraph (Entire Sentinel) - CLI Command Runner
 * 
 * Invocation:
 *   entire-graph sentry-scan --target <path> --symbol <name> --checkpoint <id/path>
 * 
 * Renders a clean ASCII terminal dashboard depicting:
 *   1. Graph Traversal Tree (Root modified symbol -> Internal helpers -> Exposed endpoints)
 *   2. Checkpoint Intent Audit (Declared intent vs. Actual structural blast radius)
 *   3. Databricks Risk Intelligence Assessment (Model name, Risk score 1-10, Classifications, Regression test selection)
 */

import { analyzeBlastRadius, GraphNode, CallEdge, CheckpointContext, BlastRadiusReport } from '../sentinel/blast_radius';
import { DatabricksSentinelClient, DatabricksRiskAssessment } from '../sentinel/databricks_client';

// Standard demo AST node dataset matching entire-graph repository
export const DEFAULT_CLI_NODES: GraphNode[] = [
  // Auth chain (deterministic AST)
  { id: 'sym-sanitizeToken', name: 'sanitizeToken', file: 'internal/auth/auth.go', line: 10, auth: 'unauthenticated' },
  { id: 'sym-processAuth', name: 'processAuth', file: 'internal/auth/middleware.go', line: 42 },
  { id: 'sym-profileHandler', name: 'profileHandler', file: 'internal/api/profile.go', line: 55, route: 'GET /api/v1/profile', auth: 'authenticated' },
  { id: 'sym-webhookHandler', name: 'webhookHandler', file: 'internal/api/webhook.go', line: 88, route: 'POST /api/v1/webhook', auth: 'unauthenticated' },
  { id: 'sym-refreshTokenHandler', name: 'refreshTokenHandler', file: 'internal/api/refresh.go', line: 30, route: 'POST /api/v1/auth/refresh', auth: 'unauthenticated' },
  { id: 'sym-testProfile', name: 'TestProfileHandler', file: 'internal/api/profile_test.go', line: 14, testFile: true },

  // Plugin gateway chain (dynamic dispatch & reflection)
  { id: 'sym-processPluginPayload', name: 'processPluginPayload', file: 'internal/plugins/dispatcher.go', line: 18, auth: 'unauthenticated' },
  { id: 'sym-DispatchPluginCommand', name: 'DispatchPluginCommand', file: 'internal/plugins/dispatcher.go', line: 45, dynamic: true, hasReflection: true, resolutionNote: 'Dynamic map lookup and reflection invocation' },
  { id: 'sym-auditHandler', name: 'auditHandler', file: 'internal/api/audit.go', line: 30, route: 'GET /api/v1/audit/logs', auth: 'authenticated' },
  { id: 'sym-pluginWebhookHandler', name: 'pluginWebhookHandler', file: 'internal/plugins/webhook.go', line: 62, route: 'POST /api/v1/plugins/webhook/ingest', auth: 'unauthenticated', dynamic: true },
  { id: 'sym-adminOverrideHandler', name: 'adminOverrideHandler', file: 'internal/admin/override.go', line: 40, route: 'POST /api/v1/plugins/admin/override', auth: 'unauthenticated', hasReflection: true },
  { id: 'sym-testPluginWebhook', name: 'TestPluginWebhookHandler', file: 'internal/plugins/webhook_test.go', line: 20, testFile: true }
];

export const DEFAULT_CLI_EDGES: CallEdge[] = [
  // Auth chain edges (Exact AST)
  { from: 'sym-processAuth', to: 'sym-sanitizeToken', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' },
  { from: 'sym-profileHandler', to: 'sym-processAuth', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' },
  { from: 'sym-webhookHandler', to: 'sym-sanitizeToken', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' },
  { from: 'sym-refreshTokenHandler', to: 'sym-sanitizeToken', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' },
  { from: 'sym-testProfile', to: 'sym-profileHandler', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' },

  // Plugin chain edges (Dynamic dispatch & reflection)
  { from: 'sym-DispatchPluginCommand', to: 'sym-processPluginPayload', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' },
  { from: 'sym-auditHandler', to: 'sym-DispatchPluginCommand', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' },
  { 
    from: 'sym-pluginWebhookHandler', 
    to: 'sym-DispatchPluginCommand', 
    relation: 'CALLS', 
    confidence: 0.55, 
    evidenceTier: 'HEURISTIC_INCOMPLETE', 
    resolution: 'dynamic_reflection',
    isPartial: true,
    partialReason: 'Dynamic string lookup in plugin dispatch map at dispatcher.go:48',
    callSite: { file: 'internal/plugins/dispatcher.go', line: 48 }
  },
  { 
    from: 'sym-adminOverrideHandler', 
    to: 'sym-DispatchPluginCommand', 
    relation: 'CALLS', 
    confidence: 0.45, 
    evidenceTier: 'HEURISTIC_INCOMPLETE', 
    resolution: 'dynamic_reflection',
    isPartial: true,
    partialReason: 'Reflective method invocation MethodByName at dispatcher.go:52',
    callSite: { file: 'internal/plugins/dispatcher.go', line: 52 }
  },
  { from: 'sym-testPluginWebhook', to: 'sym-pluginWebhookHandler', relation: 'CALLS', confidence: 1.0, evidenceTier: 'CONFIRMED_STRUCTURAL', resolution: 'exact' }
];

export interface SentryScanCliOptions {
  target?: string;
  symbol: string;
  checkpoint?: string;
  intent?: string;
  depth?: number;
  format?: 'text' | 'json' | 'dashboard';
  strict?: boolean;
}

export function parseCliArgs(args: string[]): SentryScanCliOptions {
  const options: SentryScanCliOptions = {
    symbol: 'sanitizeToken',
    intent: 'internal profile refactor only',
    depth: 4,
    format: 'dashboard',
    strict: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--symbol' && args[i + 1]) {
      options.symbol = args[++i];
    } else if (arg === '--target' && args[i + 1]) {
      options.target = args[++i];
    } else if (arg === '--checkpoint' && args[i + 1]) {
      options.checkpoint = args[++i];
    } else if (arg === '--intent' && args[i + 1]) {
      options.intent = args[++i];
    } else if (arg === '--depth' && args[i + 1]) {
      options.depth = parseInt(args[++i], 10) || 4;
    } else if (arg === '--format' && args[i + 1]) {
      options.format = args[++i] as any;
    } else if (arg === '--strict') {
      options.strict = true;
    }
  }

  return options;
}

export function formatAsciiDashboard(
  report: BlastRadiusReport,
  databricks: DatabricksRiskAssessment
): string {
  const line = '═'.repeat(78);
  const thinLine = '─'.repeat(78);
  const root = report.modifiedSymbol;

  const output: string[] = [];

  output.push(line);
  output.push(`  SENTRYGRAPH (ENTIRE SENTINEL) ─ AST BLAST-RADIUS SECURITY AUDIT`);
  output.push(line);
  output.push(`  Repository Target:     ${root.file}`);
  output.push(`  Modified Symbol:       ${root.name} (line ${root.line})`);
  output.push(`  Traversal Depth:       ${report.maxDepth} hops | Total Visited AST Nodes: ${report.traversalNodesCount}`);
  
  const statusTag = report.completenessStatus === 'PARTIAL_ANALYSIS'
    ? '⚠️  PARTIAL_ANALYSIS (Dynamic Dispatch & Reflection Detected)'
    : '✓  FULLY_RESOLVED (100% Deterministic AST)';
  output.push(`  Completeness Status:   ${statusTag}`);
  output.push(`  Evidence Breakdown:    Confirmed: ${report.evidenceBreakdown.confirmed} | Heuristic: ${report.evidenceBreakdown.heuristic} | Verification Req: ${report.evidenceBreakdown.verificationRequired}`);

  if (report.completenessStatus === 'PARTIAL_ANALYSIS') {
    output.push(thinLine);
    output.push(`  [!] CAUTION: DYNAMIC DISPATCH & REFLECTION DETECTED`);
    output.push(`      Static analysis cannot prove zero blast radius for dynamic calls.`);
    output.push(`      Safe Fallback Mode: ACTIVE (Conservative reach bounded; not presented as certain)`);
    if (report.partialAnalysis.reasons.length > 0) {
      report.partialAnalysis.reasons.forEach(r => output.push(`      • Reason: ${r}`));
    }
    if (report.partialAnalysis.unresolvedCallSites && report.partialAnalysis.unresolvedCallSites.length > 0) {
      report.partialAnalysis.unresolvedCallSites.forEach(s => {
        output.push(`      • Unresolved Site: ${s.filePath}:${s.line} (${s.expression})`);
      });
    }
  }

  output.push(thinLine);

  // 1. Graph Traversal Tree
  output.push(`  [1] GRAPH TRAVERSAL CALL TREE (Reverse CALLS Blast Radius):`);
  output.push(`      ┌─ [MODIFIED ROOT] ${root.name} (${root.file}:${root.line})`);
  report.impactedRoutes.forEach((route, idx) => {
    const isLast = idx === report.impactedRoutes.length - 1;
    const branch = isLast ? '└' : '├';
    const authBadge = route.authenticated ? '[AUTH]' : '[UNAUTHENTICATED - CRITICAL]';
    const tierBadge = route.evidenceTier === 'HEURISTIC_INCOMPLETE'
      ? `[⚠️ HEURISTIC ${(route.confidence * 100).toFixed(0)}%]`
      : `[✓ STRUCTURAL 100%]`;
    const chainStr = route.callChain.join(' ──> ');
    output.push(`      │  ${branch}──> ${chainStr}`);
    output.push(`      │      └─ [${route.method}] ${route.path} => ${route.handlerName} ${authBadge} ${tierBadge}`);
    output.push(`      │         Regression State: ${route.regressionState}`);
    if (route.partialReason) {
      output.push(`      │         Dynamic Notice:   ${route.partialReason}`);
    }
    if (route.verificationPath?.verifyCommand) {
      output.push(`      │         VERIFY:           ${route.verificationPath.verifyCommand}`);
    }
  });
  output.push(thinLine);

  // 2. Checkpoint Intent Audit
  output.push(`  [2] ENTIRE CHECKPOINT INTENT AUDIT:`);
  output.push(`      Declared Intent: "${report.checkpoint.intent}"`);
  output.push(`      Declared Scope:  [${(report.checkpoint.declaredScope || [root.name]).join(', ')}]`);
  if (report.discrepancyDetected) {
    output.push(`      STATUS:          ⚠️  DISCREPANCY DETECTED`);
    output.push(`      Discrepancy:     Author claims internal-only change, but ${report.impactedRoutes.length} public surface(s) are impacted!`);
  } else {
    output.push(`      STATUS:          ✓  INTENT ALIGNED WITH BLAST RADIUS`);
  }
  output.push('');
  output.push(`      Security Invariant Alerts (${report.alerts.length}):`);
  report.alerts.forEach((alert, i) => {
    output.push(`      • [${alert.code}] (${alert.severity.toUpperCase()}) ${alert.route}`);
    output.push(`        ${alert.message}`);
    output.push(`        Evidence: ${alert.evidence}`);
  });
  output.push(thinLine);

  // 3. Databricks Risk Intelligence Assessment
  output.push(`  [3] DATABRICKS RISK INTELLIGENCE ASSESSMENT:`);
  output.push(`      Engine Status:   ${databricks.status}`);
  output.push(`      Serving Model:   ${databricks.modelUsed}`);
  output.push(`      Risk Score:      ${databricks.riskScore} / 10 ${databricks.riskScore >= 7 ? '(CRITICAL AUDIT REQUIRED)' : '(ELEVATED)'}`);
  output.push(`      Intent Review:   ${databricks.intentDiscrepancyNotes}`);
  output.push('');
  output.push(`      Vulnerability Classifications:`);
  databricks.vulnerabilityClassifications.forEach(c => output.push(`        • ${c}`));

  if (databricks.historicalDeltaLakeMatches.length > 0) {
    output.push('');
    output.push(`      Delta Lake Historical Pattern Matches (governance.sec_ops.historical_cves):`);
    databricks.historicalDeltaLakeMatches.forEach(cve => {
      output.push(`        • [${cve.cveId}] (${cve.patternType}) on ${cve.affectedEndpointPattern}`);
      output.push(`          Remediation: ${cve.remediation}`);
    });
  }

  output.push('');
  output.push(`      Actionable Regression Test Obligations:`);
  if (report.testSelection.existingTests.length > 0) {
    report.testSelection.existingTests.forEach(t => output.push(`        ✓ Selected: ${t.name} (${t.file})`));
  }
  if (report.testSelection.stubs.length > 0) {
    report.testSelection.stubs.forEach(s => output.push(`        △ Missing:  ${s}`));
  }

  // Section 4: Actionable Verification Paths
  output.push(thinLine);
  output.push(`  [4] ACTIONABLE VERIFICATION COMMANDS (Before Release / Merge):`);
  report.impactedRoutes.forEach(r => {
    if (r.verificationPath?.verifyCommand) {
      output.push(`      • ${r.method} ${r.path} (${r.handlerName}) [${r.evidenceTier}]:`);
      output.push(`        Run:     ${r.verificationPath.verifyCommand}`);
      if (r.verificationPath.sourceRange) {
        output.push(`        Inspect: ${r.verificationPath.sourceRange.filePath}:${r.verificationPath.sourceRange.startLine}`);
      }
    }
  });

  output.push(line);

  return output.join('\n');
}

export async function runSentryScan(options: SentryScanCliOptions): Promise<{
  report: BlastRadiusReport;
  databricks: DatabricksRiskAssessment;
  output: string;
}> {
  const checkpoint: CheckpointContext = {
    id: options.checkpoint || 'cp-002-noon',
    intent: options.intent || 'internal profile refactor only',
    declaredScope: [options.symbol]
  };

  const matchedNode = DEFAULT_CLI_NODES.find(n => n.name.toLowerCase() === options.symbol.toLowerCase() || n.id === options.symbol || n.id === `sym-${options.symbol}`)
    || DEFAULT_CLI_NODES[0];

  const report = analyzeBlastRadius(
    DEFAULT_CLI_NODES,
    DEFAULT_CLI_EDGES,
    matchedNode.id,
    options.depth || 4,
    checkpoint
  );

  const databricksClient = new DatabricksSentinelClient();
  const databricksAssessment = await databricksClient.evaluateRisk(report);

  let formattedOutput = '';
  if (options.format === 'json') {
    formattedOutput = JSON.stringify({ report, databricks: databricksAssessment }, null, 2);
  } else {
    formattedOutput = formatAsciiDashboard(report, databricksAssessment);
  }

  return {
    report,
    databricks: databricksAssessment,
    output: formattedOutput
  };
}

// Direct CLI entry point execution when run directly via tsx
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('sentry_scan')) {
  const opts = parseCliArgs(process.argv.slice(2));
  runSentryScan(opts).then(res => {
    console.log(res.output);
    if (opts.strict && (res.report.discrepancyDetected || res.report.alerts.some(a => a.severity === 'critical'))) {
      process.exit(1);
    }
  }).catch(err => {
    console.error(`SentryScan failed:`, err);
    process.exit(1);
  });
}
