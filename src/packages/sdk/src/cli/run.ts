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

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { disposeActiveRuntime, getActiveRuntime } from "../runtime/registry";
import {
	checkFailureModeAlerts,
	type EvalAIConfig,
	loadConfig,
} from "./config";
import { runImpactAnalysis } from "./impact-analysis";
import type { EvaluationManifest, Spec } from "./manifest";
import {
	calculatePercentiles,
	formatLatencyTable,
	writeTraces,
} from "./traces";

/**
 * Run execution options
 */
export interface RunOptions {
	/** Filter to specific spec IDs */
	specIds?: string[];
	/** Run only impacted specs (requires base branch) */
	impactedOnly?: boolean;
	/** Base branch for impact analysis */
	baseBranch?: string;
	/** Output format */
	format?: "human" | "json";
	/** Write run results to file */
	writeResults?: boolean;
}

/**
 * Run execution result
 */
export interface RunResult {
	/** Schema version for compatibility checking */
	schemaVersion: number;
	/** Unique run identifier */
	runId: string;
	/** Execution metadata */
	metadata: {
		startedAt: number;
		completedAt: number;
		duration: number;
		totalSpecs: number;
		executedSpecs: number;
		mode: "spec" | "legacy";
	};
	/** Individual spec results */
	results: SpecResult[];
	/** Summary statistics */
	summary: {
		passed: number;
		failed: number;
		skipped: number;
		passRate: number;
		/** Per-failure-mode frequency counts (from labeled dataset) */
		failureModes?: Record<string, number>;
		/** Budget tracking information */
		budget?: {
			mode: "traces" | "cost";
			used: number;
			limit: number;
			exceeded: boolean;
		};
		/** Total cost in USD (when cost mode is used) */
		totalCostUsd?: number;
		/** Corrected pass rate from judge alignment (when available) */
		correctedPassRate?: number | null;
	};
}

/**
 * Individual spec result
 */
export interface SpecResult {
	/** Spec identifier */
	specId: string;
	/** Spec name */
	name: string;
	/** File path */
	filePath: string;
	/** Execution result */
	result: {
		status: "passed" | "failed" | "skipped";
		score?: number;
		error?: string;
		duration: number;
	};
	/** Input text — populated when executor provides it, used for labeling */
	input?: string;
	/** Expected output — populated when executor provides it, used for labeling */
	expected?: string;
	/** Actual output — populated when executor provides it, used for labeling */
	actual?: string;
}

/**
 * Schema version for RunResult — bump on breaking changes.
 */
export const RUN_RESULT_SCHEMA_VERSION = 1;

/**
 * Generate deterministic run ID
 */
function generateRunId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `run-${timestamp}-${random}`;
}

/**
 * Run evaluation specifications
 */
