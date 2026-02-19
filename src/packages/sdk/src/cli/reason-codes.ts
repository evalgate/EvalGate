/**
 * Canonical reason codes for gate evaluation.
 * Used by gate.ts and formatters for consistent failure classification.
 */
export const REASON_CODES = {
  PASS: "PASS",
  LOW_SAMPLE_SIZE: "LOW_SAMPLE_SIZE",
  BASELINE_MISSING: "BASELINE_MISSING",
  SCORE_TOO_LOW: "SCORE_TOO_LOW",
  DELTA_TOO_HIGH: "DELTA_TOO_HIGH",
  COST_BUDGET_EXCEEDED: "COST_BUDGET_EXCEEDED",
  LATENCY_BUDGET_EXCEEDED: "LATENCY_BUDGET_EXCEEDED",
  POLICY_FAILED: "POLICY_FAILED",
  UNKNOWN: "UNKNOWN",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];
