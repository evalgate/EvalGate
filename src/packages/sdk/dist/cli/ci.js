"use strict";
/**
 * UX-401: One-command CI loop (evalgate ci)
 *
 * Provides a single command teams put in .github/workflows/* and never think about again.
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
exports.runCI = runCI;
exports.runCICLI = runCICLI;
const fs = __importStar(require("node:fs/promises"));
const diff_1 = require("./diff");
const discover_1 = require("./discover");
const impact_analysis_1 = require("./impact-analysis");
const run_1 = require("./run");
const workspace_1 = require("./workspace");
/**
 * Run CI command
 */
async function runCI(options, projectRoot = process.cwd()) {
    const workspace = (0, workspace_1.resolveEvalWorkspace)(projectRoot);
    const narrative = [];
    try {
        // 1. Ensure .evalgate workspace exists
        await fs.mkdir(workspace.evalDir, { recursive: true });
        narrative.push("✅ workspace ok");
        // 2. Ensure manifest exists (build if missing)
        let manifestExists = true;
        try {
            await fs.access(workspace.manifestPath);
        }
        catch {
            manifestExists = false;
        }
        if (!manifestExists) {
            console.log("📋 Building evaluation manifest...");
            await (0, discover_1.discoverSpecs)({ manifest: true });
            narrative.push("→ manifest built");
        }
        else {
            narrative.push("→ manifest ok");
        }
        // 3. Run impact analysis if --impacted-only
        let impactedSpecCount;
        if (options.impactedOnly) {
            const impactResult = await (0, impact_analysis_1.runImpactAnalysis)({
                baseBranch: options.base || "main",
            }, projectRoot);
            impactedSpecCount = impactResult.metadata.impactedCount;
            narrative.push(`→ impacted specs ${impactedSpecCount}`);
        }
        else {
            narrative.push("→ running all specs");
        }
        // 4. Run evaluations
        const runResult = await (0, run_1.runEvaluations)({
            impactedOnly: options.impactedOnly,
            baseBranch: options.base,
            writeResults: options.writeResults ?? true, // Always write results for CI
        }, projectRoot);
        narrative.push(`→ runId ${runResult.runId}`);
        // 5. Run diff if --base provided
        let diffResult;
        if (options.base) {
            diffResult = await (0, diff_1.runDiff)({
                base: options.base,
                head: "last",
            });
            if (diffResult.summary.regressions > 0) {
                narrative.push(`→ diff ${diffResult.summary.regressions} regressions`);
                return {
                    success: false,
                    exitCode: 1,
                    narrative: narrative.join(" "),
                    runResult,
                    diffResult,
                };
            }
            else {
                narrative.push("→ diff clean");
            }
        }
        else {
            narrative.push("→ no diff");
        }
        // 6. Check for run failures
        if (runResult.summary.failed > 0) {
            return {
                success: false,
                exitCode: 1,
                narrative: narrative.join(" "),
                runResult,
                diffResult,
            };
        }
        return {
            success: true,
            exitCode: 0,
            narrative: narrative.join(" "),
            runResult,
            diffResult,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Print next step for debugging
        printNextStep(errorMessage, options, workspace);
        return {
            success: false,
            exitCode: 2, // Config/infra issue
            narrative: narrative.join(" "),
            error: errorMessage,
        };
    }
}
/**
 * Print copy/paste debug flow
 */
function printNextStep(error, options, workspace) {
    console.log("\n🔧 Next step for debugging:");
    if (error.includes("No evaluation manifest found")) {
        console.log("   evalgate discover --manifest");
    }
    else if (error.includes("Base run report not found in CI environment")) {
        console.log(`   Download base artifact and run: evalgate diff --base .evalgate/base-run.json --head ${workspace.lastRunPath}`);
    }
    else if (options.base && error.includes("Base run report not found")) {
        console.log(`   evalgate explain --report ${workspace.lastRunPath}`);
    }
    else {
        console.log(`   evalgate explain --report ${workspace.lastRunPath}`);
    }
    console.log(`   Artifacts: ${workspace.runsDir}/`);
}
/**
 * CLI entry point
 */
async function runCICLI(options) {
    const result = await runCI(options);
    // Print narrative
    console.log(`🤖 ${result.narrative}`);
    // Print detailed results if not clean
    if (!result.success && result.runResult) {
        console.log("\n📊 Run Results:");
        console.log(`   ✅ Passed: ${result.runResult.summary.passed}`);
        console.log(`   ❌ Failed: ${result.runResult.summary.failed}`);
        console.log(`   📊 Pass Rate: ${(result.runResult.summary.passRate * 100).toFixed(1)}%`);
    }
    if (!result.success && result.diffResult) {
        console.log("\n🔄 Diff Results:");
        console.log(`   📉 Regressions: ${result.diffResult.summary.regressions}`);
        console.log(`   📈 Improvements: ${result.diffResult.summary.improvements}`);
        console.log(`   📊 Pass Rate Delta: ${(result.diffResult.summary.passRateDelta * 100).toFixed(1)}%`);
    }
    if (result.error) {
        console.log(`\n❌ Error: ${result.error}`);
    }
    // Exit with appropriate code
    process.exit(result.exitCode);
}
