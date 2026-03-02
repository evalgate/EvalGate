/**
 * Replay Runner — orchestrates deterministic re-evaluation of frozen traces.
 *
 * Builds replay plans, validates pre-conditions, executes evaluators against
 * captured snapshots, and compares results to the original run.
 *
 * Pure module — execution I/O (model calls, disk reads) is injected by callers.
 */

import {
	classifyDeterminism,
	formatTierSummary,
	validateReplayResult,
	type DeterminismClassification,
	type DeterminismOptions,
	type SnapshotForClassification,
} from "./determinism";

// ── Types ────────────────────────────────────────────────────────────────────

export type ReplayTier = "A" | "B" | "C";

/** A minimal frozen trace snapshot (caller populates from storage) */
export interface FrozenTraceSnapshot {
	traceId: string;
	commitSha: string | null;
	toolOutputCaptureMode: "full" | "hash" | "none";
	externalDeps: Array<{ captured: boolean; type: string }>;
	modelConfig: { model: string | null; temperature: number | null };
	spans: Array<{ toolCalls: Array<{ captureMode: string }> }>;
	/** Original evaluation score (0-1) */
	originalScore: number;
	/** Original pass/fail */
	originalPassed: boolean;
	/** Input captured for replay */
	capturedInput: { prompt: string; context?: string };
	/** Expected output at time of capture */
	capturedExpectedOutput?: string;
	/** When the trace was captured */
	capturedAt: string;
	/** Tags for grouping */
	tags?: string[];
}

/** Request to replay one or more traces */
export interface ReplayJob {
	jobId: string;
	/** Snapshots to replay */
	snapshots: FrozenTraceSnapshot[];
	/** Filter to specific tags */
	filterTags?: string[];
	/** Only replay traces at or above this tier (default: all) */
	minTier?: ReplayTier;
	/** Determinism options passed to classifyDeterminism */
	determinismOptions?: DeterminismOptions;
	/** When replay was initiated */
	startedAt: string;
}

/** Pre-flight plan for a replay job */
export interface ReplayPlan {
	jobId: string;
	/** Total snapshots in job */
	totalSnapshots: number;
	/** Snapshots that will be replayed */
	plannedReplays: PlannedReplay[];
	/** Snapshots skipped (below minTier or filtered) */
	skippedCount: number;
	/** Whether any plan has blocking issues */
	hasBlockers: boolean;
	/** Warnings that don't block but should be noted */
	warnings: string[];
}

export interface PlannedReplay {
	traceId: string;
	tier: ReplayTier;
	classification: DeterminismClassification;
	/** Whether this replay has blocking issues */
	blocked: boolean;
	/** Reason for blocking (if any) */
	blockReason: string | null;
}

/** Result of replaying a single trace */
export interface SingleReplayResult {
	traceId: string;
	tier: ReplayTier;
	/** Original score before replay */
	originalScore: number;
	/** Score from the replay run */
	replayScore: number;
	/** Absolute delta */
	delta: number;
	/** Whether within tier tolerance */
	withinTolerance: boolean;
	/** Whether replay passed overall */
	passed: boolean;
	/** Status label */
	status: ReplayStatus;
	/** Time taken for this replay (ms) */
	durationMs: number;
	/** Error message if replay threw */
	error: string | null;
}

export type ReplayStatus =
	| "passed"
	| "failed_tolerance"
	| "failed_eval"
	| "skipped"
	| "error";

/** Full result for a replay job */
export interface ReplayJobResult {
	jobId: string;
	/** Wall clock duration of the full job (ms) */
	totalDurationMs: number;
	totalReplayed: number;
	passedCount: number;
	failedCount: number;
	errorCount: number;
	skippedCount: number;
	/** Per-trace results */
	results: SingleReplayResult[];
	/** Overall job pass/fail */
	passed: boolean;
	/** Summary string */
	summary: string;
}

// ── Plan builder ──────────────────────────────────────────────────────────────

const TIER_RANK: Record<ReplayTier, number> = { A: 3, B: 2, C: 1 };

