import { describe, expect, it } from "vitest";
import {
	computeQualityScore,
	type ScoreInputs,
} from "@/lib/scoring/quality-score";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function inputs(overrides: Partial<ScoreInputs> = {}): ScoreInputs {
	return {
		total: 20,
		passed: 18,
		safetyPassRate: 0.98,
		judgeAvg: 0.9,
		schemaPassRate: 0.95,
		avgLatencyMs: 800,
		avgCostUsd: 0.005,
		budgetUsd: 0.01,
		...overrides,
	};
}

// ── Basic score computation ───────────────────────────────────────────────────

describe("computeQualityScore — score range", () => {
	it("returns score between 0 and 100", () => {
		const r = computeQualityScore(inputs());
		expect(r.score).toBeGreaterThanOrEqual(0);
		expect(r.score).toBeLessThanOrEqual(100);
	});

	it("returns integer score (rounded)", () => {
		const r = computeQualityScore(inputs());
		expect(Number.isInteger(r.score)).toBe(true);
	});

	it("returns high score for excellent inputs", () => {
		const r = computeQualityScore(
			inputs({ passed: 20, safetyPassRate: 1.0, judgeAvg: 1.0 }),
		);
		expect(r.score).toBeGreaterThanOrEqual(90);
	});

	it("returns low score for poor inputs", () => {
		const r = computeQualityScore(
			inputs({
				total: 10,
				passed: 2,
				safetyPassRate: 0.5,
				judgeAvg: 0.3,
				avgLatencyMs: 9000,
				avgCostUsd: 0.1,
				budgetUsd: 0.01,
			}),
		);
		expect(r.score).toBeLessThan(60);
	});

	it("returns 0 for zero tests", () => {
		const r = computeQualityScore(inputs({ total: 0, passed: 0 }));
		expect(r.score).toBeGreaterThanOrEqual(0);
	});
});

// ── Breakdown ─────────────────────────────────────────────────────────────────

describe("computeQualityScore — breakdown", () => {
	it("passRate is passed/total", () => {
		const r = computeQualityScore(inputs({ total: 10, passed: 8 }));
		expect(r.breakdown.passRate).toBeCloseTo(0.8);
	});

	it("safety equals safetyPassRate when provided", () => {
		const r = computeQualityScore(inputs({ safetyPassRate: 0.93 }));
		expect(r.breakdown.safety).toBeCloseTo(0.93);
	});

	it("safety falls back to passRate when not provided", () => {
		const r = computeQualityScore(
			inputs({ safetyPassRate: undefined, total: 10, passed: 7 }),
		);
		expect(r.breakdown.safety).toBeCloseTo(0.7);
	});

	it("judge equals judgeAvg when provided", () => {
		const r = computeQualityScore(inputs({ judgeAvg: 0.85 }));
		expect(r.breakdown.judge).toBeCloseTo(0.85);
	});

	it("latency is 1 when avgLatencyMs is null", () => {
		const r = computeQualityScore(inputs({ avgLatencyMs: undefined }));
		expect(r.breakdown.latency).toBe(1);
	});

	it("latency is 1 at or below 1500ms", () => {
		const r = computeQualityScore(inputs({ avgLatencyMs: 1500 }));
		expect(r.breakdown.latency).toBe(1);
	});

	it("latency is 0 at 8000ms or above", () => {
		const r = computeQualityScore(inputs({ avgLatencyMs: 8000 }));
		expect(r.breakdown.latency).toBe(0);
	});

	it("latency degrades linearly between 1500-8000ms", () => {
		const r = computeQualityScore(inputs({ avgLatencyMs: 4750 })); // midpoint
		expect(r.breakdown.latency).toBeCloseTo(0.5, 1);
	});

	it("cost is 1 when within budget", () => {
		const r = computeQualityScore(
			inputs({ avgCostUsd: 0.005, budgetUsd: 0.01 }),
		);
		expect(r.breakdown.cost).toBe(1);
	});

	it("cost is 1 when budget not specified", () => {
		const r = computeQualityScore(
			inputs({ avgCostUsd: undefined, budgetUsd: undefined }),
		);
		expect(r.breakdown.cost).toBe(1);
	});

	it("cost degrades when over budget", () => {
		const r = computeQualityScore(
			inputs({ avgCostUsd: 0.02, budgetUsd: 0.01 }),
		);
		expect(r.breakdown.cost).toBeLessThan(1);
	});

	it("all breakdown values are between 0 and 1", () => {
		const r = computeQualityScore(inputs());
		for (const val of Object.values(r.breakdown)) {
			expect(val).toBeGreaterThanOrEqual(0);
			expect(val).toBeLessThanOrEqual(1);
		}
	});
});

