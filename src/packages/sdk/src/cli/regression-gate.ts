/**
 * evalgate gate — Run the regression gate
 *
 * Two modes:
 *   1. Project mode: delegates to eval:regression-gate npm script (full gate)
 *   2. Built-in mode: runs `npm test`, compares against evals/baseline.json
 *
 * Built-in mode activates when no eval:regression-gate script is defined,
 * making `npx evalgate gate` work for any project after `npx evalgate init`.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const REPORT_REL = "evals/regression-report.json";
const BASELINE_REL = "evals/baseline.json";

/** Detect the package manager used in the project */
function detectPackageManager(cwd: string): string {
	if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
	if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
	return "npm";
}

export interface GateArgs {
	format: "human" | "json" | "github";
}

export function parseGateArgs(argv: string[]): GateArgs {
	const args: GateArgs = { format: "human" };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--format" && argv[i + 1]) {
			const fmt = argv[i + 1];
			if (fmt === "json" || fmt === "github" || fmt === "human") {
				args.format = fmt;
			}
			i++;
		}
	}
	return args;
}

// ── Built-in lightweight gate ──

interface BuiltinReport {
	schemaVersion: number;
	timestamp: string;
	exitCode: number;
	category: "pass" | "regression" | "infra_error";
	passed: boolean;
	failures: string[];
	deltas: Array<{
		metric: string;
		baseline: number | string | boolean;
		current: number | string | boolean;
		delta: string;
		status: "pass" | "fail";
	}>;
	baseline: { updatedAt: string; updatedBy: string } | null;
	durationMs: number;
	command: string;
	runner: string;
}

function detectRunner(cwd: string): string {
	const pkgPath = path.join(cwd, "package.json");
	try {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		const testCmd: string = pkg.scripts?.test ?? "";
		if (testCmd.includes("vitest")) return "vitest";
		if (testCmd.includes("jest")) return "jest";
		if (testCmd.includes("mocha")) return "mocha";
		if (testCmd.includes("node --test")) return "node:test";
		if (testCmd.includes("ava")) return "ava";
		if (testCmd.includes("tap")) return "tap";
	} catch {
		// ignore
	}
	return "unknown";
}

function runBuiltinGate(cwd: string): BuiltinReport {
	const t0 = Date.now();
	const baselinePath = path.join(cwd, BASELINE_REL);
	const now = new Date().toISOString();
	const pm = detectPackageManager(cwd);
	const command = `${pm} test`;
	const runner = detectRunner(cwd);

	// Load baseline
	if (!fs.existsSync(baselinePath)) {
		return {
			schemaVersion: 1,
			timestamp: now,
			exitCode: 2,
			category: "infra_error",
			passed: false,
			failures: ["Baseline file not found. Run: npx evalgate init"],
			deltas: [],
			baseline: null,
			durationMs: Date.now() - t0,
			command,
			runner,
		};
	}

	let baselineData: {
		confidenceTests?: { passed?: boolean; total?: number };
		updatedAt?: string;
		updatedBy?: string;
	};
	try {
		baselineData = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
	} catch {
		return {
			schemaVersion: 1,
			timestamp: now,
			exitCode: 2,
			category: "infra_error",
			passed: false,
			failures: ["Failed to parse evals/baseline.json"],
			deltas: [],
			baseline: null,
			durationMs: Date.now() - t0,
			command,
			runner,
		};
	}

	const baselineMeta = baselineData.updatedAt
		? {
				updatedAt: baselineData.updatedAt,
				updatedBy: baselineData.updatedBy ?? "unknown",
			}
		: null;

	// Run tests
	const isWin = process.platform === "win32";
	const result = spawnSync(pm, ["test"], {
		cwd,
		stdio: "pipe",
		shell: isWin,
		timeout: 300_000,
	});

	const testsPassed = result.status === 0;
	const output =
		(result.stdout?.toString() ?? "") + (result.stderr?.toString() ?? "");

	// Try to extract test count
	let testCount = 0;
	const countMatch =
		output.match(/(\d+)\s+(?:tests?|specs?)\s+(?:passed|completed)/i) ??
		output.match(/Tests:\s+(\d+)\s+passed/i) ??
		output.match(/(\d+)\s+passing/i) ??
		output.match(/Test Files\s+\d+\s+passed.*\n\s+Tests\s+(\d+)\s+passed/i);
	if (countMatch) testCount = parseInt(countMatch[1], 10);

	// Compare against baseline
	const baselinePassed = baselineData.confidenceTests?.passed ?? true;
	const baselineTotal = baselineData.confidenceTests?.total ?? 0;

	const failures: string[] = [];
	const deltas: BuiltinReport["deltas"] = [];

	// Delta: tests passing
	deltas.push({
		metric: "tests_passing",
		baseline: baselinePassed,
		current: testsPassed,
		delta: testsPassed === baselinePassed ? "0" : testsPassed ? "+1" : "-1",
		status: testsPassed ? "pass" : "fail",
	});

	if (!testsPassed && baselinePassed) {
		failures.push("Tests were passing in baseline but are now failing");
	}

	// Delta: test count (only if we captured counts)
	if (testCount > 0 || baselineTotal > 0) {
		const countDelta = testCount - baselineTotal;
		deltas.push({
			metric: "test_count",
			baseline: baselineTotal,
			current: testCount,
			delta: countDelta >= 0 ? `+${countDelta}` : `${countDelta}`,
			status: testCount >= baselineTotal ? "pass" : "fail",
		});

		if (testCount < baselineTotal) {
			failures.push(
				`Test count dropped from ${baselineTotal} to ${testCount} (${countDelta})`,
			);
		}
	}

	const hasRegression = failures.length > 0;

	return {
		schemaVersion: 1,
		timestamp: now,
		exitCode: hasRegression ? 1 : 0,
		category: hasRegression ? "regression" : "pass",
		passed: !hasRegression,
		failures,
		deltas,
		baseline: baselineMeta,
		durationMs: Date.now() - t0,
		command,
		runner,
	};
}

