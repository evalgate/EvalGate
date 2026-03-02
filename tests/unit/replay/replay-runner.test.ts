import { describe, expect, it, vi } from "vitest";
import {
	buildReplayPlan,
	executeReplayJob,
	formatReplayPlan,
	formatReplayResult,
	type EvaluatorFn,
	type FrozenTraceSnapshot,
	type ReplayJob,
} from "@/lib/replay/replay-runner";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function snapshot(
	traceId: string,
	overrides: Partial<FrozenTraceSnapshot> = {},
): FrozenTraceSnapshot {
	return {
		traceId,
		commitSha: "abc123",
		toolOutputCaptureMode: "full",
		externalDeps: [],
		modelConfig: { model: "gpt-4o", temperature: 0.0 },
		spans: [{ toolCalls: [{ captureMode: "full" }] }],
		originalScore: 0.85,
		originalPassed: true,
		capturedInput: { prompt: "What is the capital of France?" },
		capturedExpectedOutput: "Paris",
		capturedAt: "2025-01-15T10:00:00.000Z",
		tags: ["geography"],
		...overrides,
	};
}

function job(snapshots: FrozenTraceSnapshot[], overrides: Partial<ReplayJob> = {}): ReplayJob {
	return {
		jobId: "job-001",
		snapshots,
		startedAt: new Date().toISOString(),
		...overrides,
	};
}

const PASSING_EVALUATOR: EvaluatorFn = async (s) => ({
	score: s.originalScore,
	passed: true,
});

const FAILING_EVALUATOR: EvaluatorFn = async () => ({
	score: 0.1,
	passed: false,
});

const REGRESSING_EVALUATOR: EvaluatorFn = async (s) => ({
	score: s.originalScore - 0.3,
	passed: true,
});

// ── buildReplayPlan ───────────────────────────────────────────────────────────

describe("buildReplayPlan — basic planning", () => {
	it("plans all snapshots by default", () => {
		const plan = buildReplayPlan(job([snapshot("t1"), snapshot("t2")]));
		expect(plan.plannedReplays).toHaveLength(2);
		expect(plan.skippedCount).toBe(0);
	});

	it("classifies Tier A for fully captured snapshots", () => {
		const plan = buildReplayPlan(job([snapshot("t1")]));
		expect(plan.plannedReplays[0]!.tier).toBe("A");
	});

	it("classifies Tier C for snapshots with uncaptured external deps", () => {
		const s = snapshot("t1", { externalDeps: [{ captured: false, type: "external-api" }] });
		const plan = buildReplayPlan(job([s]));
		expect(plan.plannedReplays[0]!.tier).toBe("C");
	});

	it("marks snapshot as blocked when prompt is empty", () => {
		const s = snapshot("t1", { capturedInput: { prompt: "" } });
		const plan = buildReplayPlan(job([s]));
		expect(plan.plannedReplays[0]!.blocked).toBe(true);
		expect(plan.hasBlockers).toBe(true);
	});

	it("hasBlockers is false when no blockers", () => {
		const plan = buildReplayPlan(job([snapshot("t1")]));
		expect(plan.hasBlockers).toBe(false);
	});
});

describe("buildReplayPlan — filtering", () => {
	it("filters by tags", () => {
		const tagged = snapshot("t1", { tags: ["safety"] });
		const untagged = snapshot("t2", { tags: ["geography"] });
		const plan = buildReplayPlan(job([tagged, untagged], { filterTags: ["safety"] }));
		expect(plan.plannedReplays).toHaveLength(1);
		expect(plan.plannedReplays[0]!.traceId).toBe("t1");
		expect(plan.skippedCount).toBe(1);
	});

	it("filters by minTier — skips Tier C when minTier=B", () => {
		const tierC = snapshot("tc", { externalDeps: [{ captured: false, type: "api" }] });
		const tierA = snapshot("ta");
		const plan = buildReplayPlan(job([tierC, tierA], { minTier: "B" }));
		expect(plan.plannedReplays.map((p) => p.traceId)).not.toContain("tc");
		expect(plan.skippedCount).toBe(1);
	});

	it("includes all tiers when minTier=C", () => {
		const tierC = snapshot("tc", { externalDeps: [{ captured: false, type: "api" }] });
		const plan = buildReplayPlan(job([tierC], { minTier: "C" }));
		expect(plan.plannedReplays).toHaveLength(1);
	});

	it("collects warnings from classification", () => {
		const tierB = snapshot("t1", {
			modelConfig: { model: "gpt-4o", temperature: null }, // missing temp → warning
		});
		const plan = buildReplayPlan(job([tierB]));
		expect(plan.warnings.length).toBeGreaterThan(0);
	});
});

// ── executeReplayJob ──────────────────────────────────────────────────────────

describe("executeReplayJob — passing eval", () => {
	it("returns passed=true when all evals pass", async () => {
		const result = await executeReplayJob(job([snapshot("t1"), snapshot("t2")]), PASSING_EVALUATOR);
		expect(result.passed).toBe(true);
		expect(result.passedCount).toBe(2);
		expect(result.failedCount).toBe(0);
	});

	it("all results have status=passed", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), PASSING_EVALUATOR);
		expect(result.results[0]!.status).toBe("passed");
	});

	it("delta is 0 when replay score matches original", async () => {
		const result = await executeReplayJob(job([snapshot("t1", { originalScore: 0.8 })]), PASSING_EVALUATOR);
		expect(result.results[0]!.delta).toBeCloseTo(0);
	});
});

