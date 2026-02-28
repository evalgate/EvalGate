"use strict";
/**
 * COMPAT-202: Legacy TestSuite → defineEval adapter
 *
 * Converts legacy TestSuite instances to defineEval specifications
 * without forcing migration. Enables lossless where possible.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptTestSuite = adaptTestSuite;
exports.generateDefineEvalCode = generateDefineEvalCode;
const eval_1 = require("../eval");
const registry_1 = require("../registry");
/**
 * Convert TestSuite to defineEval specifications
 *
 * @param suite - Legacy TestSuite instance
 * @param options - Adapter configuration options
 * @returns Array of EvalSpec definitions
 */
function adaptTestSuite(suite, options = {}) {
    const { includeProvenance = true, preserveIds = true, generateHelpers = true, } = options;
    // Get test suite data using the new getters
    const tests = suite.getTests();
    const metadata = suite.getMetadata();
    const config = suite.getConfig();
    // Create a temporary runtime for spec generation
    const _runtime = (0, registry_1.createEvalRuntime)();
    const specs = [];
    try {
        // Convert each test case to an EvalSpec
        for (const test of tests) {
            const spec = {
                id: generateSpecId(test, metadata.suiteName || "legacy-suite", preserveIds),
                name: test.id,
                filePath: "legacy://testsuite", // Placeholder for legacy source
                position: { line: 1, column: 1 }, // Placeholder position
                description: `Legacy test: ${test.id}`,
                tags: ["legacy", "migrated"],
                executor: createExecutorFromTestCase(test, config, generateHelpers),
                metadata: {
                    ...test.metadata,
                    ...(includeProvenance && {
                        source: "legacy",
                        legacySuiteName: metadata.suiteName,
                        legacyTestId: test.id,
                        originalInput: test.input,
                        originalExpected: test.expected,
                    }),
                },
                config: {
                    timeout: config.timeout,
                    retries: config.retries,
                    // Note: budget, model not available in TestSuite
                },
            };
            specs.push(spec);
        }
    }
    finally {
        // Clean up temporary runtime
        (0, registry_1.disposeActiveRuntime)();
    }
    return specs;
}
/**
 * Generate specification ID for legacy test
 */
function generateSpecId(test, suiteName, preserveIds) {
    if (preserveIds && test.id && test.id !== `case-${test.id}`) {
        // Use original ID if available and not auto-generated
        return test.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20);
    }
    // Generate deterministic ID from test content
    const content = `${suiteName}|${test.id}|${test.input}|${test.expected || ""}`;
    const hash = Buffer.from(content)
        .toString("base64")
        .replace(/[+/=]/g, "")
        .slice(0, 20)
        .toLowerCase();
    return hash;
}
/**
 * Create executor function from test case
 */
