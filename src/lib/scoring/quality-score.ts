/**
 * Quality Score — the flagship metric.
 *
 * A single 0-100 number per evaluation run capturing:
 * pass rate, safety, judge quality, schema compliance, latency, cost.
 */

export type ScoreInputs = {
  total: number;
  passed: number;
  safetyPassRate?: number; // 0..1
  safetyFromProxy?: boolean; // true when using keyword proxy instead of assertions
  traceCoverageRate?: number; // 0..1 for trace-linked runs
  hasProvenance?: boolean; // false when trace-linked but no cost records (model/provider not captured)
  judgeAvg?: number; // 0..1
  schemaPassRate?: number; // 0..1
  avgLatencyMs?: number;
  avgCostUsd?: number;
  budgetUsd?: number;
};

export interface ScoreBreakdown {
  passRate: number;
  safety: number;
  judge: number;
  schema: number;
  latency: number;
  cost: number;
}

export type EvidenceLevel = "strong" | "medium" | "weak";

export interface QualityScoreResult {
  score: number; // 0-100
  breakdown: ScoreBreakdown;
  flags: string[];
  evidenceLevel: EvidenceLevel;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function computeQualityScore(i: ScoreInputs): QualityScoreResult {
  const passRate = clamp01(i.total ? i.passed / i.total : 0);

  const safety = clamp01(i.safetyPassRate ?? passRate);
  const judge = clamp01(i.judgeAvg ?? passRate);
  const schema = clamp01(i.schemaPassRate ?? passRate);

  const latencyScore =
    i.avgLatencyMs == null
      ? 1
      : i.avgLatencyMs <= 1500
        ? 1
        : i.avgLatencyMs >= 8000
          ? 0
          : 1 - (i.avgLatencyMs - 1500) / (8000 - 1500);

  const costScore =
    i.avgCostUsd == null || i.budgetUsd == null
      ? 1
      : i.avgCostUsd <= i.budgetUsd
        ? 1
        : Math.max(0, 1 - (i.avgCostUsd - i.budgetUsd) / i.budgetUsd);

  const breakdown: ScoreBreakdown = {
    passRate,
    safety,
    judge,
    schema,
    latency: clamp01(latencyScore),
    cost: clamp01(costScore),
  };

  // Weights: 50% pass rate, 25% safety, 15% (60% judge + 40% schema), 10% (60% latency + 40% cost)
  const score01 =
    0.5 * breakdown.passRate +
    0.25 * breakdown.safety +
    0.15 * (0.6 * breakdown.judge + 0.4 * breakdown.schema) +
    0.1 * (0.6 * breakdown.latency + 0.4 * breakdown.cost);

  const flags: string[] = [];
  if (breakdown.safety < 0.95) flags.push("SAFETY_RISK");
  if (breakdown.passRate < 0.9) flags.push("LOW_PASS_RATE");
  if (breakdown.latency < 0.5) flags.push("LATENCY_RISK");
  if (breakdown.cost < 0.5) flags.push("COST_RISK");

  // Evidence-level flags and completeness
  const hasJudge = i.judgeAvg != null;
  const hasSafety = i.safetyPassRate != null;
  const n = i.total;
  if (!hasJudge) flags.push("MISSING_JUDGE");
  if (!hasSafety) flags.push("MISSING_SAFETY");
  if (n < 10) flags.push("LOW_N");
  if (i.safetyFromProxy) flags.push("SAFETY_WEAK_EVIDENCE");
  if (i.traceCoverageRate != null && i.traceCoverageRate < 0.8) flags.push("TRACE_COVERAGE_LOW");
  if (i.traceCoverageRate != null && !i.hasProvenance) flags.push("MISSING_PROVENANCE");

  // Evidence level: strong (all key metrics + N>=10), medium (some metrics + N>=5), weak
  let evidenceLevel: EvidenceLevel;
  if (hasJudge && hasSafety && n >= 10) {
    evidenceLevel = "strong";
  } else if ((hasJudge || hasSafety) && n >= 5) {
    evidenceLevel = "medium";
  } else {
    evidenceLevel = "weak";
  }

  return {
    score: Math.round(clamp01(score01) * 100),
    breakdown,
    flags,
    evidenceLevel,
  };
}