describe("executeReplayJob — failing eval", () => {
	it("returns passed=false when eval fails", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), FAILING_EVALUATOR);
		expect(result.passed).toBe(false);
		expect(result.failedCount).toBeGreaterThan(0);
	});

	it("status is failed_eval when evaluator returns passed=false", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), FAILING_EVALUATOR);
		expect(result.results[0]!.status).toBe("failed_eval");
	});
});

describe("executeReplayJob — tolerance regression", () => {
	it("fails tolerance when score drops by more than Tier A threshold", async () => {
		// Tier A tolerance is 5%; regression is 30%
		const result = await executeReplayJob(
			job([snapshot("t1", { originalScore: 0.85 })]),
			REGRESSING_EVALUATOR,
			{ tierAScoreTolerance: 0.05 },
		);
		expect(result.results[0]!.withinTolerance).toBe(false);
		expect(result.results[0]!.status).toBe("failed_tolerance");
	});

	it("passes tolerance for Tier C (unlimited tolerance)", async () => {
		const tierC = snapshot("t1", {
			externalDeps: [{ captured: false, type: "api" }],
			originalScore: 0.8,
		});
		const result = await executeReplayJob(job([tierC]), REGRESSING_EVALUATOR);
		expect(result.results[0]!.withinTolerance).toBe(true);
	});
});

describe("executeReplayJob — error handling", () => {
	it("records error status when evaluator throws", async () => {
		const throwingEval: EvaluatorFn = async () => {
			throw new Error("Model unavailable");
		};
		const result = await executeReplayJob(job([snapshot("t1")]), throwingEval);
		expect(result.results[0]!.status).toBe("error");
		expect(result.results[0]!.error).toContain("Model unavailable");
		expect(result.errorCount).toBe(1);
	});

	it("continues with remaining snapshots after one error", async () => {
		const partialEval: EvaluatorFn = async (s) => {
			if (s.traceId === "t1") throw new Error("fail");
			return { score: s.originalScore, passed: true }; // delta=0 → always within tolerance
		};
		const result = await executeReplayJob(
			job([snapshot("t1"), snapshot("t2")]),
			partialEval,
		);
		expect(result.results).toHaveLength(2);
		expect(result.results.find((r) => r.traceId === "t2")!.status).toBe("passed");
	});
});

describe("executeReplayJob — blocked snapshots", () => {
	it("skips blocked snapshots without calling evaluator", async () => {
		const evalSpy = vi.fn().mockResolvedValue({ score: 0.9, passed: true });
		const blocked = snapshot("blocked", { capturedInput: { prompt: "" } });
		await executeReplayJob(job([blocked]), evalSpy);
		expect(evalSpy).not.toHaveBeenCalled();
	});

	it("blocked snapshots get status=skipped", async () => {
		const blocked = snapshot("blocked", { capturedInput: { prompt: "" } });
		const result = await executeReplayJob(job([blocked]), PASSING_EVALUATOR);
		expect(result.results[0]!.status).toBe("skipped");
	});
});

describe("executeReplayJob — summary", () => {
	it("summary is a non-empty string", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), PASSING_EVALUATOR);
		expect(typeof result.summary).toBe("string");
		expect(result.summary.length).toBeGreaterThan(10);
	});

	it("totalDurationMs is a non-negative number", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), PASSING_EVALUATOR);
		expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
	});
});

// ── formatReplayPlan ──────────────────────────────────────────────────────────

describe("formatReplayPlan", () => {
	it("returns non-empty string", () => {
		const plan = buildReplayPlan(job([snapshot("t1")]));
		const output = formatReplayPlan(plan);
		expect(typeof output).toBe("string");
		expect(output.length).toBeGreaterThan(10);
	});

	it("includes job ID", () => {
		const plan = buildReplayPlan(job([snapshot("t1")]));
		expect(formatReplayPlan(plan)).toContain("job-001");
	});

	it("includes BLOCKED indicator for blocked snapshots", () => {
		const blocked = snapshot("t1", { capturedInput: { prompt: "" } });
		const plan = buildReplayPlan(job([blocked]));
		expect(formatReplayPlan(plan)).toContain("BLOCKED");
	});
});

// ── formatReplayResult ────────────────────────────────────────────────────────

describe("formatReplayResult", () => {
	it("returns non-empty string", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), PASSING_EVALUATOR);
		expect(formatReplayResult(result).length).toBeGreaterThan(10);
	});

	it("shows PASSED for passing result", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), PASSING_EVALUATOR);
		expect(formatReplayResult(result)).toContain("PASSED");
	});

	it("shows FAILED for failing result", async () => {
		const result = await executeReplayJob(job([snapshot("t1")]), FAILING_EVALUATOR);
		expect(formatReplayResult(result)).toContain("FAILED");
	});

	it("includes trace ID in output", async () => {
		const result = await executeReplayJob(job([snapshot("my-trace-xyz")]), PASSING_EVALUATOR);
		expect(formatReplayResult(result)).toContain("my-trace-xyz");
	});
});
