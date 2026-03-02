import { describe, expect, it } from "vitest";
import {
	aggregateJudges,
	computeAgreementStats,
	type JudgeVote,
	shouldEscalate,
} from "@/lib/judges/aggregation";

const votes: JudgeVote[] = [
	{ judgeId: "gpt-4o", score: 0.8 },
	{ judgeId: "claude-3", score: 0.7 },
	{ judgeId: "gpt-4o-mini", score: 0.9 },
];

describe("computeAgreementStats", () => {
	it("returns zero deviation for single score", () => {
		const stats = computeAgreementStats([0.8]);
		expect(stats.stdDev).toBe(0);
	});

	it("returns full consensus for identical scores", () => {
		const stats = computeAgreementStats([0.8, 0.8, 0.8]);
		expect(stats.consensusRatio).toBe(1);
		expect(stats.isHighAgreement).toBe(true);
	});

	it("detects low agreement for spread scores", () => {
		const stats = computeAgreementStats([0.1, 0.9], 0.2);
		expect(stats.isHighAgreement).toBe(false);
		expect(stats.range).toBeCloseTo(0.8);
	});

	it("handles empty array", () => {
		const stats = computeAgreementStats([]);
		expect(stats.stdDev).toBe(0);
		expect(stats.isHighAgreement).toBe(true);
	});
});

describe("aggregateJudges — median", () => {
	it("returns median of odd number of votes", () => {
		const result = aggregateJudges(votes, "median");
		expect(result.finalScore).toBeCloseTo(0.8);
	});

	it("returns median of even number of votes", () => {
		const evenVotes: JudgeVote[] = [
			{ judgeId: "a", score: 0.6 },
			{ judgeId: "b", score: 0.8 },
		];
		const result = aggregateJudges(evenVotes, "median");
		expect(result.finalScore).toBeCloseTo(0.7);
	});

	it("returns finalScore clamped to 0-1", () => {
		const result = aggregateJudges([{ judgeId: "a", score: 1.5 }], "median");
		expect(result.finalScore).toBeLessThanOrEqual(1);
	});
});

describe("aggregateJudges — mean", () => {
	it("returns mean score", () => {
		const result = aggregateJudges(votes, "mean");
		// (0.8 + 0.7 + 0.9) / 3 = 0.8
		expect(result.finalScore).toBeCloseTo(0.8);
	});
});

describe("aggregateJudges — weighted_mean", () => {
	it("higher-weight judge influences score more", () => {
		const weightedVotes: JudgeVote[] = [
			{ judgeId: "strong", score: 0.9, weight: 3 },
			{ judgeId: "weak", score: 0.3, weight: 1 },
		];
		const result = aggregateJudges(weightedVotes, "weighted_mean");
		// (0.9*3 + 0.3*1) / 4 = 0.75
		expect(result.finalScore).toBeCloseTo(0.75);
	});
});

describe("aggregateJudges — majority_vote", () => {
	it("returns 1.0 when majority pass (>= 0.7)", () => {
		const result = aggregateJudges(
			[
				{ judgeId: "a", score: 0.8 },
				{ judgeId: "b", score: 0.9 },
				{ judgeId: "c", score: 0.2 },
			],
			"majority_vote",
		);
		expect(result.finalScore).toBe(1.0);
	});

	it("returns 0.0 when majority fail (< 0.4)", () => {
		const result = aggregateJudges(
			[
				{ judgeId: "a", score: 0.1 },
				{ judgeId: "b", score: 0.2 },
				{ judgeId: "c", score: 0.8 },
			],
			"majority_vote",
		);
		expect(result.finalScore).toBe(0.0);
	});

	it("returns 0.5 on a pass/fail tie (regression: was silently returning 1.0)", () => {
		const result = aggregateJudges(
			[
				{ judgeId: "a", score: 0.9 },
				{ judgeId: "b", score: 0.1 },
			],
			"majority_vote",
		);
		expect(result.finalScore).toBe(0.5);
	});

	it("returns 0.5 when partial bucket wins three-way split", () => {
		const result = aggregateJudges(
			[
				{ judgeId: "a", score: 0.5 },
				{ judgeId: "b", score: 0.5 },
				{ judgeId: "c", score: 0.5 },
			],
			"majority_vote",
		);
		expect(result.finalScore).toBe(0.5);
	});
});

describe("aggregateJudges — min/max", () => {
	it("min returns lowest score", () => {
		const result = aggregateJudges(votes, "min");
		expect(result.finalScore).toBeCloseTo(0.7);
	});

	it("max returns highest score", () => {
		const result = aggregateJudges(votes, "max");
		expect(result.finalScore).toBeCloseTo(0.9);
	});
});

describe("aggregateJudges — result fields", () => {
	it("empty votes returns zero score and not highConfidence", () => {
		const result = aggregateJudges([]);
		expect(result.finalScore).toBe(0);
		expect(result.highConfidence).toBe(false);
		expect(result.judgeCount).toBe(0);
	});

	it("high agreement with 2+ votes sets highConfidence", () => {
		const closelAgreedVotes: JudgeVote[] = [
			{ judgeId: "a", score: 0.8 },
			{ judgeId: "b", score: 0.82 },
		];
		const result = aggregateJudges(closelAgreedVotes, "median", 0.2);
		expect(result.highConfidence).toBe(true);
	});

	it("single judge is not highConfidence", () => {
		const result = aggregateJudges([{ judgeId: "a", score: 0.9 }]);
		expect(result.highConfidence).toBe(false);
	});

	it("includes all votes in result", () => {
		const result = aggregateJudges(votes);
		expect(result.votes).toHaveLength(3);
	});
});

describe("shouldEscalate", () => {
	it("escalates for uncertain score (0.5)", () => {
		expect(shouldEscalate(0.5)).toBe(true);
	});

	it("does not escalate for clear pass (0.9)", () => {
		expect(shouldEscalate(0.9)).toBe(false);
	});

	it("does not escalate for clear fail (0.1)", () => {
		expect(shouldEscalate(0.1)).toBe(false);
	});

	it("respects custom uncertainty band", () => {
		expect(shouldEscalate(0.5, [0.6, 0.8])).toBe(false);
		expect(shouldEscalate(0.7, [0.6, 0.8])).toBe(true);
	});
});
