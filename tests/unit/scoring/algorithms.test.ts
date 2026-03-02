import { describe, expect, it } from "vitest";
import {
	compareTexts,
	getScoringRecommendation,
	ScoringAlgorithms,
	scoreText,
} from "@/lib/scoring/algorithms";

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe("ScoringAlgorithms.cosineSimilarity", () => {
	it("returns score=100 for identical texts", () => {
		const result = ScoringAlgorithms.cosineSimilarity(
			"hello world",
			"hello world",
		);
		expect(result.score).toBe(100);
		expect(result.details.algorithm).toBe("cosine");
	});

	it("returns score=0 for completely disjoint texts", () => {
		const result = ScoringAlgorithms.cosineSimilarity(
			"apple banana",
			"cat dog",
		);
		expect(result.score).toBe(0);
	});

	it("returns score in 0-100 range for partial overlap", () => {
		const result = ScoringAlgorithms.cosineSimilarity(
			"hello world foo",
			"hello world bar",
		);
		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThan(100);
	});

	it("handles empty text1 gracefully", () => {
		const result = ScoringAlgorithms.cosineSimilarity("", "hello");
		expect(result.score).toBe(0);
		expect(result.confidence).toBe(0);
	});

	it("handles empty text2 gracefully", () => {
		const result = ScoringAlgorithms.cosineSimilarity("hello", "");
		expect(result.score).toBe(0);
	});

	it("is case-insensitive", () => {
		const a = ScoringAlgorithms.cosineSimilarity("Hello World", "hello world");
		const b = ScoringAlgorithms.cosineSimilarity("hello world", "hello world");
		expect(a.score).toBe(b.score);
	});

	it("includes token counts in metrics", () => {
		const result = ScoringAlgorithms.cosineSimilarity(
			"one two three",
			"one two",
		);
		expect(result.details.metrics.tokens1).toBe(3);
		expect(result.details.metrics.tokens2).toBe(2);
	});
});

// ── levenshteinDistance ───────────────────────────────────────────────────────

describe("ScoringAlgorithms.levenshteinDistance", () => {
	it("returns score=100 for identical strings", () => {
		const result = ScoringAlgorithms.levenshteinDistance("cat", "cat");
		expect(result.score).toBe(100);
		expect(result.details.algorithm).toBe("levenshtein");
	});

	it("returns confidence=1 (deterministic algorithm)", () => {
		const result = ScoringAlgorithms.levenshteinDistance("foo", "bar");
		expect(result.confidence).toBe(1);
	});

	it("shorter edit distance → higher score", () => {
		const oneEdit = ScoringAlgorithms.levenshteinDistance("cat", "bat");
		const manyEdits = ScoringAlgorithms.levenshteinDistance("cat", "xyz");
		expect(oneEdit.score).toBeGreaterThan(manyEdits.score);
	});

	it("handles empty inputs", () => {
		const result = ScoringAlgorithms.levenshteinDistance("", "hello");
		expect(result.score).toBe(0);
	});

	it("includes distance in metrics", () => {
		const result = ScoringAlgorithms.levenshteinDistance("kitten", "sitting");
		expect(typeof result.details.metrics.distance).toBe("number");
		expect(result.details.metrics.distance).toBeGreaterThan(0);
	});
});

// ── jaccardSimilarity ─────────────────────────────────────────────────────────

describe("ScoringAlgorithms.jaccardSimilarity", () => {
	it("returns score=100 for identical texts", () => {
		const result = ScoringAlgorithms.jaccardSimilarity(
			"hello world",
			"hello world",
		);
		expect(result.score).toBe(100);
		expect(result.details.algorithm).toBe("jaccard");
	});

	it("returns score=0 for completely disjoint token sets", () => {
		const result = ScoringAlgorithms.jaccardSimilarity(
			"alpha beta",
			"gamma delta",
		);
		expect(result.score).toBe(0);
	});

	it("partial overlap gives intermediate score", () => {
		const result = ScoringAlgorithms.jaccardSimilarity("a b c", "a b d");
		// intersection={a,b}, union={a,b,c,d} → 2/4 = 0.5 → 50
		expect(result.score).toBe(50);
	});

	it("handles empty inputs", () => {
		const result = ScoringAlgorithms.jaccardSimilarity("", "hello");
		expect(result.score).toBe(0);
	});

	it("includes intersection and union sizes in metrics", () => {
		const result = ScoringAlgorithms.jaccardSimilarity("a b c", "a b d");
		expect(result.details.metrics.intersectionSize).toBe(2);
		expect(result.details.metrics.unionSize).toBe(4);
	});
});

// ── bleuScore ─────────────────────────────────────────────────────────────────