export async function runEvaluations(
	options: RunOptions,
	projectRoot: string = process.cwd(),
): Promise<RunResult> {
	const startTime = Date.now();

	// Load manifest
	const manifest = await loadManifest(projectRoot);
	if (!manifest) {
		throw new Error(
			"No evaluation manifest found. Run 'evalgate discover --manifest' first.",
		);
	}

	// Determine which specs to run
	let specsToRun = manifest.specs;

	if (options.impactedOnly && options.baseBranch) {
		// Run impact analysis first
		const impactResult = await runImpactAnalysis(
			{
				baseBranch: options.baseBranch,
			},
			projectRoot,
		);

		// Filter to impacted specs only
		const impactedSpecIds = new Set(impactResult.impactedSpecIds);
		specsToRun = manifest.specs.filter((spec) => impactedSpecIds.has(spec.id));

		console.log(
			`🎯 Running ${specsToRun.length} impacted specs (out of ${manifest.specs.length} total)`,
		);
	} else if (options.specIds && options.specIds.length > 0) {
		// Filter to specific spec IDs
		const specIdSet = new Set(options.specIds);
		specsToRun = manifest.specs.filter((spec) => specIdSet.has(spec.id));

		console.log(`🎯 Running ${specsToRun.length} specific specs`);
	} else if (options.specIds && options.specIds.length === 0) {
		// Explicit empty list means run nothing
		specsToRun = [];

		console.log(`🎯 Running 0 specs (explicit empty list)`);
	} else {
		console.log(`🎯 Running all ${specsToRun.length} specs`);
	}

	// Execute specs with budget enforcement
	const config = loadConfig(projectRoot);
	const { results, budgetExceeded } = await executeSpecs(
		specsToRun,
		config?.normalizedBudget,
	);

	const completedAt = Date.now();
	const duration = completedAt - startTime;

	// Get labeled dataset path for failure mode frequencies
	const labeledDatasetPath = config?.judge?.labeledDatasetPath
		? path.isAbsolute(config.judge.labeledDatasetPath)
			? config.judge.labeledDatasetPath
			: path.join(projectRoot, config.judge.labeledDatasetPath)
		: undefined;

	// Calculate summary with budget information
	const summary = await calculateSummary(
		results,
		labeledDatasetPath,
		config?.normalizedBudget,
	);

	// Add budget tracking to summary if budget config exists
	if (config?.normalizedBudget) {
		const budgetUsed =
			config.normalizedBudget.mode === "traces" ? results.length : 0; // TODO: Calculate actual cost when cost provider is implemented

		summary.budget = {
			mode: config.normalizedBudget.mode,
			used: budgetUsed,
			limit:
				config.normalizedBudget.mode === "traces"
					? config.normalizedBudget.maxTraces!
					: config.normalizedBudget.maxCostUsd!,
			exceeded: budgetExceeded,
		};
	}

	const runResult: RunResult = {
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
		const budgetUsed =
			config.normalizedBudget.mode === "traces" ? results.length : 0; // TODO: Calculate actual cost when cost provider is implemented

		const budgetLimit =
			config.normalizedBudget.mode === "traces"
				? config.normalizedBudget.maxTraces!
				: config.normalizedBudget.maxCostUsd!;

		console.log(
			`\n💰 Budget exceeded: ${budgetUsed}/${budgetLimit} ${config.normalizedBudget.mode} used`,
		);
		console.log(
			`Partial results saved → .evalgate/runs/run-${runResult.runId}.json (${results.length} traces)`,
		);
		console.log(`Replay decision: DISCARD (budget_exceeded)`);

		// Exit with budget exceeded code
		process.exit(2); // TODO: Add dedicated EXIT.BUDGET_EXCEEDED code
	}

	return runResult;
}

/**
 * Load evaluation manifest
 */
async function loadManifest(
	projectRoot: string = process.cwd(),
): Promise<EvaluationManifest | null> {
	const manifestPath = path.join(projectRoot, ".evalgate", "manifest.json");

	try {
		const content = await fsPromises.readFile(manifestPath, "utf-8");
		return JSON.parse(content) as EvaluationManifest;
	} catch (_error) {
		return null;
	}
}

/**
 * Execute specifications — grouped by file to avoid redundant loads
 * Enforces budget limits and saves partial results on budget exceeded
 */
async function executeSpecs(
	specs: Spec[],
	budgetConfig?: import("./config").NormalizedBudgetConfig,
): Promise<{ results: SpecResult[]; budgetExceeded: boolean }> {
	// Group specs by their absolute file path
	const specsByFile = new Map<string, Spec[]>();
	for (const spec of specs) {
		const abs = path.isAbsolute(spec.filePath)
			? spec.filePath
			: path.join(process.cwd(), spec.filePath);
		const group = specsByFile.get(abs) ?? [];
		group.push(spec);
		specsByFile.set(abs, group);
	}

	const results: SpecResult[] = [];
	let budgetExceeded = false;

	// Initialize budget tracking
	const budgetLimit =
		budgetConfig?.mode === "traces"
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
		disposeActiveRuntime();

		try {
			// Bust require cache so the file re-executes its defineEval calls
			delete (require.cache as Record<string, unknown>)[
				require.resolve(absPath)
			];
		} catch {
			// Not in cache yet — fine
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			require(absPath);
		} catch (loadError) {
			const isTs = absPath.endsWith(".ts") || absPath.endsWith(".tsx");
			const msg =
				isTs &&
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

		const runtime = getActiveRuntime();
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
						score:
							typeof evalResult.score === "number"
								? evalResult.score / 100
								: undefined,
						error: evalResult.error,
						duration: Date.now() - startTime,
					},
				});
			} catch (execError) {
				results.push(
					makeErrorResult(
						spec,
						execError instanceof Error ? execError.message : String(execError),
						Date.now() - startTime,
					),
				);
			}
		}
	}

	return { results, budgetExceeded };
}

