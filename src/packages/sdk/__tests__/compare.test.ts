/**
 * Tests for evalgate compare command
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCompare } from "../src/cli/compare";
import type { RunResult } from "../src/cli/run";

describe("Compare Command", () => {
	const testDir = path.join(process.cwd(), ".test-compare");

	const makeRunResult = (
		overrides: Partial<RunResult> & { runId: string },
	): RunResult => ({
		schemaVersion: 1,
		runId: overrides.runId,
		metadata: {
			startedAt: 1000,
			completedAt: 2000,
			duration: 1000,
			totalSpecs: 2,
			executedSpecs: 2,
			mode: "spec",
		},
		results: overrides.results ?? [
			{
				specId: "spec1",
				name: "test-1",
				filePath: "eval/test.ts",
				result: { status: "passed", score: 0.9, duration: 100 },
			},
			{
				specId: "spec2",
				name: "test-2",
				filePath: "eval/test.ts",
				result: { status: "passed", score: 0.8, duration: 200 },
			},
		],
		summary: overrides.summary ?? {
			passed: 2,
			failed: 0,
			skipped: 0,
			passRate: 1,
		},
	});

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should compare two runs", async () => {
		const runA = makeRunResult({ runId: "run-a" });
		const runB = makeRunResult({
			runId: "run-b",
			results: [
				{
					specId: "spec1",
					name: "test-1",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.95, duration: 80 },
				},
				{
					specId: "spec2",
					name: "test-2",
					filePath: "eval/test.ts",
					result: {
						status: "failed",
						duration: 300,
						error: "assertion failed",
					},
				},
			],
			summary: { passed: 1, failed: 1, skipped: 0, passRate: 0.5 },
		});

		const fileA = path.join(testDir, "run-a.json");
		const fileB = path.join(testDir, "run-b.json");
		await fs.writeFile(fileA, JSON.stringify(runA));
		await fs.writeFile(fileB, JSON.stringify(runB));

		const result = await runCompare(
			{ runs: [fileA, fileB], labels: ["Model A", "Model B"] },
			testDir,
		);

		expect(result.schemaVersion).toBe(1);
		expect(result.labels).toEqual(["Model A", "Model B"]);
		expect(result.specs).toHaveLength(2);
		expect(result.summary.aggregates).toHaveLength(2);
	});

	it("should determine winners by score", async () => {
		const runA = makeRunResult({
			runId: "run-a",
			results: [
				{
					specId: "spec1",
					name: "test-1",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.95, duration: 100 },
				},
			],
		});
		const runB = makeRunResult({
			runId: "run-b",
			results: [
				{
					specId: "spec1",
					name: "test-1",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.7, duration: 100 },
				},
			],
		});

		const fileA = path.join(testDir, "run-a.json");
		const fileB = path.join(testDir, "run-b.json");
		await fs.writeFile(fileA, JSON.stringify(runA));
		await fs.writeFile(fileB, JSON.stringify(runB));

		const result = await runCompare(
			{ runs: [fileA, fileB], labels: ["Better", "Worse"] },
			testDir,
		);

		expect(result.specs[0].winner).toBe("Better");
		expect(result.summary.wins.Better).toBe(1);
	});

	it("should handle ties", async () => {
		const runA = makeRunResult({
			runId: "run-a",
			results: [
				{
					specId: "spec1",
					name: "test-1",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.9, duration: 100 },
				},
			],
		});
		const runB = makeRunResult({
			runId: "run-b",
			results: [
				{
					specId: "spec1",
					name: "test-1",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.9, duration: 100 },
				},
			],
		});

		const fileA = path.join(testDir, "run-a.json");
		const fileB = path.join(testDir, "run-b.json");
		await fs.writeFile(fileA, JSON.stringify(runA));
		await fs.writeFile(fileB, JSON.stringify(runB));

		const result = await runCompare({ runs: [fileA, fileB] }, testDir);

		expect(result.specs[0].winner).toBeNull();
		expect(result.summary.ties).toBe(1);
	});

	it("should require at least 2 runs", async () => {
		await expect(runCompare({ runs: ["one.json"] }, testDir)).rejects.toThrow(
			"At least 2 run files",
		);
	});

	it("should handle specs present in only one run", async () => {
		const runA = makeRunResult({
			runId: "run-a",
			results: [
				{
					specId: "spec1",
					name: "test-1",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.9, duration: 100 },
				},
			],
		});
		const runB = makeRunResult({
			runId: "run-b",
			results: [
				{
					specId: "spec2",
					name: "test-2",
					filePath: "eval/test.ts",
					result: { status: "passed", score: 0.8, duration: 200 },
				},
			],
		});

		const fileA = path.join(testDir, "run-a.json");
		const fileB = path.join(testDir, "run-b.json");
		await fs.writeFile(fileA, JSON.stringify(runA));
		await fs.writeFile(fileB, JSON.stringify(runB));

		const result = await runCompare({ runs: [fileA, fileB] }, testDir);

		expect(result.specs).toHaveLength(2);
		// Each spec should have a missing entry for the other run
		const spec1 = result.specs.find((s) => s.specId === "spec1")!;
		expect(spec1.results[1].status).toBe("missing");
	});
});
