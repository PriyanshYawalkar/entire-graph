package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/entireio/entire-graph/internal/sem"
	"github.com/entireio/entire-graph/internal/sentry"
	"github.com/entireio/entire-graph/internal/termsafe"
)

type sentryFlags struct {
	repo, intent, format string
	symbols              []string
	depth                int
	databricks           bool
}

// runSentryScan adapts provider records into SentryGraph's small, auditable
// security model. No remote call happens unless --databricks is explicit.
func runSentryScan(ctx context.Context, opts Options, args []string) error {
	flags, err := parseSentryFlags(args)
	if err != nil {
		return err
	}
	repo, err := resolveRepo(ctx, opts.Env, flags.repo)
	if err != nil {
		return err
	}
	snapshot, _, err := sem.LoadOrBuildProviderSnapshot(ctx, repo, opts.Version, sem.ProviderSnapshotOptions{NoNetwork: true, Worktree: true, Profile: sem.ProfileFull}, resolveCacheDir("", opts.Env.PluginDataDir), false)
	if err != nil {
		return err
	}
	nodes, edges, modified := sentryGraph(snapshot, flags.symbols)
	report := sentry.Analyze(nodes, edges, modified, flags.depth, sentry.CheckpointContext{Intent: flags.intent, DeclaredScope: flags.symbols})
	if len(report.Modified) == 0 {
		return fmt.Errorf("sentry-scan found no symbols matching %q", strings.Join(flags.symbols, ", "))
	}
	intelligence := sentry.NewDatabricksClientFromEnv(flags.databricks).Evaluate(ctx, report)
	if flags.format == "json" {
		return json.NewEncoder(termsafe.NewJSONWriter(opts.Stdout)).Encode(map[string]any{"report": report, "intelligence": intelligence})
	}
	return sentry.WriteText(termsafe.NewWriter(opts.Stdout), report, intelligence)
}

func parseSentryFlags(args []string) (sentryFlags, error) {
	flags := sentryFlags{format: "text", depth: 3}
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--repo", "--symbol", "--intent", "--format", "--depth":
			if i+1 >= len(args) {
				return flags, fmt.Errorf("%s requires a value", args[i])
			}
			value := args[i+1]
			i++
			switch args[i-1] {
			case "--repo":
				flags.repo = value
			case "--symbol":
				flags.symbols = append(flags.symbols, value)
			case "--intent":
				flags.intent = value
			case "--format":
				flags.format = value
			case "--depth":
				if _, err := fmt.Sscanf(value, "%d", &flags.depth); err != nil {
					return flags, fmt.Errorf("--depth must be an integer")
				}
			}
		case "--databricks":
			flags.databricks = true
		default:
			return flags, fmt.Errorf("sentry-scan received unexpected argument %q", args[i])
		}
	}
	if len(flags.symbols) == 0 {
		return flags, errors.New("sentry-scan requires --symbol")
	}
	if flags.depth < 1 || flags.depth > 10 {
		return flags, errors.New("sentry-scan --depth must be between 1 and 10")
	}
	if flags.format != "text" && flags.format != "json" {
		return flags, errors.New("sentry-scan --format must be text or json")
	}
	return flags, nil
}

func sentryGraph(snapshot sem.ProviderSnapshot, wanted []string) ([]sentry.SymbolNode, []sentry.CallEdge, []string) {
	nodes := make([]sentry.SymbolNode, 0, len(snapshot.Symbols))
	byID := map[string]int{}
	modified := []string{}
	wantedNames := map[string]bool{}
	for _, name := range wanted {
		wantedNames[name] = true
	}
	for _, symbol := range snapshot.Symbols {
		node := sentry.SymbolNode{ID: symbol.ID, Name: symbol.Name, File: symbol.FilePath, Line: symbol.StartLine, Public: strings.HasPrefix(symbol.Name, "Handle") || strings.HasSuffix(symbol.Name, "Handler"), TestFile: isConventionalTestPath(symbol.FilePath)}
		byID[node.ID] = len(nodes)
		nodes = append(nodes, node)
		if wantedNames[symbol.Name] {
			modified = append(modified, symbol.ID)
		}
	}
	externals := map[string]string{}
	for _, external := range snapshot.Externals {
		externals[external.ID] = external.Value
	}
	for _, relation := range snapshot.Relations {
		switch relation.Type {
		case "CALLS", "ASYNC_CALLS", "CONSTRUCTS", "TESTS":
			edges = append(edges, sentry.CallEdge{From: relation.FromID, To: relation.ToID})
		case "HANDLES_ROUTE":
			handler, routeID := relation.FromID, relation.ToID
			if _, ok := byID[handler]; !ok {
				handler, routeID = relation.ToID, relation.FromID
			}
			if index, ok := byID[handler]; ok {
				nodes[index].Route = externals[routeID]
				if nodes[index].Route == "" {
					nodes[index].Route = relation.Reason
				}
				nodes[index].Public = true
				nodes[index].Auth = "unknown"
			}
		}
	}
	return nodes, edges, modified
}