function toSnapshotForClassification(s: FrozenTraceSnapshot): SnapshotForClassification {
	return {
		commitSha: s.commitSha,
		toolOutputCaptureMode: s.toolOutputCaptureMode,
		externalDeps: s.externalDeps,
		modelConfig: s.modelConfig,
		spans: s.spans,
	};
}

/**
 * Build a replay plan: classify each snapshot, apply filters, detect blockers.
 */
export function buildReplayPlan(job: ReplayJob): ReplayPlan {
	const { minTier = "C", filterTags, determinismOptions } = job;
	const warnings: string[] = [];
	let skippedCount = 0;
	const plannedReplays: PlannedReplay[] = [];

	for (const snapshot of job.snapshots) {
		// Tag filter
		if (filterTags && filterTags.length > 0) {
			const hasTags = filterTags.some((t) => snapshot.tags?.includes(t));
			if (!hasTags) {
				skippedCount++;
				continue;
			}
		}

		const classification = classifyDeterminism(
			toSnapshotForClassification(snapshot),
			determinismOptions ?? {},
		);
		const tier = classification.tier as ReplayTier;

		// Tier filter
		if (TIER_RANK[tier] < TIER_RANK[minTier]) {
			skippedCount++;
			continue;
		}

		// Detect blockers
		let blocked = false;
		let blockReason: string | null = null;

		if (!snapshot.capturedInput.prompt) {
			blocked = true;
			blockReason = "Captured input prompt is empty — cannot replay";
		}

		if (classification.warnings.length > 0) {
			for (const w of classification.warnings) {
				warnings.push(`[${snapshot.traceId}] ${w}`);
			}
		}

		plannedReplays.push({ traceId: snapshot.traceId, tier, classification, blocked, blockReason });
	}

	return {
		jobId: job.jobId,
		totalSnapshots: job.snapshots.length,
		plannedReplays,
		skippedCount,
		hasBlockers: plannedReplays.some((p) => p.blocked),
		warnings,
	};
}

// ── Runner ────────────────────────────────────────────────────────────────────

/** Injected evaluator function — called once per snapshot */
export type EvaluatorFn = (
	snapshot: FrozenTraceSnapshot,
) => Promise<{ score: number; passed: boolean }>;

/**
 * Execute a replay job, calling the evaluator for each planned replay.
 *
 * @param job - The replay job definition
 * @param evaluator - Injected function that actually evaluates a snapshot
 * @param determinismOptions - Override tolerance options
 */
