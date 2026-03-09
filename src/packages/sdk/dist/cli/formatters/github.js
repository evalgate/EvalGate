"use strict";
/**
 * GitHub formatter for evalgate check.
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
function pct(value) {
    return `${(value * 100).toFixed(1)}%`;
}
function escapeAnnotationMessage(s) {
    return s.replace(/\r/g, "").replace(/\n/g, "%0A");
}
function formatAnnotation(fc) {
    const id = fc.testCaseId ?? fc.name ?? "unknown";
    const reason = fc.reason ?? fc.outputSnippet ?? fc.output ?? "no output";
    const msg = escapeAnnotationMessage(`TestCase ${id} failed - ${(0, snippet_1.truncateSnippet)(reason, 100)}`);
    return `::error title=EvalGate regression::${msg}`;
}
function appendStepSummary(report) {
    const path = typeof process !== "undefined" && process.env?.GITHUB_STEP_SUMMARY;
    if (!path)
        return;
    const lines = [];
    const passed = report.verdict === "pass";
    const warned = report.verdict === "warn";
    lines.push("## EvalGate Gate");
    lines.push("");
    lines.push(passed && !warned
        ? "✅ **PASSED**"
        : warned
            ? `⚠️ **WARNED**: ${report.reasonMessage ?? report.reasonCode}`
            : `❌ **FAILED**: ${report.reasonMessage ?? report.reasonCode}`);
    lines.push("");
    const deltaStr = report.baselineScore != null && report.delta != null
        ? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? "+" : ""}${report.delta} pts)`
        : "";
    lines.push(`**Score:** ${report.score ?? 0}/100${deltaStr}`);
    lines.push("");
    if (report.judgeAlignment) {
        const ja = report.judgeAlignment;
        const jc = report.judgeCredibility;
        const parts = [];
        if (ja.tpr != null)
            parts.push(`TPR=${ja.tpr}`);
        if (ja.tnr != null)
            parts.push(`TNR=${ja.tnr}`);
        if (ja.correctedPassRate != null)
            parts.push(`correctedPass=${ja.correctedPassRate}`);
        if (ja.ci95Low != null && ja.ci95High != null)
            parts.push(`CI95=[${ja.ci95Low}, ${ja.ci95High}]`);
        if (ja.sampleSize != null)
            parts.push(`n=${ja.sampleSize}`);
        if (parts.length > 0) {
            lines.push(`**Judge alignment:** ${parts.join(", ")}`);
            if (jc?.rawPassRate != null) {
                if (jc.correctionApplied && jc.correctedPassRate != null) {
                    lines.push(`**Pass rate:** ${pct(jc.correctedPassRate)} (corrected; raw ${pct(jc.rawPassRate)})`);
                }
                else if (jc.correctionSkippedReason === "judge_too_weak_to_correct" &&
                    jc.discriminativePower != null) {
                    lines.push(`**Pass rate:** ${pct(jc.rawPassRate)} (raw) ⚠ corrected unavailable — judge too weak (TPR + TNR - 1 = ${jc.discriminativePower.toFixed(2)})`);
                }
                else {
                    lines.push(`**Pass rate:** ${pct(jc.rawPassRate)} (raw)`);
                }
                if (jc.ciApplied && jc.ci95) {
                    lines.push(`**CI:** [${pct(jc.ci95.low)}, ${pct(jc.ci95.high)}]`);
                }
                else if (jc.ciSkippedReason === "insufficient_samples_for_ci" &&
                    jc.sampleSize != null) {
                    lines.push(`**CI:** skipped — insufficient labeled samples (n=${jc.sampleSize}, min=30)`);
                }
                else if (jc.ciSkippedReason === "judge_too_weak_to_correct") {
                    lines.push("**CI:** skipped — correction unavailable (judge too weak)");
                }
            }
            lines.push("");
        }
    }
    const failedCases = report.failedCases ?? [];
    if (failedCases.length > 0) {
        lines.push(`### ${failedCases.length} failing case${failedCases.length === 1 ? "" : "s"}`);
        lines.push("");
        for (const fc of failedCases.slice(0, 10)) {
            const label = fc.name ?? fc.input ?? "(unnamed)";
            const exp = (0, snippet_1.truncateSnippet)(fc.expectedOutput ?? fc.expectedSnippet, 80);
            const out = (0, snippet_1.truncateSnippet)(fc.output ?? fc.outputSnippet, 80);
            const reason = out ? `got "${out}"` : "no output";
            lines.push(`- **${(0, snippet_1.truncateSnippet)(label, 60)}** — expected: ${exp || "(unknown)"}, ${reason}`);
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
    if (!passed) {
        lines.push("> **Tip:** Run `evalgate explain` locally to see root causes and suggested fixes.");
        lines.push("> Report saved to `.evalgate/last-report.json` — upload as a build artifact for offline analysis.");
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
    const warned = report.verdict === "warn";
    const failReason = report.reasonMessage ?? report.reasonCode;
    if (passed && !warned)
        stdoutLines.push("\n✓ EvalGate gate PASSED");
    else if (warned)
        stdoutLines.push(`\n⚠ EvalGate gate WARNED: ${failReason}`);
    else
        stdoutLines.push(`\n✗ EvalGate gate FAILED: ${failReason}`);
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
