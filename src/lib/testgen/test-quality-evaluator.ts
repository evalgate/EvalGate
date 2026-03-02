/**
 * Test Quality Evaluator — Score auto-generated tests for usefulness.
 *
 * Without quality gates, generated test datasets bloat with low-signal tests,
 * making eval runtimes expensive and gate results untrustworthy.
 *
 * Scores three dimensions:
 *   - Quality (0-100): Is the test well-formed and specific?
 *   - Usefulness (0-100): Does it test a real, distinct behavior?
 *   - False-positive risk (0-1): Could it flag correct outputs incorrectly?
 */

import type { EvalCase } from "@/lib/testcases/spec";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TestQualityScore {
	/** Overall quality 0-100 */
	qualityScore: number;
	/** How useful this test is for catching real failures 0-100 */
	usefulnessScore: number;
	/** Estimated false-positive rate 0-1 (higher = more risky) */
	falsePositiveRisk: number;
	/** Composite score 0-100 (weighted combination) */
	compositeScore: number;
	/** Breakdown of individual signals */
	signals: QualitySignal[];
	/** Human-readable verdict */
	verdict: "high" | "medium" | "low" | "reject";
	/** Recommended action */
	recommendation: string;
}

export interface QualitySignal {
	dimension: string;
	score: number;
	weight: number;
	explanation: string;
}

// ── Scoring weights ───────────────────────────────────────────────────────────

const QUALITY_WEIGHT = 0.35;
const USEFULNESS_WEIGHT = 0.45;
const FP_RISK_WEIGHT = 0.2;

// ── Signal extractors ─────────────────────────────────────────────────────────

function scoreTitleQuality(evalCase: EvalCase): QualitySignal {
	const title = evalCase.title;
	let score = 50;

	if (title.length > 20) score += 20;
	if (title.length > 50) score += 10;
	if (!title.startsWith("Auto-generated")) score += 10;
	if (evalCase.tags.length > 1) score += 10;
	if (title.includes("[") && title.includes("]")) score += 10;

	return {
		dimension: "title_quality",
		score: Math.min(100, score),
		weight: 0.2,
		explanation: `Title length: ${title.length} chars, ${evalCase.tags.length} tag(s)`,
	};
}

function scoreConstraintSpecificity(evalCase: EvalCase): QualitySignal {
	const constraints = evalCase.expectedConstraints;
	let score = 0;

	if (constraints.length === 0) {
		return {
			dimension: "constraint_specificity",
			score: 10,
			weight: 0.3,
			explanation: "No expected constraints — test cannot fail",
		};
	}

	score += Math.min(60, constraints.length * 20);

	const hasHardGate = constraints.some((c) => c.required);
	if (hasHardGate) score += 20;

	const hasSpecificConstraint = constraints.some(
		(c) => c.type !== "score_gte" && c.type !== "custom",
	);
	if (hasSpecificConstraint) score += 20;

	return {
		dimension: "constraint_specificity",
		score: Math.min(100, score),
		weight: 0.3,
		explanation: `${constraints.length} constraint(s), hard gate: ${hasHardGate}`,
	};
}

function scoreContextRichness(evalCase: EvalCase): QualitySignal {
	let score = 20;

	if (evalCase.sourceTraceIds.length > 0) score += 20;
	if (evalCase.frozenSnapshotRef) score += 30;
	if (evalCase.replayTier === "A" || evalCase.replayTier === "B") score += 20;
	if (evalCase.rubricRef) score += 10;

	return {
		dimension: "context_richness",
		score: Math.min(100, score),
		weight: 0.25,
		explanation: `Snapshot: ${!!evalCase.frozenSnapshotRef}, Replay tier: ${evalCase.replayTier ?? "none"}, Rubric: ${!!evalCase.rubricRef}`,
	};
}

