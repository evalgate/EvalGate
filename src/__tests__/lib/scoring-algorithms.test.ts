/**
 * ScoringAlgorithms correctness tests (Phase 2)
 *
 * Covers:
 *  - Identical text → score 100 for all algorithms
 *  - Empty input → score 0, no throw
 *  - Levenshtein: known edit distances
 *  - Jaccard: known intersection/union ratios
 *  - BLEU: identical → 100, disjoint → 0
 *  - Combined: score in 0–100 range
 *  - batchScore: returns one result per pair
 *  - Determinism: same inputs → same outputs
 */

import { describe, expect, it } from "vitest";
import { ScoringAlgorithms } from "@/lib/scoring/algorithms";

describe("ScoringAlgorithms", () => {
  describe("cosineSimilarity", () => {
    it("identical text → score 100", () => {
      const r = ScoringAlgorithms.cosineSimilarity("the quick brown fox", "the quick brown fox");
      expect(r.score).toBe(100);
      expect(r.details.algorithm).toBe("cosine");
    });

    it("empty input → score 0, no throw", () => {
      expect(() => ScoringAlgorithms.cosineSimilarity("", "hello")).not.toThrow();
      expect(ScoringAlgorithms.cosineSimilarity("", "hello").score).toBe(0);
      expect(ScoringAlgorithms.cosineSimilarity("hello", "").score).toBe(0);
      expect(ScoringAlgorithms.cosineSimilarity("", "").score).toBe(0);
    });

    it("completely different tokens → low score", () => {
      const r = ScoringAlgorithms.cosineSimilarity("apple banana cherry", "dog cat fish");
      expect(r.score).toBeLessThan(20);
    });

    it("score is in 0–100 range", () => {
      const pairs = [
        ["hello world", "hello world"],
        ["foo bar baz", "qux quux corge"],
        ["the quick brown fox", "the slow red fox"],
        ["", ""],
      ];
      for (const [a, b] of pairs) {
        const r = ScoringAlgorithms.cosineSimilarity(a, b);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("levenshteinDistance", () => {
    it("identical text → score 100", () => {
      const r = ScoringAlgorithms.levenshteinDistance("kitten", "kitten");
      expect(r.score).toBe(100);
      expect(r.details.algorithm).toBe("levenshtein");
    });

    it("empty input → score 0, no throw", () => {
      expect(() => ScoringAlgorithms.levenshteinDistance("", "hello")).not.toThrow();
      expect(ScoringAlgorithms.levenshteinDistance("", "hello").score).toBe(0);
    });

    it("single substitution: kitten→sitten → distance 1", () => {
      const r = ScoringAlgorithms.levenshteinDistance("kitten", "sitten");
      // distance=1, maxLength=6, similarity=5/6≈0.833 → score=83
      expect(r.details.metrics.distance).toBe(1);
      expect(r.score).toBe(83);
    });

    it("completely different strings → low score", () => {
      const r = ScoringAlgorithms.levenshteinDistance("abc", "xyz");
      expect(r.score).toBeLessThan(50);
    });

    it("confidence is always 1 (deterministic algorithm)", () => {
      const r = ScoringAlgorithms.levenshteinDistance("hello", "world");
      expect(r.confidence).toBe(1);
    });
  });

  describe("jaccardSimilarity", () => {
    it("identical text → score 100", () => {
      const r = ScoringAlgorithms.jaccardSimilarity("the cat sat", "the cat sat");
      expect(r.score).toBe(100);
      expect(r.details.algorithm).toBe("jaccard");
    });

    it("empty input → score 0, no throw", () => {
      expect(() => ScoringAlgorithms.jaccardSimilarity("", "hello")).not.toThrow();
      expect(ScoringAlgorithms.jaccardSimilarity("", "hello").score).toBe(0);
    });

    it("disjoint token sets → score 0", () => {
      const r = ScoringAlgorithms.jaccardSimilarity("apple banana", "cherry date");
      expect(r.score).toBe(0);
      expect(r.details.metrics.intersectionSize).toBe(0);
    });

    it("50% overlap → score ~33 (|A∩B|/|A∪B|)", () => {
      // A={a,b}, B={b,c} → intersection={b}, union={a,b,c} → 1/3 ≈ 33
      const r = ScoringAlgorithms.jaccardSimilarity("a b", "b c");
      expect(r.score).toBeCloseTo(33, 0);
    });
  });

  describe("bleuScore", () => {
    it("identical text → score 100", () => {
      const r = ScoringAlgorithms.bleuScore("the quick brown fox", "the quick brown fox");
      expect(r.score).toBe(100);
      expect(r.details.algorithm).toBe("bleu");
    });

    it("empty input → score 0, no throw", () => {
      expect(() => ScoringAlgorithms.bleuScore("", "hello")).not.toThrow();
      expect(ScoringAlgorithms.bleuScore("", "hello").score).toBe(0);
      expect(ScoringAlgorithms.bleuScore("hello", "").score).toBe(0);
    });

    it("completely disjoint tokens → score 0", () => {
      const r = ScoringAlgorithms.bleuScore("apple banana cherry", "dog cat fish");
      expect(r.score).toBe(0);
    });

    it("score is in 0–100 range", () => {
      const r = ScoringAlgorithms.bleuScore("the quick brown fox", "the slow red fox");
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });

  describe("combinedScore", () => {
    it("identical text → score 100", () => {
      const r = ScoringAlgorithms.combinedScore("hello world", "hello world");
      expect(r.score).toBe(100);
      expect(r.details.algorithm).toBe("combined");
    });

    it("empty input → score 0, no throw", () => {
      expect(() => ScoringAlgorithms.combinedScore("", "hello")).not.toThrow();
      expect(ScoringAlgorithms.combinedScore("", "hello").score).toBe(0);
    });

    it("score is always in 0–100 range", () => {
      const pairs = [
        ["hello world", "hello world"],
        ["foo bar baz", "qux quux corge"],
        ["the quick brown fox", "the slow red fox"],
        ["a", "z"],
        ["", ""],
      ];
      for (const [a, b] of pairs) {
        const r = ScoringAlgorithms.combinedScore(a, b);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });

    it("custom weights are respected (weights sum to 1.0)", () => {
      const r = ScoringAlgorithms.combinedScore("hello world", "hello world", {
        weights: { semantic: 0.5, syntactic: 0.3, length: 0.2 },
      });
      expect(r.score).toBe(100);
    });
  });

  describe("batchScore", () => {
    it("returns one result per pair", () => {
      const pairs = [
        { text1: "hello", text2: "hello" },
        { text1: "foo", text2: "bar" },
        { text1: "the quick brown fox", text2: "the slow red fox" },
      ];
      const results = ScoringAlgorithms.batchScore(pairs);
      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });

    it("respects algorithm option", () => {
      const pairs = [{ text1: "kitten", text2: "kitten" }];
      const r = ScoringAlgorithms.batchScore(pairs, { algorithm: "levenshtein" });
      expect(r[0].details.algorithm).toBe("levenshtein");
    });

    it("empty pairs array → empty results", () => {
      expect(ScoringAlgorithms.batchScore([])).toEqual([]);
    });
  });

  describe("determinism", () => {
    it("all algorithms produce identical output on repeated calls", () => {
      const pairs: Array<[string, string]> = [
        ["the quick brown fox", "the quick brown fox"],
        ["hello world", "goodbye world"],
        ["apple banana cherry", "cherry banana apple"],
        ["", ""],
        ["a", "z"],
      ];

      for (const [a, b] of pairs) {
        expect(ScoringAlgorithms.cosineSimilarity(a, b).score).toBe(
          ScoringAlgorithms.cosineSimilarity(a, b).score,
        );
        expect(ScoringAlgorithms.levenshteinDistance(a, b).score).toBe(
          ScoringAlgorithms.levenshteinDistance(a, b).score,
        );
        expect(ScoringAlgorithms.jaccardSimilarity(a, b).score).toBe(
          ScoringAlgorithms.jaccardSimilarity(a, b).score,
        );
        expect(ScoringAlgorithms.bleuScore(a, b).score).toBe(
          ScoringAlgorithms.bleuScore(a, b).score,
        );
        expect(ScoringAlgorithms.combinedScore(a, b).score).toBe(
          ScoringAlgorithms.combinedScore(a, b).score,
        );
      }
    });
  });
});
