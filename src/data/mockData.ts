import { CodeSymbol, CodeRelation, BenchmarkSystem, GraphStats, DiffEntityChange } from '../types';

export const INITIAL_SYMBOLS: CodeSymbol[] = [
  {
    id: 'sym_search_exec',
    name: 'ExecuteSearch',
    qualifiedName: 'cli.ExecuteSearch',
    kind: 'function',
    language: 'go',
    filePath: 'internal/cli/search.go',
    lineStart: 42,
    lineEnd: 118,
    signature: 'func ExecuteSearch(ctx context.Context, repo string, query string, opts SearchOptions) (*SearchResult, error)',
    container: 'internal/cli',
    docComment: 'ExecuteSearch runs hybrid BM25 + AST-aware symbol ranking over working tree files with byte budgeting.',
    bodySnippet: `func ExecuteSearch(ctx context.Context, repo string, query string, opts SearchOptions) (*SearchResult, error) {
    matcher := sem.NewQueryMatcher(query, opts.Profile)
    rankedHits := matcher.ScoreRepository(repo, opts.TopK)
    
    // Apply byte-budget constraints if specified
    if opts.MaxContextBytes > 0 {
        rankedHits = sem.BudgetResults(rankedHits, opts.MaxContextBytes)
    }
    return FormatResults(rankedHits, opts.Format)
}`,
    dependentsCount: 18,
  },
  {
    id: 'sym_query_matcher',
    name: 'NewQueryMatcher',
    qualifiedName: 'sem.NewQueryMatcher',
    kind: 'function',
    language: 'go',
    filePath: 'internal/sem/search_matcher.go',
    lineStart: 18,
    lineEnd: 54,
    signature: 'func NewQueryMatcher(query string, profile ProfileMode) *QueryMatcher',
    container: 'internal/sem',
    docComment: 'NewQueryMatcher tokenizes query into camelCase/snake_case components and prepares AST weights.',
    bodySnippet: `func NewQueryMatcher(query string, profile ProfileMode) *QueryMatcher {
    terms := TokenizeQuery(query)
    return &QueryMatcher{
        terms:   terms,
        profile: profile,
        weights: CalculateWeights(profile),
    }
}`,
    dependentsCount: 9,
  },
  {
    id: 'sym_impact_calc',
    name: 'ComputeImpactRadius',
    qualifiedName: 'cli.ComputeImpactRadius',
    kind: 'function',
    language: 'go',
    filePath: 'internal/cli/impact.go',
    lineStart: 35,
    lineEnd: 92,
    signature: 'func ComputeImpactRadius(repo string, symbol string, depth int) (*ImpactReport, error)',
    container: 'internal/cli',
    docComment: 'ComputeImpactRadius computes blast radius including direct + transitive callers, type consumers, and co-changes.',
    bodySnippet: `func ComputeImpactRadius(repo string, symbol string, depth int) (*ImpactReport, error) {
    sym := sem.FindSymbol(repo, symbol)
    if sym == nil {
        return nil, fmt.Errorf("symbol %q not found", symbol)
    }
    callers := sem.TraceCallers(sym, depth)
    typeConsumers := sem.FindTypeConsumers(sym)
    coChanges := gitutil.GetCoChangeFiles(sym.FilePath)
    return &ImpactReport{
        Target:        sym,
        Callers:       callers,
        TypeConsumers: typeConsumers,
        CoChanges:     coChanges,
    }, nil
}`,
    dependentsCount: 12,
  },
  {
    id: 'sym_parse_ast',
    name: 'ParseTreeSitterAST',
    qualifiedName: 'sem.ParseTreeSitterAST',
    kind: 'function',
    language: 'go',
    filePath: 'internal/sem/parser.go',
    lineStart: 64,
    lineEnd: 140,
    signature: 'func ParseTreeSitterAST(lang string, source []byte) (*ASTNode, error)',
    container: 'internal/sem',
    docComment: 'ParseTreeSitterAST parses file source using embedded tree-sitter grammars without network access.',
    bodySnippet: `func ParseTreeSitterAST(lang string, source []byte) (*ASTNode, error) {
    parser := GetGrammarParser(lang)
    if parser == nil {
        return nil, ErrUnsupportedLanguage
    }
    tree := parser.Parse(source)
    defer tree.Close()
    return ExtractSemanticNodes(tree.RootNode())
}`,
    dependentsCount: 24,
  },
  {
    id: 'sym_trace_callers',
    name: 'TraceCallers',
    qualifiedName: 'sem.TraceCallers',
    kind: 'function',
    language: 'go',
    filePath: 'internal/sem/call_scanners.go',
    lineStart: 88,
    lineEnd: 156,
    signature: 'func TraceCallers(target *Symbol, maxDepth int) []CallEdge',
    container: 'internal/sem',
    docComment: 'TraceCallers traverses call graph backwards to find all immediate and two-hop callers.',
    bodySnippet: `func TraceCallers(target *Symbol, maxDepth int) []CallEdge {
    visited := make(map[string]bool)
    queue := []CallEdge{{Target: target, Depth: 0}}
    var results []CallEdge
    for len(queue) > 0 {
        curr := queue[0]
        queue = queue[1:]
        if curr.Depth >= maxDepth { continue }
        for _, inEdge := range curr.Target.IncomingEdges("CALLS") {
            if !visited[inEdge.From.ID] {
                visited[inEdge.From.ID] = true
                results = append(results, inEdge)
                queue = append(queue, CallEdge{Target: inEdge.From, Depth: curr.Depth + 1})
            }
        }
    }
    return results
}`,
    dependentsCount: 14,
  },
  {
    id: 'sym_trace_neighbors',
    name: 'TraceNeighbors',
    qualifiedName: 'cli.TraceNeighbors',
    kind: 'function',
    language: 'go',
    filePath: 'internal/cli/neighbors.go',
    lineStart: 28,
    lineEnd: 86,
    signature: 'func TraceNeighbors(repo string, symbol string, relation string, direction string, depth int) (*NeighborsResult, error)',
    container: 'internal/cli',
    docComment: 'TraceNeighbors returns direct incoming/outgoing relations for a symbol with source call sites.',
    bodySnippet: `func TraceNeighbors(repo string, symbol string, relation string, direction string, depth int) (*NeighborsResult, error) {
    target := sem.ResolveSymbol(repo, symbol)
    if target == nil {
        return nil, ErrSymbolNotFound
    }
    edges := sem.FindEdges(target, relation, direction, depth)
    return FormatNeighbors(edges)
}`,
    dependentsCount: 8,
  },
  {
    id: 'sym_build_compact',
    name: 'BuildCompactSnapshot',
    qualifiedName: 'sem.BuildCompactSnapshot',
    kind: 'function',
    language: 'go',
    filePath: 'internal/sem/compact_snapshot.go',
    lineStart: 45,
    lineEnd: 110,
    signature: 'func BuildCompactSnapshot(repo string, opts SnapshotOptions) (*CompactSnapshot, error)',
    container: 'internal/sem',
    docComment: 'BuildCompactSnapshot generates compact NDJSON stream of files, symbols, relations, and definitions.',
    bodySnippet: `func BuildCompactSnapshot(repo string, opts SnapshotOptions) (*CompactSnapshot, error) {
    files := gitutil.ListTrackedFiles(repo)
    snapshot := NewCompactSnapshot()
    for _, file := range files {
        symbols, edges := ParseFileSemantics(file)
        snapshot.Add(file, symbols, edges)
    }
    return snapshot, nil
}`,
    dependentsCount: 16,
  },
  {
    id: 'sym_diff_analyze',
    name: 'AnalyzeDiffRisk',
    qualifiedName: 'sem.AnalyzeDiffRisk',
    kind: 'function',
    language: 'go',
    filePath: 'internal/sem/analyze.go',
    lineStart: 32,
    lineEnd: 98,
    signature: 'func AnalyzeDiffRisk(baseRef string, headRef string) (*DiffRiskReport, error)',
    container: 'internal/sem',
    docComment: 'AnalyzeDiffRisk calculates entity-level differences and heuristic dependent counts.',
    bodySnippet: `func AnalyzeDiffRisk(baseRef string, headRef string) (*DiffRiskReport, error) {
    changes := gitutil.GetEntityDiff(baseRef, headRef)
    for i, ch := range changes {
        if ch.Type == "SIGNATURE_CHANGED" {
            deps := sem.CountDependents(ch.SymbolID)
            changes[i].DependentsCount = deps
        }
    }
    return &DiffRiskReport{Changes: changes}, nil
}`,
    dependentsCount: 7,
  },
  {
    id: 'sym_git_tracked',
    name: 'ListTrackedFiles',
    qualifiedName: 'gitutil.ListTrackedFiles',
    kind: 'function',
    language: 'go',
    filePath: 'internal/gitutil/git.go',
    lineStart: 50,
    lineEnd: 88,
    signature: 'func ListTrackedFiles(repoPath string) ([]string, error)',
    container: 'internal/gitutil',
    docComment: 'ListTrackedFiles lists all tracked repository files respecting .gitignore and .graphignore.',
    bodySnippet: `func ListTrackedFiles(repoPath string) ([]string, error) {
    cmd := exec.Command("git", "ls-files", "-z")
    cmd.Dir = repoPath
    out, err := cmd.Output()
    if err != nil { return nil, err }
    return ParseNulSeparated(out), nil
}`,
    dependentsCount: 15,
  },
  {
    id: 'sym_verify_suite',
    name: 'VerifyTestSuite',
    qualifiedName: 'cli.VerifyTestSuite',
    kind: 'function',
    language: 'go',
    filePath: 'internal/cli/verify.go',
    lineStart: 25,
    lineEnd: 74,
    signature: 'func VerifyTestSuite(command string) (*VerifyVerdict, error)',
    container: 'internal/cli',
    docComment: 'VerifyTestSuite runs test suite command safely and evaluates pass/fail status.',
    bodySnippet: `func VerifyTestSuite(command string) (*VerifyVerdict, error) {
    out, err := execCommandSafely(command)
    verdict := ParseTestOutput(out)
    return verdict, err
}`,
    dependentsCount: 5,
  },
  {
    id: 'sym_stats_calc',
    name: 'CalculateSessionSavings',
    qualifiedName: 'cli.CalculateSessionSavings',
    kind: 'function',
    language: 'go',
    filePath: 'internal/cli/stats.go',
    lineStart: 55,
    lineEnd: 115,
    signature: 'func CalculateSessionSavings(sessionsDir string) (*StatsReport, error)',
    container: 'internal/cli',
    docComment: 'CalculateSessionSavings computes token savings by comparing graph calls against whole-file reads.',
    bodySnippet: `func CalculateSessionSavings(sessionsDir string) (*StatsReport, error) {
    transcripts := ReadSessionTranscripts(sessionsDir)
    var totalTokensSaved int64
    for _, t := range transcripts {
        replacedReads := t.CountGraphInvocations()
        totalTokensSaved += int64(replacedReads) * 3200 // median file token size
    }
    return &StatsReport{TokensSaved: totalTokensSaved}, nil
}`,
    dependentsCount: 4,
  },
  {
    id: 'sym_budget_results',
    name: 'BudgetResults',
    qualifiedName: 'sem.BudgetResults',
    kind: 'function',
    language: 'go',
    filePath: 'internal/sem/search_needle.go',
    lineStart: 40,
    lineEnd: 85,
    signature: 'func BudgetResults(results []SearchHit, maxBytes int) []SearchHit',
    container: 'internal/sem',
    docComment: 'BudgetResults truncates search snippets to strictly fit agent context byte budgets.',
    bodySnippet: `func BudgetResults(results []SearchHit, maxBytes int) []SearchHit {
    total := 0
    var retained []SearchHit
    for _, r := range results {
        size := len(r.Snippet) + len(r.Signature) + 64
        if total + size > maxBytes { break }
        retained = append(retained, r)
        total += size
    }
    return retained
}`,
    dependentsCount: 8,
  },
  {
    id: 'sym_plugin_dispatcher',
    name: 'DispatchPluginCommand',
    qualifiedName: 'plugins.DispatchPluginCommand',
    kind: 'function',
    language: 'go',
    filePath: 'internal/plugins/dispatcher.go',
    lineStart: 48,
    lineEnd: 95,
    signature: 'func DispatchPluginCommand(ctx context.Context, cmdName string, payload []byte) (any, error)',
    container: 'internal/plugins',
    docComment: 'DispatchPluginCommand dynamically dispatches plugin invocations using reflect.ValueOf().MethodByName.',
    bodySnippet: `func DispatchPluginCommand(ctx context.Context, cmdName string, payload []byte) (any, error) {
    // Dynamic reflection and string dispatch boundary
    plugin, exists := pluginRegistry[cmdName]
    if !exists { return nil, ErrUnknownPlugin }
    val := reflect.ValueOf(plugin)
    method := val.MethodByName("Process")
    res := method.Call([]reflect.Value{reflect.ValueOf(ctx), reflect.ValueOf(payload)})
    return res[0].Interface(), nil
}`,
    dependentsCount: 12,
  }
];

