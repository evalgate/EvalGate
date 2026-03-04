"use strict";
/**
 * evalgate compare — Side-by-side result file comparison
 *
 * Compares two or more saved run result JSON files. Does NOT re-run anything.
 * You run each model/config separately (evalgate run --write-results),
 * then compare the saved artifacts. Shows wins/losses/ties per spec.
 *
 * Usage:
 *   evalgate compare --base .evalgate/runs/run-a.json --head .evalgate/runs/run-b.json
 *   evalgate compare --base gpt4o.json --head claude.json --labels "GPT-4o" "Claude 3.5"
 *   evalgate compare --runs run-a.json run-b.json run-c.json
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
exports.runCompare = runCompare;
exports.printHumanCompare = printHumanCompare;
exports.printJsonCompare = printJsonCompare;
exports.runCompareCLI = runCompareCLI;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
/**
 * Load a run result from file
 */
async function loadRunResult(filePath, projectRoot) {
    const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.join(projectRoot, filePath);
    const content = await fs.readFile(resolved, "utf-8");
    return JSON.parse(content);
}
/**
 * Run the comparison
 */
async function runCompare(options, projectRoot = process.cwd()) {
    if (options.runs.length < 2) {
        throw new Error("At least 2 run files are required for comparison.");
    }
    // Load all runs
    const runs = [];
    for (const runPath of options.runs) {
        runs.push(await loadRunResult(runPath, projectRoot));
    }
    // Generate labels
    const labels = options.labels?.length === runs.length
        ? options.labels
        : runs.map((r, i) => options.labels?.[i] ?? r.runId ?? `Run ${i + 1}`);
    // Collect all unique spec IDs across all runs
    const allSpecIds = new Map();
    for (const run of runs) {
        for (const spec of run.results) {
            if (!allSpecIds.has(spec.specId)) {
                allSpecIds.set(spec.specId, {
                    name: spec.name,
                    filePath: spec.filePath,
                });
            }
        }
    }
    // Build comparison rows
    const specs = [];
    const wins = {};
    let ties = 0;
    for (const label of labels)
        wins[label] = 0;
    for (const [specId, meta] of allSpecIds) {
        const results = runs.map((run, i) => {
            const spec = run.results.find((r) => r.specId === specId);
            if (!spec) {
                return {
                    label: labels[i],
                    status: "missing",
                    score: undefined,
                    duration: 0,
                };
            }
            return {
                label: labels[i],
                status: spec.result.status,
                score: spec.result.score,
                duration: spec.result.duration,
                error: spec.result.error,
            };
        });
        // Determine winner by score (higher is better), then by status
        const scoredResults = results.filter((r) => r.score !== undefined && r.status !== "missing");
        let winner = null;
        if (scoredResults.length >= 2) {
            const maxScore = Math.max(...scoredResults.map((r) => r.score ?? 0));
            const topScorers = scoredResults.filter((r) => r.score === maxScore);
            if (topScorers.length === 1) {
                winner = topScorers[0].label;
                wins[winner]++;
            }
            else {
                ties++;
            }
        }
        else {
            // Compare by status: passed > failed > skipped > missing
            const statusRank = { passed: 3, failed: 1, skipped: 0, missing: -1 };
            const ranked = results
                .filter((r) => r.status !== "missing")
                .sort((a, b) => (statusRank[b.status] ?? 0) - (statusRank[a.status] ?? 0));
            if (ranked.length >= 2 &&
                statusRank[ranked[0].status] > statusRank[ranked[1].status]) {
                winner = ranked[0].label;
                wins[winner]++;
            }
            else if (ranked.length >= 2) {
                ties++;
            }
        }
        specs.push({
            specId,
            name: meta.name,
            filePath: meta.filePath,
            results,
            winner,
        });
    }
    // Sort
    if (options.sortBy === "score") {
        specs.sort((a, b) => {
            const aMax = Math.max(...a.results.map((r) => r.score ?? 0));
            const bMax = Math.max(...b.results.map((r) => r.score ?? 0));
            return bMax - aMax;
        });
    }
    else if (options.sortBy === "duration") {
        specs.sort((a, b) => {
            const aMax = Math.max(...a.results.map((r) => r.duration));
            const bMax = Math.max(...b.results.map((r) => r.duration));
            return bMax - aMax;
        });
    }
    else {
        specs.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Build aggregates
    const aggregates = runs.map((run, i) => {
        const passed = run.results.filter((r) => r.result.status === "passed").length;
        const failed = run.results.filter((r) => r.result.status === "failed").length;
        const scores = run.results
            .filter((r) => r.result.score !== undefined)
            .map((r) => r.result.score);
        const durations = run.results.map((r) => r.result.duration);
        return {
            label: labels[i],
            runId: run.runId,
            passed,
            failed,
            avgScore: scores.length > 0
                ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000
                : 0,
            avgDuration: durations.length > 0
                ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                : 0,
            totalDuration: durations.reduce((a, b) => a + b, 0),
        };
    });
    return {
        schemaVersion: 1,
        labels,
        runIds: runs.map((r) => r.runId),
        specs,
        summary: { wins, ties, aggregates },
    };
}
/**
 * Print human-readable comparison
 */
function printHumanCompare(result) {
    console.log("\n🔄 Run Comparison\n");
    // Header
    const labelHeader = result.labels.map((l) => l.padEnd(16)).join("  ");
    console.log(`  ${"Spec".padEnd(30)}  ${labelHeader}  Winner`);
    console.log(`  ${"─".repeat(30)}  ${result.labels.map(() => "─".repeat(16)).join("  ")}  ${"─".repeat(12)}`);
    // Rows
    for (const spec of result.specs) {
        const name = spec.name.length > 28 ? `${spec.name.substring(0, 25)}...` : spec.name;
        const cells = spec.results.map((r) => {
            const icon = r.status === "passed"
                ? "✅"
                : r.status === "failed"
                    ? "❌"
                    : r.status === "skipped"
                        ? "⏭️"
                        : "➖";
            const score = r.score !== undefined ? `${(r.score * 100).toFixed(0)}%` : "";
            const dur = r.duration > 0 ? `${r.duration}ms` : "";
            return `${icon} ${score} ${dur}`.padEnd(16);
        });
        const winner = spec.winner ?? "tie";
        console.log(`  ${name.padEnd(30)}  ${cells.join("  ")}  ${winner}`);
    }
    // Summary
    console.log("\n📊 Summary:");
    for (const agg of result.summary.aggregates) {
        console.log(`  ${agg.label}: ${agg.passed} passed, ${agg.failed} failed, avg score: ${(agg.avgScore * 100).toFixed(1)}%, avg latency: ${agg.avgDuration}ms`);
    }
    console.log("\n🏆 Wins:");
    for (const [label, count] of Object.entries(result.summary.wins)) {
        console.log(`  ${label}: ${count} wins`);
    }
    if (result.summary.ties > 0) {
        console.log(`  Ties: ${result.summary.ties}`);
    }
}
/**
 * Print JSON comparison
 */
function printJsonCompare(result) {
    console.log(JSON.stringify(result, null, 2));
}
/**
 * CLI entry point for compare
 */
async function runCompareCLI(options) {
    try {
        const result = await runCompare(options);
        if (options.format === "json") {
            printJsonCompare(result);
        }
        else {
            printHumanCompare(result);
        }
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Compare failed:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
