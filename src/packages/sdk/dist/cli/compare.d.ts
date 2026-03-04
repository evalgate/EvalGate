/**
 * evalgate compare — Side-by-side result file comparison
 *
 * Compares two or more saved run result JSON files. Does NOT re-run anything.
 * You run each model/config separately (evalgate run --write-results),
 * then compare the saved artifacts. Shows wins/losses/ties per spec.
 *
 * Usage:
 *   evalgate compare --base .evalgate/runs/run-a.json --head .evalgate/runs/run-b.json
 *   evalgate compare --base gpt4o.json --head claude.json --labels "GPT-4o" "Claude 3.5"
 *   evalgate compare --runs run-a.json run-b.json run-c.json
 */
export interface CompareOptions {
    /** Paths to run result files to compare */
    runs: string[];
    /** Human-readable labels for each run (e.g., model names) */
    labels?: string[];
    /** Output format */
    format?: "human" | "json";
    /** Sort by: name, score-delta, status */
    sortBy?: "name" | "score" | "duration";
}
/**
 * Per-spec comparison row
 */
export interface CompareRow {
    specId: string;
    name: string;
    filePath: string;
    results: Array<{
        label: string;
        status: "passed" | "failed" | "skipped" | "missing";
        score?: number;
        duration: number;
        error?: string;
    }>;
    /** Which run "won" (highest score), or null if tied */
    winner: string | null;
}
/**
 * Overall comparison result
 */
export interface CompareResult {
    schemaVersion: 1;
    labels: string[];
    runIds: string[];
    specs: CompareRow[];
    summary: {
        /** Wins per label */
        wins: Record<string, number>;
        /** Ties count */
        ties: number;
        /** Per-label aggregates */
        aggregates: Array<{
            label: string;
            runId: string;
            passed: number;
            failed: number;
            avgScore: number;
            avgDuration: number;
            totalDuration: number;
        }>;
    };
}
/**
 * Run the comparison
 */
export declare function runCompare(options: CompareOptions, projectRoot?: string): Promise<CompareResult>;
/**
 * Print human-readable comparison
 */
export declare function printHumanCompare(result: CompareResult): void;
/**
 * Print JSON comparison
 */
export declare function printJsonCompare(result: CompareResult): void;
/**
 * CLI entry point for compare
 */
export declare function runCompareCLI(options: CompareOptions): Promise<void>;
