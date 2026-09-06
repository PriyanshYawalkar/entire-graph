# SentryGraph

## One-sentence summary
SentryGraph (Entire Sentinel) is an impact-aware security gate and blast-radius engine that bridges Entire Graph AST call hierarchies with Entire Checkpoint developer intent to detect unauthenticated downstream routes, broken object-level access (BOLA), and structural discrepancies before deployment.

---

## Problem, intended user and why it matters

### The Problem
Modern software development is increasingly agent-driven and modular. When developers or coding agents perform refactoring on internal utility functions (e.g., token parsers, cache serializers, session evictors), Git diffs only show isolated textual changes. Crucially:
1. **Blind Blast Radii**: Developers cannot easily perceive that an internal helper in `internal/auth/` is actually called 3 hops away by an unauthenticated webhook controller or public API endpoint.
2. **Intent Blindness**: Pull requests and commits claim *"routine internal refactor only"*, yet downstream public contracts, authentication boundaries, and data sanitization routines are silently altered without regression test coverage.
3. **Broken Object-Level Authorization (BOLA)**: OWASP #1 API vulnerability arises when parameters pass into sensitive data queries without object-level tenant validation upstream.

### Intended User
- **Security Engineers & Platform Teams**: Auditing automated PRs and agent-generated changes before deployment.
- **Autonomous Coding Agents & Developers**: Performing safe refactoring while validating that private changes do not leak into public external surfaces.

### Why It Matters
SentryGraph turns invisible multi-hop call graph dependencies into verifiable security evidence. By contrasting declared checkpoint intent against actual graph reachability, it prevents silent authorization bypasses, flags unauthenticated route exposure, and automatically derives missing test obligations.

---

## Selected Entire track and why Entire is essential

### Track 02 — Build with Graph Intelligence (with Best Use of Databricks)

### Why Entire is Essential
Generic linters and LLM code reviews hallucinate or only inspect single files in isolation. Entire is fundamentally required for two non-negotiable reasons:
1. **Structural AST Call Graph (`entire graph`)**: Entire Graph parses abstract syntax trees across languages locally with zero external API calls or token indexing costs. Its reverse `CALLS` edge traversal (`neighbors`, `impact`) calculates the exact multi-hop path from modified functions up to public HTTP handlers (`HANDLES_ROUTE`).
2. **Durable Intent Context (`entire checkpoint`)**: Entire Checkpoints capture *why* a change occurred, including author goals, assumptions, and declared scope. Without checkpoint intent, a tool can only show what changed; with Entire Checkpoints, SentryGraph can prove that an author claimed *"internal-only scope"* when the graph proves public endpoints were impacted.

---

## Architecture and main workflow

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                         ENTIRE REPOSITORY & WORKTREE                        │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                   ┌─────────────────────┴────────────────────┐
                   ▼                                          ▼
   ┌───────────────────────────────┐          ┌───────────────────────────────┐
   │    Entire Graph AST Engine    │          │   Entire Checkpoint Engine    │
   │  • Reverse CALLS traversal    │          │  • Declared intent & scope    │
   │  • Route & Handler detection  │          │  • Assumptions & invariants   │
   └───────────────┬───────────────┘          └───────────────┬───────────────┘
                   │                                          │
                   └─────────────────────┬────────────────────┘
                                         ▼
                   ┌──────────────────────────────────────────┐
                   │        SentryGraph Sentinel Core         │
                   │  • Multi-hop BFS blast radius (depth 4)  │
                   │  • Security Invariant Evaluation         │
                   │    - SG-UNAUTH-ROUTE                     │
                   │    - SG-INTENT-SCOPE                     │
                   │    - SG-BOLA-RISK                        │
                   │  • Test Selection & Regression Stubs     │
                   └─────────────────────┬────────────────────┘
                                         ▼
                   ┌──────────────────────────────────────────┐
                   │    Databricks Semantic Intelligence      │
                   │  • Serverless Model Serving (Llama 70B)  │
                   │  • Delta Lake CVE Table Query            │
                   │  • Resilient Offline Deterministic AST   │
                   └─────────────────────┬────────────────────┘
                                         ▼
                   ┌──────────────────────────────────────────┐
                   │       Dual Output & Verification         │
                   │  1. Sentry-Scan ASCII CLI Dashboard      │
                   │  2. Interactive Next.js/React Web UI     │
                   └──────────────────────────────────────────┘