// ── Flags ─────────────────────────────────────────────────────────────────────

describe("computeQualityScore — flags", () => {
	it("includes LOW_PASS_RATE when passRate < 0.9", () => {
		const r = computeQualityScore(inputs({ total: 10, passed: 8 })); // 80%
		expect(r.flags).toContain("LOW_PASS_RATE");
	});

	it("does not include LOW_PASS_RATE when passRate >= 0.9", () => {
		const r = computeQualityScore(inputs({ total: 10, passed: 10 }));
		expect(r.flags).not.toContain("LOW_PASS_RATE");
	});

	it("includes SAFETY_RISK when safety < 0.95", () => {
		const r = computeQualityScore(inputs({ safetyPassRate: 0.9 }));
		expect(r.flags).toContain("SAFETY_RISK");
	});

	it("includes LATENCY_RISK when latency breakdown < 0.5", () => {
		const r = computeQualityScore(inputs({ avgLatencyMs: 7000 }));
		expect(r.flags).toContain("LATENCY_RISK");
	});

	it("includes COST_RISK when cost breakdown < 0.5", () => {
		const r = computeQualityScore(
			inputs({ avgCostUsd: 0.025, budgetUsd: 0.01 }),
		);
		expect(r.flags).toContain("COST_RISK");
	});

	it("includes MISSING_JUDGE when judgeAvg not provided", () => {
		const r = computeQualityScore(inputs({ judgeAvg: undefined }));
		expect(r.flags).toContain("MISSING_JUDGE");
	});

	it("includes MISSING_SAFETY when safetyPassRate not provided", () => {
		const r = computeQualityScore(inputs({ safetyPassRate: undefined }));
		expect(r.flags).toContain("MISSING_SAFETY");
	});

	it("includes LOW_N when total < 10", () => {
		const r = computeQualityScore(inputs({ total: 5, passed: 5 }));
		expect(r.flags).toContain("LOW_N");
	});

	it("includes SAFETY_WEAK_EVIDENCE when safetyFromProxy=true", () => {
		const r = computeQualityScore(inputs({ safetyFromProxy: true }));
		expect(r.flags).toContain("SAFETY_WEAK_EVIDENCE");
	});

	it("includes TRACE_COVERAGE_LOW when traceCoverageRate < 0.8", () => {
		const r = computeQualityScore(inputs({ traceCoverageRate: 0.6 }));
		expect(r.flags).toContain("TRACE_COVERAGE_LOW");
	});

	it("includes MISSING_PROVENANCE when trace-linked but no provenance", () => {
		const r = computeQualityScore(
			inputs({ traceCoverageRate: 0.9, hasProvenance: false }),
		);
		expect(r.flags).toContain("MISSING_PROVENANCE");
	});

	it("has no flags for a perfect run", () => {
		const r = computeQualityScore({
			total: 20,
			passed: 20,
			safetyPassRate: 1.0,
			judgeAvg: 1.0,
			schemaPassRate: 1.0,
			avgLatencyMs: 500,
			avgCostUsd: 0.001,
			budgetUsd: 0.01,
		});
		expect(r.flags).toHaveLength(0);
	});
});

// ── Evidence level ────────────────────────────────────────────────────────────

describe("computeQualityScore — evidenceLevel", () => {
	it("strong when judge + safety + N>=10", () => {
		const r = computeQualityScore(inputs({ total: 15, passed: 14 }));
		expect(r.evidenceLevel).toBe("strong");
	});

	it("medium when only judge provided and N>=5", () => {
		const r = computeQualityScore(
			inputs({ total: 7, passed: 6, safetyPassRate: undefined }),
		);
		expect(r.evidenceLevel).toBe("medium");
	});

	it("weak when N < 5 and no judge/safety", () => {
		const r = computeQualityScore(
			inputs({
				total: 3,
				passed: 2,
				judgeAvg: undefined,
				safetyPassRate: undefined,
			}),
		);
		expect(r.evidenceLevel).toBe("weak");
	});

	it("weak when N < 5 even with judge and safety", () => {
		const r = computeQualityScore(inputs({ total: 4, passed: 3 }));
		expect(r.evidenceLevel).toBe("weak");
	});
});
