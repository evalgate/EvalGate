"use strict";
/**
 * Regression gate constants and types.
 *
 * These mirror the contracts defined in scripts/regression-gate.ts
 * and evals/schemas/regression-report.schema.json so that SDK consumers
 * can programmatically inspect gate results without parsing strings.
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARTIFACTS = exports.REPORT_SCHEMA_VERSION = exports.GATE_CATEGORY = exports.GATE_EXIT = void 0;
// ── Exit codes ──
/** Exit codes emitted by `evalai gate` / `scripts/regression-gate.ts`. */
exports.GATE_EXIT = {
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
};
// ── Report categories ──
/** Categories written to regression-report.json `category` field. */
exports.GATE_CATEGORY = {
    PASS: "pass",
    REGRESSION: "regression",
    INFRA_ERROR: "infra_error",
};
// ── Schema version ──
/** Current schema version for regression-report.json. */
exports.REPORT_SCHEMA_VERSION = 1;
// ── Artifact paths ──
/** Well-known artifact paths relative to project root. */
exports.ARTIFACTS = {
    BASELINE: "evals/baseline.json",
    REGRESSION_REPORT: "evals/regression-report.json",
    CONFIDENCE_SUMMARY: "evals/confidence-summary.json",
    LATENCY_BENCHMARK: "evals/latency-benchmark.json",
};
