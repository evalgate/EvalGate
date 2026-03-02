import { describe, expect, it } from "vitest";
import {
	buildBinaryRubric,
	findMissingDimensions,
	resolveDimensionScore,
	scoreWithPartialCredit,
	type DimensionScore,
	type Rubric,
	type TierDefinition,
} from "@/lib/scoring/partial-credit";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUALITY_RUBRIC: Rubric = {
	id: "quality-v1",
	name: "Response Quality",
	dimensions: [
		{ id: "correctness", label: "Correctness", weight: 3, mode: "scalar" },
		{ id: "relevance", label: "Relevance", weight: 2, mode: "scalar" },
		{ id: "format", label: "Formatting", weight: 1, mode: "binary" },
	],
};

const TIER_DIM: Rubric["dimensions"][number] = {
	id: "completeness",
	label: "Completeness",
	weight: 1,
	mode: "tiered",
	tiers: [
		{ label: "none", score: 0 },
		{ label: "partial", score: 0.5 },
		{ label: "full", score: 1.0 },
	] satisfies TierDefinition[],
};

const TIERED_RUBRIC: Rubric = {
	id: "completeness-v1",
	name: "Completeness",
	dimensions: [TIER_DIM],
};

// ── resolveDimensionScore ─────────────────────────────────────────────────────

describe("resolveDimensionScore — binary", () => {
	const dim = QUALITY_RUBRIC.dimensions.find((d) => d.id === "format")!;

	it("returns 1 for binary 1", () => {
		expect(resolveDimensionScore(dim, { dimensionId: "format", value: 1 })).toBe(1);
	});

	it("returns 0 for binary 0", () => {
		expect(resolveDimensionScore(dim, { dimensionId: "format", value: 0 })).toBe(0);
	});

	it("throws RangeError for non-0/1 binary", () => {
		expect(() =>
			resolveDimensionScore(dim, { dimensionId: "format", value: 0.5 }),
		).toThrow(RangeError);
	});

	it("throws TypeError for string value in binary mode", () => {
		expect(() =>
			resolveDimensionScore(dim, { dimensionId: "format", value: "yes" }),
		).toThrow(TypeError);
	});
});

describe("resolveDimensionScore — scalar", () => {
	const dim = QUALITY_RUBRIC.dimensions.find((d) => d.id === "correctness")!;

	it("returns exact value for valid scalar", () => {
		expect(resolveDimensionScore(dim, { dimensionId: "correctness", value: 0.75 })).toBe(0.75);
	});

	it("returns 0 for scalar 0", () => {
		expect(resolveDimensionScore(dim, { dimensionId: "correctness", value: 0 })).toBe(0);
	});

	it("returns 1 for scalar 1", () => {
		expect(resolveDimensionScore(dim, { dimensionId: "correctness", value: 1 })).toBe(1);
	});

	it("throws RangeError for > 1", () => {
		expect(() =>
			resolveDimensionScore(dim, { dimensionId: "correctness", value: 1.5 }),
		).toThrow(RangeError);
	});

	it("throws RangeError for < 0", () => {
		expect(() =>
			resolveDimensionScore(dim, { dimensionId: "correctness", value: -0.1 }),
		).toThrow(RangeError);
	});
});

describe("resolveDimensionScore — tiered", () => {
	it("resolves 'full' tier to 1.0", () => {
		expect(resolveDimensionScore(TIER_DIM, { dimensionId: "completeness", value: "full" })).toBe(1.0);
	});

	it("resolves 'partial' tier to 0.5", () => {
		expect(resolveDimensionScore(TIER_DIM, { dimensionId: "completeness", value: "partial" })).toBe(0.5);
	});

	it("resolves 'none' tier to 0", () => {
		expect(resolveDimensionScore(TIER_DIM, { dimensionId: "completeness", value: "none" })).toBe(0);
	});

	it("throws RangeError for unknown tier", () => {
		expect(() =>
			resolveDimensionScore(TIER_DIM, { dimensionId: "completeness", value: "excellent" }),
		).toThrow(RangeError);
	});

	it("throws TypeError for numeric value in tiered mode", () => {
		expect(() =>
			resolveDimensionScore(TIER_DIM, { dimensionId: "completeness", value: 0.5 }),
		).toThrow(TypeError);
	});
});

// ── scoreWithPartialCredit ────────────────────────────────────────────────────

