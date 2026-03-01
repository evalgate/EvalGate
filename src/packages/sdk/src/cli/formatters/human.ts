/**
 * Human-readable formatter for evalgate check output.
 * Deterministic: verdict → score → failures → link → hint.
 */

import { truncateSnippet } from "../render/snippet";
import type { CheckReport } from "./types";

const TOP_N = 3;

export function formatHuman(report: CheckReport): string {
	const lines: string[] = [];
	const passed = report.verdict === "pass";
	const warned = report.verdict === "warn";
	const failReason = report.reasonMessage;

	lines.push(
		passed && !warned
			? "\n✓ EvalGate gate PASSED"
			: warned
				? `\n⚠ EvalGate gate WARNED: ${failReason ?? report.reasonCode}`
				: `\n✗ EvalGate gate FAILED: ${failReason ?? report.reasonCode}`,
	);

	const deltaStr =
		report.baselineScore != null && report.delta != null
			? ` (baseline ${report.baselineScore}, ${report.delta >= 0 ? "+" : ""}${report.delta} pts)`
			: "";
	lines.push(`Score: ${report.score ?? 0}/100${deltaStr}`);

	const failedCases = report.failedCases ?? [];
	if (failedCases.length > 0) {
		const toShow = failedCases.slice(0, TOP_N);
		lines.push(
			`${failedCases.length} failing case${failedCases.length === 1 ? "" : "s"}:`,
		);
		for (const fc of toShow) {
			const label = fc.name ?? fc.input ?? "(unnamed)";
			const exp = truncateSnippet(fc.expectedOutput ?? fc.expectedSnippet, 50);
			const out = truncateSnippet(fc.output ?? fc.outputSnippet, 50);
			const reason = out ? `got "${out}"` : "no output";
			lines.push(
				`  - "${truncateSnippet(label, 50)}" → expected: ${exp || "(unknown)"}, ${reason}`,
			);
		}
		if (failedCases.length > toShow.length) {
			lines.push(`  + ${failedCases.length - toShow.length} more`);
		}
	}

	if (report.dashboardUrl) {
		lines.push(`Dashboard: ${report.dashboardUrl}`);
	}

	if (!passed || warned) {
		lines.push(
			"Next: View full report above, fix failing cases, or adjust gate with --minScore / --maxDrop / --warnDrop",
		);
	}

	if (
		report.explain &&
		(report.breakdown01 ||
			report.contribPts ||
			report.flags?.length ||
			report.policyEvidence)
	) {
		lines.push("");
		lines.push("--- Explain ---");
		if (report.contribPts) {
			const cp = report.contribPts;
			const pts: string[] = [];
			if (cp.passRatePts != null) pts.push(`passRate: ${cp.passRatePts}`);
			if (cp.safetyPts != null) pts.push(`safety: ${cp.safetyPts}`);
			if (cp.compliancePts != null) pts.push(`compliance: ${cp.compliancePts}`);
			if (cp.performancePts != null)
				pts.push(`performance: ${cp.performancePts}`);
			if (pts.length) lines.push(`Contrib pts: ${pts.join(", ")}`);
		}
		if (report.breakdown01) {
			const b = report.breakdown01;
			const parts: string[] = [];
			if (b.passRate != null) parts.push(`passRate=${b.passRate}`);
			if (b.safety != null) parts.push(`safety=${b.safety}`);
			if (b.judge != null) parts.push(`judge=${b.judge}`);
			if (b.schema != null) parts.push(`schema=${b.schema}`);
			if (b.latency != null) parts.push(`latency=${b.latency}`);
			if (b.cost != null) parts.push(`cost=${b.cost}`);
			if (parts.length) lines.push(`Breakdown: ${parts.join(", ")}`);
		}
		if (report.flags && report.flags.length > 0) {
			lines.push(`Flags: ${report.flags.join(", ")}`);
		}
		if (report.thresholds) {
			const t = report.thresholds;
			const parts: string[] = [];
			if (t.minScore != null) parts.push(`minScore=${t.minScore}`);
			if (t.maxDrop != null) parts.push(`maxDrop=${t.maxDrop}`);
			if (t.minN != null) parts.push(`minN=${t.minN}`);
			if (parts.length) lines.push(`Thresholds: ${parts.join(", ")}`);
		}
		if (report.policyEvidence) {
			const pe = report.policyEvidence;
			lines.push(`Policy sub-check failed: ${pe.failedCheck ?? "unknown"}`);
			if (pe.remediation) lines.push(`Remediation: ${pe.remediation}`);
			if (pe.snapshot && Object.keys(pe.snapshot).length > 0) {
				lines.push(`Snapshot: ${JSON.stringify(pe.snapshot)}`);
			}
		}
	}

	return lines.join("\n");
}
