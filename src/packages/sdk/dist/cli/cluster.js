"use strict";
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
exports.parseClusterArgs = parseClusterArgs;
exports.clusterRunResult = clusterRunResult;
exports.formatClusterHuman = formatClusterHuman;
exports.runCluster = runCluster;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const run_1 = require("./run");
const RUN_SEARCH_PATHS = [
    "evals/latest-run.json",
    "evals/runs/latest.json",
    ".evalgate/latest-run.json",
    ".evalgate/runs/latest.json",
];
const STOP_WORDS = new Set([
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
    "what",
    "when",
    "where",
    "while",
    "were",
    "them",
    "then",
    "than",
    "also",
    "been",
    "because",
    "expected",
    "actual",
    "input",
    "output",
    "error",
    "failed",
    "passed",
    "skipped",
    "result",
    "spec",
    "case",
    "file",
]);
function parseClusterArgs(args) {
    const result = {
        runPath: null,
        outputPath: null,
        format: "human",
        clusters: null,
        includePassed: false,
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--run" && args[i + 1]) {
            result.runPath = args[++i];
        }
        else if (arg === "--output" && args[i + 1]) {
            result.outputPath = args[++i];
        }
        else if (arg === "--format" && args[i + 1]) {
            const format = args[++i];
            if (format === "human" || format === "json") {
                result.format = format;
            }
        }
        else if ((arg === "--clusters" || arg === "--k") && args[i + 1]) {
            const parsed = Number.parseInt(args[++i], 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                result.clusters = parsed;
            }
        }
        else if (arg === "--include-passed") {
            result.includePassed = true;
        }
    }
    return result;
}
function findRunResult(cwd, explicitPath) {
    if (explicitPath) {
        const absolutePath = path.isAbsolute(explicitPath)
            ? explicitPath
            : path.join(cwd, explicitPath);
        return fs.existsSync(absolutePath) ? absolutePath : null;
    }
    for (const relativePath of RUN_SEARCH_PATHS) {
        const absolutePath = path.join(cwd, relativePath);
        if (fs.existsSync(absolutePath)) {
            return absolutePath;
        }
    }
    return null;
}
function tokenize(text) {
    return text
        .toLowerCase()
        .split(/\W+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}
function tokenSet(text) {
    return new Set(tokenize(text));
}
function jaccard(a, b) {
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
function centroidKeywords(texts, topN = 4) {
    const frequencies = new Map();
    for (const text of texts) {
        for (const token of tokenize(text)) {
            frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
        }
    }
    return [...frequencies.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, topN)
        .map(([token]) => token);
}
function clusterDensity(members) {
    if (members.length < 2) {
        return 1;
    }
    let totalSimilarity = 0;
    let count = 0;
    for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            totalSimilarity += jaccard(members[i].tokens, members[j].tokens);
            count++;
        }
    }
    return count > 0 ? totalSimilarity / count : 1;
}
function buildTraceText(spec) {
    return [
        spec.name,
        spec.filePath,
        spec.result.error ?? "",
        spec.input ?? "",
        spec.expected ?? "",
        spec.actual ?? "",
    ]
        .filter((value) => value.trim().length > 0)
        .join("\n");
}
function buildAssignments(points, k) {
    if (points.length === 0) {
        return new Map();
    }
    const clusterCount = Math.min(k, points.length);
    const step = Math.max(1, Math.floor(points.length / clusterCount));
    const centroids = points
        .filter((_, index) => index % step === 0)
        .slice(0, clusterCount)
        .map((point) => point.tokens);
    const assignments = new Map();
    for (let i = 0; i < clusterCount; i++) {
        assignments.set(i, []);
    }
    for (const point of points) {
        let bestCluster = 0;
        let bestSimilarity = -1;
        for (let index = 0; index < centroids.length; index++) {
            const similarity = jaccard(point.tokens, centroids[index]);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestCluster = index;
            }
        }
        assignments.get(bestCluster).push(point.caseId);
    }
    return assignments;
}
function clusterRunResult(runResult, options = {}) {
    const includePassed = options.includePassed === true;
    const candidates = runResult.results
        .filter((spec) => includePassed || spec.result.status === "failed")
        .map((spec) => ({
        caseId: spec.specId,
        name: spec.name,
        status: spec.result.status,
        text: buildTraceText(spec),
        tokens: tokenSet(buildTraceText(spec)),
    }));
    if (candidates.length === 0) {
        return {
            runId: runResult.runId,
            totalRunResults: runResult.results.length,
            clusteredCases: 0,
            skippedCases: runResult.results.length,
            requestedClusters: options.clusters ?? null,
            includePassed,
            clusters: [],
        };
    }
    const clusterCount = options.clusters ??
        Math.min(8, Math.max(1, Math.round(Math.sqrt(candidates.length))));
    const assignments = buildAssignments(candidates, clusterCount);
    const candidateById = new Map(candidates.map((candidate) => [candidate.caseId, candidate]));
    const clusters = [];
    for (const [index, memberIds] of assignments) {
        if (memberIds.length === 0) {
            continue;
        }
        const members = memberIds
            .map((memberId) => candidateById.get(memberId))
            .filter((member) => member !== undefined);
        const keywords = centroidKeywords(members.map((member) => member.text));
        const statusCounts = {
            passed: 0,
            failed: 0,
            skipped: 0,
        };
        for (const member of members) {
            statusCounts[member.status]++;
        }
        clusters.push({
            id: `cluster-${index}`,
            label: keywords.length > 0
                ? keywords.slice(0, 3).join(", ")
                : `Cluster ${index + 1}`,
            keywords,
            memberIds,
            memberCount: members.length,
            density: clusterDensity(members),
            statusCounts,
            samples: members.slice(0, 3).map((member) => ({
                caseId: member.caseId,
                name: member.name,
            })),
        });
    }
    clusters.sort((a, b) => b.memberCount - a.memberCount ||
        b.density - a.density ||
        a.id.localeCompare(b.id));
    return {
        runId: runResult.runId,
        totalRunResults: runResult.results.length,
        clusteredCases: candidates.length,
        skippedCases: runResult.results.length - candidates.length,
        requestedClusters: options.clusters ?? null,
        includePassed,
        clusters,
    };
}
function formatClusterHuman(summary) {
    const lines = [
        "Cluster phase",
        `Run: ${summary.runId}`,
        `Clustered ${summary.clusteredCases} case(s) into ${summary.clusters.length} cluster(s)`,
    ];
    if (summary.skippedCases > 0) {
        lines.push(`Skipped ${summary.skippedCases} case(s) (${summary.includePassed ? "none filtered" : "use --include-passed to include non-failures"})`);
    }
    if (summary.clusters.length === 0) {
        lines.push("No cases available for clustering");
        return lines.join("\n");
    }
    for (const [index, cluster] of summary.clusters.entries()) {
        lines.push("");
        lines.push(`${index + 1}. ${cluster.id} — ${cluster.label} (${cluster.memberCount} case(s), ${(cluster.density * 100).toFixed(1)}% density)`);
        lines.push(`   status: ${cluster.statusCounts.failed} failed, ${cluster.statusCounts.passed} passed, ${cluster.statusCounts.skipped} skipped`);
        if (cluster.samples.length > 0) {
            lines.push(`   samples: ${cluster.samples.map((sample) => `${sample.caseId} (${sample.name})`).join(", ")}`);
        }
    }
    return lines.join("\n");
}
function writeClusterReport(summary, outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf-8");
}
async function runCluster(args) {
    const parsed = parseClusterArgs(args);
    const cwd = process.cwd();
    const runPath = findRunResult(cwd, parsed.runPath);
    if (!runPath) {
        console.error("  ✖ Run result not found.");
        console.error("    Run evalgate run first, or specify --run <path>");
        return 1;
    }
    let runResult = null;
    try {
        runResult = JSON.parse(fs.readFileSync(runPath, "utf-8"));
    }
    catch {
        console.error("  ✖ Failed to read/parse run result");
        return 1;
    }
    if (!runResult || runResult.schemaVersion !== run_1.RUN_RESULT_SCHEMA_VERSION) {
        console.error(`  ✖ Unsupported run result schema version: ${runResult?.schemaVersion ?? "missing"}`);
        return 1;
    }
    const summary = clusterRunResult(runResult, {
        clusters: parsed.clusters,
        includePassed: parsed.includePassed,
    });
    if (parsed.outputPath) {
        const outputPath = path.isAbsolute(parsed.outputPath)
            ? parsed.outputPath
            : path.join(cwd, parsed.outputPath);
        const outputDirectory = path.dirname(outputPath);
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
        }
        try {
            writeClusterReport(summary, outputPath);
        }
        catch (error) {
            console.error("  ✖ Failed to write output:", error);
            return 2;
        }
    }
    if (parsed.format === "json") {
        console.log(JSON.stringify(summary, null, 2));
    }
    else {
        console.log(formatClusterHuman(summary));
        if (parsed.outputPath) {
            console.log(`\nSaved → ${path.relative(cwd, parsed.outputPath)}`);
        }
    }
    return 0;
}
