/**
 * Tests for TestSuite strict mode and seed-based deterministic ordering.
 */
import { describe, expect, it } from "vitest";
import { createTestSuite } from "../testing";

describe("TestSuite — strict mode", () => {
	it("stops on first failure when strict=true", async () => {
		const suite = createTestSuite("strict-test", {
			strict: true,
			parallel: false,
			cases: [
				{ id: "pass-1", input: "a", expected: "a" },
				{ id: "fail-1", input: "b", expected: "WRONG" },
				{ id: "pass-2", input: "c", expected: "c" },
			],
			executor: async (input: string) => input,
		});
		const result = await suite.run();
		// Should have stopped after fail-1, so only 2 results
		expect(result.results.length).toBe(2);
		expect(result.results[0].passed).toBe(true);
		expect(result.results[1].passed).toBe(false);
	});

	it("runs all cases when strict=false", async () => {
		const suite = createTestSuite("non-strict-test", {
			strict: false,
			parallel: false,
			cases: [
				{ id: "pass-1", input: "a", expected: "a" },
				{ id: "fail-1", input: "b", expected: "WRONG" },
				{ id: "pass-2", input: "c", expected: "c" },
			],
			executor: async (input: string) => input,
		});
		const result = await suite.run();
		expect(result.results.length).toBe(3);
	});
});

describe("TestSuite — seed deterministic ordering", () => {
	it("produces the same order for the same seed", async () => {
		const cases = [
			{ id: "a", input: "1", expected: "1" },
			{ id: "b", input: "2", expected: "2" },
			{ id: "c", input: "3", expected: "3" },
			{ id: "d", input: "4", expected: "4" },
			{ id: "e", input: "5", expected: "5" },
		];

		const run = async (seed: number) => {
			const suite = createTestSuite("seed-test", {
				seed,
				parallel: false,
				cases,
				executor: async (input: string) => input,
			});
			const result = await suite.run();
			return result.results.map((r) => r.id);
		};

		const order1 = await run(42);
		const order2 = await run(42);
		const order3 = await run(99);

		// Same seed → same order
		expect(order1).toEqual(order2);
		// Different seed → (very likely) different order
		// With 5 items, the chance of same order is 1/120
		expect(order3).not.toEqual(order1);
	});

	it("does not shuffle when seed is not provided", async () => {
		const cases = [
			{ id: "a", input: "1", expected: "1" },
			{ id: "b", input: "2", expected: "2" },
			{ id: "c", input: "3", expected: "3" },
		];

		const suite = createTestSuite("no-seed-test", {
			parallel: false,
			cases,
			executor: async (input: string) => input,
		});
		const result = await suite.run();
		const ids = result.results.map((r) => r.id);
		expect(ids).toEqual(["a", "b", "c"]);
	});
});
