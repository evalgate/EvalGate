/**
 * Behavioral Drift — Detect shifts in agent reasoning style and tool usage.
 *
 * Extends the existing Z-score quality drift with behavioral signals:
 *   - Reasoning style changes (CoT usage, confidence shifts)
 *   - Tool dependency shifts (new tools, dropped tools, success rate changes)
 *   - Retrieval pattern changes
 *   - Error rate drift
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface BehavioralWindow {
	/** Label for this window (e.g. "last-7d" or "baseline") */
	label: string;
	/** Number of traces in this window */
	traceCount: number;
	/** Fraction of traces that used CoT (0-1) */
	cotUsageRate: number;
	/** Average confidence across reasoning segments (0-1 or null) */
	avgReasoningConfidence: number | null;
	/** Tool usage rates: toolName → fraction of traces that called it */
	toolUsageRates: Record<string, number>;
	/** Average tool success rate (0-1) */
	avgToolSuccessRate: number | null;
	/** Retrieval usage rate (0-1) */
	retrievalRate: number;
	/** Error rate (0-1) */
	errorRate: number;
}

export type DriftSignalType =
	| "cot_usage_drop"
	| "cot_usage_spike"
	| "confidence_drop"
	| "confidence_spike"
	| "tool_dropped"
	| "tool_added"
	| "tool_success_drop"
	| "retrieval_drop"
	| "error_spike";

export interface BehavioralDriftSignal {
	type: DriftSignalType;
	description: string;
	/** Absolute delta */
	delta: number;
	/** Relative change as fraction */
	relativeChange: number;
	severity: "critical" | "high" | "medium" | "low";
}

