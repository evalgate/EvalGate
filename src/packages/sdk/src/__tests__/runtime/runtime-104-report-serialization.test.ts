/**
 * RUNTIME-104: Deterministic report serialization tests
 *
 * Tests for stable, deterministic RunReport generation and serialization.
 */

import * as crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createResult } from "../../runtime/eval";
import { createLocalExecutor } from "../../runtime/executor";
import {
	createEvalRuntime,
	disposeActiveRuntime,
} from "../../runtime/registry";
import {
	createRunReport,
	parseRunReport,
	RUN_REPORT_SCHEMA_VERSION,
	type RunReport,
} from "../../runtime/run-report";

describe("RUNTIME-104: Deterministic Report Serialization", () => {
	beforeEach(() => {
		disposeActiveRuntime();
	});

	afterEach(() => {
		disposeActiveRuntime();
	});

	describe("RunReport structure", () => {
		it("should create report with correct schema version", () => {
			const runId = crypto.randomUUID();
			const runtimeInfo = {
				id: "runtime-123",
				namespace: "abc123",
				projectRoot: "/test/project",
			};

			const builder = createRunReport(runId, runtimeInfo);
			const report = builder.build();

			expect(report.schemaVersion).toBe(RUN_REPORT_SCHEMA_VERSION);
			expect(report.runId).toBe(runId);
			expect(report.runtime).toEqual(runtimeInfo);
			expect(report.startedAt).toBeDefined();
			expect(report.finishedAt).toBeDefined();
			expect(report.results).toEqual([]);
			expect(report.failures).toEqual([]);
		});

		it("should mirror CheckReport conventions", () => {
			const runId = crypto.randomUUID();
			const builder = createRunReport(runId, {
				id: "test-runtime",
				namespace: "test-ns",
				projectRoot: "/test",
			});

			// Add a result
			builder.addResult(
				"test-123",
				"test-name",
				"test/file.ts",
				{ line: 10, column: 5 },
				"test input",
				{
					pass: true,
					score: 95,
					durationMs: 100,
					classification: "passed",
					metadata: { key: "value" },
				},
			);

			const report = builder.build();

			// Should have CheckReport-like structure
			expect(report).toHaveProperty("schemaVersion");
			expect(report).toHaveProperty("runId");
			expect(report).toHaveProperty("startedAt");
			expect(report).toHaveProperty("finishedAt");
			expect(report).toHaveProperty("results");
			expect(report).toHaveProperty("failures");
			expect(report).toHaveProperty("summary");
			expect(report).toHaveProperty("config");

			// Summary should be complete
			expect(report.summary).toEqual({
				total: 1,
				passed: 1,
				failed: 0,
				errors: 0,
				timeouts: 0,
				passRate: 100,
				averageScore: 95,
				totalDurationMs: 100,
				success: true,
			});
		});
	});

	describe("Deterministic ordering", () => {
		it("should sort results by testId for stable ordering", () => {
			const runId = crypto.randomUUID();
			const builder = createRunReport(runId, {
				id: "test-runtime",
				namespace: "test-ns",
				projectRoot: "/test",
			});

			// Add results in random order
			const _testIds = ["z-test", "a-test", "m-test"];
			const results = [
				{ testId: "z-test", score: 80 },
				{ testId: "a-test", score: 95 },
				{ testId: "m-test", score: 85 },
			];

			// Add in random order
			results.forEach((result) => {
				builder.addResult(
					result.testId,
					`name-${result.testId}`,
					"test.ts",
					{ line: 10, column: 5 },
					"input",
					{
						pass: result.score > 60,
						score: result.score,
						durationMs: 100,
						classification: result.score > 60 ? "passed" : "failed",
					},
				);
			});

			const report = builder.build();

			// Should be sorted by testId
			expect(report.results.map((r) => r.testId)).toEqual([
				"a-test",
				"m-test",
				"z-test",
			]);
		});

		it("should sort failures by testId for stable ordering", () => {
			const runId = crypto.randomUUID();
			const builder = createRunReport(runId, {
				id: "test-runtime",
				namespace: "test-ns",
				projectRoot: "/test",
			});

			// Add failures in random order
			const testIds = ["z-fail", "a-fail", "m-fail"];

			testIds.forEach((testId) => {
				builder.addResult(
					testId,
					`fail-${testId}`,
					"test.ts",
					{ line: 1, column: 1 },
					"input",
					{
						pass: false,
						score: 0,
						durationMs: 50,
						classification: "failed",
						error: "Test failed",
					},
				);
			});

			const report = builder.build();

			// Failures should be sorted by testId
			expect(report.failures.map((f) => f.testId)).toEqual([
				"a-fail",
				"m-fail",
				"z-fail",
			]);
		});
	});

	describe("Byte-identical serialization", () => {
		it("should produce byte-identical JSON for same inputs", () => {
			const runId = crypto.randomUUID();
			const runtimeInfo = {
				id: "test-runtime",
				namespace: "test-ns",
				projectRoot: "/test",
			};

			// Create two identical builders
			const builder1 = createRunReport(runId, runtimeInfo);
			const builder2 = createRunReport(runId, runtimeInfo);

			// Add identical results
			const results = [
				{ testId: "test-1", pass: true, score: 95 },
				{ testId: "test-2", pass: false, score: 45 },
				{ testId: "test-3", pass: true, score: 85 },
			];

			results.forEach((result) => {
				[builder1, builder2].forEach((builder) => {
					builder.addResult(
						result.testId,
						`name-${result.testId}`,
						"test.ts",
						{ line: 10, column: 5 },
						"input",
						{
							pass: result.pass,
							score: result.score,
							durationMs: 100,
						},
					);
				});
			});

			// Set identical config
			[builder1, builder2].forEach((builder) => {
				builder.setConfig({
					executorType: "local",
					maxParallel: 4,
				});
			});

			// Serialize both
			const json1 = builder1.toJSON();
			const json2 = builder2.toJSON();

			// Should be byte-identical except for timestamps
			const report1 = JSON.parse(json1) as RunReport;
			const report2 = JSON.parse(json2) as RunReport;

			// Remove timestamps for comparison
			delete report1.startedAt;
			delete report1.finishedAt;
			delete report2.startedAt;
			delete report2.finishedAt;

			expect(JSON.stringify(report1)).toBe(JSON.stringify(report2));
		});

		it("should handle different runIds correctly", () => {
			const runtimeInfo = {
				id: "test-runtime",
				namespace: "test-ns",
				projectRoot: "/test",
			};

			const builder1 = createRunReport("run-1", runtimeInfo);
			const builder2 = createRunReport("run-2", runtimeInfo);

			// Add identical results
			builder1.addResult(
				"test-1",
				"test-name",
				"test.ts",
				{ line: 1, column: 1 },
				"input",
				{
					pass: true,
					score: 100,
					durationMs: 50,
				},
			);

			builder2.addResult(
				"test-1",
				"test-name",
				"test.ts",
				{ line: 1, column: 1 },
				"input",
				{
					pass: true,
					score: 100,
					durationMs: 50,
				},
			);

			const report1 = builder1.build();
			const report2 = builder2.build();

			// Should have different runIds but same content otherwise
			expect(report1.runId).toBe("run-1");
			expect(report2.runId).toBe("run-2");

			// Remove runId and timestamps for comparison
			const { runId: _, startedAt: __, finishedAt: ___, ...content1 } = report1;
			const {
				runId: ____,
				startedAt: _____,
				finishedAt: ______,
				...content2
			} = report2;

			expect(JSON.stringify(content1)).toBe(JSON.stringify(content2));
		});
	});

	describe("Parse and validate", () => {
		it("should parse valid RunReport JSON", () => {
			const runId = crypto.randomUUID();
			const builder = createRunReport(runId, {
				id: "test-runtime",
				namespace: "test-ns",
				projectRoot: "/test",
			});

			builder.addResult(
				"test-1",
				"test-name",
				"test.ts",
				{ line: 1, column: 1 },
				"input",
				{
					pass: true,
					score: 100,
					durationMs: 50,
				},
			);

			const json = builder.toJSON();
			const parsed = parseRunReport(json);

			expect(parsed.schemaVersion).toBe(RUN_REPORT_SCHEMA_VERSION);
			expect(parsed.runId).toBe(runId);
			expect(parsed.results).toHaveLength(1);
			expect(parsed.results[0].testId).toBe("test-1");
		});

		it("should reject unsupported schema versions", () => {
			const invalidReport = {
				schemaVersion: "999",
				runId: "test",
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
				runtime: { id: "test", namespace: "test", projectRoot: "/test" },
				results: [],
				failures: [],
				summary: {
					total: 0,
					passed: 0,
					failed: 0,
					errors: 0,
					timeouts: 0,
					passRate: 0,
					averageScore: 0,
					totalDurationMs: 0,
					success: true,
				},
				config: {
					executorType: "local",
					defaultTimeout: 30000,
					environment: {
						nodeVersion: process.version,
						platform: process.platform,
						arch: process.arch,
					},
				},
			};

			expect(() => {
				parseRunReport(JSON.stringify(invalidReport));
			}).toThrow("Unsupported RunReport schema version: 999");
		});
	});

	describe("Complete execution flow", () => {
		it("should generate complete report from actual execution", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			// Define test specs with different outcomes
			handle.defineEval("pass-test", async (_context) => {
				return createResult({ pass: true, score: 95 });
			});

			handle.defineEval("fail-test", async (_context) => {
				return createResult({ pass: false, score: 45 });
			});

			handle.defineEval("error-test", async (_context) => {
				throw new Error("Execution error");
			});

			const specs = handle.runtime.list();
			const runId = crypto.randomUUID();

			// Create report builder
			const builder = createRunReport(runId, {
				id: handle.runtime.id,
				namespace: handle.runtime.namespace,
				projectRoot: process.cwd(),
			});

			// Execute all specs and add to report
			for (const spec of specs) {
				const result = await executor.executeSpec(spec, "test input");
				builder.addResult(
					spec.id,
					spec.name,
					spec.filePath,
					spec.position,
					"test input",
					result,
				);
			}

			// Set configuration
			builder.setConfig({
				executorType: "local",
				maxParallel: 4,
			});

			const report = builder.build();

			// Verify complete report
			expect(report.results).toHaveLength(3);
			expect(report.failures).toHaveLength(2); // fail + error
			expect(report.summary.total).toBe(3);
			expect(report.summary.passed).toBe(1);
			expect(report.summary.failed).toBe(1);
			expect(report.summary.errors).toBe(1);
			expect(report.summary.passRate).toBeCloseTo(33.33, 1);
			expect(report.summary.success).toBe(false);

			// Verify failure details
			const failures = report.failures;
			const errorFailure = failures.find((f) => f.classification === "error");
			const failFailure = failures.find((f) => f.classification === "failed");

			expect(errorFailure).toBeDefined();
			expect(errorFailure?.message).toBe("Execution error");
			expect(errorFailure?.errorEnvelope).toBeDefined();

			expect(failFailure).toBeDefined();
			expect(failFailure?.message).toBe("Test failed");
			expect(failFailure?.errorEnvelope).toBeUndefined();
		});
	});

	describe("Explain compatibility", () => {
		it("should produce report structure compatible with explain processing", () => {
			const runId = crypto.randomUUID();
			const builder = createRunReport(runId, {
				id: "test-runtime",
				namespace: "test-ns",
				projectRoot: "/test",
			});

			// Add comprehensive test data
			builder.addResult(
				"comprehensive-test",
				"Comprehensive Test",
				"src/test/comprehensive.ts",
				{ line: 42, column: 8 },
				"complex test input with special chars: !@#$%^&*()",
				{
					pass: true,
					score: 87.5,
					durationMs: 1234,
					metadata: {
						model: "gpt-4",
						temperature: 0.7,
						complexData: {
							nested: {
								array: [1, 2, 3],
								boolean: true,
							},
						},
					},
					assertions: [
						{
							name: "contains-response",
							passed: true,
							message: "Response contains expected content",
						},
						{
							name: "length-check",
							passed: true,
							message: "Response length is appropriate",
						},
					],
				},
			);

			const report = builder.build();

			// Should have all fields needed for explain processing
			expect(report.results[0]).toMatchObject({
				testId: "comprehensive-test",
				testName: "Comprehensive Test",
				filePath: "src/test/comprehensive.ts",
				position: { line: 42, column: 8 },
				input: "complex test input with special chars: !@#$%^&*()",
				pass: true,
				score: 87.5,
				durationMs: 1234,
				metadata: {
					model: "gpt-4",
					temperature: 0.7,
				},
				assertions: [
					{ name: "contains-response", passed: true },
					{ name: "length-check", passed: true },
				],
			});

			// Should be serializable and parseable
			const json = report.toJSON();
			const parsed = parseRunReport(json);

			expect(parsed.results[0].testId).toBe("comprehensive-test");
			expect(parsed.results[0].metadata).toEqual(report.results[0].metadata);
		});
	});
});
