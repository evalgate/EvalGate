/**
 * evalgate explain — Offline report explainer.
 *
 * Reads the last check/gate report artifact and prints:
 *   1. Top failing test cases (up to 3)
 *   2. What changed (baseline vs current)
 *   3. Likely root cause class
 *   4. Suggested fix actions
 *
 * Works offline — no network calls. Designed for CI logs.
 *
 * Usage:
 *   evalgate explain                             # reads evals/regression-report.json or .evalgate/last-report.json
 *   evalgate explain --report path/to/report.json
 *   evalgate explain --format json
 *
 * Exit codes:
 *   0 — Explained successfully
 *   1 — Report not found or unreadable
 */
export interface ExplainFlags {
    reportPath: string | null;
    format: "human" | "json";
}
export type RootCauseClass = "prompt_drift" | "retrieval_drift" | "formatting_drift" | "tool_use_drift" | "safety_regression" | "cost_regression" | "latency_regression" | "coverage_drop" | "baseline_stale" | "unknown" | "specification_gap" | "generalization_failure";
export interface SuggestedFix {
    action: string;
    detail: string;
    priority: "high" | "medium" | "low";
}
export interface ExplainOutput {
    verdict: string;
    score?: number;
    baselineScore?: number;
    delta?: number;
    reasonCode?: string;
    reasonMessage?: string;
    topFailures: Array<{
        rank: number;
        name?: string;
        input?: string;
        expected?: string;
        actual?: string;
        reason?: string;
    }>;
    totalFailures: number;
    changes: Array<{
        metric: string;
        baseline: string;
        current: string;
        direction: "better" | "worse" | "same";
    }>;
    rootCauses: RootCauseClass[];
    suggestedFixes: SuggestedFix[];
    reportPath: string;
}
export declare function parseExplainFlags(argv: string[]): ExplainFlags;
export declare function runExplain(argv: string[]): Promise<number>;
