import { describe, expect, it } from "vitest";
import {
	aggregateDetectorSignals,
	applyAgreementBoost,
	applyEvidencePenalty,
	clampConfidence,
	confidenceLabel,
	type DetectorSignal,
} from "@/lib/failures/confidence";
import { FailureCategory } from "@/lib/failures/taxonomy";

const makeSignal = (
	category: FailureCategory,
	confidence: number,
	weight = 1.0,
): DetectorSignal => ({
	detectorId: "test-detector",
	weight,
	category,
	rawConfidence: confidence,
});

describe("aggregateDetectorSignals", () => {
	it("returns null for empty signals", () => {
		expect(aggregateDetectorSignals([])).toBeNull();
	});

	it("returns single signal's category and confidence", () => {
		const result = aggregateDetectorSignals([
			makeSignal(FailureCategory.HALLUCINATION, 0.8),
		]);
		expect(result).not.toBeNull();
		expect(result!.category).toBe(FailureCategory.HALLUCINATION);
		expect(result!.confidence).toBeCloseTo(0.8);
	});

	it("picks the category with highest weighted score", () => {
		const result = aggregateDetectorSignals([
			makeSignal(FailureCategory.HALLUCINATION, 0.9, 1.0),
			makeSignal(FailureCategory.REFUSAL, 0.5, 1.0),
		]);
		expect(result!.category).toBe(FailureCategory.HALLUCINATION);
	});

	it("weights detectors by their weight factor", () => {
		const result = aggregateDetectorSignals([
			makeSignal(FailureCategory.HALLUCINATION, 0.5, 0.2),
			makeSignal(FailureCategory.REFUSAL, 0.5, 0.8),
		]);
		expect(result!.category).toBe(FailureCategory.REFUSAL);
	});

	it("computes correct agreement count", () => {
		const result = aggregateDetectorSignals([
			makeSignal(FailureCategory.HALLUCINATION, 0.8),
			makeSignal(FailureCategory.HALLUCINATION, 0.7),
			makeSignal(FailureCategory.REFUSAL, 0.9),
		]);
		if (result!.category === FailureCategory.HALLUCINATION) {
			expect(result!.agreementCount).toBe(2);
		}
	});

	it("agreement ratio is between 0 and 1", () => {
		const result = aggregateDetectorSignals([
			makeSignal(FailureCategory.HALLUCINATION, 0.8),
			makeSignal(FailureCategory.REFUSAL, 0.5),
		]);
		expect(result!.agreementRatio).toBeGreaterThanOrEqual(0);
		expect(result!.agreementRatio).toBeLessThanOrEqual(1);
	});

	it("includes all categories in scores map", () => {
		const result = aggregateDetectorSignals([
			makeSignal(FailureCategory.HALLUCINATION, 0.8),
			makeSignal(FailureCategory.REFUSAL, 0.5),
		]);
		expect(result!.scores).toHaveProperty(FailureCategory.HALLUCINATION);
		expect(result!.scores).toHaveProperty(FailureCategory.REFUSAL);
	});
});

describe("applyAgreementBoost", () => {
	it("boosts confidence at 100% agreement", () => {
		const boosted = applyAgreementBoost(0.7, 1.0, 0.15);
		expect(boosted).toBeCloseTo(0.85);
	});

	it("no boost at 0% agreement", () => {
		const boosted = applyAgreementBoost(0.7, 0.0, 0.15);
		expect(boosted).toBeCloseTo(0.7);
	});

	it("clamps at 1.0", () => {
		const boosted = applyAgreementBoost(0.95, 1.0, 0.15);
		expect(boosted).toBe(1.0);
	});
});

describe("applyEvidencePenalty", () => {
	it("applies penalty for short evidence", () => {
		const penalized = applyEvidencePenalty(0.8, "short");
		expect(penalized).toBeCloseTo(0.7);
	});

	it("applies penalty for null evidence", () => {
		const penalized = applyEvidencePenalty(0.8, null);
		expect(penalized).toBeCloseTo(0.7);
	});

	it("does not penalize long evidence", () => {
		const longEvidence =
			"This is a sufficiently long evidence string that should not be penalized at all";
		const result = applyEvidencePenalty(0.8, longEvidence);
		expect(result).toBe(0.8);
	});

	it("clamps to 0 minimum", () => {
		const result = applyEvidencePenalty(0.05, null, 0.1);
		expect(result).toBe(0);
	});
});

describe("clampConfidence", () => {
	it("clamps above 1", () => {
		expect(clampConfidence(1.5)).toBe(1);
	});

	it("clamps below 0", () => {
		expect(clampConfidence(-0.1)).toBe(0);
	});

	it("passes through valid range", () => {
		expect(clampConfidence(0.75)).toBe(0.75);
	});
});

describe("confidenceLabel", () => {
	it("returns very high for 0.9+", () => {
		expect(confidenceLabel(0.95)).toBe("very high");
	});

	it("returns high for 0.7-0.9", () => {
		expect(confidenceLabel(0.75)).toBe("high");
	});

	it("returns medium for 0.5-0.7", () => {
		expect(confidenceLabel(0.55)).toBe("medium");
	});

	it("returns low for 0.3-0.5", () => {
		expect(confidenceLabel(0.35)).toBe("low");
	});

	it("returns very low for < 0.3", () => {
		expect(confidenceLabel(0.1)).toBe("very low");
	});
});
