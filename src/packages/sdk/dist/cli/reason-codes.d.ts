/**
 * Canonical reason codes for gate evaluation.
 * Used by gate.ts and formatters for consistent failure classification.
 */
export declare const REASON_CODES: {
    readonly PASS: "PASS";
    readonly WARN_REGRESSION: "WARN_REGRESSION";
    readonly LOW_SAMPLE_SIZE: "LOW_SAMPLE_SIZE";
    readonly JUDGE_ALIGNMENT_MISSING: "JUDGE_ALIGNMENT_MISSING";
    readonly JUDGE_ALIGNMENT_LOW: "JUDGE_ALIGNMENT_LOW";
    readonly JUDGE_CREDIBILITY_UNTRUSTWORTHY: "JUDGE_CREDIBILITY_UNTRUSTWORTHY";
    readonly BASELINE_MISSING: "BASELINE_MISSING";
    readonly SCORE_TOO_LOW: "SCORE_TOO_LOW";
    readonly DELTA_TOO_HIGH: "DELTA_TOO_HIGH";
    readonly COST_BUDGET_EXCEEDED: "COST_BUDGET_EXCEEDED";
    readonly LATENCY_BUDGET_EXCEEDED: "LATENCY_BUDGET_EXCEEDED";
    readonly POLICY_FAILED: "POLICY_FAILED";
    readonly UNKNOWN: "UNKNOWN";
};
export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];
