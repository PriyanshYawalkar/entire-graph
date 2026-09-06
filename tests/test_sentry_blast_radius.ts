/**
 * SentryGraph (Entire Sentinel) - Automated Unit & Integration Tests
 * 
 * Verifies:
 *   Test 1: Multi-hop AST graph traversal correctly resolves modified internal functions to exposed endpoints.
 *   Test 2: Invariant check flags a security alert when author intent claims "internal profile refactor" but unauthenticated /api/v1/webhook is in the call path.
 *   Test 3: Databricks client formats invocations properly and executes the local fallback cleanly without unhandled exceptions when offline.
 */

import { analyzeBlastRadius, GraphNode, CallEdge, CheckpointContext } from '../src/sentinel/blast_radius';
import { DatabricksSentinelClient, DELTA_LAKE_HISTORICAL_CVES } from '../src/sentinel/databricks_client';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('Running SentryGraph (Entire Sentinel) Test Suite');
  console.log('================================================================\n');

  // Fixture nodes representing a realistic multi-tier application
  const testNodes: GraphNode[] = [
    { id: 'node-sanitizeToken', name: 'sanitizeToken', file: 'internal/auth/auth.go', line: 10, auth: 'unauthenticated' },
    { id: 'node-processAuth', name: 'processAuth', file: 'internal/auth/middleware.go', line: 42 },
    { id: 'node-profileHandler', name: 'profileHandler', file: 'internal/api/profile.go', line: 55, route: 'GET /api/v1/profile', auth: 'authenticated' },
    { id: 'node-webhookHandler', name: 'webhookHandler', file: 'internal/api/webhook.go', line: 88, route: 'POST /api/v1/webhook', auth: 'unauthenticated' },
    { id: 'node-refreshTokenHandler', name: 'refreshTokenHandler', file: 'internal/api/refresh.go', line: 30, route: 'POST /api/v1/auth/refresh', auth: 'unauthenticated' },
    { id: 'node-testProfile', name: 'TestProfileHandler', file: 'internal/api/profile_test.go', line: 14, testFile: true }
  ];

  const testEdges: CallEdge[] = [
    // Reverse CALLS edges: caller -> callee
    // profileHandler -> processAuth -> sanitizeToken
    { from: 'node-processAuth', to: 'node-sanitizeToken' },
    { from: 'node-profileHandler', to: 'node-processAuth' },
    // webhookHandler -> sanitizeToken directly
    { from: 'node-webhookHandler', to: 'node-sanitizeToken' },
    // refreshTokenHandler -> sanitizeToken
    { from: 'node-refreshTokenHandler', to: 'node-sanitizeToken' },
    // Test node
    { from: 'node-testProfile', to: 'node-profileHandler' }
  ];

  // -------------------------------------------------------------------------
  // TEST 1: Multi-hop AST graph traversal
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Multi-hop AST graph traversal resolves modified internal functions to exposed endpoints:');
  const report1 = analyzeBlastRadius(testNodes, testEdges, 'node-sanitizeToken', 4);

  assert(report1.modifiedSymbol.name === 'sanitizeToken', 'Target symbol identified as sanitizeToken');
  assert(report1.impactedRoutes.length >= 2, `Discovered ${report1.impactedRoutes.length} exposed routes downstream`);
  
  const foundProfile = report1.impactedRoutes.find(r => r.path === '/api/v1/profile');
  assert(Boolean(foundProfile), 'Reaches GET /api/v1/profile via multi-hop traversal (depth: ' + (foundProfile?.depth || 0) + ')');
  assert(foundProfile?.depth === 2, 'GET /api/v1/profile is exactly 2 hops away (sanitizeToken -> processAuth -> profileHandler)');

  const foundWebhook = report1.impactedRoutes.find(r => r.path === '/api/v1/webhook');
  assert(Boolean(foundWebhook), 'Reaches POST /api/v1/webhook directly (depth: ' + (foundWebhook?.depth || 0) + ')');
  assert(foundWebhook?.depth === 1, 'POST /api/v1/webhook is 1 hop away');
  console.log('Test 1 Passed Successfully.\n');

  // -------------------------------------------------------------------------
  // TEST 2: Invariant Check Flags Security Alerts for Intent Discrepancy
  // -------------------------------------------------------------------------
  console.log('[TEST 2] Invariant check flags security alert on internal claim reaching unauthenticated webhook:');
  const checkpoint: CheckpointContext = {
    id: 'cp-002-noon',
    intent: 'internal profile refactor only',
    declaredScope: ['sanitizeToken']
  };

  const report2 = analyzeBlastRadius(testNodes, testEdges, 'node-sanitizeToken', 4, checkpoint);

  assert(report2.discrepancyDetected === true, 'Discrepancy flag raised when internal claim reaches external endpoints');

  const unauthAlerts = report2.alerts.filter(a => a.code === 'SG-UNAUTH-ROUTE');
  assert(unauthAlerts.length > 0, 'Security alert SG-UNAUTH-ROUTE triggered for unauthenticated endpoint');
  assert(unauthAlerts.some(a => a.route.includes('/api/v1/webhook')), 'Alert correctly points to unauthenticated webhook');

  const intentAlert = report2.alerts.find(a => a.code === 'SG-INTENT-SCOPE');
  assert(Boolean(intentAlert), 'Security alert SG-INTENT-SCOPE triggered for declared intent contradiction');
  assert(intentAlert?.severity === 'high', 'SG-INTENT-SCOPE severity is high');

  assert(report2.localRiskScore >= 7, `Local risk score is ${report2.localRiskScore}/10 (elevated due to unauthenticated reach)`);
  assert(report2.testSelection.stubs.length > 0, 'Test selection derived regression stubs for unexercised routes');
  console.log('Test 2 Passed Successfully.\n');

  // -------------------------------------------------------------------------
  // TEST 3: Databricks Client Resilient Offline Fallback & Formatting
  // -------------------------------------------------------------------------
  console.log('[TEST 3] Databricks client formats payload & executes clean offline fallback without unhandled exceptions:');
  
  // Initialize client with empty or unset credentials to force fallback
  const client = new DatabricksSentinelClient({ host: '', token: '' });
  assert(client.isConfigured() === false, 'Client correctly reports unconfigured when host/token missing');

  // Ensure Delta Lake query produces expected CVE matches
  const deltaMatches = client.queryDeltaLakeHistoricalPatterns(report2.impactedRoutes);
  assert(deltaMatches.length > 0, `Delta Lake pattern search identified ${deltaMatches.length} matching historical CVE records`);
  assert(deltaMatches.some(m => m.patternType === 'UNAUTHENTICATED_WEBHOOK'), 'Identified historical unauthenticated webhook CVE pattern');

  // Run evaluation in offline environment
  const assessment = await client.evaluateRisk(report2);

  assert(assessment.status === 'OFFLINE_FALLBACK', 'Assessment status is OFFLINE_FALLBACK');
  assert(assessment.modelUsed === 'deterministic-ast-heuristic-engine', 'Model used indicates deterministic AST heuristic engine');
  assert(assessment.riskScore === report2.localRiskScore, 'Fallback risk score matches deterministic local AST risk score');
  assert(assessment.vulnerabilityClassifications.length > 0, 'Classifications populated from AST analysis');
  assert(assessment.historicalDeltaLakeMatches.length > 0, 'Historical Delta Lake patterns attached to assessment');
  assert(assessment.regressionObligations.length > 0, 'Regression obligations forwarded to assessment');

  console.log('Test 3 Passed Successfully.\n');

  // -------------------------------------------------------------------------
  // TEST 4: Incomplete Analysis & Dynamic Dispatch / Reflection Fixture
  // -------------------------------------------------------------------------
  console.log('[TEST 4] Partial analysis handling: dynamic dispatch & reflection cannot be presented as certain:');
  
  // Fixture representing a repository with dynamic dispatch / reflection
  const dynamicNodes: GraphNode[] = [
    { 
      id: 'node-dispatchPlugin', 
      name: 'processPluginPayload', 
      file: 'internal/plugins/dispatcher.go', 
      line: 48, 
      resolutionNote: 'Core plugin payload processing function'
    },
    { 
      id: 'node-auditLogger', 
      name: 'auditLogger', 
      file: 'internal/audit/logger.go', 
      line: 22 
    },
    { 
      id: 'node-auditRoute', 
      name: 'auditHandler', 
      file: 'internal/api/audit.go', 
      line: 60, 
      route: 'GET /api/v1/audit/logs', 
      auth: 'authenticated' 
    },
    { 
      id: 'node-pluginWebhook', 
      name: 'pluginWebhookHandler', 
      file: 'internal/plugins/webhook.go', 
      line: 85, 
      route: 'POST /api/v1/plugins/webhook/ingest', 
      auth: 'unauthenticated',
      dynamic: true,
      hasReflection: true
    },
    { 
      id: 'node-adminOverride', 
      name: 'adminOverrideHandler', 
      file: 'internal/plugins/admin.go', 
      line: 110, 
      route: 'POST /api/v1/plugins/admin/override', 
      auth: 'authenticated',
      dynamic: true,
      hasReflection: true
    }
  ];

  const dynamicEdges: CallEdge[] = [
    // Static AST edge: auditRoute -> auditLogger -> dispatchPlugin
    { 
      from: 'node-auditLogger', 
      to: 'node-dispatchPlugin',
      confidence: 1.0,
      evidenceTier: 'CONFIRMED_STRUCTURAL',
      resolution: 'exact'
    },
    { 
      from: 'node-auditRoute', 
      to: 'node-auditLogger',
      confidence: 1.0,
      evidenceTier: 'CONFIRMED_STRUCTURAL',
      resolution: 'exact'
    },
    // Dynamic reflection edges: pluginWebhook -> dispatchPlugin via reflection
    { 
      from: 'node-pluginWebhook', 
      to: 'node-dispatchPlugin',
      confidence: 0.55,
      evidenceTier: 'HEURISTIC_INCOMPLETE',
      resolution: 'dynamic_reflection',
      isPartial: true,
      partialReason: 'Dynamic string lookup in plugin dispatch map at dispatcher.go:48',
      callSite: { file: 'internal/plugins/dispatcher.go', line: 48 }
    },
    // Dynamic dispatch edge: adminOverride -> dispatchPlugin
    { 
      from: 'node-adminOverride', 
      to: 'node-dispatchPlugin',
      confidence: 0.45,
      evidenceTier: 'HEURISTIC_INCOMPLETE',
      resolution: 'dynamic_reflection',
      isPartial: true,
      partialReason: 'Reflective method invocation MethodByName at dispatcher.go:52',
      callSite: { file: 'internal/plugins/dispatcher.go', line: 52 }
    }
  ];

  const dynamicCheckpoint: CheckpointContext = {
    id: 'cp-004-plugins',
    intent: 'internal plugin helper refactoring only',
    declaredScope: ['DispatchPluginCommand']
  };

  const report4 = analyzeBlastRadius(dynamicNodes, dynamicEdges, 'node-dispatchPlugin', 4, dynamicCheckpoint);

  // Requirement 1: Product must identify when analysis may be partial
  assert(report4.completenessStatus === 'PARTIAL_ANALYSIS', 'Report completenessStatus is correctly set to PARTIAL_ANALYSIS');
  assert(report4.partialAnalysis.isPartial === true, 'partialAnalysis.isPartial flag is set to true');
  assert(report4.partialAnalysis.detectedPatterns.includes('DYNAMIC_DISPATCH'), 'Detected DYNAMIC_DISPATCH pattern');
  assert(report4.partialAnalysis.detectedPatterns.includes('REFLECTION'), 'Detected REFLECTION pattern');

  // Requirement 2: Must not present incomplete Graph relationships as certain
  const dynamicWebhookRoute = report4.impactedRoutes.find(r => r.path === '/api/v1/plugins/webhook/ingest');
  assert(Boolean(dynamicWebhookRoute), 'Dynamic route is discovered under conservative traversal');
  assert(dynamicWebhookRoute?.evidenceTier === 'HEURISTIC_INCOMPLETE', 'Dynamic route is explicitly classified as HEURISTIC_INCOMPLETE, NOT certain');
  assert(dynamicWebhookRoute?.confidence !== undefined && dynamicWebhookRoute.confidence < 1.0, `Confidence is bounded to ${dynamicWebhookRoute?.confidence} (< 1.0)`);
  assert(dynamicWebhookRoute?.isPartial === true, 'Route isPartial flag is true');
  assert(dynamicWebhookRoute?.resolution === 'dynamic_reflection', 'Route resolution mode is dynamic_reflection');

  // Requirement 3: Provide a safe fallback or verification path
  assert(report4.partialAnalysis.safeFallbackActive === true, 'Safe fallback is active under partial analysis');
  assert(Boolean(dynamicWebhookRoute?.verificationPath), 'Actionable verification path provided');
  assert(dynamicWebhookRoute?.verificationPath.verifyCommand.includes('VERIFY: go test'), 'Verification command contains runnable test command: ' + dynamicWebhookRoute?.verificationPath.verifyCommand);
  assert(Boolean(dynamicWebhookRoute?.verificationPath.sourceRange), 'Verification path includes source range for manual inspection');

  // Requirement 4: Security alert raised for unverified dynamic boundary
  const dynamicAlert = report4.alerts.find(a => a.code === 'SG-DYNAMIC-DISPATCH-UNRESOLVED');
  assert(Boolean(dynamicAlert), 'Triggered SG-DYNAMIC-DISPATCH-UNRESOLVED security alert');

  console.log('Test 4 Passed Successfully.\n');

  // -------------------------------------------------------------------------
  // TEST 5: Three-tier Evidence Separation
  // -------------------------------------------------------------------------
  console.log('[TEST 5] Distinguish Confirmed Structural Evidence vs. Heuristic Evidence vs. Verification Claims:');
  
  const confirmedRoutes = report4.impactedRoutes.filter(r => r.evidenceTier === 'CONFIRMED_STRUCTURAL');
  const heuristicRoutes = report4.impactedRoutes.filter(r => r.evidenceTier === 'HEURISTIC_INCOMPLETE');

  assert(report4.evidenceBreakdown.heuristic > 0, `Heuristic count is ${report4.evidenceBreakdown.heuristic}`);
  assert(heuristicRoutes.length >= 2, 'Heuristic routes correctly isolated from confirmed routes');
  assert(report4.evidenceBreakdown.verificationRequired > 0, 'Verification-required count correctly accounted');

  // Agents and users can filter evidence by certainty
  heuristicRoutes.forEach(r => {
    assert(r.confidence < 1.0, `Heuristic route ${r.path} has reduced confidence: ${r.confidence}`);
    assert(Boolean(r.partialReason), `Heuristic route ${r.path} documents reason: ${r.partialReason}`);
  });

  console.log('Test 5 Passed Successfully.\n');

  // -------------------------------------------------------------------------
  // TEST 6: Fully Resolved Code Continues to Work with 100% Certainty
  // -------------------------------------------------------------------------
  console.log('[TEST 6] Existing behavior for fully resolved code continues to work with FULL_RESOLUTION:');
  
  assert(report1.completenessStatus === 'FULLY_RESOLVED', 'Standard AST traversal reports FULLY_RESOLVED');
  assert(report1.partialAnalysis.isPartial === false, 'Standard AST traversal partialAnalysis.isPartial is false');
  assert(report1.partialAnalysis.safeFallbackActive === false, 'Safe fallback inactive when full static AST resolution is available');
  
  report1.impactedRoutes.forEach(r => {
    assert(r.evidenceTier === 'CONFIRMED_STRUCTURAL', `Route ${r.path} retains CONFIRMED_STRUCTURAL evidence tier`);
    assert(r.confidence === 1.0, `Route ${r.path} retains 1.0 confidence`);
    assert(r.resolution === 'exact', `Route ${r.path} has exact resolution`);
  });

  console.log('Test 6 Passed Successfully.\n');

  console.log('================================================================');
  console.log('ALL 6 AUTOMATED TESTS PASSED CLEANLY (100% SUCCESS)');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
