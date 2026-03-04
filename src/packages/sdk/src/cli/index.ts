#!/usr/bin/env node
/**
 * evalgate — EvalGate CLI
 *
 * Commands:
 *   evalgate init   — Create evalgate.config.json
 *   evalgate check  — CI/CD evaluation gate (see evalgate check --help)
 */

import { runBaseline } from "./baseline";
import { parseArgs, runCheck } from "./check";
import { runCICLI } from "./ci";
import { runDiffCLI } from "./diff";
import { discoverSpecs } from "./discover";
import { runDoctor } from "./doctor";
import { runExplain } from "./explain";
import { runImpactAnalysisCLI } from "./impact-analysis";
import { runInit } from "./init";
import { migrateConfig } from "./migrate";
import { runPrintConfig } from "./print-config";
import { runGate } from "./regression-gate";
import { runEvaluationsCLI } from "./run";
import { parseShareArgs, runShare } from "./share";
import { runUpgrade } from "./upgrade";
import { runValidate } from "./validate";

const argv = process.argv.slice(2);
const subcommand = argv[0];

if (subcommand === "init") {
	const cwd = process.cwd();
	const ok = runInit(cwd);
	process.exit(ok ? 0 : 1);
} else if (subcommand === "baseline") {
	const code = runBaseline(argv.slice(1));
	process.exit(code);
} else if (subcommand === "gate") {
	const code = runGate(argv.slice(1));
	process.exit(code);
} else if (subcommand === "migrate") {
	// Handle migrate subcommand
	const migrateSubcommand = argv[1];

	if (migrateSubcommand === "config") {
		// Parse migrate config arguments
		let inputPath = "";
		let outputPath = "";
		let verbose = false;
		let helpers = true;
		let preserveIds = true;
		let provenance = true;

		for (let i = 2; i < argv.length; i++) {
			const arg = argv[i];
			if (arg === "--in" || arg === "-i") {
				inputPath = argv[++i];
			} else if (arg === "--out" || arg === "-o") {
				outputPath = argv[++i];
			} else if (arg === "--verbose" || arg === "-v") {
				verbose = true;
			} else if (arg === "--no-helpers") {
				helpers = false;
			} else if (arg === "--no-preserve-ids") {
				preserveIds = false;
			} else if (arg === "--no-provenance") {
				provenance = false;
			}
		}

		if (!inputPath || !outputPath) {
			console.error("Error: Both --in and --out options are required");
			console.error(
				"Usage: evalgate migrate config --in <input> --out <output> [options]",
			);
			process.exit(1);
		}

		migrateConfig({
			input: inputPath,
			output: outputPath,
			verbose,
			helpers,
			preserveIds,
			provenance,
		}).catch((err) => {
			console.error(
				`Migration failed: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
	} else {
		console.error(
			"Error: Unknown migrate subcommand. Use 'evalgate migrate config'",
		);
		process.exit(1);
	}
} else if (subcommand === "upgrade") {
	const code = runUpgrade(argv.slice(1));
	process.exit(code);
} else if (subcommand === "doctor") {
	runDoctor(argv.slice(1))
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "check") {
	const parsed = parseArgs(argv.slice(1));
	if (!parsed.ok) {
		console.error(parsed.message);
		process.exit(parsed.exitCode);
	}
	runCheck(parsed.args)
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(4);
		});
} else if (subcommand === "explain") {
	runExplain(argv.slice(1))
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "print-config") {
	const code = runPrintConfig(argv.slice(1));
	process.exit(code);
} else if (subcommand === "share") {
	const parsed = parseShareArgs(argv.slice(1));
	if ("error" in parsed) {
		console.error(parsed.error);
		process.exit(1);
	}
	runShare(parsed)
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "discover") {
	// Parse arguments for discover command
	const args = argv.slice(1);
	const manifestFlag = args.includes("--manifest");

	discoverSpecs({ manifest: manifestFlag })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "impact-analysis") {
	// Parse arguments for impact-analysis command
	const args = argv.slice(1);
	const baseIndex = args.indexOf("--base");
	const changedFilesIndex = args.indexOf("--changed-files");
	const formatIndex = args.indexOf("--format");

	const baseBranch = baseIndex !== -1 ? args[baseIndex + 1] : "main";
	const changedFiles =
		changedFilesIndex !== -1
			? args[changedFilesIndex + 1]?.split(",")
			: undefined;
	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";

	runImpactAnalysisCLI({ baseBranch, changedFiles, format })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(2);
		});
} else if (subcommand === "run") {
	// Parse arguments for run command
	const args = argv.slice(1);
	const specIdsIndex = args.indexOf("--spec-ids");
	const impactedOnlyIndex = args.indexOf("--impacted-only");
	const baseIndex = args.indexOf("--base");
	const formatIndex = args.indexOf("--format");
	const writeResultsIndex = args.indexOf("--write-results");

	const specIds =
		specIdsIndex !== -1 ? args[specIdsIndex + 1]?.split(",") : undefined;
	const impactedOnly = impactedOnlyIndex !== -1;
	const baseBranch = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";
	const writeResults = writeResultsIndex !== -1;

	runEvaluationsCLI({
		specIds,
		impactedOnly: impactedOnly ? !!baseBranch : false,
		baseBranch,
		format,
		writeResults,
	})
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(2);
		});
} else if (subcommand === "diff") {
	// Parse arguments for diff command
	const args = argv.slice(1);
	const baseIndex = args.indexOf("--base");
	const headIndex = args.indexOf("--head");
	const formatIndex = args.indexOf("--format");

	const base = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
	const head = headIndex !== -1 ? args[headIndex + 1] : undefined;
	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";

	runDiffCLI({ base, head, format })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(2);
		});
} else if (subcommand === "validate") {
	runValidate(argv.slice(1))
		.then((result) => process.exit(result.passed ? 0 : 1))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "ci") {
	// Parse arguments for ci command
	const args = argv.slice(1);
	const baseIndex = args.indexOf("--base");
	const impactedOnlyIndex = args.indexOf("--impacted-only");
	const formatIndex = args.indexOf("--format");
	const writeResultsIndex = args.indexOf("--write-results");

	const base = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
	const impactedOnly = impactedOnlyIndex !== -1;
	const format =
		formatIndex !== -1
			? (args[formatIndex + 1] as "human" | "json" | "github")
			: "human";
	const writeResults = writeResultsIndex !== -1;

	runCICLI({ base, impactedOnly, format, writeResults })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(2);
		});
} else {
	console.log(`EvalGate CLI

Usage:
  evalgate init                Create evalgate.config.json + baseline + CI workflow
  evalgate discover            Discover behavioral specs in project and show statistics
  evalgate discover --manifest  Generate evaluation manifest for incremental analysis
  evalgate impact-analysis     Analyze impact of changes and suggest targeted tests
    --base <branch>          Base branch to compare against (default: main)
    --changed-files <files>  Comma-separated list of changed files (for CI)
    --format <fmt>           Output format: human (default), json
  evalgate ci                  One-command CI loop (manifest → impact → run → diff)
    --base <ref>            Base reference for diff (baseline|last|<runId>|<path>|<gitref>)
    --impacted-only          Run only specs impacted by changes
    --format <fmt>           Output format: human (default), json, github
    --write-results          Write run results to .evalgate/last-run.json
  evalgate run                 Run evaluation specifications
    --spec-ids <ids>         Comma-separated list of spec IDs to run
    --impacted-only          Run only specs impacted by changes (requires --base)
    --base <branch>          Base branch for impact analysis (with --impacted-only)
    --format <fmt>           Output format: human (default), json
    --write-results          Write results to .evalgate/last-run.json
  evalgate diff                Compare two run reports and show behavioral changes
    --base <branch>          Base branch or report path (default: main)
    --head <path>            Head report path (default: .evalgate/last-run.json)
    --format <fmt>           Output format: human (default), json
  evalgate gate [options]      Run regression gate (local test-based, no API needed)
  evalgate check [options]     CI/CD evaluation gate (API-based)
  evalgate explain [options]   Explain last gate/check failure with root causes + fixes
  evalgate doctor [options]    Comprehensive CI/CD readiness checklist
  evalgate baseline init       Create starter evals/baseline.json
  evalgate baseline update     Run tests and update baseline with real scores
  evalgate upgrade --full      Upgrade from Tier 1 to Tier 2 (full gate)
  evalgate validate             Validate spec files without running them (like tsc --noEmit for evals)
    --format <fmt>           Output format: human (default), json
  evalgate print-config        Show resolved config with source-of-truth annotations
  evalgate share [options]     Create share link for a run

Options for gate:
  --format <fmt>      Output format: human (default), json, github

Options for check:
  --evaluationId <id>  Evaluation to gate on (or from config)
  --apiKey <key>      API key (or EVALAI_API_KEY env)
  --format <fmt>      Output format: human (default), json, github
  --explain           Show score breakdown and thresholds
  --onFail import     When gate fails, import run with CI context
  --minScore <n>      Fail if score < n (0-100)
  --maxDrop <n>       Fail if score dropped > n from baseline
  --warnDrop <n>      Warn (exit 8) if score dropped > n but < maxDrop
  --minN <n>          Fail if total test cases < n
  --allowWeakEvidence Allow weak evidence level
  --policy <name>     Enforce policy (HIPAA, SOC2, GDPR, etc.)
  --baseline <mode>   "published", "previous", or "production"
  --share <mode>      Share link: always | fail | never (fail = only when gate fails)
  --baseUrl <url>     API base URL

Options for explain:
  --report <path>     Path to report JSON (default: evals/regression-report.json)
  --format <fmt>      Output format: human (default), json

Options for print-config:
  --format <fmt>      Output format: human (default), json

Options for doctor:
  --report            Output JSON diagnostic bundle
  --format <fmt>      Output format: human (default), json
  --strict            Treat warnings as failures (exit 2)
  --apiKey <key>      API key (or EVALAI_API_KEY env)
  --baseUrl <url>     API base URL
  --evaluationId <id> Evaluation to verify

Examples:
  evalgate init
  evalgate discover
  evalgate discover --manifest
  evalgate impact-analysis --base main
  evalgate impact-analysis --base main --format json
  evalgate impact-analysis --changed-files src/utils.ts,datasets/test.json
  evalgate run
  evalgate run --spec-ids spec1,spec2
  evalgate run --impacted-only --base main
  evalgate run --format json --write-results
  evalgate diff
  evalgate diff --base main
  evalgate diff --base main --format json
  evalgate diff --a .evalgate/runs/base.json --b .evalgate/last-run.json
  evalgate gate
  evalgate gate --format json
  evalgate explain
  evalgate doctor
  evalgate print-config
  evalgate doctor --report
  evalgate check --minScore 92 --evaluationId 42 --apiKey $EVALAI_API_KEY
  evalgate check --policy HIPAA --evaluationId 42 --apiKey $EVALAI_API_KEY
  evalgate share --scope run --evaluationId 42 --runId 123 --expires 7d --apiKey $EVALAI_API_KEY
`);
	process.exit(subcommand === "--help" || subcommand === "-h" ? 0 : 1);
}
