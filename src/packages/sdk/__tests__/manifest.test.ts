/**
 * Manifest generation tests
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SpecAnalysis } from "../src/cli/discover";
import {
	generateManifest,
	readLock,
	readManifest,
	writeManifest,
} from "../src/cli/manifest";
import type { ExecutionModeConfig } from "../src/runtime/execution-mode";
import { SDK_VERSION } from "../src/version";

describe("Manifest Generation", () => {
	const testDir = path.join(process.cwd(), ".test-manifest");
	const testSpecFile = path.join(testDir, "eval", "test.spec.ts");

	beforeEach(async () => {
		// Create test directory structure
		await fs.mkdir(path.join(testDir, "eval"), { recursive: true });

		// Create test spec file
		const testSpecContent = `
import { defineEval } from "./src/packages/sdk/src/runtime/eval";

defineEval({
  name: "test-eval",
  description: "Test evaluation",
  tags: ["safety"],
  dependsOn: {
    datasets: ["datasets/test.json"],
    prompts: ["prompts/test.md"]
  },
  async executor() {
    return { pass: true, score: 100 };
  }
});
`;
		await fs.writeFile(testSpecFile, testSpecContent);
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should generate manifest with correct schema", async () => {
		const specs: SpecAnalysis[] = [
			{
				id: "test-id",
				name: "test-eval",
				file: testSpecFile,
				tags: ["safety"],
				hasAssertions: true,
				usesModels: false,
				usesTools: false,
				complexity: "simple",
			},
		];

		const executionMode: ExecutionModeConfig = {
			mode: "spec",
			hasSpecRuntime: true,
			hasLegacyRuntime: false,
			projectRoot: testDir,
			specFiles: [testSpecFile],
			legacyConfig: undefined,
		};

		const manifest = await generateManifest(
			specs,
			testDir,
			"test-project",
			executionMode,
		);

		expect(manifest).toMatchObject({
			schemaVersion: 1,
			project: {
				name: "test-project",
				root: ".",
				namespace: expect.any(String),
			},
			runtime: {
				mode: "spec",
				sdkVersion: SDK_VERSION,
			},
			specFiles: [
				{
					filePath: "eval/test.spec.ts",
					fileHash: expect.stringMatching(/^sha256:/),
					specCount: 1,
				},
			],
			specs: [
				{
					id: "test-id",
					name: "test-eval",
					suitePath: ["safety"],
					filePath: "eval/test.spec.ts",
					position: expect.objectContaining({
						line: expect.any(Number),
						column: expect.any(Number),
					}),
					tags: ["safety"],
					dependsOn: {
						prompts: expect.any(Array),
						datasets: expect.any(Array),
						tools: expect.any(Array),
						code: expect.any(Array),
					},
				},
			],
		});
	});

	it("should write manifest and lock files", async () => {
		const specs: SpecAnalysis[] = [
			{
				id: "test-id",
				name: "test-eval",
				file: testSpecFile,
				tags: ["safety"],
				hasAssertions: true,
				usesModels: false,
				usesTools: false,
				complexity: "simple",
			},
		];

		const executionMode: ExecutionModeConfig = {
			mode: "spec",
			hasSpecRuntime: true,
			hasLegacyRuntime: false,
			projectRoot: testDir,
			specFiles: [testSpecFile],
			legacyConfig: undefined,
		};

		const manifest = await generateManifest(
			specs,
			testDir,
			"test-project",
			executionMode,
		);
		await writeManifest(manifest, testDir);

		// Check manifest file exists
		const manifestPath = path.join(testDir, ".evalgate", "manifest.json");
		const manifestExists = await fs
			.access(manifestPath)
			.then(() => true)
			.catch(() => false);
		expect(manifestExists).toBe(true);

		// Check lock file exists
		const lockPath = path.join(testDir, ".evalgate", "manifest.lock.json");
		const lockExists = await fs
			.access(lockPath)
			.then(() => true)
			.catch(() => false);
		expect(lockExists).toBe(true);

		// Verify manifest content
		const readManifestContent = await readManifest(testDir);
		expect(readManifestContent).toBeDefined();
		expect(readManifestContent?.schemaVersion).toBe(1);

		// Verify lock content
		const readLockContent = await readLock(testDir);
		expect(readLockContent).toBeDefined();
		expect(readLockContent?.fileHashes).toHaveProperty("eval/test.spec.ts");
	});

	it("should normalize paths to POSIX format", async () => {
		const specs: SpecAnalysis[] = [
			{
				id: "test-id",
				name: "test-eval",
				file: path.join(testDir, "eval", "test.spec.ts"),
				tags: ["safety"],
				hasAssertions: true,
				usesModels: false,
				usesTools: false,
				complexity: "simple",
			},
		];

		const executionMode: ExecutionModeConfig = {
			mode: "spec",
			hasSpecRuntime: true,
			hasLegacyRuntime: false,
			projectRoot: testDir,
			specFiles: [testSpecFile],
			legacyConfig: undefined,
		};

		const manifest = await generateManifest(
			specs,
			testDir,
			"test-project",
			executionMode,
		);

		expect(manifest.specFiles[0].filePath).toBe("eval/test.spec.ts");
		expect(manifest.specs[0].filePath).toBe("eval/test.spec.ts");
	});
});
