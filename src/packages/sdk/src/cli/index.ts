#!/usr/bin/env node

/**
 * evalgate — EvalGate CLI
 *
 * Commands:
 *   evalgate init   — Create evalgate.config.json
 *   evalgate check  — CI/CD evaluation gate (see evalgate check --help)
 */

import { runAnalyze } from "./analyze";
import { runAuto } from "./auto";
import { runBaseline } from "./baseline";
import { parseArgs, runCheck } from "./check";
import { runCICLI } from "./ci";
import { runCluster } from "./cluster";
import { runCompareCLI } from "./compare";
import { runDiffCLI } from "./diff";
import { discoverSpecs } from "./discover";
import { runDoctor } from "./doctor";
import { runExplain } from "./explain";
import { runImpactAnalysisCLI } from "./impact-analysis";
import { runInit } from "./init";
import { runLabel } from "./label";
import { migrateConfig } from "./migrate";
import { runPrintConfig } from "./print-config";
import { runPromote } from "./promote";
import { runGate } from "./regression-gate";
import { runReplay } from "./replay";
import { runEvaluationsCLI } from "./run";
import { parseShareArgs, runShare } from "./share";
import { runStart } from "./start";
import { runSynthesize } from "./synthesize";
import {
	AVAILABLE_TEMPLATES,
	installTemplate,
	printTemplateList,
	type TemplateName,
} from "./templates";
import { runUpgrade } from "./upgrade";
import { runValidate } from "./validate";
import { runWatch } from "./watch";

const argv = process.argv.slice(2);
const subcommand = argv[0];
const subArgs = argv.slice(1);
const wantsHelp = subArgs.includes("--help") || subArgs.includes("-h");

