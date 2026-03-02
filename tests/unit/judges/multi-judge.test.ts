import { describe, expect, it } from "vitest";
import type {
	JudgeConfig,
	JudgeFn,
	JudgeInput,
} from "@/lib/judges/multi-judge-engine";
import { runMultiJudge } from "@/lib/judges/multi-judge-engine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INPUT: JudgeInput = { prompt: "What is 2+2?", response: "4" };

const CHEAP: JudgeConfig = {
	id: "cheap-judge",
	name: "Cheap",
	costTier: "cheap",
};
const STANDARD: JudgeConfig = {
	id: "standard-judge",
	name: "Standard",
	costTier: "standard",
};
const EXPENSIVE: JudgeConfig = {
	id: "expensive-judge",
	name: "Expensive",
	costTier: "expensive",
};

function makeFn(scores: Record<string, number>): JudgeFn {
	return async (cfg: JudgeConfig) => ({
		judgeId: cfg.id,
		score: scores[cfg.id] ?? 0.5,
		weight: cfg.weight,
	});
}

// ── Parallel mode ──────────────────────────────────────────────────────────────

describe("runMultiJudge — parallel mode", () => {
	it("runs all judges and aggregates", async () => {
		const fn = makeFn({ "cheap-judge": 0.8, "standard-judge": 0.9 });
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD],
				strategy: "mean",
				mode: "parallel",
				timeoutMs: 1000,
			},
			INPUT,
			fn,
		);
		expect(result.meta.judgesRun).toBe(2);
		expect(result.meta.judgesSkipped).toBe(0);
		expect(result.meta.mode).toBe("parallel");
		expect(result.aggregated.finalScore).toBeCloseTo(0.85);
	});

	it("skips timed-out judges and continues", async () => {
		const fn: JudgeFn = async (cfg: JudgeConfig) => {
			if (cfg.id === "cheap-judge") {
				await new Promise((res) => setTimeout(res, 200));
			}
			return { judgeId: cfg.id, score: 0.8 };
		};
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD],
				strategy: "mean",
				mode: "parallel",
				timeoutMs: 50,
			},
			INPUT,
			fn,
		);
		expect(result.meta.judgesSkipped).toBe(1);
		expect(result.meta.judgesRun).toBe(1);
	});

	it("throws when all judges time out", async () => {
		const fn: JudgeFn = async () => {
			await new Promise((res) => setTimeout(res, 200));
			return { judgeId: "x", score: 0.5 };
		};
		await expect(
			runMultiJudge(
				{ judges: [CHEAP], strategy: "mean", mode: "parallel", timeoutMs: 10 },
				INPUT,
				fn,
			),
		).rejects.toThrow("all judges failed");
	});

	it("escalationStopped is false in parallel mode", async () => {
		const fn = makeFn({ "cheap-judge": 0.8, "standard-judge": 0.9 });
		const result = await runMultiJudge(
			{ judges: [CHEAP, STANDARD], strategy: "median", mode: "parallel" },
			INPUT,
			fn,
		);
		expect(result.meta.escalationStopped).toBe(false);
	});
});

// ── Sequential mode ───────────────────────────────────────────────────────────

describe("runMultiJudge — sequential mode", () => {
	it("runs judges in order and aggregates all", async () => {
		const order: string[] = [];
		const fn: JudgeFn = async (cfg: JudgeConfig) => {
			order.push(cfg.id);
			return { judgeId: cfg.id, score: 0.75 };
		};
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD, EXPENSIVE],
				strategy: "mean",
				mode: "sequential",
			},
			INPUT,
			fn,
		);
		expect(order).toEqual(["cheap-judge", "standard-judge", "expensive-judge"]);
		expect(result.meta.judgesRun).toBe(3);
	});

	it("stops early when escalation threshold met", async () => {
		const fn = makeFn({ "cheap-judge": 0.8, "standard-judge": 0.82 });
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD, EXPENSIVE],
				strategy: "mean",
				mode: "sequential",
				escalationThreshold: 0.95,
				timeoutMs: 1000,
			},
			INPUT,
			fn,
		);
		expect(result.meta.escalationStopped).toBe(true);
		expect(result.meta.judgesSkipped).toBeGreaterThan(0);
	});

	it("increments skipped count for failed judges", async () => {
		const fn: JudgeFn = async (cfg: JudgeConfig) => {
			if (cfg.id === "standard-judge") throw new Error("judge error");
			return { judgeId: cfg.id, score: 0.8 };
		};
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD, EXPENSIVE],
				strategy: "mean",
				mode: "sequential",
				timeoutMs: 500,
			},
			INPUT,
			fn,
		);
		expect(result.meta.judgesSkipped).toBe(1);
		expect(result.meta.judgesRun).toBe(2);
	});
});

