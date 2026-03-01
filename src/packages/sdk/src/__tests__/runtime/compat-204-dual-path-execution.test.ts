/**
 * COMPAT-204: Dual-path execution toggle tests
 *
 * Tests for environment flag EVALGATE_RUNTIME=legacy|spec|auto
 * Auto uses spec runtime if manifest/specs exist, else legacy
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	canRunLegacyMode,
	canRunSpecMode,
	clearExecutionModeEnv,
	ENV_VARS,
	getExecutionMode,
	getExecutionModeEnv,
	getRecommendedExecutionMode,
	hasExecutionModeEnv,
	printExecutionModeInfo,
	setExecutionModeEnv,
	validateExecutionMode,
} from "../../runtime/execution-mode";

describe("COMPAT-204: Dual-path Execution Toggle", () => {
	let tempDir: string;
	let originalEnv: string | undefined;

	beforeEach(async () => {
		// Create temporary directory for test files
		tempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "evalai-execution-test-"),
		);
		originalEnv = process.env.EVALGATE_RUNTIME;
		delete process.env.EVALGATE_RUNTIME;
	});

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true });
		// Restore environment variable
		if (originalEnv) {
			process.env.EVALGATE_RUNTIME = originalEnv;
		} else {
			delete process.env.EVALGATE_RUNTIME;
		}
	});

	describe("Environment variable detection", () => {
		it("should detect legacy mode from environment", async () => {
			process.env.EVALGATE_RUNTIME = "legacy";

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("legacy");
			expect(config.hasSpecRuntime).toBe(false);
			expect(config.hasLegacyRuntime).toBe(true);
			expect(config.specFiles).toEqual([]);
		});

		it("should detect spec mode from environment", async () => {
			process.env.EVALGATE_RUNTIME = "spec";

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("spec");
			expect(config.hasSpecRuntime).toBe(true);
			expect(config.hasLegacyRuntime).toBe(false);
		});

		it("should detect auto mode from environment", async () => {
			process.env.EVALGATE_RUNTIME = "auto";

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("auto");
			expect(config.hasSpecRuntime).toBe(true);
			expect(config.hasLegacyRuntime).toBe(true);
		});

		it("should be case insensitive", async () => {
			process.env.EVALGATE_RUNTIME = "LEGACY";

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("legacy");
		});

		it("should handle invalid environment values", async () => {
			process.env.EVALGATE_RUNTIME = "invalid";

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("auto"); // Should fall back to auto-detection
		});
	});

	describe("Auto-detection", () => {
		it("should detect spec-only project", async () => {
			// Create spec files
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        
        defineEval("test-spec", async (context) => {
          return { pass: true, score: 100 };
        });
      `,
			);

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("auto");
			expect(config.hasSpecRuntime).toBe(true);
			expect(config.hasLegacyRuntime).toBe(false);
			expect(config.specFiles).toHaveLength(1);
			expect(config.specFiles[0]).toContain("test.spec.ts");
		});

		it("should detect legacy-only project", async () => {
			// Create legacy config
			await fs.writeFile(
				path.join(tempDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [
							{
								input: "test",
								expected: "test",
							},
						],
					},
					null,
					2,
				),
			);

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("auto");
			expect(config.hasSpecRuntime).toBe(false);
			expect(config.hasLegacyRuntime).toBe(true);
			expect(config.legacyConfig).toContain("evalai.config.json");
		});

		it("should detect mixed project", async () => {
			// Create both spec files and legacy config
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        
        defineEval("test-spec", async (context) => {
          return { pass: true, score: 100 };
        });
      `,
			);

			await fs.writeFile(
				path.join(tempDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [
							{
								input: "test",
								expected: "test",
							},
						],
					},
					null,
					2,
				),
			);

			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("auto");
			expect(config.hasSpecRuntime).toBe(true);
			expect(config.hasLegacyRuntime).toBe(true);
			expect(config.specFiles).toHaveLength(1);
			expect(config.legacyConfig).toContain("evalai.config.json");
		});

		it("should detect empty project", async () => {
			const config = await getExecutionMode(tempDir);

			expect(config.mode).toBe("auto");
			expect(config.hasSpecRuntime).toBe(false);
			expect(config.hasLegacyRuntime).toBe(false);
			expect(config.specFiles).toEqual([]);
			expect(config.legacyConfig).toBeUndefined();
		});
	});

	describe("Mode compatibility checks", () => {
		it("should correctly identify spec mode capability", async () => {
			// Create spec files
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        defineEval("test", async (context) => ({ pass: true, score: 100 }));
      `,
			);

			const config = await getExecutionMode(tempDir);

			expect(canRunSpecMode(config)).toBe(true);
			expect(canRunLegacyMode(config)).toBe(false);
		});

		it("should correctly identify legacy mode capability", async () => {
			// Create legacy config
			await fs.writeFile(
				path.join(tempDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [{ input: "test", expected: "test" }],
					},
					null,
					2,
				),
			);

			const config = await getExecutionMode(tempDir);

			expect(canRunSpecMode(config)).toBe(false);
			expect(canRunLegacyMode(config)).toBe(true);
		});

		it("should correctly identify mixed mode capability", async () => {
			// Create both spec files and legacy config
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        defineEval("test", async (context) => ({ pass: true, score: 100 }));
      `,
			);

			await fs.writeFile(
				path.join(tempDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [{ input: "test", expected: "test" }],
					},
					null,
					2,
				),
			);

			const config = await getExecutionMode(tempDir);

			expect(canRunSpecMode(config)).toBe(true);
			expect(canRunLegacyMode(config)).toBe(true);
		});
	});

	describe("Recommended execution mode", () => {
		it("should recommend spec for mixed projects", async () => {
			// Create both spec files and legacy config
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        defineEval("test", async (context) => ({ pass: true, score: 100 }));
      `,
			);

			await fs.writeFile(
				path.join(tempDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [{ input: "test", expected: "test" }],
					},
					null,
					2,
				),
			);

			const config = await getExecutionMode(tempDir);

			expect(getRecommendedExecutionMode(config)).toBe("spec");
		});

		it("should recommend spec for spec-only projects", async () => {
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        defineEval("test", async (context) => ({ pass: true, score: 100 }));
      `,
			);

			const config = await getExecutionMode(tempDir);

			expect(getRecommendedExecutionMode(config)).toBe("spec");
		});

		it("should recommend legacy for legacy-only projects", async () => {
			await fs.writeFile(
				path.join(tempDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [{ input: "test", expected: "test" }],
					},
					null,
					2,
				),
			);

			const config = await getExecutionMode(tempDir);

			expect(getRecommendedExecutionMode(config)).toBe("legacy");
		});

		it("should recommend auto for empty projects", async () => {
			const config = await getExecutionMode(tempDir);

			expect(getRecommendedExecutionMode(config)).toBe("auto");
		});
	});

	describe("Validation", () => {
		it("should validate valid configurations", async () => {
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        defineEval("test", async (context) => ({ pass: true, score: 100 }));
      `,
			);

			const config = await getExecutionMode(tempDir);
			const validation = validateExecutionMode(config);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toEqual([]);
		});

		it("should warn about mixed projects", async () => {
			// Create both spec files and legacy config
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        defineEval("test", async (context) => ({ pass: true, score: 100 }));
      `,
			);

			await fs.writeFile(
				path.join(tempDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [{ input: "test", expected: "test" }],
					},
					null,
					2,
				),
			);

			const config = await getExecutionMode(tempDir);
			const validation = validateExecutionMode(config);

			expect(validation.valid).toBe(true);
			expect(validation.warnings.length).toBeGreaterThan(0);
			expect(validation.warnings[0]).toContain(
				"both spec files and legacy config",
			);
		});

		it("should warn about empty projects", async () => {
			const config = await getExecutionMode(tempDir);
			const validation = validateExecutionMode(config);

			expect(validation.valid).toBe(true);
			expect(validation.warnings.length).toBeGreaterThan(0);
			expect(validation.warnings[0]).toContain("No tests found");
		});

		it("should error on incompatible mode requests", async () => {
			// Create empty project
			const config = await getExecutionMode(tempDir);

			// Manually set incompatible mode
			config.mode = "spec";

			const validation = validateExecutionMode(config);

			expect(validation.valid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);
			expect(validation.errors[0]).toContain(
				"Spec mode requested but no spec files found",
			);
		});
	});

	describe("Environment variable helpers", () => {
		it("should check if environment variable is set", () => {
			expect(hasExecutionModeEnv()).toBe(false);

			process.env.EVALGATE_RUNTIME = "spec";
			expect(hasExecutionModeEnv()).toBe(true);

			delete process.env.EVALGATE_RUNTIME;
			expect(hasExecutionModeEnv()).toBe(false);
		});

		it("should get environment variable value", () => {
			expect(getExecutionModeEnv()).toBeUndefined();

			process.env.EVALGATE_RUNTIME = "legacy";
			expect(getExecutionModeEnv()).toBe("legacy");

			delete process.env.EVALGATE_RUNTIME;
			expect(getExecutionModeEnv()).toBeUndefined();
		});

		it("should set environment variable", () => {
			setExecutionModeEnv("spec");
			expect(process.env.EVALGATE_RUNTIME).toBe("spec");

			clearExecutionModeEnv();
			expect(process.env.EVALGATE_RUNTIME).toBeUndefined();
		});

		it("should clear environment variable", () => {
			process.env.EVALGATE_RUNTIME = "auto";
			expect(hasExecutionModeEnv()).toBe(true);

			clearExecutionModeEnv();
			expect(hasExecutionModeEnv()).toBe(false);
		});
	});

	describe("Print information", () => {
		it("should print execution mode information without errors", async () => {
			// Create spec files
			const specDir = path.join(tempDir, "eval");
			await fs.mkdir(specDir, { recursive: true });
			await fs.writeFile(
				path.join(specDir, "test.spec.ts"),
				`
        import { defineEval } from '@evalgate/sdk';
        defineEval("test", async (context) => ({ pass: true, score: 100 }));
      `,
			);

			const config = await getExecutionMode(tempDir);

			// Capture console output
			const originalConsoleLog = console.log;
			const logs: string[] = [];
			console.log = (message: string) => logs.push(message);

			printExecutionModeInfo(config);

			console.log = originalConsoleLog;

			const logOutput = logs.join("\n");

			expect(logOutput).toContain("EvalGate Execution Mode: AUTO");
			expect(logOutput).toContain("Project root:");
			expect(logOutput).toContain("Spec runtime available");
			expect(logOutput).toContain("Found 1 spec file(s):");
			expect(logOutput).toContain("Recommended mode: SPEC");
		});
	});

	describe("Constants", () => {
		it("should have correct environment variable constants", () => {
			expect(ENV_VARS.EXECUTION_MODE).toBe("EVALGATE_RUNTIME");
			expect(ENV_VARS.POSSIBLE_VALUES).toEqual(["legacy", "spec", "auto"]);
			expect(ENV_VARS.DEFAULT).toBe("auto");
		});
	});
});
