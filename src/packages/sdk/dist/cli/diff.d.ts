/**
 * TICKET 5 — Behavioral Diff CLI (EVAL-401)
 *
 * Goal: "Git diff for AI behavior" from two RunReports
 *
 * Command:
 * evalgate diff --base main (default uses git to find baseline run)
 * evalgate diff --a <runReportPath> --b <runReportPath>
 * evalgate diff main..feature (nice-to-have alias)
 */
import type { RunResult } from "./run";
/**
 * Diff schema version
 */
export declare const DIFF_SCHEMA_VERSION = 1;
/**
 * Supported RunReport schema versions
 */
export declare const SUPPORTED_SCHEMA_VERSIONS: readonly [1];
/**
 * Rounding helpers for floating point normalization
 */
export declare function round(value: number, precision?: number): number;
export declare function roundPct(value: number, precision?: number): number;
/**
 * Validate RunReport schema version
 */
export declare function validateSchemaVersion(report: RunResult): void;
/**
 * Diff result classification
 */
export type DiffClassification = "new_failure" | "fixed_failure" | "score_drop" | "score_improve" | "execution_error" | "skipped_change" | "added" | "removed";
/**
 * Individual spec diff
 */
export interface SpecDiff {
    /** Spec identifier */
    specId: string;
    /** Spec name */
    name: string;
    /** File path */
    filePath: string;
    /** Classification of change */
    classification: DiffClassification;
    /** Base run result (if exists) */
    base?: {
        status: "passed" | "failed" | "skipped";
        score?: number;
        duration: number;
        error?: string;
    };
    /** Head run result (if exists) */
    head?: {
        status: "passed" | "failed" | "skipped";
        score?: number;
        duration: number;
        error?: string;
    };
    /** Calculated deltas */
    deltas: {
        scoreDelta?: number;
        durationDelta?: number;
        statusChange?: string;
    };
}
/**
 * Diff summary statistics
 */
export interface DiffSummary {
    /** Total specs in base */
    baseTotal: number;
    /** Total specs in head */
    headTotal: number;
    /** Pass rate delta */
    passRateDelta: number;
    /** Score delta (average) */
    scoreDelta: number;
    /** Number of regressions */
    regressions: number;
    /** Number of improvements */
    improvements: number;
    /** Number of added specs */
    added: number;
    /** Number of removed specs */
    removed: number;
}
/**
 * Complete diff result
 */
export interface DiffResult {
    /** Schema version */
    schemaVersion: number;
    /** Base run report */
    base: RunResult;
    /** Head run report */
    head: RunResult;
    /** Diff summary */
    summary: DiffSummary;
    /** Individual spec diffs */
    changedSpecs: SpecDiff[];
    /** Diff metadata */
    metadata: {
        generatedAt: number;
        baseSource: string;
        headSource: string;
    };
}
/**
 * Diff options
 */
export interface DiffOptions {
    /** Base report path or branch */
    base?: string;
    /** Head report path */
    head?: string;
    /** Output format */
    format?: "human" | "json";
}
/**
 * Run diff comparison
 */
export declare function runDiff(options: DiffOptions): Promise<DiffResult>;
/**
 * Compare two run reports
 */
export declare function compareReports(base: RunResult, head: RunResult): DiffResult;
/**
 * Classify the type of change
 */
declare function classifyDiff(base?: RunResult["results"][0], head?: RunResult["results"][0]): DiffClassification;
/**
 * Calculate deltas between base and head
 */
declare function calculateDeltas(base?: RunResult["results"][0], head?: RunResult["results"][0]): SpecDiff["deltas"];
/**
 * Calculate diff summary statistics
 */
export declare function calculateDiffSummary(base: RunResult, head: RunResult, changedSpecs: SpecDiff[]): DiffSummary;
/**
 * Print human-readable diff results
 */
export declare function printHumanResults(result: DiffResult): void;
/**
 * Print JSON results
 */
export declare function printJsonResults(result: DiffResult): void;
/**
 * Write GitHub Step Summary
 */
export declare function writeGitHubStepSummary(result: DiffResult): Promise<void>;
/**
 * CLI entry point
 */
export declare function runDiffCLI(options: DiffOptions): Promise<void>;
export { classifyDiff, calculateDeltas };
export declare const diffCore: {
    /**
     * Compare two run reports and return diff result
     */
    readonly diffRunReports: typeof compareReports;
    /**
     * Classify the type of change between two specs
     */
    readonly classifyChange: typeof classifyDiff;
    /**
     * Calculate summary statistics for a diff
     */
    readonly summarizeDiff: typeof calculateDiffSummary;
    /**
     * Calculate deltas between two spec results
     */
    readonly calculateDeltas: typeof calculateDeltas;
};
