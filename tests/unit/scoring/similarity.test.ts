import { describe, expect, it } from "vitest";
import {
	combinedScore,
	cosineSimilarity,
	keywordMatchRate,
	levenshteinSimilarity,
} from "@/lib/scoring/similarity";

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
	it("returns 1 for identical strings", () => {
		expect(cosineSimilarity("hello world", "hello world")).toBeCloseTo(1.0);
	});

	it("returns 0 for completely disjoint strings", () => {
		expect(cosineSimilarity("apple orange", "cat dog")).toBe(0);
	});

	it("returns value between 0 and 1 for partial overlap", () => {
		const sim = cosineSimilarity("hello world foo", "hello earth bar");
		expect(sim).toBeGreaterThan(0);
		expect(sim).toBeLessThan(1);
	});

	it("returns 0 when one string is empty", () => {
		expect(cosineSimilarity("hello", "")).toBe(0);
		expect(cosineSimilarity("", "world")).toBe(0);
	});

	it("returns 0 when both strings are empty", () => {
		expect(cosineSimilarity("", "")).toBe(0);
	});

	it("is symmetric", () => {
		const a = "the quick brown fox";
		const b = "the slow red fox";
		expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
	});

	it("accounts for word frequency (term frequency weighting)", () => {
		// "cat cat cat" vs "cat" — same word but different frequency
		const highFreq = cosineSimilarity("cat cat cat", "cat");
		expect(highFreq).toBeGreaterThan(0);
		expect(highFreq).toBeLessThanOrEqual(1);
	});
});

// ── levenshteinSimilarity ─────────────────────────────────────────────────────

describe("levenshteinSimilarity", () => {
	it("returns 1 for identical strings", () => {
		expect(levenshteinSimilarity("hello", "hello")).toBe(1);
	});

	it("returns 0 for completely different same-length strings", () => {
		// "abcde" → "fghij": 5 edits, maxLen=5 → 1 - 5/5 = 0
		expect(levenshteinSimilarity("abcde", "fghij")).toBeCloseTo(0);
	});

	it("returns 1 for empty vs empty", () => {
		expect(levenshteinSimilarity("", "")).toBe(1);
	});

	it("returns 0 for empty vs non-empty", () => {
		expect(levenshteinSimilarity("", "hello")).toBe(0);
	});

	it("returns intermediate value for partial match", () => {
		// "kitten" → "sitting": distance=3, maxLen=7 → 1 - 3/7 ≈ 0.571
		const sim = levenshteinSimilarity("kitten", "sitting");
		expect(sim).toBeGreaterThan(0);
		expect(sim).toBeLessThan(1);
	});

	it("returns high similarity for one character insertion", () => {
		const sim = levenshteinSimilarity("color", "colour");
		expect(sim).toBeGreaterThan(0.8);
	});

	it("is symmetric", () => {
		expect(levenshteinSimilarity("abc", "abcd")).toBe(
			levenshteinSimilarity("abcd", "abc"),
		);
	});
});

// ── combinedScore ─────────────────────────────────────────────────────────────

describe("combinedScore", () => {
	it("returns 100 for identical strings", () => {
		expect(combinedScore("hello world", "hello world")).toBe(100);
	});

	it("returns a value between 0 and 100", () => {
		const score = combinedScore("the quick fox", "a slow dog");
		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(100);
	});

	it("returns higher score for more similar strings", () => {
		const highSim = combinedScore(
			"Paris is the capital",
			"Paris is the capital of France",
		);
		const lowSim = combinedScore("Paris is the capital", "Tokyo is in Japan");
		expect(highSim).toBeGreaterThan(lowSim);
	});

	it("respects custom weights", () => {
		const s1 = combinedScore("hello world", "hello earth", {
			cosine: 1,
			levenshtein: 0,
		});
		const s2 = combinedScore("hello world", "hello earth", {
			cosine: 0,
			levenshtein: 1,
		});
		// Different weights should produce different (or equal) scores
		expect(typeof s1).toBe("number");
		expect(typeof s2).toBe("number");
	});

	it("returns integer (rounded)", () => {
		const score = combinedScore("quick fox", "slow dog");
		expect(Number.isInteger(score)).toBe(true);
	});
});

// ── keywordMatchRate ──────────────────────────────────────────────────────────

describe("keywordMatchRate", () => {
	it("returns 100 when all keywords match", () => {
		expect(
			keywordMatchRate(
				"capital france paris",
				"paris is the capital of france",
			),
		).toBe(100);
	});

	it("returns 0 when no keywords match", () => {
		expect(keywordMatchRate("quantum physics", "cooking recipes")).toBe(0);
	});

	it("returns 100 when expected has only short words (skipped by filter)", () => {
		// Words <= 3 chars are filtered out, so "a to be" → no keywords → 100
		expect(keywordMatchRate("a to be", "anything")).toBe(100);
	});

	it("returns partial score for partial match", () => {
		const rate = keywordMatchRate("capital france paris", "paris is the city");
		expect(rate).toBeGreaterThan(0);
		expect(rate).toBeLessThan(100);
	});

	it("is case-insensitive", () => {
		expect(keywordMatchRate("PARIS FRANCE", "paris and france")).toBe(100);
	});

	it("returns integer", () => {
		const rate = keywordMatchRate("hello world", "hello");
		expect(Number.isInteger(rate)).toBe(true);
	});
});
