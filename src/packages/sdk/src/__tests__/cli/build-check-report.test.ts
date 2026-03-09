import { describe, expect, it } from "vitest";
import type { CheckArgs } from "../../cli/check";
import { buildCheckReport } from "../../cli/report/build-check-report";

const baseArgs: CheckArgs = {
	baseUrl: "https://api.evalgate.com",
	apiKey: "test-key",
	minScore: 90,
	allowWeakEvidence: false,
	evaluationId: "eval-1",
	baseline: "published",
	format: "json",
	explain: true,
	share: "never",
};

describe("buildCheckReport", () => {
	it("maps judge alignment metrics from quality payload", () => {
		const report = buildCheckReport({
			args: baseArgs,
			quality: {
				score: 88,
				total: 200,
				evaluationRunId: 123,
				judgeAlignment: {
					tpr: 0.92,
					tnr: 0.86,
					rawPassRate: 0.79,
					correctedPassRate: 0.83,
					sampleSize: 220,
					ci95: { low: 0.8, high: 0.86 },
					correctionApplied: true,
					ciApplied: true,
				},
			},
			gateResult: {
				exitCode: 0,
				passed: true,
				reasonCode: "UNKNOWN",
				reasonMessage: null,
			},
		});

		expect(report.judgeAlignment).toEqual({
			tpr: 0.92,
			tnr: 0.86,
			rawPassRate: 0.79,
			correctedPassRate: 0.83,
			sampleSize: 220,
			ci95Low: 0.8,
			ci95High: 0.86,
		});
		expect(report.judgeCredibility).toEqual({
			correctionApplied: true,
			correctionSkippedReason: undefined,
			ciApplied: true,
			ciSkippedReason: undefined,
			rawPassRate: 0.79,
			correctedPassRate: 0.83,
			ci95: { low: 0.8, high: 0.86 },
			discriminativePower: 0.78,
			sampleSize: 220,
		});
	});

	it("maps judgeCredibility skip states when correction and CI are unavailable", () => {
		const report = buildCheckReport({
			args: baseArgs,
			quality: {
				score: 88,
				total: 18,
				evaluationRunId: 123,
				judgeAlignment: {
					tpr: 0.52,
					tnr: 0.51,
					rawPassRate: 0.892,
					correctedPassRate: undefined,
					sampleSize: 18,
					correctionApplied: false,
					correctionSkippedReason: "judge_too_weak_to_correct",
					ciApplied: false,
					ciSkippedReason: "insufficient_samples_for_ci",
					ci95: null,
				},
			},
			gateResult: {
				exitCode: 0,
				passed: true,
				reasonCode: "UNKNOWN",
				reasonMessage: null,
			},
		});

		expect(report.judgeCredibility).toMatchObject({
			correctionApplied: false,
			correctionSkippedReason: "judge_too_weak_to_correct",
			ciApplied: false,
			ciSkippedReason: "insufficient_samples_for_ci",
			rawPassRate: 0.892,
			correctedPassRate: null,
			ci95: null,
			sampleSize: 18,
		});
		expect(report.judgeCredibility?.discriminativePower).toBeCloseTo(0.03, 10);
	});

	it("keeps judge alignment undefined when payload omits it", () => {
		const report = buildCheckReport({
			args: baseArgs,
			quality: {
				score: 88,
				total: 200,
				evaluationRunId: 123,
			},
			gateResult: {
				exitCode: 0,
				passed: true,
				reasonCode: "UNKNOWN",
				reasonMessage: null,
			},
		});

		expect(report.judgeAlignment).toBeUndefined();
	});
});