describe("scoreWithPartialCredit — basic", () => {
	it("full credit on all dimensions gives score 1", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 1.0 },
			{ dimensionId: "relevance", value: 1.0 },
			{ dimensionId: "format", value: 1 },
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores);
		expect(result.totalScore).toBeCloseTo(1.0);
	});

	it("zero credit on all dimensions gives score 0", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 0 },
			{ dimensionId: "relevance", value: 0 },
			{ dimensionId: "format", value: 0 },
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores);
		expect(result.totalScore).toBeCloseTo(0);
	});

	it("partial credit produces intermediate score", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 0.5 },
			{ dimensionId: "relevance", value: 0.5 },
			{ dimensionId: "format", value: 0 },
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores);
		expect(result.totalScore).toBeGreaterThan(0);
		expect(result.totalScore).toBeLessThan(1);
	});

	it("passes when totalScore >= passThreshold", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 0.8 },
			{ dimensionId: "relevance", value: 0.8 },
			{ dimensionId: "format", value: 1 },
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores, 0.6);
		expect(result.passed).toBe(true);
	});

	it("fails when totalScore < passThreshold", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 0.2 },
			{ dimensionId: "relevance", value: 0.1 },
			{ dimensionId: "format", value: 0 },
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores, 0.6);
		expect(result.passed).toBe(false);
	});
});

describe("scoreWithPartialCredit — weights", () => {
	it("heavy dimension drives score more than light dimension", () => {
		// correctness (weight 3) = 1.0, format (weight 1) = 0 → score > 0.5
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 1.0 },
			{ dimensionId: "relevance", value: 0 },
			{ dimensionId: "format", value: 0 },
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores);
		// correctness contributes 3/6 = 0.5 of total
		expect(result.totalScore).toBeCloseTo(0.5);
	});

	it("light dimension alone has smaller effect", () => {
		// only format (weight 1) passes out of total weight 6
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 0 },
			{ dimensionId: "relevance", value: 0 },
			{ dimensionId: "format", value: 1 },
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores);
		expect(result.totalScore).toBeCloseTo(1 / 6);
	});
});

describe("scoreWithPartialCredit — credit counts", () => {
	it("correctly tallies full, partial, zero credits", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 1.0 },  // full
			{ dimensionId: "relevance", value: 0.5 },    // partial
			{ dimensionId: "format", value: 0 },          // zero
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores);
		expect(result.fullCreditCount).toBe(1);
		expect(result.partialCreditCount).toBe(1);
		expect(result.zeroCreditCount).toBe(1);
	});
});

describe("scoreWithPartialCredit — missing dimensions", () => {
	it("treats missing dimension as zero score", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 1.0 },
			// relevance and format missing
		];
		const result = scoreWithPartialCredit(QUALITY_RUBRIC, scores);
		expect(result.zeroCreditCount).toBe(2);
	});
});

describe("scoreWithPartialCredit — tiered rubric", () => {
	it("partial tier gives 0.5 total score", () => {
		const result = scoreWithPartialCredit(TIERED_RUBRIC, [{ dimensionId: "completeness", value: "partial" }]);
		expect(result.totalScore).toBe(0.5);
	});

	it("preserves dimension reasoning", () => {
		const result = scoreWithPartialCredit(TIERED_RUBRIC, [{
			dimensionId: "completeness",
			value: "full",
			reasoning: "All required fields present",
		}]);
		expect(result.dimensions[0]!.reasoning).toBe("All required fields present");
	});
});

describe("scoreWithPartialCredit — empty rubric", () => {
	it("returns score 0 and no dimensions", () => {
		const result = scoreWithPartialCredit({ id: "empty", name: "Empty", dimensions: [] }, []);
		expect(result.totalScore).toBe(0);
		expect(result.dimensions).toHaveLength(0);
	});
});

// ── buildBinaryRubric ─────────────────────────────────────────────────────────

describe("buildBinaryRubric", () => {
	it("creates rubric with correct number of dimensions", () => {
		const rubric = buildBinaryRubric("test", "Test", ["A", "B", "C"]);
		expect(rubric.dimensions).toHaveLength(3);
	});

	it("all dimensions are binary with equal weight", () => {
		const rubric = buildBinaryRubric("test", "Test", ["A", "B"]);
		for (const dim of rubric.dimensions) {
			expect(dim.mode).toBe("binary");
			expect(dim.weight).toBe(1);
		}
	});

	it("passes fully when all criteria met", () => {
		const rubric = buildBinaryRubric("rb", "RB", ["A", "B", "C"]);
		const scores = rubric.dimensions.map((d) => ({ dimensionId: d.id, value: 1 }));
		const result = scoreWithPartialCredit(rubric, scores);
		expect(result.totalScore).toBe(1);
		expect(result.passed).toBe(true);
	});
});

// ── findMissingDimensions ─────────────────────────────────────────────────────

describe("findMissingDimensions", () => {
	it("returns IDs of dimensions with no score entry", () => {
		const scores: DimensionScore[] = [{ dimensionId: "correctness", value: 0.8 }];
		const missing = findMissingDimensions(QUALITY_RUBRIC, scores);
		expect(missing).toContain("relevance");
		expect(missing).toContain("format");
		expect(missing).not.toContain("correctness");
	});

	it("returns empty array when all dimensions scored", () => {
		const scores: DimensionScore[] = [
			{ dimensionId: "correctness", value: 1 },
			{ dimensionId: "relevance", value: 1 },
			{ dimensionId: "format", value: 1 },
		];
		expect(findMissingDimensions(QUALITY_RUBRIC, scores)).toHaveLength(0);
	});
});
