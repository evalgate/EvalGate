/**
 * Outcome Layer — Score end-result success (did the user get what they needed?).
 *
 * Prevents Goodhart's Law: agents that reason badly + act oddly but still
 * succeed should not be penalized. This layer focuses on the final result
 * meeting the stated objective, not the path taken.
 *
 * Inputs: test case constraints, assertion results, human-specified criteria.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AssertionOutcome {
	assertionKey: string;
	passed: boolean;
	score: number | null;
	severity: "critical" | "high" | "medium" | "low";
	required: boolean;
}

export interface OutcomeLayerInput {
	/** Assertion results from the eval run */
	assertionOutcomes: AssertionOutcome[];
	/** Final output string from the agent (for heuristic checks) */
	finalOutput: string | null;
	/** Whether the trace completed without fatal error */
	completedSuccessfully: boolean;
}

export interface OutcomeLayerScore {
	/** Overall outcome quality 0-1 */
	score: number;
	/** Whether any required assertion failed (hard gate) */
	hardGateFailed: boolean;
	/** Blocked by critical assertion failure */
	criticalFailed: boolean;
	/** Component scores */
	components: {
		assertionScore: number;
		completionScore: number;
		hardGateScore: number;
	};
	/** Individual assertion contributions */
	failedAssertions: string[];
	/** Human-readable breakdown */
	explanation: string;
}

// ── Severity weights ──────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<AssertionOutcome["severity"], number> = {
	critical: 2.0,
	high: 1.5,
	medium: 1.0,
	low: 0.5,
};

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score the outcome layer.
 */
export function scoreOutcomeLayer(input: OutcomeLayerInput): OutcomeLayerScore {
	const { assertionOutcomes, completedSuccessfully } = input;

	// Completion score
	const completionScore = completedSuccessfully ? 1.0 : 0.1;

	// Assertion score (weighted by severity)
	let totalWeight = 0;
	let weightedScore = 0;
	const failedAssertions: string[] = [];

	let hardGateFailed = false;
	let criticalFailed = false;

	for (const outcome of assertionOutcomes) {
		const weight = SEVERITY_WEIGHT[outcome.severity];
		totalWeight += weight;

		const outcomeScore = outcome.score ?? (outcome.passed ? 1.0 : 0.0);
		weightedScore += outcomeScore * weight;

		if (!outcome.passed) {
			failedAssertions.push(outcome.assertionKey);
			if (outcome.required) hardGateFailed = true;
			if (outcome.severity === "critical") criticalFailed = true;
		}
	}

	const assertionScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;

	// Hard gate score: if any required assertion failed, score is capped at 0.4
	const hardGateScore = hardGateFailed ? 0.0 : 1.0;
	const criticalCap = criticalFailed ? 0.2 : 1.0;

	const rawScore =
		assertionScore * 0.6 + completionScore * 0.3 + hardGateScore * 0.1;

	const score = Math.min(
		criticalCap,
		hardGateFailed ? Math.min(0.4, rawScore) : rawScore,
	);

	const parts: string[] = [];
	parts.push(`completion: ${completedSuccessfully ? "OK" : "FAILED"}`);
	if (assertionOutcomes.length > 0) {
		const passed = assertionOutcomes.filter((a) => a.passed).length;
		parts.push(`assertions: ${passed}/${assertionOutcomes.length} passed`);
	}
	if (failedAssertions.length > 0) {
		parts.push(`failed: ${failedAssertions.slice(0, 3).join(", ")}`);
	}

	return {
		score: Math.min(1, Math.max(0, score)),
		hardGateFailed,
		criticalFailed,
		components: {
			assertionScore,
			completionScore,
			hardGateScore,
		},
		failedAssertions,
		explanation: parts.join("; "),
	};
}

/**
 * Combine the three-layer scores into a final composite.
 *
 * Weights: Outcome 50%, Action 30%, Reasoning 20%.
 * Outcome dominates because the end result is what users care about most.
 * Hard gate failure caps the composite at 0.4.
 */
export function combineThreeLayerScores(
	reasoning: number,
	action: number,
	outcome: number,
	hardGateFailed: boolean,
	weights = { reasoning: 0.2, action: 0.3, outcome: 0.5 },
): number {
	const composite =
		reasoning * weights.reasoning +
		action * weights.action +
		outcome * weights.outcome;

	return Math.min(
		1,
		Math.max(0, hardGateFailed ? Math.min(0.4, composite) : composite),
	);
}
