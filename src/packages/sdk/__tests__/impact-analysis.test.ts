/**
 * Impact analysis tests
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeImpact, runImpactAnalysis } from "../src/cli/impact-analysis";
import type { EvaluationManifest } from "../src/cli/manifest";

describe("Impact Analysis", () => {
  const testDir = path.join(process.cwd(), ".test-impact");
  const manifestPath = path.join(testDir, ".evalai", "manifest.json");

  beforeEach(async () => {
    // Create test directory structure
    await fs.mkdir(path.join(testDir, ".evalai"), { recursive: true });

    // Create test manifest
    const testManifest: EvaluationManifest = {
      schemaVersion: 1,
      generatedAt: Date.now(),
      project: {
        name: "test-project",
        root: ".",
        namespace: "test123",
      },
      runtime: {
        mode: "spec",
        sdkVersion: "1.8.0",
      },
      specFiles: [
        {
          filePath: "eval/test.spec.ts",
          fileHash: "sha256:abc123",
          specCount: 2,
        },
        {
          filePath: "eval/another.spec.ts",
          fileHash: "sha256:def456",
          specCount: 1,
        },
      ],
      specs: [
        {
          id: "spec1",
          name: "test-eval-1",
          suitePath: ["safety"],
          filePath: "eval/test.spec.ts",
          position: { line: 1, column: 1 },
          tags: ["safety"],
          dependsOn: {
            prompts: ["prompts/test.md"],
            datasets: ["datasets/test.json"],
            tools: [],
            code: [],
          },
        },
        {
          id: "spec2",
          name: "test-eval-2",
          suitePath: ["tools"],
          filePath: "eval/test.spec.ts",
          position: { line: 10, column: 1 },
          tags: ["tools"],
          dependsOn: {
            prompts: [],
            datasets: [],
            tools: ["src/tools/calculator.ts"],
            code: ["src/utils/helpers.ts"],
          },
        },
        {
          id: "spec3",
          name: "test-eval-3",
          suitePath: ["accuracy"],
          filePath: "eval/another.spec.ts",
          position: { line: 5, column: 1 },
          tags: ["accuracy"],
          dependsOn: {
            prompts: [],
            datasets: [],
            tools: [],
            code: [],
          },
        },
      ],
    };

    await fs.writeFile(manifestPath, JSON.stringify(testManifest, null, 2));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should analyze impact of spec file changes", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: ["eval/test.spec.ts"],
      },
      testDir,
    );

    expect(result.impactedSpecIds).toEqual(["spec1", "spec2"]);
    expect(result.reasonBySpecId).toEqual({
      spec1: "Spec file changed: eval/test.spec.ts",
      spec2: "Spec file changed: eval/test.spec.ts",
    });
    expect(result.metadata.impactedCount).toBe(2);
    expect(result.metadata.totalSpecs).toBe(3);
  });

  it("should analyze impact of dependency changes", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: ["prompts/test.md"],
      },
      testDir,
    );

    expect(result.impactedSpecIds).toEqual(["spec1"]);
    expect(result.reasonBySpecId).toEqual({
      spec1: "Dependency changed: prompts/test.md",
    });
  });

  it("should analyze impact of multiple changes", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: ["src/tools/calculator.ts", "datasets/test.json"],
      },
      testDir,
    );

    expect(result.impactedSpecIds).toEqual(["spec1", "spec2"]);
    expect(result.reasonBySpecId).toEqual({
      spec1: "Dependency changed: datasets/test.json",
      spec2: "Dependency changed: src/tools/calculator.ts",
    });
  });

  it("should handle safe fallback for unknown files", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: ["unknown/file.txt"],
      },
      testDir,
    );

    // Should include all specs as safe fallback
    expect(result.impactedSpecIds).toEqual(["spec1", "spec2", "spec3"]);
    expect(result.reasonBySpecId).toEqual({
      spec1: "Unknown file changed: unknown/file.txt (safe fallback)",
      spec2: "Unknown file changed: unknown/file.txt (safe fallback)",
      spec3: "Unknown file changed: unknown/file.txt (safe fallback)",
    });
  });

  it("should handle no changes", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: [],
      },
      testDir,
    );

    expect(result.impactedSpecIds).toEqual([]);
    expect(result.reasonBySpecId).toEqual({});
    expect(result.metadata.impactedCount).toBe(0);
  });

  it("should sort impacted spec IDs", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: ["eval/another.spec.ts", "eval/test.spec.ts"],
      },
      testDir,
    );

    expect(result.impactedSpecIds).toEqual(["spec1", "spec2", "spec3"]);
    // Verify the array is sorted
    const sorted = [...result.impactedSpecIds].sort();
    expect(result.impactedSpecIds).toEqual(sorted);
  });

  it("should handle missing manifest gracefully", async () => {
    // Remove manifest
    await fs.rm(manifestPath);

    await expect(
      runImpactAnalysis(
        {
          baseBranch: "main",
          changedFiles: ["eval/test.spec.ts"],
        },
        testDir,
      ),
    ).rejects.toThrow("No evaluation manifest found");
  });

  it("should analyze impact correctly with mixed known and unknown files", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: ["eval/test.spec.ts", "unknown/file.txt"],
      },
      testDir,
    );

    // Unknown file should trigger safe fallback
    expect(result.impactedSpecIds).toEqual(["spec1", "spec2", "spec3"]);
    expect(result.reasonBySpecId["spec1"]).toContain("safe fallback");
  });

  it("should handle complex dependency scenarios", async () => {
    const result = await runImpactAnalysis(
      {
        baseBranch: "main",
        changedFiles: ["src/utils/helpers.ts", "prompts/test.md"],
      },
      testDir,
    );

    expect(result.impactedSpecIds).toEqual(["spec1", "spec2"]);
    expect(result.reasonBySpecId).toEqual({
      spec1: "Dependency changed: prompts/test.md",
      spec2: "Dependency changed: src/utils/helpers.ts",
    });
  });
});

describe("Impact Analysis Core Logic", () => {
  it("should analyze impact with empty manifest", () => {
    const emptyManifest: EvaluationManifest = {
      schemaVersion: 1,
      generatedAt: Date.now(),
      project: {
        name: "test",
        root: ".",
        namespace: "test",
      },
      runtime: {
        mode: "spec",
        sdkVersion: "1.8.0",
      },
      specFiles: [],
      specs: [],
    };

    const result = analyzeImpact(["eval/test.spec.ts"], emptyManifest);

    expect(result.impactedSpecIds).toEqual([]);
    expect(result.reasonBySpecId).toEqual({});
  });

  it("should handle Windows path normalization", () => {
    const manifest: EvaluationManifest = {
      schemaVersion: 1,
      generatedAt: Date.now(),
      project: {
        name: "test",
        root: ".",
        namespace: "test",
      },
      runtime: {
        mode: "spec",
        sdkVersion: "1.8.0",
      },
      specFiles: [
        {
          filePath: "eval/test.spec.ts",
          fileHash: "sha256:abc123",
          specCount: 1,
        },
      ],
      specs: [
        {
          id: "spec1",
          name: "test-eval",
          suitePath: ["safety"],
          filePath: "eval/test.spec.ts",
          position: { line: 1, column: 1 },
          tags: ["safety"],
          dependsOn: {
            prompts: [],
            datasets: [],
            tools: [],
            code: [],
          },
        },
      ],
    };

    // Test Windows-style paths - they should be normalized to POSIX
    const result = analyzeImpact(["eval\\test.spec.ts"], manifest);

    expect(result.impactedSpecIds).toEqual(["spec1"]);
    expect(result.reasonBySpecId).toEqual({
      spec1: "Spec file changed: eval/test.spec.ts",
    });
  });
});