export async function executeReplayJob(
	job: ReplayJob,
	evaluator: EvaluatorFn,
	determinismOptions: DeterminismOptions = {},
): Promise<ReplayJobResult> {
	const plan = buildReplayPlan(job);
	const startMs = Date.now();
	const results: SingleReplayResult[] = [];

	for (const planned of plan.plannedReplays) {
		const snapshot = job.snapshots.find((s) => s.traceId === planned.traceId)!;

		if (planned.blocked) {
			results.push({
				traceId: planned.traceId,
				tier: planned.tier,
				originalScore: snapshot.originalScore,
				replayScore: 0,
				delta: snapshot.originalScore,
				withinTolerance: false,
				passed: false,
				status: "skipped",
				durationMs: 0,
				error: planned.blockReason,
			});
			continue;
		}

		const t0 = Date.now();
		let replayScore = 0;
		let evalPassed = false;
		let error: string | null = null;

		try {
			const evalResult = await evaluator(snapshot);
			replayScore = evalResult.score;
			evalPassed = evalResult.passed;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			results.push({
				traceId: planned.traceId,
				tier: planned.tier,
				originalScore: snapshot.originalScore,
				replayScore: 0,
				delta: snapshot.originalScore,
				withinTolerance: false,
				passed: false,
				status: "error",
				durationMs: Date.now() - t0,
				error,
			});
			continue;
		}

		const validation = validateReplayResult(
			planned.tier,
			snapshot.originalScore,
			replayScore,
			determinismOptions,
		);

		let status: ReplayStatus;
		if (!evalPassed) {
			status = "failed_eval";
		} else if (!validation.withinTolerance) {
			status = "failed_tolerance";
		} else {
			status = "passed";
		}

		results.push({
			traceId: planned.traceId,
			tier: planned.tier,
			originalScore: snapshot.originalScore,
			replayScore,
			delta: validation.delta,
			withinTolerance: validation.withinTolerance,
			passed: validation.passed && evalPassed,
			status,
			durationMs: Date.now() - t0,
			error: null,
		});
	}

	const passedCount = results.filter((r) => r.status === "passed").length;
	const failedCount = results.filter((r) => r.status === "failed_tolerance" || r.status === "failed_eval").length;
	const errorCount = results.filter((r) => r.status === "error").length;
	const skippedCount = results.filter((r) => r.status === "skipped").length + plan.skippedCount;
	const totalDurationMs = Date.now() - startMs;
	const overallPassed = failedCount === 0 && errorCount === 0;

	const summary = [
		`Replay job ${job.jobId}:`,
		`  Replayed: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount} | Errors: ${errorCount} | Skipped: ${skippedCount}`,
		`  Duration: ${totalDurationMs}ms`,
		`  Result: ${overallPassed ? "✅ PASSED" : "❌ FAILED"}`,
	].join("\n");

	return {
		jobId: job.jobId,
		totalDurationMs,
		totalReplayed: results.length,
		passedCount,
		failedCount,
		errorCount,
		skippedCount,
		results,
		passed: overallPassed,
		summary,
	};
}

// ── CLI formatter ─────────────────────────────────────────────────────────────

/**
 * Format a replay plan for human-readable CLI output (pre-flight).
 */
export function formatReplayPlan(plan: ReplayPlan): string {
	const lines: string[] = [
		`Replay Plan — Job ${plan.jobId}`,
		"─".repeat(50),
		`Total snapshots:  ${plan.totalSnapshots}`,
		`Planned replays:  ${plan.plannedReplays.length}`,
		`Skipped:          ${plan.skippedCount}`,
		`Blockers:         ${plan.hasBlockers ? "⚠️ YES" : "✅ None"}`,
		"",
	];

	if (plan.plannedReplays.length > 0) {
		lines.push("Planned:");
		for (const p of plan.plannedReplays) {
			const tierLabel = p.classification.label;
			const status = p.blocked ? "🚫 BLOCKED" : `✅ Tier ${p.tier} (${tierLabel})`;
			lines.push(`  ${p.traceId}: ${status}`);
			if (p.blockReason) lines.push(`    ↳ ${p.blockReason}`);
		}
	}

	if (plan.warnings.length > 0) {
		lines.push("", "Warnings:");
		for (const w of plan.warnings) {
			lines.push(`  ⚠️  ${w}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format a replay job result for human-readable CLI output.
 */
export function formatReplayResult(result: ReplayJobResult): string {
	const statusIcon: Record<ReplayStatus, string> = {
		passed: "✅",
		failed_tolerance: "📉",
		failed_eval: "❌",
		skipped: "⏭️",
		error: "💥",
	};

	const lines: string[] = [
		`Replay Results — Job ${result.jobId}`,
		"─".repeat(50),
		result.summary,
		"",
		"Per-trace results:",
	];

	for (const r of result.results) {
		const icon = statusIcon[r.status];
		const delta = r.delta > 0 ? `Δ${(r.delta * 100).toFixed(1)}%` : "exact";
		lines.push(
			`  ${icon} ${r.traceId} [Tier ${r.tier}] — orig: ${(r.originalScore * 100).toFixed(0)}% → replay: ${(r.replayScore * 100).toFixed(0)}% (${delta}) [${r.durationMs}ms]`,
		);
		if (r.error) lines.push(`      ↳ Error: ${r.error}`);
	}

	return lines.join("\n");
}

// ── Plan + classification export helpers ──────────────────────────────────────

export { classifyDeterminism, formatTierSummary, validateReplayResult };
