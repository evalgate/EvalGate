import {
	afterEach,
	beforeEach,
	describe,
	it,
	vi,
	expect as vitestExpect,
} from "vitest";
import { expect } from "../assertions";
import {
	containsKeywords,
	createTestSuite,
	hasLength,
	hasSentiment,
	matchesPattern,
} from "../testing";

describe("TestSuite", () => {
	describe("basic execution", () => {
		it("should run test cases with an executor", async () => {
			const suite = createTestSuite("basic-tests", {
				cases: [
					{
						input: "Hello",
						assertions: [(output) => expect(output).toContain("Hello")],
					},
				],
				executor: async (input) => `Echo: ${input}`,
			});

			const result = await suite.run();
			vitestExpect(result.name).toBe("basic-tests");
			vitestExpect(result.total).toBe(1);
			vitestExpect(result.passed).toBe(1);
			vitestExpect(result.failed).toBe(0);
			vitestExpect(result.results[0].passed).toBe(true);
		});

		it("should fail when assertion fails", async () => {
			const suite = createTestSuite("fail-tests", {
				cases: [
					{
						input: "Hello",
						assertions: [
							(output) => expect(output).toContain("missing keyword"),
						],
					},
				],
				executor: async (input) => `Echo: ${input}`,
			});

			const result = await suite.run();
			vitestExpect(result.passed).toBe(0);
			vitestExpect(result.failed).toBe(1);
			vitestExpect(result.results[0].passed).toBe(false);
		});
	});

	describe("default equality check", () => {
		it("should use toEqual when expected is provided without assertions", async () => {
			const suite = createTestSuite("equality-tests", {
				cases: [{ input: "hello", expected: "hello" }],
				// No executor — uses expected as actual
			});

			const result = await suite.run();
			vitestExpect(result.passed).toBe(1);
		});

		it("should fail when expected does not match", async () => {
			const suite = createTestSuite("equality-fail", {
				cases: [{ input: "hello", expected: "world" }],
				executor: async (input) => input, // Returns 'hello', not 'world'
			});

			const result = await suite.run();
			vitestExpect(result.failed).toBe(1);
		});
	});

	describe("retries (flake guard)", () => {
		it("retries only failing cases and merges best result", async () => {
			const bAttempts: number[] = [];
			const suite = createTestSuite("flake-tests", {
				cases: [
					{ id: "a", input: "a", expected: "a" },
					{ id: "b", input: "b", expected: "b" },
				],
				executor: async (input) => {
					if (input === "b") {
						bAttempts.push(1);
						return bAttempts.length === 1 ? "wrong" : "b";
					}
					return input;
				},
				parallel: false,
				retries: 1,
			});

			const result = await suite.run();
			vitestExpect(result.passed).toBe(2);
			vitestExpect(result.retriedCases).toEqual(["b"]);
		});

		it("includes retry count in result when retries resolve", async () => {
			let attempts = 0;
			const suite = createTestSuite("retry-resolve", {
				cases: [{ id: "flaky", input: "x", expected: "x" }],
				executor: async () => {
					attempts++;
					return attempts >= 2 ? "x" : "y";
				},
				retries: 1,
			});

			const result = await suite.run();
			vitestExpect(result.passed).toBe(1);
			vitestExpect(result.retriedCases).toContain("flaky");
		});

		it("respects retryDelayMs with exponential backoff", async () => {
			let attempts = 0;
			const timestamps: number[] = [];
			const suite = createTestSuite("delay-test", {
				cases: [{ id: "slow", input: "x", expected: "x" }],
				executor: async () => {
					timestamps.push(Date.now());
					attempts++;
					return attempts >= 3 ? "x" : "y";
				},
				retries: 2,
				retryDelayMs: 50,
				retryJitter: 0,
			});

			const result = await suite.run();
			vitestExpect(result.passed).toBe(1);
			vitestExpect(timestamps.length).toBe(3);
			// First retry delay ~50ms, second ~100ms (2^1 * 50)
			const gap1 = timestamps[1] - timestamps[0];
			const gap2 = timestamps[2] - timestamps[1];
			vitestExpect(gap1).toBeGreaterThanOrEqual(40);
			vitestExpect(gap2).toBeGreaterThanOrEqual(80);
		});

		it("disables jitter when retryJitter is 0", async () => {
			let attempts = 0;
			const gaps: number[] = [];
			let lastTs = 0;
			const suite = createTestSuite("no-jitter", {
				cases: [{ id: "c", input: "x", expected: "x" }],
				executor: async () => {
					const now = Date.now();
					if (lastTs > 0) gaps.push(now - lastTs);
					lastTs = now;
					attempts++;
					return attempts >= 2 ? "x" : "y";
				},
				retries: 1,
				retryDelayMs: 60,
				retryJitter: 0,
			});

			const result = await suite.run();
			vitestExpect(result.passed).toBe(1);
			// With jitter=0, delay should be consistent around 60ms
			vitestExpect(gaps[0]).toBeGreaterThanOrEqual(50);
			vitestExpect(gaps[0]).toBeLessThan(150);
		});

		it("retriedCases is absent when no retries needed", async () => {
			const suite = createTestSuite("no-retry-needed", {
				cases: [{ id: "ok", input: "x", expected: "x" }],
				executor: async () => "x",
				retries: 2,
				retryDelayMs: 10,
			});

			const result = await suite.run();
			vitestExpect(result.passed).toBe(1);
			vitestExpect(result.retriedCases).toBeUndefined();
		});
	});

	describe("parallel execution", () => {
		it("should run tests in parallel", async () => {
			const order: number[] = [];
			const suite = createTestSuite("parallel-tests", {
				cases: [
					{ id: "1", input: "a", expected: "a" },
					{ id: "2", input: "b", expected: "b" },
					{ id: "3", input: "c", expected: "c" },
				],
				executor: async (input) => {
					order.push(parseInt(input, 36) - 9); // a=1, b=2, c=3
					return input;
				},
				parallel: true,
			});

			const result = await suite.run();
			vitestExpect(result.total).toBe(3);
			vitestExpect(result.passed).toBe(3);
		});
	});

	describe("sequential execution", () => {
		it("should run tests sequentially", async () => {
			const order: string[] = [];
			const suite = createTestSuite("sequential-tests", {
				cases: [
					{ id: "first", input: "a", expected: "a" },
					{ id: "second", input: "b", expected: "b" },
				],
				executor: async (input) => {
					order.push(input);
					return input;
				},
				parallel: false,
			});

			const result = await suite.run();
			vitestExpect(order).toEqual(["a", "b"]);
			vitestExpect(result.passed).toBe(2);
		});
	});

	describe("stopOnFailure", () => {
		it("should stop after first failure when enabled", async () => {
			const suite = createTestSuite("stop-on-fail", {
				cases: [
					{ id: "pass", input: "hello", expected: "hello" },
					{ id: "fail", input: "hello", expected: "nope" },
					{ id: "skip", input: "hello", expected: "hello" },
				],
				executor: async (input) => input,
				parallel: false,
				stopOnFailure: true,
			});

			const result = await suite.run();
			vitestExpect(result.total).toBe(2); // Only 2 ran
			vitestExpect(result.passed).toBe(1);
			vitestExpect(result.failed).toBe(1);
		});
	});

	describe("timeout", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should timeout slow tests", async () => {
			const suite = createTestSuite("timeout-tests", {
				cases: [{ id: "slow", input: "hello" }],
				executor: async (_input) => {
					return new Promise((resolve) => {
						setTimeout(() => resolve("done"), 60000);
					});
				},
				timeout: 100,
				parallel: false,
			});

			const runPromise = suite.run();
			// Advance timers past the timeout
			vi.advanceTimersByTime(200);
			const result = await runPromise;
			vitestExpect(result.results[0].passed).toBe(false);
			vitestExpect(result.results[0].error).toContain("timeout");
		});
	});

	describe("error handling", () => {
		it("should catch executor errors gracefully", async () => {
			const suite = createTestSuite("error-tests", {
				cases: [{ input: "hello" }],
				executor: async () => {
					throw new Error("executor broke");
				},
			});

			const result = await suite.run();
			vitestExpect(result.results[0].passed).toBe(false);
			vitestExpect(result.results[0].error).toBe("executor broke");
		});

		it("should fail when no executor and no expected", async () => {
			const suite = createTestSuite("no-exec", {
				cases: [{ input: "hello" }],
			});

			const result = await suite.run();
			vitestExpect(result.results[0].passed).toBe(false);
			vitestExpect(result.results[0].error).toContain("No executor");
		});
	});

	describe("addCase", () => {
		it("should allow adding cases after construction", async () => {
			const suite = createTestSuite("dynamic", {
				cases: [],
				executor: async (input) => input,
			});

			suite.addCase({ input: "test", expected: "test" });

			const result = await suite.run();
			vitestExpect(result.total).toBe(1);
			vitestExpect(result.passed).toBe(1);
		});
	});

	describe("custom assertion IDs", () => {
		it("should use provided IDs", async () => {
			const suite = createTestSuite("ids", {
				cases: [{ id: "custom-id", input: "test", expected: "test" }],
			});

			const result = await suite.run();
			vitestExpect(result.results[0].id).toBe("custom-id");
		});

		it("should generate IDs when not provided", async () => {
			const suite = createTestSuite("auto-ids", {
				cases: [{ input: "test", expected: "test" }],
			});

			const result = await suite.run();
			vitestExpect(result.results[0].id).toBe("case-0");
		});
	});
});

describe("Testing helper functions", () => {
	it("containsKeywords returns an assertion function", () => {
		const assertFn = containsKeywords(["hello", "world"]);
		const result = assertFn("hello world");
		vitestExpect(result.passed).toBe(true);
		vitestExpect(result.name).toBe("toContainKeywords");
	});

	it("matchesPattern returns an assertion function", () => {
		const assertFn = matchesPattern(/\d{3}/);
		const result = assertFn("code: 123");
		vitestExpect(result.passed).toBe(true);
	});

	it("hasSentiment returns an assertion function", () => {
		const assertFn = hasSentiment("positive");
		const result = assertFn("This is great!");
		vitestExpect(result.passed).toBe(true);
	});

	it("hasLength returns an assertion function", () => {
		const assertFn = hasLength({ min: 5, max: 50 });
		const result = assertFn("hello world");
		vitestExpect(result.passed).toBe(true);
	});
});
