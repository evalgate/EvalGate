"use strict";
/**
 * TICKET 4 — Unified evalgate run CLI Command
 *
 * Goal: Consolidated execution interface that consumes manifest
 *
 * Features:
 * - Manifest loading and spec filtering
 * - --impacted-only integration with impact analysis
 * - Local executor integration
 * - .evalgate/last-run.json output
 * - Legacy mode compatibility
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUN_RESULT_SCHEMA_VERSION = void 0;
exports.runEvaluations = runEvaluations;
exports.printHumanResults = printHumanResults;
exports.printJsonResults = printJsonResults;
exports.runEvaluationsCLI = runEvaluationsCLI;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const fsPromises = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const registry_1 = require("../runtime/registry");
const config_1 = require("./config");
const impact_analysis_1 = require("./impact-analysis");
const traces_1 = require("./traces");
/**
 * Schema version for RunResult — bump on breaking changes.
 */
exports.RUN_RESULT_SCHEMA_VERSION = 1;
/**
 * Generate deterministic run ID
 */
function generateRunId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `run-${timestamp}-${random}`;
}
/**
 * Run evaluation specifications
 */
async function runEvaluations(options, projectRoot = process.cwd()) {
    const startTime = Date.now();
    // Load manifest
    const manifest = await loadManifest(projectRoot);
    if (!manifest) {
        throw new Error("No evaluation manifest found. Run 'evalgate discover --manifest' first.");
    }
    // Determine which specs to run
    let specsToRun = manifest.specs;
    if (options.impactedOnly && options.baseBranch) {
        // Run impact analysis first
        const impactResult = await (0, impact_analysis_1.runImpactAnalysis)({
            baseBranch: options.baseBranch,
        }, projectRoot);
        // Filter to impacted specs only
        const impactedSpecIds = new Set(impactResult.impactedSpecIds);
        specsToRun = manifest.specs.filter((spec) => impactedSpecIds.has(spec.id));
        console.log(`🎯 Running ${specsToRun.length} impacted specs (out of ${manifest.specs.length} total)`);
    }
    else if (options.specIds && options.specIds.length > 0) {
        // Filter to specific spec IDs
        const specIdSet = new Set(options.specIds);
        specsToRun = manifest.specs.filter((spec) => specIdSet.has(spec.id));
        console.log(`🎯 Running ${specsToRun.length} specific specs`);
    }
    else if (options.specIds && options.specIds.length === 0) {
        // Explicit empty list means run nothing
        specsToRun = [];
        console.log(`🎯 Running 0 specs (explicit empty list)`);
    }
    else {
        console.log(`🎯 Running all ${specsToRun.length} specs`);
    }
    // Execute specs with budget enforcement
    const config = (0, config_1.loadConfig)(projectRoot);
    const { results, budgetExceeded } = await executeSpecs(specsToRun, config?.normalizedBudget);
    const completedAt = Date.now();
    const duration = completedAt - startTime;
    // Get labeled dataset path for failure mode frequencies
    const labeledDatasetPath = config?.judge?.labeledDatasetPath
        ? path.isAbsolute(config.judge.labeledDatasetPath)
            ? config.judge.labeledDatasetPath
            : path.join(projectRoot, config.judge.labeledDatasetPath)
        : undefined;
    // Calculate summary with budget information
    const summary = await calculateSummary(results, labeledDatasetPath, config?.normalizedBudget);
    // Add budget tracking to summary if budget config exists
    if (config?.normalizedBudget) {
        const budgetUsed = config.normalizedBudget.mode === "traces" ? results.length : 0; // TODO: Calculate actual cost when cost provider is implemented
        summary.budget = {
            mode: config.normalizedBudget.mode,
            used: budgetUsed,
            limit: config.normalizedBudget.mode === "traces"
                ? config.normalizedBudget.maxTraces
                : config.normalizedBudget.maxCostUsd,
            exceeded: budgetExceeded,
        };
    }
    const runResult = {
        schemaVersion: 1,
        runId: generateRunId(),
        metadata: {
            startedAt: startTime,
            completedAt,
            duration,
            totalSpecs: manifest.specs.length,
            executedSpecs: specsToRun.length,
            mode: manifest.runtime.mode,
        },
        results,
        summary,
    };
    // Write results if requested
    if (options.writeResults) {
        await writeRunResults(runResult, projectRoot);
        await updateRunIndex(runResult, projectRoot);
    }
    // Handle budget exceeded - save partial results and exit with error
    if (budgetExceeded && config?.normalizedBudget) {
        const budgetUsed = config.normalizedBudget.mode === "traces" ? results.length : 0; // TODO: Calculate actual cost when cost provider is implemented
        const budgetLimit = config.normalizedBudget.mode === "traces"
            ? config.normalizedBudget.maxTraces
            : config.normalizedBudget.maxCostUsd;
        console.log(`\n💰 Budget exceeded: ${budgetUsed}/${budgetLimit} ${config.normalizedBudget.mode} used`);
        console.log(`Partial results saved → .evalgate/runs/run-${runResult.runId}.json (${results.length} traces)`);
        console.log(`Replay decision: DISCARD (budget_exceeded)`);
        // Exit with budget exceeded code
        process.exit(2); // TODO: Add dedicated EXIT.BUDGET_EXCEEDED code
    }
    return runResult;
}
/**
 * Load evaluation manifest
 */
