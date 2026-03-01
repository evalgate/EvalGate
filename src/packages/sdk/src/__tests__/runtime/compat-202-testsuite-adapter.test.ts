/**
 * COMPAT-202: Legacy TestSuite → defineEval adapter tests
 *
 * Tests for converting legacy TestSuite instances to defineEval specifications.
 */

import { describe, expect, it } from "vitest";
import {
	adaptTestSuite,
	generateDefineEvalCode,
} from "../../runtime/adapters/testsuite-to-dsl";
import {
	createEvalRuntime,
	disposeActiveRuntime,
} from "../../runtime/registry";
import { createTestSuite } from "../../testing";

describe("COMPAT-202: Legacy TestSuite → defineEval Adapter", () => {
	describe("adaptTestSuite function", () => {
		it("should convert simple TestSuite to EvalSpecs", () => {
			const suite = createTestSuite("simple-suite", {
				cases: [
					{
						id: "test-1",
						input: "Hello world",
						expected: "Hello",
					},
					{
						input: "Goodbye world",
						expected: "Goodbye",
					},
				],
				executor: async (input: string) => input.split(" ")[0],
			});

			const specs = adaptTestSuite(suite);

			expect(specs).toHaveLength(2);

			// Check first spec
			expect(specs[0].name).toBe("test-1");
			expect(specs[0].description).toBe("Legacy test: test-1");
			expect(specs[0].tags).toEqual(["legacy", "migrated"]);
			expect(specs[0].metadata?.source).toBe("legacy");
			expect(specs[0].metadata?.legacySuiteName).toBe("simple-suite");
			expect(specs[0].metadata?.legacyTestId).toBe("test-1");
			expect(specs[0].metadata?.originalInput).toBe("Hello world");
			expect(specs[0].metadata?.originalExpected).toBe("Hello");
		});

		it("should handle TestSuite with metadata", () => {
			const suite = createTestSuite("metadata-suite", {
				cases: [
					{
						id: "metadata-test",
						input: "test input",
						expected: "test output",
						metadata: {
							category: "unit",
							priority: "high",
							tags: ["important", "critical"],
						},
					},
				],
				timeout: 5000,
				retries: 2,
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite);

			expect(specs).toHaveLength(1);
			expect(specs[0].metadata?.category).toBe("unit");
			expect(specs[0].metadata?.priority).toBe("high");
			expect(specs[0].metadata?.tags).toEqual(["important", "critical"]);
			expect(specs[0].config?.timeout).toBe(5000);
			expect(specs[0].config?.retries).toBe(2);
		});

		it("should handle TestSuite without executor", () => {
			const suite = createTestSuite("no-executor-suite", {
				cases: [
					{
						id: "no-executor-test",
						input: "test",
						expected: "test",
					},
				],
			});

			const specs = adaptTestSuite(suite);

			expect(specs).toHaveLength(1);
			expect(specs[0].name).toBe("no-executor-test");
			// The executor should handle the no-executor case
		});

		it("should preserve IDs when requested", () => {
			const suite = createTestSuite("preserve-ids-suite", {
				cases: [
					{
						id: "custom-test-id",
						input: "test",
						expected: "test",
					},
				],
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite, { preserveIds: true });

			expect(specs[0].id).toContain("custom-test-id");
		});

		it("should generate deterministic IDs", () => {
			const suite = createTestSuite("deterministic-suite", {
				cases: [
					{
						input: "test input",
						expected: "test output",
					},
				],
				executor: async (input: string) => input,
			});

			const specs1 = adaptTestSuite(suite);
			const specs2 = adaptTestSuite(suite);

			expect(specs1[0].id).toBe(specs2[0].id);
			expect(specs1[0].id).toMatch(/^[a-z0-9]{20}$/);
		});

		it("should include provenance metadata when requested", () => {
			const suite = createTestSuite("provenance-suite", {
				cases: [
					{
						id: "provenance-test",
						input: "test",
						expected: "test",
					},
				],
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite, { includeProvenance: true });

			expect(specs[0].metadata?.source).toBe("legacy");
			expect(specs[0].metadata?.legacySuiteName).toBe("provenance-suite");
			expect(specs[0].metadata?.legacyTestId).toBe("provenance-test");
			expect(specs[0].metadata?.originalInput).toBe("test");
			expect(specs[0].metadata?.originalExpected).toBe("test");
		});

		it("should exclude provenance metadata when not requested", () => {
			const suite = createTestSuite("no-provenance-suite", {
				cases: [
					{
						id: "no-provenance-test",
						input: "test",
						expected: "test",
					},
				],
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite, { includeProvenance: false });

			expect(specs[0].metadata?.source).toBeUndefined();
			expect(specs[0].metadata?.legacySuiteName).toBeUndefined();
			expect(specs[0].metadata?.legacyTestId).toBeUndefined();
		});
	});

	describe("generateDefineEvalCode function", () => {
		it("should generate valid TypeScript code", () => {
			const suite = createTestSuite("code-gen-suite", {
				cases: [
					{
						id: "code-test",
						input: "Hello",
						expected: "Hello",
					},
				],
				executor: async (input: string) => input,
			});

			const code = generateDefineEvalCode(suite);

			expect(code).toContain(
				"// Auto-generated from TestSuite: code-gen-suite",
			);
			expect(code).toContain(
				"import { defineEval, createResult } from '@evalgate/sdk';",
			);
			expect(code).toContain('defineEval("code-test", async (context) => {');
			expect(code).toContain("return result;");
			expect(code).toContain('description: "Legacy test: code-test"');
			expect(code).toContain('tags: ["legacy", "migrated"]');
		});

		it("should include helper functions when requested", () => {
			const suite = createTestSuite("helpers-suite", {
				cases: [
					{
						id: "helpers-test",
						input: "test",
						expected: "test",
					},
				],
				executor: async (input: string) => input,
			});

			const code = generateDefineEvalCode(suite, { generateHelpers: true });

			expect(code).toContain("function evaluateLegacyTest");
			expect(code).toContain("function simulateLegacyExecutor");
			expect(code).toContain("function evaluateLegacyAssertion");
		});

		it("should handle multiple test cases", () => {
			const suite = createTestSuite("multi-suite", {
				cases: [
					{
						id: "test-1",
						input: "first",
						expected: "first",
					},
					{
						id: "test-2",
						input: "second",
						expected: "second",
					},
				],
				executor: async (input: string) => input,
			});

			const code = generateDefineEvalCode(suite);

			expect(code).toContain('defineEval("test-1", async (context) => {');
			expect(code).toContain('defineEval("test-2", async (context) => {');
		});
	});

	describe("Runtime integration", () => {
		it("should work with runtime registration", () => {
			const suite = createTestSuite("runtime-suite", {
				cases: [
					{
						id: "runtime-test",
						input: "test",
						expected: "test",
					},
				],
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite);

			// Create runtime and register specs
			const runtime = createEvalRuntime();

			try {
				for (const spec of specs) {
					runtime.runtime.register(spec);
				}

				const registeredSpecs = runtime.runtime.list();
				expect(registeredSpecs).toHaveLength(1);
				expect(registeredSpecs[0].name).toBe("runtime-test");
			} finally {
				disposeActiveRuntime();
			}
		});
	});

	describe("Edge cases", () => {
		it("should handle empty TestSuite", () => {
			const suite = createTestSuite("empty-suite", {
				cases: [],
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite);
			expect(specs).toHaveLength(0);
		});

		it("should handle TestSuite with complex metadata", () => {
			const suite = createTestSuite("complex-suite", {
				cases: [
					{
						id: "complex-test",
						input: "complex input",
						expected: "complex output",
						metadata: {
							nested: {
								deep: {
									value: "test",
								},
							},
							array: [1, 2, 3],
							boolean: true,
							null: null,
						},
					},
				],
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite);

			expect(specs[0].metadata?.nested).toEqual({
				deep: {
					value: "test",
				},
			});
			expect(specs[0].metadata?.array).toEqual([1, 2, 3]);
			expect(specs[0].metadata?.boolean).toBe(true);
			expect(specs[0].metadata?.null).toBeNull();
		});

		it("should handle TestSuite with assertions", () => {
			const suite = createTestSuite("assertions-suite", {
				cases: [
					{
						id: "assertions-test",
						input: "test input",
						expected: "test output",
						assertions: [
							(output) => ({
								name: "test",
								passed: output === "test output",
								expected: "test output",
								actual: output,
							}),
						],
					},
				],
				executor: async (input: string) => input,
			});

			const specs = adaptTestSuite(suite);

			expect(specs[0].metadata?.originalInput).toBe("test input");
			expect(specs[0].metadata?.originalExpected).toBe("test output");
		});
	});
});
