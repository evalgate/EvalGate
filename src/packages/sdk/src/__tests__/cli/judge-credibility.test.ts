import { describe, expect, it } from "vitest";
import {
	computeBootstrapCI,
	computeCorrectedPassRate,
	MIN_BOOTSTRAP_SAMPLE_SIZE,
	MIN_DISCRIMINATIVE_POWER,
} from "../../cli/judge-credibility";

describe("computeCorrectedPassRate", () => {
	it("applies correction when judge has sufficient discriminative power", () => {
		const result = computeCorrectedPassRate({
			rawPassRate: 0.72,
			tpr: 0.9,
			tnr: 0.9,
		});
		expect(result.applied).toBe(true);
		expect(result.warning).toBeUndefined();
		expect(result.correctedPassRate).toBeCloseTo(0.775, 3);
	});

	it("skips correction when judge is near-random", () => {
		const result = computeCorrectedPassRate({
			rawPassRate: 0.72,
			tpr: 0.53,
			tnr: 0.5,
		});
		expect(result.applied).toBe(false);
		expect(result.warning).toBe("judge_too_weak_to_correct");
		expect(result.correctedPassRate).toBe(0.72);
		expect(result.discriminativePower).toBeLessThanOrEqual(
			MIN_DISCRIMINATIVE_POWER,
		);
	});
});

describe("computeBootstrapCI", () => {
	it("skips CI when sample size is below minimum", () => {
		const result = computeBootstrapCI({
			outcomes: new Array(MIN_BOOTSTRAP_SAMPLE_SIZE - 1).fill(true),
			tpr: 0.9,
			tnr: 0.9,
			iterations: 2000,
			seed: 42,
		});
		expect(result.applied).toBe(false);
		expect(result.warning).toBe("insufficient_samples_for_ci");
	});

	it("uses deterministic RNG for stable CI bounds", () => {
		const outcomes = Array.from({ length: 80 }, (_, i) => i % 5 !== 0);
		const a = computeBootstrapCI({
			outcomes,
			tpr: 0.91,
			tnr: 0.9,
			iterations: 500,
			seed: 123,
		});
		const b = computeBootstrapCI({
			outcomes,
			tpr: 0.91,
			tnr: 0.9,
			iterations: 500,
			seed: 123,
		});
		expect(a.applied).toBe(true);
		expect(a.low).toBeCloseTo(b.low ?? 0, 10);
		expect(a.high).toBeCloseTo(b.high ?? 0, 10);
	});

	it("skips CI when judge is too weak to correct", () => {
		const outcomes = Array.from({ length: 80 }, (_, i) => i % 2 === 0);
		const result = computeBootstrapCI({
			outcomes,
			tpr: 0.52,
			tnr: 0.5,
			iterations: 500,
			seed: 42,
		});
		expect(result.applied).toBe(false);
		expect(result.warning).toBe("judge_too_weak_to_correct");
	});
});
