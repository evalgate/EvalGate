import { describe, expect, it } from "vitest";
import { expect as expectFn } from "../assertions";

describe("Cost tier labeling", () => {
	it("should add cost tier to assertion results", () => {
		const result = expectFn("hello").withCostTier("high").toEqual("hello");
		expect(result.costTier).toBe("high");
		expect(result.passed).toBe(true);
	});

	it("should preserve cost tier through not modifier", () => {
		const result = expectFn("hello")
			.withCostTier("medium")
			.not.toEqual("world");
		expect(result.costTier).toBe("medium");
		expect(result.passed).toBe(true);
	});

	it("should default to undefined cost tier", () => {
		const result = expectFn("hello").toEqual("hello");
		expect(result.costTier).toBeUndefined();
		expect(result.passed).toBe(true);
	});

	it("should work with different assertion methods", () => {
		const result1 = expectFn("hello world")
			.withCostTier("low")
			.toContain("hello");
		expect(result1.costTier).toBe("low");

		const result2 = expectFn("error message")
			.withCostTier("high")
			.toNotContain("error");
		expect(result2.costTier).toBe("high");
		expect(result2.passed).toBe(false);
	});
});
