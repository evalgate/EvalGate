/**
 * TICKET 4 — Unified evalai run CLI Command
 *
 * Goal: Consolidated execution interface that consumes manifest
 *
 * Features:
 * - Manifest loading and spec filtering
 * - --impacted-only integration with impact analysis
 * - Local executor integration
 * - .evalai/last-run.json output
 * - Legacy mode compatibility
 */
/**
 * Run execution options
 */
export interface RunOptions {
    /** Filter to specific spec IDs */
    specIds?: string[];
    /** Run only impacted specs (requires base branch) */
    impactedOnly?: boolean;
    /** Base branch for impact analysis */
    baseBranch?: string;
    /** Output format */
    format?: "human" | "json";
    /** Write run results to file */
    writeResults?: boolean;
}
/**
 * Run execution result
 */
export interface RunResult {
    /** Schema version for compatibility checking */
    schemaVersion: number;
    /** Unique run identifier */
    runId: string;
    /** Execution metadata */
    metadata: {
        startedAt: number;
        completedAt: number;
        duration: number;
        totalSpecs: number;
        executedSpecs: number;
        mode: "spec" | "legacy";
    };
    /** Individual spec results */
    results: SpecResult[];
    /** Summary statistics */
    summary: {
        passed: number;
        failed: number;
        skipped: number;
        passRate: number;
    };
}
/**
 * Individual spec result
 */
export interface SpecResult {
    /** Spec identifier */
    specId: string;
    /** Spec name */
    name: string;
    /** File path */
    filePath: string;
    /** Execution result */
    result: {
        status: "passed" | "failed" | "skipped";
        score?: number;
        error?: string;
        duration: number;
    };
}
/**
 * Run evaluation specifications
 */
export declare function runEvaluations(options: RunOptions, projectRoot?: string): Promise<RunResult>;
/**
 * Run index entry
 */
export interface RunIndexEntry {
    runId: string;
    createdAt: number;
    gitSha?: string;
    branch?: string;
    mode: "spec" | "legacy";
    specCount: number;
    passRate: number;
    avgScore: number;
}
/**
 * Print human-readable results
 */
export declare function printHumanResults(result: RunResult): void;
/**
 * Print JSON results
 */
export declare function printJsonResults(result: RunResult): void;
/**
 * CLI entry point
 */
export declare function runEvaluationsCLI(options: RunOptions): Promise<void>;