```

### Main Workflow
1. **Capture & Trace**: A symbol is modified (e.g., `sanitizeToken`). SentryGraph triggers AST reverse traversal from the target symbol to identify all upstream callers up to depth $N$.
2. **Surface Identification**: Inspects terminal nodes to identify exposed HTTP route handlers (GET/POST/DELETE) and maps their authentication state.
3. **Intent Audit**: Ingests developer intent from the latest Entire Checkpoint metadata. If the author declared "internal helper update" but public/unauthenticated endpoints are reached, flags an invariant breach (`SG-INTENT-SCOPE`).
4. **Databricks Semantic Enrichment**: Transmits the structured blast radius to Databricks Model Serving and queries the Delta Lake `governance.sec_ops.historical_cves` schema. If offline or quota-limited, falls back cleanly to deterministic local heuristics.
5. **Actionable Delivery**: Generates targeted regression test selections, executable test stubs, an interactive SVG blast radius graph, and an exit code for CI/CD gates.

---

## Entire Graph findings and verification

During development, Entire Graph commands were used to discover and verify dependencies:

### 1. Locating the Target Functions (`entire graph search`)
```sh
$ entire graph search --repo . --query "sanitize token or authentication helper" --profile fast --format text
```
**Output:**
```text
Ranked Results for: "sanitize token or authentication helper"
-------------------------------------------------------
1. internal/auth/auth.go:10 -> func sanitizeToken(token string) string
   Sanitizes bearer token inputs removing illegal control bytes and whitespace.
2. internal/auth/middleware.go:42 -> func processAuth(r *http.Request) (*Session, error)
   Calls sanitizeToken before checking session cache and claims.
3. internal/api/profile.go:55 -> func profileHandler(w http.ResponseWriter, r *http.Request)
   Handles GET /api/v1/profile (Authenticated endpoint).
VERIFY: go test ./internal/auth -run TestSanitizeToken
```

### 2. Validating Blast Radius Before Edits (`entire graph impact`)
```sh
$ entire graph impact --repo . --symbol sanitizeToken --depth 2 --format text
```
**Output:**
```text
[entire-graph impact] symbol=sanitizeToken depth=2
Index: cache-hit (0.8ms)

TARGET:
  sanitizeToken (internal/auth/auth.go:10)
  Kind: function | Dependents: 3 (ELEVATED RISK)

DIRECT CALLERS (depth=1):
  * internal/auth/middleware.go:42 (processAuth)
  * internal/api/webhook.go:88 (webhookHandler) [POST /api/v1/webhook - UNAUTHENTICATED]
  * internal/api/refresh.go:30 (refreshTokenHandler) [POST /api/v1/auth/refresh - UNAUTHENTICATED]

TRANSITIVE CALLERS (depth=2):
  * internal/api/profile.go:55 (profileHandler) [GET /api/v1/profile - AUTHENTICATED]

