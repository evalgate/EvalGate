#!/usr/bin/env node
"use strict";
/**
 * evalgate — EvalGate CLI
 *
 * Commands:
 *   evalgate init   — Create evalgate.config.json
 *   evalgate check  — CI/CD evaluation gate (see evalgate check --help)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const baseline_1 = require("./baseline");
const check_1 = require("./check");
const ci_1 = require("./ci");
const compare_1 = require("./compare");
const diff_1 = require("./diff");
const discover_1 = require("./discover");
const doctor_1 = require("./doctor");
const explain_1 = require("./explain");
const impact_analysis_1 = require("./impact-analysis");
const init_1 = require("./init");
const migrate_1 = require("./migrate");
const print_config_1 = require("./print-config");
const regression_gate_1 = require("./regression-gate");
const run_1 = require("./run");
const share_1 = require("./share");
const start_1 = require("./start");
const templates_1 = require("./templates");
const upgrade_1 = require("./upgrade");
const validate_1 = require("./validate");
const watch_1 = require("./watch");
const argv = process.argv.slice(2);
const subcommand = argv[0];
const subArgs = argv.slice(1);
const wantsHelp = subArgs.includes("--help") || subArgs.includes("-h");
// ── Per-subcommand help text ──
const SUBCOMMAND_HELP = {
    init: `evalgate init — Create evalgate.config.json + baseline + CI workflow\n\nUsage:\n  evalgate init [options]\n\nOptions:\n  --template <name>  Start with a real working template (chatbot, codegen, agent, safety, rag)\n  --list-templates   Show all available templates\n\nCreates project scaffolding for EvalGate in the current directory.`,
    start: `evalgate start — Zero-config startup (one command → passing run)\n\nUsage:\n  evalgate start [options]\n\nOptions:\n  --format <fmt>   Output format: human (default), json\n  --watch          Enable watch mode after first run\n  --skip-init      Skip initialization if not set up\n\nExamples:\n  evalgate start\n  evalgate start --watch\n  evalgate start --format json`,
    compare: `evalgate compare — Side-by-side result file comparison\n\nCompares two or more saved run result JSON files. Does NOT re-run anything.\nYou run each model/config separately (evalgate run --write-results), then compare the artifacts.\n\nUsage:\n  evalgate compare --base <file> --head <file> [options]\n  evalgate compare --runs <file1> <file2> [file3...] [options]\n\nOptions:\n  --base <file>      Baseline run result JSON file\n  --head <file>      Head run result JSON file\n  --runs <files>     N-way compare (3+ run result JSON files)\n  --labels <names>   Optional cosmetic labels for the output table (e.g., model names)\n  --format <fmt>     Output format: human (default), json\n  --sort-by <key>    Sort by: name (default), score, duration\n\nExamples:\n  evalgate compare --base .evalgate/runs/run-a.json --head .evalgate/runs/run-b.json\n  evalgate compare --base gpt4o.json --head claude.json --labels "GPT-4o" "Claude 3.5"\n  evalgate compare --runs run-a.json run-b.json run-c.json`,
    watch: `evalgate watch — Watch mode (re-execute on file save)\n\nUsage:\n  evalgate run --watch [options]\n  evalgate watch [options]\n\nOptions:\n  --debounce <ms>    Debounce interval (default: 300ms)\n  --no-clear         Don't clear screen between runs\n  --format <fmt>     Output format: human (default), json\n  --write-results    Write results to .evalgate/last-run.json\n\nExamples:\n  evalgate run --watch\n  evalgate watch --write-results`,
    gate: `evalgate gate — Run the regression gate\n\nUsage:\n  evalgate gate [options]\n\nOptions:\n  --format <fmt>   Output format: human (default), json, github\n  --dry-run        Run checks but always exit 0 (preview mode)\n\nExamples:\n  evalgate gate\n  evalgate gate --format json\n  evalgate gate --dry-run`,
    check: `evalgate check — CI/CD evaluation gate (API-based)\n\nUsage:\n  evalgate check [options]\n\nOptions:\n  --evaluationId <id>  Evaluation to gate on\n  --apiKey <key>       API key (or EVALGATE_API_KEY env)\n  --format <fmt>       Output format: human (default), json, github\n  --explain            Show score breakdown\n  --minScore <n>       Fail if score < n\n  --maxDrop <n>        Fail if score dropped > n\n  --policy <name>      Enforce policy (HIPAA, SOC2, etc.)\n\nExamples:\n  evalgate check --minScore 92 --evaluationId 42`,
    explain: `evalgate explain — Explain last gate/check failure\n\nUsage:\n  evalgate explain [options]\n\nOptions:\n  --report <path>  Path to report JSON (default: evals/regression-report.json)\n  --format <fmt>   Output format: human (default), json`,
    discover: `evalgate discover — Discover behavioral specs\n\nUsage:\n  evalgate discover [options]\n\nOptions:\n  --manifest  Generate evaluation manifest for incremental analysis`,
    run: `evalgate run — Run evaluation specifications\n\nUsage:\n  evalgate run [options]\n\nOptions:\n  --spec-ids <ids>    Comma-separated list of spec IDs\n  --impacted-only     Run only impacted specs (requires --base)\n  --base <branch>     Base branch for impact analysis\n  --format <fmt>      Output format: human (default), json\n  --write-results     Write results to .evalgate/last-run.json`,
    diff: `evalgate diff — Compare two run reports\n\nUsage:\n  evalgate diff [options]\n\nOptions:\n  --base <ref>   Base branch or report path\n  --head <path>  Head report path\n  --format <fmt> Output format: human (default), json`,
    validate: `evalgate validate — Validate spec files without running them\n\nUsage:\n  evalgate validate [options]\n\nOptions:\n  --format <fmt>  Output format: human (default), json`,
    doctor: `evalgate doctor — Comprehensive CI/CD readiness checklist\n\nUsage:\n  evalgate doctor [options]\n\nOptions:\n  --report         Output JSON diagnostic bundle\n  --format <fmt>   Output format: human (default), json\n  --strict         Treat warnings as failures\n  --apiKey <key>   API key\n  --evaluationId <id>  Evaluation to verify`,
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
        (0, templates_1.printTemplateList)();
        process.exit(0);
    }
    // Handle --template <name>
    const templateIndex = args.indexOf("--template");
    const templateName = templateIndex !== -1 ? args[templateIndex + 1] : undefined;
    if (templateName) {
        if (!templates_1.AVAILABLE_TEMPLATES.includes(templateName)) {
            console.error(`  ✖ Unknown template: ${templateName}`);
            (0, templates_1.printTemplateList)();
            process.exit(1);
        }
    }
    const ok = (0, init_1.runInit)(cwd);
    if (!ok)
        process.exit(1);
    // Install template after init if requested
    if (templateName) {
        console.log(`\n  📋 Installing template: ${templateName}\n`);
        const { filesCreated, filesSkipped } = (0, templates_1.installTemplate)(templateName, cwd);
        for (const f of filesCreated)
            console.log(`  ✔ Created ${f}`);
        for (const f of filesSkipped)
            console.log(`  – Skipped ${f} (already exists)`);
        console.log("");
    }
    process.exit(0);
}
else if (subcommand === "start") {
    // Parse arguments for start command
    const args = argv.slice(1);
    const formatIndex = args.indexOf("--format");
    const format = formatIndex !== -1 ? args[formatIndex + 1] : "human";
    const watch = args.includes("--watch");
    const skipInit = args.includes("--skip-init");
    (0, start_1.runStart)({ format, watch, skipInit })
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "watch") {
    // Parse arguments for watch command
    const args = argv.slice(1);
    const formatIndex = args.indexOf("--format");
    const debounceIndex = args.indexOf("--debounce");
    const writeResultsIndex = args.indexOf("--write-results");
    const format = formatIndex !== -1 ? args[formatIndex + 1] : "human";
    const debounceMs = debounceIndex !== -1 ? parseInt(args[debounceIndex + 1], 10) : undefined;
    const writeResults = writeResultsIndex !== -1;
    const clearScreen = !args.includes("--no-clear");
    (0, watch_1.runWatch)({ format, writeResults, debounceMs, clearScreen })
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "compare") {
    // Parse arguments for compare command
    const args = argv.slice(1);
    const runsIndex = args.indexOf("--runs");
    const baseIndex = args.indexOf("--base");
    const headIndex = args.indexOf("--head");
    const labelsIndex = args.indexOf("--labels");
    const formatIndex = args.indexOf("--format");
    const sortByIndex = args.indexOf("--sort-by");
    // Collect run files: --runs <f1> <f2> ... OR --base <f1> --head <f2>
    const runs = [];
    if (runsIndex !== -1) {
        for (let i = runsIndex + 1; i < args.length; i++) {
            if (args[i].startsWith("--"))
                break;
            runs.push(args[i]);
        }
    }
    else {
        // --base / --head shorthand for 2-file compare
        if (baseIndex !== -1 && args[baseIndex + 1])
            runs.push(args[baseIndex + 1]);
        if (headIndex !== -1 && args[headIndex + 1])
            runs.push(args[headIndex + 1]);
    }
    // Collect labels (all args after --labels until next flag)
    const labels = [];
    if (labelsIndex !== -1) {
        for (let i = labelsIndex + 1; i < args.length; i++) {
            if (args[i].startsWith("--"))
                break;
            labels.push(args[i]);
        }
    }
    const format = formatIndex !== -1 ? args[formatIndex + 1] : "human";
    const sortBy = sortByIndex !== -1
        ? args[sortByIndex + 1]
        : "name";
    if (runs.length < 2) {
        console.error("Error: At least 2 run files are required.");
        console.error("Usage: evalgate compare --base results-a.json --head results-b.json");
        console.error("       evalgate compare --runs <file1> <file2> [<file3> ...]");
        console.error("       --labels are optional metadata, not required identifiers.");
        process.exit(1);
    }
    (0, compare_1.runCompareCLI)({
        runs,
        labels: labels.length > 0 ? labels : undefined,
        format,
        sortBy,
    })
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "baseline") {
    const code = (0, baseline_1.runBaseline)(argv.slice(1));
    process.exit(code);
}
else if (subcommand === "gate") {
    const code = (0, regression_gate_1.runGate)(argv.slice(1));
    process.exit(code);
}
else if (subcommand === "migrate") {
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
            }
            else if (arg === "--out" || arg === "-o") {
                outputPath = argv[++i];
            }
            else if (arg === "--verbose" || arg === "-v") {
                verbose = true;
            }
            else if (arg === "--no-helpers") {
                helpers = false;
            }
            else if (arg === "--no-preserve-ids") {
                preserveIds = false;
            }
            else if (arg === "--no-provenance") {
                provenance = false;
            }
        }
        if (!inputPath || !outputPath) {
            console.error("Error: Both --in and --out options are required");
            console.error("Usage: evalgate migrate config --in <input> --out <output> [options]");
            process.exit(1);
        }
        (0, migrate_1.migrateConfig)({
            input: inputPath,
            output: outputPath,
            verbose,
            helpers,
            preserveIds,
            provenance,
        }).catch((err) => {
            console.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        });
    }
    else {
        console.error("Error: Unknown migrate subcommand. Use 'evalgate migrate config'");
        process.exit(1);
    }
}
else if (subcommand === "upgrade") {
    const code = (0, upgrade_1.runUpgrade)(argv.slice(1));
    process.exit(code);
}
else if (subcommand === "doctor") {
    (0, doctor_1.runDoctor)(argv.slice(1))
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "check") {
    const parsed = (0, check_1.parseArgs)(argv.slice(1));
    if (!parsed.ok) {
        console.error(parsed.message);
        process.exit(parsed.exitCode);
    }
    (0, check_1.runCheck)(parsed.args)
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(4);
    });
}
else if (subcommand === "explain") {
    (0, explain_1.runExplain)(argv.slice(1))
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "print-config") {
    const code = (0, print_config_1.runPrintConfig)(argv.slice(1));
    process.exit(code);
}
else if (subcommand === "share") {
    const parsed = (0, share_1.parseShareArgs)(argv.slice(1));
    if ("error" in parsed) {
        console.error(parsed.error);
        process.exit(1);
    }
    (0, share_1.runShare)(parsed)
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "discover") {
    // Parse arguments for discover command
    const args = argv.slice(1);
    const manifestFlag = args.includes("--manifest");
    (0, discover_1.discoverSpecs)({ manifest: manifestFlag })
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "impact-analysis") {
    // Parse arguments for impact-analysis command
    const args = argv.slice(1);
    const baseIndex = args.indexOf("--base");
    const changedFilesIndex = args.indexOf("--changed-files");
    const formatIndex = args.indexOf("--format");
    const baseBranch = baseIndex !== -1 ? args[baseIndex + 1] : "main";
    const changedFiles = changedFilesIndex !== -1
        ? args[changedFilesIndex + 1]?.split(",")
        : undefined;
    const format = formatIndex !== -1 ? args[formatIndex + 1] : "human";
    (0, impact_analysis_1.runImpactAnalysisCLI)({ baseBranch, changedFiles, format })
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(2);
    });
}
else if (subcommand === "run") {
    // Parse arguments for run command
    const args = argv.slice(1);
    const specIdsIndex = args.indexOf("--spec-ids");
    const impactedOnlyIndex = args.indexOf("--impacted-only");
    const baseIndex = args.indexOf("--base");
    const formatIndex = args.indexOf("--format");
    const writeResultsIndex = args.indexOf("--write-results");
    const watchFlag = args.includes("--watch");
    const specIds = specIdsIndex !== -1 ? args[specIdsIndex + 1]?.split(",") : undefined;
    const impactedOnly = impactedOnlyIndex !== -1;
    const baseBranch = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
    const format = formatIndex !== -1 ? args[formatIndex + 1] : "human";
    const writeResults = writeResultsIndex !== -1;
    if (watchFlag) {
        // Delegate to watch mode
        const debounceIndex = args.indexOf("--debounce");
        const debounceMs = debounceIndex !== -1 ? parseInt(args[debounceIndex + 1], 10) : undefined;
        const clearScreen = !args.includes("--no-clear");
        (0, watch_1.runWatch)({ specIds, format, writeResults, debounceMs, clearScreen })
            .then(() => process.exit(0))
            .catch((err) => {
            console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        });
    }
    else {
        (0, run_1.runEvaluationsCLI)({
            specIds,
            impactedOnly: impactedOnly ? !!baseBranch : false,
            baseBranch,
            format,
            writeResults,
        })
            .then(() => process.exit(0))
            .catch((err) => {
            console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(2);
        });
    }
}
else if (subcommand === "diff") {
    // Parse arguments for diff command
    const args = argv.slice(1);
    const baseIndex = args.indexOf("--base");
    const headIndex = args.indexOf("--head");
    const formatIndex = args.indexOf("--format");
    const base = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
    const head = headIndex !== -1 ? args[headIndex + 1] : undefined;
    const format = formatIndex !== -1 ? args[formatIndex + 1] : "human";
    (0, diff_1.runDiffCLI)({ base, head, format })
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(2);
    });
}
else if (subcommand === "validate") {
    (0, validate_1.runValidate)(argv.slice(1))
        .then((result) => process.exit(result.passed ? 0 : 1))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "ci") {
    // Parse arguments for ci command
    const args = argv.slice(1);
    const baseIndex = args.indexOf("--base");
    const impactedOnlyIndex = args.indexOf("--impacted-only");
    const formatIndex = args.indexOf("--format");
    const writeResultsIndex = args.indexOf("--write-results");
    const base = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
    const impactedOnly = impactedOnlyIndex !== -1;
    const format = formatIndex !== -1
        ? args[formatIndex + 1]
        : "human";
    const writeResults = writeResultsIndex !== -1;
    (0, ci_1.runCICLI)({ base, impactedOnly, format, writeResults })
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(`EvalGate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(2);
    });
}
else {
    console.log(`EvalGate CLI

Usage:
  evalgate start                 Zero-config startup (init + discover + run in one command)
    --watch                    Enable watch mode after first run
    --format <fmt>             Output format: human (default), json
  evalgate init                  Create evalgate.config.json + baseline + CI workflow
    --template <name>          Start with a template (chatbot, codegen, agent, safety, rag)
    --list-templates           Show all available templates
  evalgate discover              Discover behavioral specs in project and show statistics
    --manifest                 Generate evaluation manifest for incremental analysis
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
  evalgate run --watch                                    Re-run on file save
  evalgate compare --base gpt4o.json --head claude.json    Side-by-side run diff
  evalgate run --spec-ids spec1,spec2                     Run specific specs
  evalgate run --impacted-only --base main                Run only impacted specs
  evalgate diff --base main                               Behavioral diff
  evalgate ci --base main --impacted-only                 Full CI loop
  evalgate gate --format json                             Regression gate
  evalgate check --minScore 92 --evaluationId 42          API-based gate
  evalgate doctor                                         Preflight check
`);
    process.exit(subcommand === "--help" || subcommand === "-h" ? 0 : 1);
}