async function loadManifest(projectRoot = process.cwd()) {
    const manifestPath = path.join(projectRoot, ".evalgate", "manifest.json");
    try {
        const content = await fsPromises.readFile(manifestPath, "utf-8");
        return JSON.parse(content);
    }
    catch (_error) {
        return null;
    }
}
/**
 * Execute specifications — grouped by file to avoid redundant loads
 * Enforces budget limits and saves partial results on budget exceeded
 */
async function executeSpecs(specs, budgetConfig) {
    // Group specs by their absolute file path
    const specsByFile = new Map();
    for (const spec of specs) {
        const abs = path.isAbsolute(spec.filePath)
            ? spec.filePath
            : path.join(process.cwd(), spec.filePath);
        const group = specsByFile.get(abs) ?? [];
        group.push(spec);
        specsByFile.set(abs, group);
    }
    const results = [];
    let budgetExceeded = false;
    // Initialize budget tracking
    const budgetLimit = budgetConfig?.mode === "traces"
        ? budgetConfig.maxTraces
        : budgetConfig?.mode === "cost"
            ? budgetConfig.maxCostUsd
            : undefined;
    for (const [absPath, fileSpecs] of specsByFile) {
        // Check budget before processing each file
        if (budgetConfig && budgetLimit !== undefined) {
            const currentUsage = budgetConfig.mode === "traces" ? results.length : 0; // TODO: Calculate actual cost when cost provider is implemented
            if (currentUsage >= budgetLimit) {
                budgetExceeded = true;
                // Mark remaining specs as skipped due to budget
                for (const spec of fileSpecs) {
                    results.push({
                        specId: spec.id,
                        name: spec.name,
                        filePath: spec.filePath,
                        result: {
                            status: "skipped",
                            error: `Budget exceeded: ${currentUsage}/${budgetLimit} ${budgetConfig.mode} used`,
                            duration: 0,
                        },
                    });
                }
                continue;
            }
        }
        // Fresh runtime per file to avoid cross-file contamination
        (0, registry_1.disposeActiveRuntime)();
        try {
            // Bust require cache so the file re-executes its defineEval calls
            delete require.cache[require.resolve(absPath)];
        }
        catch {
            // Not in cache yet — fine
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require(absPath);
        }
        catch (loadError) {
            const isTs = absPath.endsWith(".ts") || absPath.endsWith(".tsx");
            const msg = isTs &&
                loadError instanceof Error &&
                (loadError.message.includes("Unknown file extension") ||
                    loadError.message.includes("SyntaxError"))
                ? `TypeScript spec files require ts-node. Install: npm i -D ts-node, then run: node -r ts-node/register -e "require('@evalgate/sdk/register')" evalgate run`
                : loadError instanceof Error
                    ? loadError.message
                    : String(loadError);
            for (const spec of fileSpecs) {
                results.push(makeErrorResult(spec, msg, 0));
            }
            continue;
        }
        const runtime = (0, registry_1.getActiveRuntime)();
        const registered = runtime.list();
        for (const spec of fileSpecs) {
            const registeredSpec = registered.find((r) => r.name === spec.name);
            if (!registeredSpec) {
                results.push({
                    specId: spec.id,
                    name: spec.name,
                    filePath: spec.filePath,
                    result: {
                        status: "skipped",
                        error: `defineEval name "${spec.name}" not found in ${spec.filePath}`,
                        duration: 0,
                    },
                });
                continue;
            }
            const startTime = Date.now();
            try {
                const evalResult = await registeredSpec.executor({ input: "" });
                results.push({
                    specId: spec.id,
                    name: spec.name,
                    filePath: spec.filePath,
                    result: {
                        status: evalResult.pass ? "passed" : "failed",
                        score: typeof evalResult.score === "number"
                            ? evalResult.score / 100
                            : undefined,
                        error: evalResult.error,
                        duration: Date.now() - startTime,
                    },
                });
            }
            catch (execError) {
                results.push(makeErrorResult(spec, execError instanceof Error ? execError.message : String(execError), Date.now() - startTime));
            }
        }
    }
    return { results, budgetExceeded };
}
function makeErrorResult(spec, error, duration) {
    return {
        specId: spec.id,
        name: spec.name,
        filePath: spec.filePath,
        result: { status: "failed", error, duration },
    };
}
/**
 * Calculate summary statistics
 */