export interface BehavioralDriftResult {
	/** Whether any significant drift was detected */
	driftDetected: boolean;
	/** Individual drift signals */
	signals: BehavioralDriftSignal[];
	/** Overall drift severity */
	overallSeverity: "critical" | "high" | "medium" | "low" | "none";
	/** Baseline window label */
	baselineLabel: string;
	/** Current window label */
	currentLabel: string;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
	cotUsageDrop: 0.2,
	cotUsageSpike: 0.3,
	confidenceDrop: 0.1,
	confidenceSpike: 0.15,
	toolSuccessDrop: 0.15,
	retrievalDrop: 0.25,
	errorSpike: 0.1,
	toolUsageChangeDrop: 0.3,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityFromDelta(delta: number): BehavioralDriftSignal["severity"] {
	const abs = Math.abs(delta);
	if (abs >= 0.4) return "critical";
	if (abs >= 0.25) return "high";
	if (abs >= 0.1) return "medium";
	return "low";
}

// ── Core detector ─────────────────────────────────────────────────────────────

/**
 * Compare two behavioral windows and detect drift signals.
 */
export function detectBehavioralDrift(
	baseline: BehavioralWindow,
	current: BehavioralWindow,
): BehavioralDriftResult {
	const signals: BehavioralDriftSignal[] = [];

	// CoT usage drift
	const cotDelta = current.cotUsageRate - baseline.cotUsageRate;
	if (cotDelta < -THRESHOLDS.cotUsageDrop) {
		signals.push({
			type: "cot_usage_drop",
			description: `Chain-of-thought usage dropped from ${(baseline.cotUsageRate * 100).toFixed(0)}% to ${(current.cotUsageRate * 100).toFixed(0)}%`,
			delta: cotDelta,
			relativeChange:
				baseline.cotUsageRate > 0 ? cotDelta / baseline.cotUsageRate : -1,
			severity: severityFromDelta(cotDelta),
		});
	} else if (cotDelta > THRESHOLDS.cotUsageSpike) {
		signals.push({
			type: "cot_usage_spike",
			description: `Chain-of-thought usage jumped from ${(baseline.cotUsageRate * 100).toFixed(0)}% to ${(current.cotUsageRate * 100).toFixed(0)}%`,
			delta: cotDelta,
			relativeChange:
				baseline.cotUsageRate > 0 ? cotDelta / baseline.cotUsageRate : 1,
			severity: "low",
		});
	}

	// Confidence drift
	if (
		baseline.avgReasoningConfidence !== null &&
		current.avgReasoningConfidence !== null
	) {
		const confDelta =
			current.avgReasoningConfidence - baseline.avgReasoningConfidence;
		if (confDelta < -THRESHOLDS.confidenceDrop) {
			signals.push({
				type: "confidence_drop",
				description: `Avg reasoning confidence dropped from ${(baseline.avgReasoningConfidence * 100).toFixed(0)}% to ${(current.avgReasoningConfidence * 100).toFixed(0)}%`,
				delta: confDelta,
				relativeChange: confDelta / baseline.avgReasoningConfidence,
				severity: severityFromDelta(confDelta),
			});
		}
	}

	// Tool drops / additions
	const baselineTools = new Set(Object.keys(baseline.toolUsageRates));
	const currentTools = new Set(Object.keys(current.toolUsageRates));

	for (const tool of baselineTools) {
		const baseRate = baseline.toolUsageRates[tool] ?? 0;
		const currRate = current.toolUsageRates[tool] ?? 0;
		if (
			baseRate > 0.1 &&
			currRate < baseRate - THRESHOLDS.toolUsageChangeDrop
		) {
			signals.push({
				type: "tool_dropped",
				description: `Tool "${tool}" usage dropped from ${(baseRate * 100).toFixed(0)}% to ${(currRate * 100).toFixed(0)}%`,
				delta: currRate - baseRate,
				relativeChange: (currRate - baseRate) / baseRate,
				severity: severityFromDelta(currRate - baseRate),
			});
		}
	}

	for (const tool of currentTools) {
		if (!baselineTools.has(tool) && (current.toolUsageRates[tool] ?? 0) > 0.1) {
			signals.push({
				type: "tool_added",
				description: `New tool "${tool}" appeared in ${(current.toolUsageRates[tool]! * 100).toFixed(0)}% of traces`,
				delta: current.toolUsageRates[tool]!,
				relativeChange: 1,
				severity: "low",
			});
		}
	}

	// Tool success rate drift
	if (
		baseline.avgToolSuccessRate !== null &&
		current.avgToolSuccessRate !== null
	) {
		const successDelta =
			current.avgToolSuccessRate - baseline.avgToolSuccessRate;
		if (successDelta < -THRESHOLDS.toolSuccessDrop) {
			signals.push({
				type: "tool_success_drop",
				description: `Avg tool success rate dropped from ${(baseline.avgToolSuccessRate * 100).toFixed(0)}% to ${(current.avgToolSuccessRate * 100).toFixed(0)}%`,
				delta: successDelta,
				relativeChange: successDelta / baseline.avgToolSuccessRate,
				severity: severityFromDelta(successDelta),
			});
		}
	}

	// Retrieval drop
	const retrievalDelta = current.retrievalRate - baseline.retrievalRate;
	if (
		baseline.retrievalRate > 0.05 &&
		retrievalDelta < -THRESHOLDS.retrievalDrop
	) {
		signals.push({
			type: "retrieval_drop",
			description: `Retrieval usage dropped from ${(baseline.retrievalRate * 100).toFixed(0)}% to ${(current.retrievalRate * 100).toFixed(0)}%`,
			delta: retrievalDelta,
			relativeChange: retrievalDelta / baseline.retrievalRate,
			severity: severityFromDelta(retrievalDelta),
		});
	}

	// Error spike
	const errorDelta = current.errorRate - baseline.errorRate;
	if (errorDelta > THRESHOLDS.errorSpike) {
		signals.push({
			type: "error_spike",
			description: `Error rate increased from ${(baseline.errorRate * 100).toFixed(0)}% to ${(current.errorRate * 100).toFixed(0)}%`,
			delta: errorDelta,
			relativeChange:
				baseline.errorRate > 0 ? errorDelta / baseline.errorRate : 1,
			severity: severityFromDelta(errorDelta),
		});
	}

	const driftDetected = signals.length > 0;
	const severities = signals.map((s) => s.severity);
	const overallSeverity = driftDetected
		? severities.includes("critical")
			? "critical"
			: severities.includes("high")
				? "high"
				: severities.includes("medium")
					? "medium"
					: "low"
		: "none";

	return {
		driftDetected,
		signals,
		overallSeverity,
		baselineLabel: baseline.label,
		currentLabel: current.label,
	};
}
