import { describe, expect, it } from "vitest";
import { computeQualityScore } from "@/lib/scoring/quality-score";

describe("computeQualityScore", () => {
  it("perfect inputs → score 100, no flags, strong evidence", () => {
    const result = computeQualityScore({
      total: 100,
      passed: 100,
      safetyPassRate: 1.0,
      safetyFromProxy: false,
      traceCoverageRate: 0.9,
      hasProvenance: true,
      judgeAvg: 0.95,
      schemaPassRate: 1.0,
      avgLatencyMs: 1000,
      avgCostUsd: 0.01,
      budgetUsd: 0.05,
    });

    expect(result.score).toBe(100);
    expect(result.flags).toEqual([]);
    expect(result.evidenceLevel).toBe("strong");
    expect(result.breakdown.passRate).toBe(1);
    expect(result.breakdown.safety).toBe(1);
    expect(result.breakdown.judge).toBe(0.95);
    expect(result.breakdown.schema).toBe(1);
    expect(result.breakdown.latency).toBe(1);
    expect(result.breakdown.cost).toBe(1);
  });

  it("all zeros → low score, flags include LOW_PASS_RATE + LOW_N", () => {
    const result = computeQualityScore({
      total: 0,
      passed: 0,
    });

    // passRate=0, safety/judge/schema default to passRate=0, latency/cost default to 1
    // score = 0.5*0 + 0.25*0 + 0.15*(0.6*0+0.4*0) + 0.1*(0.6*1+0.4*1) = 0.1 → 10
    expect(result.score).toBe(10);
    expect(result.flags).toContain("LOW_PASS_RATE");
    expect(result.flags).toContain("LOW_N");
    expect(result.evidenceLevel).toBe("weak");
  });

  it("missing safety/judge → weak evidence, MISSING_JUDGE + MISSING_SAFETY flags", () => {
    const result = computeQualityScore({
      total: 20,
      passed: 18,
      // safetyPassRate missing
      // judgeAvg missing
    });

    expect(result.flags).toContain("MISSING_SAFETY");
    expect(result.flags).toContain("MISSING_JUDGE");
    // medium requires (hasJudge || hasSafety) — both missing → weak
    expect(result.evidenceLevel).toBe("weak");
  });

  it("latency edge cases: 1500ms → score 1.0, 8000ms → 0.0, midpoint → ~0.5", () => {
    // At 1500ms, latency score should be 1.0
    const fastResult = computeQualityScore({
      total: 10,
      passed: 10,
      avgLatencyMs: 1500,
    });
    expect(fastResult.breakdown.latency).toBe(1);

    // At 8000ms, latency score should be 0.0
    const slowResult = computeQualityScore({
      total: 10,
      passed: 10,
      avgLatencyMs: 8000,
    });
    expect(slowResult.breakdown.latency).toBe(0);

    // At midpoint (4750ms), should be ~0.5
    const midResult = computeQualityScore({
      total: 10,
      passed: 10,
      avgLatencyMs: 4750,
    });
    expect(midResult.breakdown.latency).toBeCloseTo(0.5, 1);
  });

  it("cost over budget → COST_RISK flag, score decays proportionally", () => {
    const result = computeQualityScore({
      total: 10,
      passed: 10,
      avgCostUsd: 0.1, // Over budget
      budgetUsd: 0.05,
    });

    expect(result.flags).toContain("COST_RISK");
    expect(result.breakdown.cost).toBeLessThan(1);
    expect(result.breakdown.cost).toBeCloseTo(0, 1); // 2x over budget → 0 score
  });

  it("trace coverage < 0.8 → TRACE_COVERAGE_LOW flag", () => {
    const result = computeQualityScore({
      total: 10,
      passed: 10,
      traceCoverageRate: 0.7, // Below 0.8 threshold
      hasProvenance: true,
    });

    expect(result.flags).toContain("TRACE_COVERAGE_LOW");
  });

  it("trace coverage missing provenance → MISSING_PROVENANCE flag", () => {
    const result = computeQualityScore({
      total: 10,
      passed: 10,
      traceCoverageRate: 0.9,
      hasProvenance: false,
    });

    expect(result.flags).toContain("MISSING_PROVENANCE");
  });

  it("safety from proxy → SAFETY_WEAK_EVIDENCE flag", () => {
    const result = computeQualityScore({
      total: 10,
      passed: 10,
      safetyPassRate: 0.9,
      safetyFromProxy: true,
    });

    expect(result.flags).toContain("SAFETY_WEAK_EVIDENCE");
  });

  it("evidence levels: strong (judge+safety+N≥10)", () => {
    const result = computeQualityScore({
      total: 15, // N >= 10
      passed: 15,
      safetyPassRate: 0.9,
      judgeAvg: 0.8,
    });

    expect(result.evidenceLevel).toBe("strong");
  });

  it("evidence levels: medium (one metric+N≥5)", () => {
    const result = computeQualityScore({
      total: 8, // N >= 5
      passed: 8,
      safetyPassRate: 0.9,
      // judgeAvg missing
    });

    expect(result.evidenceLevel).toBe("medium");
  });

  it("evidence levels: weak (N<5 or no metrics)", () => {
    const result = computeQualityScore({
      total: 3, // N < 5
      passed: 3,
    });

    expect(result.evidenceLevel).toBe("weak");
  });

  it("latency risk flag when latency < 0.5", () => {
    const result = computeQualityScore({
      total: 10,
      passed: 10,
      avgLatencyMs: 6000, // High latency
    });

    expect(result.flags).toContain("LATENCY_RISK");
  });

  it("pass rate risk flag when < 0.9", () => {
    const result = computeQualityScore({
      total: 10,
      passed: 8, // 80% pass rate
    });

    expect(result.flags).toContain("LOW_PASS_RATE");
  });

  it("safetyPassRate=0 with total>0 → SAFETY_RISK flag and score impact", () => {
    const result = computeQualityScore({
      total: 20,
      passed: 20,
      safetyPassRate: 0,
      safetyFromProxy: false,
    });

    expect(result.flags).toContain("SAFETY_RISK");
    // Safety component is 0 — overall score must be below 100
    expect(result.score).toBeLessThan(100);
    expect(result.breakdown.safety).toBe(0);
  });

  it("budgetUsd=0 does not throw (division by zero guard)", () => {
    expect(() =>
      computeQualityScore({
        total: 10,
        passed: 10,
        avgCostUsd: 0.001,
        budgetUsd: 0,
      }),
    ).not.toThrow();
  });

  it("passed > total clamps passRate to 1.0 (defensive)", () => {
    const result = computeQualityScore({
      total: 5,
      passed: 10, // impossible but should not produce score > 100
    });

    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.passRate).toBeLessThanOrEqual(1);
  });

  it("score stays in 0–100 range when all flags present simultaneously", () => {
    const result = computeQualityScore({
      total: 2, // LOW_N
      passed: 1, // LOW_PASS_RATE
      safetyPassRate: 0, // SAFETY_RISK
      safetyFromProxy: true, // SAFETY_WEAK_EVIDENCE
      judgeAvg: undefined, // MISSING_JUDGE
      traceCoverageRate: 0.5, // TRACE_COVERAGE_LOW
      hasProvenance: false, // MISSING_PROVENANCE
      avgLatencyMs: 9000, // LATENCY_RISK
      avgCostUsd: 1.0,
      budgetUsd: 0.01, // COST_RISK
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("evidenceLevel boundary: N=5 with one metric → medium", () => {
    const result = computeQualityScore({
      total: 5,
      passed: 5,
      safetyPassRate: 0.9, // has safety metric
      // no judgeAvg
    });

    expect(result.evidenceLevel).toBe("medium");
  });

  it("evidenceLevel boundary: N=4 with one metric → weak (N < 5)", () => {
    const result = computeQualityScore({
      total: 4,
      passed: 4,
      safetyPassRate: 0.9,
    });

    expect(result.evidenceLevel).toBe("weak");
  });

  it("evidenceLevel boundary: N=10 with both judge+safety → strong", () => {
    const result = computeQualityScore({
      total: 10,
      passed: 10,
      safetyPassRate: 0.9,
      judgeAvg: 0.85,
    });

    expect(result.evidenceLevel).toBe("strong");
  });

  it("evidenceLevel boundary: N=9 with both metrics → medium (N < 10)", () => {
    const result = computeQualityScore({
      total: 9,
      passed: 9,
      safetyPassRate: 0.9,
      judgeAvg: 0.85,
    });

    expect(result.evidenceLevel).toBe("medium");
  });

  it("computeQualityScore is deterministic: same inputs → same outputs", () => {
    const inputs = [
      { total: 50, passed: 45, safetyPassRate: 0.9, judgeAvg: 0.8, avgLatencyMs: 2000 },
      { total: 0, passed: 0 },
      { total: 10, passed: 10, avgCostUsd: 0.1, budgetUsd: 0.05 },
      { total: 100, passed: 100, safetyPassRate: 1, judgeAvg: 0.95, schemaPassRate: 1 },
      { total: 5, passed: 3, safetyPassRate: 0, traceCoverageRate: 0.6, hasProvenance: false },
    ];

    for (const input of inputs) {
      const r1 = computeQualityScore(input);
      const r2 = computeQualityScore(input);
      expect(r1.score).toBe(r2.score);
      expect(r1.flags).toEqual(r2.flags);
      expect(r1.evidenceLevel).toBe(r2.evidenceLevel);
    }
  });
});
