/**
 * COMPAT-201: Public TestSuite introspection (minimal getters) tests
 *
 * Tests for non-invasive TestSuite getters that enable adapters
 * without breaking existing behavior.
 */

import { describe, expect, it } from "vitest";
import { expect as assertion } from "../../assertions";
import { createTestSuite } from "../../testing";

describe("COMPAT-201: Public TestSuite Introspection", () => {
	describe("getTests() method", () => {
		it("should return test definitions without modifying behavior", () => {
			const suite = createTestSuite("test-suite", {
				cases: [
					{
						id: "test-1",
						input: "Hello world",
						expected: "Hello",
						metadata: { category: "greeting" },
						assertions: [(output) => assertion(output).toContain("Hello")],
					},
					{
						input: "Goodbye world",
						expected: "Goodbye",
						metadata: { category: "farewell" },
					},
				],
				executor: async (input) => input.split(" ")[0],
			});

			const tests = suite.getTests();

			// Should return correct test definitions
			expect(tests).toHaveLength(2);

			expect(tests[0]).toEqual({
				id: "test-1",
				input: "Hello world",
				expected: "Hello",
				metadata: { category: "greeting" },
				hasAssertions: true,
				assertionCount: 1,
			});

			expect(tests[1]).toEqual({
				id: "case-1", // Auto-generated ID
				input: "Goodbye world",
				expected: "Goodbye",
				metadata: undefined,
				hasAssertions: false,
				assertionCount: 0,
			});
		});

		it("should handle empty test cases", () => {
			const suite = createTestSuite("empty-suite", {
				cases: [],
				executor: async (input: string) => input,
			});

			const tests = suite.getTests();
			expect(tests).toEqual([]);
		});

		it("should handle complex assertion arrays", () => {
			const suite = createTestSuite("complex-suite", {
				cases: [
					{
						input: "test input",
						assertions: [
							(output) => assertion(output).toContain("test"),
							(output) => assertion(output).toHaveLength({ min: 9, max: 9 }),
							(output) => assertion(output).toNotContain("bad"),
						],
					},
				],
				executor: async (input: string) => input,
			});

			const tests = suite.getTests();
			expect(tests[0].hasAssertions).toBe(true);
			expect(tests[0].assertionCount).toBe(3);
		});
	});

	describe("getMetadata() method", () => {
		it("should return suite metadata without modifying behavior", () => {
			const suite = createTestSuite("metadata-suite", {
				cases: [{ input: "test" }],
				timeout: 5000,
				parallel: false,
				stopOnFailure: true,
				retries: 3,
				executor: async (input: string) => input,
			});

			const metadata = suite.getMetadata();

			expect(metadata).toEqual({
				suiteName: "metadata-suite",
				tags: [], // Empty array for future compatibility
				defaults: {
					timeout: 5000,
					parallel: false,
					stopOnFailure: true,
					retries: 3,
				},
			});
		});

		it("should handle default configuration values", () => {
			const suite = createTestSuite("default-suite", {
				cases: [{ input: "test" }],
				executor: async (input: string) => input,
			});

			const metadata = suite.getMetadata();

			expect(metadata.defaults).toEqual({
				timeout: undefined,
				parallel: undefined,
				stopOnFailure: undefined,
				retries: undefined,
			});
		});
	});

	describe("toJSON() method", () => {
		it("should return portable suite representation", () => {
			const suite = createTestSuite("portable-suite", {
				cases: [
					{
						id: "portable-test",
						input: "test input",
						expected: "expected output",
						metadata: { type: "unit" },
						assertions: [
							(output) => assertion(output).toEqual("expected output"),
						],
					},
				],
				timeout: 10000,
				parallel: true,
				executor: async (input: string) => input,
			});

			const portable = suite.toJSON();

			expect(portable).toEqual({
				name: "portable-suite",
				config: suite.getConfig(),
				tests: suite.getTests(),
				metadata: suite.getMetadata(),
			});
		});

		it("should be JSON serializable", () => {
			const suite = createTestSuite("json-suite", {
				cases: [{ input: "test" }],
				executor: async (input: string) => input,
			});

			const portable = suite.toJSON();
			const json = JSON.stringify(portable);
			const parsed = JSON.parse(json);

			expect(parsed).toEqual(portable);
		});
	});

	describe("Backward compatibility", () => {
		it("should not change existing TestSuite behavior", async () => {
			const suite = createTestSuite("compat-suite", {
				cases: [
					{
						input: "Hello",
						expected: "Hello",
						assertions: [(output) => assertion(output).toEqual("Hello")],
					},
					{
						input: "World",
						expected: "World",
					},
				],
				executor: async (input: string) => input,
			});

			// Original behavior should still work
			const results = await suite.run();

			expect(results.name).toBe("compat-suite");
			expect(results.total).toBe(2);
			expect(results.passed).toBe(2);
			expect(results.failed).toBe(0);

			// Introspection should also work
			const tests = suite.getTests();
			expect(tests).toHaveLength(2);

			const metadata = suite.getMetadata();
			expect(metadata.suiteName).toBe("compat-suite");

			const portable = suite.toJSON();
			expect(portable.name).toBe("compat-suite");
		});

		it("should not interfere with getConfig() method", () => {
			const config = {
				cases: [{ input: "test" }],
				timeout: 5000,
				parallel: false,
				executor: async (input: string) => input,
			};

			const suite = createTestSuite("config-suite", config);

			const getConfig = suite.getConfig();
			expect(getConfig).toEqual(config);
			expect(getConfig).not.toBe(config); // Should be a copy
		});

		it("should not interfere with addCase() method", () => {
			const suite = createTestSuite("add-suite", {
				cases: [{ input: "original" }],
				executor: async (input: string) => input,
			});

			// Add a new case
			suite.addCase({
				id: "added-case",
				input: "added",
				expected: "added",
			});

			const tests = suite.getTests();
			expect(tests).toHaveLength(2);
			expect(tests[1].id).toBe("added-case");
			expect(tests[1].input).toBe("added");
		});
	});

	describe("Adapter compatibility", () => {
		it("should provide sufficient data for TestSuite → defineEval adapter", () => {
			const suite = createTestSuite("adapter-suite", {
				cases: [
					{
						id: "adapter-test",
						input: "complex input with data",
						expected: "expected output",
						metadata: {
							model: "gpt-4",
							temperature: 0.7,
							category: "complex",
						},
						assertions: [
							(output) => assertion(output).toContain("expected"),
							(output) => assertion(output).toHaveLength({ min: 14, max: 14 }),
						],
					},
				],
				timeout: 30000,
				parallel: true,
				stopOnFailure: false,
				retries: 2,
				executor: async (input: string) => input,
			});

			// All the data needed for migration should be available
			const tests = suite.getTests();
			const metadata = suite.getMetadata();
			const config = suite.getConfig();

			// Verify adapter has access to all necessary data
			expect(tests[0].id).toBe("adapter-test");
			expect(tests[0].input).toBe("complex input with data");
			expect(tests[0].expected).toBe("expected output");
			expect(tests[0].metadata).toEqual({
				model: "gpt-4",
				temperature: 0.7,
				category: "complex",
			});
			expect(tests[0].hasAssertions).toBe(true);
			expect(tests[0].assertionCount).toBe(2);

			expect(metadata.suiteName).toBe("adapter-suite");
			expect(metadata.defaults).toEqual({
				timeout: 30000,
				parallel: true,
				stopOnFailure: false,
				retries: 2,
			});

			expect(config.cases).toHaveLength(1);
			expect(config.timeout).toBe(30000);
		});

		it("should handle edge cases gracefully", () => {
			const suite = createTestSuite("edge-suite", {
				cases: [
					{
						// Minimal case
						input: "minimal",
					},
					{
						// Full case with everything
						id: "full-case",
						input: "full input",
						expected: "full expected",
						metadata: { key: "value" },
						assertions: [
							(output) => assertion(output).toEqual("full expected"),
						],
					},
					{
						// Case with no expected but assertions
						input: "assertions-only",
						assertions: [(output) => assertion(output).toBeTruthy()],
					},
				],
				executor: async (input: string) => input,
			});

			const tests = suite.getTests();

			expect(tests).toHaveLength(3);

			// Minimal case
			expect(tests[0].id).toBe("case-0");
			expect(tests[0].input).toBe("minimal");
			expect(tests[0].expected).toBeUndefined();
			expect(tests[0].hasAssertions).toBe(false);
			expect(tests[0].assertionCount).toBe(0);

			// Full case
			expect(tests[1].id).toBe("full-case");
			expect(tests[1].input).toBe("full input");
			expect(tests[1].expected).toBe("full expected");
			expect(tests[1].metadata).toEqual({ key: "value" });
			expect(tests[1].hasAssertions).toBe(true);
			expect(tests[1].assertionCount).toBe(1);

			// Assertions-only case
			expect(tests[2].id).toBe("case-2");
			expect(tests[2].input).toBe("assertions-only");
			expect(tests[2].expected).toBeUndefined();
			expect(tests[2].hasAssertions).toBe(true);
			expect(tests[2].assertionCount).toBe(1);
		});
	});
});
