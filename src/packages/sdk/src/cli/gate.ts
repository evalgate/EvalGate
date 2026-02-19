/**
 * Pure gate evaluation. No console output.
 * Baseline missing → configuration failure (BAD_ARGS), not API_ERROR.
 */

import type { QualityLatestData } from "./api";
import type { CheckArgs } from "./check";
import { EXIT } from "./constants";
import { getValidPolicyVersions, resolvePolicyPack } from "./policy-packs";
import { REASON_CODES } from "./reason-codes";

export type GateResult = {
  exitCode: number;
  passed: boolean;
  reasonCode: string;
  reasonMessage: string | null;
  /** true when gate was skipped (e.g. baseline missing + auto) */
  gateSkipped?: boolean;
  /** When policy failed: sub-check, remediation, snapshot for explain */
  policyEvidence?: {
    failedCheck: string;
    remediation: string;
    snapshot?: Record<string, unknown>;
  };
};

export function evaluateGate(args: CheckArgs, quality: QualityLatestData): GateResult {
  const score = quality?.score ?? 0;
  const total = quality?.total ?? null;
  const evidenceLevel = quality?.evidenceLevel ?? null;
  const _baselineScore = quality?.baselineScore ?? null;
  const regressionDelta = quality?.regressionDelta ?? null;
  const baselineMissing = quality?.baselineMissing === true;
  const breakdown = quality?.breakdown ?? {};
  const policyFlags = (quality?.flags ?? []) as string[];
  const avgLatencyMs = quality?.avgLatencyMs ?? null;
  const costUsd = quality?.costUsd ?? null;
  const baselineCostUsd = quality?.baselineCostUsd ?? null;

  // Baseline missing FIRST: --baseline auto → exit 0 (neutral, gate not applied); others → BAD_ARGS
  // Must run before budget gates so baseline missing + maxCostDeltaUsd ⇒ neutral, not budget failure
  if (baselineMissing) {
    const msg =
      args.baseline === "auto"
        ? "No baseline found. Tip: Publish a baseline from the dashboard, or run with --baseline previous once you have runs."
        : args.baseline === "production"
          ? "No prod runs exist for this evaluation. Tag runs with environment=prod before using --baseline production."
          : `Baseline (${args.baseline}) not found. Ensure a baseline run exists (e.g. published run, previous run, or prod-tagged run).`;
    if (args.baseline === "auto") {
      return {
        exitCode: EXIT.PASS,
        passed: false,
        reasonCode: REASON_CODES.BASELINE_MISSING,
        reasonMessage: msg,
        gateSkipped: true,
      };
    }
    if (args.baseline !== "published" || args.maxDrop !== undefined) {
      return {
        exitCode: EXIT.BAD_ARGS,
        passed: false,
        reasonCode: REASON_CODES.BASELINE_MISSING,
        reasonMessage: msg,
      };
    }
  }

  // Budget gates (after baseline check)
  if (args.maxCostUsd != null && costUsd != null && costUsd > args.maxCostUsd) {
    return {
      exitCode: EXIT.SCORE_BELOW,
      passed: false,
      reasonCode: REASON_CODES.COST_BUDGET_EXCEEDED,
      reasonMessage: `cost $${costUsd.toFixed(4)} exceeds maxCostUsd $${args.maxCostUsd.toFixed(4)}`,
    };
  }
  if (args.maxLatencyMs != null && avgLatencyMs != null && avgLatencyMs > args.maxLatencyMs) {
    return {
      exitCode: EXIT.SCORE_BELOW,
      passed: false,
      reasonCode: REASON_CODES.LATENCY_BUDGET_EXCEEDED,
      reasonMessage: `avg latency ${avgLatencyMs}ms exceeds maxLatencyMs ${args.maxLatencyMs}`,
    };
  }
  if (
    args.maxCostDeltaUsd != null &&
    costUsd != null &&
    baselineCostUsd != null &&
    costUsd - baselineCostUsd > args.maxCostDeltaUsd
  ) {
    return {
      exitCode: EXIT.SCORE_BELOW,
      passed: false,
      reasonCode: REASON_CODES.COST_BUDGET_EXCEEDED,
      reasonMessage: `cost delta $${(costUsd - baselineCostUsd).toFixed(4)} exceeds maxCostDeltaUsd $${args.maxCostDeltaUsd.toFixed(4)}`,
    };
  }

  // minN gate
  if (args.minN !== undefined && total !== null && total < args.minN) {
    return {
      exitCode: EXIT.LOW_N,
      passed: false,
      reasonCode: REASON_CODES.LOW_SAMPLE_SIZE,
      reasonMessage: `total test cases (${total}) < minN (${args.minN})`,
    };
  }

  // allowWeakEvidence gate
  if (!args.allowWeakEvidence && evidenceLevel === "weak") {
    return {
      exitCode: EXIT.WEAK_EVIDENCE,
      passed: false,
      reasonCode: REASON_CODES.LOW_SAMPLE_SIZE,
      reasonMessage: "evidence level is 'weak' (use --allowWeakEvidence to permit)",
    };
  }

  // Compute gate result
  if (args.minScore > 0 && score < args.minScore) {
    return {
      exitCode: EXIT.SCORE_BELOW,
      passed: false,
      reasonCode: REASON_CODES.SCORE_TOO_LOW,
      reasonMessage: `score ${score} < minScore ${args.minScore}`,
    };
  }

  if (args.maxDrop !== undefined && regressionDelta !== null && regressionDelta < -args.maxDrop) {
    return {
      exitCode: EXIT.REGRESSION,
      passed: false,
      reasonCode: REASON_CODES.DELTA_TOO_HIGH,
      reasonMessage: `score dropped ${Math.abs(regressionDelta)} pts from baseline (max allowed: ${args.maxDrop})`,
    };
  }

  if (args.policy) {
    const pack = resolvePolicyPack(args.policy);
    if (!pack) {
      const valid = getValidPolicyVersions().join(", ");
      return {
        exitCode: EXIT.BAD_ARGS,
        passed: false,
        reasonCode: REASON_CODES.UNKNOWN,
        reasonMessage: `Unknown policy or version: ${args.policy}. Valid: ${valid}`,
      };
    }
    const { requiredSafetyRate, maxFlags } = pack.thresholds;
    const safetyRate = breakdown?.safety ?? 0;
    if (safetyRate < requiredSafetyRate) {
      return {
        exitCode: EXIT.POLICY_VIOLATION,
        passed: false,
        reasonCode: REASON_CODES.POLICY_FAILED,
        reasonMessage: `policy ${pack.policyId}@${pack.version}: safety ${Math.round(safetyRate * 100)}% < required ${Math.round(requiredSafetyRate * 100)}%`,
        policyEvidence: {
          failedCheck: "safety_rate",
          remediation: `Increase safety pass rate to at least ${Math.round(requiredSafetyRate * 100)}%. Review failing test cases for safety-related assertions.`,
          snapshot: {
            safety: safetyRate,
            required: requiredSafetyRate,
            policy: `${pack.policyId}@${pack.version}`,
          },
        },
      };
    }
    const violations = policyFlags.filter((f) => maxFlags.includes(f));
    if (violations.length > 0) {
      return {
        exitCode: EXIT.POLICY_VIOLATION,
        passed: false,
        reasonCode: REASON_CODES.POLICY_FAILED,
        reasonMessage: `policy ${pack.policyId}@${pack.version}: ${violations.join(", ")}`,
        policyEvidence: {
          failedCheck: "flag_restrictions",
          remediation: `Resolve flags: ${violations.join(", ")}. These indicate policy violations that must be addressed.`,
          snapshot: { violations, policy: `${pack.policyId}@${pack.version}` },
        },
      };
    }
  }

  return {
    exitCode: EXIT.PASS,
    passed: true,
    reasonCode: REASON_CODES.PASS,
    reasonMessage: null,
  };
}
