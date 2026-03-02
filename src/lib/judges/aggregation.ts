/**
 * Judge Aggregation — Combine N judge scores into a reliable composite result.
 *
 * Supports: median, mean, weighted average, majority vote, min/max.
 * Produces agreement statistics and flags low-agreement results.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type AggregationStrategy =
	| "median"
	| "mean"
	| "weighted_mean"
	| "majority_vote"
	| "min"
	| "max";

export interface JudgeVote {
	judgeId: string;
	score: number;
	/** Optional weight (default: 1.0) */
	weight?: number;
	/** Raw judge reasoning or rationale */
	reasoning?: string;
	/** Whether this judge was the tiebreaker */
	tiebreaker?: boolean;
}

export interface AggregatedJudgeResult {
	/** Final aggregated score (0-1) */
	finalScore: number;
	/** Strategy used */
	strategy: AggregationStrategy;
	/** Number of judges that participated */
	judgeCount: number;
	/** Agreement statistics */
	agreement: AgreementStats;
	/** Individual judge votes */
	votes: JudgeVote[];
	/** Whether this result is high-confidence */
	highConfidence: boolean;
}

export interface AgreementStats {
	/** Standard deviation of judge scores */
	stdDev: number;
	/** Range (max - min) */
	range: number;
	/** Percentage of judges within ±0.1 of median (0-1) */
	consensusRatio: number;
	/** Whether agreement is above threshold */
	isHighAgreement: boolean;
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function mean(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
	if (values.length < 2) return 0;
	const avg = mean(values);
	const variance =
		values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0
		? sorted[mid]!
		: (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ── Agreement stats ───────────────────────────────────────────────────────────

export function computeAgreementStats(
	scores: number[],
	agreementThreshold = 0.3,
): AgreementStats {
	if (scores.length === 0) {
		return { stdDev: 0, range: 0, consensusRatio: 1, isHighAgreement: true };
	}

	const med = median(scores);
	const sd = stdDev(scores);
	const range = Math.max(...scores) - Math.min(...scores);
	const withinConsensus = scores.filter((s) => Math.abs(s - med) <= 0.1).length;
	const consensusRatio = withinConsensus / scores.length;
	const isHighAgreement = sd <= agreementThreshold;

	return { stdDev: sd, range, consensusRatio, isHighAgreement };
}

// ── Aggregation strategies ────────────────────────────────────────────────────

function aggregateScores(
	votes: JudgeVote[],
	strategy: AggregationStrategy,
): number {
	const scores = votes.map((v) => v.score);

	switch (strategy) {
		case "median":
			return median(scores);

		case "mean":
			return mean(scores);

		case "weighted_mean": {
			const totalWeight = votes.reduce((sum, v) => sum + (v.weight ?? 1), 0);
			if (totalWeight === 0) return 0;
			return (
				votes.reduce((sum, v) => sum + v.score * (v.weight ?? 1), 0) /
				totalWeight
			);
		}

		case "majority_vote": {
			// Round scores to 0/0.5/1 buckets, pick strict majority.
			// Ties (pass==fail) return 0.5 — no silent tiebreaker.
			const buckets = { pass: 0, partial: 0, fail: 0 };
			for (const score of scores) {
				if (score >= 0.7) buckets.pass++;
				else if (score >= 0.4) buckets.partial++;
				else buckets.fail++;
			}
			if (buckets.pass > buckets.partial && buckets.pass > buckets.fail)
				return 1.0;
			if (buckets.fail > buckets.partial && buckets.fail > buckets.pass)
				return 0.0;
			return 0.5;
		}

		case "min":
			return Math.min(...scores);

		case "max":
			return Math.max(...scores);
	}
}

// ── Core aggregator ───────────────────────────────────────────────────────────

/**
 * Aggregate judge votes into a single result.
 *
 * @param votes - Individual judge votes
 * @param strategy - How to combine scores (default: median)
 * @param agreementThreshold - Max std dev for "high agreement" (default: 0.2)
 */
export function aggregateJudges(
	votes: JudgeVote[],
	strategy: AggregationStrategy = "median",
	agreementThreshold = 0.2,
): AggregatedJudgeResult {
	if (votes.length === 0) {
		return {
			finalScore: 0,
			strategy,
			judgeCount: 0,
			agreement: computeAgreementStats([]),
			votes: [],
			highConfidence: false,
		};
	}

	const finalScore = Math.min(1, Math.max(0, aggregateScores(votes, strategy)));
	const agreement = computeAgreementStats(
		votes.map((v) => v.score),
		agreementThreshold,
	);

	return {
		finalScore,
		strategy,
		judgeCount: votes.length,
		agreement,
		votes,
		highConfidence: votes.length >= 2 && agreement.isHighAgreement,
	};
}

/**
 * Cheap-first escalation strategy:
 * Run fast cheap judge first; only escalate to expensive judge if score is uncertain.
 *
 * @param cheapScore - Score from the cheap judge (0-1)
 * @param uncertaintyBand - Score range considered "uncertain" (default: 0.3-0.7)
 */
export function shouldEscalate(
	cheapScore: number,
	uncertaintyBand: [number, number] = [0.3, 0.7],
): boolean {
	return cheapScore >= uncertaintyBand[0] && cheapScore <= uncertaintyBand[1];
}
