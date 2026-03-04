/**
 * Structured trace writer for evalgate runs
 *
 * Auto-writes structured JSON to .evalgate/traces/ on every defineEval result.
 * Each trace captures: spec identity, timing, assertions, score, and metadata.
 *
 * Trace files are append-friendly and suitable for post-hoc analysis.
 */
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
export declare function calculatePercentiles(durations: number[]): {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
};
/**
 * Build a RunTrace from a RunResult
 */
export declare function buildRunTrace(result: RunResult, gitInfo?: {
    sha?: string;
    branch?: string;
}): RunTrace;
/**
 * Write structured trace files to .evalgate/traces/
 */
export declare function writeTraces(result: RunResult, projectRoot?: string, gitInfo?: {
    sha?: string;
    branch?: string;
}): Promise<string>;
/**
 * Format latency percentiles for human display
 */
export declare function formatLatencyTable(latency: RunTrace["latency"]): string;