async function calculateSummary(results, labeledDatasetPath, _budgetConfig) {
    const passed = results.filter((r) => r.result.status === "passed").length;
    const failed = results.filter((r) => r.result.status === "failed").length;
    const skipped = results.filter((r) => r.result.status === "skipped").length;
    const passRate = results.length > 0 ? passed / results.length : 0;
    const summary = {
        passed,
        failed,
        skipped,
        passRate,
    };
    // Add failure mode frequencies if labeled dataset is available
    if (labeledDatasetPath) {
        try {
            const failureModes = await calculateFailureModeFrequencies(results, labeledDatasetPath);
            if (Object.keys(failureModes).length > 0) {
                summary.failureModes = failureModes;
            }
        }
        catch (error) {
            // Don't fail the run if we can't read the labeled dataset
            console.warn(`Warning: Could not calculate failure mode frequencies: ${error}`);
        }
    }
    return summary;
}
/**
 * Calculate failure mode frequencies from labeled dataset
 */
async function calculateFailureModeFrequencies(results, labeledDatasetPath) {
    if (!fs.existsSync(labeledDatasetPath)) {
        return {};
    }
    try {
        const content = fs.readFileSync(labeledDatasetPath, "utf-8");
        const lines = content
            .split("\n")
            .filter((line) => line.trim().length > 0);
        // Build map of caseId -> failureMode from labeled dataset
        const labeledMap = new Map();
        for (const line of lines) {
            try {
                const labeled = JSON.parse(line);
                if (labeled.label === "fail" && labeled.failureMode) {
                    labeledMap.set(labeled.caseId, labeled.failureMode);
                }
            }
            catch { }
        }
        // Count failure modes for current run results
        const failureModeCounts = new Map();
        for (const result of results) {
            if (result.result.status === "failed") {
                const failureMode = labeledMap.get(result.specId);
                if (failureMode) {
                    failureModeCounts.set(failureMode, (failureModeCounts.get(failureMode) || 0) + 1);
                }
            }
        }
        return Object.fromEntries(failureModeCounts);
    }
    catch (error) {
        throw new Error(`Failed to read labeled dataset: ${error}`);
    }
}
/**
 * Write run results to file
 */
