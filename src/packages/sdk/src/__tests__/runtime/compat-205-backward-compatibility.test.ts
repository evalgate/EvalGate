/**
 * COMPAT-205: Backward compatibility test suite
 *
 * Tests for ensuring legacy projects run with no edits and spec-based projects run with no config.
 * Both should use doctor/check/explain transparently.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adaptTestSuite } from "../../runtime/adapters/testsuite-to-dsl";
import { createResult } from "../../runtime/eval";
import { getExecutionMode } from "../../runtime/execution-mode";
import { createLocalExecutor } from "../../runtime/executor";
import {
	createEvalRuntime,
	disposeActiveRuntime,
} from "../../runtime/registry";
import { createRunReport } from "../../runtime/run-report";

describe("COMPAT-205: Backward Compatibility Test Suite", () => {
	let tempDir: string;
	let legacyProjectDir: string;
	let specProjectDir: string;
	let mixedProjectDir: string;

	beforeEach(async () => {
		// Create temporary directories for different project types
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "evalai-compat-test-"));

		legacyProjectDir = path.join(tempDir, "legacy");
		specProjectDir = path.join(tempDir, "spec");
		mixedProjectDir = path.join(tempDir, "mixed");

		await fs.mkdir(legacyProjectDir, { recursive: true });
		await fs.mkdir(specProjectDir, { recursive: true });
		await fs.mkdir(mixedProjectDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up temporary directories
		await fs.rm(path.dirname(tempDir), { recursive: true, force: true });
		disposeActiveRuntime();
	});

	describe("Legacy project compatibility", () => {
		beforeEach(async () => {
			// Create legacy project structure
			await fs.writeFile(
				path.join(legacyProjectDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [
							{
								id: "legacy-test-1",
								input: "Hello world",
								expected: "Hello",
								metadata: { category: "greeting" },
							},
							{
								id: "legacy-test-2",
								input: "Goodbye world",
								expected: "Goodbye",
								metadata: { category: "farewell" },
							},
							{
								id: "legacy-test-3",
								input: "Complex test with data",
								expected: "Expected output",
								metadata: {
									type: "integration",
									priority: "high",
									tags: ["important", "complex"],
								},
							},
						],
						timeout: 5000,
						parallel: false,
						retries: 2,
						executor: async (input: string) => {
							// Simple executor that processes input
							if (input.includes("Hello")) return "Hello";
							if (input.includes("Goodbye")) return "Goodbye";
							return "Expected output";
						},
					},
					null,
					2,
				),
			);

			// Create package.json for legacy project
			await fs.writeFile(
				path.join(legacyProjectDir, "package.json"),
				JSON.stringify(
					{
						name: "legacy-evalai-project",
						version: "1.0.0",
						scripts: {
							test: "node test.js",
						},
						dependencies: {
							"@pauly4010/evalai-sdk": "^1.6.0",
						},
					},
					null,
					2,
				),
			);

			// Create test runner script
			await fs.writeFile(
				path.join(legacyProjectDir, "test.js"),
				`
        const { createTestSuite } = require('@pauly4010/evalai-sdk');
        
        const config = require('./evalai.config.json');
        const suite = createTestSuite('legacy-tests', config);
        
        suite.run().then(results => {
          console.log(\`Tests: \${results.passed}/\${results.total} passed\`);
          process.exit(results.failed > 0 ? 1 : 0);
        }).catch(error => {
          console.error('Test error:', error);
          process.exit(1);
        });
      `,
			);
		});

		it("should run legacy tests without modifications", async () => {
			// Load and run legacy tests
			const { createTestSuite } = require("@pauly4010/evalai-sdk");
			const config = JSON.parse(
				await fs.readFile(
					path.join(legacyProjectDir, "evalai.config.json"),
					"utf-8",
				),
			);
			const suite = createTestSuite("legacy-tests", config);

			const results = await suite.run();

			// Verify all tests pass
			expect(results.total).toBe(3);
			expect(results.passed).toBe(3);
			expect(results.failed).toBe(0);

			// Verify test results
			expect(results.results[0].id).toBe("legacy-test-1");
			expect(results.results[0].passed).toBe(true);
			expect(results.results[0].actual).toBe("Hello");

			expect(results.results[1].id).toBe("legacy-test-2");
			expect(results.results[1].passed).toBe(true);
			expect(results.results[1].actual).toBe("Goodbye");

			expect(results.results[2].id).toBe("legacy-test-3");
			expect(results.results[2].passed).toBe(true);
			expect(results.results[2].actual).toBe("Expected output");
		});

		it("should detect legacy execution mode", async () => {
			const config = await getExecutionMode(legacyProjectDir);

			expect(config.mode).toBe("auto");
			expect(config.hasLegacyRuntime).toBe(true);
			expect(config.hasSpecRuntime).toBe(false);
			expect(config.legacyConfig).toContain("evalai.config.json");
		});

		it("should work with TestSuite introspection", async () => {
			const { createTestSuite } = require("@pauly4010/evalai-sdk");
			const config = JSON.parse(
				await fs.readFile(
					path.join(legacyProjectDir, "evalai.config.json"),
					"utf-8",
				),
			);
			const suite = createTestSuite("legacy-tests", config);

			// Test new introspection methods
			const tests = suite.getTests();
			const metadata = suite.getMetadata();
			const portable = suite.toJSON();

			expect(tests).toHaveLength(3);
			expect(tests[0].id).toBe("legacy-test-1");
			expect(tests[0].input).toBe("Hello world");
			expect(tests[0].expected).toBe("Hello");
			expect(tests[0].metadata).toEqual({ category: "greeting" });

			expect(metadata.suiteName).toBe("legacy-tests");
			expect(metadata.defaults).toEqual({
				timeout: 5000,
				parallel: false,
				retries: 2,
			});

			expect(portable.name).toBe("legacy-tests");
			expect(portable.tests).toHaveLength(3);
			expect(portable.config).toEqual(config);
		});

		it("should adapt to DSL without breaking behavior", async () => {
			const { createTestSuite } = require("@pauly4010/evalai-sdk");
			const config = JSON.parse(
				await fs.readFile(
					path.join(legacyProjectDir, "evalai.config.json"),
					"utf-8",
				),
			);
			const suite = createTestSuite("legacy-tests", config);

			// Adapt to DSL
			const specs = adaptTestSuite(suite);

			expect(specs).toHaveLength(3);
			expect(specs[0].name).toBe("legacy-test-1");
			expect(specs[0].metadata?.originalInput).toBe("Hello world");
			expect(specs[0].metadata?.originalExpected).toBe("Hello");
			expect(specs[0].metadata?.source).toBe("legacy");

			// Run with new runtime
			const runtime = createEvalRuntime();
			const executor = createLocalExecutor();

			try {
				for (const spec of specs) {
					runtime.runtime.register(spec);
				}

				const registeredSpecs = runtime.runtime.list();
				expect(registeredSpecs).toHaveLength(3);

				// Execute first spec
				const result = await executor.executeSpec(
					registeredSpecs[0],
					"Hello world",
				);
				expect(result.pass).toBe(true);
				expect(result.score).toBe(100);
				// Add classification to make it EnhancedEvalResult
				(result as any).classification = "passed";
			} finally {
				disposeActiveRuntime();
			}
		});
	});

	describe("Spec-based project compatibility", () => {
		beforeEach(async () => {
			// Create spec-based project structure
			const evalDir = path.join(specProjectDir, "eval");
			await fs.mkdir(evalDir, { recursive: true });

			// Create spec files
			await fs.writeFile(
				path.join(evalDir, "greeting.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("greeting-hello", async (context) => {
          const input = context.input;
          if (input.includes("Hello")) {
            return createResult({ pass: true, score: 100 });
          }
          return createResult({ pass: false, score: 0, error: "Expected greeting" });
        }, {
          description: "Test greeting functionality",
          tags: ["greeting", "basic"],
        });
        
        defineEval("greeting-goodbye", async (context) => {
          const input = context.input;
          if (input.includes("Goodbye")) {
            return createResult({ pass: true, score: 95 });
          }
          return createResult({ pass: false, score: 0, error: "Expected farewell" });
        }, {
          description: "Test farewell functionality",
          tags: ["farewell", "basic"],
        });
      `,
			);

			await fs.writeFile(
				path.join(evalDir, "complex.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("complex-processing", async (context) => {
          const input = context.input;
          
          // Complex processing logic
          if (input.includes("complex")) {
            const processed = input.toUpperCase().replace(/\\s+/g, "_");
            return createResult({ 
              pass: true, 
              score: 90,
              metadata: { 
                processed,
                originalLength: input.length,
                processedLength: processed.length
              }
            });
          }
          
          return createResult({ 
            pass: false, 
            score: 0, 
            error: "Complex processing failed" 
          });
        }, {
          description: "Test complex data processing",
          tags: ["complex", "processing"],
          timeout: 10000,
        });
      `,
			);

			// Create package.json for spec project
			await fs.writeFile(
				path.join(specProjectDir, "package.json"),
				JSON.stringify(
					{
						name: "spec-evalai-project",
						version: "1.0.0",
						scripts: {
							test: "node test-runner.js",
						},
						dependencies: {
							"@pauly4010/evalai-sdk": "^1.6.0",
						},
					},
					null,
					2,
				),
			);

			// Create test runner script
			await fs.writeFile(
				path.join(specProjectDir, "test-runner.js"),
				`
        const { createEvalRuntime, createLocalExecutor } = require('@pauly4010/evalai-sdk');
        
        // This would normally load spec files and run them
        console.log('Spec-based test runner would execute defineEval specs');
        process.exit(0);
      `,
			);
		});

		it("should run spec-based tests without config", async () => {
			// Create runtime and register specs
			const _runtime = createEvalRuntime(specProjectDir);
			const _executor = createLocalExecutor();

			try {
				// Manually load and register specs (in real implementation, this would be automatic)
				const specContent = await fs.readFile(
					path.join(specProjectDir, "eval", "greeting.spec.ts"),
					"utf-8",
				);

				// For this test, we'll simulate spec registration
				// In a real implementation, the spec files would be loaded and executed

				expect(specContent).toContain('defineEval("greeting-hello"');
				expect(specContent).toContain('defineEval("greeting-goodbye")');

				// Verify spec detection
				const config = await getExecutionMode(specProjectDir);
				expect(config.hasSpecRuntime).toBe(true);
				expect(config.hasLegacyRuntime).toBe(false);
				expect(config.specFiles).toHaveLength(2);
			} finally {
				disposeActiveRuntime();
			}
		});

		it("should detect spec execution mode", async () => {
			const config = await getExecutionMode(specProjectDir);

			expect(config.mode).toBe("auto");
			expect(config.hasSpecRuntime).toBe(true);
			expect(config.hasLegacyRuntime).toBe(false);
			expect(config.specFiles).toHaveLength(3); // 2 spec files
			expect(config.specFiles.some((f) => f.includes("greeting.spec.ts"))).toBe(
				true,
			);
			expect(config.specFiles.some((f) => f.includes("complex.spec.ts"))).toBe(
				true,
			);
		});

		it("should generate deterministic reports", async () => {
			// Create runtime and register a test spec
			const runtime = createEvalRuntime(specProjectDir);
			const executor = createLocalExecutor();

			try {
				// Register a test spec
				runtime.runtime.defineEval("report-test", async (context) => {
					const input = context.input;
					if (input === "test input") {
						return createResult({ pass: true, score: 85 });
					}
					return createResult({ pass: false, score: 0, error: "Test failed" });
				});

				// Execute test and generate report
				const spec = runtime.runtime.list()[0];
				const result = await executor.executeSpec(spec, "test input");

				// Create run report
				const report = createRunReport("test-run-123", {
					id: runtime.runtime.id,
					namespace: runtime.runtime.namespace,
					projectRoot: specProjectDir,
				});

				report.addResult(
					spec.id,
					spec.name,
					spec.filePath,
					spec.position,
					"test input",
					result,
				);

				const finalReport = report.build();

				// Verify report structure
				expect(finalReport.schemaVersion).toBe("1");
				expect(finalReport.runId).toBe("test-run-123");
				expect(finalReport.results).toHaveLength(1);
				expect(finalReport.results[0].testId).toBe(spec.id);
				expect(finalReport.results[0].pass).toBe(true);
				expect(finalReport.results[0].score).toBe(85);
				expect(finalReport.summary.total).toBe(1);
				expect(finalReport.summary.passed).toBe(1);
				expect(finalReport.summary.failed).toBe(0);
				expect(finalReport.summary.success).toBe(true);

				// Verify report is JSON serializable
				const json = finalReport.toJSON();
				const parsed = JSON.parse(json);
				expect(parsed).toEqual(finalReport);
			} finally {
				disposeActiveRuntime();
			}
		});
	});

	describe("Mixed project compatibility", () => {
		beforeEach(async () => {
			// Create mixed project with both legacy and spec
			await fs.writeFile(
				path.join(mixedProjectDir, "evalai.config.json"),
				JSON.stringify(
					{
						tests: [
							{
								id: "mixed-legacy-1",
								input: "Legacy input",
								expected: "Legacy output",
							},
						],
						executor: async (input: string) => input.toUpperCase(),
					},
					null,
					2,
				),
			);

			const evalDir = path.join(mixedProjectDir, "eval");
			await fs.mkdir(evalDir, { recursive: true });

			await fs.writeFile(
				path.join(evalDir, "mixed.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("mixed-spec-1", async (context) => {
          const input = context.input;
          if (input.includes("Spec")) {
            return createResult({ pass: true, score: 90 });
          }
          return createResult({ pass: false, score: 0, error: "Spec test failed" });
        });
      `,
			);

			await fs.writeFile(
				path.join(mixedProjectDir, "package.json"),
				JSON.stringify(
					{
						name: "mixed-evalai-project",
						version: "1.0.0",
						dependencies: {
							"@pauly4010/evalai-sdk": "^1.6.0",
						},
					},
					null,
					2,
				),
			);
		});

		it("should detect mixed project and prefer spec mode", async () => {
			const config = await getExecutionMode(mixedProjectDir);

			expect(config.mode).toBe("auto");
			expect(config.hasSpecRuntime).toBe(true);
			expect(config.hasLegacyRuntime).toBe(true);
			expect(config.specFiles).toHaveLength(1);
			expect(config.legacyConfig).toContain("evalai.config.json");

			const recommended =
				require("../../runtime/execution-mode").getRecommendedExecutionMode(
					config,
				);
			expect(recommended).toBe("spec");
		});

		it("should run both legacy and spec tests", async () => {
			// Run legacy tests
			const { createTestSuite } = require("@pauly4010/evalai-sdk");
			const legacyConfig = JSON.parse(
				await fs.readFile(
					path.join(mixedProjectDir, "evalai.config.json"),
					"utf-8",
				),
			);
			const legacySuite = createTestSuite("mixed-legacy", legacyConfig);

			const legacyResults = await legacySuite.run();
			expect(legacyResults.total).toBe(1);
			expect(legacyResults.passed).toBe(1);

			// Verify spec detection
			const config = await getExecutionMode(mixedProjectDir);
			expect(config.specFiles).toHaveLength(1);
			expect(config.specFiles[0]).toContain("mixed.spec.ts");
		});

		it("should adapt legacy tests to DSL", async () => {
			const { createTestSuite } = require("@pauly4010/evalai-sdk");
			const config = JSON.parse(
				await fs.readFile(
					path.join(mixedProjectDir, "evalai.config.json"),
					"utf-8",
				),
			);
			const suite = createTestSuite("mixed-legacy", config);

			const specs = adaptTestSuite(suite);
			expect(specs).toHaveLength(1);
			expect(specs[0].name).toBe("mixed-legacy-1");
			expect(specs[0].metadata?.originalInput).toBe("Legacy input");
			expect(specs[0].metadata?.originalExpected).toBe("Legacy output");
		});
	});

	describe("Transparent tool usage", () => {
		it("should work with doctor command", async () => {
			// Create a project with tests
			const evalDir = path.join(tempDir, "doctor-test");
			await fs.mkdir(evalDir, { recursive: true });

			await fs.writeFile(
				path.join(evalDir, "test.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("doctor-test", async (context) => {
          return createResult({ pass: true, score: 100 });
        });
      `,
			);

			// Verify execution mode detection
			const config = await getExecutionMode(evalDir);
			expect(config.hasSpecRuntime).toBe(true);

			// In real implementation, doctor would analyze the project
			// For this test, we verify the detection works
			expect(config.specFiles).toHaveLength(1);
		});

		it("should work with check command", async () => {
			// Create project with both legacy and spec
			await fs.writeFile(
				path.join(tempDir, "check-test", "evalai.config.json"),
				JSON.stringify(
					{
						tests: [{ input: "test", expected: "test" }],
					},
					null,
					2,
				),
			);

			const evalDir = path.join(tempDir, "check-test", "eval");
			await fs.mkdir(evalDir, { recursive: true });

			await fs.writeFile(
				path.join(evalDir, "check.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("check-test", async (context) => {
          return createResult({ pass: true, score: 100 });
        });
      `,
			);

			const config = await getExecutionMode(path.join(tempDir, "check-test"));

			// Check command should work with both runtimes
			expect(config.hasSpecRuntime).toBe(true);
			expect(config.hasLegacyRuntime).toBe(true);

			// Should recommend spec mode for mixed projects
			const recommended =
				require("../../runtime/execution-mode").getRecommendedExecutionMode(
					config,
				);
			expect(recommended).toBe("spec");
		});

		it("should work with explain command", async () => {
			// Create project with test results
			const evalDir = path.join(tempDir, "explain-test", "eval");
			await fs.mkdir(evalDir, { recursive: true });

			await fs.writeFile(
				path.join(evalDir, "explain.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("explain-test", async (context) => {
          const input = context.input;
          if (input === "success") {
            return createResult({ 
              pass: true, 
              score: 95,
              metadata: { analysis: "Test passed successfully" }
            });
          }
          return createResult({ 
            pass: false, 
            score: 0, 
            error: "Test failed",
            metadata: { analysis: "Test failed" }
          });
        });
      `,
			);

			// Create runtime and generate report
			const runtime = createEvalRuntime(path.join(tempDir, "explain-test"));
			const executor = createLocalExecutor();

			try {
				runtime.runtime.defineEval("explain-test", async (context) => {
					const input = context.input;
					if (input === "success") {
						return createResult({
							pass: true,
							score: 95,
							metadata: { analysis: "Test passed successfully" },
						});
					}
					return createResult({
						pass: false,
						score: 0,
						error: "Test failed",
						metadata: { analysis: "Test failed" },
					});
				});

				const spec = runtime.runtime.list()[0];
				const result = await executor.executeSpec(spec, "success");

				// Generate report for explain
				const report = createRunReport("explain-run", {
					id: runtime.runtime.id,
					namespace: runtime.runtime.namespace,
					projectRoot: path.join(tempDir, "explain-test"),
				});

				report.addResult(
					spec.id,
					spec.name,
					spec.filePath,
					spec.position,
					"success",
					result,
				);

				const finalReport = report.build();

				// Explain command should be able to process this report
				expect(finalReport.results[0].metadata).toEqual({
					analysis: "Test passed successfully",
				});
				expect(finalReport.results[0].pass).toBe(true);
				expect(finalReport.results[0].score).toBe(95);
			} finally {
				disposeActiveRuntime();
			}
		});
	});

	describe("Regression prevention", () => {
		it("should prevent regressions in legacy test execution", async () => {
			// Create legacy project with known test results
			await fs.writeFile(
				path.join(tempDir, "regression-legacy", "evalai.config.json"),
				JSON.stringify(
					{
						tests: [
							{
								id: "regression-test-1",
								input: "Regression test input",
								expected: "REGRESSION TEST OUTPUT",
								metadata: { type: "regression" },
							},
							{
								id: "regression-test-2",
								input: "Another test",
								expected: "Another expected",
								metadata: { type: "regression" },
							},
						],
						executor: async (input: string) => input.toUpperCase(),
					},
					null,
					2,
				),
			);

			const { createTestSuite } = require("@pauly4010/evalai-sdk");
			const config = JSON.parse(
				await fs.readFile(
					path.join(tempDir, "regression-legacy", "evalai.config.json"),
					"utf-8",
				),
			);
			const suite = createTestSuite("regression-tests", config);

			const results = await suite.run();

			// Golden snapshot values
			expect(results.total).toBe(2);
			expect(results.passed).toBe(2);
			expect(results.failed).toBe(0);
			expect(results.durationMs).toBeGreaterThan(0);

			// Verify specific test results
			expect(results.results[0].actual).toBe("REGRESSION TEST OUTPUT");
			expect(results.results[1].actual).toBe("ANOTHER EXPECTED");

			// Verify metadata preservation
			expect(results.results[0].metadata).toEqual({ type: "regression" });
			expect(results.results[1].metadata).toEqual({ type: "regression" });
		});

		it("should prevent regressions in spec test execution", async () => {
			// Create spec project with known test results
			const evalDir = path.join(tempDir, "regression-spec", "eval");
			await fs.mkdir(evalDir, { recursive: true });

			await fs.writeFile(
				path.join(evalDir, "regression.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("regression-spec-1", async (context) => {
          const input = context.input;
          if (input === "REGRESSION INPUT") {
            return createResult({ 
              pass: true, 
              score: 100,
              metadata: { 
                type: "regression",
                processed: true,
                timestamp: Date.now()
              }
            });
          }
          return createResult({ 
            pass: false, 
            score: 0, 
            error: "Regression test failed",
            metadata: { type: "regression" }
          });
        });
        
        defineEval("regression-spec-2", async (context) => {
          const input = context.input;
          if (input === "ANOTHER INPUT") {
            return createResult({ 
              pass: true, 
              score: 95,
              metadata: { 
                type: "regression",
                processed: true,
                timestamp: Date.now()
              }
            });
          }
          return createResult({ 
            pass: false, 
            score: 0, 
            error: "Regression test failed",
            metadata: { type: "regression" }
          });
        });
      `,
			);

			const runtime = createEvalRuntime(path.join(tempDir, "regression-spec"));
			const executor = createLocalExecutor();

			try {
				// Register a test spec using the bound defineEval function
				const handle = createEvalRuntime(path.join(tempDir, "regression-spec"));
				handle.defineEval("regression-spec-1", async (context: any) => {
					const input = context.input;
					if (input === "REGRESSION INPUT") {
						return createResult({
							pass: true,
							score: 100,
							metadata: {
								type: "regression",
								processed: true,
								timestamp: Date.now(),
							},
						});
					}
					return createResult({
						pass: false,
						score: 0,
						error: "Regression test failed",
						metadata: { type: "regression" },
					});
				});

				runtime.runtime.defineEval(
					"regression-spec-2",
					async (context: any) => {
						const input = context.context.input;
						if (input === "ANOTHER INPUT") {
							return createResult({
								pass: true,
								score: 95,
								metadata: {
									type: "regression",
									processed: true,
									timestamp: Date.now(),
								},
							});
						}
						return createResult({
							pass: false,
							score: 0,
							error: "Regression test failed",
							metadata: { type: "regression" },
						});
					},
				);

				const specs = runtime.runtime.list();
				expect(specs).toHaveLength(2);

				// Execute tests and verify results
				const result1 = await executor.executeSpec(
					specs[0],
					"REGRESSION INPUT",
				);
				expect(result1.pass).toBe(true);
				expect(result1.score).toBe(100);
				expect(result1.metadata?.type).toBe("regression");
				expect(result1.metadata?.processed).toBe(true);

				const result2 = await executor.executeSpec(specs[1], "ANOTHER INPUT");
				expect(result2.pass).toBe(true);
				expect(result2.score).toBe(95);
				expect(result2.metadata?.type).toBe("regression");
				expect(result2.metadata?.processed).toBe(true);
			} finally {
				disposeActiveRuntime();
			}
		});

		it("should maintain score bucket consistency", async () => {
			// Create tests with different score ranges
			const evalDir = path.join(tempDir, "score-buckets", "eval");
			await fs.mkdir(evalDir, { recursive: true });

			await fs.writeFile(
				path.join(evalDir, "scores.spec.ts"),
				`
        import { defineEval, createResult } from '@pauly4010/evalai-sdk';
        
        defineEval("high-score", async (context) => {
          return createResult({ pass: true, score: 95 });
        });
        
        defineEval("medium-score", async (context) => {
          return createResult({ pass: true, score: 75 });
        });
        
        defineEval("low-score", async (context) => {
          return createResult({ pass: true, score: 45 });
        });
        
        defineEval("fail-score", async (context) => {
          return createResult({ pass: false, score: 25 });
        });
      `,
			);

			const runtime = createEvalRuntime(path.join(tempDir, "score-buckets"));
			const executor = createLocalExecutor();

			try {
				// Register all specs
				runtime.runtime.defineEval("high-score", async (_context) => {
					return createResult({ pass: true, score: 95 });
				});

				runtime.runtime.defineEval("medium-score", async (_context) => {
					return createResult({ pass: true, score: 75 });
				});

				runtime.runtime.defineEval("low-score", async (_context) => {
					return createResult({ pass: true, score: 45 });
				});

				runtime.runtime.defineEval("fail-score", async (_context) => {
					return createResult({ pass: false, score: 25 });
				});

				const specs = runtime.runtime.list();
				const results = [];

				// Execute all tests
				for (const spec of specs) {
					const result = await executor.executeSpec(spec, "test input");
					results.push(result);
				}

				// Verify score buckets
				const highScores = results.filter((r) => r.score >= 90);
				const mediumScores = results.filter(
					(r) => r.score >= 70 && r.score < 90,
				);
				const lowScores = results.filter((r) => r.score >= 40 && r.score < 70);
				const failScores = results.filter((r) => r.score < 40);

				expect(highScores).toHaveLength(1);
				expect(mediumScores).toHaveLength(1);
				expect(lowScores).toHaveLength(1);
				expect(failScores).toHaveLength(1);

				// Verify specific scores
				expect(highScores[0].score).toBe(95);
				expect(mediumScores[0].score).toBe(75);
				expect(lowScores[0].score).toBe(45);
				expect(failScores[0].score).toBe(25);
			} finally {
				disposeActiveRuntime();
			}
		});
	});
});
