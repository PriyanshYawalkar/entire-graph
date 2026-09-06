/**
 * SentryGraph (Entire Sentinel) - Core Blast Radius & AST Traversal Engine
 * 
 * Traverses Entire Graph AST call hierarchies via reverse and forward CALLS relations
 * to detect downstream exposed routes, unauthenticated endpoints, and intent discrepancies
 * between Entire Checkpoint author claims and actual structural blast radius.
 */

import { 
  EvidenceTier, 
  ResolutionMode, 
  CompletenessStatus, 
  VerificationPath, 
  PartialAnalysisMeta 
} from '../types';

export interface GraphNode {
  id: string;
  name: string;
  file: string;
  line: number;
  public?: boolean;
  route?: string; // e.g. "GET /api/v1/profile" or "POST /api/v1/webhook"
  auth?: 'authenticated' | 'unauthenticated' | string;
  testFile?: boolean;
  dynamic?: boolean;
  hasReflection?: boolean;
  resolutionNote?: string;
}

export interface CallEdge {
  from: string; // Caller node ID
  to: string;   // Callee node ID
  relation?: string;
  confidence?: number; // 1.0 = exact AST, < 1.0 = heuristic/dynamic
  evidenceTier?: EvidenceTier;
  resolution?: ResolutionMode;
  isPartial?: boolean;
  partialReason?: string;
  callSite?: { file: string; line: number };
}

export interface EndpointRoute {
  method: string;
  path: string;
  handlerId: string;
  handlerName: string;
  authenticated: boolean;
  depth: number;
  callChain: string[]; // Node names leading from modified symbol to this endpoint
  regressionState: 'existing test selected' | 'coverage stub required';
  evidenceTier: EvidenceTier; // 'CONFIRMED_STRUCTURAL' | 'HEURISTIC_INCOMPLETE' | 'VERIFICATION_REQUIRED'
  resolution: ResolutionMode;
  confidence: number;
  isPartial: boolean;
  partialReason?: string;
  verificationPath: VerificationPath;
}

export interface CheckpointContext {
  id?: string;
  intent: string;
  declaredScope?: string[];
  alteredInvariants?: string[];
  timestamp?: string;
}

export interface SecurityAlert {
  code: 'SG-UNAUTH-ROUTE' | 'SG-INTENT-SCOPE' | 'SG-AUTH-BYPASS' | 'SG-BOLA-RISK' | 'SG-DYNAMIC-DISPATCH-UNRESOLVED' | 'SG-PARTIAL-GRAPH-WARNING';
  severity: 'critical' | 'high' | 'medium' | 'low';
  route: string;
  message: string;
  evidence: string;
}

export interface TestSelection {
  existingTests: { name: string; file: string; targetsHandler: string }[];
  missingRoutes: EndpointRoute[];
  stubs: string[];
}

export interface BlastRadiusReport {
  modifiedSymbol: GraphNode;
  maxDepth: number;
  traversalNodesCount: number;
  checkpoint: CheckpointContext;
  impactedRoutes: EndpointRoute[];
  alerts: SecurityAlert[];
  testSelection: TestSelection;
  localRiskScore: number; // 1-10 deterministic score
  discrepancyDetected: boolean;
  completenessStatus: CompletenessStatus;
  partialAnalysis: PartialAnalysisMeta;
  evidenceBreakdown: {
    confirmed: number;
    heuristic: number;
    verificationRequired: number;
  };
}

/**
 * Split route strings like "POST /api/v1/webhook" into method and path
 */
export function splitRoute(routeStr: string): { method: string; path: string } {
  const parts = routeStr.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { method: parts[0].toUpperCase(), path: parts[1] };
  }
  return { method: 'HTTP', path: routeStr };
}

/**
 * Executes BFS traversal across reverse CALLS edges from a modified symbol
 * up to maxDepth hops, discovering all exposed routes and evaluating intent discrepancies.
 * 
 * Accurately classifies evidence into:
 *   1. Confirmed Structural Evidence (exact deterministic AST calls)
 *   2. Heuristic or Incomplete Evidence (dynamic dispatch, reflection, generated stubs)
 *   3. Claims Requiring Source / Test Verification (unverified invariant hypotheses)
 */
