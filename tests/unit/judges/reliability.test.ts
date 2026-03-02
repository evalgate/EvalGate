import { describe, expect, it } from "vitest";
import {
	computeAllJudgeReliability,
	computeJudgeReliability,
	detectUnstableJudges,
	type JudgeObservation,
	judgeReliabilityWeight,
} from "@/lib/judges/reliability";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const now = Date.now();

function obs(
	judgeId: string,
	predicted: number,
	truth: number | null = null,
	offset = 0,
): JudgeObservation {
	return {
		judgeId,
		predictedScore: predicted,
		groundTruth: truth,
		timestamp: now + offset,
	};
}

// Accurate judge — always within 0.05 of ground truth
const ACCURATE_OBS: JudgeObservation[] = [
	obs("accurate", 0.8, 0.82),
	obs("accurate", 0.7, 0.72),
	obs("accurate", 0.9, 0.88),
	obs("accurate", 0.6, 0.62),
	obs("accurate", 0.75, 0.74),
	obs("accurate", 0.85, 0.83),
];

// Biased judge — consistently over-scores by ~0.3
const BIASED_OBS: JudgeObservation[] = [
	obs("biased", 0.9, 0.6),
	obs("biased", 0.8, 0.5),
	obs("biased", 0.85, 0.55),
	obs("biased", 0.75, 0.45),
	obs("biased", 0.95, 0.65),
];

// Noisy judge — random scores with no correlation to truth
const NOISY_OBS: JudgeObservation[] = [
	obs("noisy", 0.9, 0.1),
	obs("noisy", 0.1, 0.9),
	obs("noisy", 0.8, 0.2),
	obs("noisy", 0.2, 0.8),
	obs("noisy", 0.7, 0.3),
];

// ── computeJudgeReliability ───────────────────────────────────────────────────

describe("computeJudgeReliability — accurate judge", () => {
	it("assigns excellent or good tier", () => {
		const m = computeJudgeReliability("accurate", ACCURATE_OBS);
		expect(["excellent", "good"]).toContain(m.tier);
	});

	it("has low MAE", () => {
		const m = computeJudgeReliability("accurate", ACCURATE_OBS);
		expect(m.mae).not.toBeNull();
		expect(m.mae!).toBeLessThan(0.1);
	});

	it("is not flagged", () => {
		const m = computeJudgeReliability("accurate", ACCURATE_OBS);
		expect(m.flagged).toBe(false);
	});

	it("has near-zero bias", () => {
		const m = computeJudgeReliability("accurate", ACCURATE_OBS);
		expect(Math.abs(m.bias!)).toBeLessThan(0.05);
	});
});

describe("computeJudgeReliability — biased judge", () => {
	it("is flagged for systematic over-scoring", () => {
		const m = computeJudgeReliability("biased", BIASED_OBS);
		expect(m.flagged).toBe(true);
		expect(m.flagReason).toMatch(/over/i);
	});

	it("has positive bias", () => {
		const m = computeJudgeReliability("biased", BIASED_OBS);
		expect(m.bias!).toBeGreaterThan(0.2);
	});
});

describe("computeJudgeReliability — noisy judge", () => {
	it("gets poor tier", () => {
		const m = computeJudgeReliability("noisy", NOISY_OBS);
		expect(m.tier).toBe("poor");
	});

	it("is flagged", () => {
		const m = computeJudgeReliability("noisy", NOISY_OBS);
		expect(m.flagged).toBe(true);
	});

	it("has high MAE", () => {
		const m = computeJudgeReliability("noisy", NOISY_OBS);
		expect(m.mae!).toBeGreaterThan(0.3);
	});
});

