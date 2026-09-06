# SentryGraph web dashboard

SentryGraph turns a code change into a security-review brief. It uses an Entire
Graph blast-radius scan to show affected API surfaces, discrepancies with the
developer's checkpoint intent, security alerts, and required regression tests.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The dashboard ships with a safe fixture and can
import the JSON produced by `entire graph sentry-scan --format json`.

To review a real scan, run this from the repository root and import the output:

```sh
go build -o entire-graph ./cmd/entire-graph
./entire-graph sentry-scan --repo . --symbol sanitizeToken --intent "internal auth refactor only" --format json > sentry-scan.json
```
