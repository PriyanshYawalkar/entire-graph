// Package sentry turns structural call graphs into security-focused blast-radius reports.
package sentry

import (
	"bytes"
	"fmt"
	"io"
	"sort"
	"strings"
)

// SymbolNode is a code-graph vertex. Public marks a handler deliberately exposed
// to callers; Route holds the HTTP method and path when this node handles a route.
type SymbolNode struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	File     string `json:"file,omitempty"`
	Line     int    `json:"line,omitempty"`
	Public   bool   `json:"public,omitempty"`
	Route    string `json:"route,omitempty"`
	Auth     string `json:"auth,omitempty"`
	TestFile bool   `json:"test_file,omitempty"`
}

// CallEdge points from caller to callee.
type CallEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// EndpointRoute is an HTTP surface found in the blast radius.
type EndpointRoute struct {
	Method          string `json:"method"`
	Path            string `json:"path"`
	HandlerID       string `json:"handler_id"`
	HandlerName     string `json:"handler_name"`
	Authenticated   bool   `json:"authenticated"`
	Depth           int    `json:"depth"`
	RegressionState string `json:"regression_state"`
}

// CheckpointContext is developer-supplied intent. It is intentionally a small,
// auditable payload suitable for checkpoint metadata or local JSON input.
type CheckpointContext struct {
	Intent            string   `json:"intent"`
	DeclaredScope     []string `json:"declared_scope,omitempty"`
	AlteredInvariants []string `json:"altered_invariants,omitempty"`
}