function scoreTagDiversity(evalCase: EvalCase): QualitySignal {
	const tags = evalCase.tags;
	let score = 30;

	// More specific (non-generic) tags = more useful
	const genericTags = new Set([
		"auto-generated",
		"has-system-prompt",
		"multi-turn",
	]);
	const specificTags = tags.filter((t) => !genericTags.has(t));

	score += Math.min(50, specificTags.length * 15);
	if (tags.some((t) => t.startsWith("severity:"))) score += 20;

	return {
		dimension: "tag_diversity",
		score: Math.min(100, score),
		weight: 0.25,
		explanation: `${tags.length} total tags, ${specificTags.length} specific tag(s)`,
	};
}

function estimateFalsePositiveRisk(evalCase: EvalCase): number {
	let risk = 0.1; // base risk

	const constraints = evalCase.expectedConstraints;

	// Very strict score threshold with no context = high FP risk
	const hasHighScoreThreshold = constraints.some(
		(c) =>
			c.type === "score_gte" && typeof c.value === "number" && c.value >= 0.9,
	);
	if (hasHighScoreThreshold) risk += 0.3;

	// Missing snapshot = can't deterministically replay = higher FP risk
	if (!evalCase.frozenSnapshotRef) risk += 0.2;

	// Only score constraints (no behavioral) = high FP risk
	const onlyScoreConstraints = constraints.every(
		(c) => c.type === "score_gte" || c.type === "score_lte",
	);
	if (onlyScoreConstraints && constraints.length > 0) risk += 0.2;

	// Very short title = vague test = higher FP risk
	if (evalCase.title.length < 20) risk += 0.15;

	return Math.min(1, risk);
}

// ── Core evaluator ────────────────────────────────────────────────────────────

/**
 * Score an auto-generated EvalCase for quality and usefulness.
 */
export function evaluateTestQuality(evalCase: EvalCase): TestQualityScore {
	const signals: QualitySignal[] = [
		scoreTitleQuality(evalCase),
		scoreConstraintSpecificity(evalCase),
		scoreContextRichness(evalCase),
		scoreTagDiversity(evalCase),
	];

	const qualityScore = Math.round(
		signals.reduce((sum, s) => sum + s.score * s.weight, 0),
	);

	// Usefulness = quality adjusted for context richness
	const contextSignal = signals.find(
		(s) => s.dimension === "context_richness",
	)!;
	const constraintSignal = signals.find(
		(s) => s.dimension === "constraint_specificity",
	)!;
	const usefulnessScore = Math.round(
		contextSignal.score * 0.5 + constraintSignal.score * 0.5,
	);

	const falsePositiveRisk = estimateFalsePositiveRisk(evalCase);

	const compositeScore = Math.round(
		qualityScore * QUALITY_WEIGHT +
			usefulnessScore * USEFULNESS_WEIGHT +
			(1 - falsePositiveRisk) * 100 * FP_RISK_WEIGHT,
	);

	let verdict: TestQualityScore["verdict"];
	let recommendation: string;

	if (compositeScore >= 75) {
		verdict = "high";
		recommendation = "Ready to promote from quarantine after human review";
	} else if (compositeScore >= 50) {
		verdict = "medium";
		recommendation =
			"Add more specific constraints or attach frozen snapshot before promoting";
	} else if (compositeScore >= 30) {
		verdict = "low";
		recommendation = "Improve test specificity or merge with related test case";
	} else {
		verdict = "reject";
		recommendation =
			"Reject — too vague to be useful, or high false-positive risk";
	}

	return {
		qualityScore,
		usefulnessScore,
		falsePositiveRisk,
		compositeScore,
		signals,
		verdict,
		recommendation,
	};
}

/**
 * Filter a list of cases, returning only those meeting the minimum quality threshold.
 */
export function filterByQuality(
	cases: EvalCase[],
	minCompositeScore = 30,
): {
	passing: EvalCase[];
	rejected: EvalCase[];
	scores: Map<string, TestQualityScore>;
} {
	const scores = new Map<string, TestQualityScore>();
	const passing: EvalCase[] = [];
	const rejected: EvalCase[] = [];

	for (const c of cases) {
		const score = evaluateTestQuality(c);
		scores.set(c.id, score);
		if (score.compositeScore >= minCompositeScore) {
			passing.push(c);
		} else {
			rejected.push(c);
		}
	}

	return { passing, rejected, scores };
}
