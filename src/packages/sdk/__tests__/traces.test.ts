/**
 * Tests for structured trace writer
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunResult } from "../src/cli/run";
import {
	buildRunTrace,
	calculatePercentiles,
	formatLatencyTable,
	writeTraces,
} from "../src/cli/traces";

describe("calculatePercentiles", () => {
	it("should handle empty array", () => {
		const result = calculatePercentiles([]);
		expect(result).toEqual({ min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 });
	});

	it("should handle single value", () => {
		const result = calculatePercentiles([100]);
		expect(result.min).toBe(100);
		expect(result.max).toBe(100);
		expect(result.mean).toBe(100);
		expect(result.p50).toBe(100);
	});

	it("should calculate correct percentiles for sorted data", () => {
		const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
		const result = calculatePercentiles(durations);

		expect(result.min).toBe(10);
		expect(result.max).toBe(100);
		expect(result.mean).toBe(55);
		expect(result.p50).toBe(60);
		expect(result.p95).toBe(100);
		expect(result.p99).toBe(100);
	});

	it("should sort unsorted input", () => {
		const durations = [100, 10, 50, 30, 70];
		const result = calculatePercentiles(durations);

		expect(result.min).toBe(10);
		expect(result.max).toBe(100);
	});

	it("should handle large datasets", () => {
		const durations = Array.from({ length: 100 }, (_, i) => i + 1);
		const result = calculatePercentiles(durations);

		expect(result.min).toBe(1);
		expect(result.max).toBe(100);
		expect(result.p50).toBe(51);
		expect(result.p95).toBe(96);
		expect(result.p99).toBe(100);
	});
});

describe("formatLatencyTable", () => {
	it("should format latency data as a table", () => {
		const output = formatLatencyTable({
			min: 10,
			max: 100,
			mean: 55,
			p50: 50,
			p95: 95,
			p99: 99,
		});

		expect(output).toContain("Latency Percentiles");
		expect(output).toContain("min:");
		expect(output).toContain("p50:");
		expect(output).toContain("p95:");
		expect(output).toContain("p99:");
		expect(output).toContain("max:");
		expect(output).toContain("mean:");
		expect(output).toContain("10ms");
		expect(output).toContain("100ms");
	});
});

describe("buildRunTrace", () => {
	const mockRunResult: RunResult = {
		schemaVersion: 1,
		runId: "run-test-123",
		metadata: {
			startedAt: 1000,
			completedAt: 2000,
			duration: 1000,
			totalSpecs: 3,
			executedSpecs: 3,
			mode: "spec",
		},
		results: [
			{
				specId: "spec1",
				name: "test-spec-1",
				filePath: "eval/test.spec.ts",
				result: { status: "passed", score: 0.95, duration: 100 },
			},
			{
				specId: "spec2",
				name: "test-spec-2",
				filePath: "eval/test.spec.ts",
				result: { status: "failed", duration: 200, error: "assertion failed" },
			},
			{
				specId: "spec3",
				name: "test-spec-3",
				filePath: "eval/other.spec.ts",
				result: { status: "passed", score: 0.8, duration: 150 },
			},
		],
		summary: {
			passed: 2,
			failed: 1,
			skipped: 0,
			passRate: 0.667,
		},
	};

	it("should build a complete run trace", () => {
		const trace = buildRunTrace(mockRunResult);

		expect(trace.schemaVersion).toBe(1);
		expect(trace.run.id).toBe("run-test-123");
		expect(trace.run.duration).toBe(1000);
		expect(trace.summary.total).toBe(3);
		expect(trace.summary.passed).toBe(2);
		expect(trace.summary.failed).toBe(1);
		expect(trace.specs).toHaveLength(3);
	});

	it("should calculate latency percentiles", () => {
		const trace = buildRunTrace(mockRunResult);

		expect(trace.latency.min).toBe(100);
		expect(trace.latency.max).toBe(200);
		expect(trace.latency.mean).toBeGreaterThan(0);
	});

	it("should include git info when provided", () => {
		const trace = buildRunTrace(mockRunResult, {
			sha: "abc123",
			branch: "main",
		});

		expect(trace.specs[0].git?.sha).toBe("abc123");
		expect(trace.specs[0].git?.branch).toBe("main");
	});

	it("should include environment info", () => {
		const trace = buildRunTrace(mockRunResult);

		expect(trace.specs[0].env.nodeVersion).toBe(process.version);
		expect(trace.specs[0].env.platform).toBe(process.platform);
		expect(typeof trace.specs[0].env.ci).toBe("boolean");
	});
});

describe("writeTraces", () => {
	const testDir = path.join(process.cwd(), ".test-traces");

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should write trace files to .evalgate/traces/", async () => {
		const mockRunResult: RunResult = {
			schemaVersion: 1,
			runId: "run-trace-test",
			metadata: {
				startedAt: 1000,
				completedAt: 2000,
				duration: 1000,
				totalSpecs: 1,
				executedSpecs: 1,
				mode: "spec",
			},
			results: [
				{
					specId: "spec1",
					name: "test",
					filePath: "eval/test.ts",
					result: { status: "passed", duration: 100 },
				},
			],
			summary: { passed: 1, failed: 0, skipped: 0, passRate: 1 },
		};

		const tracePath = await writeTraces(mockRunResult, testDir);

		expect(tracePath).toContain("run-trace-test.trace.json");

		const content = await fs.readFile(tracePath, "utf-8");
		const trace = JSON.parse(content);
		expect(trace.schemaVersion).toBe(1);
		expect(trace.run.id).toBe("run-trace-test");
		expect(trace.specs).toHaveLength(1);
	});

	it("should also write latest.trace.json", async () => {
		const mockRunResult: RunResult = {
			schemaVersion: 1,
			runId: "run-latest-test",
			metadata: {
				startedAt: 1000,
				completedAt: 2000,
				duration: 1000,
				totalSpecs: 1,
				executedSpecs: 1,
				mode: "spec",
			},
			results: [
				{
					specId: "spec1",
					name: "test",
					filePath: "eval/test.ts",
					result: { status: "passed", duration: 50 },
				},
			],
			summary: { passed: 1, failed: 0, skipped: 0, passRate: 1 },
		};

		await writeTraces(mockRunResult, testDir);

		const latestPath = path.join(
			testDir,
			".evalgate",
			"traces",
			"latest.trace.json",
		);
		const exists = await fs
			.access(latestPath)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);
	});
});
