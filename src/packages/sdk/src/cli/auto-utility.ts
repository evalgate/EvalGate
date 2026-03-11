import type { AutoDecision, AutoPassRateBasis } from "./auto-ledger";
import type { RunResult } from "./run";

export type AutoNonPlanDecision = Exclude<AutoDecision, "plan">;

export type AutoHardVetoReason =
	| "holdout_regressions"
	| "critical_failure_mode_increase"
	| "latency_ceiling"
	| "cost_ceiling";

export interface AutoRunSummaryLike {
	passRate: number;
	correctedPassRate?: number | null;
}

export interface AutoPassRateResolution {
	passRateBasis: AutoPassRateBasis;
	baselinePassRate: number;
	candidatePassRate: number;
	deltaRatio: number;
}

export interface AutoUtilityInput {
	objectiveReductionRatio: number;
	regressions: number;
	improvements: number;
	holdoutRegressions: number;
	passRateDeltaRatio: number;
	correctedPassRateDeltaRatio: number;
	latencyDeltaRatio: number;
	costDeltaRatio: number;
}

export interface BuildAutoUtilityInputOptions {
	baselineObjectiveRate: number;
	candidateObjectiveRate: number;
	regressions: number;
	improvements: number;
	holdoutRegressions: number;
	passRateDeltaRatio: number;
	correctedPassRateDeltaRatio: number;
	latencyDeltaRatio: number;
	costDeltaRatio: number;
}

export interface AutoUtilityWeights {
	objectiveReductionRatio: number;
	regressions: number;
	improvements: number;
	holdoutRegressions: number;
	passRateDeltaRatio: number;
	correctedPassRateDeltaRatio: number;
	latencyDeltaRatio: number;
	costDeltaRatio: number;
}

export interface AutoUtilityContribution {
	metric: keyof AutoUtilityInput;
	value: number;
	weight: number;
	contribution: number;
}

export interface AutoUtilityResult {
	score: number;
	contributions: AutoUtilityContribution[];
}

export interface AutoHardVetoConfig {
	maxHoldoutRegressions?: number;
	maxCriticalFailureModeIncrease?: number;
	latencyCeiling?: number;
	costCeiling?: number;
}

export interface AutoHardVetoInput {
	holdoutRegressions: number;
	criticalFailureModeIncrease: number;
	latencyDeltaRatio: number;
	costUsd: number;
}

export interface AutoHardVetoResult {
	vetoed: boolean;
	reason: AutoHardVetoReason | null;
	evaluatedRules: AutoHardVetoReason[];
	matchedRule: AutoHardVetoReason | null;
}

export interface AutoUtilityDecisionConfig {
	keepThreshold?: number;
	discardThreshold?: number;
}

export interface AutoUtilityDecisionInput {
	utilityScore: number | null;
	objectiveReductionRatio: number;
	regressions: number;
	improvements: number;
	holdoutRegressions: number;
	veto: AutoHardVetoResult;
}

export interface AutoUtilityDecisionResult {
	decision: AutoNonPlanDecision;
	rationale: string[];
}

const AUTO_UTILITY_METRICS: Array<keyof AutoUtilityInput> = [
	"objectiveReductionRatio",
	"regressions",
	"improvements",
	"holdoutRegressions",
	"passRateDeltaRatio",
	"correctedPassRateDeltaRatio",
	"latencyDeltaRatio",
	"costDeltaRatio",
];

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function assertFiniteNumber(
	value: unknown,
	fieldName: string,
): asserts value is number {
	if (!isFiniteNumber(value)) {
		throw new Error(`${fieldName} must be a finite number`);
	}
}

export function resolvePassRateBasis(
	baselineSummary: AutoRunSummaryLike,
	candidateSummary: AutoRunSummaryLike,
): AutoPassRateResolution {
	assertFiniteNumber(baselineSummary.passRate, "baselineSummary.passRate");
	assertFiniteNumber(candidateSummary.passRate, "candidateSummary.passRate");

	const canUseCorrected =
		isFiniteNumber(baselineSummary.correctedPassRate) &&
		isFiniteNumber(candidateSummary.correctedPassRate);

	const passRateBasis: AutoPassRateBasis = canUseCorrected
		? "corrected"
		: "raw";
	const baselinePassRate = canUseCorrected
		? (baselineSummary.correctedPassRate as number)
		: baselineSummary.passRate;
	const candidatePassRate = canUseCorrected
		? (candidateSummary.correctedPassRate as number)
		: candidateSummary.passRate;

	return {
		passRateBasis,
		baselinePassRate,
		candidatePassRate,
		deltaRatio: candidatePassRate - baselinePassRate,
	};
}

export function resolvePassRateBasisFromRuns(
	baselineRun: Pick<RunResult, "summary">,
	candidateRun: Pick<RunResult, "summary">,
): AutoPassRateResolution {
	return resolvePassRateBasis(baselineRun.summary, candidateRun.summary);
}

export function computeObjectiveReductionRatio(
	baselineObjectiveRate: number,
	candidateObjectiveRate: number,
): number {
	assertFiniteNumber(baselineObjectiveRate, "baselineObjectiveRate");
	assertFiniteNumber(candidateObjectiveRate, "candidateObjectiveRate");
	if (baselineObjectiveRate < 0) {
		throw new Error("baselineObjectiveRate must be greater than or equal to 0");
	}
	if (candidateObjectiveRate < 0) {
		throw new Error(
			"candidateObjectiveRate must be greater than or equal to 0",
		);
	}
	if (baselineObjectiveRate === 0) {
		return candidateObjectiveRate === 0 ? 0 : -candidateObjectiveRate;
	}
	return (
		(baselineObjectiveRate - candidateObjectiveRate) / baselineObjectiveRate
	);
}

