/**
 * UX-401: One-command CI loop (evalgate ci)
 *
 * Provides a single command teams put in .github/workflows/* and never think about again.
 */

import * as fs from "node:fs/promises";
import type { DiffResult } from "./diff";
import { runDiff } from "./diff";
import { discoverSpecs } from "./discover";
import { runImpactAnalysis } from "./impact-analysis";
import type { RunResult } from "./run";
import { runEvaluations } from "./run";
import { resolveEvalWorkspace } from "./workspace";

/**
 * CI command options
 */
export interface CIOptions {
	/** Base reference for diff comparison */
	base?: string;
	/** Run only impacted specs */
	impactedOnly?: boolean;
	/** Output format */
	format?: "human" | "json" | "github";
	/** Write run results */
	writeResults?: boolean;
}

/**
 * CI execution result
 */
export interface CIResult {
	/** Success status */
	success: boolean;
	/** Exit code */
	exitCode: number;
	/** Execution narrative */
	narrative: string;
	/** Run result (if executed) */
	runResult?: RunResult;
	/** Diff result (if executed) */
	diffResult?: DiffResult;
	/** Error message (if failed) */
	error?: string;
}

/**
 * Run CI command
 */
export async function runCI(
	options: CIOptions,
	projectRoot: string = process.cwd(),
): Promise<CIResult> {
	const workspace = resolveEvalWorkspace(projectRoot);
	const narrative: string[] = [];

	try {
		// 1. Ensure .evalgate workspace exists
		await fs.mkdir(workspace.evalDir, { recursive: true });
		narrative.push("✅ workspace ok");

		// 2. Ensure manifest exists (build if missing)
		let manifestExists = true;
		try {
			await fs.access(workspace.manifestPath);
		} catch {
			manifestExists = false;
		}

		if (!manifestExists) {
			console.log("📋 Building evaluation manifest...");
			await discoverSpecs({ manifest: true });
			narrative.push("→ manifest built");
		} else {
			narrative.push("→ manifest ok");
		}

		// 3. Run impact analysis if --impacted-only
		let impactedSpecCount: number | undefined;
		if (options.impactedOnly) {
			const impactResult = await runImpactAnalysis(
				{
					baseBranch: options.base || "main",
				},
				projectRoot,
			);
			impactedSpecCount = impactResult.metadata.impactedCount;
			narrative.push(`→ impacted specs ${impactedSpecCount}`);
		} else {
			narrative.push("→ running all specs");
		}

		// 4. Run evaluations
		const runResult = await runEvaluations(
			{
				impactedOnly: options.impactedOnly,
				baseBranch: options.base,
				writeResults: options.writeResults ?? true, // Always write results for CI
			},
			projectRoot,
		);

		narrative.push(`→ runId ${runResult.runId}`);

		// 5. Run diff if --base provided
		let diffResult: DiffResult | undefined;
		if (options.base) {
			diffResult = await runDiff({
				base: options.base,
				head: "last",
			});

			if (diffResult.summary.regressions > 0) {
				narrative.push(`→ diff ${diffResult.summary.regressions} regressions`);
				return {
					success: false,
					exitCode: 1,
					narrative: narrative.join(" "),
					runResult,
					diffResult,
				};
			} else {
				narrative.push("→ diff clean");
			}
		} else {
			narrative.push("→ no diff");
		}

		// 6. Check for run failures
		if (runResult.summary.failed > 0) {
			return {
				success: false,
				exitCode: 1,
				narrative: narrative.join(" "),
				runResult,
				diffResult,
			};
		}

		return {
			success: true,
			exitCode: 0,
			narrative: narrative.join(" "),
			runResult,
			diffResult,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Print next step for debugging
		printNextStep(errorMessage, options, workspace);

		return {
			success: false,
			exitCode: 2, // Config/infra issue
			narrative: narrative.join(" "),
			error: errorMessage,
		};
	}
}

/**
 * Print copy/paste debug flow
 */
function printNextStep(
	error: string,
	options: CIOptions,
	workspace: any,
): void {
	console.log("\n🔧 Next step for debugging:");

	if (error.includes("No evaluation manifest found")) {
		console.log("   evalgate discover --manifest");
	} else if (error.includes("Base run report not found in CI environment")) {
		console.log(
			`   Download base artifact and run: evalgate diff --base .evalgate/base-run.json --head ${workspace.lastRunPath}`,
		);
	} else if (options.base && error.includes("Base run report not found")) {
		console.log(`   evalgate explain --report ${workspace.lastRunPath}`);
	} else {
		console.log(`   evalgate explain --report ${workspace.lastRunPath}`);
	}

	console.log(`   Artifacts: ${workspace.runsDir}/`);
}

/**
 * CLI entry point
 */
export async function runCICLI(options: CIOptions): Promise<void> {
	const result = await runCI(options);

	// Print narrative
	console.log(`🤖 ${result.narrative}`);

	// Print detailed results if not clean
	if (!result.success && result.runResult) {
		console.log("\n📊 Run Results:");
		console.log(`   ✅ Passed: ${result.runResult.summary.passed}`);
		console.log(`   ❌ Failed: ${result.runResult.summary.failed}`);
		console.log(
			`   📊 Pass Rate: ${(result.runResult.summary.passRate * 100).toFixed(1)}%`,
		);
	}

	if (!result.success && result.diffResult) {
		console.log("\n🔄 Diff Results:");
		console.log(`   📉 Regressions: ${result.diffResult.summary.regressions}`);
		console.log(
			`   📈 Improvements: ${result.diffResult.summary.improvements}`,
		);
		console.log(
			`   📊 Pass Rate Delta: ${(result.diffResult.summary.passRateDelta * 100).toFixed(1)}%`,
		);
	}

	if (result.error) {
		console.log(`\n❌ Error: ${result.error}`);
	}

	// Exit with appropriate code
	process.exit(result.exitCode);
}
