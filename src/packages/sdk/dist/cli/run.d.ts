/**
 * TICKET 4 — Unified evalgate run CLI Command
 *
 * Goal: Consolidated execution interface that consumes manifest
 *
 * Features:
 * - Manifest loading and spec filtering
 * - --impacted-only integration with impact analysis
 * - Local executor integration
 * - .evalgate/last-run.json output
 * - Legacy mode compatibility
 */
import { type EvalAIConfig } from "./config";
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
        /** Per-failure-mode frequency counts (from labeled dataset) */
        failureModes?: Record<string, number>;
        /** Budget tracking information */
        budget?: {
            mode: "traces" | "cost";
            used: number;
            limit: number;
            exceeded: boolean;
        };
        /** Total cost in USD (when cost mode is used) */
        totalCostUsd?: number;
        /** Corrected pass rate from judge alignment (when available) */
        correctedPassRate?: number | null;
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
    /** Input text — populated when executor provides it, used for labeling */
    input?: string;
    /** Expected output — populated when executor provides it, used for labeling */
    expected?: string;
    /** Actual output — populated when executor provides it, used for labeling */
    actual?: string;
}
/**
 * Schema version for RunResult — bump on breaking changes.
 */
export declare const RUN_RESULT_SCHEMA_VERSION = 1;
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
export declare function printHumanResults(result: RunResult, config?: EvalAIConfig | null): void;
/**
 * Print JSON results
 */
export declare function printJsonResults(result: RunResult): void;
/**
 * CLI entry point
 */
export declare function runEvaluationsCLI(options: RunOptions): Promise<number>;
