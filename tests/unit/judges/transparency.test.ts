import { describe, expect, it } from "vitest";
import { aggregateJudges } from "@/lib/judges/aggregation";
import { createTransparencyArtifact } from "@/lib/judges/transparency";

const baseVotes = [
	{ judgeId: "gpt-4o", score: 0.8, reasoning: "Well-structured answer" },
	{ judgeId: "claude-3", score: 0.75, reasoning: "Mostly correct" },
];

const aggregationResult = aggregateJudges(baseVotes, "median");

const baseInput = {
	id: "artifact-1",
	evalRunId: "run-abc",
	testCaseId: "case-xyz",
	rawOutputs: [
		{
			judgeId: "gpt-4o",
			score: 0.8,
			rawText: "Score: 0.8. Reasoning: Well-structured.",
		},
		{
			judgeId: "claude-3",
			score: 0.75,
			rawText: "Score: 0.75. Reasoning: Mostly correct.",
		},
	],
	aggregationResult,
};

describe("createTransparencyArtifact", () => {
	it("creates artifact with correct ids", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(artifact.id).toBe("artifact-1");
		expect(artifact.evalRunId).toBe("run-abc");
		expect(artifact.testCaseId).toBe("case-xyz");
	});

	it("has a valid ISO createdAt", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(() => new Date(artifact.createdAt)).not.toThrow();
	});

	it("stores raw outputs for each judge", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(artifact.rawOutputs).toHaveLength(2);
		expect(artifact.rawOutputs[0]!.judgeId).toBe("gpt-4o");
	});

	it("truncates long raw outputs", () => {
		const longOutput = "x".repeat(3000);
		const artifact = createTransparencyArtifact({
			...baseInput,
			rawOutputs: [{ judgeId: "a", score: 0.5, rawText: longOutput }],
		});
		expect(artifact.rawOutputs[0]!.rawText.length).toBeLessThanOrEqual(2001);
		expect(artifact.rawOutputs[0]!.truncated).toBe(true);
	});

	it("does not truncate short outputs", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(artifact.rawOutputs[0]!.truncated).toBe(false);
	});

	it("hashes rubric when provided", () => {
		const artifact = createTransparencyArtifact({
			...baseInput,
			rubricText: "Score 1 if correct, 0 otherwise",
		});
		expect(artifact.rubricRef).not.toBeNull();
		expect(artifact.rubricRef).toMatch(/^[0-9a-f]{8}$/);
	});

	it("rubricRef is null when no rubric", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(artifact.rubricRef).toBeNull();
	});

	it("hashes judge prompts", () => {
		const artifact = createTransparencyArtifact({
			...baseInput,
			judgePrompts: { "gpt-4o": "You are an evaluator. Score from 0-1." },
		});
		expect(artifact.promptHashes["gpt-4o"]).toBeDefined();
		expect(artifact.promptHashes["gpt-4o"]).toMatch(/^[0-9a-f]{8}$/);
	});

	it("provides aggregation narrative", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(artifact.aggregation.aggregationNarrative.length).toBeGreaterThan(
			20,
		);
		expect(artifact.aggregation.aggregationNarrative).toContain("median");
	});

	it("explain view has correct score display", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(artifact.explainView.scoreDisplay).toMatch(/\d+%/);
	});

	it("explain view has judge cards for each vote", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(artifact.explainView.judgeCards).toHaveLength(2);
	});

	it("flags single-judge results", () => {
		const singleVoteResult = aggregateJudges([{ judgeId: "a", score: 0.7 }]);
		const artifact = createTransparencyArtifact({
			...baseInput,
			rawOutputs: [{ judgeId: "a", score: 0.7, rawText: "ok" }],
			aggregationResult: singleVoteResult,
		});
		expect(artifact.explainView.flags).toContain("single-judge");
	});

	it("flags low agreement", () => {
		const lowAgreementVotes = [
			{ judgeId: "a", score: 0.1 },
			{ judgeId: "b", score: 0.9 },
		];
		const lowAgreementResult = aggregateJudges(
			lowAgreementVotes,
			"median",
			0.2,
		);
		const artifact = createTransparencyArtifact({
			...baseInput,
			rawOutputs: [
				{ judgeId: "a", score: 0.1, rawText: "fail" },
				{ judgeId: "b", score: 0.9, rawText: "pass" },
			],
			aggregationResult: lowAgreementResult,
		});
		expect(artifact.explainView.flags).toContain("low-agreement");
	});

	it("agreement level is strong for close scores", () => {
		const artifact = createTransparencyArtifact(baseInput);
		expect(["strong", "moderate"]).toContain(
			artifact.explainView.agreementLevel,
		);
	});
});