describe("ScoringAlgorithms.bleuScore", () => {
	it("returns high score for identical text", () => {
		const result = ScoringAlgorithms.bleuScore(
			"the cat sat on the mat",
			"the cat sat on the mat",
		);
		expect(result.score).toBeGreaterThan(80);
		expect(result.details.algorithm).toBe("bleu");
	});

	it("returns score=0 for empty reference", () => {
		const result = ScoringAlgorithms.bleuScore("", "candidate text");
		expect(result.score).toBe(0);
	});

	it("returns score=0 for empty candidate", () => {
		const result = ScoringAlgorithms.bleuScore("reference text", "");
		expect(result.score).toBe(0);
	});

	it("higher n-gram match → higher score", () => {
		const good = ScoringAlgorithms.bleuScore(
			"the quick brown fox",
			"the quick brown fox",
		);
		const bad = ScoringAlgorithms.bleuScore(
			"the quick brown fox",
			"a slow red cat",
		);
		expect(good.score).toBeGreaterThan(bad.score);
	});

	it("includes precision metrics", () => {
		const result = ScoringAlgorithms.bleuScore("hello world", "hello world");
		expect(result.details.metrics.precision_1).toBeGreaterThan(0);
	});
});

// ── combinedScore ─────────────────────────────────────────────────────────────

describe("ScoringAlgorithms.combinedScore", () => {
	it("returns high score for identical text", () => {
		const result = ScoringAlgorithms.combinedScore(
			"hello world",
			"hello world",
		);
		expect(result.score).toBeGreaterThan(80);
		expect(result.details.algorithm).toBe("combined");
	});

	it("score is in 0-100 range", () => {
		const result = ScoringAlgorithms.combinedScore(
			"foo bar baz",
			"different text entirely",
		);
		expect(result.score).toBeGreaterThanOrEqual(0);
		expect(result.score).toBeLessThanOrEqual(100);
	});

	it("accepts custom weights", () => {
		const result = ScoringAlgorithms.combinedScore(
			"hello world",
			"hello world",
			{
				weights: { semantic: 1, syntactic: 0, length: 0 },
			},
		);
		expect(result.score).toBeGreaterThan(0);
		expect(result.details.metrics.weight_semantic).toBe(1);
	});

	it("includes all sub-algorithm metrics", () => {
		const result = ScoringAlgorithms.combinedScore("test text", "test text");
		expect(result.details.metrics.cosine).toBeDefined();
		expect(result.details.metrics.levenshtein).toBeDefined();
		expect(result.details.metrics.jaccard).toBeDefined();
	});
});

// ── batchScore ────────────────────────────────────────────────────────────────

describe("ScoringAlgorithms.batchScore", () => {
	it("returns one result per pair", () => {
		const pairs = [
			{ text1: "hello", text2: "hello" },
			{ text1: "foo", text2: "bar" },
		];
		const results = ScoringAlgorithms.batchScore(pairs);
		expect(results).toHaveLength(2);
	});

	it("handles empty batch", () => {
		const results = ScoringAlgorithms.batchScore([]);
		expect(results).toHaveLength(0);
	});

	it("identical pairs score higher than disjoint pairs", () => {
		const pairs = [
			{ text1: "hello world", text2: "hello world" },
			{ text1: "alpha beta", text2: "gamma delta" },
		];
		const results = ScoringAlgorithms.batchScore(pairs);
		expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
	});
});

// ── getRecommendation ─────────────────────────────────────────────────────────

describe("ScoringAlgorithms.getRecommendation", () => {
	it("returns a recommendation object", () => {
		const rec = ScoringAlgorithms.getRecommendation(
			"hello world",
			"hello world",
		);
		expect(rec).toBeDefined();
		expect(typeof rec).toBe("object");
	});

	it("does not throw for empty inputs", () => {
		expect(() => ScoringAlgorithms.getRecommendation("", "")).not.toThrow();
	});
});

// ── Convenience functions ─────────────────────────────────────────────────────

describe("scoreText (convenience)", () => {
	it("delegates to combinedScore by default", () => {
		const result = scoreText("hello world", "hello world");
		expect(result.score).toBeGreaterThan(0);
	});

	it("passes options through to combinedScore", () => {
		const result = scoreText("hello world", "hello world", {
			weights: { semantic: 1, syntactic: 0, length: 0 },
		});
		expect(result.details.algorithm).toBe("combined");
		expect(result.details.metrics.weight_semantic).toBe(1);
	});
});

describe("compareTexts (convenience)", () => {
	it("returns one result per pair", () => {
		const results = compareTexts([
			{ text1: "a", text2: "a" },
			{ text1: "b", text2: "c" },
		]);
		expect(results).toHaveLength(2);
	});
});

describe("getScoringRecommendation (convenience)", () => {
	it("returns a recommendation for two texts", () => {
		const rec = getScoringRecommendation("The sky is blue", "The sky is blue");
		expect(rec).toBeDefined();
	});
});