// SecurityAlert is a deterministic finding with evidence, never an opaque score.
type SecurityAlert struct {
	Code     string `json:"code"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	Route    string `json:"route,omitempty"`
}

// TestSelection identifies existing tests to run and safe stubs for untested routes.
type TestSelection struct {
	ExistingTests []SymbolNode    `json:"existing_tests"`
	MissingRoutes []EndpointRoute `json:"missing_routes"`
	Stubs         []string        `json:"stubs"`
}

// Report is the local structural result. Intelligence may enrich it, but never
// replaces the graph evidence captured here.
type Report struct {
	Modified       []SymbolNode      `json:"modified_symbols"`
	MaxDepth       int               `json:"max_depth"`
	Routes         []EndpointRoute   `json:"impacted_routes"`
	Alerts         []SecurityAlert   `json:"alerts"`
	TestSelection  TestSelection     `json:"test_selection"`
	LocalRiskScore int               `json:"local_risk_score"`
	Checkpoint     CheckpointContext `json:"checkpoint"`
}

// Analyze walks reverse CALLS edges from modified IDs. It uses breadth-first
// traversal so each result has a shortest, explainable depth.
func Analyze(nodes []SymbolNode, edges []CallEdge, modifiedIDs []string, maxDepth int, checkpoint CheckpointContext) Report {
	if maxDepth < 1 {
		maxDepth = 1
	}
	byID := make(map[string]SymbolNode, len(nodes))
	incoming := make(map[string][]string, len(nodes))
	for _, node := range nodes {
		byID[node.ID] = node
	}
	for _, edge := range edges {
		incoming[edge.To] = append(incoming[edge.To], edge.From)
	}

	report := Report{MaxDepth: maxDepth, Checkpoint: checkpoint}
	depth := make(map[string]int, len(nodes))
	queue := make([]string, 0, len(modifiedIDs))
	for _, id := range modifiedIDs {
		if node, ok := byID[id]; ok {
			report.Modified = append(report.Modified, node)
			depth[id] = 0
			queue = append(queue, id)
		}
	}
	for head := 0; head < len(queue); head++ {
		callee := queue[head]
		if depth[callee] >= maxDepth {
			continue
		}
		for _, caller := range incoming[callee] {
			if _, seen := depth[caller]; seen {
				continue
			}
			depth[caller] = depth[callee] + 1
			queue = append(queue, caller)
		}
	}

	testedHandlers := map[string]bool{}
	for _, node := range nodes {
		if !node.TestFile {
			continue
		}
		for _, edge := range edges {
			if edge.From == node.ID {
				testedHandlers[edge.To] = true
			}
		}
	}
	for id, hops := range depth {
		node := byID[id]
		if node.Route == "" {
			continue
		}
		method, path := splitRoute(node.Route)
		route := EndpointRoute{Method: method, Path: path, HandlerID: node.ID, HandlerName: node.Name, Authenticated: strings.EqualFold(node.Auth, "authenticated"), Depth: hops}
		if testedHandlers[node.ID] {
			route.RegressionState = "existing test selected"
		} else {
			route.RegressionState = "coverage stub required"
		}
		report.Routes = append(report.Routes, route)
	}
	sort.Slice(report.Routes, func(i, j int) bool {
		if report.Routes[i].Depth != report.Routes[j].Depth {
			return report.Routes[i].Depth < report.Routes[j].Depth
		}
		return report.Routes[i].Path < report.Routes[j].Path
	})
	report.Alerts = verifyIntent(checkpoint, report.Routes)
	report.TestSelection = selectTests(nodes, edges, report.Routes, testedHandlers)
	report.LocalRiskScore = localRisk(report.Routes, report.Alerts)
	return report
}

func splitRoute(route string) (string, string) {
	fields := strings.Fields(route)
	if len(fields) >= 2 {
		return fields[0], fields[1]
	}
	return "HTTP", route
}

func verifyIntent(ctx CheckpointContext, routes []EndpointRoute) []SecurityAlert {
	claim := strings.ToLower(ctx.Intent + " " + strings.Join(ctx.DeclaredScope, " "))
	internalOnly := strings.Contains(claim, "internal") || strings.Contains(claim, "helper") || strings.Contains(claim, "refactor")
	var alerts []SecurityAlert
	for _, route := range routes {
		label := route.Method + " " + route.Path
		if !route.Authenticated {
			alerts = append(alerts, SecurityAlert{Code: "SG-UNAUTH-ROUTE", Severity: "high", Route: label, Message: "unauthenticated endpoint is in the structural blast radius"})
		}
		if internalOnly {
			alerts = append(alerts, SecurityAlert{Code: "SG-INTENT-SCOPE", Severity: "high", Route: label, Message: "checkpoint claims an internal-only change, but a public HTTP handler is impacted"})
		}
	}
	return alerts
}

func selectTests(nodes []SymbolNode, edges []CallEdge, routes []EndpointRoute, tested map[string]bool) TestSelection {
	result := TestSelection{}
	for _, node := range nodes {
		if !node.TestFile {
			continue
		}
		for _, edge := range edges {
			if edge.From == node.ID && tested[edge.To] {
				result.ExistingTests = append(result.ExistingTests, node)
				break
			}
		}
	}
	for _, route := range routes {
		if route.RegressionState == "existing test selected" {
			continue
		}
		result.MissingRoutes = append(result.MissingRoutes, route)
		result.Stubs = append(result.Stubs, fmt.Sprintf("Test%s_%s_Regression: exercise %s %s and assert authorization + input validation", safeName(route.HandlerName), safeName(route.Method), route.Method, route.Path))
	}
	sort.Slice(result.ExistingTests, func(i, j int) bool { return result.ExistingTests[i].Name < result.ExistingTests[j].Name })
	return result
}

func safeName(value string) string {
	value = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' {
			return r
		}
		return '_'
	}, value)
	return strings.Trim(value, "_")
}
func localRisk(routes []EndpointRoute, alerts []SecurityAlert) int {
	score := 1
	for _, route := range routes {
		score += 2
		if !route.Authenticated {
			score += 3
		}
	}
	for _, alert := range alerts {
		if alert.Severity == "high" {
			score++
		}
	}
	if score > 10 {
		return 10
	}
	return score
}

// WriteText renders a concise report intended for a security review terminal.
func WriteText(out io.Writer, report Report, intelligence IntelligenceResult) error {
	var buffer bytes.Buffer
	fmt.Fprintf(&buffer, "SentryGraph security blast-radius report\n")
	fmt.Fprintf(&buffer, "Modified symbols (%d), traversal depth: %d\n", len(report.Modified), report.MaxDepth)
	for _, node := range report.Modified {
		fmt.Fprintf(&buffer, "- %s (%s:%d)\n", node.Name, node.File, node.Line)
	}
	fmt.Fprintf(&buffer, "Impacted HTTP endpoints (%d):\n", len(report.Routes))
	for _, route := range report.Routes {
		auth := "auth unknown"
		if route.Authenticated {
			auth = "authenticated"
		}
		fmt.Fprintf(&buffer, "- %s %s via %s (depth %d, %s; %s)\n", route.Method, route.Path, route.HandlerName, route.Depth, auth, route.RegressionState)
	}
	fmt.Fprintf(&buffer, "Risk score: %d/10 (%s)\n", intelligence.RiskScore, intelligence.Source)
	for _, alert := range report.Alerts {
		fmt.Fprintf(&buffer, "! [%s] %s: %s\n", alert.Severity, alert.Code, alert.Message)
	}
	fmt.Fprintf(&buffer, "Regression tests: %d existing, %d route stubs required\n", len(report.TestSelection.ExistingTests), len(report.TestSelection.MissingRoutes))
	for _, stub := range report.TestSelection.Stubs {
		fmt.Fprintf(&buffer, "  %s\n", stub)
	}
	_, err := out.Write(buffer.Bytes())
	return err
}