export const INITIAL_RELATIONS: CodeRelation[] = [
  {
    id: 'rel_1',
    fromId: 'sym_search_exec',
    toId: 'sym_query_matcher',
    fromName: 'ExecuteSearch',
    toName: 'NewQueryMatcher',
    relation: 'CALLS',
    confidence: 1.0,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'exact',
    isPartial: false,
    callSite: { filePath: 'internal/cli/search.go', line: 44 }
  },
  {
    id: 'rel_2',
    fromId: 'sym_search_exec',
    toId: 'sym_budget_results',
    fromName: 'ExecuteSearch',
    toName: 'BudgetResults',
    relation: 'CALLS',
    confidence: 1.0,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'exact',
    isPartial: false,
    callSite: { filePath: 'internal/cli/search.go', line: 49 }
  },
  {
    id: 'rel_3',
    fromId: 'sym_impact_calc',
    toId: 'sym_trace_callers',
    fromName: 'ComputeImpactRadius',
    toName: 'TraceCallers',
    relation: 'CALLS',
    confidence: 1.0,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'exact',
    isPartial: false,
    callSite: { filePath: 'internal/cli/impact.go', line: 41 }
  },
  {
    id: 'rel_4',
    fromId: 'sym_trace_neighbors',
    toId: 'sym_trace_callers',
    fromName: 'TraceNeighbors',
    toName: 'TraceCallers',
    relation: 'CALLS',
    confidence: 0.95,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'exact',
    isPartial: false,
    callSite: { filePath: 'internal/cli/neighbors.go', line: 36 }
  },
  {
    id: 'rel_5',
    fromId: 'sym_build_compact',
    toId: 'sym_git_tracked',
    fromName: 'BuildCompactSnapshot',
    toName: 'ListTrackedFiles',
    relation: 'CALLS',
    confidence: 1.0,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'exact',
    isPartial: false,
    callSite: { filePath: 'internal/sem/compact_snapshot.go', line: 46 }
  },
  {
    id: 'rel_6',
    fromId: 'sym_build_compact',
    toId: 'sym_parse_ast',
    fromName: 'BuildCompactSnapshot',
    toName: 'ParseTreeSitterAST',
    relation: 'CALLS',
    confidence: 1.0,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'exact',
    isPartial: false,
    callSite: { filePath: 'internal/sem/compact_snapshot.go', line: 51 }
  },
  {
    id: 'rel_7',
    fromId: 'sym_diff_analyze',
    toId: 'sym_trace_callers',
    fromName: 'AnalyzeDiffRisk',
    toName: 'TraceCallers',
    relation: 'CALLS',
    confidence: 0.9,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'exact',
    isPartial: false,
    callSite: { filePath: 'internal/sem/analyze.go', line: 42 }
  },
  {
    id: 'rel_8',
    fromId: 'sym_query_matcher',
    toId: 'sym_parse_ast',
    fromName: 'NewQueryMatcher',
    toName: 'ParseTreeSitterAST',
    relation: 'USES_TYPE',
    confidence: 0.85,
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    resolution: 'type_inferred',
    isPartial: false,
    callSite: { filePath: 'internal/sem/search_matcher.go', line: 22 }
  },
  {
    id: 'rel_9',
    fromId: 'sym_plugin_dispatcher',
    toId: 'sym_search_exec',
    fromName: 'DispatchPluginCommand',
    toName: 'ExecuteSearch',
    relation: 'CALLS',
    confidence: 0.55,
    evidenceTier: 'HEURISTIC_INCOMPLETE',
    resolution: 'dynamic_reflection',
    isPartial: true,
    partialReason: 'Reflective method invocation MethodByName at internal/plugins/dispatcher.go:52',
    verificationCommand: 'VERIFY: go test -v ./internal/plugins/... -run TestPluginDynamicDispatch',
    callSite: { filePath: 'internal/plugins/dispatcher.go', line: 52 }
  }
];

