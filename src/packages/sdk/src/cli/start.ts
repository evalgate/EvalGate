/**
 * evalgate start — Zero-config startup
 *
 * One command to go from nothing to a passing eval run:
 *   npx evalgate start
 *
 * What it does:
 *   1. If no evalgate.config.json, runs init
 *   2. If no manifest, runs discover --manifest
 *   3. Runs evalgate run --write-results
 *   4. Prints results
 *
 * The goal: zero decisions, one command, immediate value.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { discoverSpecs } from "./discover";
import { runInit } from "./init";
import { printHumanResults, printJsonResults, runEvaluations } from "./run";

export interface StartOptions {
	/** Output format */
	format?: "human" | "json";
	/** Skip init if not already set up */
	skipInit?: boolean;
	/** Enable watch mode after first run */
	watch?: boolean;
}

/**
 * Zero-config startup: one command → passing run
 */
export async function runStart(
	options: StartOptions = {},
	projectRoot: string = process.cwd(),
): Promise<number> {
	const format = options.format ?? "human";

	if (format === "human") {
		console.log("\n🚀 evalgate start — zero-config evaluation run\n");
	}

	// Step 1: Ensure project is initialized
	const configPath = path.join(projectRoot, "evalgate.config.json");
	if (!fs.existsSync(configPath) && !options.skipInit) {
		if (format === "human") {
			console.log("📦 No evalgate.config.json found. Initializing...\n");
		}
		const initOk = runInit(projectRoot);
		if (!initOk) {
			console.error("❌ Initialization failed. Run `evalgate init` manually.");
			return 1;
		}
		if (format === "human") console.log("");
	}

	// Step 2: Ensure manifest exists (discover specs)
	const manifestPath = path.join(projectRoot, ".evalgate", "manifest.json");
	if (!fs.existsSync(manifestPath)) {
		if (format === "human") {
			console.log("🔍 No manifest found. Discovering specs...\n");
		}
		try {
			await discoverSpecs({ manifest: true });
		} catch (err) {
			// Discovery may fail if no spec files exist yet — that's OK for legacy mode
			if (format === "human") {
				console.log(
					`   ℹ️  Discovery: ${err instanceof Error ? err.message : String(err)}`,
				);
				console.log("   Falling back to gate mode...\n");
			}
		}
	}

	// Step 3: Run evaluations
	if (format === "human") {
		console.log("▶️  Running evaluations...\n");
	}

	try {
		const result = await runEvaluations(
			{ writeResults: true, format },
			projectRoot,
		);

		if (format === "json") {
			printJsonResults(result);
		} else {
			printHumanResults(result);
		}

		// Step 4: If watch mode requested, transition to watch
		if (options.watch) {
			const { runWatch } = await import("./watch");
			await runWatch({ writeResults: true, format }, projectRoot);
			return 0; // Never reached (watch runs forever)
		}

		return result.summary.failed > 0 ? 1 : 0;
	} catch (error) {
		if (format === "human") {
			console.error(
				`\n❌ ${error instanceof Error ? error.message : String(error)}`,
			);
			console.log("\n💡 Tips:");
			console.log(
				"   • Create spec files with defineEval() in eval/ directory",
			);
			console.log("   • Run `evalgate discover` to verify spec detection");
			console.log("   • Run `evalgate doctor` for full diagnostics");
		} else {
			console.error(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
			);
		}
		return 1;
	}
}
