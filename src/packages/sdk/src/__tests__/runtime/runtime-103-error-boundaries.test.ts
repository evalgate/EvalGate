/**
 * RUNTIME-103: Safe error boundaries + normalized error envelope tests
 *
 * Tests for proper error handling and classification in specification execution.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createResult } from "../../runtime/eval";
import { createLocalExecutor } from "../../runtime/executor";
import {
	createEvalRuntime,
	disposeActiveRuntime,
} from "../../runtime/registry";
import type { EnhancedEvalResult } from "../../runtime/types";

describe("RUNTIME-103: Safe Error Boundaries", () => {
	beforeEach(() => {
		disposeActiveRuntime();
	});

	afterEach(() => {
		disposeActiveRuntime();
	});

	describe("Error envelope generation", () => {
		it("should create normalized error envelope for execution errors", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			// Define a spec that throws an error
			handle.defineEval("error-test", async (_context) => {
				throw new Error("Test execution error");
			});

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.pass).toBe(false);
			expect(result.score).toBe(0);
			expect(result.classification).toBe("error");
			expect(result.error).toBe("Test execution error");
			expect(result.durationMs).toBeGreaterThan(0);

			// Should have error envelope
			expect(result.errorEnvelope).toBeDefined();
			const envelope = result.errorEnvelope!;

			expect(envelope.classification).toBe("execution_error");
			expect(envelope.code).toBe("EXECUTION_ERROR");
			expect(envelope.message).toBe("Test execution error");
			expect(envelope.testId).toBe(spec.id);
			expect(envelope.filePath).toBe(spec.filePath);
			expect(envelope.position).toEqual(spec.position);
			expect(envelope.timestamp).toMatch(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
			);
		});

		it("should create timeout error envelope for timeouts", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			// Define a spec that times out
			handle.defineEval(
				"timeout-test",
				async (_context) => {
					// Simulate long-running operation
					await new Promise((resolve) => setTimeout(resolve, 2000));
					return createResult({ pass: true, score: 100 });
				},
				{
					timeout: 100, // 100ms timeout
				},
			);

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.pass).toBe(false);
			expect(result.score).toBe(0);
			expect(result.classification).toBe("timeout");
			expect(result.error).toContain("timed out");
			expect(result.durationMs).toBeGreaterThan(90); // Should be close to timeout

			// Should have timeout error envelope
			expect(result.errorEnvelope).toBeDefined();
			const envelope = result.errorEnvelope!;

			expect(envelope.classification).toBe("timeout_error");
			expect(envelope.code).toBe("TIMEOUT");
			expect(envelope.message).toContain("timed out");
			expect(envelope.testId).toBe(spec.id);
			expect(envelope.filePath).toBe(spec.filePath);
			expect(envelope.position).toEqual(spec.position);
		});

		it("should handle non-Error objects gracefully", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			// Define a spec that throws a string
			handle.defineEval("string-error-test", async (_context) => {
				throw "String error message";
			});

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.pass).toBe(false);
			expect(result.score).toBe(0);
			expect(result.classification).toBe("error");
			expect(result.error).toBe("String error message");

			// Should still have error envelope
			expect(result.errorEnvelope).toBeDefined();
			const envelope = result.errorEnvelope!;

			expect(envelope.classification).toBe("execution_error");
			expect(envelope.code).toBe("EXECUTION_ERROR");
			expect(envelope.message).toBe("String error message");
		});
	});

	describe("Error classification", () => {
		it("should classify passed results correctly", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			handle.defineEval("passed-test", async (_context) => {
				return createResult({ pass: true, score: 95 });
			});

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.classification).toBe("passed");
			expect(result.pass).toBe(true);
			expect(result.score).toBe(95);
			expect(result.errorEnvelope).toBeUndefined();
		});

		it("should classify failed results correctly", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			handle.defineEval("failed-test", async (_context) => {
				return createResult({ pass: false, score: 45 });
			});

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.classification).toBe("failed");
			expect(result.pass).toBe(false);
			expect(result.score).toBe(45);
			expect(result.errorEnvelope).toBeUndefined();
		});

		it("should classify timeout results correctly", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			handle.defineEval(
				"timeout-classify-test",
				async (_context) => {
					await new Promise((resolve) => setTimeout(resolve, 500));
					return createResult({ pass: true, score: 100 });
				},
				{
					timeout: 50,
				},
			);

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.classification).toBe("timeout");
			expect(result.pass).toBe(false);
			expect(result.score).toBe(0);
			expect(result.errorEnvelope?.classification).toBe("timeout_error");
		});

		it("should classify error results correctly", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			handle.defineEval("error-classify-test", async (_context) => {
				throw new Error("Classification test error");
			});

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.classification).toBe("error");
			expect(result.pass).toBe(false);
			expect(result.score).toBe(0);
			expect(result.errorEnvelope?.classification).toBe("execution_error");
		});
	});

	describe("Error boundary safety", () => {
		it("should not crash runner when one test throws", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			// Define multiple specs, some that throw
			handle.defineEval("good-spec-1", async (_context) => {
				return createResult({ pass: true, score: 100 });
			});

			handle.defineEval("bad-spec", async (_context) => {
				throw new Error("This should not crash the runner");
			});

			handle.defineEval("good-spec-2", async (_context) => {
				return createResult({ pass: true, score: 90 });
			});

			const specs = handle.runtime.list();

			// Execute all specs sequentially
			const results: EnhancedEvalResult[] = [];
			for (const spec of specs) {
				const result = await executor.executeSpec(spec, "test input");
				results.push(result as EnhancedEvalResult);
			}

			// All should complete without crashing
			expect(results).toHaveLength(3);

			// Check classifications
			expect(results[0].classification).toBe("passed");
			expect(results[1].classification).toBe("error");
			expect(results[2].classification).toBe("passed");

			// Only the bad spec should have error envelope
			expect(results[0].errorEnvelope).toBeUndefined();
			expect(results[1].errorEnvelope).toBeDefined();
			expect(results[2].errorEnvelope).toBeUndefined();
		});

		it("should preserve original error information", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			const originalError = new Error("Original error details");
			originalError.stack = "Original stack trace";

			handle.defineEval("preserve-error-test", async (_context) => {
				throw originalError;
			});

			const spec = handle.runtime.list()[0];
			const result = (await executor.executeSpec(
				spec,
				"test input",
			)) as EnhancedEvalResult;

			expect(result.error).toBe("Original error details");

			const envelope = result.errorEnvelope!;
			expect(envelope.message).toBe("Original error details");
			expect(envelope.stack).toBe("Original stack trace");
			expect(envelope.testId).toBe(spec.id);
			expect(envelope.filePath).toBe(spec.filePath);
			expect(envelope.position).toEqual(spec.position);
		});
	});

	describe("Runner exit behavior", () => {
		it("should produce report artifact even with errors", async () => {
			const handle = createEvalRuntime();
			const executor = createLocalExecutor();

			// Define specs with mixed outcomes
			handle.defineEval("mixed-pass", async (_context) => {
				return createResult({ pass: true, score: 100 });
			});

			handle.defineEval("mixed-fail", async (_context) => {
				return createResult({ pass: false, score: 30 });
			});

			handle.defineEval("mixed-error", async (_context) => {
				throw new Error("Mixed error");
			});

			const specs = handle.runtime.list();

			// Execute all specs
			const results: EnhancedEvalResult[] = [];
			for (const spec of specs) {
				const result = await executor.executeSpec(spec, "test input");
				results.push(result as EnhancedEvalResult);
			}

			// Should have complete report with all classifications
			const classifications = results.map((r) => r.classification);
			expect(classifications).toEqual(["passed", "failed", "error"]);

			// Should have error envelope for the error case
			const failures = results.filter((r) => r.classification === "error");
			expect(failures).toHaveLength(1);
			expect(failures[0].errorEnvelope).toBeDefined();
			expect(failures[0].errorEnvelope?.classification).toBe("execution_error");

			// Runner should not have crashed - we have results for all specs
			expect(results).toHaveLength(3);
		});
	});
});
