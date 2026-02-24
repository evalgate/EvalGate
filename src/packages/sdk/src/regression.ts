/**
 * Regression gate constants and types.
 *
 * These mirror the contracts defined in scripts/regression-gate.ts
 * and evals/schemas/regression-report.schema.json so that SDK consumers
 * can programmatically inspect gate results without parsing strings.
 *
 * @packageDocumentation
 */

// ── Exit codes ──

/** Exit codes emitted by `evalai gate` / `scripts/regression-gate.ts`. */
export const GATE_EXIT = {
  /** Gate passed — no regressions detected */
  PASS: 0,
  /** One or more regression thresholds exceeded */
  REGRESSION: 1,
  /** Infrastructure error (baseline missing, summary missing, etc.) */
  INFRA_ERROR: 2,
  /** Confidence tests failed (test suite red) */
  CONFIDENCE_FAILED: 3,
  /** Confidence summary file missing (test infra crashed) */
  CONFIDENCE_MISSING: 4,
} as const;

export type GateExitCode = (typeof GATE_EXIT)[keyof typeof GATE_EXIT];

// ── Report categories ──

/** Categories written to regression-report.json `category` field. */
export const GATE_CATEGORY = {
  PASS: "pass",
  REGRESSION: "regression",
  INFRA_ERROR: "infra_error",
} as const;

export type GateCategory = (typeof GATE_CATEGORY)[keyof typeof GATE_CATEGORY];

// ── Schema version ──

/** Current schema version for regression-report.json. */
export const REPORT_SCHEMA_VERSION = 1;

// ── Report types ──

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

// ── Baseline types ──

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

// ── Artifact paths ──

/** Well-known artifact paths relative to project root. */
export const ARTIFACTS = {
  BASELINE: "evals/baseline.json",
  REGRESSION_REPORT: "evals/regression-report.json",
  CONFIDENCE_SUMMARY: "evals/confidence-summary.json",
  LATENCY_BENCHMARK: "evals/latency-benchmark.json",
} as const;
