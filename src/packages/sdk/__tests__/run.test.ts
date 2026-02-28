/**
 * Run command tests
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluationManifest } from "../src/cli/manifest";
import { runEvaluations } from "../src/cli/run";

describe("Run Command", () => {
	const testDir = path.join(process.cwd(), ".test-run");
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
						prompts: [],
						datasets: [],
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
						tools: [],
						code: [],
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

	it("should run all specs by default", async () => {
		const result = await runEvaluations({}, testDir);

		expect(result.metadata.totalSpecs).toBe(3);
		expect(result.metadata.executedSpecs).toBe(3);
		expect(result.results).toHaveLength(3);
		expect(result.summary.passed + result.summary.failed).toBe(3);
	});

	it("should filter by spec IDs", async () => {
		const result = await runEvaluations(
			{
				specIds: ["spec1", "spec3"],
			},
			testDir,
		);

		expect(result.metadata.executedSpecs).toBe(2);
		expect(result.results).toHaveLength(2);
		expect(result.results.map((r) => r.specId)).toEqual(
			expect.arrayContaining(["spec1", "spec3"]),
		);
		expect(result.results.map((r) => r.specId)).not.toContain("spec2");
	});

	it("should handle empty spec IDs list", async () => {
		const result = await runEvaluations(
			{
				specIds: [],
			},
			testDir,
		);

		expect(result.metadata.executedSpecs).toBe(0);
		expect(result.results).toHaveLength(0);
	});

	it("should handle non-existent spec IDs", async () => {
		const result = await runEvaluations(
			{
				specIds: ["nonexistent"],
			},
			testDir,
		);

		expect(result.metadata.executedSpecs).toBe(0);
		expect(result.results).toHaveLength(0);
	});

	it("should write results when requested", async () => {
		await runEvaluations(
			{
				writeResults: true,
			},
			testDir,
		);

		const resultsPath = path.join(testDir, ".evalai", "last-run.json");
		const resultsExist = await fs
			.access(resultsPath)
			.then(() => true)
			.catch(() => false);
		expect(resultsExist).toBe(true);

		const content = await fs.readFile(resultsPath, "utf-8");
		const results = JSON.parse(content);
		expect(results).toHaveProperty("metadata");
		expect(results).toHaveProperty("results");
		expect(results).toHaveProperty("summary");
	});

	it("should calculate summary correctly", async () => {
		// Mock execution to get predictable results
		const result = await runEvaluations({}, testDir);

		expect(result.summary).toHaveProperty("passed");
		expect(result.summary).toHaveProperty("failed");
		expect(result.summary).toHaveProperty("skipped");
		expect(result.summary).toHaveProperty("passRate");
		expect(result.summary.passRate).toBeGreaterThanOrEqual(0);
		expect(result.summary.passRate).toBeLessThanOrEqual(1);
	});

	it("should include execution metadata", async () => {
		const result = await runEvaluations({}, testDir);

		expect(result.metadata).toHaveProperty("startedAt");
		expect(result.metadata).toHaveProperty("completedAt");
		expect(result.metadata).toHaveProperty("duration");
		expect(result.metadata).toHaveProperty("totalSpecs");
		expect(result.metadata).toHaveProperty("executedSpecs");
		expect(result.metadata).toHaveProperty("mode");

		expect(result.metadata.totalSpecs).toBe(3);
		expect(result.metadata.mode).toBe("spec");
		expect(result.metadata.duration).toBeGreaterThan(0);
	});

	it("should handle missing manifest gracefully", async () => {
		// Remove manifest
		await fs.rm(manifestPath);

		await expect(runEvaluations({}, testDir)).rejects.toThrow(
			"No evaluation manifest found",
		);
	});

	it("should include spec details in results", async () => {
		const result = await runEvaluations(
			{
				specIds: ["spec1"],
			},
			testDir,
		);

		expect(result.results).toHaveLength(1);
		const specResult = result.results[0];

		expect(specResult.specId).toBe("spec1");
		expect(specResult.name).toBe("test-eval-1");
		expect(specResult.filePath).toBe("eval/test.spec.ts");
		expect(specResult.result).toHaveProperty("status");
		expect(specResult.result).toHaveProperty("duration");
	});

	it("should handle execution failures gracefully", async () => {
		// This test verifies that even if some specs fail, the run continues
		const result = await runEvaluations({}, testDir);

		// Should have results for all specs
		expect(result.results).toHaveLength(3);

		// Should have both passed and failed counts
		expect(result.summary.passed + result.summary.failed).toBe(3);

		// Each result should have a status
		result.results.forEach((r) => {
			expect(["passed", "failed", "skipped"]).toContain(r.result.status);
		});
	});
});

vi.mock("../src/cli/impact-analysis", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../src/cli/impact-analysis")>();
	return {
		...actual,
		runImpactAnalysis: vi.fn().mockResolvedValue({
			impactedSpecIds: ["spec1"],
			reasonBySpecId: { spec1: "direct file match" },
			changedFiles: ["eval/test.spec.ts"],
			metadata: {
				baseBranch: "main",
				totalSpecs: 1,
				impactedCount: 1,
				analysisTime: 5,
			},
		}),
	};
});

describe("Run Command Integration", () => {
	it("should work with impact analysis integration", async () => {
		const testDir = path.join(process.cwd(), ".test-integration");
		const manifestPath = path.join(testDir, ".evalai", "manifest.json");

		await fs.mkdir(path.join(testDir, ".evalai"), { recursive: true });

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

		await fs.writeFile(manifestPath, JSON.stringify(testManifest, null, 2));

		try {
			const result = await runEvaluations(
				{
					impactedOnly: true,
					baseBranch: "main",
				},
				testDir,
			);

			expect(result.metadata.executedSpecs).toBeGreaterThanOrEqual(0);
			expect(result.metadata.totalSpecs).toBe(1);
		} finally {
			await fs.rm(testDir, { recursive: true, force: true });
		}
	});
});
