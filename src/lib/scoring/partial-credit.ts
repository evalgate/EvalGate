/**
 * Partial Credit Scoring — rubric-based multi-dimension evaluation.
 *
 * Instead of binary pass/fail, each dimension of a rubric can award
 * full, partial, or zero credit. The overall score is a weighted sum
 * of per-dimension scores, normalised to 0-1.
 *
 * Supports: binary, scalar, and tier-based dimension scoring.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** How a single rubric dimension is scored */
export type DimensionScoringMode =
	| "binary" // 0 or 1 only
	| "scalar" // any value in [0, 1]
	| "tiered"; // maps a label to a predefined score

/** A single rubric dimension definition */
export interface RubricDimension {
	/** Unique identifier within the rubric */
	id: string;
	/** Human-readable label */
	label: string;
	/** Relative importance weight (will be normalised internally) */
	weight: number;
	/** Scoring mode */
	mode: DimensionScoringMode;
	/** For tiered mode: ordered tier labels → fractional scores */
	tiers?: TierDefinition[];
	/** Optional description / evaluator guidance */
	description?: string;
}

export interface TierDefinition {
	label: string;
	/** Fractional score for this tier (0-1) */
	score: number;
}

/** A rubric is an ordered set of dimensions */
export interface Rubric {
	id: string;
	name: string;
	dimensions: RubricDimension[];
}

/** Raw score input for a single dimension */
export interface DimensionScore {
	dimensionId: string;
	/** Raw score value (0-1 for binary/scalar; tier label string for tiered) */
	value: number | string;
	/** Optional evaluator reasoning */
	reasoning?: string;
}

/** Resolved result for a single dimension */
export interface DimensionResult {
	dimensionId: string;
	label: string;
	weight: number;
	normalizedWeight: number;
	rawScore: number;
	weightedScore: number;
	reasoning: string | null;
}

/** Full partial-credit evaluation result */
export interface PartialCreditResult {
	rubricId: string;
	/** Weighted sum of dimension scores (0-1) */
	totalScore: number;
	/** Whether the result meets the pass threshold */
	passed: boolean;
	/** Per-dimension breakdown */
	dimensions: DimensionResult[];
	/** How many dimensions awarded full credit */
	fullCreditCount: number;
	/** How many dimensions awarded partial credit (0 < score < 1) */
	partialCreditCount: number;
	/** How many dimensions awarded zero credit */
	zeroCreditCount: number;
}

// ── Dimension scoring ─────────────────────────────────────────────────────────

/**
 * Resolve a raw DimensionScore to a numeric 0-1 score given the dimension def.
 * Throws if the value is invalid for the dimension's mode.
 */
export function resolveDimensionScore(
	dimension: RubricDimension,
	raw: DimensionScore,
): number {
	const { mode, tiers } = dimension;
	const { value } = raw;

	switch (mode) {
		case "binary": {
			if (typeof value !== "number") {
				throw new TypeError(
					`Dimension "${dimension.id}" (binary) expects a number, got ${typeof value}`,
				);
			}
			if (value !== 0 && value !== 1) {
				throw new RangeError(
					`Dimension "${dimension.id}" (binary) value must be 0 or 1, got ${value}`,
				);
			}
			return value;
		}

		case "scalar": {
			if (typeof value !== "number") {
				throw new TypeError(
					`Dimension "${dimension.id}" (scalar) expects a number, got ${typeof value}`,
				);
			}
			if (value < 0 || value > 1) {
				throw new RangeError(
					`Dimension "${dimension.id}" (scalar) value must be in [0, 1], got ${value}`,
				);
			}
			return value;
		}

		case "tiered": {
			if (typeof value !== "string") {
				throw new TypeError(
					`Dimension "${dimension.id}" (tiered) expects a tier label string, got ${typeof value}`,
				);
			}
			const tier = (tiers ?? []).find((t) => t.label === value);
			if (!tier) {
				const available = (tiers ?? []).map((t) => t.label).join(", ");
				throw new RangeError(
					`Dimension "${dimension.id}" (tiered) unknown tier "${value}". Available: [${available}]`,
				);
			}
			return tier.score;
		}
	}
}

// ── Total score computation ───────────────────────────────────────────────────

/**
 * Compute partial-credit result from a rubric and per-dimension scores.
 *
 * @param rubric - Rubric definition with weighted dimensions
 * @param scores - One DimensionScore per dimension
 * @param passThreshold - Minimum total score to count as "passed" (default: 0.6)
 */
export function scoreWithPartialCredit(
	rubric: Rubric,
	scores: DimensionScore[],
	passThreshold = 0.6,
): PartialCreditResult {
	if (rubric.dimensions.length === 0) {
		return {
			rubricId: rubric.id,
			totalScore: 0,
			passed: false,
			dimensions: [],
			fullCreditCount: 0,
			partialCreditCount: 0,
			zeroCreditCount: 0,
		};
	}

	const totalWeight = rubric.dimensions.reduce((s, d) => s + d.weight, 0);
	const scoreMap = new Map(scores.map((s) => [s.dimensionId, s]));

	let weightedSum = 0;
	let fullCreditCount = 0;
	let partialCreditCount = 0;
	let zeroCreditCount = 0;

	const dimensionResults: DimensionResult[] = rubric.dimensions.map((dim) => {
		const raw = scoreMap.get(dim.id);
		const normalizedWeight = totalWeight > 0 ? dim.weight / totalWeight : 0;

		if (!raw) {
			// Missing dimension scores as 0
			zeroCreditCount++;
			return {
				dimensionId: dim.id,
				label: dim.label,
				weight: dim.weight,
				normalizedWeight,
				rawScore: 0,
				weightedScore: 0,
				reasoning: null,
			};
		}

		const rawScore = resolveDimensionScore(dim, raw);
		const weightedScore = rawScore * normalizedWeight;
		weightedSum += weightedScore;

		if (rawScore >= 1.0) fullCreditCount++;
		else if (rawScore > 0) partialCreditCount++;
		else zeroCreditCount++;

		return {
			dimensionId: dim.id,
			label: dim.label,
			weight: dim.weight,
			normalizedWeight,
			rawScore,
			weightedScore,
			reasoning: raw.reasoning ?? null,
		};
	});

	return {
		rubricId: rubric.id,
		totalScore: Math.min(1, Math.max(0, weightedSum)),
		passed: weightedSum >= passThreshold,
		dimensions: dimensionResults,
		fullCreditCount,
		partialCreditCount,
		zeroCreditCount,
	};
}

// ── Rubric helpers ────────────────────────────────────────────────────────────

/**
 * Build a simple binary rubric from a list of criteria labels.
 * All criteria are equally weighted.
 */
export function buildBinaryRubric(
	id: string,
	name: string,
	criteria: string[],
): Rubric {
	return {
		id,
		name,
		dimensions: criteria.map((label, i) => ({
			id: `dim-${i}`,
			label,
			weight: 1,
			mode: "binary",
		})),
	};
}

/**
 * Validate that all rubric dimensions have corresponding score entries.
 * Returns IDs of dimensions with missing scores.
 */
export function findMissingDimensions(
	rubric: Rubric,
	scores: DimensionScore[],
): string[] {
	const scoredIds = new Set(scores.map((s) => s.dimensionId));
	return rubric.dimensions.filter((d) => !scoredIds.has(d.id)).map((d) => d.id);
}