export function analyzeBlastRadius(
  nodes: GraphNode[],
  edges: CallEdge[],
  modifiedSymbolId: string,
  maxDepth: number = 4,
  checkpoint: CheckpointContext = { intent: 'internal helper update only' }
): BlastRadiusReport {
  const effectiveMaxDepth = Math.max(1, maxDepth);
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const targetNode = nodeMap.get(modifiedSymbolId);
  if (!targetNode) {
    throw new Error(`Modified symbol '${modifiedSymbolId}' was not found in the graph node index.`);
  }

  // Detect if root target itself uses dynamic dispatch / reflection
  const rootIsDynamic = Boolean(targetNode.dynamic || targetNode.hasReflection);

  // Build incoming call map: calleeId -> Array of CallEdge
  const incoming = new Map<string, CallEdge[]>();
  edges.forEach(e => {
    const list = incoming.get(e.to) || [];
    list.push(e);
    incoming.set(e.to, list);
  });

  // Track traversal details per visited caller node
  const depthMap = new Map<string, number>();
  const pathMap = new Map<string, string[]>();
  const confidenceMap = new Map<string, number>();
  const tierMap = new Map<string, EvidenceTier>();
  const resolutionMap = new Map<string, ResolutionMode>();
  const reasonsMap = new Map<string, string[]>();

  const queue: string[] = [targetNode.id];

  depthMap.set(targetNode.id, 0);
  pathMap.set(targetNode.id, [targetNode.name]);
  confidenceMap.set(targetNode.id, 1.0);
  tierMap.set(targetNode.id, rootIsDynamic ? 'HEURISTIC_INCOMPLETE' : 'CONFIRMED_STRUCTURAL');
  resolutionMap.set(targetNode.id, rootIsDynamic ? 'dynamic_reflection' : 'exact');
  reasonsMap.set(targetNode.id, rootIsDynamic ? ['Root modified symbol uses dynamic dispatch or reflection'] : []);

  let visitedCount = 0;
  let dynamicPatternsEncountered = false;
  const unresolvedCallSites: { filePath: string; line: number; detail: string }[] = [];

  if (rootIsDynamic) {
    dynamicPatternsEncountered = true;
    unresolvedCallSites.push({
      filePath: targetNode.file,
      line: targetNode.line,
      detail: targetNode.resolutionNote || 'Dynamic dispatch / reflection at modified symbol root'
    });
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    visitedCount++;
    const currentDepth = depthMap.get(currentId)!;
    const currentConfidence = confidenceMap.get(currentId)!;
    const currentTier = tierMap.get(currentId)!;
    const currentReasons = reasonsMap.get(currentId)!;

    if (currentDepth >= effectiveMaxDepth) {
      continue;
    }

    const inEdges = incoming.get(currentId) || [];
    for (const edge of inEdges) {
      const callerId = edge.from;
      const callerNode = nodeMap.get(callerId);
      const isDynamicEdge = Boolean(
        edge.isPartial || 
        (edge.confidence !== undefined && edge.confidence < 1.0) ||
        edge.resolution === 'dynamic_reflection' ||
        edge.resolution === 'unresolved_dispatch' ||
        (callerNode && (callerNode.dynamic || callerNode.hasReflection))
      );

      if (isDynamicEdge) {
        dynamicPatternsEncountered = true;
        if (edge.callSite) {
          unresolvedCallSites.push({
            filePath: edge.callSite.file,
            line: edge.callSite.line,
            detail: edge.partialReason || 'Dynamic reflection / dispatch edge'
          });
        }
      }

      const edgeConfidence = edge.confidence !== undefined ? edge.confidence : (isDynamicEdge ? 0.5 : 1.0);
      const cumulativeConfidence = Math.min(currentConfidence, edgeConfidence);

      const cumulativeTier: EvidenceTier = (currentTier === 'HEURISTIC_INCOMPLETE' || isDynamicEdge)
        ? 'HEURISTIC_INCOMPLETE'
        : 'CONFIRMED_STRUCTURAL';

      const cumulativeResolution: ResolutionMode = edge.resolution || (isDynamicEdge ? 'dynamic_reflection' : 'exact');

      const edgeReasons = [...currentReasons];
      if (edge.partialReason) {
        edgeReasons.push(edge.partialReason);
      } else if (isDynamicEdge) {
        edgeReasons.push(`Dynamic dispatch via ${callerNode ? callerNode.name : callerId}`);
      }

      if (!depthMap.has(callerId)) {
        depthMap.set(callerId, currentDepth + 1);
        const currentPath = pathMap.get(currentId) || [];
        const callerName = callerNode ? callerNode.name : callerId;
        pathMap.set(callerId, [...currentPath, callerName]);
        confidenceMap.set(callerId, cumulativeConfidence);
        tierMap.set(callerId, cumulativeTier);
        resolutionMap.set(callerId, cumulativeResolution);
        reasonsMap.set(callerId, edgeReasons);
        queue.push(callerId);
      }
    }
  }

  // Find tested handlers from test nodes in the graph
  const testedHandlers = new Set<string>();
  const existingTests: { name: string; file: string; targetsHandler: string }[] = [];

  nodes.forEach(n => {
    if (n.testFile || n.file.includes('_test.') || n.file.includes('.test.') || n.name.startsWith('Test')) {
      edges.forEach(e => {
        if (e.from === n.id) {
          testedHandlers.add(e.to);
          const testedNode = nodeMap.get(e.to);
          if (testedNode && testedNode.route) {
            existingTests.push({
              name: n.name,
              file: n.file,
              targetsHandler: testedNode.name
            });
          }
        }
      });
    }
  });

  // Identify reachable endpoints
  const impactedRoutes: EndpointRoute[] = [];

  depthMap.forEach((hops, id) => {
    if (hops === 0 && !targetNode.route) return; // skip target if it isn't an endpoint itself
    const node = nodeMap.get(id);
    if (!node || !node.route) return;

    const { method, path } = splitRoute(node.route);
    const isAuthenticated = node.auth === 'authenticated' || (node.auth !== 'unauthenticated' && !path.includes('/webhook') && !path.includes('/public'));
    const isTested = testedHandlers.has(node.id);

    const tier = tierMap.get(id) || 'CONFIRMED_STRUCTURAL';
    const resolution = resolutionMap.get(id) || 'exact';
    const confidence = confidenceMap.get(id) ?? 1.0;
    const isPartial = tier === 'HEURISTIC_INCOMPLETE' || confidence < 1.0;
    const reasons = reasonsMap.get(id) || [];
    const partialReason = reasons.length > 0 ? reasons.join('; ') : undefined;

    // Build verification path
    const testFileName = node.file.replace(/\.go$/, '_test.go').replace(/\.ts$/, '.test.ts');
    const verifyCommand = isPartial
      ? `VERIFY: go test -v ./${node.file.split('/')[0]}/${node.file.split('/')[1] || '...'} -run Test${sanitizeIdentifier(node.name)}_DynamicDispatchRegression`
      : `VERIFY: go test -v ./${node.file.split('/')[0]}/${node.file.split('/')[1] || '...'} -run Test${sanitizeIdentifier(node.name)}`;

    const guidance = isPartial
      ? `Dynamic dispatch / reflection present in path: execute dynamic integration tests before assuming route isolation.`
      : `Deterministic AST edge confirmed: verify standard regression suite.`;

    const verificationPath: VerificationPath = {
      verifyCommand,
      sourceRange: { filePath: node.file, startLine: node.line, endLine: node.line + 20 },
      guidance,
      testFile: testFileName
    };

    impactedRoutes.push({
      method,
      path,
      handlerId: node.id,
      handlerName: node.name,
      authenticated: isAuthenticated,
      depth: hops,
      callChain: pathMap.get(id) || [node.name],
      regressionState: isTested ? 'existing test selected' : 'coverage stub required',
      evidenceTier: tier,
      resolution,
      confidence,
      isPartial,
      partialReason,
      verificationPath
    });
  });

  // Sort impacted routes: shortest depth first, then path
  impactedRoutes.sort((a, b) => (a.depth !== b.depth ? a.depth - b.depth : a.path.localeCompare(b.path)));

  // Invariant Auditing against Checkpoint Intent
  const alerts = evaluateSecurityInvariants(checkpoint, impactedRoutes, targetNode, dynamicPatternsEncountered);

  // Derive test selection obligations
  const missingRoutes = impactedRoutes.filter(r => r.regressionState === 'coverage stub required');
  const stubs = missingRoutes.map(r => 
    `Test${sanitizeIdentifier(r.handlerName)}_${r.method}_Regression: exercise ${r.method} ${r.path} and assert authorization + input validation`
  );

  // Calculate Deterministic Local Risk Score (1 to 10)
  const localRiskScore = calculateRiskScore(impactedRoutes, alerts);

  const discrepancyDetected = alerts.some(a => a.code === 'SG-INTENT-SCOPE' || a.code === 'SG-UNAUTH-ROUTE' || a.code === 'SG-DYNAMIC-DISPATCH-UNRESOLVED');

  const completenessStatus: CompletenessStatus = dynamicPatternsEncountered ? 'PARTIAL_ANALYSIS' : 'FULLY_RESOLVED';

  const confirmedCount = impactedRoutes.filter(r => r.evidenceTier === 'CONFIRMED_STRUCTURAL').length;
  const heuristicCount = impactedRoutes.filter(r => r.evidenceTier === 'HEURISTIC_INCOMPLETE').length;
  const verificationRequiredCount = missingRoutes.length + (dynamicPatternsEncountered ? 1 : 0);

  const partialAnalysisMeta: PartialAnalysisMeta = {
    isPartial: dynamicPatternsEncountered,
    detectedPatterns: dynamicPatternsEncountered ? ['DYNAMIC_DISPATCH', 'REFLECTION'] : [],
    reasons: dynamicPatternsEncountered
      ? ['Dynamic dispatch or reflection detected in call hierarchy; static analysis cannot guarantee complete reachability.']
      : [],
    unresolvedCallSites,
    safeFallbackActive: dynamicPatternsEncountered,
    conservativeBoundingNote: dynamicPatternsEncountered
      ? 'Conservative bounding fallback active: potential downstream routes included heuristically. Never assume 0 blast radius under dynamic dispatch.'
      : 'Full AST static resolution: all graph relationships verified with deterministic evidence.'
  };

  return {
    modifiedSymbol: targetNode,
    maxDepth: effectiveMaxDepth,
    traversalNodesCount: visitedCount,
    checkpoint,
    impactedRoutes,
    alerts,
    testSelection: {
      existingTests,
      missingRoutes,
      stubs
    },
    localRiskScore,
    discrepancyDetected,
    completenessStatus,
    partialAnalysis: partialAnalysisMeta,
    evidenceBreakdown: {
      confirmed: confirmedCount,
      heuristic: heuristicCount,
      verificationRequired: verificationRequiredCount
    }
  };
}