async function writeRunResults(result, projectRoot = process.cwd()) {
    const evalgateDir = path.join(projectRoot, ".evalgate");
    await fsPromises.mkdir(evalgateDir, { recursive: true });
    // Write last-run.json (existing behavior)
    const lastRunPath = path.join(evalgateDir, "last-run.json");
    await fsPromises.writeFile(lastRunPath, JSON.stringify(result, null, 2), "utf-8");
    // Create runs directory and write timestamped artifact
    if (result.runId) {
        const runsDir = path.join(evalgateDir, "runs");
        await fsPromises.mkdir(runsDir, { recursive: true });
        const timestampedPath = path.join(runsDir, `${result.runId}.json`);
        await fsPromises.writeFile(timestampedPath, JSON.stringify(result, null, 2), "utf-8");
        // Optional: Create latest.json mirror
        const latestPath = path.join(runsDir, "latest.json");
        await fsPromises.writeFile(latestPath, JSON.stringify(result, null, 2), "utf-8");
    }
    console.log(`✅ Run results written to .evalgate/last-run.json`);
    if (result.runId) {
        console.log(`📁 Run artifact: .evalgate/runs/${result.runId}.json`);
    }
}
/**
 * Update run index with new run entry
 */
async function updateRunIndex(result, projectRoot = process.cwd()) {
    const runsDir = path.join(projectRoot, ".evalgate", "runs");
    const indexPath = path.join(runsDir, "index.json");
    await fsPromises.mkdir(runsDir, { recursive: true });
    // Calculate average score
    const scores = result.results
        .filter((r) => r.result.score !== undefined)
        .map((r) => r.result.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    // Get git info if available
    let gitSha;
    let branch;
    try {
        gitSha = await getGitSha();
        branch = await getGitBranch();
    }
    catch {
        // Git commands not available, continue without git info
    }
    const indexEntry = {
        runId: result.runId,
        createdAt: result.metadata.startedAt,
        gitSha,
        branch,
        mode: result.metadata.mode,
        specCount: result.results.length,
        passRate: result.summary.passRate,
        avgScore,
    };
    // Read existing index or create new one
    let index = [];
    try {
        const existingContent = await fsPromises.readFile(indexPath, "utf-8");
        index = JSON.parse(existingContent);
    }
    catch (_error) {
        // Index doesn't exist yet, start with empty array
    }
    // Add new entry
    index.push(indexEntry);
    // Sort by creation time (newest first)
    index.sort((a, b) => b.createdAt - a.createdAt);
    // Write to temp file first, then rename for atomicity
    const tempPath = `${indexPath}.tmp`;
    await fsPromises.writeFile(tempPath, JSON.stringify(index, null, 2), "utf-8");
    await fsPromises.rename(tempPath, indexPath);
}
/**
 * Get current git SHA
 */
async function getGitSha() {
    return new Promise((resolve) => {
        const git = (0, node_child_process_1.spawn)("git", ["rev-parse", "HEAD"], {
            stdio: ["pipe", "pipe", "pipe"],
        });
        let output = "";
        git.stdout.on("data", (data) => {
            output += data.toString();
        });
        git.on("close", (code) => {
            if (code === 0 && output.trim()) {
                resolve(output.trim());
            }
            else {
                resolve(undefined);
            }
        });
    });
}
/**
 * Get current git branch
 */
async function getGitBranch() {
    return new Promise((resolve) => {
        const git = (0, node_child_process_1.spawn)("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
            stdio: ["pipe", "pipe", "pipe"],
        });
        let output = "";
        git.stdout.on("data", (data) => {
            output += data.toString();
        });
        git.on("close", (code) => {
            if (code === 0 && output.trim()) {
                resolve(output.trim());
            }
            else {
                resolve(undefined);
            }
        });
    });
}
/**
 * Print human-readable results
 */
