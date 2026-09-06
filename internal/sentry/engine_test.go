package sentry

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func fixture() ([]SymbolNode, []CallEdge, CheckpointContext) {
	nodes := []SymbolNode{
		{ID: "sanitize", Name: "sanitizeToken", File: "auth.go", Line: 10},
		{ID: "process", Name: "processAuth", File: "auth.go", Line: 20},
		{ID: "profile", Name: "profileHandler", Route: "GET /api/v1/profile", Public: true, Auth: "authenticated"},
		{ID: "webhook", Name: "webhookHandler", Route: "POST /api/v1/webhook", Public: true, Auth: "unauthenticated"},
		{ID: "profile-test", Name: "TestProfileHandler", TestFile: true},
	}
	edges := []CallEdge{{From: "process", To: "sanitize"}, {From: "profile", To: "process"}, {From: "webhook", To: "process"}, {From: "profile-test", To: "profile"}}
	return nodes, edges, CheckpointContext{Intent: "internal profile refactor only"}
}

func TestTraversalFindsBothDownstreamEndpoints(t *testing.T) {
	nodes, edges, checkpoint := fixture()
	report := Analyze(nodes, edges, []string{"sanitize"}, 3, checkpoint)
	if len(report.Routes) != 2 {
		t.Fatalf("routes = %#v", report.Routes)
	}
	if report.Routes[0].Path != "/api/v1/profile" || report.Routes[1].Path != "/api/v1/webhook" {
		t.Fatalf("route paths = %#v", report.Routes)
	}
	if report.Routes[0].Depth != 2 || report.Routes[1].Depth != 2 {
		t.Fatalf("unexpected depth: %#v", report.Routes)
	}
}

func TestIntentFlagsUnauthenticatedWebhook(t *testing.T) {
	nodes, edges, checkpoint := fixture()
	report := Analyze(nodes, edges, []string{"sanitize"}, 3, checkpoint)
	var unauth, scope bool
	for _, alert := range report.Alerts {
		unauth = unauth || alert.Code == "SG-UNAUTH-ROUTE"
		scope = scope || alert.Code == "SG-INTENT-SCOPE"
	}
	if !unauth || !scope {
		t.Fatalf("alerts = %#v", report.Alerts)
	}
	if len(report.TestSelection.ExistingTests) != 1 || len(report.TestSelection.MissingRoutes) != 1 {
		t.Fatalf("test matrix = %#v", report.TestSelection)
	}
}

func TestDatabricksPayloadAndOfflineFallback(t *testing.T) {
	nodes, edges, checkpoint := fixture()
	report := Analyze(nodes, edges, []string{"sanitize"}, 3, checkpoint)
	if got := NewDatabricksClientFromEnv(false).Evaluate(context.Background(), report); got.Source != "local-rules" || got.RiskScore < 1 {
		t.Fatalf("offline fallback = %#v", got)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload["inputs"] == nil {
			t.Fatalf("payload = %#v, err=%v", payload, err)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Fatal("missing bearer token")
		}
		_, _ = w.Write([]byte(`{"risk_score":8,"classifications":["BOLA"],"recommendations":["exercise webhook"]}`))
	}))
	defer server.Close()
	client := DatabricksClient{Host: server.URL, Token: "test-token", Enabled: true, HTTPClient: server.Client()}
	got := client.Evaluate(context.Background(), report)
	if got.Source != "databricks" || got.RiskScore != 8 || !strings.Contains(strings.Join(got.Classifications, ","), "BOLA") {
		t.Fatalf("remote result = %#v", got)
	}
}
