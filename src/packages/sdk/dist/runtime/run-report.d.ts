/**
 * RUNTIME-104: Deterministic Report Serialization (RunReport v1)
 *
 * Stable report format for downstream processing (explain, diff, history).
 * Mirrors CheckReport conventions for consistency.
 */
import type { EnhancedEvalResult, ExecutionErrorEnvelope } from "./types";
/**
 * RunReport schema version - increment when breaking changes occur
 */
export declare const RUN_REPORT_SCHEMA_VERSION = "1";
/**
 * Main run report structure
 * Mirrors CheckReport conventions for consistency
 */
export interface RunReport {
    /** Schema version for compatibility */
    schemaVersion: string;
    /** Unique run identifier */
    runId: string;
    /** Run start timestamp */
    startedAt: string;
    /** Run completion timestamp */
    finishedAt: string;
    /** Runtime information */
    runtime: {
        /** Runtime ID */
        id: string;
        /** Project namespace */
        namespace: string;
        /** Project root path */
        projectRoot: string;
    };
    /** Execution results (sorted by testId for determinism) */
    results: RunResult[];
    /** Failures and errors (sorted by testId for determinism) */
    failures: RunFailure[];
    /** Execution summary */
    summary: RunSummary;
    /** Execution configuration */
    config: RunConfig;
    /** Serialize to JSON string */
    toJSON(): string;
}
/**
 * Individual test result
 */
export interface RunResult {
    /** Test specification ID */
    testId: string;
    /** Test specification name */
    testName: string;
    /** File path where test is defined */
    filePath: string;
    /** AST position in file */
    position: {
        line: number;
        column: number;
    };
    /** Test input */
    input: string;
    /** Pass/fail determination */
    pass: boolean;
    /** Numeric score (0-100) */
    score: number;
    /** Execution duration in milliseconds */
    durationMs: number;
    /** Test metadata */
    metadata?: Record<string, unknown>;
    /** Test tags */
    tags?: string[];
    /** Assertion results if available */
    assertions?: Array<{
        name: string;
        passed: boolean;
        message?: string;
    }>;
}
/**
 * Failure or error information
 */
export interface RunFailure {
    /** Test specification ID */
    testId: string;
    /** Test specification name */
    testName: string;
    /** File path where test is defined */
    filePath: string;
    /** AST position in file */
    position: {
        line: number;
        column: number;
    };
    /** Failure classification */
    classification: "failed" | "error" | "timeout";
    /** Error envelope for errors/timeouts */
    errorEnvelope?: ExecutionErrorEnvelope;
    /** Human-readable error message */
    message: string;
    /** Failure timestamp */
    timestamp: string;
}
/**
 * Execution summary statistics
 */
export interface RunSummary {
    /** Total number of tests */
    total: number;
    /** Number of passed tests */
    passed: number;
    /** Number of failed tests */
    failed: number;
    /** Number of errors */
    errors: number;
    /** Number of timeouts */
    timeouts: number;
    /** Overall pass rate (0-100) */
    passRate: number;
    /** Average score (0-100) */
    averageScore: number;
    /** Total execution duration */
    totalDurationMs: number;
    /** Execution success (no errors/timeouts) */
    success: boolean;
}
/**
 * Execution configuration
 */
export interface RunConfig {
    /** Executor type */
    executorType: string;
    /** Maximum parallel workers */
    maxParallel?: number;
    /** Default timeout in milliseconds */
    defaultTimeout: number;
    /** Environment information */
    environment: {
        nodeVersion: string;
        platform: string;
        arch: string;
    };
}
/**
 * RunReport builder for creating deterministic reports
 */
export declare class RunReportBuilder {
    private report;
    /**
     * Initialize report with basic metadata
     */
    constructor(runId: string, runtimeInfo: {
        id: string;
        namespace: string;
        projectRoot: string;
    });
    /**
     * Add a test result to the report
     */
    addResult(testId: string, testName: string, filePath: string, position: {
        line: number;
        column: number;
    }, input: string, result: EnhancedEvalResult, tags?: string[]): void;
    /**
     * Update summary statistics
     */
    private updateSummary;
    /**
     * Add a failure to the report
     */
    private addFailure;
    /**
     * Set execution configuration
     */
    setConfig(config: Partial<RunConfig>): void;
    /**
     * Finalize and return the complete report
     */
    build(): RunReport;
    /**
     * Serialize report to JSON string
     * Ensures deterministic output
     */
    toJSON(): string;
    /**
     * Write report to file
     */
    writeToFile(filePath: string): Promise<void>;
}
/**
 * Create a new RunReport builder
 */
export declare function createRunReport(runId: string, runtimeInfo: {
    id: string;
    namespace: string;
    projectRoot: string;
}): RunReportBuilder;
/**
 * Parse a RunReport from JSON string
 */
export declare function parseRunReport(json: string): RunReport;