function printHumanResults(result, config) {
    console.log("\n🏃 Evaluation Run Results");
    console.log(`⏱️  Duration: ${result.metadata.duration}ms`);
    console.log(`📊 Specs: ${result.metadata.executedSpecs}/${result.metadata.totalSpecs} executed`);
    console.log(`🎯 Mode: ${result.metadata.mode}`);
    console.log("\n📈 Summary:");
    console.log(`   ✅ Passed: ${result.summary.passed}`);
    console.log(`   ❌ Failed: ${result.summary.failed}`);
    console.log(`   ⏭️  Skipped: ${result.summary.skipped}`);
    console.log(`   📊 Pass Rate: ${(result.summary.passRate * 100).toFixed(1)}%`);
    // Failure mode frequencies
    if (result.summary.failureModes &&
        Object.keys(result.summary.failureModes).length > 0) {
        console.log("\n🔍 Failure Modes:");
        const sortedModes = Object.entries(result.summary.failureModes).sort((a, b) => b[1] - a[1]);
        for (const [mode, count] of sortedModes) {
            const percentage = ((count / result.summary.failed) * 100).toFixed(1);
            console.log(`   ${mode}: ${count} (${percentage}%)`);
        }
        // Check failure mode alerts
        if (config?.failureModeAlerts && result.summary.failureModes) {
            const alerts = (0, config_1.checkFailureModeAlerts)(result.summary.failureModes, result.summary.failed, config.failureModeAlerts);
            if (alerts.length > 0) {
                console.log("\n⚠️  Failure Mode Alerts:");
                for (const alert of alerts) {
                    console.log(`   ${alert}`);
                }
            }
        }
    }
    // Latency percentiles
    const durations = result.results
        .filter((r) => r.result.status !== "skipped")
        .map((r) => r.result.duration);
    if (durations.length > 0) {
        const latency = (0, traces_1.calculatePercentiles)(durations);
        console.log("");
        console.log((0, traces_1.formatLatencyTable)(latency));
    }
    const hasScores = result.results.some((r) => r.result.score !== undefined);
    console.log(`\n📋 Individual Results:${hasScores ? "  (score = value returned by spec executor, 0–100)" : ""}`);
    for (const spec of result.results) {
        const status = spec.result.status === "passed"
            ? "✅"
            : spec.result.status === "failed"
                ? "❌"
                : "⏭️";
        const score = spec.result.score
            ? ` (${(spec.result.score * 100).toFixed(1)}%)`
            : "";
        const error = spec.result.error ? ` - ${spec.result.error}` : "";
        console.log(`   ${status} ${spec.name}${score}${error}`);
    }
}
/**
 * Print JSON results
 */
function printJsonResults(result) {
    console.log(JSON.stringify(result, null, 2));
}
/**
 * CLI entry point
 */
async function runEvaluationsCLI(options) {
    try {
        const result = await runEvaluations(options);
        // Auto-write structured traces
        if (result.results.length > 0) {
            try {
                const tracePath = await (0, traces_1.writeTraces)(result);
                if (options.format !== "json") {
                    console.log(`\n🔍 Trace written to ${tracePath}`);
                }
            }
            catch {
                // Trace writing is best-effort, don't fail the run
            }
        }
        const runConfig = (0, config_1.loadConfig)(process.cwd());
        if (options.format === "json") {
            printJsonResults(result);
        }
        else {
            printHumanResults(result, runConfig);
        }
        // Return appropriate exit code (caller handles process.exit)
        return result.summary.failed > 0 ? 1 : 0;
    }
    catch (error) {
        console.error("❌ Run failed:", error instanceof Error ? error.message : String(error));
        return 2;
    }
}
