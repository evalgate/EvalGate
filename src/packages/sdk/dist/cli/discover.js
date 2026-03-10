"use strict";
/**
 * TICKET 1 — evalgate discover
 *
 * Your first "holy shit" moment feature
 *
 * Goal:
 * npm install
 * evalgate discover
 *
 * Output:
 * Found 42 behavioral specifications
 * Safety: 12
 * Accuracy: 18
 * Agents: 7
 * Tools: 5
 *
 * Why this matters:
 * - makes EvalGate feel alive
 * - proves DSL works
 * - enables intelligence layer
 *
 * This becomes your entry point command.
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
exports.discoverSpecs = discoverSpecs;
exports.calculateDiversityStats = calculateDiversityStats;
exports.printDiscoveryResults = printDiscoveryResults;
exports.runDiscover = runDiscover;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const execution_mode_1 = require("../runtime/execution-mode");
const manifest_1 = require("./manifest");
/**
 * Diversity threshold constant
 */
const DIVERSITY_THRESHOLD = 0.55;
/**
 * Diversity stop words set
 */
const DIVERSITY_STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "your",
    "have",
    "should",
    "would",
    "could",
    "about",
    "uses",
    "using",
    "spec",
    "eval",
    "test",
    "case",
    "name",
    "file",
    "description",
]);
/**
 * Discover and analyze behavioral specifications in the current project
 */
async function discoverSpecs(options = {}) {
    try {
        const projectRoot = process.cwd();
        const executionMode = await (0, execution_mode_1.getExecutionMode)(projectRoot);
        // Get project metadata
        const project = await getProjectMetadata(projectRoot);
        if (executionMode.specFiles.length === 0) {
            console.log("\n✨ No behavioral specifications found.");
            console.log("💡 Create files with defineEval() calls to get started.");
            return {
                totalSpecs: 0,
                categories: {},
                diversity: {
                    score: 0,
                    averageNearestNeighborSimilarity: 0,
                    redundantPairs: [],
                    threshold: DIVERSITY_THRESHOLD,
                },
                files: {},
                executionMode: {
                    mode: executionMode.mode,
                    hasSpecRuntime: executionMode.hasSpecRuntime,
                    hasLegacyRuntime: executionMode.hasLegacyRuntime,
                    specFiles: executionMode.specFiles,
                    legacyConfig: executionMode.legacyConfig,
                },
                project,
            };
        }
        // Analyze specifications
        const specs = await analyzeSpecifications(executionMode.specFiles);
        // Generate manifest if requested
        if (options.manifest) {
            console.log("🔧 Generating evaluation manifest...");
            const manifest = await (0, manifest_1.generateManifest)(specs, projectRoot, project.name, executionMode);
            await (0, manifest_1.writeManifest)(manifest, projectRoot);
            console.log(`✅ Manifest written to .evalgate/manifest.json`);
            console.log(`✅ Lock file written to .evalgate/manifest.lock.json`);
        }
        // Calculate statistics
        const stats = calculateStats(specs, executionMode, project);
        printDiscoveryResults(stats);
        return stats;
    }
    catch (error) {
        console.error("❌ Discovery failed:", error instanceof Error ? error.message : String(error));
        throw error;
    }
}
/**
 * Get project metadata
 */
async function getProjectMetadata(projectRoot) {
    const packageJsonPath = path.join(projectRoot, "package.json");
    const gitPath = path.join(projectRoot, ".git");
    let hasPackageJson = false;
    let projectName = "unknown";
    try {
        const packageJson = await fs.readFile(packageJsonPath, "utf-8");
        const parsed = JSON.parse(packageJson);
        hasPackageJson = true;
        projectName = parsed.name || "unknown";
    }
    catch (_error) {
        // No package.json
    }
    const hasGit = await fs
        .access(gitPath)
        .then(() => true)
        .catch(() => false);
    return {
        root: projectRoot,
        name: projectName,
        hasPackageJson,
        hasGit,
    };
}
/**
 * Analyze specification files
 */
