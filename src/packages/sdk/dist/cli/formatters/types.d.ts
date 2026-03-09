/**
 * CheckReport and related types for formatters.
 */
export type GateVerdict = "pass" | "warn" | "fail";
/** "neutral" = exit 0 but gate not applied (e.g. baseline missing with --baseline auto) */
export type GateMode = "enforced" | "neutral";
/** Canonical reason codes. Import REASON_CODES from ../reason-codes for constants. */
export type FailureReasonCode = "PASS" | "WARN_REGRESSION" | "LOW_SAMPLE_SIZE" | "JUDGE_ALIGNMENT_MISSING" | "JUDGE_ALIGNMENT_LOW" | "JUDGE_CREDIBILITY_UNTRUSTWORTHY" | "BASELINE_MISSING" | "SCORE_TOO_LOW" | "DELTA_TOO_HIGH" | "COST_BUDGET_EXCEEDED" | "LATENCY_BUDGET_EXCEEDED" | "POLICY_FAILED" | "UNKNOWN" | "LOW_SCORE" | "LOW_PASS_RATE" | "SAFETY_RISK" | "LATENCY_RISK" | "COST_RISK" | "MAX_DROP_EXCEEDED" | "INSUFFICIENT_EVIDENCE" | "POLICY_VIOLATION";
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
export type JudgeAlignmentSummary = {
    tpr?: number;
    tnr?: number;
    sampleSize?: number;
    rawPassRate?: number;
    correctedPassRate?: number;
    ci95Low?: number;
    ci95High?: number;
};
export type JudgeCredibilitySummary = {
    correctionApplied: boolean;
    correctionSkippedReason?: "judge_too_weak_to_correct";
    ciApplied: boolean;
    ciSkippedReason?: "judge_too_weak_to_correct" | "insufficient_samples_for_ci";
    rawPassRate?: number;
    correctedPassRate?: number | null;
    ci95?: {
        low: number;
        high: number;
    } | null;
    discriminativePower?: number;
    sampleSize?: number;
};
export type GateThresholds = {
    minScore?: number;
    minPassRate?: number;
    minSafety?: number;
    maxDrop?: number;
    warnDrop?: number;
    minN?: number;
    allowWeakEvidence?: boolean;
    baseline?: "published" | "previous" | "production" | "auto";
    maxCostUsd?: number;
    maxLatencyMs?: number;
    maxCostDeltaUsd?: number;
    judgeTprMin?: number;
    judgeTnrMin?: number;
    judgeMinLabeledSamples?: number;
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
/** Current schema version for CheckReport (.evalgate/last-report.json). Bump on breaking changes. */
export declare const CHECK_REPORT_SCHEMA_VERSION = 1;
export type CheckReport = {
    schemaVersion?: number;
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
    judgeAlignment?: JudgeAlignmentSummary;
    judgeCredibility?: JudgeCredibilitySummary;
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
