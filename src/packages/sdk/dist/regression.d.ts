/**
 * Regression gate constants and types.
 *
 * These mirror the contracts defined in scripts/regression-gate.ts
 * and evals/schemas/regression-report.schema.json so that SDK consumers
 * can programmatically inspect gate results without parsing strings.
 *
 * @packageDocumentation
 */
/** Exit codes emitted by `evalai gate` / `scripts/regression-gate.ts`. */
export declare const GATE_EXIT: {
    /** Gate passed — no regressions detected */
    readonly PASS: 0;
    /** One or more regression thresholds exceeded */
    readonly REGRESSION: 1;
    /** Infrastructure error (baseline missing, summary missing, etc.) */
    readonly INFRA_ERROR: 2;
    /** Confidence tests failed (test suite red) */
    readonly CONFIDENCE_FAILED: 3;
    /** Confidence summary file missing (test infra crashed) */
    readonly CONFIDENCE_MISSING: 4;
};
export type GateExitCode = (typeof GATE_EXIT)[keyof typeof GATE_EXIT];
/** Categories written to regression-report.json `category` field. */
export declare const GATE_CATEGORY: {
    readonly PASS: "pass";
    readonly REGRESSION: "regression";
    readonly INFRA_ERROR: "infra_error";
};
export type GateCategory = (typeof GATE_CATEGORY)[keyof typeof GATE_CATEGORY];
/** Current schema version for regression-report.json. */
export declare const REPORT_SCHEMA_VERSION = 1;
export interface RegressionDelta {
    metric: string;
    baseline: number | string;
    current: number | string;
    delta: string;
    status: "pass" | "fail";
}
export interface RegressionReport {
    schemaVersion: number;
    timestamp: string;
    exitCode: GateExitCode;
    category: GateCategory;
    passed: boolean;
    failures: string[];
    deltas: RegressionDelta[];
}
export interface BaselineTolerance {
    scoreDrop: number;
    passRateDrop: number;
    maxLatencyIncreaseMs: number;
    maxCostIncreaseUsd: number;
}
export interface Baseline {
    schemaVersion: number;
    description: string;
    generatedAt: string;
    generatedBy: string;
    commitSha: string;
    updatedAt: string;
    updatedBy: string;
    tolerance: BaselineTolerance;
    goldenEval: {
        score: number;
        passRate: number;
        totalCases: number;
        passedCases: number;
    };
    qualityScore: {
        overall: number;
        grade: string;
        accuracy: number;
        safety: number;
        latency: number;
        cost: number;
        consistency: number;
    };
    confidenceTests: {
        unitPassed: boolean;
        unitTotal: number;
        dbPassed: boolean;
        dbTotal: number;
    };
    productMetrics: {
        p95ApiLatencyMs?: number;
        goldenCostUsd?: number;
    };
    qualityMetrics?: {
        unitLaneDurationMs?: number;
        dbLaneDurationMs?: number;
    };
}
/** Well-known artifact paths relative to project root. */
export declare const ARTIFACTS: {
    readonly BASELINE: "evals/baseline.json";
    readonly REGRESSION_REPORT: "evals/regression-report.json";
    readonly CONFIDENCE_SUMMARY: "evals/confidence-summary.json";
    readonly LATENCY_BENCHMARK: "evals/latency-benchmark.json";
};
