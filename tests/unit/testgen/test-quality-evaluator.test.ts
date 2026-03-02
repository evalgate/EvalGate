import { describe, expect, it } from "vitest";
import { createEvalCase } from "@/lib/testcases/spec";
import {
	evaluateTestQuality,
	filterByQuality,
} from "@/lib/testgen/test-quality-evaluator";

const weakCase = createEvalCase({
	title: "test",
	quarantined: true,
});

const strongCase = createEvalCase({
	title:
		"[refusal] What is the refund policy for partial payments? Model should not refuse.",
	tags: ["refusal", "severity:medium", "auto-generated"],
	sourceTraceIds: ["trace-123"],
	frozenSnapshotRef: "snap-abc",
	replayTier: "B",
	rubricRef: "rubric-1",
	expectedConstraints: [
		{
			type: "not_contains",
			value: "unable to",
			required: true,
			description: "Must not refuse",
		},
		{ type: "score_gte", value: 0.7, required: true },
	],
});

describe("evaluateTestQuality", () => {
	it("returns scores within expected ranges", () => {
		const score = evaluateTestQuality(weakCase);
		expect(score.qualityScore).toBeGreaterThanOrEqual(0);
		expect(score.qualityScore).toBeLessThanOrEqual(100);
		expect(score.usefulnessScore).toBeGreaterThanOrEqual(0);
		expect(score.usefulnessScore).toBeLessThanOrEqual(100);
		expect(score.falsePositiveRisk).toBeGreaterThanOrEqual(0);
		expect(score.falsePositiveRisk).toBeLessThanOrEqual(1);
		expect(score.compositeScore).toBeGreaterThanOrEqual(0);
		expect(score.compositeScore).toBeLessThanOrEqual(100);
	});

	it("strong case scores higher than weak case", () => {
		const weakScore = evaluateTestQuality(weakCase);
		const strongScore = evaluateTestQuality(strongCase);
		expect(strongScore.compositeScore).toBeGreaterThan(
			weakScore.compositeScore,
		);
	});

	it("weak case gets reject or low verdict", () => {
		const score = evaluateTestQuality(weakCase);
		expect(["reject", "low"]).toContain(score.verdict);
	});

	it("strong case gets medium or high verdict", () => {
		const score = evaluateTestQuality(strongCase);
		expect(["medium", "high"]).toContain(score.verdict);
	});

	it("returns signal breakdown", () => {
		const score = evaluateTestQuality(strongCase);
		expect(score.signals.length).toBeGreaterThan(0);
		expect(score.signals.every((s) => typeof s.score === "number")).toBe(true);
	});

	it("case without constraints has low constraint specificity", () => {
		const noConstraints = createEvalCase({ title: "Test without constraints" });
		const score = evaluateTestQuality(noConstraints);
		const constraintSignal = score.signals.find(
			(s) => s.dimension === "constraint_specificity",
		);
		expect(constraintSignal?.score).toBeLessThanOrEqual(20);
	});

	it("case with frozen snapshot has lower false positive risk", () => {
		const withSnapshot = createEvalCase({
			title: "Good test with snapshot",
			frozenSnapshotRef: "snap-1",
			expectedConstraints: [
				{ type: "contains", value: "refund", required: true },
			],
		});
		const withoutSnapshot = createEvalCase({
			title: "Good test without snapshot",
			expectedConstraints: [
				{ type: "contains", value: "refund", required: true },
			],
		});
		const s1 = evaluateTestQuality(withSnapshot);
		const s2 = evaluateTestQuality(withoutSnapshot);
		expect(s1.falsePositiveRisk).toBeLessThan(s2.falsePositiveRisk);
	});

	it("provides a non-empty recommendation", () => {
		const score = evaluateTestQuality(strongCase);
		expect(score.recommendation.length).toBeGreaterThan(10);
	});
});

describe("filterByQuality", () => {
	it("passes strong cases and rejects weak cases", () => {
		const { passing, rejected } = filterByQuality([weakCase, strongCase], 50);
		expect(passing).toContainEqual(strongCase);
		expect(rejected).toContainEqual(weakCase);
	});

	it("scores map contains entry for each case", () => {
		const { scores } = filterByQuality([weakCase, strongCase]);
		expect(scores.has(weakCase.id)).toBe(true);
		expect(scores.has(strongCase.id)).toBe(true);
	});

	it("all cases pass at threshold 0", () => {
		const { passing } = filterByQuality([weakCase, strongCase], 0);
		expect(passing).toHaveLength(2);
	});

	it("no cases pass at threshold 101", () => {
		const { rejected } = filterByQuality([weakCase, strongCase], 101);
		expect(rejected).toHaveLength(2);
	});
});
