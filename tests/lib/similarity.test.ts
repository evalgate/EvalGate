import { describe, expect, it } from "vitest";
import {
  combinedScore,
  cosineSimilarity,
  keywordMatchRate,
  levenshteinSimilarity,
} from "@/lib/scoring/similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical strings", () => {
    const result = cosineSimilarity("hello world", "hello world");
    expect(result).toBeCloseTo(1, 5);
  });

  it("returns 0 for completely different strings", () => {
    const result = cosineSimilarity("abc", "xyz");
    expect(result).toBe(0);
  });

  it("returns value between 0 and 1 for partially similar strings", () => {
    const result = cosineSimilarity("hello world", "hello there");
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("handles empty strings", () => {
    expect(cosineSimilarity("", "")).toBe(0);
    expect(cosineSimilarity("hello", "")).toBe(0);
    expect(cosineSimilarity("", "world")).toBe(0);
  });

  it("is case insensitive", () => {
    const result1 = cosineSimilarity("Hello World", "hello world");
    expect(result1).toBeCloseTo(1, 5);
  });

  it("handles repeated words", () => {
    const result = cosineSimilarity("hello hello hello", "hello");
    expect(result).toBeGreaterThan(0);
  });

  it("handles punctuation", () => {
    const result = cosineSimilarity("hello, world!", "hello world");
    expect(result).toBeCloseTo(1, 5);
  });
});

describe("levenshteinSimilarity", () => {
  it("returns 1 for identical strings", () => {
    const result = levenshteinSimilarity("hello", "hello");
    expect(result).toBeCloseTo(1, 5);
  });

  it("returns 0 for completely different strings of same length", () => {
    const result = levenshteinSimilarity("abc", "xyz");
    expect(result).toBe(0);
  });

  it("returns value between 0 and 1 for similar strings", () => {
    const result = levenshteinSimilarity("hello", "hallo");
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
    expect(result).toBe(0.8); // 1 edit out of 5 chars
  });

  it("handles empty strings", () => {
    expect(levenshteinSimilarity("", "")).toBe(1);
    expect(levenshteinSimilarity("hello", "")).toBe(0);
    expect(levenshteinSimilarity("", "world")).toBe(0);
  });

  it("handles insertions", () => {
    const result = levenshteinSimilarity("hello", "helloo");
    expect(result).toBeCloseTo(5 / 6, 2);
  });

  it("handles deletions", () => {
    const result = levenshteinSimilarity("hello", "helo");
    expect(result).toBe(0.8);
  });

  it("handles substitutions", () => {
    const result = levenshteinSimilarity("cat", "bat");
    expect(result).toBeCloseTo(2 / 3, 2);
  });
});

describe("combinedScore", () => {
  it("returns 100 for identical strings", () => {
    const result = combinedScore("hello world", "hello world");
    expect(result).toBeGreaterThanOrEqual(99);
  });

  it("returns 0 for completely different strings", () => {
    const result = combinedScore("abc", "xyz");
    expect(result).toBe(0);
  });

  it("uses default weights (0.6 cosine, 0.4 levenshtein)", () => {
    const result = combinedScore("hello world", "hello there");
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it("accepts custom weights", () => {
    const result1 = combinedScore("hello", "hallo", { cosine: 1, levenshtein: 0 });
    const result2 = combinedScore("hello", "hallo", { cosine: 0, levenshtein: 1 });

    // With only cosine (word-based), "hello" vs "hallo" should be 0 (different words)
    expect(result1).toBe(0);
    // With only levenshtein, should be 80 (1 edit out of 5)
    expect(result2).toBe(80);
  });

  it("rounds to nearest integer", () => {
    const result = combinedScore("test", "testing");
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("keywordMatchRate", () => {
  it("returns 100 when all keywords match", () => {
    const result = keywordMatchRate("hello world testing", "hello world testing here");
    expect(result).toBe(100);
  });

  it("returns 0 when no keywords match", () => {
    const result = keywordMatchRate("hello world testing", "abc xyz");
    expect(result).toBe(0);
  });

  it("returns 100 for empty expected string", () => {
    const result = keywordMatchRate("", "anything here");
    expect(result).toBe(100);
  });

  it("returns 100 when expected has only short words", () => {
    const result = keywordMatchRate("a b c", "xyz");
    expect(result).toBe(100);
  });

  it("filters out words with 3 or fewer characters", () => {
    // "cat" and "sat" are exactly 3 chars, so they're filtered out (>3 required)
    // With no keywords left, returns 100
    const result = keywordMatchRate("the cat sat", "the dog ran");
    expect(result).toBe(100);
  });

  it("is case insensitive", () => {
    const result = keywordMatchRate("HELLO WORLD", "hello world");
    expect(result).toBe(100);
  });

  it("calculates partial match rate correctly", () => {
    const result = keywordMatchRate("hello world testing", "hello something else");
    // Keywords: hello, world, testing (all >3 chars)
    // Only "hello" matches
    expect(result).toBe(33); // 1/3 = 33%
  });

  it("handles substring matches", () => {
    const result = keywordMatchRate("testing", "this is a testing environment");
    expect(result).toBe(100);
  });
});
