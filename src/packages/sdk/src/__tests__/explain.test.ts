/**
 * evalai explain tests — offline report explainer.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runExplain } from "../cli/explain";
import type { CheckReport } from "../cli/formatters/types";

describe("evalai explain", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = path.join(
			process.env.TEMP || process.env.TMPDIR || "/tmp",
			`evalai-explain-test-${Date.now()}`,
		);
		fs.mkdirSync(tmpDir, { recursive: true });
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		// Override cwd for tests
		vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns 1 when no report found", async () => {
		const code = await runExplain([]);
		expect(code).toBe(1);
	});

	it("returns 1 when explicit report path does not exist", async () => {
		const code = await runExplain(["--report", "/nonexistent/report.json"]);
		expect(code).toBe(1);
	});

	it("returns 1 when report is invalid JSON", async () => {
		const evalsDir = path.join(tmpDir, "evals");
		fs.mkdirSync(evalsDir, { recursive: true });
		fs.writeFileSync(path.join(evalsDir, "regression-report.json"), "not json");
		const code = await runExplain([]);
		expect(code).toBe(1);
	});

	it("explains a CheckReport (from evalai check)", async () => {
		const report: Partial<CheckReport> = {
			evaluationId: "42",
			verdict: "fail",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "SCORE_TOO_LOW",
			reasonMessage: "score 72 < minScore 90",
			score: 72,
			baselineScore: 90,
			delta: -18,
			failedCases: [
				{
					testCaseId: 1,
					status: "failed",
					name: "greeting test",
					input: "Hello",
					expectedOutput: "Hi there!",
					output: "Greetings, human.",
					inputSnippet: "Hello",
					expectedSnippet: "Hi there!",
					outputSnippet: "Greetings, human.",
				},
				{
					testCaseId: 2,
					status: "failed",
					name: "farewell test",
					input: "Goodbye",
					expectedOutput: "Bye!",
					output: "Farewell, human.",
					inputSnippet: "Goodbye",
					expectedSnippet: "Bye!",
					outputSnippet: "Farewell, human.",
				},
			],
		};

		const evalsDir = path.join(tmpDir, "evals");
		fs.mkdirSync(evalsDir, { recursive: true });
		fs.writeFileSync(
			path.join(evalsDir, "regression-report.json"),
			JSON.stringify(report, null, 2),
		);

		const code = await runExplain([]);
		expect(code).toBe(0);

		// Check human output was printed
		const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(
			(c: unknown[]) => c[0],
		);
		const allOutput = logCalls.join("\n");
		expect(allOutput).toContain("FAIL");
		expect(allOutput).toContain("greeting test");
	});

	it("explains a BuiltinReport (from evalai gate)", async () => {
		const report = {
			schemaVersion: 1,
			timestamp: new Date().toISOString(),
			exitCode: 1,
			category: "regression",
			passed: false,
			failures: [
				"Tests were passing in baseline but are now failing",
				"Test count dropped from 10 to 8 (-2)",
			],
			deltas: [
				{
					metric: "tests_passing",
					baseline: true,
					current: false,
					delta: "-1",
					status: "fail",
				},
				{
					metric: "test_count",
					baseline: 10,
					current: 8,
					delta: "-2",
					status: "fail",
				},
			],
			baseline: { updatedAt: new Date().toISOString(), updatedBy: "ci" },
			durationMs: 1234,
			command: "pnpm test",
			runner: "vitest",
		};

		const evalsDir = path.join(tmpDir, "evals");
		fs.mkdirSync(evalsDir, { recursive: true });
		fs.writeFileSync(
			path.join(evalsDir, "regression-report.json"),
			JSON.stringify(report, null, 2),
		);

		const code = await runExplain([]);
		expect(code).toBe(0);
	});

	it("outputs JSON with --format json", async () => {
		const report: Partial<CheckReport> = {
			evaluationId: "42",
			verdict: "fail",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "DELTA_TOO_HIGH",
			reasonMessage: "score dropped 15 pts",
			score: 75,
			baselineScore: 90,
			delta: -15,
			failedCases: [],
		};

		const evalsDir = path.join(tmpDir, "evals");
		fs.mkdirSync(evalsDir, { recursive: true });
		fs.writeFileSync(
			path.join(evalsDir, "regression-report.json"),
			JSON.stringify(report, null, 2),
		);

		const logSpy = vi.spyOn(console, "log");
		const code = await runExplain(["--format", "json"]);
		expect(code).toBe(0);

		// Find JSON output
		const jsonCall = logSpy.mock.calls.find((call) => {
			try {
				const parsed = JSON.parse(call[0] as string);
				return parsed.rootCauses && parsed.suggestedFixes;
			} catch {
				return false;
			}
		});
		expect(jsonCall).toBeDefined();
		const output = JSON.parse(jsonCall?.[0] as string);
		expect(output.verdict).toBe("fail");
		expect(output.rootCauses).toBeInstanceOf(Array);
		expect(output.rootCauses.length).toBeGreaterThan(0);
		expect(output.suggestedFixes).toBeInstanceOf(Array);
		expect(output.suggestedFixes.length).toBeGreaterThan(0);
		expect(output.changes).toBeInstanceOf(Array);
	});

	it("reads from explicit --report path", async () => {
		const report: Partial<CheckReport> = {
			evaluationId: "99",
			verdict: "pass",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "PASS",
			score: 95,
			failedCases: [],
		};

		const customPath = path.join(tmpDir, "custom-report.json");
		fs.writeFileSync(customPath, JSON.stringify(report, null, 2));

		const code = await runExplain(["--report", customPath]);
		expect(code).toBe(0);
	});

	it("reads from .evalai/last-report.json", async () => {
		const report: Partial<CheckReport> = {
			evaluationId: "77",
			verdict: "warn",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "WARN_REGRESSION",
			score: 88,
			failedCases: [],
		};

		const dotDir = path.join(tmpDir, ".evalai");
		fs.mkdirSync(dotDir, { recursive: true });
		fs.writeFileSync(
			path.join(dotDir, "last-report.json"),
			JSON.stringify(report, null, 2),
		);

		const code = await runExplain([]);
		expect(code).toBe(0);
	});

	it("classifies safety regression root cause", async () => {
		const report: Partial<CheckReport> = {
			evaluationId: "42",
			verdict: "fail",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "POLICY_FAILED",
			reasonMessage: "safety 80% < required 95%",
			score: 80,
			failedCases: [],
			breakdown01: { safety: 0.8 },
		};

		const evalsDir = path.join(tmpDir, "evals");
		fs.mkdirSync(evalsDir, { recursive: true });
		fs.writeFileSync(
			path.join(evalsDir, "regression-report.json"),
			JSON.stringify(report, null, 2),
		);

		const logSpy = vi.spyOn(console, "log");
		await runExplain(["--format", "json"]);

		const jsonCall = logSpy.mock.calls.find((call) => {
			try {
				return JSON.parse(call[0] as string).rootCauses;
			} catch {
				return false;
			}
		});
		const output = JSON.parse(jsonCall?.[0] as string);
		expect(output.rootCauses).toContain("safety_regression");
	});
});
