package main

import (
	"context"
	"os"

	"github.com/entireio/entire-graph/internal/sentry"
)

func main() {
	// Create mock nodes and edges
	nodes := []sentry.SymbolNode{
		{ID: "sanitize", Name: "sanitizeToken", File: "auth.go", Line: 10},
		{ID: "process", Name: "processAuth", File: "auth.go", Line: 20},
		{ID: "profile", Name: "profileHandler", Route: "GET /api/v1/profile", Public: true, Auth: "authenticated"},
		{ID: "webhook", Name: "webhookHandler", Route: "POST /api/v1/webhook", Public: true, Auth: "unauthenticated"},
		{ID: "profile-test", Name: "TestProfileHandler", TestFile: true},
	}
	edges := []sentry.CallEdge{
		{From: "process", To: "sanitize"}, 
		{From: "profile", To: "process"}, 
		{From: "webhook", To: "process"}, 
		{From: "profile-test", To: "profile"},
	}
	checkpoint := sentry.CheckpointContext{Intent: "internal profile refactor only"}

	// Analyze the blast radius
	report := sentry.Analyze(nodes, edges, []string{"sanitize"}, 3, checkpoint)
	
	// Evaluate with Databricks (Offline fallback will trigger and mock exactly as requested)
	client := sentry.NewDatabricksClientFromEnv(true)
	intelligence := client.Evaluate(context.Background(), report)

	// Print the result
	sentry.WriteText(os.Stdout, report, intelligence)
}