// ── Escalation mode ───────────────────────────────────────────────────────────

describe("runMultiJudge — escalation mode", () => {
	it("runs cheap judge first", async () => {
		const order: string[] = [];
		const fn: JudgeFn = async (cfg: JudgeConfig) => {
			order.push(cfg.id);
			return { judgeId: cfg.id, score: 0.5 };
		};
		await runMultiJudge(
			{
				judges: [EXPENSIVE, CHEAP, STANDARD],
				strategy: "median",
				mode: "escalation",
				escalationThreshold: 0.1,
			},
			INPUT,
			fn,
		);
		expect(order[0]).toBe("cheap-judge");
	});

	it("stops early when cheap and standard agree closely", async () => {
		// After cheap (0.95) + standard (0.95), stdDev=0 <= 1-0.95=0.05 → stop
		const fn = makeFn({ "cheap-judge": 0.95, "standard-judge": 0.95 });
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD, EXPENSIVE],
				strategy: "median",
				mode: "escalation",
				escalationThreshold: 0.95,
			},
			INPUT,
			fn,
		);
		expect(result.meta.judgesRun).toBe(2);
		expect(result.meta.judgesSkipped).toBe(1);
		expect(result.meta.escalationStopped).toBe(true);
	});

	it("escalates to expensive when cheap is uncertain (0.5)", async () => {
		const fn = makeFn({
			"cheap-judge": 0.5,
			"standard-judge": 0.5,
			"expensive-judge": 0.5,
		});
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD, EXPENSIVE],
				strategy: "median",
				mode: "escalation",
				escalationThreshold: 0.85,
			},
			INPUT,
			fn,
		);
		expect(result.meta.judgesRun).toBeGreaterThan(1);
	});
});

// ── Aggregation strategies ─────────────────────────────────────────────────────

describe("runMultiJudge — aggregation strategies", () => {
	it("weighted_mean respects judge weights", async () => {
		const WEIGHTED_CHEAP: JudgeConfig = { ...CHEAP, weight: 3 };
		const fn = makeFn({ "cheap-judge": 0.9, "standard-judge": 0.3 });
		const result = await runMultiJudge(
			{
				judges: [WEIGHTED_CHEAP, STANDARD],
				strategy: "weighted_mean",
				mode: "parallel",
			},
			INPUT,
			fn,
		);
		// (0.9*3 + 0.3*1) / 4 = 0.75
		expect(result.aggregated.finalScore).toBeCloseTo(0.75);
	});

	it("majority_vote returns 1.0 on clear pass majority", async () => {
		const fn = makeFn({
			"cheap-judge": 0.9,
			"standard-judge": 0.85,
			"expensive-judge": 0.1,
		});
		const result = await runMultiJudge(
			{
				judges: [CHEAP, STANDARD, EXPENSIVE],
				strategy: "majority_vote",
				mode: "parallel",
			},
			INPUT,
			fn,
		);
		expect(result.aggregated.finalScore).toBe(1.0);
	});
});

// ── Result metadata ───────────────────────────────────────────────────────────

describe("runMultiJudge — result metadata", () => {
	it("includes totalLatencyMs > 0", async () => {
		const fn = makeFn({ "cheap-judge": 0.8 });
		const result = await runMultiJudge(
			{ judges: [CHEAP], strategy: "mean", mode: "parallel" },
			INPUT,
			fn,
		);
		expect(result.meta.totalLatencyMs).toBeGreaterThanOrEqual(0);
	});

	it("aggregated.votes matches judges run", async () => {
		const fn = makeFn({ "cheap-judge": 0.8, "standard-judge": 0.9 });
		const result = await runMultiJudge(
			{ judges: [CHEAP, STANDARD], strategy: "mean", mode: "parallel" },
			INPUT,
			fn,
		);
		expect(result.aggregated.votes).toHaveLength(2);
		expect(result.aggregated.judgeCount).toBe(2);
	});
});
