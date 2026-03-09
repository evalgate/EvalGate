import { describe, expect, it } from "vitest";
import { buildPrComment } from "../../cli/formatters/pr-comment";
import type { CheckReport } from "../../cli/formatters/types";

describe("buildPrComment", () => {
	it("renders pass output", () => {
		const report: CheckReport = {
			evaluationId: "eval-1",
			verdict: "pass",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "UNKNOWN",
			score: 95,
			dashboardUrl: "https://example.com/dash",
		};
		const out = buildPrComment(report);
		expect(out).toContain("PASSED");
		expect(out).toContain("**Reason:** UNKNOWN");
	});

	it("renders inline warnings when correction is skipped", () => {
		const report: CheckReport = {
			evaluationId: "eval-1",
			verdict: "fail",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "JUDGE_CREDIBILITY_UNTRUSTWORTHY",
			score: 70,
			judgeAlignment: {
				tpr: 0.52,
				tnr: 0.51,
				rawPassRate: 0.892,
				sampleSize: 18,
			},
			judgeCredibility: {
				correctionApplied: false,
				correctionSkippedReason: "judge_too_weak_to_correct",
				ciApplied: false,
				ciSkippedReason: "insufficient_samples_for_ci",
				rawPassRate: 0.892,
				correctedPassRate: null,
				ci95: null,
				discriminativePower: 0.03,
				sampleSize: 18,
			},
		};
		const out = buildPrComment(report);
		expect(out).toContain("Pass rate: 89.2% (raw)");
		expect(out).toContain("judge too weak");
		expect(out).toContain("insufficient labeled samples");
	});
});
