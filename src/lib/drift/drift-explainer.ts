/**
 * Drift Explainer — Explain what changed, why it matters, and suggest a fix.
 *
 * Turns raw drift signals into actionable human-readable explanations.
 * "Detection without explanation is weak" — Phase 7 design principle.
 */

import type {
	BehavioralDriftResult,
	BehavioralDriftSignal,
} from "./behavioral-drift";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DriftExplanation {
	/** One-line headline */
	headline: string;
	/** Detailed explanation of what changed */
	whatChanged: string;
	/** Why this matters for evaluation quality */
	whyItMatters: string;
	/** Actionable suggested fix */
	suggestedFix: string;
	/** Urgency based on severity */
	urgency: "immediate" | "soon" | "monitor" | "informational";
	/** Relevant documentation link or reference */
	reference: string | null;
}

export interface FullDriftReport {
	/** Whether to escalate this drift event */
	requiresAction: boolean;
	/** Summary for Slack/CI notification */
	notificationSummary: string;
	/** Per-signal explanations */
	explanations: DriftExplanation[];
	/** Recommended actions (ordered by priority) */
	recommendations: string[];
}

// ── Signal → explanation mapping ──────────────────────────────────────────────

const SIGNAL_EXPLANATIONS: Record<
	BehavioralDriftSignal["type"],
	(signal: BehavioralDriftSignal) => DriftExplanation
> = {
	cot_usage_drop: (s) => ({
		headline: "Chain-of-thought reasoning dropped",
		whatChanged: s.description,
		whyItMatters:
			"Reduced CoT usage often precedes accuracy regressions. The model may be taking shortcuts that produce correct-looking but less-reliable outputs.",
		suggestedFix:
			"Check if the system prompt or temperature changed. Re-evaluate recent prompt edits. Consider running a targeted CoT evaluation dataset.",
		urgency: Math.abs(s.delta) >= 0.3 ? "immediate" : "soon",
		reference: "https://docs.evalgate.dev/drift/cot-regression",
	}),

	cot_usage_spike: (s) => ({
		headline: "Chain-of-thought usage increased significantly",
		whatChanged: s.description,
		whyItMatters:
			"Unexpected CoT increase may indicate the model is struggling with tasks that were previously straightforward. Could also be a prompt change.",
		suggestedFix:
			"Review recent prompt changes. Monitor latency and cost — CoT increases token usage.",
		urgency: "informational",
		reference: null,
	}),

	confidence_drop: (s) => ({
		headline: "Agent reasoning confidence declined",
		whatChanged: s.description,
		whyItMatters:
			"Lower reasoning confidence correlates with higher error rates and more hallucinations. The model may be encountering unfamiliar inputs.",
		suggestedFix:
			"Review the input distribution — are new topics or formats being sent? Check if the knowledge base or context window changed.",
		urgency: Math.abs(s.delta) >= 0.2 ? "soon" : "monitor",
		reference: null,
	}),

	confidence_spike: (s) => ({
		headline: "Agent reasoning confidence spiked",
		whatChanged: s.description,
		whyItMatters:
			"Overconfident reasoning can mask failures. Review recent outputs for confident-sounding but incorrect responses.",
		suggestedFix: "Run a hallucination detection pass on recent outputs.",
		urgency: "monitor",
		reference: null,
	}),

	tool_dropped: (s) => ({
		headline: "Tool usage significantly reduced",
		whatChanged: s.description,
		whyItMatters:
			"A tool being underused may indicate it's broken, its schema changed, or the model stopped calling it due to a prompt change. This can silently degrade outcomes.",
		suggestedFix:
			"Check tool schema for breaking changes. Run the tool directly to verify it's working. Review prompt changes that may have removed tool descriptions.",
		urgency: "soon",
		reference: null,
	}),

	tool_added: (s) => ({
		headline: "New tool appeared in production traces",
		whatChanged: s.description,
		whyItMatters:
			"An unexpected new tool appearing could indicate a configuration change or a model probing for tools it wasn't given.",
		suggestedFix:
			"Verify the tool is intentional and properly configured. Add it to the evaluation dataset.",
		urgency: "informational",
		reference: null,
	}),

	tool_success_drop: (s) => ({
		headline: "Tool success rate degraded",
		whatChanged: s.description,
		whyItMatters:
			"Tool failures cause agent re-planning or fallbacks, which often produce worse outcomes and higher costs.",
		suggestedFix:
			"Check tool API health. Review error logs. If tool schema changed, update the model's tool description.",
		urgency: Math.abs(s.delta) >= 0.25 ? "immediate" : "soon",
		reference: null,
	}),

	retrieval_drop: (s) => ({
		headline: "Retrieval usage dropped",
		whatChanged: s.description,
		whyItMatters:
			"Lower retrieval usage means the model may be answering from parametric memory instead of grounded documents — risk of hallucination increases.",
		suggestedFix:
			"Check retrieval pipeline health (embedding service, vector store). Verify retrieval is triggered for the right query types.",
		urgency: "soon",
		reference: null,
	}),

	error_spike: (s) => ({
		headline: "Error rate spiked",
		whatChanged: s.description,
		whyItMatters:
			"An increasing error rate means more user-facing failures and degraded evaluation reliability. Evaluation gates may start producing false negatives.",
		suggestedFix:
			"Check infrastructure health. Review error logs for patterns. If errors are tool-related, check tool APIs.",
		urgency: Math.abs(s.delta) >= 0.2 ? "immediate" : "soon",
		reference: null,
	}),
};

// ── Core explainer ────────────────────────────────────────────────────────────

/**
 * Generate a full drift report from a behavioral drift result.
 */
export function explainDrift(
	driftResult: BehavioralDriftResult,
): FullDriftReport {
	if (!driftResult.driftDetected) {
		return {
			requiresAction: false,
			notificationSummary: `No significant behavioral drift detected (${driftResult.baselineLabel} → ${driftResult.currentLabel})`,
			explanations: [],
			recommendations: ["Continue monitoring. No action required."],
		};
	}

	const explanations = driftResult.signals.map((signal) => {
		const factory = SIGNAL_EXPLANATIONS[signal.type];
		return factory(signal);
	});

	const requiresAction = explanations.some(
		(e) => e.urgency === "immediate" || e.urgency === "soon",
	);

	const immediateItems = explanations.filter((e) => e.urgency === "immediate");
	const soonItems = explanations.filter((e) => e.urgency === "soon");

	let notificationSummary: string;
	if (immediateItems.length > 0) {
		notificationSummary = `🚨 Behavioral drift detected (${driftResult.overallSeverity.toUpperCase()}): ${immediateItems[0]!.headline}`;
	} else if (soonItems.length > 0) {
		notificationSummary = `⚠️ Behavioral drift detected: ${soonItems[0]!.headline}`;
	} else {
		notificationSummary = `ℹ️ Minor behavioral drift observed: ${driftResult.signals.length} signal(s) detected`;
	}

	// Deduplicated recommendations sorted by urgency
	const urgencyOrder = { immediate: 0, soon: 1, monitor: 2, informational: 3 };
	const sorted = [...explanations].sort(
		(a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency],
	);
	const recommendations = sorted.map(
		(e) => `[${e.urgency.toUpperCase()}] ${e.suggestedFix}`,
	);

	return {
		requiresAction,
		notificationSummary,
		explanations,
		recommendations,
	};
}
