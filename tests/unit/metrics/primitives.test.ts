import { describe, expect, it } from "vitest";
import {
	containsMatch,
	costScore,
	exactMatch,
	getPrimitive,
	jaccardSimilarity,
	latencyScore,
	lengthRatio,
	type MetricContext,
	maxLength,
	PRIMITIVE_REGISTRY,
	regexMatch,
	requiredToolUsed,
	tokenF1,
	toolSuccessRate,
} from "@/lib/metrics/primitives";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function ctx(overrides: Partial<MetricContext> = {}): MetricContext {
	return {
		prompt: "What is the capital of France?",
		response: "The capital of France is Paris.",
		expectedOutput: "Paris",
		...overrides,
	};
}

// ── exactMatch ────────────────────────────────────────────────────────────────

describe("exactMatch", () => {
	it("returns 1 for identical strings (case-insensitive default)", () => {
		const r = exactMatch(ctx({ response: "paris", expectedOutput: "Paris" }));
		expect(r.score).toBe(1);
		expect(r.passed).toBe(true);
	});

	it("returns 0 for different strings", () => {
		const r = exactMatch(ctx({ response: "London", expectedOutput: "Paris" }));
		expect(r.score).toBe(0);
		expect(r.passed).toBe(false);
	});

	it("respects caseSensitive option", () => {
		const r = exactMatch(ctx({ response: "paris", expectedOutput: "Paris" }), {
			caseSensitive: true,
		});
		expect(r.score).toBe(0);
	});

	it("trims whitespace", () => {
		const r = exactMatch(
			ctx({ response: "  Paris  ", expectedOutput: "Paris" }),
		);
		expect(r.score).toBe(1);
	});

	it("returns 0 when no expectedOutput", () => {
		const r = exactMatch(ctx({ expectedOutput: undefined }));
		expect(r.score).toBe(0);
	});
});

// ── containsMatch ─────────────────────────────────────────────────────────────

describe("containsMatch", () => {
	it("returns 1 when response contains expected", () => {
		const r = containsMatch(
			ctx({ response: "The capital is Paris.", expectedOutput: "Paris" }),
		);
		expect(r.score).toBe(1);
	});

	it("returns 0 when response does not contain expected", () => {
		const r = containsMatch(
			ctx({ response: "Berlin is great.", expectedOutput: "Paris" }),
		);
		expect(r.score).toBe(0);
	});

	it("is case-insensitive by default", () => {
		const r = containsMatch(
			ctx({ response: "the answer is PARIS", expectedOutput: "paris" }),
		);
		expect(r.score).toBe(1);
	});

	it("respects caseSensitive option", () => {
		const r = containsMatch(
			ctx({ response: "paris", expectedOutput: "Paris" }),
			{ caseSensitive: true },
		);
		expect(r.score).toBe(0);
	});
});

// ── regexMatch ────────────────────────────────────────────────────────────────

describe("regexMatch", () => {
	it("returns 1 for matching pattern", () => {
		const r = regexMatch(ctx({ response: "The answer is 42" }), {
			pattern: "\\d+",
		});
		expect(r.score).toBe(1);
	});

	it("returns 0 for non-matching pattern", () => {
		const r = regexMatch(ctx({ response: "No numbers here" }), {
			pattern: "\\d+",
		});
		expect(r.score).toBe(0);
	});

	it("returns 0 for missing pattern option", () => {
		const r = regexMatch(ctx());
		expect(r.score).toBe(0);
		expect(r.label).toMatch(/pattern/i);
	});

	it("handles invalid regex gracefully", () => {
		const r = regexMatch(ctx(), { pattern: "[invalid" });
		expect(r.score).toBe(0);
		expect(r.label).toMatch(/invalid/i);
	});

	it("is case-insensitive by default", () => {
		const r = regexMatch(ctx({ response: "PARIS" }), { pattern: "paris" });
		expect(r.score).toBe(1);
	});
});

// ── tokenF1 ───────────────────────────────────────────────────────────────────

describe("tokenF1", () => {
	it("returns 1 for identical response and expected", () => {
		const r = tokenF1(
			ctx({
				response: "Paris is beautiful",
				expectedOutput: "Paris is beautiful",
			}),
		);
		expect(r.score).toBeCloseTo(1.0);
	});

	it("returns > 0 for partial match", () => {
		const r = tokenF1(
			ctx({ response: "Paris is great", expectedOutput: "Paris is beautiful" }),
		);
		expect(r.score).toBeGreaterThan(0);
		expect(r.score).toBeLessThan(1);
	});

	it("returns 0 for completely different tokens", () => {
		const r = tokenF1(
			ctx({ response: "London rain", expectedOutput: "Paris sunshine" }),
		);
		expect(r.score).toBe(0);
	});

	it("returns 0 when no expectedOutput", () => {
		const r = tokenF1(ctx({ expectedOutput: undefined }));
		expect(r.score).toBe(0);
	});
});

// ── jaccardSimilarity ─────────────────────────────────────────────────────────

describe("jaccardSimilarity", () => {
	it("returns 1 for identical texts", () => {
		const r = jaccardSimilarity(
			ctx({ response: "hello world", expectedOutput: "hello world" }),
		);
		expect(r.score).toBeCloseTo(1.0);
	});

	it("returns 0 for completely different texts", () => {
		const r = jaccardSimilarity(
			ctx({ response: "apple orange", expectedOutput: "cat dog" }),
		);
		expect(r.score).toBe(0);
	});

	it("returns intermediate score for partial overlap", () => {
		const r = jaccardSimilarity(
			ctx({ response: "hello world", expectedOutput: "hello there" }),
		);
		expect(r.score).toBeGreaterThan(0);
		expect(r.score).toBeLessThan(1);
	});
});

