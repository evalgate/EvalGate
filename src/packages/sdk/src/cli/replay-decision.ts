/**
 * Replay decision logic for normalized budget evaluation
 * Compares pass rates (corrected when available) within budget constraints
 */

export interface ReplayDecision {
	action: "keep" | "discard";
	reason: "pass_rate_improved" | "pass_rate_declined" | "budget_exceeded";
	previousPassRate: number;
	newPassRate: number;
	previousCorrectedPassRate: number | null; // null if judge too weak
	newCorrectedPassRate: number | null;
	comparisonBasis: "corrected" | "raw"; // which was actually used
	budgetUsed: number;
	budgetLimit: number;
}

export interface RunResultWithCorrected {
	summary: {
		passRate: number;
		correctedPassRate?: number | null;
		totalCostUsd?: number;
	};
	results: Array<any>;
}

export interface NormalizedBudgetConfig {
	mode: "traces" | "cost";
	maxTraces?: number;
	maxCostUsd?: number;
}

/**
 * Evaluate replay outcome based on pass rate improvement and budget compliance
 * Uses corrected pass rates when available, falls back to raw rates
 */
export function evaluateReplayOutcome(
	previousRun: RunResultWithCorrected,
	newRun: RunResultWithCorrected,
	budgetConfig: NormalizedBudgetConfig,
): ReplayDecision {
	// Calculate budget usage
	const budgetUsed =
		budgetConfig.mode === "traces"
			? newRun.results.length
			: newRun.summary.totalCostUsd || 0;

	const budgetLimit =
		budgetConfig.mode === "traces"
			? budgetConfig.maxTraces!
			: budgetConfig.maxCostUsd!;

	// Check budget first - budget exceeded always discards
	if (budgetUsed > budgetLimit) {
		return {
			action: "discard",
			reason: "budget_exceeded",
			previousPassRate: previousRun.summary.passRate,
			newPassRate: newRun.summary.passRate,
			previousCorrectedPassRate: previousRun.summary.correctedPassRate ?? null,
			newCorrectedPassRate: newRun.summary.correctedPassRate ?? null,
			comparisonBasis: determineComparisonBasis(
				previousRun.summary.correctedPassRate,
				newRun.summary.correctedPassRate,
			),
			budgetUsed,
			budgetLimit,
		};
	}

	// Determine which rates to use for comparison
	const comparisonBasis = determineComparisonBasis(
		previousRun.summary.correctedPassRate,
		newRun.summary.correctedPassRate,
	);

	const previousRate =
		comparisonBasis === "corrected"
			? (previousRun.summary.correctedPassRate ?? previousRun.summary.passRate)
			: previousRun.summary.passRate;

	const newRate =
		comparisonBasis === "corrected"
			? (newRun.summary.correctedPassRate ?? newRun.summary.passRate)
			: newRun.summary.passRate;

	// Make keep/discard decision based on pass rate improvement
	if (newRate > previousRate) {
		return {
			action: "keep",
			reason: "pass_rate_improved",
			previousPassRate: previousRun.summary.passRate,
			newPassRate: newRun.summary.passRate,
			previousCorrectedPassRate: previousRun.summary.correctedPassRate ?? null,
			newCorrectedPassRate: newRun.summary.correctedPassRate ?? null,
			comparisonBasis,
			budgetUsed,
			budgetLimit,
		};
	}

	return {
		action: "discard",
		reason: "pass_rate_declined",
		previousPassRate: previousRun.summary.passRate,
		newPassRate: newRun.summary.passRate,
		previousCorrectedPassRate: previousRun.summary.correctedPassRate ?? null,
		newCorrectedPassRate: newRun.summary.correctedPassRate ?? null,
		comparisonBasis,
		budgetUsed,
		budgetLimit,
	};
}

/**
 * Determine whether to use corrected or raw pass rates for comparison
 * Uses corrected rates when both runs have them, otherwise falls back to raw
 */
function determineComparisonBasis(
	previousCorrected: number | null | undefined,
	newCorrected: number | null | undefined,
): "corrected" | "raw" {
	// Use corrected rates if both runs have them (judge not too weak)
	if (
		previousCorrected !== null &&
		previousCorrected !== undefined &&
		newCorrected !== null &&
		newCorrected !== undefined
	) {
		return "corrected";
	}

	// Fall back to raw rates if correction was skipped for either run
	return "raw";
}
