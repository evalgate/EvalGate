/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JudgeVotePanel } from "@/components/judge-vote-panel";
import type { AggregatedJudgeResult } from "@/lib/judges/aggregation";

const PASSING_RESULT: AggregatedJudgeResult = {
	finalScore: 0.87,
	strategy: "majority_vote",
	votes: [
		{ judgeId: "gpt-4o", score: 0.9 },
		{ judgeId: "claude-3", score: 0.85 },
		{ judgeId: "gemini-pro", score: 0.8 },
	],
	agreementStats: {
		stdDev: 0.05,
		range: 0.1,
		agreementRatio: 0.9,
		outlierJudgeIds: [],
	},
	highConfidence: true,
};

const TIE_RESULT: AggregatedJudgeResult = {
	finalScore: 0.5,
	strategy: "majority_vote",
	votes: [
		{ judgeId: "judge-a", score: 0.9 },
		{ judgeId: "judge-b", score: 0.1 },
	],
	agreementStats: {
		stdDev: 0.4,
		range: 0.8,
		agreementRatio: 0.0,
		outlierJudgeIds: ["judge-b"],
	},
	highConfidence: false,
};

describe("JudgeVotePanel", () => {
	it("renders all judge IDs", () => {
		render(<JudgeVotePanel result={PASSING_RESULT} />);
		expect(screen.getByText("gpt-4o")).toBeDefined();
		expect(screen.getByText("claude-3")).toBeDefined();
		expect(screen.getByText("gemini-pro")).toBeDefined();
	});

	it("shows final score as percentage", () => {
		render(<JudgeVotePanel result={PASSING_RESULT} />);
		expect(screen.getByText("87%")).toBeDefined();
	});

	it("shows strategy label", () => {
		render(<JudgeVotePanel result={PASSING_RESULT} />);
		expect(screen.getByText("Majority Vote")).toBeDefined();
	});

	it("shows 'High confidence' badge for high-confidence results", () => {
		render(<JudgeVotePanel result={PASSING_RESULT} />);
		expect(screen.getByText("High confidence")).toBeDefined();
	});

	it("shows 'Low confidence' badge for uncertain results", () => {
		render(<JudgeVotePanel result={TIE_RESULT} />);
		expect(screen.getByText("Low confidence")).toBeDefined();
	});

	it("displays agreement percentage", () => {
		render(<JudgeVotePanel result={PASSING_RESULT} />);
		expect(screen.getByText("90% agreement")).toBeDefined();
	});

	it("shows 0% agreement on tie", () => {
		render(<JudgeVotePanel result={TIE_RESULT} />);
		expect(screen.getByText("0% agreement")).toBeDefined();
	});

	it("renders pass/partial/fail icons via aria-labels", () => {
		render(<JudgeVotePanel result={PASSING_RESULT} />);
		const passIcons = screen.getAllByLabelText("pass");
		expect(passIcons.length).toBe(3);
	});

	it("renders fail icon for low-scoring judge", () => {
		render(<JudgeVotePanel result={TIE_RESULT} />);
		expect(screen.getByLabelText("fail")).toBeDefined();
	});
});
