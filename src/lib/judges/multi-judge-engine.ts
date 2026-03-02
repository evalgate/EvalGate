/**
 * Multi-Judge Engine — Orchestrate N judges and aggregate their results.
 *
 * Supports sequential, parallel, and escalation-based execution modes.
 * Each judge is identified by an ID and produces a JudgeVote.
 */

import {
	type AggregatedJudgeResult,
	type AggregationStrategy,
	aggregateJudges,
	type JudgeVote,
} from "./aggregation";

// ── Types ────────────────────────────────────────────────────────────────────

export type ExecutionMode = "parallel" | "sequential" | "escalation";

export interface JudgeConfig {
	/** Unique judge identifier */
	id: string;
	/** Human-readable label */
	name: string;
	/** Cost tier — used by escalation strategy */
	costTier: "cheap" | "standard" | "expensive";
	/** Optional weight for weighted_mean aggregation */
	weight?: number;
	/** Maximum allowed latency in ms (used for timeout guards) */
	maxLatencyMs?: number;
}

export interface JudgeInput {
	prompt: string;
	response: string;
	/** Optional context passed to the judge */
	context?: Record<string, unknown>;
}

export type JudgeFn = (
	config: JudgeConfig,
	input: JudgeInput,
) => Promise<JudgeVote>;

export interface MultiJudgeRunConfig {
	judges: JudgeConfig[];
	strategy: AggregationStrategy;
	mode: ExecutionMode;
	/** For escalation mode: agreement threshold to stop early */
	escalationThreshold?: number;
	/** Timeout per judge in ms */
	timeoutMs?: number;
}

export interface MultiJudgeRunResult {
	aggregated: AggregatedJudgeResult;
	/** Execution metadata */
	meta: {
		mode: ExecutionMode;
		judgesRun: number;
		judgesSkipped: number;
		/** Whether escalation stopped early due to agreement */
		escalationStopped: boolean;
		totalLatencyMs: number;
	};
}

// ── Timeout helper ────────────────────────────────────────────────────────────

async function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	judgeId: string,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`Judge ${judgeId} timed out after ${ms}ms`)),
			ms,
		);
	});
	try {
		const result = await Promise.race([promise, timeout]);
		return result;
	} finally {
		clearTimeout(timer!);
	}
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Run all judges in parallel and aggregate.
 */
async function runParallel(
	configs: JudgeConfig[],
	input: JudgeInput,
	judgeFn: JudgeFn,
	timeoutMs: number,
): Promise<{ votes: JudgeVote[]; skipped: number }> {
	const settled = await Promise.allSettled(
		configs.map((cfg) => withTimeout(judgeFn(cfg, input), timeoutMs, cfg.id)),
	);
	const votes: JudgeVote[] = [];
	let skipped = 0;
	for (const result of settled) {
		if (result.status === "fulfilled") {
			votes.push(result.value);
		} else {
			skipped++;
		}
	}
	return { votes, skipped };
}

/**
 * Run judges sequentially, stopping early if escalation threshold met.
 */
async function runSequential(
	configs: JudgeConfig[],
	input: JudgeInput,
	judgeFn: JudgeFn,
	timeoutMs: number,
	escalationThreshold?: number,
): Promise<{
	votes: JudgeVote[];
	skipped: number;
	escalationStopped: boolean;
}> {
	const votes: JudgeVote[] = [];
	let skipped = 0;
	let escalationStopped = false;

	for (const cfg of configs) {
		try {
			const vote = await withTimeout(judgeFn(cfg, input), timeoutMs, cfg.id);
			votes.push(vote);

			if (escalationThreshold !== undefined && votes.length >= 2) {
				const scores = votes.map((v) => v.score);
				const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
				const variance =
					scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
				const stdDev = Math.sqrt(variance);
				if (stdDev <= 1 - escalationThreshold) {
					escalationStopped = true;
					skipped += configs.length - votes.length;
					break;
				}
			}
		} catch {
			skipped++;
		}
	}
	return { votes, skipped, escalationStopped };
}

/**
 * Run judges in cost-tier order (cheap → standard → expensive).
 * Stop early once escalation threshold is met.
 */
async function runEscalation(
	configs: JudgeConfig[],
	input: JudgeInput,
	judgeFn: JudgeFn,
	timeoutMs: number,
	escalationThreshold: number,
): Promise<{
	votes: JudgeVote[];
	skipped: number;
	escalationStopped: boolean;
}> {
	const tierOrder: JudgeConfig["costTier"][] = [
		"cheap",
		"standard",
		"expensive",
	];
	const sorted = [...configs].sort(
		(a, b) => tierOrder.indexOf(a.costTier) - tierOrder.indexOf(b.costTier),
	);
	return runSequential(sorted, input, judgeFn, timeoutMs, escalationThreshold);
}

/**
 * Main entry point — run N judges according to the provided config.
 */
export async function runMultiJudge(
	runConfig: MultiJudgeRunConfig,
	input: JudgeInput,
	judgeFn: JudgeFn,
): Promise<MultiJudgeRunResult> {
	const start = Date.now();
	const { judges, strategy, mode } = runConfig;
	const timeoutMs = runConfig.timeoutMs ?? 30_000;
	const escalationThreshold = runConfig.escalationThreshold ?? 0.85;

	let votes: JudgeVote[];
	let skipped: number;
	let escalationStopped: boolean;

	if (mode === "parallel") {
		const res = await runParallel(judges, input, judgeFn, timeoutMs);
		votes = res.votes;
		skipped = res.skipped;
		escalationStopped = false;
	} else if (mode === "escalation") {
		const res = await runEscalation(
			judges,
			input,
			judgeFn,
			timeoutMs,
			escalationThreshold,
		);
		votes = res.votes;
		skipped = res.skipped;
		escalationStopped = res.escalationStopped;
	} else {
		const res = await runSequential(
			judges,
			input,
			judgeFn,
			timeoutMs,
			runConfig.escalationThreshold,
		);
		votes = res.votes;
		skipped = res.skipped;
		escalationStopped = res.escalationStopped;
	}

	if (votes.length === 0) {
		throw new Error(
			"MultiJudgeEngine: all judges failed or timed out — no votes collected",
		);
	}

	const aggregated = aggregateJudges(votes, strategy);
	const totalLatencyMs = Date.now() - start;

	return {
		aggregated,
		meta: {
			mode,
			judgesRun: votes.length,
			judgesSkipped: skipped,
			escalationStopped,
			totalLatencyMs,
		},
	};
}
