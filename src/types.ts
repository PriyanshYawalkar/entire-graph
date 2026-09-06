export type SymbolKind =
  | 'function'
  | 'method'
  | 'struct'
  | 'interface'
  | 'type'
  | 'constant'
  | 'variable'
  | 'route_handler';

export type RelationType =
  | 'CALLS'
  | 'IMPORTS'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'HANDLES_ROUTE'
  | 'USES_TYPE'
  | 'PARAM_TYPE'
  | 'RETURNS_TYPE'
  | 'FIELD_OF'
  | 'CO_CHANGES_WITH';

/**
 * Three-tier Evidence Classification
 * Differentiates verified facts from heuristic or unverified claims.
 */
export type EvidenceTier = 
  | 'CONFIRMED_STRUCTURAL'   // Direct static AST calls/definitions, verified call-site in source (100% certainty)
  | 'HEURISTIC_INCOMPLETE'   // Dynamic dispatch, reflection, generated stubs, type inference without exact receiver (heuristic, <100%)
  | 'VERIFICATION_REQUIRED'; // Unreached/dynamic hypothesis, unverified claims requiring source inspection or test execution

export type ResolutionMode = 
  | 'exact' 
  | 'package' 
  | 'import_resolved' 
  | 'type_inferred' 
  | 'dynamic_reflection' 
  | 'generated_stub' 
  | 'unresolved_dispatch';

export type CompletenessStatus = 'FULLY_RESOLVED' | 'PARTIAL_ANALYSIS' | 'DEGRADED_UNSAFE';

export interface VerificationPath {
  verifyCommand: string;
  sourceRange?: { filePath: string; startLine: number; endLine: number };
  guidance: string;
  testFile?: string;
}

export interface VerificationRecord {
  verifiedAt: string;
  verifiedBy: string;
  method: 'MANUAL_CONFIRMATION' | 'LINKED_TEST_CASE';
  decision?: 'CONFIRMED_REACHABLE' | 'CONFIRMED_GUARDED_UNREACHABLE';
  manualRationale?: string;
  attestedByDeveloper?: boolean;
  linkedTestCase?: {
    testName: string;
    testFile?: string;
    verifyCommand: string;
    status: 'PASSED' | 'VERIFIED' | 'PENDING';
    runOutput?: string;
  };
}

export interface PartialAnalysisMeta {
  isPartial: boolean;
  detectedPatterns: ('DYNAMIC_DISPATCH' | 'REFLECTION' | 'GENERATED_CODE' | 'INTERFACE_FANOUT' | 'STRING_ROUTING')[];
  reasons: string[];
  unresolvedCallSites: { filePath: string; line: number; detail: string }[];
  safeFallbackActive: boolean;
  conservativeBoundingNote: string;
}

export interface CodeSymbol {
  id: string;
  name: string;
  qualifiedName: string;
  kind: SymbolKind;
  language: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  signature: string;
  container?: string;
  docComment?: string;
  bodySnippet: string;
  dependentsCount?: number;
}

export interface CodeRelation {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  relation: RelationType;
  confidence: number;
  callSite?: {
    filePath: string;
    line: number;
  };
  evidenceTier?: EvidenceTier;
  resolution?: ResolutionMode;
  isPartial?: boolean;
  partialReason?: string;
  verificationCommand?: string;
}

export interface SearchMatch {
  symbolId: string;
  name: string;
  filePath: string;
  line: number;
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  kind: SymbolKind;
  signature: string;
  matchedSnippet: string;
  reason: string;
  callees?: string[];
  callers?: string[];
  evidenceTier?: EvidenceTier;
  isPartial?: boolean;
  verificationPrompt?: string;
}

export interface ImpactAnalysis {
  targetSymbol: CodeSymbol;
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskJustification: string;
  directCallers: CodeSymbol[];
  transitiveCallers: CodeSymbol[];
  callees: CodeSymbol[];
  typeConsumers: CodeSymbol[];
  coChangeFiles: { path: string; coChangeFrequency: number }[];
  siblings: CodeSymbol[];
  verifyCommand: string;
  evidenceTier?: EvidenceTier;
  isPartial?: boolean;
  completenessStatus?: CompletenessStatus;
  partialDetails?: PartialAnalysisMeta;
}

export interface DiffEntityChange {
  symbolName: string;
  filePath: string;
  changeType: 'ADDED' | 'REMOVED' | 'SIGNATURE_CHANGED' | 'BODY_CHANGED' | 'RENAMED';
  dependentsCount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  oldSignature?: string;
  newSignature?: string;
  diffSummary: string;
  evidenceTier?: EvidenceTier;
  isPartial?: boolean;
  verificationAction?: string;
  verificationRecord?: VerificationRecord;
}

export interface BenchmarkSystem {
  name: string;
  locomoScore: number;
  indexTokens: string;
  tokensNumeric: number;
  version: string;
  isEntireGraph?: boolean;
  notes: string;
}

export interface GraphStats {
  sessionsAnalyzed: number;
  graphCalls: number;
  grepReadCallsReplaced: number;
  tokensSavedEstimate: number;
  graphFirstRate: number;
  averageSearchLatencyMs: number;
}

// SentryGraph Security Types
export interface SentryRoute {
  method: string;
  path: string;
  handler_id?: string;
  handler_name: string;
  authenticated: boolean;
  depth: number;
  regression_state: 'existing test selected' | 'coverage stub required' | string;
  evidence_tier?: EvidenceTier;
  resolution?: ResolutionMode;
  confidence?: number;
  is_partial?: boolean;
  partial_reason?: string;
  verification_path?: VerificationPath;
  verification_record?: VerificationRecord;
}

export interface SentryAlert {
  code: string;
  severity: 'high' | 'medium' | 'low';
  route: string;
  message: string;
  evidence?: string;
}

export interface SentryTestSelection {
  existing_tests: { name: string; file?: string }[];
  missing_routes?: SentryRoute[];
  stubs: string[];
}

export interface SentryReport {
  modified_symbols: { name: string; file?: string; line?: number }[];
  max_depth: number;
  checkpoint: { intent?: string; declared_scope?: string[] };
  impacted_routes: SentryRoute[];
  alerts: SentryAlert[];
  test_selection: SentryTestSelection;
  local_risk_score: number;
  completeness_status?: CompletenessStatus;
  partial_analysis?: PartialAnalysisMeta;
  evidence_breakdown?: {
    confirmed_count: number;
    heuristic_count: number;
    verification_required_count: number;
  };
}

export interface SentryIntelligence {
  risk_score: number;
  classifications: string[];
  recommendations: string[];
  source: 'databricks' | 'local-rules';
}

export interface SentryScan {
  report: SentryReport;
  intelligence: SentryIntelligence;
}