/**
 * Checks developer intent from Checkpoint against reachable public endpoints.
 */
export function evaluateSecurityInvariants(
  checkpoint: CheckpointContext,
  routes: EndpointRoute[],
  targetNode: GraphNode,
  dynamicAnalysisEncountered: boolean = false
): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];
  const intentText = (checkpoint.intent + ' ' + (checkpoint.declaredScope || []).join(' ')).toLowerCase();

  const claimsInternalOnly = 
    intentText.includes('internal') ||
    intentText.includes('helper') ||
    intentText.includes('refactor') ||
    intentText.includes('cleanup') ||
    intentText.includes('format') ||
    intentText.includes('optimization');

  // Dynamic dispatch partial analysis warning alert
  if (dynamicAnalysisEncountered) {
    alerts.push({
      code: 'SG-DYNAMIC-DISPATCH-UNRESOLVED',
      severity: 'high',
      route: 'DYNAMIC_BOUNDARY',
      message: 'Dynamic dispatch or reflection encountered in AST traversal. Graph relationships must not be treated as certain without test verification.',
      evidence: `Unresolved dynamic boundaries in ${targetNode.file}:${targetNode.line}. Safe fallback and verification paths engaged.`
    });
  }

  routes.forEach(route => {
    const routeLabel = `${route.method} ${route.path}`;

    // Alert 1: Unauthenticated endpoint in blast radius
    if (!route.authenticated) {
      alerts.push({
        code: 'SG-UNAUTH-ROUTE',
        severity: 'high',
        route: routeLabel,
        message: `Unauthenticated public route is directly downstream of modified symbol '${targetNode.name}'.`,
        evidence: `Call chain: ${route.callChain.join(' -> ')} (depth: ${route.depth}) [Tier: ${route.evidenceTier}]`
      });
    }

    // Alert 2: Checkpoint intent contradiction
    if (claimsInternalOnly) {
      alerts.push({
        code: 'SG-INTENT-SCOPE',
        severity: 'high',
        route: routeLabel,
        message: `Checkpoint intent claims internal-only change ("${checkpoint.intent}"), but exposed route '${route.handlerName}' (${routeLabel}) is impacted.`,
        evidence: `Discrepancy: scope declared as '${checkpoint.declaredScope?.join(', ') || 'internal'}' leaks into external surface '${routeLabel}' [Resolution: ${route.resolution}]`
      });
    }

    // Alert 3: Broken Object-Level Authorization (BOLA) heuristic on webhook / id-parameterized routes
    if (route.path.includes(':') || route.path.includes('/webhook') || route.path.includes('/callback')) {
      alerts.push({
        code: 'SG-BOLA-RISK',
        severity: route.authenticated ? 'medium' : 'critical',
        route: routeLabel,
        message: `Dynamic resource identifier or webhook ingress in route '${routeLabel}' requires explicit tenant/auth validation check.`,
        evidence: `Handler '${route.handlerName}' in ${targetNode.file} touches sensitive data path.`
      });
    }
  });

  return alerts;
}

function sanitizeIdentifier(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, '_');
}

function calculateRiskScore(routes: EndpointRoute[], alerts: SecurityAlert[]): number {
  if (routes.length === 0) return 1;
  let score = 2 + routes.length * 2;
  alerts.forEach(a => {
    if (a.severity === 'critical') score += 4;
    else if (a.severity === 'high') score += 2;
    else if (a.severity === 'medium') score += 1;
  });
  return Math.min(10, Math.max(1, score));
}