function makeErrorResult(
	spec: Spec,
	error: string,
	duration: number,
): SpecResult {
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
async function calculateSummary(
	results: SpecResult[],
	labeledDatasetPath?: string,
	_budgetConfig?: import("./config").NormalizedBudgetConfig,
): Promise<RunResult["summary"]> {
	const passed = results.filter((r) => r.result.status === "passed").length;
	const failed = results.filter((r) => r.result.status === "failed").length;
	const skipped = results.filter((r) => r.result.status === "skipped").length;
	const passRate = results.length > 0 ? passed / results.length : 0;

	const summary: RunResult["summary"] = {
		passed,
		failed,
		skipped,
		passRate,
	};

	// Add failure mode frequencies if labeled dataset is available
	if (labeledDatasetPath) {
		try {
			const failureModes = await calculateFailureModeFrequencies(
				results,
				labeledDatasetPath,
			);
			if (Object.keys(failureModes).length > 0) {
				summary.failureModes = failureModes;
			}
		} catch (error) {
			// Don't fail the run if we can't read the labeled dataset
			console.warn(
				`Warning: Could not calculate failure mode frequencies: ${error}`,
			);
		}
	}

	return summary;
}

/**
 * Calculate failure mode frequencies from labeled dataset
 */
async function calculateFailureModeFrequencies(
	results: SpecResult[],
	labeledDatasetPath: string,
): Promise<Record<string, number>> {
	if (!fs.existsSync(labeledDatasetPath)) {
		return {};
	}

	try {
		const content = fs.readFileSync(labeledDatasetPath, "utf-8");
		const lines = content
			.split("\n")
			.filter((line: string) => line.trim().length > 0);

		// Build map of caseId -> failureMode from labeled dataset
		const labeledMap = new Map<string, string | null>();
		for (const line of lines) {
			try {
				const labeled = JSON.parse(line) as {
					caseId: string;
					label: string;
					failureMode: string | null;
				};
				if (labeled.label === "fail" && labeled.failureMode) {
					labeledMap.set(labeled.caseId, labeled.failureMode);
				}
			} catch {}
		}

		// Count failure modes for current run results
		const failureModeCounts = new Map<string, number>();
		for (const result of results) {
			if (result.result.status === "failed") {
				const failureMode = labeledMap.get(result.specId);
				if (failureMode) {
					failureModeCounts.set(
						failureMode,
						(failureModeCounts.get(failureMode) || 0) + 1,
					);
				}
			}
		}

		return Object.fromEntries(failureModeCounts);
	} catch (error) {
		throw new Error(`Failed to read labeled dataset: ${error}`);
	}
}

/**
 * Write run results to file
 */
async function writeRunResults(
	result: RunResult,
	projectRoot: string = process.cwd(),
): Promise<void> {
	const evalgateDir = path.join(projectRoot, ".evalgate");
	await fsPromises.mkdir(evalgateDir, { recursive: true });

	// Write last-run.json (existing behavior)
	const lastRunPath = path.join(evalgateDir, "last-run.json");
	await fsPromises.writeFile(
		lastRunPath,
		JSON.stringify(result, null, 2),
		"utf-8",
	);

	// Create runs directory and write timestamped artifact
	if (result.runId) {
		const runsDir = path.join(evalgateDir, "runs");
		await fsPromises.mkdir(runsDir, { recursive: true });

		const timestampedPath = path.join(runsDir, `${result.runId}.json`);
		await fsPromises.writeFile(
			timestampedPath,
			JSON.stringify(result, null, 2),
			"utf-8",
		);

		// Optional: Create latest.json mirror
		const latestPath = path.join(runsDir, "latest.json");
		await fsPromises.writeFile(
			latestPath,
			JSON.stringify(result, null, 2),
			"utf-8",
		);
	}

	console.log(`✅ Run results written to .evalgate/last-run.json`);
	if (result.runId) {
		console.log(`📁 Run artifact: .evalgate/runs/${result.runId}.json`);
	}
}

/**
 * Run index entry
 */
export interface RunIndexEntry {
	runId: string;
	createdAt: number;
	gitSha?: string;
	branch?: string;
	mode: "spec" | "legacy";
	specCount: number;
	passRate: number;
	avgScore: number;
}

/**
 * Update run index with new run entry
 */
async function updateRunIndex(
	result: RunResult,
	projectRoot: string = process.cwd(),
): Promise<void> {
	const runsDir = path.join(projectRoot, ".evalgate", "runs");
	const indexPath = path.join(runsDir, "index.json");

	await fsPromises.mkdir(runsDir, { recursive: true });

	// Calculate average score
	const scores = result.results
		.filter((r) => r.result.score !== undefined)
		.map((r) => r.result.score!);
	const avgScore =
		scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

	// Get git info if available
	let gitSha: string | undefined;
	let branch: string | undefined;
	try {
		gitSha = await getGitSha();
		branch = await getGitBranch();
	} catch {
		// Git commands not available, continue without git info
	}

	const indexEntry: RunIndexEntry = {
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
	let index: RunIndexEntry[] = [];
	try {
		const existingContent = await fsPromises.readFile(indexPath, "utf-8");
		index = JSON.parse(existingContent);
	} catch (_error) {
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
async function getGitSha(): Promise<string | undefined> {
	return new Promise((resolve) => {
		const git = spawn("git", ["rev-parse", "HEAD"], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		let output = "";
		git.stdout.on("data", (data) => {
			output += data.toString();
		});

		git.on("close", (code) => {
			if (code === 0 && output.trim()) {
				resolve(output.trim());
			} else {
				resolve(undefined);
			}
		});
	});
}

/**
 * Get current git branch
 */
async function getGitBranch(): Promise<string | undefined> {
	return new Promise((resolve) => {
		const git = spawn("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		let output = "";
		git.stdout.on("data", (data) => {
			output += data.toString();
		});

		git.on("close", (code) => {
			if (code === 0 && output.trim()) {
				resolve(output.trim());
			} else {
				resolve(undefined);
			}
		});
	});
}

/**
 * Print human-readable results
 */
export function printHumanResults(
	result: RunResult,
	config?: EvalAIConfig | null,
): void {
	console.log("\n🏃 Evaluation Run Results");
	console.log(`⏱️  Duration: ${result.metadata.duration}ms`);
	console.log(
		`📊 Specs: ${result.metadata.executedSpecs}/${result.metadata.totalSpecs} executed`,
	);
	console.log(`🎯 Mode: ${result.metadata.mode}`);

	console.log("\n📈 Summary:");
	console.log(`   ✅ Passed: ${result.summary.passed}`);
	console.log(`   ❌ Failed: ${result.summary.failed}`);
	console.log(`   ⏭️  Skipped: ${result.summary.skipped}`);
	console.log(
		`   📊 Pass Rate: ${(result.summary.passRate * 100).toFixed(1)}%`,
	);

	// Failure mode frequencies
	if (
		result.summary.failureModes &&
		Object.keys(result.summary.failureModes).length > 0
	) {
		console.log("\n🔍 Failure Modes:");
		const sortedModes = Object.entries(result.summary.failureModes).sort(
			(a, b) => b[1] - a[1],
		);
		for (const [mode, count] of sortedModes) {
			const percentage = ((count / result.summary.failed) * 100).toFixed(1);
			console.log(`   ${mode}: ${count} (${percentage}%)`);
		}

		// Check failure mode alerts
		if (config?.failureModeAlerts && result.summary.failureModes) {
			const alerts = checkFailureModeAlerts(
				result.summary.failureModes,
				result.summary.failed,
				config.failureModeAlerts,
			);
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
		const latency = calculatePercentiles(durations);
		console.log("");
		console.log(formatLatencyTable(latency));
	}

	const hasScores = result.results.some((r) => r.result.score !== undefined);
	console.log(
		`\n📋 Individual Results:${hasScores ? "  (score = value returned by spec executor, 0–100)" : ""}`,
	);
	for (const spec of result.results) {
		const status =
			spec.result.status === "passed"
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
export function printJsonResults(result: RunResult): void {
	console.log(JSON.stringify(result, null, 2));
}

/**
 * CLI entry point
 */
export async function runEvaluationsCLI(options: RunOptions): Promise<number> {
	try {
		const result = await runEvaluations(options);

		// Auto-write structured traces
		if (result.results.length > 0) {
			try {
				const tracePath = await writeTraces(result);
				if (options.format !== "json") {
					console.log(`\n🔍 Trace written to ${tracePath}`);
				}
			} catch {
				// Trace writing is best-effort, don't fail the run
			}
		}

		const runConfig = loadConfig(process.cwd());
		if (options.format === "json") {
			printJsonResults(result);
		} else {
			printHumanResults(result, runConfig);
		}

		// Return appropriate exit code (caller handles process.exit)
		return result.summary.failed > 0 ? 1 : 0;
	} catch (error) {
		console.error(
			"❌ Run failed:",
			error instanceof Error ? error.message : String(error),
		);
		return 2;
	}
}
