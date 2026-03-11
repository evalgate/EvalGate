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

	it("fails with REGRESSION (exit 2) when regressionDelta exceeds maxDrop", () => {
		const args: CheckArgs = { ...baseArgs, maxDrop: 5, minScore: 80 };
		const quality = {
			score: 85,
			total: 30,
			evaluationRunId: 1,
			baselineScore: 93,
			regressionDelta: -8,
		};
		const result = evaluateGate(args, quality);
		expect(result.exitCode).toBe(EXIT.REGRESSION);
		expect(result.passed).toBe(false);
		expect(result.reasonCode).toBe("DELTA_TOO_HIGH");
	});

	it("returns WARN_REGRESSION (exit 8) when drop within warn band", () => {
		const args: CheckArgs = {
			...baseArgs,
			maxDrop: 5,
			warnDrop: 2,
			minScore: 80,
		};
		const quality = {
			score: 88,
			total: 30,
			evaluationRunId: 1,
			baselineScore: 92,
			regressionDelta: -4,
		};
		const result = evaluateGate(args, quality);
		expect(result.exitCode).toBe(EXIT.WARN_REGRESSION);
		expect(result.passed).toBe(true);
		expect(result.reasonCode).toBe("WARN_REGRESSION");
	});

	it("fails when judge thresholds are configured but judge metrics are missing", () => {
		const args: CheckArgs = { ...baseArgs, judgeTprMin: 0.9 };
		const quality = {
			score: 95,
			total: 20,
			evaluationRunId: 1,
		};
		const result = evaluateGate(args, quality);
		expect(result.exitCode).toBe(EXIT.SCORE_BELOW);
		expect(result.passed).toBe(false);
		expect(result.reasonCode).toBe("JUDGE_ALIGNMENT_MISSING");
	});

	it("fails with LOW_N when judge sample size is below threshold", () => {
		const args: CheckArgs = { ...baseArgs, judgeMinLabeledSamples: 200 };
		const quality = {
			score: 95,
			total: 20,
			evaluationRunId: 1,
			judgeAlignment: { sampleSize: 120, tpr: 0.95, tnr: 0.95 },
		};
		const result = evaluateGate(args, quality);
		expect(result.exitCode).toBe(EXIT.LOW_N);
		expect(result.passed).toBe(false);
		expect(result.reasonCode).toBe("LOW_SAMPLE_SIZE");
	});

	it("fails with JUDGE_ALIGNMENT_LOW when TPR is below threshold", () => {
		const args: CheckArgs = { ...baseArgs, judgeTprMin: 0.9 };
		const quality = {
			score: 95,
			total: 20,
			evaluationRunId: 1,
			judgeAlignment: { sampleSize: 300, tpr: 0.82, tnr: 0.95 },
		};
		const result = evaluateGate(args, quality);
		expect(result.exitCode).toBe(EXIT.SCORE_BELOW);
		expect(result.passed).toBe(false);
		expect(result.reasonCode).toBe("JUDGE_ALIGNMENT_LOW");
	});

	it("fails with distinct untrustworthy code when judge correction is skipped for weak judge", () => {
		const args: CheckArgs = { ...baseArgs, judgeTprMin: 0.9 };
		const quality = {
			score: 95,
			total: 20,
			evaluationRunId: 1,
			judgeAlignment: {
				tpr: 0.52,
				tnr: 0.51,
				sampleSize: 120,
				correctionApplied: false,
				correctionSkippedReason: "judge_too_weak_to_correct" as const,
			},
		};
		const result = evaluateGate(args, quality);
		expect(result.exitCode).toBe(EXIT.JUDGE_CREDIBILITY_UNTRUSTWORTHY);
		expect(result.passed).toBe(false);
		expect(result.reasonCode).toBe("JUDGE_CREDIBILITY_UNTRUSTWORTHY");
	});

	it("uses dedicated failure mode threshold code when failure mode alerts are breached", () => {
		const args: CheckArgs = {
			...baseArgs,
			failureModeAlerts: {
				modes: {
					tone_mismatch: {
						alertThreshold: 2,
					},
				},
			},
		};
		const quality = {
			score: 95,
			total: 20,
			evaluationRunId: 1,
			judgeAlignment: {
				tpr: 0.92,
				tnr: 0.9,
				sampleSize: 220,
				totalFailed: 3,
				failureModes: {
					tone_mismatch: 3,
				},
			},
		};
		const result = evaluateGate(args, quality);

		expect(result.exitCode).toBe(EXIT.FAILURE_MODE_THRESHOLD);
		expect(result.passed).toBe(false);
		expect(result.reasonCode).toBe("FAILURE_MODE_THRESHOLD");
		expect(result.policyEvidence?.failedCheck).toBe("failure_mode_thresholds");
	});

	it("passes when judge thresholds are configured and metrics satisfy them", () => {
		const args: CheckArgs = {
			...baseArgs,
			judgeTprMin: 0.9,
			judgeTnrMin: 0.85,
			judgeMinLabeledSamples: 200,
		};
		const quality = {
			score: 95,
			total: 20,
			evaluationRunId: 1,
			judgeAlignment: { sampleSize: 220, tpr: 0.92, tnr: 0.89 },
		};
		const result = evaluateGate(args, quality);
		expect(result.exitCode).toBe(EXIT.PASS);
		expect(result.passed).toBe(true);
	});
});