// ── Per-subcommand help text ──
const SUBCOMMAND_HELP: Record<string, string> = {
	init: `evalgate init — Create evalgate.config.json + baseline + CI workflow\n\nUsage:\n  evalgate init [options]\n\nOptions:\n  --template <name>  Start with a real working template (chatbot, codegen, agent, safety, rag)\n  --list-templates   Show all available templates\n\nCreates project scaffolding for EvalGate in the current directory.`,
	start: `evalgate start — Zero-config startup (one command → passing run)\n\nUsage:\n  evalgate start [options]\n\nOptions:\n  --format <fmt>   Output format: human (default), json\n  --watch          Enable watch mode after first run\n  --skip-init      Skip initialization if not set up\n\nExamples:\n  evalgate start\n  evalgate start --watch\n  evalgate start --format json`,
	compare: `evalgate compare — Side-by-side result file comparison\n\nCompares two or more saved run result JSON files. Does NOT re-run anything.\nYou run each model/config separately (evalgate run --write-results), then compare the artifacts.\n\nUsage:\n  evalgate compare --base <file> --head <file> [options]\n  evalgate compare --runs <file1> <file2> [file3...] [options]\n\nOptions:\n  --base <file>      Baseline run result JSON file\n  --head <file>      Head run result JSON file\n  --runs <files>     N-way compare (3+ run result JSON files)\n  --labels <names>   Optional cosmetic labels for the output table (e.g., model names)\n  --format <fmt>     Output format: human (default), json\n  --sort-by <key>    Sort by: name (default), score, duration\n\nExamples:\n  evalgate compare --base .evalgate/runs/run-a.json --head .evalgate/runs/run-b.json\n  evalgate compare --base gpt4o.json --head claude.json --labels "GPT-4o" "Claude 3.5"\n  evalgate compare --runs run-a.json run-b.json run-c.json`,
	watch: `evalgate watch — Watch mode (re-execute on file save)\n\nUsage:\n  evalgate run --watch [options]\n  evalgate watch [options]\n\nOptions:\n  --debounce <ms>    Debounce interval (default: 300ms)\n  --no-clear         Don't clear screen between runs\n  --format <fmt>     Output format: human (default), json\n  --write-results    Write results to .evalgate/last-run.json\n\nExamples:\n  evalgate run --watch\n  evalgate watch --write-results`,
	gate: `evalgate gate — Run the regression gate\n\nUsage:\n  evalgate gate [options]\n\nOptions:\n  --format <fmt>   Output format: human (default), json, github\n  --dry-run        Run checks but always exit 0 (preview mode)\n\nExamples:\n  evalgate gate\n  evalgate gate --format json\n  evalgate gate --dry-run`,
	check: `evalgate check — CI/CD evaluation gate (API-based)\n\nUsage:\n  evalgate check [options]\n\nOptions:\n  --evaluationId <id>  Evaluation to gate on\n  --apiKey <key>       API key (or EVALGATE_API_KEY env)\n  --format <fmt>       Output format: human (default), json, github\n  --explain            Show score breakdown\n  --minScore <n>       Fail if score < n\n  --maxDrop <n>        Fail if score dropped > n\n  --policy <name>      Enforce policy (HIPAA, SOC2, etc.)\n\nExamples:\n  evalgate check --minScore 92 --evaluationId 42`,
	cluster: `evalgate cluster — Group similar traces for faster cluster-level review\n\nUsage:\n  evalgate cluster [options]\n\nOptions:\n  --run <path>            Run result JSON to cluster (default: searches latest run)\n  --clusters <n>          Requested number of clusters (default: auto)\n  --include-passed        Include passing traces instead of only failures\n  --output <path>         Write cluster report JSON to disk\n  --format <fmt>          Output format: human (default), json`,
	synthesize: `evalgate synthesize — Generate synthetic golden-case drafts from labeled failures\n\nUsage:\n  evalgate synthesize [options]\n\nOptions:\n  --dataset <path>            Labeled JSONL dataset path (default: .evalgate/golden/labeled.jsonl)\n  --dimensions <path>         Dimension matrix JSON path\n  --failure-mode <name>       Restrict to one or more failure modes (comma-separated)\n  --count <n>                 Number of synthetic cases to generate (default: mode × dimension coverage)\n  --output <path>             Synthetic JSONL output path (default: .evalgate/golden/synthetic.jsonl)\n  --format <fmt>              Output format: human (default), json`,
	auto: `evalgate auto — Plan or score one budget-aware experiment iteration\n\nUsage:\n  evalgate auto [options]\n\nOptions:\n  --objective <text>          Target failure mode or experiment goal (required)\n  --hypothesis <text>         Human-readable candidate hypothesis\n  --base <ref>                Baseline run report reference (default: baseline)\n  --head <path>               Candidate run report path to evaluate\n  --budget <n>                Planned iteration budget (default: 3)\n  --dry-run                   Produce a plan without making a keep/discard decision\n  --output <path>             Auto report JSON path (default: .evalgate/auto/latest.json)\n  --format <fmt>              Output format: human (default), json`,
	analyze: `evalgate analyze — Analyze labeled golden dataset failure modes (first pass)\n\nUsage:\n  evalgate analyze [options]\n\nOptions:\n  --dataset <path>  Labeled JSONL dataset path (default: .evalgate/golden/labeled.jsonl)\n  --format <fmt>    Output format: human (default), json\n  --top <n>         Number of top failure modes to show (default: 5)`,
	explain: `evalgate explain — Explain last gate/check failure\n\nUsage:\n  evalgate explain [options]\n\nOptions:\n  --report <path>  Path to report JSON (default: evals/regression-report.json)\n  --format <fmt>   Output format: human (default), json`,
	discover: `evalgate discover — Discover behavioral specs\n\nUsage:\n  evalgate discover [options]\n\nOptions:\n  --manifest  Generate evaluation manifest for incremental analysis\n\nAlso reports suite diversity and potentially redundant spec pairs.`,
	run: `evalgate run — Run evaluation specifications\n\nUsage:\n  evalgate run [options]\n\nOptions:\n  --spec-ids <ids>    Comma-separated list of spec IDs\n  --impacted-only     Run only impacted specs (requires --base)\n  --base <branch>     Base branch for impact analysis\n  --format <fmt>      Output format: human (default), json\n  --write-results     Write results to .evalgate/last-run.json`,
	diff: `evalgate diff — Compare two run reports\n\nUsage:\n  evalgate diff [options]\n\nOptions:\n  --base <ref>   Base branch or report path\n  --head <path>  Head report path\n  --format <fmt> Output format: human (default), json`,
	validate: `evalgate validate — Validate spec files without running them\n\nUsage:\n  evalgate validate [options]\n\nOptions:\n  --format <fmt>  Output format: human (default), json`,
	label: `evalgate label — Interactive trace labeling for golden dataset\n\nUsage:\n  evalgate label [options]\n\nOptions:\n  --run <path>       Run result JSON to label (default: searches evals/latest-run.json)\n  --output <path>    Labeled JSONL output path (default: .evalgate/golden/labeled.jsonl)\n  --format <fmt>     Output format: human (default), json\n\nSteps through traces from a run result, allowing pass/fail labeling\nand optional failure-mode tagging. Writes to canonical labeled.jsonl.`,
	doctor: `evalgate doctor — Comprehensive CI/CD readiness checklist\n\nUsage:\n  evalgate doctor [options]\n\nOptions:\n  --report         Output JSON diagnostic bundle\n\nRuns itemized pass/fail checks with exact remediation commands.`,
	promote: `evalgate promote — Promote candidate eval cases to regression suite\n\nUsage:\n  evalgate promote <candidate-id>     Promote a specific candidate\n  evalgate promote --auto             Auto-promote all eligible\n  evalgate promote --list             List promotable candidates\n\nOptions:\n  --evaluation-id <id>  Target evaluation (default: golden regression)\n  --apiKey <key>        API key\n  --baseUrl <url>       API base URL`,
	replay: `evalgate replay — Replay a candidate eval case\n\nUsage:\n  evalgate replay <candidate-id>\n\nOptions:\n  --model <model>   Override model\n  --format <fmt>    Output format: human (default), json\n  --apiKey <key>    API key\n  --baseUrl <url>   API base URL`,
	baseline: `evalgate baseline — Manage regression gate baselines\n\nUsage:\n  evalgate baseline init     Create starter evals/baseline.json\n  evalgate baseline update   Run tests and update baseline`,
	upgrade: `evalgate upgrade — Upgrade from Tier 1 to Tier 2\n\nUsage:\n  evalgate upgrade --full`,
	ci: `evalgate ci — One-command CI loop (manifest → impact → run → diff)\n\nUsage:\n  evalgate ci [options]\n\nOptions:\n  --base <ref>       Base reference for diff\n  --impacted-only    Run only impacted specs\n  --format <fmt>     Output format: human (default), json, github\n  --write-results    Write run results`,
	share: `evalgate share — Create share link for a run\n\nUsage:\n  evalgate share [options]\n\nOptions:\n  --scope <s>         Share scope\n  --evaluationId <id> Evaluation ID\n  --runId <id>        Run ID\n  --expires <dur>     Expiry duration (e.g. 7d)\n  --apiKey <key>      API key`,
	"impact-analysis": `evalgate impact-analysis — Analyze impact of changes\n\nUsage:\n  evalgate impact-analysis [options]\n\nOptions:\n  --base <branch>          Base branch (default: main)\n  --changed-files <files>  Comma-separated list of changed files\n  --format <fmt>           Output format: human (default), json`,
	"print-config": `evalgate print-config — Show resolved config\n\nUsage:\n  evalgate print-config [options]\n\nOptions:\n  --format <fmt>  Output format: human (default), json`,
};

