"use strict";
/**
 * COMPAT-203: Config → DSL migration generator (file-based)
 *
 * CLI command: evalgate migrate config --in evalgate.config.json --out eval/legacy.spec.ts
 * Generates defineEval() calls with comments and TODOs for manual completion
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
exports.migrateConfig = migrateConfig;
exports.createMigrateCommand = createMigrateCommand;
exports.validateConfigFile = validateConfigFile;
exports.previewMigration = previewMigration;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const commander_1 = require("commander");
const testsuite_to_dsl_1 = require("../runtime/adapters/testsuite-to-dsl");
const testing_1 = require("../testing");
/**
 * Read and parse evalgate.config.json (or evalai.config.json)
 */
async function readConfigFile(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch (error) {
        throw new Error(`Failed to read config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Extract TestSuite data from config
 */
function extractTestSuitesFromConfig(config) {
    const suites = [];
    // Handle different config structures
    if (config.tests) {
        // Direct tests array
        const suite = (0, testing_1.createTestSuite)("config-tests", {
            cases: config.tests,
            executor: config.executor,
            timeout: config.timeout,
            parallel: config.parallel,
            stopOnFailure: config.stopOnFailure,
            retries: config.retries,
        });
        suites.push({ name: "config-tests", suite });
    }
    if (config.suites) {
        // Multiple named suites
        for (const [suiteName, suiteConfig] of Object.entries(config.suites)) {
            const suite = (0, testing_1.createTestSuite)(suiteName, suiteConfig);
            suites.push({ name: suiteName, suite });
        }
    }
    if (config.testSuites) {
        // Alternative property name
        for (const [suiteName, suiteConfig] of Object.entries(config.testSuites)) {
            const suite = (0, testing_1.createTestSuite)(suiteName, suiteConfig);
            suites.push({ name: suiteName, suite });
        }
    }
    return suites;
}
/**
 * Generate DSL file header
 */
function generateFileHeader(_config, options) {
    const timestamp = new Date().toISOString();
    const inputPath = path.resolve(options.input);
    const outputPath = path.resolve(options.output);
    return [
        `/**`,
        ` * Auto-generated EvalGate DSL from configuration`,
        ` * `,
        ` * Generated at: ${timestamp}`,
        ` * Source config: ${inputPath}`,
        ` * Output file: ${outputPath}`,
        ` * `,
        ` * This file contains defineEval() specifications migrated from evalgate.config.json`,
        ` * `,
        ` * ⚠️  IMPORTANT: This is a best-effort migration. Manual review and completion required.`,
        ` * `,
        ` * Migration notes:`,
        ` * - Executors have been converted to async functions`,
        ` * - Assertions have been converted where possible`,
        ` * - Complex logic may need manual adaptation`,
        ` * - Review TODO comments for items requiring attention`,
        ` */`,
        ``,
        `import { defineEval, createResult } from '@evalgate/sdk';`,
        ``,
    ].join("\n");
}
/**
 * Generate helper functions for the entire file
 */
function generateGlobalHelpers(config, _options) {
    const helpers = [];
    // Add executor helper if config has executor
    if (config.executor) {
        helpers.push([
            `/**`,
            ` * Legacy executor function from config`,
            ` * TODO: Replace with actual executor implementation`,
            ` */`,
            `async function legacyExecutor(input: string): Promise<string> {`,
            `  // Original executor was: ${config.executor.toString()}`,
            `  // TODO: Implement actual executor logic here`,
            `  return input; // Placeholder`,
            `}`,
            ``,
        ].join("\n"));
    }
    // Add assertion helpers
    helpers.push([
        `/**`,
        ` * Helper function for legacy assertion evaluation`,
        ` * TODO: Implement actual assertion logic based on original config`,
        ` */`,
        `function evaluateAssertions(output: string, expected?: string): boolean {`,
        `  if (expected !== undefined) {`,
        `    return output === expected;`,
        `  }`,
        `  return output.length > 0;`,
        `}`,
        ``,
    ].join("\n"));
    // Add evaluation helper
    helpers.push([
        `/**`,
        ` * Legacy test evaluation function`,
        ` * TODO: Adapt based on your original test logic`,
        ` */`,
        `async function evaluateLegacyTest(input: string, expected?: string): Promise<unknown> {`,
        `  const output = await legacyExecutor(input);`,
        `  const passed = evaluateAssertions(output, expected);`,
        `  `,
        `  return createResult({`,
        `    pass: passed,`,
        `    score: passed ? 100 : 0,`,
        `    metadata: { input, expected },`,
        `  });`,
        `}`,
        ``,
    ].join("\n"));
    return helpers.join("\n");
}
/**
 * Generate DSL content for a single suite
 */
function generateSuiteDSL(suiteName, suite, options) {
    const dslCode = (0, testsuite_to_dsl_1.generateDefineEvalCode)(suite, {
        generateHelpers: options.helpers,
        preserveIds: options.preserveIds,
        includeProvenance: options.provenance,
    });
    // Add suite-specific comments
    const header = [
        `/**`,
        ` * Test suite: ${suiteName}`,
        ` * Migrated from evalgate.config.json`,
        ` * `,
        ` * TODO items for this suite:`,
        ` * - Review executor implementation`,
        ` * - Verify assertion logic`,
        ` * - Test with actual data`,
        ` */`,
        ``,
    ].join("\n");
    return header + dslCode;
}
/**
 * Generate migration summary
 */