export const BENCHMARKS: BenchmarkSystem[] = [
  {
    name: 'entire-graph',
    locomoScore: 94.74,
    indexTokens: '0',
    tokensNumeric: 0,
    version: '#104 branch / v0.4.0',
    isEntireGraph: true,
    notes: 'Parsed locally with tree-sitter AST; 0 model calls, 0 network requests, 0 API tokens at index time.'
  },
  {
    name: 'mem0',
    locomoScore: 93.83,
    indexTokens: '50.85M',
    tokensNumeric: 50850000,
    version: 'commit 4debc58',
    notes: 'Requires LLM embedding & entity extraction pipeline costing 50+ million tokens.'
  },
  {
    name: 'cognee',
    locomoScore: 92.86,
    indexTokens: '12.35M',
    tokensNumeric: 12350000,
    version: 'commit 38eece5',
    notes: 'Cognitive memory graph generator requiring 12.35 million LLM tokens.'
  },
  {
    name: 'bm25 (lexical baseline)',
    locomoScore: 91.88,
    indexTokens: '0',
    tokensNumeric: 0,
    version: 'v0.2.2',
    notes: 'Lexical term frequency search with no AST or structural relational edges.'
  },
  {
    name: 'codebase-memory-mcp (cmm)',
    locomoScore: 91.30,
    indexTokens: '0',
    tokensNumeric: 0,
    version: 'v0.9.0 patched',
    notes: 'Modified to emit Markdown sections for MCP coding agents.'
  },
  {
    name: 'graphify',
    locomoScore: 87.34,
    indexTokens: '0',
    tokensNumeric: 0,
    version: 'unpinned',
    notes: 'Heuristic code graph representation.'
  },
  {
    name: 'letta',
    locomoScore: 84.68,
    indexTokens: 'N/A',
    tokensNumeric: 25000000,
    version: 'v0.16.8',
    notes: 'Stateful memory agent framework.'
  },
  {
    name: 'supermemory',
    locomoScore: 82.08,
    indexTokens: 'Hosted',
    tokensNumeric: 15000000,
    version: 'v0.0.7-rc.2 patched',
    notes: 'Cloud service with 100-item retrieval cap.'
  }
];

