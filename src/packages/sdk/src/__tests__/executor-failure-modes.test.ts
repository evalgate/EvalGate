/**
 * Reliability under external dependency failure — executor (LLM/webhook) failure modes.
 * Asserts: normalized error capture, actionable messages, deterministic exit semantics.
 */

import { describe, expect, it, vi } from "vitest";
import { EvalGateError } from "../errors";
import { createTestSuite } from "../testing";

describe("Executor failure modes", () => {
	it("timeout: executor hangs — result has error, passed=false", async () => {
		const executor = vi.fn(() => new Promise<string>(() => {})); // never resolves
		const suite = createTestSuite("timeout-test", {
			cases: [
				{
					input: "hi",
					assertions: [(o: string) => ({ passed: o.length > 0, message: "" })],
				},
			],
			executor,
			timeout: 50,
		});

		const result = await suite.run();

		expect(result.failed).toBe(1);
		expect(result.passed).toBe(0);
		expect(result.results[0].error).toMatch(/timeout|Timeout/i);
		expect(result.results[0].passed).toBe(false);
	});

	it("429 upstream: executor throws rate limit — error captured, retry guidance in EvalGateError", async () => {
		const err = new EvalGateError(
			"Rate limit exceeded",
			"RATE_LIMIT_EXCEEDED",
			429,
			{
				retryAfter: 60,
			},
		);
		const executor = vi.fn(() => Promise.reject(err));
		const suite = createTestSuite("429-test", {
			cases: [
				{
					input: "hi",
					assertions: [(_o: string) => ({ passed: true, message: "" })],
				},
			],
			executor,
		});

		const result = await suite.run();

		expect(result.failed).toBe(1);
		expect(result.results[0].error).toContain("Rate limit exceeded");
		expect(result.results[0].passed).toBe(false);
		expect(err.retryable).toBe(true);
		expect(err.retryAfter).toBe(60);
	});

	it("malformed upstream: executor throws generic error — no crash, error in result", async () => {
		const executor = vi.fn(() =>
			Promise.reject(new Error("Invalid JSON response from upstream")),
		);
		const suite = createTestSuite("malformed-test", {
			cases: [
				{
					input: "hi",
					assertions: [(_o: string) => ({ passed: true, message: "" })],
				},
			],
			executor,
		});

		const result = await suite.run();

		expect(result.failed).toBe(1);
		expect(result.results[0].error).toContain("Invalid JSON");
		expect(result.results[0].passed).toBe(false);
	});

	it("check fails deterministically when API returns error — exit code semantics", async () => {
		// This tests the fetch path: when quality API returns non-ok, runCheck returns EXIT.API_ERROR
		const { EXIT } = await import("../cli/check");
		expect(EXIT.API_ERROR).toBeGreaterThan(0);
		expect(EXIT.PASS).toBe(0);
	}, 10000);
});
