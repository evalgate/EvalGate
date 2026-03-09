#!/usr/bin/env node

/**
 * evalgate replay-decision — Compare two runs and make keep/discard decisions
 *
 * Usage:
 *   evalgate replay-decision --previous run-123.json --current run-456.json
 *   evalgate replay-decision --baseline latest --current run-456.json
 *
 * Exit codes:
 *   0 — Decision: KEEP (pass rate improved within budget)
 *   1 — Decision: DISCARD (pass rate declined or budget exceeded)
 *   2 — Error (invalid inputs, missing files, etc.)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig } from "./config";
import {
	evaluateReplayOutcome,
	type RunResultWithCorrected,
} from "./replay-decision";

interface ReplayDecisionArgs {
	previous: string;
	current: string;
	format: "human" | "json";
}

function parseReplayDecisionArgs(
	argv: string[],
): ReplayDecisionArgs | { error: string; exitCode: number } {
	try {
		const { values } = parseArgs({
			args: argv,
			options: {
				previous: { type: "string" },
				current: { type: "string" },
				format: { type: "string", default: "human" },
			},
			strict: true,
		});

		const previous = values.previous as string;
		const current = values.current as string;
		const format = values.format as string;

		if (!previous) {
			return { error: "--previous is required", exitCode: 2 };
		}

		if (!current) {
			return { error: "--current is required", exitCode: 2 };
		}

		if (!["human", "json"].includes(format)) {
			return { error: "--format must be 'human' or 'json'", exitCode: 2 };
		}

		return { previous, current, format: format as "human" | "json" };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Invalid arguments",
			exitCode: 2,
		};
	}
}

async function loadRunResult(
	filePath: string,
): Promise<RunResultWithCorrected> {
	const resolved = path.isAbsolute(filePath)
		? filePath
		: path.resolve(filePath);

	try {
		const content = await fs.readFile(resolved, "utf-8");
		const parsed = JSON.parse(content);

		// Validate basic structure
		if (!parsed.schemaVersion || !parsed.results || !parsed.summary) {
			throw new Error("Invalid run result format");
		}

		return parsed as RunResultWithCorrected;
	} catch (error) {
		throw new Error(`Failed to load run result from ${filePath}: ${error}`);
	}
}

async function findLatestRun(projectRoot: string): Promise<string> {
	const runsDir = path.join(projectRoot, ".evalgate", "runs");

	try {
		const files = await fs.readdir(runsDir);
		const runFiles = files
			.filter((f) => f.startsWith("run-") && f.endsWith(".json"))
			.map((f) => path.join(runsDir, f));

		if (runFiles.length === 0) {
			throw new Error("No run files found");
		}

		// Get file stats to find the most recent
		const stats = await Promise.all(
			runFiles.map(async (file) => ({
				file,
				mtime: (await fs.stat(file)).mtime,
			})),
		);

		stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
		return stats[0].file;
	} catch (error) {
		throw new Error(`Failed to find latest run: ${error}`);
	}
}

function formatHumanOutput(
	decision: ReturnType<typeof evaluateReplayOutcome>,
): string {
	const { action, reason, budgetUsed, budgetLimit, comparisonBasis } = decision;

	const actionIcon = action === "keep" ? "✅" : "❌";
	const budgetBar = `${budgetUsed}/${budgetLimit}`;

	let output = `\n${actionIcon} Replay Decision: ${action.toUpperCase()}\n`;
	output += `📊 Reason: ${reason}\n`;
	output += `💰 Budget: ${budgetBar}\n`;
	output += `📈 Comparison: ${comparisonBasis} pass rate\n`;
	output += `📊 Previous: ${(decision.previousPassRate * 100).toFixed(1)}%`;

	if (decision.previousCorrectedPassRate !== null) {
		output += ` (corrected: ${(decision.previousCorrectedPassRate * 100).toFixed(1)}%)`;
	}

	output += `\n📊 Current: ${(decision.newPassRate * 100).toFixed(1)}%`;

	if (decision.newCorrectedPassRate !== null) {
		output += ` (corrected: ${(decision.newCorrectedPassRate * 100).toFixed(1)}%)`;
	}

	output += `\n`;

	return output;
}

export async function runReplayDecision(argv: string[]): Promise<number> {
	const args = parseReplayDecisionArgs(argv);

	if ("error" in args) {
		console.error(`Error: ${args.error}`);
		return args.exitCode;
	}

	const projectRoot = process.cwd();
	const config = loadConfig(projectRoot);

	try {
		// Load current run
		const currentRun = await loadRunResult(args.current);

		// Load previous run (handle "latest" special case)
		let previousPath = args.previous;
		if (args.previous === "latest") {
			previousPath = await findLatestRun(projectRoot);
		}
		const previousRun = await loadRunResult(previousPath);

		// Validate budget config exists
		if (!config?.normalizedBudget) {
			console.error(
				"Error: No normalized budget config found in evalgate.config.json",
			);
			return 2;
		}

		// Make replay decision
		const decision = evaluateReplayOutcome(
			previousRun,
			currentRun,
			config.normalizedBudget,
		);

		// Output results
		if (args.format === "json") {
			console.log(JSON.stringify(decision, null, 2));
		} else {
			console.log(formatHumanOutput(decision));
		}

		// Return appropriate exit code
		return decision.action === "keep" ? 0 : 1;
	} catch (error) {
		console.error(
			`Error: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 2;
	}
}

// Run if called directly
if (require.main === module) {
	runReplayDecision(process.argv.slice(2)).then((code) => process.exit(code));
}
