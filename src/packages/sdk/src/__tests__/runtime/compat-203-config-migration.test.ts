/**
 * COMPAT-203: Config → DSL migration generator tests
 *
 * Tests for CLI command that generates DSL code from config files.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	migrateConfig,
	previewMigration,
	validateConfigFile,
} from "../../cli/migrate";
import { createTestSuite } from "../../testing";

describe("COMPAT-203: Config → DSL Migration Generator", () => {
	let tempDir: string;
	let configPath: string;
	let outputPath: string;

	beforeEach(async () => {
		// Create temporary directory for test files
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "evalai-migrate-test-"));
		configPath = path.join(tempDir, "evalai.config.json");
		outputPath = path.join(tempDir, "migrated.spec.ts");
	});

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	describe("Config file parsing", () => {
		it("should parse simple config with tests array", async () => {
			const config = {
				tests: [
					{
						id: "test-1",
						input: "Hello world",
						expected: "Hello",
					},
					{
						input: "Goodbye world",
						expected: "Goodbye",
					},
				],
				executor: "async (input) => input.split(' ')[0]",
				timeout: 5000,
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			const result = await validateConfigFile(configPath);
			expect(result).toBe(true);
		});

		it("should parse config with named suites", async () => {
			const config = {
				suites: {
					"greeting-tests": {
						cases: [
							{
								id: "hello-test",
								input: "Hello",
								expected: "Hello",
							},
						],
						timeout: 3000,
					},
					"farewell-tests": {
						cases: [
							{
								id: "goodbye-test",
								input: "Goodbye",
								expected: "Goodbye",
							},
						],
						timeout: 2000,
					},
				},
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			const result = await validateConfigFile(configPath);
			expect(result).toBe(true);
		});

		it("should reject invalid config files", async () => {
			const invalidConfig = {
				invalid: "structure",
				noTests: true,
			};

			await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

			const result = await validateConfigFile(configPath);
			expect(result).toBe(false);
		});

		it("should handle non-existent config files", async () => {
			const result = await validateConfigFile("/non/existent/path.json");
			expect(result).toBe(false);
		});
	});

	describe("Migration generation", () => {
		it("should generate DSL from simple config", async () => {
			const config = {
				tests: [
					{
						id: "simple-test",
						input: "test input",
						expected: "test output",
					},
				],
				executor: "async (input) => input.toUpperCase()",
				timeout: 10000,
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			await migrateConfig({
				input: configPath,
				output: outputPath,
				verbose: false,
				helpers: true,
				preserveIds: true,
				provenance: true,
			});

			// Check output file exists
			const outputExists = await fs
				.access(outputPath)
				.then(() => true)
				.catch(() => false);
			expect(outputExists).toBe(true);

			// Check output content
			const outputContent = await fs.readFile(outputPath, "utf-8");

			expect(outputContent).toContain(
				"// Auto-generated EvalAI DSL from configuration",
			);
			expect(outputContent).toContain(
				"import { defineEval, createResult } from '@evalgate/sdk';",
			);
			expect(outputContent).toContain(
				'defineEval("simple-test", async (context) => {',
			);
			expect(outputContent).toContain(
				"async function legacyExecutor(input: string): Promise<string>",
			);
			expect(outputContent).toContain(
				"async function evaluateLegacyTest(input: string, expected?: string)",
			);
			expect(outputContent).toContain("Migration Summary");
		});

		it("should generate DSL from config with multiple suites", async () => {
			const config = {
				suites: {
					"suite-1": {
						cases: [
							{
								id: "test-1-1",
								input: "input1",
								expected: "output1",
							},
						],
					},
					"suite-2": {
						cases: [
							{
								id: "test-2-1",
								input: "input2",
								expected: "output2",
							},
						],
					},
				},
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			await migrateConfig({
				input: configPath,
				output: outputPath,
				verbose: false,
				helpers: true,
				preserveIds: true,
				provenance: true,
			});

			const outputContent = await fs.readFile(outputPath, "utf-8");

			expect(outputContent).toContain(
				'defineEval("test-1-1", async (context) => {',
			);
			expect(outputContent).toContain(
				'defineEval("test-2-1", async (context) => {',
			);
			expect(outputContent).toContain("Total suites migrated: 2");
			expect(outputContent).toContain("Total tests migrated: 2");
		});

		it("should respect migration options", async () => {
			const config = {
				tests: [
					{
						id: "options-test",
						input: "test",
						expected: "test",
					},
				],
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			await migrateConfig({
				input: configPath,
				output: outputPath,
				verbose: true,
				helpers: false,
				preserveIds: false,
				provenance: false,
			});

			const outputContent = await fs.readFile(outputPath, "utf-8");

			expect(outputContent).toContain("Include helpers: false");
			expect(outputContent).toContain("Preserve IDs: false");
			expect(outputContent).toContain("Include provenance: false");

			// Should not contain helper functions when helpers=false
			expect(outputContent).not.toContain("function legacyExecutor");
			expect(outputContent).not.toContain("function evaluateLegacyTest");
		});

		it("should handle complex test configurations", async () => {
			const config = {
				tests: [
					{
						id: "complex-test",
						input: "complex input with data",
						expected: "complex expected output",
						metadata: {
							category: "integration",
							priority: "high",
							tags: ["important", "complex"],
							nested: {
								deep: {
									value: "test data",
								},
							},
						},
					},
				],
				timeout: 15000,
				parallel: false,
				retries: 3,
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			await migrateConfig({
				input: configPath,
				output: outputPath,
				verbose: false,
				helpers: true,
				preserveIds: true,
				provenance: true,
			});

			const outputContent = await fs.readFile(outputPath, "utf-8");

			expect(outputContent).toContain(
				'defineEval("complex-test", async (context) => {',
			);
			expect(outputContent).toContain("timeout: 15000");
			expect(outputContent).toContain("retries: 3");
		});

		it("should create output directory if it doesn't exist", async () => {
			const config = {
				tests: [
					{
						id: "dir-test",
						input: "test",
						expected: "test",
					},
				],
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			const nestedOutputPath = path.join(
				tempDir,
				"nested",
				"dir",
				"migrated.spec.ts",
			);

			await migrateConfig({
				input: configPath,
				output: nestedOutputPath,
				verbose: false,
				helpers: true,
				preserveIds: true,
				provenance: true,
			});

			const outputExists = await fs
				.access(nestedOutputPath)
				.then(() => true)
				.catch(() => false);
			expect(outputExists).toBe(true);
		});
	});

	describe("Migration preview", () => {
		it("should show preview of migration without writing files", async () => {
			const config = {
				suites: {
					"preview-suite-1": {
						cases: [
							{ id: "test-1", input: "input1", expected: "output1" },
							{ id: "test-2", input: "input2", expected: "output2" },
							{ id: "test-3", input: "input3", expected: "output3" },
						],
					},
					"preview-suite-2": {
						cases: [{ id: "test-4", input: "input4", expected: "output4" }],
					},
				},
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			// Capture console output
			const originalConsoleLog = console.log;
			const logs: string[] = [];
			console.log = (message: string) => logs.push(message);

			await previewMigration(configPath);

			console.log = originalConsoleLog;

			const logOutput = logs.join("\n");

			expect(logOutput).toContain("Migration preview");
			expect(logOutput).toContain("Found 2 test suites");
			expect(logOutput).toContain("preview-suite-1: 3 tests");
			expect(logOutput).toContain("preview-suite-2: 1 tests");
			expect(logOutput).toContain("Total tests to migrate: 4");
			expect(logOutput).toContain("evalai migrate config --in");
		});

		it("should handle empty config in preview", async () => {
			const config = {
				suites: {},
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			const originalConsoleLog = console.log;
			const logs: string[] = [];
			console.log = (message: string) => logs.push(message);

			await previewMigration(configPath);

			console.log = originalConsoleLog;

			const logOutput = logs.join("\n");
			expect(logOutput).toContain("Found 0 test suites");
		});
	});

	describe("Error handling", () => {
		it("should handle missing input file gracefully", async () => {
			await expect(
				migrateConfig({
					input: "/non/existent/config.json",
					output: outputPath,
					verbose: false,
					helpers: true,
					preserveIds: true,
					provenance: true,
				}),
			).rejects.toThrow();
		});

		it("should handle invalid JSON gracefully", async () => {
			await fs.writeFile(configPath, "invalid json content");

			await expect(
				migrateConfig({
					input: configPath,
					output: outputPath,
					verbose: false,
					helpers: true,
					preserveIds: true,
					provenance: true,
				}),
			).rejects.toThrow();
		});

		it("should handle config without test data", async () => {
			const config = {
				someOtherProperty: "value",
				noTests: true,
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			await expect(
				migrateConfig({
					input: configPath,
					output: outputPath,
					verbose: false,
					helpers: true,
					preserveIds: true,
					provenance: true,
				}),
			).rejects.toThrow("No test suites found");
		});
	});

	describe("Integration with TestSuite", () => {
		it("should work with actual TestSuite instances", async () => {
			// Create a real TestSuite
			const suite = createTestSuite("integration-suite", {
				cases: [
					{
						id: "integration-test",
						input: "Hello world",
						expected: "Hello",
						metadata: { type: "integration" },
					},
				],
				timeout: 5000,
				retries: 2,
				executor: async (input: string) => input.split(" ")[0],
			});

			// Convert to config format
			const config = {
				suites: {
					"integration-suite": suite.getConfig(),
				},
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			await migrateConfig({
				input: configPath,
				output: outputPath,
				verbose: false,
				helpers: true,
				preserveIds: true,
				provenance: true,
			});

			const outputContent = await fs.readFile(outputPath, "utf-8");

			expect(outputContent).toContain(
				'defineEval("integration-test", async (context) => {',
			);
			expect(outputContent).toContain("timeout: 5000");
			expect(outputContent).toContain("retries: 2");
			expect(outputContent).toContain('type: "integration"');
		});
	});
});
