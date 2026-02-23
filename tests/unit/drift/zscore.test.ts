import { describe, expect, it } from "vitest";
import { meanAndStd, zScore } from "@/lib/drift/zscore";

describe("zScore", () => {
  // Happy path tests
  it("should calculate positive z-score for values above mean", () => {
    expect(zScore(15, 10, 2)).toBe(2.5);
    expect(zScore(100, 50, 10)).toBe(5);
  });

  it("should calculate negative z-score for values below mean", () => {
    expect(zScore(5, 10, 2)).toBe(-2.5);
    expect(zScore(0, 50, 10)).toBe(-5);
  });

  it("should return zero for values equal to mean", () => {
    expect(zScore(10, 10, 2)).toBe(0);
    expect(zScore(50, 50, 10)).toBe(0);
  });

  // Edge case tests
  it("should return zero when standard deviation is zero", () => {
    expect(zScore(15, 10, 0)).toBe(0);
    expect(zScore(0, 0, 0)).toBe(0);
    expect(zScore(-5, -10, 0)).toBe(0);
  });

  it("should handle negative values", () => {
    expect(zScore(-5, -10, 2)).toBe(2.5);
    expect(zScore(-15, -10, 2)).toBe(-2.5);
  });

  it("should handle decimal values", () => {
    expect(zScore(10.5, 10, 0.5)).toBe(1);
    expect(zScore(9.75, 10, 0.5)).toBe(-0.5);
  });

  it("should handle very small standard deviations", () => {
    expect(zScore(10.1, 10, 0.01)).toBeCloseTo(10, 10);
    expect(zScore(9.99, 10, 0.01)).toBeCloseTo(-1, 10);
  });
});

describe("meanAndStd", () => {
  // Happy path tests
  it("should calculate mean and standard deviation correctly", () => {
    const result = meanAndStd([1, 2, 3, 4, 5]);
    expect(result.mean).toBe(3);
    expect(result.std).toBeCloseTo(Math.sqrt(2), 5);
  });

  it("should handle single value array", () => {
    const result = meanAndStd([42]);
    expect(result.mean).toBe(42);
    expect(result.std).toBe(0);
  });

  it("should handle identical values", () => {
    const result = meanAndStd([5, 5, 5, 5]);
    expect(result.mean).toBe(5);
    expect(result.std).toBe(0);
  });

  it("should handle negative values", () => {
    const result = meanAndStd([-1, -2, -3, -4, -5]);
    expect(result.mean).toBe(-3);
    expect(result.std).toBeCloseTo(Math.sqrt(2), 5);
  });

  it("should handle mixed positive and negative values", () => {
    const result = meanAndStd([-2, 0, 2]);
    expect(result.mean).toBe(0);
    expect(result.std).toBeCloseTo(Math.sqrt(8 / 3), 5);
  });

  // Edge case tests
  it("should return zeros for empty array", () => {
    const result = meanAndStd([]);
    expect(result.mean).toBe(0);
    expect(result.std).toBe(0);
  });

  it("should handle decimal values", () => {
    const result = meanAndStd([1.5, 2.5, 3.5]);
    expect(result.mean).toBe(2.5);
    expect(result.std).toBeCloseTo(Math.sqrt(2 / 3), 5);
  });

  it("should handle large numbers", () => {
    const result = meanAndStd([1000, 2000, 3000]);
    expect(result.mean).toBe(2000);
    expect(result.std).toBeCloseTo(Math.sqrt(2000000 / 3), 5);
  });

  it("should handle very small numbers", () => {
    const result = meanAndStd([0.001, 0.002, 0.003]);
    expect(result.mean).toBe(0.002);
    expect(result.std).toBeCloseTo(Math.sqrt(0.000002 / 3), 10);
  });

  // Mathematical property tests
  it("should satisfy standard deviation properties", () => {
    const values = [1, 2, 3, 4, 5];
    const result = meanAndStd(values);

    // All values should be within 3 standard deviations of mean
    values.forEach((value) => {
      const z = Math.abs(zScore(value, result.mean, result.std));
      expect(z).toBeLessThanOrEqual(3);
    });
  });

  it("should handle array with two values", () => {
    const result = meanAndStd([0, 10]);
    expect(result.mean).toBe(5);
    expect(result.std).toBe(5);
  });

  it("should handle symmetric distribution", () => {
    const result = meanAndStd([-3, -1, 1, 3]);
    expect(result.mean).toBe(0);
    expect(result.std).toBeCloseTo(Math.sqrt(5), 5);
  });
});