// Intercept --help for any known subcommand
if (subcommand && wantsHelp && subcommand in SUBCOMMAND_HELP) {
	console.log(SUBCOMMAND_HELP[subcommand]);
	process.exit(0);
}

if (subcommand === "init") {
	const cwd = process.cwd();
	const args = argv.slice(1);

	// Handle --list-templates
	if (args.includes("--list-templates")) {
		printTemplateList();
		process.exit(0);
	}

	// Handle --template <name>
	const templateIndex = args.indexOf("--template");
	const templateName =
		templateIndex !== -1 ? args[templateIndex + 1] : undefined;

	if (templateName) {
		if (!AVAILABLE_TEMPLATES.includes(templateName as TemplateName)) {
			console.error(`  ✖ Unknown template: ${templateName}`);
			printTemplateList();
			process.exit(1);
		}
	}

	const ok = runInit(cwd);
	if (!ok) process.exit(1);

	// Install template after init if requested
	if (templateName) {
		console.log(`\n  📋 Installing template: ${templateName}\n`);
		const { filesCreated, filesSkipped } = installTemplate(
			templateName as TemplateName,
			cwd,
		);
		for (const f of filesCreated) console.log(`  ✔ Created ${f}`);
		for (const f of filesSkipped)
			console.log(`  – Skipped ${f} (already exists)`);
		console.log("");
	}

	process.exit(0);
} else if (subcommand === "start") {
	// Parse arguments for start command
	const args = argv.slice(1);
	const formatIndex = args.indexOf("--format");
	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";
	const watch = args.includes("--watch");
	const skipInit = args.includes("--skip-init");

	runStart({ format, watch, skipInit })
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "watch") {
	// Parse arguments for watch command
	const args = argv.slice(1);
	const formatIndex = args.indexOf("--format");
	const debounceIndex = args.indexOf("--debounce");
	const writeResultsIndex = args.indexOf("--write-results");

	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";
	const debounceMs =
		debounceIndex !== -1 ? parseInt(args[debounceIndex + 1], 10) : undefined;
	const writeResults = writeResultsIndex !== -1;
	const clearScreen = !args.includes("--no-clear");

	runWatch({ format, writeResults, debounceMs, clearScreen })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "compare") {
	// Parse arguments for compare command
	const args = argv.slice(1);
	const runsIndex = args.indexOf("--runs");
	const baseIndex = args.indexOf("--base");
	const headIndex = args.indexOf("--head");
	const labelsIndex = args.indexOf("--labels");
	const formatIndex = args.indexOf("--format");
	const sortByIndex = args.indexOf("--sort-by");

	// Collect run files: --runs <f1> <f2> ... OR --base <f1> --head <f2>
	const runs: string[] = [];
	if (runsIndex !== -1) {
		for (let i = runsIndex + 1; i < args.length; i++) {
			if (args[i].startsWith("--")) break;
			runs.push(args[i]);
		}
	} else {
		// --base / --head shorthand for 2-file compare
		if (baseIndex !== -1 && args[baseIndex + 1]) runs.push(args[baseIndex + 1]);
		if (headIndex !== -1 && args[headIndex + 1]) runs.push(args[headIndex + 1]);
	}

	// Collect labels (all args after --labels until next flag)
	const labels: string[] = [];
	if (labelsIndex !== -1) {
		for (let i = labelsIndex + 1; i < args.length; i++) {
			if (args[i].startsWith("--")) break;
			labels.push(args[i]);
		}
	}

	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";
	const sortBy =
		sortByIndex !== -1
			? (args[sortByIndex + 1] as "name" | "score" | "duration")
			: "name";

	if (runs.length < 2) {
		console.error("Error: At least 2 run files are required.");
		console.error(
			"Usage: evalgate compare --base results-a.json --head results-b.json",
		);
		console.error(
			"       evalgate compare --runs <file1> <file2> [<file3> ...]",
		);
		console.error(
			"       --labels are optional metadata, not required identifiers.",
		);
		process.exit(1);
	}

	runCompareCLI({
		runs,
		labels: labels.length > 0 ? labels : undefined,
		format,
		sortBy,
	})
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
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
} else if (subcommand === "promote") {
	runPromote(argv.slice(1))
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "replay") {
	runReplay(argv.slice(1))
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
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
} else if (subcommand === "analyze") {
	const code = runAnalyze(argv.slice(1));
	process.exit(code);
} else if (subcommand === "label") {
	runLabel(argv.slice(1))
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
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
	const watchFlag = args.includes("--watch");

	const specIds =
		specIdsIndex !== -1 ? args[specIdsIndex + 1]?.split(",") : undefined;
	const impactedOnly = impactedOnlyIndex !== -1;
	const baseBranch = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";
	const writeResults = writeResultsIndex !== -1;

	if (watchFlag) {
		// Delegate to watch mode
		const debounceIndex = args.indexOf("--debounce");
		const debounceMs =
			debounceIndex !== -1 ? parseInt(args[debounceIndex + 1], 10) : undefined;
		const clearScreen = !args.includes("--no-clear");
		runWatch({ specIds, format, writeResults, debounceMs, clearScreen })
			.then(() => process.exit(0))
			.catch((err) => {
				console.error(
					`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
				);
				process.exit(1);
			});
	} else {
		runEvaluationsCLI({
			specIds,
			impactedOnly: impactedOnly ? !!baseBranch : false,
			baseBranch,
			format,
			writeResults,
		})
			.then((code) => process.exit(code))
			.catch((err) => {
				console.error(
					`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
				);
				process.exit(2);
			});
	}
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
} else if (subcommand === "cluster") {
	runCluster(argv.slice(1))
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else if (subcommand === "synthesize") {
	const code = runSynthesize(argv.slice(1));
	process.exit(code);
} else if (subcommand === "auto") {
	runAuto(argv.slice(1))
		.then((code) => process.exit(code))
		.catch((err) => {
			console.error(
				`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
} else {
	console.log(`EvalGate CLI

Usage:
  evalgate start                 Zero-config startup (init + discover + run in one command)
    --watch                    Enable watch mode after first run
    --format <fmt>             Output format: human (default), json
  evalgate init                  Create evalgate.config.json + baseline + CI workflow
    --template <name>          Start with a real working template (chatbot, codegen, agent, safety, rag)
    --list-templates           Show all available templates
  evalgate label                 Interactive trace labeling for golden dataset
    --run <path>               Run result JSON to label (default: searches evals/latest-run.json)
    --output <path>            Labeled JSONL output path (default: .evalgate/golden/labeled.jsonl)
    --format <fmt>             Output format: human (default), json
  evalgate cluster               Group similar traces for cluster-level review
    --run <path>               Run result JSON to cluster (default: searches latest run)
    --clusters <n>             Requested number of clusters (default: auto)
    --include-passed           Include passing traces instead of only failures
    --output <path>            Write cluster report JSON to disk
    --format <fmt>             Output format: human (default), json
  evalgate synthesize            Generate synthetic golden-case drafts
    --dataset <path>           Labeled JSONL dataset path (default: .evalgate/golden/labeled.jsonl)
    --dimensions <path>        Dimension matrix JSON path
    --failure-mode <name>      Restrict to one or more failure modes (comma-separated)
    --count <n>                Number of synthetic cases to generate
    --output <path>            Synthetic JSONL output path (default: .evalgate/golden/synthetic.jsonl)
    --format <fmt>             Output format: human (default), json
  evalgate auto                  Plan or score one budget-aware experiment iteration
    --objective <text>         Target failure mode or experiment goal (required)
    --hypothesis <text>        Human-readable candidate hypothesis
    --base <ref>               Baseline run report reference (default: baseline)
    --head <path>              Candidate run report path to evaluate
    --budget <n>               Planned iteration budget (default: 3)
    --dry-run                  Produce a plan without making a keep/discard decision
    --output <path>            Auto report JSON path (default: .evalgate/auto/latest.json)
    --format <fmt>             Output format: human (default), json
  evalgate doctor                 Comprehensive CI/CD readiness checklist
    --report                   Output JSON diagnostic bundle (redacted)
  evalgate analyze                Analyze failure modes from labeled golden JSONL (first pass)l analysis
  evalgate run                   Run evaluation specifications
    --spec-ids <ids>           Comma-separated list of spec IDs to run
    --impacted-only            Run only specs impacted by changes (requires --base)
    --base <branch>            Base branch for impact analysis (with --impacted-only)
    --format <fmt>             Output format: human (default), json
    --write-results            Write results to .evalgate/last-run.json
    --watch                    Re-execute on file save (watch mode)
    --debounce <ms>            Watch debounce interval (default: 300ms)
    --no-clear                 Don't clear screen between watch runs
  evalgate watch                 Watch mode (alias for evalgate run --watch)
  evalgate compare               Side-by-side run comparison
    --base <file>              Baseline run result JSON file
    --head <file>              Head run result JSON file
    --runs <f1> <f2> [...]     N-way compare (3+ run files)
    --labels <l1> <l2> [...]   Optional human-readable labels (e.g., model names)
    --sort-by <key>            Sort by: name (default), score, duration
    --format <fmt>             Output format: human (default), json
  evalgate diff                  Compare two run reports and show behavioral changes
    --base <branch>            Base branch or report path (default: main)
    --head <path>              Head report path (default: .evalgate/last-run.json)
    --format <fmt>             Output format: human (default), json
  evalgate impact-analysis       Analyze impact of changes and suggest targeted tests
    --base <branch>            Base branch to compare against (default: main)
    --changed-files <files>    Comma-separated list of changed files (for CI)
    --format <fmt>             Output format: human (default), json
  evalgate ci                    One-command CI loop (manifest → impact → run → diff)
    --base <ref>               Base reference for diff
    --impacted-only            Run only specs impacted by changes
    --format <fmt>             Output format: human (default), json, github
    --write-results            Write run results to .evalgate/last-run.json
  evalgate gate [options]        Run regression gate (local test-based, no API needed)
  evalgate check [options]       CI/CD evaluation gate (API-based)
  evalgate analyze [options]     Analyze failure modes from labeled golden JSONL (first pass)
  evalgate explain [options]     Explain last gate/check failure with root causes + fixes
  evalgate doctor [options]      Comprehensive CI/CD readiness checklist
  evalgate validate              Validate spec files without running them
  evalgate baseline init         Create starter evals/baseline.json
  evalgate baseline update       Run tests and update baseline with real scores
  evalgate upgrade --full        Upgrade from Tier 1 to Tier 2 (full gate)
  evalgate print-config          Show resolved config with source-of-truth annotations
  evalgate share [options]       Create share link for a run

Examples:
  evalgate start                                          Zero to eval in one command
  evalgate init --template chatbot                        Scaffold with chatbot evals
  evalgate cluster --clusters 8                           Review failures in grouped clusters
  evalgate run --watch                                    Re-run on file save
  evalgate compare --base gpt4o.json --head claude.json    Side-by-side run diff
  evalgate run --spec-ids spec1,spec2                     Run specific specs
  evalgate run --impacted-only --base main                Run only impacted specs
  evalgate diff --base main                               Behavioral diff
  evalgate ci --base main --impacted-only                 Full CI loop
  evalgate gate --format json                             Regression gate
  evalgate check --minScore 92 --evaluationId 42          API-based gate
  evalgate analyze --dataset .evalgate/golden/labeled.jsonl  Failure mode frequency snapshot
  evalgate doctor                                         Preflight check
`);
	process.exit(subcommand === "--help" || subcommand === "-h" ? 0 : 1);
}
