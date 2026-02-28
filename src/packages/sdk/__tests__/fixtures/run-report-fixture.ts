/**
 * Shared fixture builders for RunReport testing
 *
 * Provides deterministic, representative test data for diff operations
 */

import type { RunResult } from "../../src/cli/run";

/**
 * Create a spec result with all required properties
 */
export function makeSpecResult(options: {
  id: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  score?: number;
  durationMs: number;
  error?: string;
  filePath?: string;
}): RunResult["results"][0] {
  return {
    specId: options.id,
    name: options.name,
    filePath: options.filePath || `eval/${options.id}.spec.ts`,
    result: {
      status: options.status,
      score: options.score,
      duration: options.durationMs,
      error: options.error,
    },
  };
}

/**
 * Create a complete RunReport with deterministic properties
 */
export function makeRunReport(options: {
  specs: RunResult["results"][0][];
  runId?: string;
  startedAt?: number;
  completedAt?: number;
  mode?: "spec" | "legacy";
}): RunResult {
  const startedAt = options.startedAt ?? 1000000000000;
  const completedAt = options.completedAt ?? startedAt + 1000;
  const duration = completedAt - startedAt;

  const passed = options.specs.filter((s) => s.result.status === "passed").length;
  const failed = options.specs.filter((s) => s.result.status === "failed").length;
  const skipped = options.specs.filter((s) => s.result.status === "skipped").length;
  const total = options.specs.length;

  return {
    schemaVersion: 1,
    runId: options.runId ?? "test-run-001",
    metadata: {
      startedAt,
      completedAt,
      duration,
      totalSpecs: total,
      executedSpecs: total,
      mode: options.mode ?? "spec",
    },
    results: options.specs,
    summary: {
      passed,
      failed,
      skipped,
      passRate: total > 0 ? passed / total : 0,
    },
  };
}

/**
 * Create a baseline report with 2 standard specs
 */
export function makeBaselineReport(): RunResult {
  return makeRunReport({
    runId: "baseline-001",
    startedAt: 1000000000000,
    completedAt: 1000000001500,
    specs: [
      makeSpecResult({
        id: "spec1",
        name: "test-eval-1",
        status: "passed",
        score: 0.85,
        durationMs: 100,
      }),
      makeSpecResult({
        id: "spec2",
        name: "test-eval-2",
        status: "passed",
        score: 0.9,
        durationMs: 150,
      }),
    ],
  });
}

/**
 * Create a head report based on baseline with optional modifications
 */
export function makeHeadReport(modifications?: {
  specChanges?: Partial<{
    spec1: Partial<Parameters<typeof makeSpecResult>[0]>;
    spec2: Partial<Parameters<typeof makeSpecResult>[0]>;
  }>;
  addSpecs?: Parameters<typeof makeSpecResult>[0][];
  removeSpecs?: string[];
}): RunResult {
  const baseline = makeBaselineReport();
  let specs = [...baseline.results];

  // Apply spec modifications
  if (modifications?.specChanges) {
    specs = specs.map((spec) => {
      if (spec.specId === "spec1" && modifications.specChanges?.spec1) {
        return makeSpecResult({
          id: spec.specId,
          name: spec.name,
          status: spec.result.status,
          score: spec.result.score,
          durationMs: spec.result.duration,
          error: spec.result.error,
          filePath: spec.filePath,
          ...modifications.specChanges.spec1,
        });
      }
      if (spec.specId === "spec2" && modifications.specChanges?.spec2) {
        return makeSpecResult({
          id: spec.specId,
          name: spec.name,
          status: spec.result.status,
          score: spec.result.score,
          durationMs: spec.result.duration,
          error: spec.result.error,
          filePath: spec.filePath,
          ...modifications.specChanges.spec2,
        });
      }
      return spec;
    });
  }

  // Add new specs
  if (modifications?.addSpecs) {
    const newSpecs = modifications.addSpecs.map((options) => makeSpecResult(options));
    specs = [...specs, ...newSpecs];
  }

  // Remove specs
  if (modifications?.removeSpecs) {
    specs = specs.filter((spec) => !modifications.removeSpecs!.includes(spec.specId));
  }

  return makeRunReport({
    runId: "head-001",
    startedAt: 1000000002000,
    completedAt: 1000000002500,
    specs,
  });
}

/**
 * Create identical reports for testing no-change scenarios
 */
export function makeIdenticalReports(): { baseline: RunResult; head: RunResult } {
  const baseline = makeBaselineReport();
  const head = makeRunReport({
    runId: "head-001",
    startedAt: 1000000002000,
    completedAt: 1000000002500,
    specs: baseline.results.map((spec) => ({ ...spec })), // Deep copy
  });

  return { baseline, head };
}
