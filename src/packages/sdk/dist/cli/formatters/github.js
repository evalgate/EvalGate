"use strict";
/**
 * GitHub formatter for evalai check.
 * - stdout: minimal (verdict + score + link) + ::error annotations for failed cases
 * - Step summary: full Markdown written to GITHUB_STEP_SUMMARY (not stdout)
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
exports.appendStepSummary = appendStepSummary;
exports.formatGitHub = formatGitHub;
const fs = __importStar(require("node:fs"));
const snippet_1 = require("../render/snippet");
const ANNOTATION_MAX = 10;
function escapeAnnotationMessage(s) {
    return s.replace(/\r/g, "").replace(/\n/g, "%0A");
}
function formatAnnotation(fc) {
    const id = fc.testCaseId ?? fc.name ?? "unknown";
    const reason = fc.reason ?? fc.outputSnippet ?? fc.output ?? "no output";
    const msg = escapeAnnotationMessage(`TestCase ${id} failed - ${(0, snippet_1.truncateSnippet)(reason, 100)}`);
    return `::error title=EvalAI regression::${msg}`;
}
function appendStepSummary(report) {
    const path = typeof process !== "undefined" && process.env?.GITHUB_STEP_SUMMARY;
    if (!path)
        return;
    const lines = [];
    const passed = report.verdict === "pass";
    lines.push("## EvalAI Gate");
    lines.push("");
    lines.push(passed ? "✅ **PASSED**" : `❌ **FAILED**: ${report.reasonMessage ?? report.reasonCode}`);
    lines.push("");
    const deltaStr = report.baselineScore != null && report.delta != null
        ? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? "+" : ""}${report.delta} pts)`
        : "";
    lines.push(`**Score:** ${report.score ?? 0}/100${deltaStr}`);
    lines.push("");
    const failedCases = report.failedCases ?? [];
    if (failedCases.length > 0) {
        lines.push(`### ${failedCases.length} failing case${failedCases.length === 1 ? "" : "s"}`);
        lines.push("");
        for (const fc of failedCases.slice(0, 10)) {
            const label = fc.name ?? fc.input ?? "(unnamed)";
            const exp = (0, snippet_1.truncateSnippet)(fc.expectedOutput ?? fc.expectedSnippet, 80);
            const out = (0, snippet_1.truncateSnippet)(fc.output ?? fc.outputSnippet, 80);
            const reason = out ? `got "${out}"` : "no output";
            lines.push(`- **${(0, snippet_1.truncateSnippet)(label, 60)}** — expected: ${exp || "(any)"}, ${reason}`);
        }
        if (failedCases.length > 10) {
            lines.push(`- _+ ${failedCases.length - 10} more_`);
        }
        lines.push("");
    }
    if (report.dashboardUrl) {
        lines.push(`[View Dashboard](${report.dashboardUrl})`);
        lines.push("");
    }
    try {
        fs.appendFileSync(path, lines.join("\n"), "utf8");
    }
    catch {
        // Non-fatal: step summary is best-effort
    }
}
function formatGitHub(report) {
    const stdoutLines = [];
    // Emit ::error annotations for failed cases (up to N)
    const failedCases = report.failedCases ?? [];
    const toAnnotate = failedCases.slice(0, ANNOTATION_MAX);
    for (const fc of toAnnotate) {
        stdoutLines.push(formatAnnotation(fc));
    }
    // Minimal summary: verdict + score + link
    const passed = report.verdict === "pass";
    const failReason = report.reasonMessage ?? report.reasonCode;
    stdoutLines.push(passed ? "\n✓ EvalAI gate PASSED" : `\n✗ EvalAI gate FAILED: ${failReason}`);
    const deltaStr = report.baselineScore != null && report.delta != null
        ? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? "+" : ""}${report.delta} pts)`
        : "";
    stdoutLines.push(`Score: ${report.score ?? 0}/100${deltaStr}`);
    if (report.dashboardUrl) {
        stdoutLines.push(`Dashboard: ${report.dashboardUrl}`);
    }
    // Write full markdown to GITHUB_STEP_SUMMARY (not stdout)
    appendStepSummary(report);
    return stdoutLines.join("\n");
}
