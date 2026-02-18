"use strict";
/**
 * Human-readable formatter for evalai check output.
 * Deterministic: verdict → score → failures → link → hint.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatHuman = formatHuman;
const snippet_1 = require("../render/snippet");
const TOP_N = 3;
function formatHuman(report) {
    const lines = [];
    const passed = report.verdict === 'pass';
    const failReason = report.reasonMessage;
    lines.push(passed ? '\n✓ EvalAI gate PASSED' : `\n✗ EvalAI gate FAILED: ${failReason ?? report.reasonCode}`);
    const deltaStr = report.baselineScore != null && report.delta != null
        ? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? '+' : ''}${report.delta} pts)`
        : '';
    lines.push(`Score: ${report.score ?? 0}/100${deltaStr}`);
    const failedCases = report.failedCases ?? [];
    if (failedCases.length > 0) {
        const toShow = failedCases.slice(0, TOP_N);
        lines.push(`${failedCases.length} failing case${failedCases.length === 1 ? '' : 's'}:`);
        for (const fc of toShow) {
            const label = fc.name ?? fc.input ?? '(unnamed)';
            const exp = (0, snippet_1.truncateSnippet)(fc.expectedOutput ?? fc.expectedSnippet, 50);
            const out = (0, snippet_1.truncateSnippet)(fc.output ?? fc.outputSnippet, 50);
            const reason = out ? `got "${out}"` : 'no output';
            lines.push(`  - "${(0, snippet_1.truncateSnippet)(label, 50)}" → expected: ${exp || '(any)'}, ${reason}`);
        }
        if (failedCases.length > toShow.length) {
            lines.push(`  + ${failedCases.length - toShow.length} more`);
        }
    }
    if (report.dashboardUrl) {
        lines.push(`Dashboard: ${report.dashboardUrl}`);
    }
    if (!passed) {
        lines.push('Next: View full report above, fix failing cases, or adjust gate with --minScore / --maxDrop');
    }
    if (report.explain && (report.breakdown01 || report.contribPts || report.flags?.length)) {
        lines.push('');
        lines.push('--- Explain ---');
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
                lines.push(`Contrib pts: ${pts.join(', ')}`);
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
                lines.push(`Breakdown: ${parts.join(', ')}`);
        }
        if (report.flags && report.flags.length > 0) {
            lines.push(`Flags: ${report.flags.join(', ')}`);
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
                lines.push(`Thresholds: ${parts.join(', ')}`);
        }
    }
    return lines.join('\n');
}