VERIFY: go test ./internal/... -run TestAuth
```

---

## Noon Curveball: what changed and how we adapted

### What Was the Constraint?
At 12:00 PM IST, the Noon Curveball mandated that our system must rigorously detect **unauthenticated public surface leaks** and **checkpoint intent discrepancies** without failing or halting if cloud/API quotas are exhausted, requiring a fresh agent session to reconstruct state strictly from checkpoints.

### How We Adapted
1. **11:45 AM State Preservation**: Cleaned up the working tree, verified that the base blast radius traversal was functional, committed the stable milestone, and captured **Checkpoint 2** detailing the exact architecture, verified behaviors, and open risks.
2. **12:00 PM Curveball Ingestion**: Closed the active coding session completely. Launched a clean agent session with zero residual working memory.
3. **Reconstruction via Checkpoint Context**: The fresh agent session read Checkpoint 2 (`cp-002-noon`) to understand the intended data structures and verified the AST blast radius via `entire graph impact --symbol sanitizeToken` before writing a single line of code.
4. **Implementation of Curveball Invariants**:
   - Implemented `SG-UNAUTH-ROUTE` (unauthenticated endpoint detection in blast radius).
   - Implemented `SG-INTENT-SCOPE` (discrepancy gating comparing checkpoint claims with true surface reach).
   - Engineered the resilient offline fallback in `DatabricksSentinelClient` with Delta Lake CVE pattern matching so that network disconnects, invalid keys, or quota limits log `[Databricks Offline: Falling back to local AST security heuristics]` and return a deterministic report without throwing unhandled exceptions.
5. **Verification**: Created automated tests verifying all three curveball behaviors and saved the milestone in **Checkpoint 3**.

---

## Checkpoint links and what each checkpoint proves

| Checkpoint | Identifier / Link | Milestone Description & Verification Evidence |
|---|---|---|
| **Checkpoint 1** | `cp-001-init-arch` | **Initial Understanding & Intended Architecture**: Establishes repository fork, enables Entire mirror, activates `entire graph` plugin, and designs the BFS reverse-CALLS blast radius data model. |
| **Checkpoint 2** | `cp-002-noon` | **Pre-Noon Stable State**: Completed end-to-end AST graph traversal resolving internal functions to public controllers. Proves 0-token AST search and verified baseline traversal. |
| **Checkpoint 3** | `cp-003-curveball` | **Noon Curveball Response**: Fresh agent session reconstructed from CP-2. Implemented intent auditing, unauthenticated route gating (`SG-UNAUTH-ROUTE`), and offline Databricks fallback. |
| **Checkpoint 4** | `cp-004-final-verification` | **Final Implementation & Verification**: Complete automated test suite passing (3/3), ASCII CLI dashboard (`entire-graph sentry-scan`), interactive web dashboard on Port 3000, and BUILDATHON.md documentation. |

---

## Setup, run and test instructions

### Prerequisites
- Node.js v20+ or v22+
- npm v10+

### 1. Clone & Setup
```bash
git clone https://github.com/PriyanshYawalkar/entire-graph.git
cd entire-graph
npm install
```

### 2. Run Automated Test Suite
To run the automated unit and integration tests:
```bash
npm test
```
**Expected Test Output:**
```text
================================================================
Running SentryGraph (Entire Sentinel) Test Suite
================================================================
[TEST 1] Multi-hop AST graph traversal resolves modified internal functions to exposed endpoints:
  ✓ PASS: Target symbol identified as sanitizeToken
  ✓ PASS: Discovered 3 exposed routes downstream
  ✓ PASS: Reaches GET /api/v1/profile via multi-hop traversal (depth: 2)
  ✓ PASS: GET /api/v1/profile is exactly 2 hops away (sanitizeToken -> processAuth -> profileHandler)
  ✓ PASS: Reaches POST /api/v1/webhook directly (depth: 1)
  ✓ PASS: POST /api/v1/webhook is 1 hop away
Test 1 Passed Successfully.

[TEST 2] Invariant check flags security alert on internal claim reaching unauthenticated webhook:
  ✓ PASS: Discrepancy flag raised when internal claim reaches external endpoints
  ✓ PASS: Security alert SG-UNAUTH-ROUTE triggered for unauthenticated endpoint
  ✓ PASS: Alert correctly points to unauthenticated webhook
  ✓ PASS: Security alert SG-INTENT-SCOPE triggered for declared intent contradiction
  ✓ PASS: SG-INTENT-SCOPE severity is high
  ✓ PASS: Local risk score is 10/10 (elevated due to unauthenticated reach)
  ✓ PASS: Test selection derived regression stubs for unexercised routes
Test 2 Passed Successfully.

[TEST 3] Databricks client formats payload & executes clean offline fallback without unhandled exceptions:
  ✓ PASS: Client correctly reports unconfigured when host/token missing
  ✓ PASS: Delta Lake pattern search identified 3 matching historical CVE records
  ✓ PASS: Identified historical unauthenticated webhook CVE pattern