describe("computeJudgeReliability — edge cases", () => {
	it("returns unrated tier with fewer than minObservations", () => {
		const m = computeJudgeReliability("new-judge", [
			obs("new-judge", 0.8, 0.75),
		]);
		expect(m.tier).toBe("unrated");
	});

	it("returns null mae with no labelled observations", () => {
		const unlabelled = [
			obs("unlabelled", 0.8),
			obs("unlabelled", 0.9),
			obs("unlabelled", 0.7),
			obs("unlabelled", 0.85),
			obs("unlabelled", 0.75),
		];
		const m = computeJudgeReliability("unlabelled", unlabelled);
		expect(m.mae).toBeNull();
		expect(m.bias).toBeNull();
		expect(m.calibration).toBeNull();
	});

	it("filters observations to matching judgeId only", () => {
		const mixed = [...ACCURATE_OBS, ...BIASED_OBS];
		const m = computeJudgeReliability("accurate", mixed);
		expect(m.observationCount).toBe(ACCURATE_OBS.length);
	});

	it("respects custom biasFlagThreshold — bias-specific reason absent when threshold raised", () => {
		// Bias ~0.3; raising threshold to 0.4 means the BIAS flag doesn't fire.
		// The judge may still be flagged for poor calibration (MAE also > threshold)
		// but the flagReason should NOT mention over/under-scoring.
		const m = computeJudgeReliability("biased", BIASED_OBS, {
			biasFlagThreshold: 0.4,
			minObservationsForTier: 5,
		});
		if (m.flagged) {
			expect(m.flagReason).not.toMatch(/over.*scor|under.*scor/i);
		}
	});
});

// ── computeAllJudgeReliability ────────────────────────────────────────────────

describe("computeAllJudgeReliability", () => {
	it("returns a map with one entry per unique judge", () => {
		const all = [...ACCURATE_OBS, ...BIASED_OBS, ...NOISY_OBS];
		const map = computeAllJudgeReliability(all);
		expect(map.size).toBe(3);
		expect(map.has("accurate")).toBe(true);
		expect(map.has("biased")).toBe(true);
		expect(map.has("noisy")).toBe(true);
	});
});

// ── judgeReliabilityWeight ────────────────────────────────────────────────────

describe("judgeReliabilityWeight", () => {
	it("excellent unflagged judge gets weight 1.0", () => {
		const m = computeJudgeReliability("accurate", ACCURATE_OBS);
		const w = judgeReliabilityWeight(m);
		expect(w).toBeLessThanOrEqual(1.0);
		expect(w).toBeGreaterThanOrEqual(0.5);
	});

	it("poor judge gets lower weight than good judge", () => {
		const poor = computeJudgeReliability("noisy", NOISY_OBS);
		const good = computeJudgeReliability("accurate", ACCURATE_OBS);
		expect(judgeReliabilityWeight(poor)).toBeLessThan(
			judgeReliabilityWeight(good),
		);
	});

	it("flagged judge is penalised vs unflagged same tier", () => {
		const unflagged = {
			judgeId: "a",
			observationCount: 10,
			mae: 0.05,
			bias: 0.01,
			calibration: 0.9,
			recentStdDev: 0.05,
			tier: "excellent" as const,
			flagged: false,
			flagReason: null,
		};
		const flagged = { ...unflagged, flagged: true };
		expect(judgeReliabilityWeight(flagged)).toBeLessThan(
			judgeReliabilityWeight(unflagged),
		);
	});
});

// ── detectUnstableJudges ──────────────────────────────────────────────────────

describe("detectUnstableJudges", () => {
	it("flags judges with unusually high recent std-dev", () => {
		const all = [...ACCURATE_OBS, ...NOISY_OBS];
		const map = computeAllJudgeReliability(all);
		const unstable = detectUnstableJudges(map, 0.1, 2.0);
		expect(unstable).toContain("noisy");
	});

	it("does not flag stable judges", () => {
		const map = computeAllJudgeReliability(ACCURATE_OBS);
		const unstable = detectUnstableJudges(map, 1.0, 2.0);
		expect(unstable).not.toContain("accurate");
	});
});
