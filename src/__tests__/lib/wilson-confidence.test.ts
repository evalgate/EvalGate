/**
 * wilsonConfidence + addConfidenceBands correctness tests (Phase 2)
 *
 * Covers:
 *  - total=0 → lower=0, upper=1 (uninformative prior)
 *  - all passed → upper close to 1
 *  - all failed → lower close to 0
 *  - 50% pass rate → symmetric interval
 *  - bounds always in [0, 1]
 *  - addConfidenceBands: passthrough + confidence attached
 *  - determinism
 */

import { describe, expect, it } from "vitest";
import { addConfidenceBands, wilsonConfidence } from "@/lib/services/aggregate-metrics.service";

describe("wilsonConfidence", () => {
  it("total=0 → { lower: 0, upper: 1, sampleSize: 0 }", () => {
    const r = wilsonConfidence(0, 0);
    expect(r).toEqual({ lower: 0, upper: 1, sampleSize: 0 });
  });

  it("all passed (100/100) → lower > 0.9, upper ≤ 1", () => {
    const r = wilsonConfidence(100, 100);
    expect(r.lower).toBeGreaterThan(0.9);
    expect(r.upper).toBeLessThanOrEqual(1);
    expect(r.sampleSize).toBe(100);
  });

  it("all failed (0/100) → lower ≥ 0, upper < 0.1", () => {
    const r = wilsonConfidence(0, 100);
    expect(r.lower).toBeGreaterThanOrEqual(0);
    expect(r.upper).toBeLessThan(0.1);
  });

  it("50% pass rate (50/100) → interval is symmetric around 0.5", () => {
    const r = wilsonConfidence(50, 100);
    // Wilson CI for p=0.5, n=100 is approximately [0.40, 0.60]
    expect(r.lower).toBeCloseTo(0.5 - (r.upper - r.lower) / 2, 1);
    expect(r.upper).toBeGreaterThan(0.4);
    expect(r.lower).toBeLessThan(0.6);
  });

  it("bounds are always in [0, 1] for any inputs", () => {
    const cases: Array<[number, number]> = [
      [0, 1],
      [1, 1],
      [0, 10],
      [10, 10],
      [5, 10],
      [1, 1000],
      [999, 1000],
      [500, 1000],
    ];
    for (const [passed, total] of cases) {
      const r = wilsonConfidence(passed, total);
      expect(r.lower).toBeGreaterThanOrEqual(0);
      expect(r.upper).toBeLessThanOrEqual(1);
      expect(r.lower).toBeLessThanOrEqual(r.upper);
    }
  });

  it("larger sample → narrower interval (more confidence)", () => {
    const small = wilsonConfidence(5, 10); // 50%, n=10
    const large = wilsonConfidence(50, 100); // 50%, n=100
    const widthSmall = small.upper - small.lower;
    const widthLarge = large.upper - large.lower;
    expect(widthLarge).toBeLessThan(widthSmall);
  });

  it("sampleSize matches total", () => {
    expect(wilsonConfidence(7, 20).sampleSize).toBe(20);
    expect(wilsonConfidence(0, 0).sampleSize).toBe(0);
  });

  it("is deterministic: same inputs → same outputs", () => {
    const inputs: Array<[number, number]> = [
      [50, 100],
      [0, 0],
      [1, 1],
      [999, 1000],
    ];
    for (const [p, t] of inputs) {
      const r1 = wilsonConfidence(p, t);
      const r2 = wilsonConfidence(p, t);
      expect(r1.lower).toBe(r2.lower);
      expect(r1.upper).toBe(r2.upper);
    }
  });
});

describe("addConfidenceBands", () => {
  it("returns same length as input", () => {
    const data = [
      { score: 80, passRate: 0.8, total: 100 },
      { score: 60, passRate: 0.6, total: 50 },
    ];
    const result = addConfidenceBands(data);
    expect(result).toHaveLength(2);
  });

  it("preserves original fields", () => {
    const data = [{ score: 75, passRate: 0.75, total: 40 }];
    const [r] = addConfidenceBands(data);
    expect(r.score).toBe(75);
    expect(r.passRate).toBe(0.75);
    expect(r.total).toBe(40);
  });

  it("attaches confidence band with valid bounds", () => {
    const data = [{ score: 90, passRate: 0.9, total: 200 }];
    const [r] = addConfidenceBands(data);
    expect(r.confidence).toBeDefined();
    expect(r.confidence.lower).toBeGreaterThanOrEqual(0);
    expect(r.confidence.upper).toBeLessThanOrEqual(1);
    expect(r.confidence.sampleSize).toBe(200);
  });

  it("empty array → empty result", () => {
    expect(addConfidenceBands([])).toEqual([]);
  });

  it("total=0 entry → uninformative band { lower: 0, upper: 1 }", () => {
    const data = [{ score: 0, passRate: 0, total: 0 }];
    const [r] = addConfidenceBands(data);
    expect(r.confidence.lower).toBe(0);
    expect(r.confidence.upper).toBe(1);
  });
});
