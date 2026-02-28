"use strict";
/**
 * RUNTIME-104: Deterministic Report Serialization (RunReport v1)
 *
 * Stable report format for downstream processing (explain, diff, history).
 * Mirrors CheckReport conventions for consistency.
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
exports.RunReportBuilder = exports.RUN_REPORT_SCHEMA_VERSION = void 0;
exports.createRunReport = createRunReport;
exports.parseRunReport = parseRunReport;
/**
 * RunReport schema version - increment when breaking changes occur
 */
exports.RUN_REPORT_SCHEMA_VERSION = "1";
/**
 * RunReport builder for creating deterministic reports
 */
class RunReportBuilder {
    /**
     * Initialize report with basic metadata
     */
    constructor(runId, runtimeInfo) {
        this.runId = runId;
        this.runtimeInfo = runtimeInfo;
        this.report = {
            schemaVersion: exports.RUN_REPORT_SCHEMA_VERSION,
            results: [],
            failures: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                errors: 0,
                timeouts: 0,
                passRate: 0,
                averageScore: 0,
                totalDurationMs: 0,
                success: true,
            },
        };
        this.report.startedAt = new Date().toISOString();
        this.report.runId = runId;
        this.report.runtime = runtimeInfo;
    }
    /**
     * Add a test result to the report
     */
    addResult(testId, testName, filePath, position, input, result) {
        const runResult = {
            testId,
            testName,
            filePath,
            position,
            input,
            pass: result.pass,
            score: result.score,
            durationMs: result.durationMs || 0,
            metadata: result.metadata,
            tags: [], // TODO: Extract from spec
            assertions: result.assertions?.map((assertion, index) => ({
                name: assertion.name || `assertion-${index}`,
                passed: assertion.passed,
                message: assertion.message,
            })),
        };
        this.report.results.push(runResult);
        // Update summary
        this.updateSummary(result);
        // Add to failures if needed
        if (!result.pass || result.classification === "error" || result.classification === "timeout") {
            this.addFailure(testId, testName, filePath, position, result);
        }
    }
    /**
     * Update summary statistics
     */
    updateSummary(result) {
        const summary = this.report.summary;
        summary.total++;
        summary.totalDurationMs += result.durationMs || 0;
        if (result.pass) {
            summary.passed++;
        }
        else if (result.classification === "error") {
            summary.errors++;
            summary.success = false;
        }
        else if (result.classification === "timeout") {
            summary.timeouts++;
            summary.success = false;
        }
        else {
            summary.failed++;
        }
        // Calculate rates and averages
        summary.passRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;
        // Average score calculation (excluding errors/timeouts)
        const scoredResults = this.report.results.filter((r) => r.score > 0);
        summary.averageScore =
            scoredResults.length > 0
                ? scoredResults.reduce((sum, r) => sum + r.score, 0) / scoredResults.length
                : 0;
    }
    /**
     * Add a failure to the report
     */
    addFailure(testId, testName, filePath, position, result) {
        const failure = {
            testId,
            testName,
            filePath,
            position,
            classification: result.classification === "error"
                ? "error"
                : result.classification === "timeout"
                    ? "timeout"
                    : "failed",
            errorEnvelope: result.errorEnvelope,
            message: result.error || "Test failed",
            timestamp: new Date().toISOString(),
        };
        this.report.failures.push(failure);
    }
    /**
     * Set execution configuration
     */
    setConfig(config) {
        this.report.config = {
            executorType: "local",
            defaultTimeout: 30000,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
            ...config,
        };
    }
    /**
     * Finalize and return the complete report
     */
    build() {
        // Sort results and failures by testId for determinism
        this.report.results.sort((a, b) => a.testId.localeCompare(b.testId));
        this.report.failures.sort((a, b) => a.testId.localeCompare(b.testId));
        // Set completion timestamp
        this.report.finishedAt = new Date().toISOString();
        const finalReport = this.report;
        // Add toJSON method
        finalReport.toJSON = () => JSON.stringify(finalReport, null, 2);
        return finalReport;
    }
    /**
     * Serialize report to JSON string
     * Ensures deterministic output
     */
    toJSON() {
        const report = this.build();
        return JSON.stringify(report, null, 2);
    }
    /**
     * Write report to file
     */
    async writeToFile(filePath) {
        const fs = await Promise.resolve().then(() => __importStar(require("node:fs/promises")));
        await fs.writeFile(filePath, this.toJSON(), "utf-8");
    }
}
exports.RunReportBuilder = RunReportBuilder;
/**
 * Create a new RunReport builder
 */
function createRunReport(runId, runtimeInfo) {
    return new RunReportBuilder(runId, runtimeInfo);
}
/**
 * Parse a RunReport from JSON string
 */
function parseRunReport(json) {
    const report = JSON.parse(json);
    // Validate schema version
    if (report.schemaVersion !== exports.RUN_REPORT_SCHEMA_VERSION) {
        throw new Error(`Unsupported RunReport schema version: ${report.schemaVersion}`);
    }
    return report;
}