// ── Format helpers ──

function formatHuman(report: BuiltinReport): void {
	const icon = report.passed ? "✅" : "❌";
	console.log(`\n${icon} EvalGate Gate: ${report.category.toUpperCase()}\n`);

	if (report.deltas.length > 0) {
		const pad = (s: string, n: number) => s.padEnd(n);
		console.log(
			`  ${pad("Metric", 16)} ${pad("Baseline", 10)} ${pad("Current", 10)} ${pad("Delta", 8)} Status`,
		);
		console.log(
			`  ${"-".repeat(16)} ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(8)} ------`,
		);
		for (const d of report.deltas) {
			const si = d.status === "pass" ? "✔" : "✖";
			console.log(
				`  ${pad(d.metric, 16)} ${pad(String(d.baseline), 10)} ${pad(String(d.current), 10)} ${pad(d.delta, 8)} ${si}`,
			);
		}
	}

	if (report.failures.length > 0) {
		console.log("\n  Failures:");
		for (const f of report.failures) {
			console.log(`    • ${f}`);
		}
	}
	console.log("");
}

function formatGithub(report: BuiltinReport): void {
	const icon = report.passed ? "✅" : "❌";
	const lines = [
		`## ${icon} EvalGate Gate: ${report.category}`,
		"",
		"| Metric | Baseline | Current | Delta | Status |",
		"|--------|----------|---------|-------|--------|",
	];
	for (const d of report.deltas) {
		const si = d.status === "pass" ? "✅" : "❌";
		lines.push(
			`| ${d.metric} | ${d.baseline} | ${d.current} | ${d.delta} | ${si} |`,
		);
	}
	if (report.failures.length > 0) {
		lines.push("", "### Failures", "");
		for (const f of report.failures) {
			lines.push(`- ${f}`);
		}
	}
	lines.push("", `Schema version: ${report.schemaVersion}`);
	const md = lines.join("\n");

	// Write to $GITHUB_STEP_SUMMARY if available
	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (summaryPath) {
		try {
			fs.appendFileSync(summaryPath, `${md}\n`);
		} catch {
			// ignore if not writable
		}
	}
	console.log(md);
}

function formatReport(report: BuiltinReport, args: GateArgs): void {
	if (args.format === "json") {
		process.stdout.write(JSON.stringify(report, null, 2));
	} else if (args.format === "github") {
		formatGithub(report);
	} else {
		formatHuman(report);
	}
}

// ── Main ──

export function runGate(argv: string[]): number {
	const cwd = process.cwd();
	const args = parseGateArgs(argv);

	// Check for package.json
	const pkgPath = path.join(cwd, "package.json");
	if (!fs.existsSync(pkgPath)) {
		console.error("❌ No package.json found. Run this from your project root.");
		return 1;
	}

	let pkg: { scripts?: Record<string, string> };
	try {
		pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
	} catch {
		console.error("❌ Failed to parse package.json");
		return 1;
	}

	// ── Project mode: delegate to eval:regression-gate if it exists ──
	if (pkg.scripts?.["eval:regression-gate"]) {
		const pm = detectPackageManager(cwd);
		const isWin = process.platform === "win32";
		const stdio = args.format === "json" ? "pipe" : "inherit";

		const result = spawnSync(pm, ["run", "eval:regression-gate"], {
			cwd,
			stdio: stdio as "inherit" | "pipe",
			shell: isWin,
		});

		const exitCode = result.status ?? 1;

		// Post-process report for json/github formats
		if (args.format === "json") {
			const reportPath = path.join(cwd, REPORT_REL);
			if (fs.existsSync(reportPath)) {
				process.stdout.write(fs.readFileSync(reportPath, "utf-8"));
			} else {
				console.error(
					JSON.stringify({
						error: "regression-report.json not found",
						exitCode,
					}),
				);
			}
		} else if (args.format === "github") {
			const reportPath = path.join(cwd, REPORT_REL);
			if (fs.existsSync(reportPath)) {
				try {
					const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
					formatGithub(report);
				} catch {
					// human output already printed
				}
			}
		}

		return exitCode;
	}

	// ── Built-in mode: run tests + compare against baseline ──
	if (args.format === "human") {
		console.log("\n  Running EvalGate regression gate (built-in mode)...\n");
	}

	const report = runBuiltinGate(cwd);

	// Write report artifact
	const evalsDir = path.join(cwd, "evals");
	if (!fs.existsSync(evalsDir)) {
		fs.mkdirSync(evalsDir, { recursive: true });
	}
	fs.writeFileSync(
		path.join(cwd, REPORT_REL),
		`${JSON.stringify(report, null, 2)}\n`,
	);

	formatReport(report, args);
	return report.exitCode;
}
