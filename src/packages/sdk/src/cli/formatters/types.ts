/**
 * CheckReport and related types for formatters.
 */

export type GateVerdict = "pass" | "fail";

/** "neutral" = exit 0 but gate not applied (e.g. baseline missing with --baseline auto) */
export type GateMode = "enforced" | "neutral";

/** Canonical reason codes. Import REASON_CODES from ../reason-codes for constants. */
export type FailureReasonCode =
  | "PASS"
  | "LOW_SAMPLE_SIZE"
  | "BASELINE_MISSING"
  | "SCORE_TOO_LOW"
  | "DELTA_TOO_HIGH"
  | "COST_BUDGET_EXCEEDED"
  | "LATENCY_BUDGET_EXCEEDED"
  | "POLICY_FAILED"
  | "UNKNOWN"
  /* Legacy aliases for backward compat */
  | "LOW_SCORE"
  | "LOW_PASS_RATE"
  | "SAFETY_RISK"
  | "LATENCY_RISK"
  | "COST_RISK"
  | "MAX_DROP_EXCEEDED"
  | "INSUFFICIENT_EVIDENCE"
  | "POLICY_VIOLATION";

export type ScoreBreakdown01 = {
  passRate?: number;
  safety?: number;
  judge?: number;
  schema?: number;
  latency?: number;
  cost?: number;
};

export type ScoreContribPts = {
  passRatePts?: number;
  safetyPts?: number;
  compliancePts?: number;
  performancePts?: number;
};

export type GateThresholds = {
  minScore?: number;
  minPassRate?: number;
  minSafety?: number;
  maxDrop?: number;
  minN?: number;
  allowWeakEvidence?: boolean;
  baseline?: "published" | "previous" | "production" | "auto";
  maxCostUsd?: number;
  maxLatencyMs?: number;
  maxCostDeltaUsd?: number;
};

export type FailedCase = {
  testCaseId?: number;
  status?: "failed" | "error" | "skipped" | "passed";
  name?: string;
  input?: string;
  inputSnippet?: string;
  expectedOutput?: string;
  expectedSnippet?: string;
  output?: string;
  outputSnippet?: string;
  reason?: string;
};

export type CiContext = {
  provider?: "github" | "gitlab" | "circle" | "unknown";
  repo?: string;
  sha?: string;
  branch?: string;
  pr?: number;
  runUrl?: string;
  actor?: string;
};

export type CheckReport = {
  evaluationId: string;
  runId?: number;
  verdict: GateVerdict;
  /** false when gate not applied (e.g. baseline missing, exit 0) — prevents false confidence */
  gateApplied: boolean;
  /** "enforced" = gate ran; "neutral" = exit 0, gate skipped */
  gateMode: GateMode;
  reasonCode: FailureReasonCode;
  /** Actionable message for PR comment / UX */
  actionableMessage?: string;
  reasonMessage?: string;
  score?: number;
  baselineScore?: number;
  delta?: number;
  passRate?: number;
  safetyPassRate?: number;
  flags?: string[];
  breakdown01?: ScoreBreakdown01;
  contribPts?: ScoreContribPts;
  thresholds?: GateThresholds;
  n?: number;
  evidenceLevel?: "strong" | "medium" | "weak";
  baselineMissing?: boolean;
  baselineStatus?: "found" | "missing";
  dashboardUrl?: string;
  failedCases?: FailedCase[];
  failedCasesShown?: number;
  failedCasesMore?: number;
  requestId?: string;
  durationMs?: number;
  ci?: CiContext;
  explain?: boolean;
  shareUrl?: string;
  policy?: string;
  baselineRunId?: number;
  ciRunUrl?: string;
  /** When --explain and policy failed: which sub-check failed, remediation, snapshot */
  policyEvidence?: {
    failedCheck?: string;
    remediation?: string;
    snapshot?: Record<string, unknown>;
  };
};
