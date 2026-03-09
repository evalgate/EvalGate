"use strict";
/**
 * Human-readable formatter for evalgate check output.
 * Deterministic: verdict → score → failures → link → hint.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatHuman = formatHuman;
const snippet_1 = require("../render/snippet");
const TOP_N = 3;
function pct(value) {
    return `${(value * 100).toFixed(1)}%`;
}
function formatHuman(report) {
    const lines = [];
    const passed = report.verdict === "pass";
    const warned = report.verdict === "warn";
    const failReason = report.reasonMessage;
    lines.push(passed && !warned
        ? "\n✓ EvalGate gate PASSED"
        : warned
            ? `\n⚠ EvalGate gate WARNED: ${failReason ?? report.reasonCode}`
            : `\n✗ EvalGate gate FAILED: ${failReason ?? report.reasonCode}`);
    const deltaStr = report.baselineScore != null && report.delta != null
        ? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? "+" : ""}${report.delta} pts)`
        : "";
    lines.push(`Score: ${report.score ?? 0}/100${deltaStr}`);
    if (report.judgeCredibility) {
        const jc = report.judgeCredibility;
        if (jc.rawPassRate != null) {
            if (jc.correctionApplied && jc.correctedPassRate != null) {
                lines.push(`Pass rate:  ${pct(jc.correctedPassRate)} (corrected; raw ${pct(jc.rawPassRate)})`);
            }
            else if (jc.correctionSkippedReason === "judge_too_weak_to_correct" &&
                jc.discriminativePower != null) {
                lines.push(`Pass rate:  ${pct(jc.rawPassRate)} (raw)  ⚠ corrected rate unavailable — judge too weak (TPR + TNR - 1 = ${jc.discriminativePower.toFixed(2)})`);
            }
            else {
                lines.push(`Pass rate:  ${pct(jc.rawPassRate)} (raw)`);
            }
        }
        if (jc.ciApplied && jc.ci95) {
            lines.push(`CI:         [${pct(jc.ci95.low)}, ${pct(jc.ci95.high)}]`);
        }
        else if (jc.ciSkippedReason === "insufficient_samples_for_ci" &&
            jc.sampleSize != null) {
            lines.push(`CI:         skipped — insufficient labeled samples (n=${jc.sampleSize}, min=30)`);
        }
        else if (jc.ciSkippedReason === "judge_too_weak_to_correct") {
            lines.push("CI:         skipped — correction unavailable (judge too weak)");
        }
    }
    const failedCases = report.failedCases ?? [];
    if (failedCases.length > 0) {
        const toShow = failedCases.slice(0, TOP_N);
        lines.push(`${failedCases.length} failing case${failedCases.length === 1 ? "" : "s"}:`);
        for (const fc of toShow) {
            const label = fc.name ?? fc.input ?? "(unnamed)";
            const exp = (0, snippet_1.truncateSnippet)(fc.expectedOutput ?? fc.expectedSnippet, 50);
            const out = (0, snippet_1.truncateSnippet)(fc.output ?? fc.outputSnippet, 50);
            const reason = out ? `got "${out}"` : "no output";
            lines.push(`  - "${(0, snippet_1.truncateSnippet)(label, 50)}" → expected: ${exp || "(unknown)"}, ${reason}`);
        }
        if (failedCases.length > toShow.length) {
            lines.push(`  + ${failedCases.length - toShow.length} more`);
        }
    }
    if (report.dashboardUrl) {
        lines.push(`Dashboard: ${report.dashboardUrl}`);
    }
    if (!passed || warned) {
        lines.push("Next: View full report above, fix failing cases, or adjust gate with --minScore / --maxDrop / --warnDrop");
    }
    if (report.explain &&
        (report.breakdown01 ||
            report.contribPts ||
            report.judgeAlignment ||
            report.flags?.length ||
            report.policyEvidence)) {
        lines.push("");
        lines.push("--- Explain ---");
        if (report.contribPts) {
            const cp = report.contribPts;
            const pts = [];
            if (cp.passRatePts != null)
                pts.push(`passRate: ${cp.passRatePts}`);
            if (cp.safetyPts != null)
                pts.push(`safety: ${cp.safetyPts}`);
            if (cp.compliancePts != null)
                pts.push(`compliance: ${cp.compliancePts}`);
            if (cp.performancePts != null)
                pts.push(`performance: ${cp.performancePts}`);
            if (pts.length)
                lines.push(`Contrib pts: ${pts.join(", ")}`);
        }
        if (report.breakdown01) {
            const b = report.breakdown01;
            const parts = [];
            if (b.passRate != null)
                parts.push(`passRate=${b.passRate}`);
            if (b.safety != null)
                parts.push(`safety=${b.safety}`);
            if (b.judge != null)
                parts.push(`judge=${b.judge}`);
            if (b.schema != null)
                parts.push(`schema=${b.schema}`);
            if (b.latency != null)
                parts.push(`latency=${b.latency}`);
            if (b.cost != null)
                parts.push(`cost=${b.cost}`);
            if (parts.length)
                lines.push(`Breakdown: ${parts.join(", ")}`);
        }
        if (report.flags && report.flags.length > 0) {
            lines.push(`Flags: ${report.flags.join(", ")}`);
        }
        if (report.judgeAlignment) {
            const ja = report.judgeAlignment;
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
            if (parts.length)
                lines.push(`Judge alignment: ${parts.join(", ")}`);
        }
        if (report.thresholds) {
            const t = report.thresholds;
            const parts = [];
            if (t.minScore != null)
                parts.push(`minScore=${t.minScore}`);
            if (t.maxDrop != null)
                parts.push(`maxDrop=${t.maxDrop}`);
            if (t.minN != null)
                parts.push(`minN=${t.minN}`);
            if (parts.length)
                lines.push(`Thresholds: ${parts.join(", ")}`);
        }
        if (report.policyEvidence) {
            const pe = report.policyEvidence;
            lines.push(`Policy sub-check failed: ${pe.failedCheck ?? "unknown"}`);
            if (pe.remediation)
                lines.push(`Remediation: ${pe.remediation}`);
            if (pe.snapshot && Object.keys(pe.snapshot).length > 0) {
                lines.push(`Snapshot: ${JSON.stringify(pe.snapshot)}`);
            }
        }
    }
    return lines.join("\n");
}
