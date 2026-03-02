/**
 * Reasoning Layer — Score decision quality (did the agent think correctly?).
 *
 * Evaluates the quality of the agent's reasoning process:
 * - Did it use chain-of-thought?
 * - Did it self-correct?
 * - How confident was the reasoning?
 * - Did it acknowledge uncertainty appropriately?
 */

import type { TraceFeatures } from "./trace-feature-extractor";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReasoningLayerScore {
	/** Overall reasoning quality 0-1 */
	score: number;
	/** Whether reasoning evidence was available */
	hasReasoningEvidence: boolean;
	/** Component scores */
	components: {
		chainOfThoughtScore: number;
		selfCritiqueScore: number;
		confidenceScore: number;
		completenessScore: number;
	};
	/** Human-readable breakdown */
	explanation: string;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score reasoning quality from extracted trace features.
 *
 * If no reasoning segments are available (Tier C replay or span without
 * reasoning capture), returns a neutral score with explanation.
 */
export function scoreReasoningLayer(
	features: TraceFeatures,
): ReasoningLayerScore {
	const { reasoningTokens } = features;

	// No reasoning data — return neutral score
	if (reasoningTokens.totalSegments === 0) {
		return {
			score: 0.5,
			hasReasoningEvidence: false,
			components: {
				chainOfThoughtScore: 0.5,
				selfCritiqueScore: 0.5,
				confidenceScore: 0.5,
				completenessScore: 0.5,
			},
			explanation: "No reasoning segments captured — neutral score assigned",
		};
	}

	// Chain of thought score (0-1)
	const chainOfThoughtScore = reasoningTokens.hasChainOfThought ? 1.0 : 0.3;

	// Self-critique score (0-1)
	const selfCritiqueScore = reasoningTokens.hasSelfCritique ? 1.0 : 0.5;

	// Confidence score: high confidence with many segments = good
	let confidenceScore = 0.5;
	if (reasoningTokens.avgConfidence !== null) {
		// Confidence between 0.6-0.9 is ideal; too high (overconfident) or too low is penalized
		const conf = reasoningTokens.avgConfidence;
		if (conf >= 0.6 && conf <= 0.9) {
			confidenceScore = 0.9;
		} else if (conf >= 0.5 && conf < 0.6) {
			confidenceScore = 0.7;
		} else if (conf > 0.9) {
			confidenceScore = 0.75; // slightly penalize overconfidence
		} else {
			confidenceScore = 0.4;
		}
	}

	// Completeness: more diverse reasoning types = more complete thinking
	const typeCount = Object.keys(reasoningTokens.segmentsByType).length;
	const completenessScore = Math.min(1, typeCount * 0.25);

	const score =
		chainOfThoughtScore * 0.4 +
		selfCritiqueScore * 0.2 +
		confidenceScore * 0.25 +
		completenessScore * 0.15;

	const parts: string[] = [];
	if (reasoningTokens.hasChainOfThought) parts.push("CoT present");
	if (reasoningTokens.hasSelfCritique) parts.push("self-critique present");
	if (reasoningTokens.avgConfidence !== null) {
		parts.push(
			`avg confidence: ${(reasoningTokens.avgConfidence * 100).toFixed(0)}%`,
		);
	}
	parts.push(
		`${reasoningTokens.totalSegments} segment(s), ${typeCount} type(s)`,
	);

	return {
		score: Math.min(1, Math.max(0, score)),
		hasReasoningEvidence: true,
		components: {
			chainOfThoughtScore,
			selfCritiqueScore,
			confidenceScore,
			completenessScore,
		},
		explanation: parts.join("; "),
	};
}
