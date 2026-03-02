/**
 * Action Layer — Score observable execution correctness (did it do the right thing?).
 *
 * Evaluates the quality of observable actions: tool calls, function calls,
 * API calls, retrieved documents. Focuses on what the agent DID, not what
 * it said or what outcome occurred.
 */

import type { TraceFeatures } from "./trace-feature-extractor";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActionLayerScore {
	/** Overall action quality 0-1 */
	score: number;
	/** Whether action evidence was available */
	hasActionEvidence: boolean;
	/** Component scores */
	components: {
		toolSuccessRate: number;
		toolDiversityScore: number;
		retrievalQualityScore: number;
		errorPenalty: number;
	};
	/** Human-readable breakdown */
	explanation: string;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score action quality from extracted trace features.
 */
export function scoreActionLayer(features: TraceFeatures): ActionLayerScore {
	const { toolGraph, actionTimeline, retrievalCount, hadError } = features;

	// No actions — return neutral score
	if (actionTimeline.totalTools === 0 && actionTimeline.totalLlmCalls <= 1) {
		return {
			score: 0.5,
			hasActionEvidence: false,
			components: {
				toolSuccessRate: 0.5,
				toolDiversityScore: 0.5,
				retrievalQualityScore: 0.5,
				errorPenalty: 0,
			},
			explanation: "No tool calls or actions observed — neutral score",
		};
	}

	// Tool success rate
	let toolSuccessRate = 0.5;
	if (toolGraph.length > 0) {
		const ratesWithData = toolGraph.filter((t) => t.successRate !== null);
		if (ratesWithData.length > 0) {
			toolSuccessRate =
				ratesWithData.reduce((sum, t) => sum + (t.successRate ?? 0), 0) /
				ratesWithData.length;
		} else {
			toolSuccessRate = 0.75; // no success/fail data = assume mostly ok
		}
	}

	// Tool diversity: using multiple distinct tools = more capable
	const toolDiversityScore =
		toolGraph.length === 0
			? 0.5
			: Math.min(1, 0.4 + (toolGraph.length - 1) * 0.15);

	// Retrieval quality: using retrieval = good signal (can't score quality without results)
	const retrievalQualityScore = retrievalCount > 0 ? 0.8 : 0.5;

	// Error penalty
	const errorPenalty = hadError
		? 0.3
		: actionTimeline.errorCount > 0
			? 0.1 *
				Math.min(
					1,
					actionTimeline.errorCount / Math.max(1, actionTimeline.totalTools),
				)
			: 0;

	const rawScore =
		toolSuccessRate * 0.5 +
		toolDiversityScore * 0.2 +
		retrievalQualityScore * 0.15 +
		(1 - errorPenalty) * 0.15;

	const score = Math.min(1, Math.max(0, rawScore - errorPenalty * 0.3));

	const parts: string[] = [];
	if (toolGraph.length > 0) {
		parts.push(
			`${toolGraph.length} tool(s), success rate ${(toolSuccessRate * 100).toFixed(0)}%`,
		);
	}
	if (retrievalCount > 0) parts.push(`${retrievalCount} retrieval(s)`);
	if (hadError) parts.push("trace error detected");
	if (actionTimeline.errorCount > 0)
		parts.push(`${actionTimeline.errorCount} action error(s)`);

	return {
		score,
		hasActionEvidence: actionTimeline.totalTools > 0,
		components: {
			toolSuccessRate,
			toolDiversityScore,
			retrievalQualityScore,
			errorPenalty,
		},
		explanation: parts.join("; ") || "No actions observed",
	};
}
