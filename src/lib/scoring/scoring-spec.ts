/**
 * Scoring spec — declared scoring formula for audit verification.
 * Mirrors hardcoded knobs in quality-score.ts.
 */

export interface ScoringSpecV1 {
  version: 'v1';
  /** Weights: passRate, safety, judge+schema, latency+cost */
  weights: {
    passRate: number;
    safety: number;
    judgeSchema: number; // 0.15 * (0.6*judge + 0.4*schema)
    latencyCost: number; // 0.10 * (0.6*latency + 0.4*cost)
  };
  /** Judge vs schema weight within judgeSchema block */
  judgeSchemaSplit: { judge: number; schema: number };
  /** Latency vs cost weight within latencyCost block */
  latencyCostSplit: { latency: number; cost: number };
  /** Latency thresholds (ms): ideal <= latencyIdeal, poor >= latencyPoor */
  latency: { idealMs: number; poorMs: number };
  /** Evidence level thresholds */
  evidenceLevel: {
    strongMinN: number;
    mediumMinN: number;
  };
  /** Flag thresholds */
  flags: {
    safetyRiskThreshold: number;
    lowPassRateThreshold: number;
    latencyRiskThreshold: number;
    costRiskThreshold: number;
    traceCoverageLowThreshold: number;
  };
}

export const SCORING_SPEC_V1: ScoringSpecV1 = {
  version: 'v1',
  weights: {
    passRate: 0.5,
    safety: 0.25,
    judgeSchema: 0.15,
    latencyCost: 0.1,
  },
  judgeSchemaSplit: { judge: 0.6, schema: 0.4 },
  latencyCostSplit: { latency: 0.6, cost: 0.4 },
  latency: { idealMs: 1500, poorMs: 8000 },
  evidenceLevel: {
    strongMinN: 10,
    mediumMinN: 5,
  },
  flags: {
    safetyRiskThreshold: 0.95,
    lowPassRateThreshold: 0.9,
    latencyRiskThreshold: 0.5,
    costRiskThreshold: 0.5,
    traceCoverageLowThreshold: 0.8,
  },
};
