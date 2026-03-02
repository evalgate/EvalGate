/**
 * Failure Confidence Scoring — Compute and aggregate confidence for failure classifications.
 *
 * Multiple detectors may fire on the same trace. This module aggregates
 * their signals into a single confidence score using weighted combination.
 */

import type { FailureCategory } from "./taxonomy";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DetectorSignal {
	/** Detector that produced this signal */
	detectorId: string;
	/** Weight of this detector's opinion (0-1) */
	weight: number;
	/** Predicted category */
	category: FailureCategory;
	/** Raw confidence from this detector (0-1) */
	rawConfidence: number;
	/** Evidence text */
	evidence?: string;
}

export interface AggregatedConfidence {
	/** Winning category */
	category: FailureCategory;
	/** Final confidence (0-1) */
	confidence: number;
	/** How many detectors agreed */
	agreementCount: number;
	/** Total detectors that fired */
	totalDetectors: number;
	/** Agreement ratio (0-1) */
	agreementRatio: number;
	/** All per-category scores */
	scores: Record<string, number>;
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregate multiple detector signals into a single confidence score.
 *
 * Uses weighted voting: each detector's confidence is multiplied by its
 * weight. The category with the highest weighted score wins.
 *
 * If no signals are provided, returns null.
 */
export function aggregateDetectorSignals(
	signals: DetectorSignal[],
): AggregatedConfidence | null {
	if (signals.length === 0) return null;

	const scores: Record<string, number> = {};
	const weightTotal: Record<string, number> = {};

	for (const signal of signals) {
		const cat = signal.category;
		// Accumulate raw weighted scores — do NOT normalize across categories.
		// This preserves the weight difference: a 0.8-weight detector beats a 0.2-weight
		// detector even at identical rawConfidence values.
		scores[cat] = (scores[cat] ?? 0) + signal.rawConfidence * signal.weight;
		weightTotal[cat] = (weightTotal[cat] ?? 0) + signal.weight;
	}

	// Find winning category using raw weighted sums (preserves weight differences across categories)
	let bestCategory = signals[0]!.category;
	let bestScore = 0;
	for (const [cat, score] of Object.entries(scores)) {
		if (score > bestScore) {
			bestScore = score;
			bestCategory = cat as FailureCategory;
		}
	}

	// Normalize confidence for the winning category: weighted average of rawConfidence values.
	// This is separate from the category comparison above — normalization is correct here
	// because we only need the winning category's own average, not cross-category comparison.
	const winnerWeightTotal = weightTotal[bestCategory] ?? 1;
	const normalizedConfidence =
		winnerWeightTotal > 0 ? (scores[bestCategory] ?? 0) / winnerWeightTotal : 0;

	const agreementCount = signals.filter(
		(s) => s.category === bestCategory,
	).length;

	return {
		category: bestCategory,
		confidence: Math.min(1, normalizedConfidence),
		agreementCount,
		totalDetectors: signals.length,
		agreementRatio: agreementCount / signals.length,
		scores,
	};
}

/**
 * Boost confidence when multiple detectors agree.
 *
 * Base confidence is boosted by up to `boostMax` when all detectors agree.
 */
export function applyAgreementBoost(
	base: number,
	agreementRatio: number,
	boostMax = 0.15,
): number {
	return Math.min(1, base + boostMax * agreementRatio);
}

/**
 * Penalize confidence when evidence is weak (short or generic).
 */
export function applyEvidencePenalty(
	base: number,
	evidence: string | null | undefined,
	penalty = 0.1,
): number {
	if (!evidence || evidence.length < 20) {
		return Math.max(0, base - penalty);
	}
	return base;
}

/**
 * Clamp a confidence value to [0, 1].
 */
export function clampConfidence(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/**
 * Interpret confidence as a human-readable label.
 */
export function confidenceLabel(confidence: number): string {
	if (confidence >= 0.9) return "very high";
	if (confidence >= 0.7) return "high";
	if (confidence >= 0.5) return "medium";
	if (confidence >= 0.3) return "low";
	return "very low";
}
