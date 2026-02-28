/**
 * LAYER 1 Runtime Foundation Tests
 *
 * Tests for the new evaluation specification programming model.
 * Verifies the core DSL works without breaking existing functionality.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createEvalContext,
	createEvalRuntime,
	createLocalExecutor,
	createResult,
	defineEval,
	disposeActiveRuntime,
	getActiveRuntime,
} from "../../runtime/eval";

describe("LAYER 1: Runtime Foundation", () => {
	beforeEach(() => {
		// Ensure clean runtime for each test
		disposeActiveRuntime();
	});

	afterEach(() => {
		// Cleanup after each test
		disposeActiveRuntime();
	});

	describe("defineEval DSL", () => {
		it("should register a basic specification", () => {
			// Define a simple specification
			defineEval("basic test", async (_context) => {
				return createResult({
					pass: true,
					score: 100,
				});
			});

			const runtime = getActiveRuntime();
			const specs = runtime.list();

			expect(specs).toHaveLength(1);
			expect(specs[0].name).toBe("basic test");
			expect(specs[0].id).toHaveLength(20); // Content-addressable ID
		});

		it("should support typed input", () => {
			defineEval("typed test", async (context) => {
				expect(context.input).toBe("test input");
				return createResult({
					pass: true,
					score: 95,
				});
			});

			const runtime = getActiveRuntime();
			const spec = runtime.list()[0];

			expect(spec.name).toBe("typed test");
			expect(spec.tags).toBeUndefined(); // No tags by default
		});

		it("should support configuration options", () => {
			defineEval(
				"configured test",
				async (_context) => {
					return createResult({
						pass: true,
						score: 90,
					});
				},
				{
					description: "A test with configuration",
					tags: ["unit", "fast"],
					timeout: 5000,
					retries: 2,
				},
			);

			const runtime = getActiveRuntime();
			const spec = runtime.list()[0];

			expect(spec.description).toBe("A test with configuration");
			expect(spec.tags).toEqual(["unit", "fast"]);
			expect(spec.config?.timeout).toBe(5000);
			expect(spec.config?.retries).toBe(2);
		});

		it("should use content-addressable IDs", () => {
			defineEval("identity test", async (_context) => {
				return createResult({ pass: true, score: 100 });
			});

			const runtime = getActiveRuntime();
			const spec = runtime.list()[0];

			// ID should be deterministic based on content and position
			expect(spec.id).toMatch(/^[a-f0-9]{20}$/); // 20 char hex
			expect(spec.filePath).toContain("layer1-basic.test.ts");
			expect(spec.position.line).toBeGreaterThan(0);
			expect(spec.position.column).toBeGreaterThan(0);
		});
	});

	describe("Runtime Management", () => {
		it("should create scoped runtime", () => {
			const runtime = createEvalRuntime();

			expect(runtime.id).toBeDefined();
			expect(runtime.namespace).toHaveLength(12); // Namespace hash
			expect(runtime.createdAt).toBeInstanceOf(Date);
			expect(runtime.specs.size).toBe(0);
		});

		it("should prevent multiple active runtimes", () => {
			const _runtime1 = createEvalRuntime();

			expect(() => {
				const runtime2 = createEvalRuntime();
				setActiveRuntime(runtime2);
			}).toThrow("Active runtime already exists");
		});

		it("should provide health metrics", () => {
			defineEval("health test", async (_context) => {
				return createResult({ pass: true, score: 100 });
			});

			const runtime = getActiveRuntime();
			const health = runtime.getHealth();

			expect(health.status).toBe("healthy");
			expect(health.specCount).toBe(1);
			expect(health.memoryUsage).toBeGreaterThan(0);
			expect(health.issues).toHaveLength(0);
		});
	});

	describe("Local Executor", () => {
		it("should execute specifications locally", async () => {
			defineEval("executor test", async (context) => {
				expect(context.input).toBe("test input");
				return createResult({
					pass: true,
					score: 85,
					metadata: { executed: true },
				});
			});

			const runtime = getActiveRuntime();
			const spec = runtime.list()[0];
			const executor = createLocalExecutor();

			const result = await executor.executeSpec(spec, "test input");

			expect(result.pass).toBe(true);
			expect(result.score).toBe(85);
			expect(result.metadata).toEqual({ executed: true });
			expect(result.durationMs).toBeGreaterThan(0);
		});

		it("should handle execution timeouts", async () => {
			defineEval(
				"timeout test",
				async (_context) => {
					// Simulate long-running operation
					await new Promise((resolve) => setTimeout(resolve, 2000));
					return createResult({ pass: true, score: 100 });
				},
				{
					timeout: 100, // 100ms timeout
				},
			);

			const runtime = getActiveRuntime();
			const spec = runtime.list()[0];
			const executor = createLocalExecutor();

			const result = await executor.executeSpec(spec, "test input");

			expect(result.pass).toBe(false);
			expect(result.score).toBe(0);
			expect(result.error).toContain("timed out");
		});

		it("should handle executor errors gracefully", async () => {
			defineEval("error test", async (_context) => {
				throw new Error("Test execution failed");
			});

			const runtime = getActiveRuntime();
			const spec = runtime.list()[0];
			const executor = createLocalExecutor();

			const result = await executor.executeSpec(spec, "test input");

			expect(result.pass).toBe(false);
			expect(result.score).toBe(0);
			expect(result.error).toBe("Test execution failed");
		});
	});

	describe("Backward Compatibility", () => {
		it("should not interfere with existing TestSuite", () => {
			// This test ensures the new runtime doesn't break existing functionality
			const { createTestSuite } = require("../../testing");

			const suite = createTestSuite("compatibility test", {
				cases: [
					{
						input: "test",
						assertions: [(output) => expect(output).toBe("test")],
					},
				],
				executor: async (input) => input,
			});

			expect(suite.name).toBe("compatibility test");
			expect(suite.config.cases).toHaveLength(1);
		});
	});

	describe("Helper Functions", () => {
		it("should create evaluation contexts", () => {
			const context = createEvalContext(
				"test input",
				{ key: "value" },
				{ timeout: 5000 },
			);

			expect(context.input).toBe("test input");
			expect(context.metadata).toEqual({ key: "value" });
			expect(context.options?.timeout).toBe(5000);
		});

		it("should create evaluation results", () => {
			const result = createResult({
				pass: true,
				score: 95,
				metadata: { test: true },
			});

			expect(result.pass).toBe(true);
			expect(result.score).toBe(95);
			expect(result.metadata).toEqual({ test: true });
		});

		it("should clamp scores to 0-100 range", () => {
			const highScore = createResult({ pass: true, score: 150 });
			const lowScore = createResult({ pass: false, score: -10 });

			expect(highScore.score).toBe(100);
			expect(lowScore.score).toBe(0);
		});
	});
});
