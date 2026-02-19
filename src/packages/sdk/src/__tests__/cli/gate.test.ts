/**
 * Gate evaluation tests.
 */

import { describe, expect, it } from "vitest";
import type { CheckArgs } from "../../cli/check";
import { EXIT } from "../../cli/constants";
import { evaluateGate } from "../../cli/gate";

const baseArgs: CheckArgs = {
  baseUrl: "http://localhost:3000",
  apiKey: "test",
  minScore: 90,
  allowWeakEvidence: false,
  evaluationId: "42",
  baseline: "published",
  format: "human",
  explain: false,
  share: "never",
};

describe("evaluateGate", () => {
  it("returns exit 0 when baseline=auto and baselineMissing (never hard-fail)", () => {
    const args: CheckArgs = { ...baseArgs, baseline: "auto" };
    const quality = {
      score: 85,
      total: 20,
      evaluationRunId: 1,
      baselineMissing: true,
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(EXIT.PASS);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe("BASELINE_MISSING");
    expect(result.reasonMessage).toContain("No baseline found");
  });

  it("returns BAD_ARGS when baseline=published and baselineMissing with maxDrop", () => {
    const args: CheckArgs = { ...baseArgs, baseline: "published", maxDrop: 5 };
    const quality = {
      score: 85,
      total: 20,
      evaluationRunId: 1,
      baselineMissing: true,
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(5); // BAD_ARGS
    expect(result.reasonCode).toBe("BASELINE_MISSING");
  });

  it("passes when score meets minScore and baseline found", () => {
    const quality = {
      score: 92,
      total: 30,
      evaluationRunId: 1,
      baselineScore: 90,
      regressionDelta: 2,
    };
    const result = evaluateGate(baseArgs, quality);
    expect(result.exitCode).toBe(EXIT.PASS);
    expect(result.passed).toBe(true);
  });

  it("fails with COST_BUDGET_EXCEEDED when costUsd exceeds maxCostUsd", () => {
    const args: CheckArgs = { ...baseArgs, maxCostUsd: 0.01 };
    const quality = {
      score: 95,
      total: 20,
      evaluationRunId: 1,
      costUsd: 0.05,
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(EXIT.SCORE_BELOW);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe("COST_BUDGET_EXCEEDED");
    expect(result.reasonMessage).toContain("0.05");
    expect(result.reasonMessage).toContain("0.01");
  });

  it("fails with LATENCY_BUDGET_EXCEEDED when avgLatencyMs exceeds maxLatencyMs", () => {
    const args: CheckArgs = { ...baseArgs, maxLatencyMs: 100 };
    const quality = {
      score: 95,
      total: 20,
      evaluationRunId: 1,
      avgLatencyMs: 250,
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(EXIT.SCORE_BELOW);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe("LATENCY_BUDGET_EXCEEDED");
    expect(result.reasonMessage).toContain("250");
    expect(result.reasonMessage).toContain("100");
  });

  it("fails with COST_BUDGET_EXCEEDED when cost delta exceeds maxCostDeltaUsd", () => {
    const args: CheckArgs = { ...baseArgs, maxCostDeltaUsd: 0.01 };
    const quality = {
      score: 95,
      total: 20,
      evaluationRunId: 1,
      costUsd: 0.05,
      baselineCostUsd: 0.02,
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(EXIT.SCORE_BELOW);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe("COST_BUDGET_EXCEEDED");
    expect(result.reasonMessage).toContain("0.03");
    expect(result.reasonMessage).toContain("0.01");
  });

  it("fails with POLICY_FAILED when using --policy HIPAA@1 and safety too low", () => {
    const args: CheckArgs = { ...baseArgs, policy: "HIPAA@1" };
    const quality = {
      score: 95,
      total: 20,
      evaluationRunId: 1,
      breakdown: { safety: 0.98 },
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(3); // POLICY_VIOLATION
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe("POLICY_FAILED");
    expect(result.reasonMessage).toContain("HIPAA");
  });

  it("passes policy gate when using --policy HIPAA@1 and safety meets threshold", () => {
    const args: CheckArgs = { ...baseArgs, policy: "HIPAA@1" };
    const quality = {
      score: 95,
      total: 20,
      evaluationRunId: 1,
      breakdown: { safety: 0.995 },
      flags: [],
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(EXIT.PASS);
    expect(result.passed).toBe(true);
  });

  it("passes budget gates when within limits", () => {
    const args: CheckArgs = {
      ...baseArgs,
      maxCostUsd: 0.1,
      maxLatencyMs: 500,
      maxCostDeltaUsd: 0.05,
    };
    const quality = {
      score: 92,
      total: 30,
      evaluationRunId: 1,
      baselineScore: 90,
      regressionDelta: 2,
      costUsd: 0.03,
      avgLatencyMs: 200,
      baselineCostUsd: 0.02,
    };
    const result = evaluateGate(args, quality);
    expect(result.exitCode).toBe(EXIT.PASS);
    expect(result.passed).toBe(true);
  });
});
