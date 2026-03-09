"use strict";
/**
 * PR comment markdown builder for evalgate check --pr-comment-out.
 * Produces deterministic markdown for GitHub Action to post as PR comment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PR_COMMENT_MARKER = void 0;
exports.buildPrComment = buildPrComment;
const snippet_1 = require("../render/snippet");
const TOP_FAILURES = 3;
function pct(value) {
    return `${(value * 100).toFixed(1)}%`;
}
function escapeMarkdown(s) {
    return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
/**
 * Hidden marker for GitHub Action to find and update existing comment (sticky update).
 * Action should: 1) post body from file 2) search PR comments for this marker 3) update if found, else create.
 * Export for use in Action scripts.
 */
exports.PR_COMMENT_MARKER = "<!-- evalgate-gate-comment -->";
function buildPrComment(report) {
    const lines = [];
    lines.push(exports.PR_COMMENT_MARKER);
    lines.push("");
    const passed = report.verdict === "pass";
    const gateApplied = report.gateApplied !== false;
    // Verdict badge — distinguish "PASS" from "NOT GATED"
    if (!gateApplied) {
        lines.push("## ⚠️ EvalGate Regression Gate — NOT APPLIED");
        lines.push("");
        lines.push("**Gate not applied: baseline missing.**");
        if (report.actionableMessage) {
            lines.push("");
            lines.push(report.actionableMessage);
        }
    }
    else {
        lines.push(passed
            ? "## ✅ EvalGate Regression Gate — PASSED"
            : "## 🚨 EvalGate Regression Gate — FAILED");
    }
    lines.push("");
    // Score + Delta (skip when gate not applied)
    const deltaStr = report.baselineScore != null && report.delta != null
        ? ` (${report.delta >= 0 ? "+" : ""}${report.delta} from baseline ${report.baselineScore})`
        : "";
    lines.push(`**Score:** ${report.score ?? 0}/100${deltaStr}`);
    lines.push("");
    // ReasonCode
    lines.push(`**Reason:** ${report.reasonCode}`);
    if (report.reasonMessage) {
        lines.push(`_${escapeMarkdown(report.reasonMessage)}_`);
    }
    lines.push("");
    // Policy (if unknown)
    if (report.policy) {
        lines.push(`**Policy:** ${report.policy}`);
        lines.push("");
    }
    // Top failures (max 3)
    const failedCases = report.failedCases ?? [];
    if (failedCases.length > 0) {
        lines.push("### Top Issues");
        lines.push("");
        for (const fc of failedCases.slice(0, TOP_FAILURES)) {
            const label = fc.name ?? fc.input ?? "(unnamed)";
            const reason = fc.reason ?? fc.outputSnippet ?? fc.output ?? "no output";
            lines.push(`- **${(0, snippet_1.truncateSnippet)(escapeMarkdown(label), 60)}** — ${(0, snippet_1.truncateSnippet)(escapeMarkdown(reason), 80)}`);
        }
        if (failedCases.length > TOP_FAILURES) {
            lines.push(`- _+ ${failedCases.length - TOP_FAILURES} more_`);
        }
        lines.push("");
    }
    // Explain summary (if --explain)
    if (report.explain && report.contribPts) {
        const pts = report.contribPts;
        const parts = [];
        if (pts.passRatePts != null)
            parts.push(`pass rate: ${pts.passRatePts} pts`);
        if (pts.safetyPts != null)
            parts.push(`safety: ${pts.safetyPts} pts`);
        if (pts.compliancePts != null)
            parts.push(`compliance: ${pts.compliancePts} pts`);
        if (pts.performancePts != null)
            parts.push(`performance: ${pts.performancePts} pts`);
        if (parts.length > 0) {
            lines.push("### Breakdown");
            lines.push("");
            lines.push(parts.join(" | "));
            lines.push("");
        }
    }
    if (report.judgeAlignment) {
        const ja = report.judgeAlignment;
        const jc = report.judgeCredibility;
        const parts = [];
        if (ja.tpr != null)
            parts.push(`TPR=${ja.tpr}`);
        if (ja.tnr != null)
            parts.push(`TNR=${ja.tnr}`);
        if (ja.rawPassRate != null)
            parts.push(`rawPass=${ja.rawPassRate}`);
        if (ja.correctedPassRate != null)
            parts.push(`correctedPass=${ja.correctedPassRate}`);
        if (ja.ci95Low != null && ja.ci95High != null)
            parts.push(`CI95=[${ja.ci95Low}, ${ja.ci95High}]`);
        if (ja.sampleSize != null)
            parts.push(`n=${ja.sampleSize}`);
        if (parts.length > 0) {
            lines.push("### Judge Alignment");
            lines.push("");
            lines.push(parts.join(" | "));
            if (jc?.rawPassRate != null) {
                if (jc.correctionApplied && jc.correctedPassRate != null) {
                    lines.push(`Pass rate: ${pct(jc.correctedPassRate)} (corrected; raw ${pct(jc.rawPassRate)})`);
                }
                else if (jc.correctionSkippedReason === "judge_too_weak_to_correct" &&
                    jc.discriminativePower != null) {
                    lines.push(`Pass rate: ${pct(jc.rawPassRate)} (raw) ⚠ corrected rate unavailable — judge too weak (TPR + TNR - 1 = ${jc.discriminativePower.toFixed(2)})`);
                }
                else {
                    lines.push(`Pass rate: ${pct(jc.rawPassRate)} (raw)`);
                }
                if (jc.ciApplied && jc.ci95) {
                    lines.push(`CI: [${pct(jc.ci95.low)}, ${pct(jc.ci95.high)}]`);
                }
                else if (jc.ciSkippedReason === "insufficient_samples_for_ci" &&
                    jc.sampleSize != null) {
                    lines.push(`CI: skipped — insufficient labeled samples (n=${jc.sampleSize}, min=30)`);
                }
                else if (jc.ciSkippedReason === "judge_too_weak_to_correct") {
                    lines.push("CI: skipped — correction unavailable (judge too weak)");
                }
            }
            lines.push("");
        }
    }
    // Dashboard URL
    if (report.dashboardUrl) {
        lines.push(`🔎 [Dashboard](${report.dashboardUrl})`);
    }
    // Share URL (if exists)
    if (report.shareUrl) {
        lines.push(`🔗 [Share Snapshot](${report.shareUrl})`);
    }
    lines.push("");
    return lines.join("\n");
}
