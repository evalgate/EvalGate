/**
 * Build CheckReport from API data and gate result.
 * Normalizes failed cases (truncate, sort), dashboard URL, top N + more.
 */

import type { QualityLatestData, RunDetailsData } from "../api";
import type { CheckArgs } from "../check";
import {
  CHECK_REPORT_SCHEMA_VERSION,
  type CheckReport,
  type FailedCase,
  type ScoreBreakdown01,
  type ScoreContribPts,
} from "../formatters/types";
import type { GateResult } from "../gate";
import { truncateSnippet } from "../render/snippet";
import { sortFailedCases } from "../render/sort";

const TOP_N = 3;

/** ContribPts from weights: passRate*50, safety*25, (0.6*judge+0.4*schema)*15, (0.6*latency+0.4*cost)*10 */
function computeContribPts(b: ScoreBreakdown01): ScoreContribPts {
  const pr = b.passRate ?? 0;
  const s = b.safety ?? 0;
  const j = b.judge ?? 0;
  const sc = b.schema ?? 0;
  const l = b.latency ?? 0;
  const c = b.cost ?? 0;
  return {
    passRatePts: Math.round(pr * 50 * 10) / 10,
    safetyPts: Math.round(s * 25 * 10) / 10,
    compliancePts: Math.round((0.6 * j + 0.4 * sc) * 15 * 10) / 10,
    performancePts: Math.round((0.6 * l + 0.4 * c) * 10 * 10) / 10,
  };
}

const SNIPPET_MAX = 50;

export type BuildReportInput = {
  args: CheckArgs;
  quality: QualityLatestData;
  runDetails?: RunDetailsData | null;
  gateResult: GateResult;
  requestId?: string;
  shareUrl?: string;
  baselineRunId?: number | null;
  ciRunUrl?: string | null;
};

export function buildCheckReport(input: BuildReportInput): CheckReport {
  const { args, quality, runDetails, gateResult, requestId } = input;
  const score = quality?.score ?? 0;
  const total = quality?.total ?? null;
  const baselineScore = quality?.baselineScore ?? null;
  const regressionDelta = quality?.regressionDelta ?? null;
  const evaluationRunId = quality?.evaluationRunId;
  const breakdown = quality?.breakdown ?? {};
  const flags = (quality?.flags ?? []) as string[];

  const baseUrl = args.baseUrl.replace(/\/$/, "");
  const dashboardUrl =
    evaluationRunId != null
      ? `${baseUrl}/evaluations/${args.evaluationId}/runs/${evaluationRunId}`
      : undefined;

  // Build failed cases from run details
  let failedCases: FailedCase[] = [];
  if (runDetails?.results && evaluationRunId != null) {
    const raw = runDetails.results
      .filter((r) => r.status === "failed")
      .map((r) => ({
        testCaseId: r.testCaseId,
        status: "failed" as const,
        name: r.test_cases?.name,
        input: r.test_cases?.input,
        expectedOutput: r.test_cases?.expectedOutput,
        output: r.output,
      }));
    failedCases = sortFailedCases(raw).map((fc) => ({
      ...fc,
      inputSnippet: truncateSnippet(fc.input, SNIPPET_MAX),
      expectedSnippet: truncateSnippet(fc.expectedOutput, SNIPPET_MAX),
      outputSnippet: truncateSnippet(fc.output, SNIPPET_MAX),
    }));
  }

  const failedCasesShown = Math.min(failedCases.length, TOP_N);
  const failedCasesMore = failedCases.length - failedCasesShown;

  const breakdown01 =
    Object.keys(breakdown).length > 0 ? (breakdown as CheckReport["breakdown01"]) : undefined;
  const contribPts = args.explain && breakdown01 ? computeContribPts(breakdown01) : undefined;

  const gateSkipped = gateResult.gateSkipped === true;
  const gateApplied = !gateSkipped;
  const gateMode = gateSkipped ? "neutral" : "enforced";
  const actionableMessage = gateSkipped
    ? "Gate not applied: baseline missing. Publish a baseline from the dashboard, or run with --baseline previous once you have runs."
    : (gateResult.reasonMessage ?? undefined);

  const verdict: CheckReport["verdict"] =
    gateResult.reasonCode === "WARN_REGRESSION" ? "warn" : gateResult.passed ? "pass" : "fail";

  const report: CheckReport = {
    schemaVersion: CHECK_REPORT_SCHEMA_VERSION,
    evaluationId: args.evaluationId,
    runId: evaluationRunId,
    verdict,
    gateApplied,
    gateMode,
    actionableMessage,
    shareUrl: input.shareUrl,
    policy: args.policy,
    baselineRunId: input.baselineRunId ?? quality?.baselineRunId ?? undefined,
    ciRunUrl: input.ciRunUrl ?? undefined,
    reasonCode: gateResult.reasonCode as CheckReport["reasonCode"],
    reasonMessage: gateResult.reasonMessage ?? undefined,
    score,
    baselineScore: baselineScore ?? undefined,
    delta: regressionDelta ?? undefined,
    n: total ?? undefined,
    evidenceLevel: (quality?.evidenceLevel as CheckReport["evidenceLevel"]) ?? undefined,
    baselineMissing: quality?.baselineMissing === true,
    baselineStatus:
      quality?.baselineMissing === true
        ? "missing"
        : quality?.baselineScore != null
          ? "found"
          : undefined,
    flags: flags.length > 0 ? [...flags].sort() : undefined,
    breakdown01,
    contribPts,
    thresholds: {
      minScore: args.minScore,
      maxDrop: args.maxDrop,
      warnDrop: args.warnDrop,
      minN: args.minN,
      allowWeakEvidence: args.allowWeakEvidence,
      baseline: args.baseline,
      maxCostUsd: args.maxCostUsd,
      maxLatencyMs: args.maxLatencyMs,
      maxCostDeltaUsd: args.maxCostDeltaUsd,
    },
    dashboardUrl,
    failedCases,
    failedCasesShown: failedCases.length > 0 ? failedCasesShown : undefined,
    failedCasesMore: failedCasesMore > 0 ? failedCasesMore : undefined,
    requestId,
    explain: args.explain,
    policyEvidence:
      args.explain && gateResult.policyEvidence
        ? {
            failedCheck: gateResult.policyEvidence.failedCheck,
            remediation: gateResult.policyEvidence.remediation,
            snapshot: gateResult.policyEvidence.snapshot,
          }
        : undefined,
  };

  return report;
}
