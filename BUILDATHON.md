# SentryGraph (Entire Sentinel)

SentryGraph turns an Entire Graph call slice and developer checkpoint intent into an actionable API-security blast-radius report.

## Problem and users

Security reviewers and platform engineers need to know when a change advertised as an internal refactor actually reaches a public endpoint. Line diffs cannot reliably answer that question across helpers, call chains, and tests. SentryGraph follows reverse structural calls from modified symbols, finds HTTP handlers, compares them with declared intent, and selects regression coverage.

## Track 2: Build with Graph Intelligence

This project is built for Track 2. Entire Graph supplies the deterministic AST symbols and `CALLS` / `HANDLES_ROUTE` relationships; without that structural graph, the endpoint blast radius would be a brittle text-search approximation. We verify implementation locations with `entire graph search` and a focused `entire graph impact` before changing graph-facing behavior.

## Architecture and workflow

1. `sentry-scan` builds a full-profile local Entire snapshot.
2. It converts symbols and `CALLS` relations into a reverse adjacency list, then breadth-first traverses from each modified symbol.
3. `HANDLES_ROUTE` relations identify exposed HTTP surfaces. Checkpoint intent is compared with those routes; an “internal-only” claim that reaches a route creates an evidence-backed alert.
4. Existing test relationships are selected; uncovered routes get concrete test-stub names.
5. By default, deterministic local rules score unauthenticated/unknown route exposure. An explicit `--databricks` opt-in can send the minimal report payload to a Databricks Model Serving endpoint and always falls back safely on failure.

## Setup, run, and test

```sh
go test ./internal/sentry
go build -o entire-graph ./cmd/entire-graph
./entire-graph sentry-scan --repo . --symbol runImpact --intent "internal reporting refactor only"
./entire-graph sentry-scan --repo . --symbol runImpact --format json
```

For the judging demo, run the Next.js/Tailwind dashboard in `sentrygraph-web`.
It starts with the documented fixture and can import any `sentry-scan --format
json` report through its **Import scan JSON** control.

For optional Databricks enrichment, provide secrets only through the environment (never source control):

```sh
export DATABRICKS_HOST="https://<workspace>"
export DATABRICKS_TOKEN="<short-lived-token>"
./entire-graph sentry-scan --repo . --symbol runImpact --databricks
```

## Databricks use, data, and limits

The connector sends the already-bounded structural report (modified symbols, affected routes, intent, local findings, and test matrix) to `/serving-endpoints/sentrygraph/invocations`. It does not read credentials from files, print tokens, or make any network request without both `--databricks` and the two required environment variables. A future deployment may persist scored reports in a Databricks Delta table for risk trend analysis and pattern matching. The current rule engine is deterministic and intentionally conservative: route authentication is reported as unknown unless a trusted policy source enriches it.

## Entire Graph findings and verification

```sh
entire graph search --repo . --profile full --query "CLI command registration impact traversal route handler graph records"
entire graph impact --repo . --symbol Run --file internal/cli/root.go --depth 2 --format text
go test ./internal/sentry
```

The focused fixture verifies that `sanitizeToken` reaches both `GET /api/v1/profile` and `POST /api/v1/webhook`, that an internal-only claim is rejected when the webhook is reached, and that Databricks payload handling falls back locally when offline.

## Checkpoints

- Checkpoint 1: repository recovery and integration analysis; proves the CLI and semantic-provider integration point.
- Checkpoint 2: SentryGraph engine and fixture tests; proves structural traversal, intent mismatch detection, and offline-safe intelligence behavior.
- Noon Curveball: _placeholder — record the changed assumption, its graph impact, and the additional regression evidence here._

## Known limitations and next steps

Route discovery depends on `HANDLES_ROUTE` coverage in the selected language. Authentication classification is deliberately unknown without a configured policy adapter, so it errs toward review rather than claiming a route is protected. Next: ingest checkpoint metadata directly, add repository-specific auth middleware evidence, persist anonymized findings to Delta, and generate framework-native test files after reviewer approval.
