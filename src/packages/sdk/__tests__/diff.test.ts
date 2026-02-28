/**
 * Diff command tests
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diffCore, runDiff } from "../src/cli/diff";
import type { RunResult } from "../src/cli/run";
import {
  makeBaselineReport,
  makeHeadReport,
  makeIdenticalReports,
  makeSpecResult,
} from "./fixtures/run-report-fixture";

describe("Diff Command", () => {
  const testDir = path.join(process.cwd(), ".test-diff");
  const baselinePath = path.join(testDir, "baseline.json");
  const headPath = path.join(testDir, "head.json");

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should detect no changes when reports are identical", async () => {
    const { baseline, head } = makeIdenticalReports();

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.summary.regressions).toBe(0);
    expect(result.summary.improvements).toBe(0);
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
    expect(result.changedSpecs).toHaveLength(0);
  });

  it("should detect new failure", async () => {
    const baseline = makeBaselineReport();
    const head = makeHeadReport({
      specChanges: {
        spec1: {
          status: "failed",
          score: 0.45,
          durationMs: 200,
          error: "Simulated regression",
        },
      },
    });

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.summary.regressions).toBe(1);
    expect(result.summary.improvements).toBe(0);
    expect(result.summary.passRateDelta).toBe(-0.5);
    expect(result.summary.scoreDelta).toBeLessThan(0);

    const changedSpec = result.changedSpecs[0];
    expect(changedSpec.classification).toBe("new_failure");
    expect(changedSpec.specId).toBe("spec1");
    expect(changedSpec.deltas.statusChange).toBe("passed → failed");
  });

  it("should detect fixed failure", async () => {
    const baseline = makeHeadReport({
      specChanges: {
        spec1: {
          status: "failed",
          score: 0.3,
          durationMs: 120,
          error: "Previous error",
        },
      },
    });
    const head = makeBaselineReport();

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.summary.regressions).toBe(0);
    expect(result.summary.improvements).toBe(1);
    expect(result.summary.passRateDelta).toBe(0.5);

    const changedSpec = result.changedSpecs[0];
    expect(changedSpec.classification).toBe("fixed_failure");
    expect(changedSpec.deltas.statusChange).toBe("failed → passed");
  });

  it("should detect score drop", async () => {
    const baseline = makeBaselineReport();
    const head = makeHeadReport({
      specChanges: {
        spec1: {
          score: 0.7, // Dropped from 0.85
        },
      },
    });

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.summary.regressions).toBe(1);
    expect(result.summary.improvements).toBe(0);

    const changedSpec = result.changedSpecs[0];
    expect(changedSpec.classification).toBe("score_drop");
    expect(changedSpec.deltas.scoreDelta).toBeCloseTo(-0.15, 2);
  });

  it("should detect score improvement", async () => {
    const baseline = makeBaselineReport();
    const head = makeHeadReport({
      specChanges: {
        spec1: {
          score: 0.95, // Improved from 0.85
        },
      },
    });

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.summary.regressions).toBe(0);
    expect(result.summary.improvements).toBe(1);

    const changedSpec = result.changedSpecs[0];
    expect(changedSpec.classification).toBe("score_improve");
    expect(changedSpec.deltas.scoreDelta).toBeCloseTo(0.1, 2);
  });

  it("should detect added spec", async () => {
    const baseline = makeBaselineReport();
    const head = makeHeadReport({
      addSpecs: [
        {
          id: "spec3",
          name: "test-eval-3",
          status: "passed",
          score: 0.88,
          durationMs: 120,
        },
      ],
    });

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.summary.added).toBe(1);
    expect(result.summary.removed).toBe(0);

    const addedSpec = result.changedSpecs.find((s) => s.classification === "added");
    expect(addedSpec).toBeDefined();
    expect(addedSpec?.specId).toBe("spec3");
    expect(addedSpec?.base).toBeUndefined();
    expect(addedSpec?.head).toBeDefined();
  });

  it("should detect removed spec", async () => {
    const baseline = makeBaselineReport();
    const head = makeHeadReport({
      removeSpecs: ["spec2"],
    });

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(1);

    const removedSpec = result.changedSpecs.find((s) => s.classification === "removed");
    expect(removedSpec).toBeDefined();
    expect(removedSpec?.specId).toBe("spec2");
    expect(removedSpec?.base).toBeDefined();
    expect(removedSpec?.head).toBeUndefined();
  });

  it("should sort changed specs by severity then ID", async () => {
    const baseline = makeBaselineReport();
    const head = makeHeadReport({
      specChanges: {
        spec1: {
          status: "failed",
          score: 0.45,
          durationMs: 120,
          error: "Regression",
        },
        spec2: {
          score: 0.7, // Score drop
        },
      },
    });

    await fs.writeFile(baselinePath, JSON.stringify(baseline));
    await fs.writeFile(headPath, JSON.stringify(head));

    const result = await runDiff({ base: baselinePath, head: headPath });

    expect(result.changedSpecs).toHaveLength(2);
    // new_failure (severity 1) should come before score_drop (severity 2)
    expect(result.changedSpecs[0].classification).toBe("new_failure");
    expect(result.changedSpecs[0].specId).toBe("spec1");
    expect(result.changedSpecs[1].classification).toBe("score_drop");
    expect(result.changedSpecs[1].specId).toBe("spec2");
  });

  it("should handle missing base report gracefully", async () => {
    const head = makeBaselineReport();
    await fs.writeFile(headPath, JSON.stringify(head));

    await expect(runDiff({ base: "nonexistent.json", head: headPath })).rejects.toThrow(
      "Base run report not found",
    );
  });

  it("should handle missing head report gracefully", async () => {
    const baseline = makeBaselineReport();
    await fs.writeFile(baselinePath, JSON.stringify(baseline));

    await expect(runDiff({ base: baselinePath, head: "nonexistent.json" })).rejects.toThrow(
      "Head run report not found",
    );
  });
});

describe("Diff Classification", () => {
  it("should classify new failure correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 100 },
    };
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "failed" as const, score: 0.45, duration: 120, error: "Error" },
    };

    expect(diffCore.classifyChange(base, head)).toBe("new_failure");
  });

  it("should classify fixed failure correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "failed" as const, score: 0.45, duration: 120, error: "Error" },
    };
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 100 },
    };

    expect(diffCore.classifyChange(base, head)).toBe("fixed_failure");
  });

  it("should classify score drop correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 100 },
    };
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.7, duration: 120 },
    };

    expect(diffCore.classifyChange(base, head)).toBe("score_drop");
  });

  it("should classify score improvement correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.7, duration: 100 },
    };
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 120 },
    };

    expect(diffCore.classifyChange(base, head)).toBe("score_improve");
  });

  it("should classify added spec correctly", () => {
    const base = undefined;
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 100 },
    };

    expect(diffCore.classifyChange(base, head)).toBe("added");
  });

  it("should classify removed spec correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 100 },
    };
    const head = undefined;

    expect(diffCore.classifyChange(base, head)).toBe("removed");
  });
});

describe("Delta Calculation", () => {
  it("should calculate score delta correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 100 },
    };
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.7, duration: 120 },
    };

    const deltas = diffCore.calculateDeltas(base, head);
    expect(deltas.scoreDelta).toBeCloseTo(-0.15, 2);
    expect(deltas.durationDelta).toBe(20);
  });

  it("should calculate status change correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 100 },
    };
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "failed" as const, score: 0.45, duration: 120 },
    };

    const deltas = diffCore.calculateDeltas(base, head);
    expect(deltas.statusChange).toBe("passed → failed");
  });

  it("should handle missing values correctly", () => {
    const base = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, duration: 100 },
    };
    const head = {
      specId: "spec1",
      name: "test-eval-1",
      filePath: "eval/test1.spec.ts",
      result: { status: "passed" as const, score: 0.85, duration: 120 },
    };

    const deltas = diffCore.calculateDeltas(base, head);
    expect(deltas.scoreDelta).toBeUndefined();
    expect(deltas.durationDelta).toBe(20);
  });
});
