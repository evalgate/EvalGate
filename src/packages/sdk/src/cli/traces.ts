/**
 * Structured trace writer for evalgate runs
 *
 * Auto-writes structured JSON to .evalgate/traces/ on every defineEval result.
 * Each trace captures: spec identity, timing, assertions, score, and metadata.
 *
 * Trace files are append-friendly and suitable for post-hoc analysis.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RunResult } from "./run";

/**
 * Individual spec trace record
 */
export interface SpecTrace {
	/** Trace schema version */
	schemaVersion: 1;
	/** Timestamp of trace creation */
	timestamp: number;
	/** ISO timestamp */
	timestampISO: string;
	/** Run ID this trace belongs to */
	runId: string;
	/** Spec identity */
	spec: {
		id: string;
		name: string;
		filePath: string;
	};
	/** Execution details */
	execution: {
		status: "passed" | "failed" | "skipped";
		score?: number;
		duration: number;
		error?: string;
	};
	/** Git context (if available) */
	git?: {
		sha?: string;
		branch?: string;
	};
	/** Environment */
	env: {
		nodeVersion: string;
		platform: string;
		ci: boolean;
	};
}

/**
 * Run-level trace summary
 */
export interface RunTrace {
	/** Trace schema version */
	schemaVersion: 1;
	/** Run metadata */
	run: {
		id: string;
		startedAt: number;
		completedAt: number;
		duration: number;
		mode: string;
	};
	/** Summary statistics */
	summary: {
		total: number;
		passed: number;
		failed: number;
		skipped: number;
		passRate: number;
	};
	/** Latency statistics */
	latency: {
		min: number;
		max: number;
		mean: number;
		p50: number;
		p95: number;
		p99: number;
	};
	/** Individual spec traces */
	specs: SpecTrace[];
}

/**
 * Calculate latency percentiles from durations
 */
export function calculatePercentiles(durations: number[]): {
	min: number;
	max: number;
	mean: number;
	p50: number;
	p95: number;
	p99: number;
} {
	if (durations.length === 0) {
		return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
	}

	const sorted = [...durations].sort((a, b) => a - b);
	const len = sorted.length;
	const sum = sorted.reduce((a, b) => a + b, 0);

	return {
		min: sorted[0],
		max: sorted[len - 1],
		mean: Math.round(sum / len),
		p50: sorted[Math.floor(len * 0.5)],
		p95: sorted[Math.min(Math.floor(len * 0.95), len - 1)],
		p99: sorted[Math.min(Math.floor(len * 0.99), len - 1)],
	};
}

/**
 * Build a RunTrace from a RunResult
 */
export function buildRunTrace(
	result: RunResult,
	gitInfo?: { sha?: string; branch?: string },
): RunTrace {
	const now = Date.now();
	const isCI =
		!!process.env.CI || !!process.env.GITHUB_ACTIONS || !!process.env.GITLAB_CI;

	const specTraces: SpecTrace[] = result.results.map((spec) => ({
		schemaVersion: 1 as const,
		timestamp: now,
		timestampISO: new Date(now).toISOString(),
		runId: result.runId,
		spec: {
			id: spec.specId,
			name: spec.name,
			filePath: spec.filePath,
		},
		execution: {
			status: spec.result.status,
			score: spec.result.score,
			duration: spec.result.duration,
			error: spec.result.error,
		},
		git: gitInfo,
		env: {
			nodeVersion: process.version,
			platform: process.platform,
			ci: isCI,
		},
	}));

	const durations = result.results
		.filter((r) => r.result.status !== "skipped")
		.map((r) => r.result.duration);

	const latency = calculatePercentiles(durations);

	return {
		schemaVersion: 1,
		run: {
			id: result.runId,
			startedAt: result.metadata.startedAt,
			completedAt: result.metadata.completedAt,
			duration: result.metadata.duration,
			mode: result.metadata.mode,
		},
		summary: {
			total: result.results.length,
			passed: result.summary.passed,
			failed: result.summary.failed,
			skipped: result.summary.skipped,
			passRate: result.summary.passRate,
		},
		latency,
		specs: specTraces,
	};
}

/**
 * Write structured trace files to .evalgate/traces/
 */
export async function writeTraces(
	result: RunResult,
	projectRoot: string = process.cwd(),
	gitInfo?: { sha?: string; branch?: string },
): Promise<string> {
	const tracesDir = path.join(projectRoot, ".evalgate", "traces");
	await fs.mkdir(tracesDir, { recursive: true });

	const runTrace = buildRunTrace(result, gitInfo);

	// Write run-level trace
	const traceFileName = `${result.runId}.trace.json`;
	const tracePath = path.join(tracesDir, traceFileName);
	await fs.writeFile(tracePath, JSON.stringify(runTrace, null, 2), "utf-8");

	// Update latest symlink
	const latestPath = path.join(tracesDir, "latest.trace.json");
	await fs.writeFile(latestPath, JSON.stringify(runTrace, null, 2), "utf-8");

	return tracePath;
}

/**
 * Format latency percentiles for human display
 */
export function formatLatencyTable(latency: RunTrace["latency"]): string {
	const lines = [
		"⏱️  Latency Percentiles:",
		`   min:  ${latency.min}ms`,
		`   p50:  ${latency.p50}ms`,
		`   p95:  ${latency.p95}ms`,
		`   p99:  ${latency.p99}ms`,
		`   max:  ${latency.max}ms`,
		`   mean: ${latency.mean}ms`,
	];
	return lines.join("\n");
}
