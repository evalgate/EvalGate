import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendStepSummary, formatGitHub } from "../../cli/formatters/github";
import type { CheckReport } from "../../cli/formatters/types";

describe("formatGitHub", () => {
	it("emits fail annotation and summary", () => {
		const report: CheckReport = {
			evaluationId: "eval-1",
			verdict: "fail",
			gateApplied: true,
			gateMode: "enforced",
			reasonCode: "LOW_SCORE",
			reasonMessage: "Score below threshold",
			score: 60,
			failedCases: [{ testCaseId: 1, name: "tc1", reason: "assertion failed" }],
		};
		const out = formatGitHub(report);
		expect(out).toContain("::error");
		expect(out).toContain("✗ EvalGate gate FAILED");
	});
});

describe("appendStepSummary", () => {
	let summaryPath: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		summaryPath = "";
		originalEnv = process.env.GITHUB_STEP_SUMMARY;
		delete process.env.GITHUB_STEP_SUMMARY;
	});

	afterEach(() => {
		if (originalEnv !== undefined)
			process.env.GITHUB_STEP_SUMMARY = originalEnv;
		else delete process.env.GITHUB_STEP_SUMMARY;
		if (summaryPath) {
			try {
				fs.unlinkSync(summaryPath);
			} catch {
				/* ignore */
			}
		}
	});

	it("writes summary with judge details", () => {
		const tmpDir = process.env.TEMP || process.env.TMP || "/tmp";
		summaryPath = `${tmpDir}/evalgate-step-summary-${Date.now()}.md`;
		process.env.GITHUB_STEP_SUMMARY = summaryPath;
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
		appendStepSummary(report);
		const content = fs.readFileSync(summaryPath, "utf8");
		expect(content).toContain("Pass rate");
		expect(content).toContain("insufficient labeled samples");
	});
});
