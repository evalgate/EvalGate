"use strict";
/**
 * TICKET 3 — Impact Analysis CLI Command (v0)
 *
 * Goal: Modal-like perceived speed via incremental intelligence
 *
 * Algorithm v0 (practical, shippable):
 * - Inputs: manifest.json + git diff --name-only base...HEAD
 * - Rules: Direct file mapping, dependency tracking, safe fallback
 * - Output: Human-readable counts + JSON for automation
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
exports.runImpactAnalysis = runImpactAnalysis;
exports.analyzeImpact = analyzeImpact;
exports.printHumanResults = printHumanResults;
exports.printJsonResults = printJsonResults;
exports.runImpactAnalysisCLI = runImpactAnalysisCLI;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
/**
 * Run impact analysis
 */
async function runImpactAnalysis(options, projectRoot = process.cwd()) {
    const startTime = Date.now();
    // Read manifest
    const manifest = await readManifest(projectRoot);
    if (!manifest) {
        throw new Error("No evaluation manifest found. Run 'evalai discover --manifest' first.");
    }
    // Get changed files
    const changedFiles = options.changedFiles || (await getChangedFiles(options.baseBranch));
    // Analyze impact
    const { impactedSpecIds, reasonBySpecId } = analyzeImpact(changedFiles, manifest);
    const result = {
        impactedSpecIds,
        reasonBySpecId,
        changedFiles,
        metadata: {
            baseBranch: options.baseBranch,
            totalSpecs: manifest.specs.length,
            impactedCount: impactedSpecIds.length,
            analysisTime: Date.now() - startTime,
        },
    };
    return result;
}
/**
 * Read evaluation manifest
 */
async function readManifest(projectRoot = process.cwd()) {
    const manifestPath = path.join(projectRoot, ".evalai", "manifest.json");
    try {
        const content = await fs.readFile(manifestPath, "utf-8");
        return JSON.parse(content);
    }
    catch (_error) {
        return null;
    }
}
/**
 * Get changed files from git
 */
async function getChangedFiles(baseBranch) {
    return new Promise((resolve, reject) => {
        const git = (0, node_child_process_1.spawn)("git", ["diff", "--name-only", `${baseBranch}...HEAD`], {
            stdio: ["pipe", "pipe", "pipe"],
        });
        let output = "";
        let error = "";
        git.stdout?.on("data", (data) => {
            output += data.toString();
        });
        git.stderr?.on("data", (data) => {
            error += data.toString();
        });
        git.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`Git diff failed: ${error}`));
                return;
            }
            const files = output
                .split("\n")
                .map((f) => f.trim())
                .filter((f) => f.length > 0)
                .map((f) => f.replace(/\\/g, "/")); // Normalize to POSIX
            resolve(files);
        });
    });
}
/**
 * Analyze impact of changed files
 */
function analyzeImpact(changedFiles, manifest) {
    const impactedSpecIds = new Set();
    const reasonBySpecId = {};
    // Normalize changed files to POSIX format
    const normalizedChangedFiles = changedFiles.map((f) => f.replace(/\\/g, "/"));
    // Create lookup maps
    const specsByFile = new Map();
    const specsByDependency = new Map();
    // Index specs by file
    for (const spec of manifest.specs) {
        // By file path
        if (!specsByFile.has(spec.filePath)) {
            specsByFile.set(spec.filePath, []);
        }
        specsByFile.get(spec.filePath)?.push(spec);
        // By dependencies
        const deps = [
            ...spec.dependsOn.prompts,
            ...spec.dependsOn.datasets,
            ...spec.dependsOn.tools,
            ...spec.dependsOn.code,
        ];
        for (const dep of deps) {
            if (!specsByDependency.has(dep)) {
                specsByDependency.set(dep, []);
            }
            specsByDependency.get(dep)?.push(spec);
        }
    }
    // Analyze each changed file
    for (const changedFile of normalizedChangedFiles) {
        // Rule 1: Direct spec file change
        const specsInFile = specsByFile.get(changedFile);
        if (specsInFile) {
            for (const spec of specsInFile) {
                impactedSpecIds.add(spec.id);
                reasonBySpecId[spec.id] = `Spec file changed: ${changedFile}`;
            }
        }
        // Rule 2: Dependency change
        const specsUsingDep = specsByDependency.get(changedFile);
        if (specsUsingDep) {
            for (const spec of specsUsingDep) {
                impactedSpecIds.add(spec.id);
                reasonBySpecId[spec.id] = `Dependency changed: ${changedFile}`;
            }
        }
        // Rule 3: Safe fallback for unknown files
        if (!specsInFile && !specsUsingDep) {
            // If we can't map the file, be conservative and run everything
            console.warn(`⚠️  Unknown changed file: ${changedFile}`);
            console.warn(`🛡️  Running full suite for safety`);
            // Add all specs
            for (const spec of manifest.specs) {
                impactedSpecIds.add(spec.id);
                reasonBySpecId[spec.id] =
                    `Unknown file changed: ${changedFile} (safe fallback)`;
            }
            break; // No need to continue analyzing
        }
    }
    return {
        impactedSpecIds: Array.from(impactedSpecIds).sort(),
        reasonBySpecId,
    };
}
/**
 * Print human-readable results
 */
function printHumanResults(result) {
    console.log("\n🔍 Impact Analysis Results");
    console.log(`📊 Base branch: ${result.metadata.baseBranch}`);
    console.log(`📁 Changed files: ${result.changedFiles.length}`);
    console.log(`🎯 Impacted specs: ${result.metadata.impactedCount}/${result.metadata.totalSpecs}`);
    console.log(`⏱️  Analysis time: ${result.metadata.analysisTime}ms`);
    if (result.changedFiles.length > 0) {
        console.log("\n📝 Changed files:");
        for (const file of result.changedFiles) {
            console.log(`   • ${file}`);
        }
    }
    if (result.impactedSpecIds.length > 0) {
        console.log("\n🎯 Impacted specifications:");
        for (const specId of result.impactedSpecIds) {
            const reason = result.reasonBySpecId[specId];
            console.log(`   • ${specId} (${reason})`);
        }
        console.log("\n💡 Suggested command:");
        console.log(`   evalai run --spec-ids ${result.impactedSpecIds.join(",")}`);
    }
    else {
        console.log("\n✅ No specifications impacted");
        console.log("💡 No tests needed to run");
    }
}
/**
 * Print JSON results
 */
function printJsonResults(result) {
    console.log(JSON.stringify(result, null, 2));
}
/**
 * CLI entry point
 */
async function runImpactAnalysisCLI(options) {
    try {
        const result = await runImpactAnalysis(options);
        if (options.format === "json") {
            printJsonResults(result);
        }
        else {
            printHumanResults(result);
        }
        // Exit with appropriate code
        if (result.metadata.impactedCount === 0) {
            process.exit(0);
        }
        else {
            process.exit(1); // Signal that tests should run
        }
    }
    catch (error) {
        console.error("❌ Impact analysis failed:", error instanceof Error ? error.message : String(error));
        process.exit(2);
    }
}
