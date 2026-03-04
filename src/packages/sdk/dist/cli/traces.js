"use strict";
/**
 * Structured trace writer for evalgate runs
 *
 * Auto-writes structured JSON to .evalgate/traces/ on every defineEval result.
 * Each trace captures: spec identity, timing, assertions, score, and metadata.
 *
 * Trace files are append-friendly and suitable for post-hoc analysis.
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
exports.calculatePercentiles = calculatePercentiles;
exports.buildRunTrace = buildRunTrace;
exports.writeTraces = writeTraces;
exports.formatLatencyTable = formatLatencyTable;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
/**
 * Calculate latency percentiles from durations
 */
function calculatePercentiles(durations) {
    if (durations.length === 0) {
        return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
    }
    const sorted = [...durations].sort((a, b) => a - b);
    const len = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
        min: sorted[0],
        max: sorted[len - 1],
        mean: Math.round(sum / len),
        p50: sorted[Math.floor(len * 0.5)],
        p95: sorted[Math.min(Math.floor(len * 0.95), len - 1)],
        p99: sorted[Math.min(Math.floor(len * 0.99), len - 1)],
    };
}
/**
 * Build a RunTrace from a RunResult
 */
function buildRunTrace(result, gitInfo) {
    const now = Date.now();
    const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS || !!process.env.GITLAB_CI;
    const specTraces = result.results.map((spec) => ({
        schemaVersion: 1,
        timestamp: now,
        timestampISO: new Date(now).toISOString(),
        runId: result.runId,
        spec: {
            id: spec.specId,
            name: spec.name,
            filePath: spec.filePath,
        },
        execution: {
            status: spec.result.status,
            score: spec.result.score,
            duration: spec.result.duration,
            error: spec.result.error,
        },
        git: gitInfo,
        env: {
            nodeVersion: process.version,
            platform: process.platform,
            ci: isCI,
        },
    }));
    const durations = result.results
        .filter((r) => r.result.status !== "skipped")
        .map((r) => r.result.duration);
    const latency = calculatePercentiles(durations);
    return {
        schemaVersion: 1,
        run: {
            id: result.runId,
            startedAt: result.metadata.startedAt,
            completedAt: result.metadata.completedAt,
            duration: result.metadata.duration,
            mode: result.metadata.mode,
        },
        summary: {
            total: result.results.length,
            passed: result.summary.passed,
            failed: result.summary.failed,
            skipped: result.summary.skipped,
            passRate: result.summary.passRate,
        },
        latency,
        specs: specTraces,
    };
}
/**
 * Write structured trace files to .evalgate/traces/
 */
async function writeTraces(result, projectRoot = process.cwd(), gitInfo) {
    const tracesDir = path.join(projectRoot, ".evalgate", "traces");
    await fs.mkdir(tracesDir, { recursive: true });
    const runTrace = buildRunTrace(result, gitInfo);
    // Write run-level trace
    const traceFileName = `${result.runId}.trace.json`;
    const tracePath = path.join(tracesDir, traceFileName);
    await fs.writeFile(tracePath, JSON.stringify(runTrace, null, 2), "utf-8");
    // Update latest symlink
    const latestPath = path.join(tracesDir, "latest.trace.json");
    await fs.writeFile(latestPath, JSON.stringify(runTrace, null, 2), "utf-8");
    return tracePath;
}
/**
 * Format latency percentiles for human display
 */
function formatLatencyTable(latency) {
    const lines = [
        "⏱️  Latency Percentiles:",
        `   min:  ${latency.min}ms`,
        `   p50:  ${latency.p50}ms`,
        `   p95:  ${latency.p95}ms`,
        `   p99:  ${latency.p99}ms`,
        `   max:  ${latency.max}ms`,
        `   mean: ${latency.mean}ms`,
    ];
    return lines.join("\n");
}
