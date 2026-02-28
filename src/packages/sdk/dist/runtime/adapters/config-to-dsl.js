"use strict";
/**
 * Config → DSL Adapter - LAYER 2 Compatibility Bridge
 *
 * Migrates existing evalai.config.json and TestSuite configurations
 * to the new defineEval() DSL without breaking user workflows.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateTestSuiteToDSL = migrateTestSuiteToDSL;
exports.migrateConfigToDSL = migrateConfigToDSL;
exports.migrateProjectToDSL = migrateProjectToDSL;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const registry_1 = require("../registry");
/**
 * Convert TestSuite to defineEval() specifications
 */
function migrateTestSuiteToDSL(testSuite, outputPath) {
    const result = {
        success: true,
        specsGenerated: 0,
        errors: [],
        warnings: [],
        outputPath,
    };
    try {
        // Create isolated runtime for migration
        const _runtime = (0, registry_1.createEvalRuntime)();
        // Use the runtime handle to define specs
        const _boundDefineEval = (nameOrConfig, executor, options) => {
            // The runtime handle manages the active runtime internally
            const { defineEval } = require("../eval");
            return defineEval(nameOrConfig, executor, options);
        };
        // Get test suite data via public methods
        // Note: We need to access the internal data structure for migration
        // This is a limitation of the current TestSuite design
        const suiteData = extractTestSuiteData(testSuite);
        // Generate DSL file content
        const dslContent = generateDSLFromTestSuiteData(suiteData);
        // Write DSL file
        fs.writeFileSync(outputPath, dslContent, "utf-8");
        result.specsGenerated = suiteData.cases.length;
        result.warnings.push(`Migrated ${suiteData.cases.length} test cases from TestSuite to defineEval() DSL`);
        // Cleanup runtime
        (0, registry_1.disposeActiveRuntime)();
    }
    catch (error) {
        result.success = false;
        result.errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return result;
}
/**
 * Extract data from TestSuite instance
 * This is a workaround for the private properties
 */
function extractTestSuiteData(_testSuite) {
    // Since TestSuite properties are private, we need to reconstruct from usage
    // This is a limitation that should be addressed in a future version
    // For now, we'll create a basic structure and warn the user
    return {
        name: "test-suite", // Can't access private name
        cases: [], // Can't access private config
        config: {
            cases: [],
            timeout: 30000,
            parallel: true,
            stopOnFailure: false,
            retries: 0,
        },
    };
}
/**
 * Convert evalai.config.json to DSL specifications
 */
function migrateConfigToDSL(configPath, outputPath) {
    const result = {
        success: true,
        specsGenerated: 0,
        errors: [],
        warnings: [],
        outputPath,
    };
    try {
        if (!fs.existsSync(configPath)) {
            result.success = false;
            result.errors.push(`Configuration file not found: ${configPath}`);
            return result;
        }
        const configContent = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(configContent);
        // Create isolated runtime for migration
        const _runtime = (0, registry_1.createEvalRuntime)();
        // Use the runtime handle to define specs
        const _boundDefineEval = (nameOrConfig, executor, options) => {
            // The runtime handle manages the active runtime internally
            const { defineEval } = require("../eval");
            return defineEval(nameOrConfig, executor, options);
        };
        // Generate basic DSL structure from config
        const dslContent = generateDSLFromConfig(config);
        // Write DSL file
        fs.writeFileSync(outputPath, dslContent, "utf-8");
        result.specsGenerated = 1; // Basic structure generated
        result.warnings.push("Generated basic DSL structure from evalai.config.json. Manual completion required.");
        // Cleanup runtime
        (0, registry_1.disposeActiveRuntime)();
    }
    catch (error) {
        result.success = false;
        result.errors.push(`Config migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return result;
}
/**
 * Generate DSL code from TestSuite data
 */
function generateDSLFromTestSuiteData(suiteData) {
    const imports = [
        `// Auto-generated from TestSuite: ${suiteData.name}`,
        `// Generated at: ${new Date().toISOString()}`,
        `// This file replaces the old TestSuite configuration`,
        "",
        `import { defineEval, createResult } from '@pauly4010/evalai-sdk';`,
        "",
    ];
    const specs = suiteData.cases.map((testCase, index) => {
        const specName = testCase.id || `${suiteData.name}-case-${index + 1}`;
        // Generate assertion code
        const assertionCode = testCase.assertions
            ? generateAssertionCode(testCase.assertions)
            : "// No assertions defined";
        return [
            `defineEval("${specName}", async (context) => {`,
            `  // Original input: ${testCase.input}`,
            `  const input = context.input;`,
            `  `,
            `  // TODO: Replace with your actual agent/LLM call`,
            `  const output = await simulateAgent(input);`,
            `  `,
            `  // Assertions:`,
            assertionCode,
            `  `,
            `  return createResult({`,
            `    pass: allAssertionsPassed,`,
            `    score: allAssertionsPassed ? 100 : 0,`,
            `    assertions: assertionResults,`,
            `    metadata: {`,
            `      originalInput: ${JSON.stringify(testCase.input)},`,
            `      originalExpected: ${testCase.expected ? JSON.stringify(testCase.expected) : "undefined"},`,
            `    },`,
            `  });`,
            `}, {`,
            `  description: "Migrated from TestSuite case",`,
            `  tags: ["migrated", "testsuite"],`,
            `});`,
            "",
        ].join("\n");
    });
    const helperFunctions = [
        `// Helper function to simulate your agent/LLM`,
        `// Replace this with your actual implementation`,
        `async function simulateAgent(input: string): Promise<string> {`,
        `  // TODO: Implement your actual agent/LLM call here`,
        `  // For now, return a simple echo as placeholder`,
        `  return \`Agent response to: \${input}\`;`,
        `}`,
        "",
    ];
    return [...imports, ...helperFunctions, ...specs].join("\n");
}
/**
 * Generate DSL code from configuration
 */
function generateDSLFromConfig(config) {
    return [
        `// Auto-generated from evalai.config.json`,
        `// Generated at: ${new Date().toISOString()}`,
        `// This is a basic DSL structure - complete with your actual evaluations`,
        "",
        `import { defineEval, createResult } from '@pauly4010/evalai-sdk';`,
        "",
        `defineEval("basic-evaluation", async (context) => {`,
        `  const input = context.input;`,
        `  `,
        `  // TODO: Replace with your actual agent/LLM call`,
        `  const output = await simulateAgent(input);`,
        `  `,
        `  // TODO: Add your actual evaluation logic`,
        `  const pass = output.length > 0;`,
        `  const score = pass ? 100 : 0;`,
        `  `,
        `  return createResult({`,
        `    pass,`,
        `    score,`,
        `    metadata: {`,
        `      evaluationId: ${config.evaluationId ? JSON.stringify(config.evaluationId) : "undefined"},`,
        `      input,`,
        `      output,`,
        `    },`,
        `  });`,
        `}, {`,
        `  description: "Basic evaluation migrated from evalai.config.json",`,
        `  tags: ["migrated", "config"],`,
        `});`,
        "",
        `// Helper function to simulate your agent/LLM`,
        `// Replace this with your actual implementation`,
        `async function simulateAgent(input: string): Promise<string> {`,
        `  // TODO: Implement your actual agent/LLM call here`,
        `  return \`Agent response to: \${input}\`;`,
        `}`,
        "",
    ].join("\n");
}
/**
 * Generate assertion code from TestSuite assertions
 */
function generateAssertionCode(assertions) {
    // Since we can't analyze the assertion functions at runtime,
    // we generate placeholder code that users need to complete
    return [
        `  // Original assertions: ${assertions.length} defined`,
        `  // TODO: Manually convert these assertions to evaluation logic:`,
        ...assertions.map((_, index) => `  // assertion ${index + 1}: <convert to evaluation logic>`),
        `  `,
        `  const assertionResults = [];`,
        `  let allAssertionsPassed = true;`,
        `  `,
        `  // TODO: Add your actual assertion logic here`,
        `  // Example:`,
        `  // const containsExpected = output.includes(expected);`,
        `  // assertionResults.push({ name: "contains-expected", passed: containsExpected });`,
        `  // if (!containsExpected) allAssertionsPassed = false;`,
    ].join("\n");
}
/**
 * Discover and migrate all TestSuite configurations in a project
 */
function migrateProjectToDSL(projectRoot, options = {}) {
    const result = {
        success: true,
        specsGenerated: 0,
        errors: [],
        warnings: [],
        outputPath: options.outputDir || path.join(projectRoot, ".evalai", "migrated"),
    };
    try {
        // Find evalai.config.json
        const configPath = path.join(projectRoot, "evalai.config.json");
        if (fs.existsSync(configPath)) {
            const outputPath = path.join(result.outputPath, "evalai.config.migrated.ts");
            if (!options.dryRun) {
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
                const configResult = migrateConfigToDSL(configPath, outputPath);
                result.specsGenerated += configResult.specsGenerated;
                result.errors.push(...configResult.errors);
                result.warnings.push(...configResult.warnings);
            }
            else {
                result.warnings.push(`Would migrate evalai.config.json to ${outputPath}`);
            }
        }
        // Look for TestSuite usage in TypeScript/JavaScript files
        const testFiles = findTestSuiteFiles(projectRoot);
        for (const testFile of testFiles) {
            const outputPath = path.join(result.outputPath, path.basename(testFile).replace(/\.(ts|js)$/, ".migrated.ts"));
            if (!options.dryRun) {
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
                // Note: Actual TestSuite parsing would require AST analysis
                // For now, we create placeholder files
                const placeholderContent = generatePlaceholderDSL(testFile);
                fs.writeFileSync(outputPath, placeholderContent, "utf-8");
                result.specsGenerated += 1;
                result.warnings.push(`Created migration placeholder for ${testFile}`);
            }
            else {
                result.warnings.push(`Would migrate ${testFile} to ${outputPath}`);
            }
        }
        if (result.specsGenerated === 0) {
            result.warnings.push("No TestSuite configurations found to migrate");
        }
    }
    catch (error) {
        result.success = false;
        result.errors.push(`Project migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return result;
}
/**
 * Find files that might contain TestSuite usage
 */
function findTestSuiteFiles(projectRoot) {
    const testFiles = [];
    function scanDirectory(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() &&
                !entry.name.startsWith(".") &&
                entry.name !== "node_modules") {
                scanDirectory(fullPath);
            }
            else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
                try {
                    const content = fs.readFileSync(fullPath, "utf-8");
                    if (content.includes("createTestSuite") ||
                        content.includes("TestSuite")) {
                        testFiles.push(fullPath);
                    }
                }
                catch {
                    // Skip files that can't be read
                }
            }
        }
    }
    scanDirectory(projectRoot);
    return testFiles;
}
/**
 * Generate placeholder DSL for files that need manual migration
 */
function generatePlaceholderDSL(originalFile) {
    return [
        `// Migration placeholder for: ${originalFile}`,
        `// Generated at: ${new Date().toISOString()}`,
        `// This file contains TestSuite usage that needs manual migration`,
        "",
        `import { defineEval, createResult } from '@pauly4010/evalai-sdk';`,
        "",
        `defineEval("placeholder-from-${path.basename(originalFile)}", async (context) => {`,
        `  // TODO: Manually migrate TestSuite from ${originalFile}`,
        `  const input = context.input;`,
        `  `,
        `  // Replace with your actual evaluation logic`,
        `  const output = await simulateAgent(input);`,
        `  `,
        `  return createResult({`,
        `    pass: output.length > 0,`,
        `    score: output.length > 0 ? 100 : 0,`,
        `    metadata: {`,
        `      migratedFrom: ${JSON.stringify(originalFile)},`,
        `    },`,
        `  });`,
        `}, {`,
        `  description: "Placeholder - complete migration manually",`,
        `  tags: ["placeholder", "needs-migration"],`,
        `});`,
        "",
        `async function simulateAgent(input: string): Promise<string> {`,
        `  // TODO: Implement your actual agent/LLM call`,
        `  return \`Response to: \${input}\`;`,
        `}`,
        "",
    ].join("\n");
}