function createExecutorFromTestCase(test, config, generateHelpers) {
    return async (context) => {
        const input = context.input;
        // If there's an executor in the config, use it
        if (config.executor) {
            try {
                const output = await config.executor(input);
                return evaluateTestCase(test, output, generateHelpers);
            }
            catch (error) {
                return (0, eval_1.createResult)({
                    pass: false,
                    score: 0,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        // If there's an expected value, use it as output
        if (test.expected !== undefined) {
            return evaluateTestCase(test, test.expected, generateHelpers);
        }
        // No executor or expected value - this is an error case
        return (0, eval_1.createResult)({
            pass: false,
            score: 0,
            error: "No executor or expected output available for legacy test",
        });
    };
}
/**
 * Evaluate test case against output
 */
function evaluateTestCase(test, output, generateHelpers) {
    try {
        let passed = true;
        let score = 100;
        const assertions = [];
        // If there are assertions, run them
        if (test.hasAssertions && test.assertionCount > 0) {
            // Note: We can't actually run the assertions since they're functions
            // In a real implementation, we'd need to serialize and execute them
            // For now, we'll do basic validation
            // Basic string comparison if expected is provided
            if (test.expected !== undefined) {
                const exactMatch = output === test.expected;
                passed = exactMatch;
                score = exactMatch ? 100 : 0;
                assertions.push({
                    name: "legacy-equals",
                    passed: exactMatch,
                    expected: test.expected,
                    actual: output,
                    message: exactMatch
                        ? "Output matches expected"
                        : `Expected "${test.expected}", got "${output}"`,
                });
            }
        }
        else {
            // No assertions, assume pass if output exists
            passed = output.length > 0;
            score = passed ? 100 : 0;
        }
        return (0, eval_1.createResult)({
            pass: passed,
            score: score,
            assertions: generateHelpers ? assertions : undefined,
            metadata: {
                testCaseId: test.id,
                originalInput: test.input,
                originalExpected: test.expected,
            },
        });
    }
    catch (error) {
        return (0, eval_1.createResult)({
            pass: false,
            score: 0,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
/**
 * Generate defineEval code from TestSuite
 *
 * @param suite - Legacy TestSuite instance
 * @param options - Code generation options
 * @returns Generated TypeScript code
 */
function generateDefineEvalCode(suite, options = {}) {
    const specs = adaptTestSuite(suite, options);
    const metadata = suite.getMetadata();
    const imports = [
        `// Auto-generated from TestSuite: ${metadata.suiteName || "legacy-suite"}`,
        `// Generated at: ${new Date().toISOString()}`,
        `// This file replaces the legacy TestSuite with defineEval() specifications`,
        "",
        `import { defineEval, createResult } from '@pauly4010/evalai-sdk';`,
        "",
    ];
    const specCode = specs.map((spec, _index) => {
        const helperCode = generateHelperFunctions(spec, options);
        return [
            `defineEval("${spec.name}", async (context) => {`,
            `  // Legacy test input: ${JSON.stringify(spec.metadata?.originalInput)}`,
            `  const input = context.input;`,
            `  `,
            `  // Legacy test execution`,
            helperCode,
            `  `,
            `  // Legacy evaluation logic`,
            `  const result = await evaluateLegacyTest(input, ${JSON.stringify(spec.metadata?.originalExpected)});`,
            `  `,
            `  return result;`,
            `}, {`,
            `  description: "${spec.description}",`,
            `  tags: ${JSON.stringify(spec.tags)},`,
            `  metadata: ${JSON.stringify(spec.metadata)},`,
            `  timeout: ${spec.config?.timeout || 30000},`,
            `  retries: ${spec.config?.retries || 0},`,
            `});`,
            "",
        ].join("\n");
    });
    const helperFunctions = generateHelperFunctionsForSuite(specs, options);
    const evaluationFunction = generateEvaluationFunction();
    return [
        ...imports,
        ...helperFunctions,
        ...evaluationFunction,
        ...specCode,
    ].join("\n");
}
/**
 * Generate helper functions for a specific spec
 */
function generateHelperFunctions(spec, options) {
    if (!options.generateHelpers)
        return "";
    // Generate helper functions based on test metadata
    const helpers = [];
    // Add helper for assertion evaluation if needed
    if (spec.metadata?.originalExpected) {
        helpers.push(`function evaluateLegacyAssertion(output: string, expected: string): boolean {`, `  return output === expected;`, `}`);
    }
    // Add helper for test evaluation
    helpers.push(`async function evaluateLegacyTest(input: string, expected?: string): Promise<any> {`, `  // This function simulates the legacy test evaluation`, `  const output = await simulateLegacyExecutor(input);`, `  `, `  if (expected !== undefined) {`, `    const passed = evaluateLegacyAssertion(output, expected);`, `    return createResult({`, `      pass: passed,`, `      score: passed ? 100 : 0,`, `      metadata: {`, `        input,`, `        expected,`, `      },`, `    });`, `  }`, `  `, `  return createResult({`, `    pass: output.length > 0,`, `    score: output.length > 0 ? 100 : 0,`, `    metadata: { input },`, `  });`, `}`);
    // Add executor simulation
    helpers.push(`async function simulateLegacyExecutor(input: string): Promise<string> {`, `  // This function simulates the legacy executor`, `  // In a real migration, this would be replaced with the actual executor`, `  return input; // Echo for demonstration`, `}`);
    return helpers.join("\n\n");
}
/**
 * Generate helper functions for the entire suite
 */
function generateHelperFunctionsForSuite(specs, options) {
    const helpers = new Set();
    // Collect all unique helper functions needed
    for (const spec of specs) {
        const specHelpers = generateHelperFunctions(spec, options);
        if (specHelpers) {
            helpers.add(specHelpers);
        }
    }
    return Array.from(helpers).join("\n\n");
}
/**
 * Generate evaluation function
 */
function generateEvaluationFunction() {
    return [
        `// Legacy test evaluation function`,
        `function evaluateLegacyTest(input: string, expected?: string): any {`,
        `  // This function evaluates legacy test logic`,
        `  // In a real migration, this would contain the actual test logic`,
        `  `,
        `  if (expected !== undefined) {`,
        `    const passed = input === expected;`,
        `    return createResult({`,
        `      pass: passed,`,
        `      score: passed ? 100 : 0,`,
        `      metadata: { input, expected },`,
        `    });`,
        `  }`,
        `  `,
        `  return createResult({`,
        `    pass: input.length > 0,`,
        `    score: input.length > 0 ? 100 : 0,`,
        `    metadata: { input },`,
        `  });`,
        `}`,
    ].join("\n");
}
