/**
 * UX-401: One-command CI loop (evalgate ci)
 *
 * Provides a single command teams put in .github/workflows/* and never think about again.
 */
import type { DiffResult } from "./diff";
import type { RunResult } from "./run";
/**
 * CI command options
 */
export interface CIOptions {
    /** Base reference for diff comparison */
    base?: string;
    /** Run only impacted specs */
    impactedOnly?: boolean;
    /** Output format */
    format?: "human" | "json" | "github";
    /** Write run results */
    writeResults?: boolean;
}
/**
 * CI execution result
 */
export interface CIResult {
    /** Success status */
    success: boolean;
    /** Exit code */
    exitCode: number;
    /** Execution narrative */
    narrative: string;
    /** Run result (if executed) */
    runResult?: RunResult;
    /** Diff result (if executed) */
    diffResult?: DiffResult;
    /** Error message (if failed) */
    error?: string;
}
/**
 * Run CI command
 */
export declare function runCI(options: CIOptions, projectRoot?: string): Promise<CIResult>;
/**
 * CLI entry point
 */
export declare function runCICLI(options: CIOptions): Promise<void>;