async function analyzeSpecifications(specFiles) {
    const specs = [];
    for (const filePath of specFiles) {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const fileSpecs = analyzeSpecFile(filePath, content);
            specs.push(...fileSpecs);
        }
        catch (error) {
            console.warn(`Warning: Could not analyze ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return specs;
}
/**
 * Extract all spec names from file content (handles both call forms)
 */
function extractSpecNames(content) {
    const names = [];
    // Form 1: defineEval("name", ...) or defineEval('name', ...) or defineEval(`name`, ...)
    const stringArgPattern = /defineEval\s*\(\s*["'`]([^"'`]+)["'`]/g;
    let m = stringArgPattern.exec(content);
    while (m !== null) {
        names.push(m[1]);
        m = stringArgPattern.exec(content);
    }
    if (names.length > 0)
        return names;
    // Form 2: defineEval({ name: "..." }) — object-first form
    const objNamePattern = /defineEval\s*\(\s*\{[\s\S]*?name\s*:\s*["'`]([^"'`]+)["'`]/g;
    m = objNamePattern.exec(content);
    while (m !== null) {
        names.push(m[1]);
        m = objNamePattern.exec(content);
    }
    return names;
}
/**
 * Analyze a single specification file — returns one SpecAnalysis per defineEval call
 */
function analyzeSpecFile(filePath, content) {
    const specNames = extractSpecNames(content);
    // Fallback: file matched as a spec file but we couldn't parse names
    if (specNames.length === 0) {
        specNames.push(path.basename(filePath, path.extname(filePath)));
    }
    // Shared analysis for the file
    const tags = extractTags(content);
    const complexity = analyzeComplexity(content);
    const usesModels = content.includes("model:") ||
        content.includes("model=") ||
        content.includes("openai") ||
        content.includes("anthropic");
    const usesTools = content.includes("tool:") ||
        content.includes("function.") ||
        content.includes("call(");
    const hasAssertions = content.includes("assert") ||
        content.includes("expect") ||
        content.includes("should");
    const relFile = path.relative(process.cwd(), filePath);
    return specNames.map((name, idx) => ({
        id: generateSpecId(filePath, name, idx),
        name,
        file: relFile,
        tags,
        hasAssertions,
        usesModels,
        usesTools,
        complexity,
        fingerprintText: buildSpecFingerprintText(name, tags, content, complexity, usesModels, usesTools, hasAssertions),
    }));
}
/**
 * Extract tags from specification content
 */
function extractTags(content) {
    const tags = [];
    // Extract tags parameter
    const tagsMatch = content.match(/tags\s*:\s*\[([^\]]+)\]/);
    if (tagsMatch) {
        const tagContent = tagsMatch[1];
        const tagStrings = tagContent.match(/["'`](.+?)["'`](?:\s*,|\s*)/g) || [];
        tags.push(...tagStrings.map((tag) => tag.replace(/["'`](.+?)["'`](?:\s*,|\s*)/, "$1")));
    }
    // Extract from description and metadata
    const descriptionMatch = content.match(/description\s*:\s*["'`](.+?)["'`](?:\s*,|\s*)/);
    if (descriptionMatch) {
        const description = descriptionMatch[1].toLowerCase();
        // Auto-categorize based on description
        if (description.includes("safety") || description.includes("security"))
            tags.push("safety");
        if (description.includes("accuracy") || description.includes("precision"))
            tags.push("accuracy");
        if (description.includes("agent") || description.includes("autonomous"))
            tags.push("agents");
        if (description.includes("tool") || description.includes("function"))
            tags.push("tools");
        if (description.includes("latency") || description.includes("speed"))
            tags.push("performance");
        if (description.includes("hallucination") || description.includes("fact"))
            tags.push("factual");
        if (description.includes("bias") || description.includes("fairness"))
            tags.push("bias");
        if (description.includes("privacy") || description.includes("pii"))
            tags.push("privacy");
    }
    return [...new Set(tags)]; // Remove duplicates
}
/**
 * Analyze specification complexity
 */
function analyzeComplexity(content) {
    const lines = content.split("\n").length;
    const hasAsync = content.includes("async") || content.includes("await");
    const hasLoops = content.includes("for") || content.includes("while");
    const hasConditionals = content.includes("if") || content.includes("switch");
    const hasTryCatch = content.includes("try") || content.includes("catch");
    const hasExternalCalls = content.includes("fetch") ||
        content.includes("http") ||
        content.includes("api");
    let complexityScore = 0;
    if (lines > 50)
        complexityScore += 2;
    if (lines > 100)
        complexityScore += 3;
    if (hasAsync)
        complexityScore += 2;
    if (hasLoops)
        complexityScore += 1;
    if (hasConditionals)
        complexityScore += 1;
    if (hasTryCatch)
        complexityScore += 1;
    if (hasExternalCalls)
        complexityScore += 2;
    if (complexityScore <= 2)
        return "simple";
    if (complexityScore <= 5)
        return "medium";
    return "complex";
}
function buildSpecFingerprintText(name, tags, content, complexity, usesModels, usesTools, hasAssertions) {
    const descriptionMatch = content.match(/description\s*:\s*["'`](.+?)["'`](?:\s*,|\s*)/);
    const dependencyHints = Array.from(content.matchAll(/["'`]([^"'`]+\.(?:md|json|yaml|yml|csv|txt|ts|tsx|js|jsx))["'`]/g))
        .slice(0, 6)
        .map((match) => {
        const value = match[1];
        return value.split(/[\\/]/).pop() ?? value;
    })
        .join(" ");
    return [
        name,
        tags.join(" "),
        descriptionMatch?.[1] ?? "",
        dependencyHints,
        complexity,
        usesModels ? "model" : "",
        usesTools ? "tool" : "",
        hasAssertions ? "assertion" : "",
    ]
        .filter((value) => value.length > 0)
        .join(" ");
}
function tokenizeDiversityText(text) {
    return text
        .toLowerCase()
        .split(/\W+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !DIVERSITY_STOP_WORDS.has(token));
}
function diversityTokenSet(text) {
    return new Set(tokenizeDiversityText(text));
}
function diversityJaccard(a, b) {
    if (a.size === 0 && b.size === 0) {
        return 1;
    }
    if (a.size === 0 || b.size === 0) {
        return 0;
    }
    let intersection = 0;
    for (const token of a) {
        if (b.has(token)) {
            intersection++;
        }
    }
    return intersection / (a.size + b.size - intersection);
}
function calculateDiversityStats(specs, threshold = DIVERSITY_THRESHOLD) {
    if (specs.length === 0) {
        return {
            score: 0,
            averageNearestNeighborSimilarity: 0,
            redundantPairs: [],
            threshold,
        };
    }
    if (specs.length === 1) {
        return {
            score: 100,
            averageNearestNeighborSimilarity: 0,
            redundantPairs: [],
            threshold,
        };
    }
    const fingerprints = specs.map((spec) => diversityTokenSet(spec.fingerprintText ??
        [
            spec.name,
            spec.tags.join(" "),
            spec.complexity,
            spec.usesModels ? "model" : "",
            spec.usesTools ? "tool" : "",
            spec.hasAssertions ? "assertion" : "",
        ]
            .filter((value) => value.length > 0)
            .join(" ")));
    const redundantPairs = [];
    const nearestSimilarities = new Array(specs.length).fill(0);
    for (let i = 0; i < specs.length; i++) {
        for (let j = i + 1; j < specs.length; j++) {
            const similarity = diversityJaccard(fingerprints[i], fingerprints[j]);
            nearestSimilarities[i] = Math.max(nearestSimilarities[i], similarity);
            nearestSimilarities[j] = Math.max(nearestSimilarities[j], similarity);
            if (similarity >= threshold) {
                redundantPairs.push({
                    leftSpecId: specs[i].id,
                    leftName: specs[i].name,
                    rightSpecId: specs[j].id,
                    rightName: specs[j].name,
                    similarity,
                });
            }
        }
    }
    const averageNearestNeighborSimilarity = nearestSimilarities.reduce((total, value) => total + value, 0) /
        specs.length;
    return {
        score: Math.max(0, Math.round((1 - averageNearestNeighborSimilarity) * 100)),
        averageNearestNeighborSimilarity,
        redundantPairs: redundantPairs
            .sort((a, b) => b.similarity - a.similarity ||
            a.leftSpecId.localeCompare(b.leftSpecId) ||
            a.rightSpecId.localeCompare(b.rightSpecId))
            .slice(0, 5),
        threshold,
    };
}
/**
 * Generate specification ID from file path + name + index (unique per defineEval call)
 */
function generateSpecId(filePath, name, index) {
    const relativePath = path
        .relative(process.cwd(), filePath)
        .replace(/\\/g, "/");
    const key = `${relativePath}|${name}|${index}`;
    return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}
/**
 * Calculate discovery statistics
 */
function calculateStats(specs, executionMode, project) {
    const categories = {};
    const diversity = calculateDiversityStats(specs);
    const files = {};
    // Count by categories
    for (const spec of specs) {
        for (const tag of spec.tags) {
            categories[tag] = (categories[tag] || 0) + 1;
        }
        // Count by files
        files[spec.file] = (files[spec.file] || 0) + 1;
    }
    // Add default categories if none found
    if (Object.keys(categories).length === 0) {
        categories.general = specs.length;
    }
    return {
        totalSpecs: specs.length,
        categories,
        diversity,
        files,
        executionMode: {
            mode: executionMode.mode,
            hasSpecRuntime: executionMode.hasSpecRuntime,
            hasLegacyRuntime: executionMode.hasLegacyRuntime,
            specFiles: executionMode.specFiles,
            legacyConfig: executionMode.legacyConfig,
        },
        project,
    };
}
/**
 * Print discovery results in a beautiful format
 */
function printDiscoveryResults(stats) {
    console.log(`🔍 EvalGate Discovery Results`);
    console.log(``);
    console.log(`📊 Found ${stats.totalSpecs} behavioral specifications`);
    console.log(``);
    // Print categories
    if (Object.keys(stats.categories).length > 0) {
        console.log(`📋 Categories:`);
        const sortedCategories = Object.entries(stats.categories)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10); // Top 10 categories
        for (const [category, count] of sortedCategories) {
            const icon = getCategoryIcon(category);
            console.log(`   ${icon} ${category}: ${count}`);
        }
        console.log(``);
    }
    if (stats.totalSpecs > 1) {
        console.log(`🧬 Diversity: ${stats.diversity.score}/100`);
        console.log(`   Average nearest-neighbor similarity: ${(stats.diversity.averageNearestNeighborSimilarity * 100).toFixed(1)}%`);
        if (stats.diversity.redundantPairs.length > 0) {
            console.log(`   Potentially redundant pairs:`);
            for (const pair of stats.diversity.redundantPairs) {
                console.log(`   • ${pair.leftName} ↔ ${pair.rightName} (${(pair.similarity * 100).toFixed(1)}%)`);
            }
        }
        else {
            console.log(`   No high-similarity spec pairs detected`);
        }
        console.log(``);
    }
    // Print execution mode
    console.log(`⚙️  Execution Mode: ${stats.executionMode.mode.toUpperCase()}`);
    if (stats.executionMode.hasSpecRuntime) {
        console.log(`   ✅ Spec runtime: ${stats.executionMode.specFiles.length} files`);
    }
    if (stats.executionMode.hasLegacyRuntime) {
        console.log(`   ✅ Legacy runtime: ${stats.executionMode.legacyConfig ? path.basename(stats.executionMode.legacyConfig) : "config"}`);
    }
    console.log(``);
    // Print project info
    console.log(`📁 Project: ${stats.project.name}`);
    console.log(`   📍 Root: ${stats.project.root}`);
    console.log(`   📦 Package.json: ${stats.project.hasPackageJson ? "✅" : "❌"}`);
    console.log(`   🔄 Git: ${stats.project.hasGit ? "✅" : "❌"}`);
    console.log(``);
    // Print recommendations
    printRecommendations(stats);
}
/**
 * Get icon for category
 */
function getCategoryIcon(category) {
    const icons = {
        safety: "🛡️",
        security: "🔒",
        accuracy: "🎯",
        precision: "🎯",
        agents: "🤖",
        autonomous: "🤖",
        tools: "🔧",
        functions: "🔧",
        performance: "⚡",
        latency: "⚡",
        speed: "⚡",
        factual: "📊",
        hallucination: "📊",
        bias: "⚖️",
        fairness: "⚖️",
        privacy: "🔐",
        pii: "🔐",
        general: "📝",
    };
    return icons[category.toLowerCase()] || "📝";
}
/**
 * Print recommendations based on discovery results
 */
function printRecommendations(stats) {
    console.log(`💡 Recommendations:`);
    if (stats.totalSpecs === 0) {
        console.log(`   🚀 No specifications found. Create your first eval with:
   echo 'import { defineEval } from "@evalgate/sdk";
   defineEval("hello-world", async (context) => {
     return { pass: true, score: 100 };
   });' > eval/hello.spec.ts`);
    }
    else if (stats.totalSpecs < 5) {
        console.log(`   📈 Add more specifications to improve coverage`);
    }
    else if (stats.totalSpecs < 20) {
        console.log(`   🎯 Good start! Consider organizing by categories`);
    }
    else {
        console.log(`   🏆 Excellent coverage! Consider running evalgate run`);
    }
    if (stats.diversity.redundantPairs.length > 0) {
        console.log(`   🧹 Some specs look redundant. Consider pruning or merging the highest-similarity pairs`);
    }
    if (!stats.executionMode.hasSpecRuntime &&
        !stats.executionMode.hasLegacyRuntime) {
        console.log(`   🆕 New project? Try 'evalgate init' to get started`);
    }
    if (stats.executionMode.hasLegacyRuntime &&
        !stats.executionMode.hasSpecRuntime) {
        console.log(`   🔄 Legacy project detected. Try 'evalgate migrate config' to upgrade`);
    }
    if (stats.executionMode.hasSpecRuntime) {
        console.log(`   🚀 Ready to run! Use 'evalgate run' to execute specifications`);
    }
    console.log(``);
}
/**
 * Run discovery command
 */
async function runDiscover() {
    try {
        const stats = await discoverSpecs();
        printDiscoveryResults(stats);
        process.exit(0);
    }
    catch (error) {
        console.error(`❌ Discovery failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