export const MOCK_STATS: GraphStats = {
  sessionsAnalyzed: 142,
  graphCalls: 489,
  grepReadCallsReplaced: 1215,
  tokensSavedEstimate: 3888000,
  graphFirstRate: 88.4,
  averageSearchLatencyMs: 14.2
};

export const MOCK_DIFF_CHANGES: DiffEntityChange[] = [
  {
    symbolName: 'sem.ParseTreeSitterAST',
    filePath: 'internal/sem/parser.go',
    changeType: 'SIGNATURE_CHANGED',
    dependentsCount: 24,
    riskLevel: 'HIGH',
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    isPartial: false,
    oldSignature: 'func ParseTreeSitterAST(lang string, source []byte) (*ASTNode, error)',
    newSignature: 'func ParseTreeSitterAST(ctx context.Context, lang string, source []byte, opts ...ParseOption) (*ASTNode, error)',
    diffSummary: 'Added context.Context and variadic ParseOption arguments; affects 24 downstream callers.',
    verificationAction: 'go test ./internal/sem/... -run TestParseTreeSitterAST'
  },
  {
    symbolName: 'plugins.DispatchPluginCommand',
    filePath: 'internal/plugins/dispatcher.go',
    changeType: 'BODY_CHANGED',
    dependentsCount: 12,
    riskLevel: 'HIGH',
    evidenceTier: 'HEURISTIC_INCOMPLETE',
    isPartial: true,
    diffSummary: 'Added reflection-based MethodByName invocation. Static graph analysis is partial; requires test execution to verify route isolation.',
    verificationAction: 'VERIFY: go test -v ./internal/plugins/... -run TestPluginDynamicDispatch'
  },
  {
    symbolName: 'cli.ExecuteSearch',
    filePath: 'internal/cli/search.go',
    changeType: 'BODY_CHANGED',
    dependentsCount: 18,
    riskLevel: 'MEDIUM',
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    isPartial: false,
    diffSummary: 'Optimized hybrid scoring algorithm with fast camelCase prefix tree filter.',
    verificationAction: 'go test ./internal/cli/... -run TestSearch'
  },
  {
    symbolName: 'gitutil.ListTrackedFiles',
    filePath: 'internal/gitutil/git.go',
    changeType: 'BODY_CHANGED',
    dependentsCount: 15,
    riskLevel: 'LOW',
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    isPartial: false,
    diffSummary: 'Added symlink cycle protection and safer ignore path handling.'
  },
  {
    symbolName: 'cli.VerifyTestSuite',
    filePath: 'internal/cli/verify.go',
    changeType: 'ADDED',
    dependentsCount: 5,
    riskLevel: 'LOW',
    evidenceTier: 'CONFIRMED_STRUCTURAL',
    isPartial: false,
    newSignature: 'func VerifyTestSuite(command string) (*VerifyVerdict, error)',
    diffSummary: 'Added new automated post-change test runner and test result parser.'
  }
];
