/**
 * Watch mode for evalgate run
 *
 * Re-executes evaluation specs when source files change.
 * Uses Node.js fs.watch with debouncing to avoid rapid re-runs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { RunOptions, RunResult } from "./run";
import { printHumanResults, printJsonResults, runEvaluations } from "./run";

export interface WatchOptions extends RunOptions {
	/** Debounce interval in milliseconds (default: 300) */
	debounceMs?: number;
	/** Additional directories to watch beyond spec files */
	extraWatchDirs?: string[];
	/** Clear terminal between runs */
	clearScreen?: boolean;
}

/**
 * Start watch mode — runs evaluations and re-runs on file changes
 */
export async function runWatch(
	options: WatchOptions,
	projectRoot: string = process.cwd(),
): Promise<void> {
	const debounceMs = options.debounceMs ?? 300;
	const clearScreen = options.clearScreen ?? true;

	// Directories to watch
	const watchDirs = new Set<string>();

	// Always watch the eval/ directory if it exists
	const evalDir = path.join(projectRoot, "eval");
	if (fs.existsSync(evalDir)) watchDirs.add(evalDir);

	// Watch evals/ directory too
	const evalsDir = path.join(projectRoot, "evals");
	if (fs.existsSync(evalsDir)) watchDirs.add(evalsDir);

	// Watch src/ for code changes that may affect evals
	const srcDir = path.join(projectRoot, "src");
	if (fs.existsSync(srcDir)) watchDirs.add(srcDir);

	// Add extra watch dirs
	if (options.extraWatchDirs) {
		for (const dir of options.extraWatchDirs) {
			const resolved = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
			if (fs.existsSync(resolved)) watchDirs.add(resolved);
		}
	}

	if (watchDirs.size === 0) {
		console.error(
			"❌ No directories to watch. Create eval/, evals/, or src/ directory.",
		);
		process.exit(1);
	}

	console.log("👁️  Watch mode enabled");
	console.log(
		`   Watching: ${[...watchDirs].map((d) => path.relative(projectRoot, d) || ".").join(", ")}`,
	);
	console.log(`   Debounce: ${debounceMs}ms`);
	console.log("   Press Ctrl+C to stop\n");

	// Initial run
	await executeRun(options, projectRoot, clearScreen, false);

	// Set up watchers with debouncing
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let isRunning = false;

	const triggerRun = () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			if (isRunning) return;
			isRunning = true;
			try {
				await executeRun(options, projectRoot, clearScreen, true);
			} finally {
				isRunning = false;
			}
		}, debounceMs);
	};

	const watchers: fs.FSWatcher[] = [];

	for (const dir of watchDirs) {
		try {
			const watcher = fs.watch(
				dir,
				{ recursive: true },
				(eventType, filename) => {
					if (!filename) return;
					// Skip hidden files and node_modules
					if (filename.startsWith(".") || filename.includes("node_modules"))
						return;
					// Only watch relevant file types
					const ext = path.extname(filename).toLowerCase();
					if (
						[".ts", ".tsx", ".js", ".jsx", ".json", ".jsonl", ".csv"].includes(
							ext,
						)
					) {
						console.log(`\n🔄 Change detected: ${filename} (${eventType})`);
						triggerRun();
					}
				},
			);
			watchers.push(watcher);
		} catch (err) {
			console.warn(
				`⚠️  Could not watch ${path.relative(projectRoot, dir)}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// Handle graceful shutdown
	const cleanup = () => {
		console.log("\n\n👋 Watch mode stopped.");
		for (const watcher of watchers) {
			watcher.close();
		}
		if (debounceTimer) clearTimeout(debounceTimer);
		process.exit(0);
	};

	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);

	// Keep process alive
	await new Promise(() => {
		// Never resolves — watch runs until interrupted
	});
}

/**
 * Execute a single run and print results (without process.exit)
 */
async function executeRun(
	options: WatchOptions,
	projectRoot: string,
	clearScreen: boolean,
	isRerun: boolean,
): Promise<RunResult | null> {
	if (clearScreen && isRerun) {
		// Clear screen using ANSI escape
		process.stdout.write("\x1B[2J\x1B[0f");
	}

	const timestamp = new Date().toLocaleTimeString();
	console.log(
		`${isRerun ? "🔄 Re-running" : "▶️  Running"} evaluations... (${timestamp})`,
	);

	try {
		const result = await runEvaluations(
			{
				specIds: options.specIds,
				impactedOnly: options.impactedOnly,
				baseBranch: options.baseBranch,
				format: options.format,
				writeResults: options.writeResults,
			},
			projectRoot,
		);

		if (options.format === "json") {
			printJsonResults(result);
		} else {
			printHumanResults(result);
		}

		// Print watch-specific summary
		const statusIcon = result.summary.failed > 0 ? "❌" : "✅";
		console.log(
			`\n${statusIcon} ${result.summary.passed}/${result.results.length} passed | Waiting for changes...`,
		);

		return result;
	} catch (error) {
		console.error(
			"❌ Run failed:",
			error instanceof Error ? error.message : String(error),
		);
		console.log("\n⏳ Waiting for changes...");
		return null;
	}
}
