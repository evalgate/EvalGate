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
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { disposeActiveRuntime, getActiveRuntime } from "../runtime/registry";
import { runImpactAnalysis } from "./impact-analysis";
import type { EvaluationManifest, Spec } from "./manifest";

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
}

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

	// Execute specs
	const results = await executeSpecs(specsToRun);

	const completedAt = Date.now();
	const duration = completedAt - startTime;

	// Calculate summary
	const summary = calculateSummary(results);

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
		const content = await fs.readFile(manifestPath, "utf-8");
		return JSON.parse(content) as EvaluationManifest;
	} catch (_error) {
		return null;
	}
}

/**
 * Execute specifications — grouped by file to avoid redundant loads
 */
async function executeSpecs(specs: Spec[]): Promise<SpecResult[]> {
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

	for (const [absPath, fileSpecs] of specsByFile) {
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

	return results;
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
function calculateSummary(results: SpecResult[]): RunResult["summary"] {
	const passed = results.filter((r) => r.result.status === "passed").length;
	const failed = results.filter((r) => r.result.status === "failed").length;
	const skipped = results.filter((r) => r.result.status === "skipped").length;
	const passRate = results.length > 0 ? passed / results.length : 0;

	return {
		passed,
		failed,
		skipped,
		passRate,
	};
}

/**
 * Write run results to file
 */
async function writeRunResults(
	result: RunResult,
	projectRoot: string = process.cwd(),
): Promise<void> {
	const evalgateDir = path.join(projectRoot, ".evalgate");
	await fs.mkdir(evalgateDir, { recursive: true });

	// Write last-run.json (existing behavior)
	const lastRunPath = path.join(evalgateDir, "last-run.json");
	await fs.writeFile(lastRunPath, JSON.stringify(result, null, 2), "utf-8");

	// Create runs directory and write timestamped artifact
	if (result.runId) {
		const runsDir = path.join(evalgateDir, "runs");
		await fs.mkdir(runsDir, { recursive: true });

		const timestampedPath = path.join(runsDir, `${result.runId}.json`);
		await fs.writeFile(
			timestampedPath,
			JSON.stringify(result, null, 2),
			"utf-8",
		);

		// Optional: Create latest.json mirror
		const latestPath = path.join(runsDir, "latest.json");
		await fs.writeFile(latestPath, JSON.stringify(result, null, 2), "utf-8");
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

	await fs.mkdir(runsDir, { recursive: true });

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
		const existingContent = await fs.readFile(indexPath, "utf-8");
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
	await fs.writeFile(tempPath, JSON.stringify(index, null, 2), "utf-8");
	await fs.rename(tempPath, indexPath);
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
export function printHumanResults(result: RunResult): void {
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
export async function runEvaluationsCLI(options: RunOptions): Promise<void> {
	try {
		const result = await runEvaluations(options);

		if (options.format === "json") {
			printJsonResults(result);
		} else {
			printHumanResults(result);
		}

		// Exit with appropriate code
		if (result.summary.failed > 0) {
			process.exit(1);
		} else {
			process.exit(0);
		}
	} catch (error) {
		console.error(
			"❌ Run failed:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(2);
	}
}