export function buildUtilityInput(
	options: BuildAutoUtilityInputOptions,
): AutoUtilityInput {
	const objectiveReductionRatio = computeObjectiveReductionRatio(
		options.baselineObjectiveRate,
		options.candidateObjectiveRate,
	);

	const input: AutoUtilityInput = {
		objectiveReductionRatio,
		regressions: options.regressions,
		improvements: options.improvements,
		holdoutRegressions: options.holdoutRegressions,
		passRateDeltaRatio: options.passRateDeltaRatio,
		correctedPassRateDeltaRatio: options.correctedPassRateDeltaRatio,
		latencyDeltaRatio: options.latencyDeltaRatio,
		costDeltaRatio: options.costDeltaRatio,
	};

	for (const metric of AUTO_UTILITY_METRICS) {
		assertFiniteNumber(input[metric], `utilityInput.${metric}`);
	}

	return input;
}

export function computeUtility(
	input: AutoUtilityInput,
	weights: AutoUtilityWeights,
): AutoUtilityResult {
	const contributions = AUTO_UTILITY_METRICS.map((metric) => {
		const value = input[metric];
		const weight = weights[metric];
		assertFiniteNumber(value, `utilityInput.${metric}`);
		assertFiniteNumber(weight, `utilityWeights.${metric}`);
		return {
			metric,
			value,
			weight,
			contribution: value * weight,
		};
	});

	return {
		score: contributions.reduce(
			(total, contribution) => total + contribution.contribution,
			0,
		),
		contributions,
	};
}

export function evaluateHardVetoes(
	input: AutoHardVetoInput,
	config: AutoHardVetoConfig = {},
): AutoHardVetoResult {
	assertFiniteNumber(
		input.holdoutRegressions,
		"hardVetoInput.holdoutRegressions",
	);
	assertFiniteNumber(
		input.criticalFailureModeIncrease,
		"hardVetoInput.criticalFailureModeIncrease",
	);
	assertFiniteNumber(
		input.latencyDeltaRatio,
		"hardVetoInput.latencyDeltaRatio",
	);
	assertFiniteNumber(input.costUsd, "hardVetoInput.costUsd");

	const evaluatedRules: AutoHardVetoReason[] = [
		"holdout_regressions",
		"critical_failure_mode_increase",
		"latency_ceiling",
		"cost_ceiling",
	];

	const maxHoldoutRegressions = config.maxHoldoutRegressions ?? 0;
	if (input.holdoutRegressions > maxHoldoutRegressions) {
		return {
			vetoed: true,
			reason: "holdout_regressions",
			evaluatedRules,
			matchedRule: "holdout_regressions",
		};
	}

	const maxCriticalFailureModeIncrease =
		config.maxCriticalFailureModeIncrease ?? 0;
	if (input.criticalFailureModeIncrease > maxCriticalFailureModeIncrease) {
		return {
			vetoed: true,
			reason: "critical_failure_mode_increase",
			evaluatedRules,
			matchedRule: "critical_failure_mode_increase",
		};
	}

	if (
		config.latencyCeiling !== undefined &&
		input.latencyDeltaRatio > config.latencyCeiling
	) {
		return {
			vetoed: true,
			reason: "latency_ceiling",
			evaluatedRules,
			matchedRule: "latency_ceiling",
		};
	}

	if (config.costCeiling !== undefined && input.costUsd > config.costCeiling) {
		return {
			vetoed: true,
			reason: "cost_ceiling",
			evaluatedRules,
			matchedRule: "cost_ceiling",
		};
	}

	return {
		vetoed: false,
		reason: null,
		evaluatedRules,
		matchedRule: null,
	};
}

export function decideAutoUtilityOutcome(
	input: AutoUtilityDecisionInput,
	config: AutoUtilityDecisionConfig = {},
): AutoUtilityDecisionResult {
	const keepThreshold = config.keepThreshold ?? 0;
	const discardThreshold = config.discardThreshold ?? 0;
	const rationale: string[] = [];

	if (input.veto.vetoed) {
		rationale.push(`Hard veto matched: ${input.veto.reason}.`);
		return {
			decision: "vetoed",
			rationale,
		};
	}

	if (input.utilityScore === null) {
		rationale.push(
			"Utility score is unavailable, so the result requires human review.",
		);
		return {
			decision: "investigate",
			rationale,
		};
	}

	assertFiniteNumber(input.utilityScore, "utilityScore");
	assertFiniteNumber(input.objectiveReductionRatio, "objectiveReductionRatio");
	assertFiniteNumber(input.regressions, "regressions");
	assertFiniteNumber(input.improvements, "improvements");
	assertFiniteNumber(input.holdoutRegressions, "holdoutRegressions");

	if (input.objectiveReductionRatio < 0) {
		rationale.push("The candidate moved the objective in the wrong direction.");
		return {
			decision: "discard",
			rationale,
		};
	}

	if (
		input.utilityScore >= keepThreshold &&
		input.regressions === 0 &&
		input.holdoutRegressions === 0 &&
		input.objectiveReductionRatio >= 0
	) {
		rationale.push("Utility is positive and no regressions were detected.");
		return {
			decision: "keep",
			rationale,
		};
	}

	if (
		input.utilityScore < discardThreshold ||
		(input.regressions > input.improvements && input.regressions > 0)
	) {
		rationale.push(
			"Utility is not competitive or regressions outweigh improvements.",
		);
		return {
			decision: "discard",
			rationale,
		};
	}

	rationale.push(
		"The candidate is directionally interesting but still needs review.",
	);
	return {
		decision: "investigate",
		rationale,
	};
}
