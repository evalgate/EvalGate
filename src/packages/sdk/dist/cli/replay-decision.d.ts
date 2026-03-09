/**
 * Replay decision logic for normalized budget evaluation
 * Compares pass rates (corrected when available) within budget constraints
 */
export interface ReplayDecision {
    action: "keep" | "discard";
    reason: "pass_rate_improved" | "pass_rate_declined" | "budget_exceeded";
    previousPassRate: number;
    newPassRate: number;
    previousCorrectedPassRate: number | null;
    newCorrectedPassRate: number | null;
    comparisonBasis: "corrected" | "raw";
    budgetUsed: number;
    budgetLimit: number;
}
export interface RunResultWithCorrected {
    summary: {
        passRate: number;
        correctedPassRate?: number | null;
        totalCostUsd?: number;
    };
    results: Array<any>;
}
export interface NormalizedBudgetConfig {
    mode: "traces" | "cost";
    maxTraces?: number;
    maxCostUsd?: number;
}
/**
 * Evaluate replay outcome based on pass rate improvement and budget compliance
 * Uses corrected pass rates when available, falls back to raw rates
 */
export declare function evaluateReplayOutcome(previousRun: RunResultWithCorrected, newRun: RunResultWithCorrected, budgetConfig: NormalizedBudgetConfig): ReplayDecision;
