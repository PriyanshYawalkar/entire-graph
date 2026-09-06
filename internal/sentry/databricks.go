package sentry

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"
)

// IntelligenceResult is an optional semantic enrichment. Source states whether
// it came from a remote endpoint or deterministic local rules.
type IntelligenceResult struct {
	RiskScore       int      `json:"risk_score"`
	Classifications []string `json:"classifications"`
	Recommendations []string `json:"recommendations"`
	Source          string   `json:"source"`
}

// DatabricksClient reads credentials only from the process environment. It does
// not log tokens and does not attempt network access unless Enabled is true.
type DatabricksClient struct {
	Host, Token string
	HTTPClient  *http.Client
	Enabled     bool
}

func NewDatabricksClientFromEnv(enabled bool) DatabricksClient {
	return DatabricksClient{Host: strings.TrimRight(os.Getenv("DATABRICKS_HOST"), "/"), Token: os.Getenv("DATABRICKS_TOKEN"), Enabled: enabled, HTTPClient: &http.Client{Timeout: 5 * time.Second}}
}

func (c DatabricksClient) Evaluate(ctx context.Context, report Report) IntelligenceResult {
	if !c.Enabled || c.Host == "" || c.Token == "" {
		return localEvaluation(report)
	}
	body, err := json.Marshal(map[string]any{"inputs": report})
	if err != nil {
		return localEvaluation(report)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Host+"/serving-endpoints/sentrygraph/invocations", bytes.NewReader(body))
	if err != nil {
		return localEvaluation(report)
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	client := c.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil || resp == nil {
		return localEvaluation(report)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return localEvaluation(report)
	}
	var result IntelligenceResult
	if json.NewDecoder(resp.Body).Decode(&result) != nil {
		return localEvaluation(report)
	}
	if result.RiskScore < 1 {
		result.RiskScore = report.LocalRiskScore
	}
	if result.RiskScore > 10 {
		result.RiskScore = 10
	}
	result.Source = "databricks"
	return result
}

func localEvaluation(report Report) IntelligenceResult {
	classes := []string{"structural blast radius"}
	recommendations := []string{"run selected regression tests"}
	for _, alert := range report.Alerts {
		if alert.Code == "SG-UNAUTH-ROUTE" {
			classes = append(classes, "unauthenticated route exposure", "BOLA/IDOR review")
			recommendations = append(recommendations, "assert object-level authorization and request validation")
		}
	}
	return IntelligenceResult{RiskScore: report.LocalRiskScore, Classifications: classes, Recommendations: recommendations, Source: "local-rules"}
}