function generateSummary(suites, options) {
    const totalTests = suites.reduce((sum, { suite }) => sum + suite.getTests().length, 0);
    const totalSuites = suites.length;
    return [
        `/**`,
        ` * Migration Summary`,
        ` * =================`,
        ` * `,
        ` * Total suites migrated: ${totalSuites}`,
        ` * Total tests migrated: ${totalTests}`,
        ` * `,
        ` * Migration options used:`,
        ` * - Include helpers: ${options.helpers}`,
        ` * - Preserve IDs: ${options.preserveIds}`,
        ` * - Include provenance: ${options.provenance}`,
        ` * `,
        ` * Next steps:`,
        ` * 1. Review all TODO comments in this file`,
        ` * 2. Implement actual executor logic`,
        ` * 3. Adapt complex assertions`,
        ` * 4. Test with real data`,
        ` * 5. Remove evalgate.config.json when satisfied`,
        ` * `,
        ` * For help with migration, see: https://github.com/pauly7610/ai-evaluation-platform/docs/MIGRATION.md`,
        ` */`,
        ``,
    ].join("\n");
}
/**
 * Main migration function
 */
async function migrateConfig(options) {
    try {
        // Read input config
        const config = await readConfigFile(options.input);
        // Extract test suites
        const suites = extractTestSuitesFromConfig(config);
        if (suites.length === 0) {
            throw new Error("No test suites found in config file. Check config structure.");
        }
        // Generate DSL content
        const content = [
            generateFileHeader(config, options),
            generateGlobalHelpers(config, options),
            ...suites.map(({ name, suite }) => generateSuiteDSL(name, suite, options)),
            generateSummary(suites, options),
        ].join("\n");
        // Ensure output directory exists
        const outputDir = path.dirname(options.output);
        await fs.mkdir(outputDir, { recursive: true });
        // Write output file
        await fs.writeFile(options.output, content, "utf-8");
        console.log(`✅ Migration complete!`);
        console.log(`📁 Output written to: ${path.resolve(options.output)}`);
        console.log(`📊 Migrated ${suites.length} suites with ${suites.reduce((sum, { suite }) => sum + suite.getTests().length, 0)} tests`);
        console.log(`\n⚠️  Remember to review TODO comments and test the migration!`);
    }
    catch (error) {
        console.error(`❌ Migration failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
/**
 * CLI command definition
 */
function createMigrateCommand() {
    const command = new commander_1.Command("migrate")
        .description("Migrate legacy configuration to new DSL format")
        .command("config")
        .description("Migrate evalgate.config.json to defineEval() specifications")
        .requiredOption("-i, --in <path>", "Input config file path")
        .requiredOption("-o, --out <path>", "Output DSL file path")
        .option("-v, --verbose", "Include detailed comments and logging", false)
        .option("--no-helpers", "Don't generate helper functions")
        .option("--no-preserve-ids", "Don't preserve original test IDs")
        .option("--no-provenance", "Don't include provenance metadata")
        .action(async (options) => {
        const migrateOptions = {
            input: options.in,
            output: options.out,
            verbose: options.verbose,
            helpers: options.helpers !== false,
            preserveIds: options.preserveIds !== false,
            provenance: options.provenance !== false,
        };
        await migrateConfig(migrateOptions);
    });
    return command;
}
/**
 * Validate config file structure
 */
async function validateConfigFile(filePath) {
    try {
        const config = await readConfigFile(filePath);
        // Basic validation
        if (!config || typeof config !== "object") {
            throw new Error("Config file must contain a valid JSON object");
        }
        // Check for test data
        const hasTests = config.tests || config.suites || config.testSuites;
        if (!hasTests) {
            throw new Error("Config file must contain 'tests', 'suites', or 'testSuites' property");
        }
        console.log(`✅ Config file ${filePath} appears valid for migration`);
        return true;
    }
    catch (error) {
        console.error(`❌ Config validation failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}
/**
 * Show migration preview without writing files
 */
async function previewMigration(filePath) {
    try {
        const config = await readConfigFile(filePath);
        const suites = extractTestSuitesFromConfig(config);
        console.log(`📋 Migration preview for: ${filePath}`);
        console.log(``);
        console.log(`Found ${suites.length} test suites:`);
        console.log(``);
        for (const { name, suite } of suites) {
            const tests = suite.getTests();
            console.log(`  📁 ${name}: ${tests.length} tests`);
            if (tests.length > 0) {
                console.log(`     Tests: ${tests
                    .slice(0, 3)
                    .map((t) => t.id)
                    .join(", ")}${tests.length > 3 ? "..." : ""}`);
            }
        }
        console.log(``);
        console.log(`Total tests to migrate: ${suites.reduce((sum, { suite }) => sum + suite.getTests().length, 0)}`);
        console.log(``);
        console.log(`To migrate, run: evalgate migrate config --in ${filePath} --out eval/migrated.spec.ts`);
    }
    catch (error) {
        console.error(`❌ Preview failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