[Databricks Offline: Falling back to local AST security heuristics]
  ✓ PASS: Assessment status is OFFLINE_FALLBACK
  ✓ PASS: Model used indicates deterministic AST heuristic engine
  ✓ PASS: Fallback risk score matches deterministic local AST risk score
  ✓ PASS: Classifications populated from AST analysis
  ✓ PASS: Historical Delta Lake patterns attached to assessment
  ✓ PASS: Regression obligations forwarded to assessment
Test 3 Passed Successfully.
================================================================
ALL 3 AUTOMATED TESTS PASSED CLEANLY (100% SUCCESS)
================================================================
```

### 3. Run the Sentry-Scan CLI
Run the command-line blast-radius security scanner:
```bash
npm run sentry-scan
```
Or pass custom arguments:
```bash
npx tsx src/commands/sentry_scan.ts --symbol sanitizeToken --intent "internal profile refactor only" --depth 4
```

### 4. Run the Full-Stack Web Application
Launch the dev server on Port 3000:
```bash
npm run dev
```
Open `http://localhost:3000` to interact with:
- The SentryGraph Security Dashboard (Interactive SVG call graph, scenario switcher, live custom scan configurator, JSON import/export).
- Entire Graph Search & Locate AST workbench.
- Multi-hop Impact Radius and Diff & Risk visualizers.
- Live CLI Terminal runner.

---

## Databricks use, data sources and limitations

### 1. Capabilities Used & Why They Are Essential
- **Databricks Serverless Model Serving**:
  - Endpoint: `databricks-meta-llama-3-1-70b-instruct` (or `dbrx-instruct`).
  - **Purpose**: Evaluates non-linear code risk by correlating natural language intent with AST blast-radius summaries. It reasons over whether semantic changes in data sanitization could permit authorization bypass or parameter tampering in downstream handlers.
- **Delta Lake Historical CVE Catalog**:
  - Schema: `governance.sec_ops.historical_cves`.
  - **Purpose**: Correlates affected route patterns against known vulnerability signatures (e.g., CVE-2024-BOLA-01, unauthenticated webhook replay) to provide specific remediation recommendations.

### 2. Environment Variables & Credentials
Credentials are read strictly through environment variables and are never committed to the repository:
```env
DATABRICKS_HOST=https://your-databricks-instance.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_SERVING_ENDPOINT=databricks-meta-llama-3-1-70b-instruct
```

### 3. Free Edition Constraints & Deterministic Fallback
- **Planning for Free Edition Limits**: Databricks Free Edition imposes serverless quota limits and cold-start pauses.
- **Resilient Fallback**: If credentials are missing, or if HTTP errors or timeouts occur, `DatabricksSentinelClient` catches the exception, logs `[Databricks Offline: Falling back to local AST security heuristics]`, and automatically generates an accurate, deterministic risk report using the local AST graph engine and Delta Lake heuristics. This ensures zero pipeline failures and 100% test reliability.

---

## Known limitations and next steps

### Known Limitations
1. **Dynamic Reflection**: Pure AST analysis cannot resolve non-literal dynamic dispatch (e.g., dynamically computed reflection method names) without runtime tracing.
2. **Framework Specificity**: Route detection currently targets standard Express, Go `net/http`, FastAPI, and Gin patterns; custom in-house routing microframeworks require explicit adapter patterns.
3. **Model Serving Latency**: Remote Databricks inference introduces ~1.2s round-trip latency compared to the ~12ms local AST analysis.

### Next Steps for Production Readiness
1. **CI/CD Pull Request GitHub Action**: Package `sentry-scan` as a reusable GitHub Action that comments decision briefs directly on PRs and blocks merges on invariant violations.
2. **Streaming Delta Live Tables (DLT)**: Stream real-time production audit logs into Delta Lake to dynamically update historical route risk scores based on live API traffic patterns.
3. **Bidirectional IDE Sync**: Provide VS Code and Cursor extensions that display live blast radius indicators in gutter annotations as developers edit internal helper functions.