// ── lengthRatio ───────────────────────────────────────────────────────────────

describe("lengthRatio", () => {
	it("returns 1 for response length equal to expected", () => {
		const r = lengthRatio(ctx({ response: "abc", expectedOutput: "xyz" })); // both 3 chars
		expect(r.score).toBe(1);
		expect(r.passed).toBe(true);
	});

	it("penalises very long responses", () => {
		const r = lengthRatio(
			ctx({ response: "a".repeat(500), expectedOutput: "a".repeat(10) }),
		);
		expect(r.passed).toBe(false);
	});

	it("penalises very short responses", () => {
		const r = lengthRatio(
			ctx({ response: "a", expectedOutput: "a".repeat(100) }),
		);
		expect(r.passed).toBe(false);
	});
});

// ── maxLength ─────────────────────────────────────────────────────────────────

describe("maxLength", () => {
	it("returns 1 for response within limit", () => {
		const r = maxLength(ctx({ response: "Short" }), { maxChars: 100 });
		expect(r.score).toBe(1);
		expect(r.passed).toBe(true);
	});

	it("returns < 1 for response over limit", () => {
		const r = maxLength(ctx({ response: "a".repeat(200) }), { maxChars: 100 });
		expect(r.score).toBeLessThan(1);
		expect(r.passed).toBe(false);
	});

	it("score degrades gracefully over limit", () => {
		const r = maxLength(ctx({ response: "a".repeat(150) }), { maxChars: 100 });
		expect(r.score).toBeGreaterThan(0);
		expect(r.score).toBeLessThan(1);
	});
});

// ── latencyScore ──────────────────────────────────────────────────────────────

describe("latencyScore", () => {
	it("returns 1 for latency at or below target", () => {
		const r = latencyScore(ctx({ latencyMs: 500 }), { targetMs: 1000 });
		expect(r.score).toBe(1);
		expect(r.passed).toBe(true);
	});

	it("returns 0 for latency at 2× target", () => {
		const r = latencyScore(ctx({ latencyMs: 2000 }), { targetMs: 1000 });
		expect(r.score).toBe(0);
	});

	it("returns 0.5 for latency at 1.5× target (degrading)", () => {
		const r = latencyScore(ctx({ latencyMs: 1500 }), { targetMs: 1000 });
		expect(r.score).toBeCloseTo(0.5);
	});

	it("returns 0.5 when latency not recorded", () => {
		const r = latencyScore(ctx({ latencyMs: undefined }), { targetMs: 1000 });
		expect(r.score).toBe(0.5);
	});
});

// ── costScore ─────────────────────────────────────────────────────────────────

describe("costScore", () => {
	it("returns 1 for cost at or below budget", () => {
		const r = costScore(ctx({ costUsd: 0.005 }), { budgetUsd: 0.01 });
		expect(r.score).toBe(1);
	});

	it("returns 0 for cost at 2× budget", () => {
		const r = costScore(ctx({ costUsd: 0.02 }), { budgetUsd: 0.01 });
		expect(r.score).toBe(0);
	});

	it("returns 0.5 when cost not recorded", () => {
		const r = costScore(ctx({ costUsd: undefined }));
		expect(r.score).toBe(0.5);
	});
});

// ── toolSuccessRate ───────────────────────────────────────────────────────────

describe("toolSuccessRate", () => {
	it("returns 1 for all successful tool calls", () => {
		const r = toolSuccessRate(
			ctx({
				toolCalls: [
					{ name: "search", success: true },
					{ name: "calc", success: true },
				],
			}),
		);
		expect(r.score).toBe(1);
	});

	it("returns 0.5 for half successful", () => {
		const r = toolSuccessRate(
			ctx({
				toolCalls: [
					{ name: "a", success: true },
					{ name: "b", success: false },
				],
			}),
		);
		expect(r.score).toBe(0.5);
	});

	it("returns 1 with no tool calls", () => {
		const r = toolSuccessRate(ctx({ toolCalls: [] }));
		expect(r.score).toBe(1);
	});
});

// ── requiredToolUsed ──────────────────────────────────────────────────────────

describe("requiredToolUsed", () => {
	it("returns 1 when required tool was called", () => {
		const r = requiredToolUsed(
			ctx({ toolCalls: [{ name: "search", success: true }] }),
			{ toolName: "search" },
		);
		expect(r.score).toBe(1);
	});

	it("returns 0 when required tool was not called", () => {
		const r = requiredToolUsed(
			ctx({ toolCalls: [{ name: "calc", success: true }] }),
			{ toolName: "search" },
		);
		expect(r.score).toBe(0);
	});

	it("returns 0 when no toolName option provided", () => {
		const r = requiredToolUsed(ctx());
		expect(r.score).toBe(0);
	});
});

// ── Registry ──────────────────────────────────────────────────────────────────

describe("PRIMITIVE_REGISTRY", () => {
	it("contains all expected primitives", () => {
		const expected = [
			"exact_match",
			"contains_match",
			"regex_match",
			"token_f1",
			"jaccard_similarity",
			"length_ratio",
			"max_length",
			"latency_score",
			"cost_score",
			"tool_success_rate",
			"required_tool_used",
		];
		for (const name of expected) {
			expect(
				PRIMITIVE_REGISTRY[name],
				`missing primitive: ${name}`,
			).toBeDefined();
		}
	});

	it("getPrimitive returns function for known name", () => {
		const fn = getPrimitive("exact_match");
		expect(typeof fn).toBe("function");
	});

	it("getPrimitive returns undefined for unknown name", () => {
		expect(getPrimitive("nonexistent_metric")).toBeUndefined();
	});
});
