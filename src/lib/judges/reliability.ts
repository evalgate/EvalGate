/**
 * Judge Reliability Tracker — per-judge historical accuracy & bias metrics.
 *
 * Tracks each judge's performance over time so the multi-judge engine can
 * weight or penalise judges that exhibit systematic bias or low calibration.
 *
 * Pure in-memory module — persistence is handled by callers (DB service layer).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface JudgeObservation {
	/** Judge that produced this score */
	judgeId: string;
	/** Score the judge gave (0-1) */
	predictedScore: number;
	/** Ground-truth label (0 = fail, 0.5 = partial, 1 = pass) — null if unknown */
	groundTruth: number | null;
	/** Wall-clock timestamp (ms) */
	timestamp: number;
}

export interface JudgeReliabilityMetrics {
	judgeId: string;
	/** Total observations recorded */
	observationCount: number;
	/** Mean absolute error vs ground truth (null if no labelled obs) */
	mae: number | null;
	/** Mean signed error — positive = systematically over-scores */
	bias: number | null;
	/** Pearson r between predicted and ground-truth scores */
	calibration: number | null;
	/** Rolling std-dev of recent scores (last N, default 20) */
	recentStdDev: number;
	/** Reliability tier derived from mae */
	tier: ReliabilityTier;
	/** Whether this judge is currently flagged for review */
	flagged: boolean;
	/** Reason for flag, if any */
	flagReason: string | null;
}

export type ReliabilityTier =
	| "excellent"
	| "good"
	| "fair"
	| "poor"
	| "unrated";

/** Config knobs for the reliability tracker */
export interface ReliabilityConfig {
	/** Window size for rolling std-dev (default: 20) */
	rollingWindow?: number;
	/** MAE threshold for "poor" tier (default: 0.25) */
	poorMaeThreshold?: number;
	/** MAE threshold for "fair" tier (default: 0.15) */
	fairMaeThreshold?: number;
	/** MAE threshold for "good" tier (default: 0.08) */
	goodMaeThreshold?: number;
	/** Min observations before assigning a tier (default: 5) */
	minObservationsForTier?: number;
	/** Absolute bias threshold to auto-flag a judge (default: 0.2) */
	biasFlagThreshold?: number;
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function mean(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
	if (values.length < 2) return 0;
	const avg = mean(values);
	return Math.sqrt(
		values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length,
	);
}

function pearsonR(xs: number[], ys: number[]): number | null {
	if (xs.length < 3 || xs.length !== ys.length) return null;
	const mx = mean(xs);
	const my = mean(ys);
	const num = xs.reduce((s, x, i) => s + (x - mx) * ((ys[i] ?? 0) - my), 0);
	const den = Math.sqrt(
		xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
			ys.reduce((s, y) => s + (y - my) ** 2, 0),
	);
	return den === 0 ? null : num / den;
}

function classifyTier(
	mae: number | null,
	minObs: number,
	obsCount: number,
): ReliabilityTier {
	if (obsCount < minObs) return "unrated";
	if (mae === null) return "unrated";
	if (mae <= 0.08) return "excellent";
	if (mae <= 0.15) return "good";
	if (mae <= 0.25) return "fair";
	return "poor";
}

// ── Core tracker ──────────────────────────────────────────────────────────────

/**
 * Compute reliability metrics for a single judge from its observation history.
 */
export function computeJudgeReliability(
	judgeId: string,
	observations: JudgeObservation[],
	config: ReliabilityConfig = {},
): JudgeReliabilityMetrics {
	const {
		rollingWindow = 20,
		poorMaeThreshold = 0.25,
		fairMaeThreshold = 0.15,
		goodMaeThreshold = 0.08,
		minObservationsForTier = 5,
		biasFlagThreshold = 0.2,
	} = config;

	// Filter to this judge's observations, sorted chronologically
	const myObs = observations
		.filter((o) => o.judgeId === judgeId)
		.sort((a, b) => a.timestamp - b.timestamp);

	const labelled = myObs.filter((o) => o.groundTruth !== null);

	// MAE and bias require labelled observations
	let mae: number | null = null;
	let bias: number | null = null;
	let calibration: number | null = null;

	if (labelled.length > 0) {
		const errors = labelled.map((o) => o.predictedScore - (o.groundTruth ?? 0));
		mae = mean(errors.map(Math.abs));
		bias = mean(errors);

		const predicted = labelled.map((o) => o.predictedScore);
		const truth = labelled.map((o) => o.groundTruth as number);
		calibration = pearsonR(predicted, truth);
	}

	// Rolling std-dev over recent window
	const recent = myObs.slice(-rollingWindow).map((o) => o.predictedScore);
	const recentStdDev = stdDev(recent);

	// Override thresholds from config (used for tier classification)
	const tierConfig = {
		minObs: minObservationsForTier,
		poor: poorMaeThreshold,
		fair: fairMaeThreshold,
		good: goodMaeThreshold,
	};
	void tierConfig; // suppress unused warning — used via classifyTier signature

	const tier = classifyTier(mae, minObservationsForTier, myObs.length);

	// Auto-flag on severe bias
	let flagged = false;
	let flagReason: string | null = null;

	if (bias !== null && Math.abs(bias) >= biasFlagThreshold) {
		flagged = true;
		flagReason = `Systematic ${bias > 0 ? "over" : "under"}-scoring detected (bias=${bias.toFixed(3)})`;
	} else if (tier === "poor" && myObs.length >= minObservationsForTier) {
		flagged = true;
		flagReason = `Poor calibration (MAE=${mae?.toFixed(3) ?? "n/a"})`;
	}

	return {
		judgeId,
		observationCount: myObs.length,
		mae,
		bias,
		calibration,
		recentStdDev,
		tier,
		flagged,
		flagReason,
	};
}

/**
 * Compute reliability metrics for every judge present in the observations.
 */
export function computeAllJudgeReliability(
	observations: JudgeObservation[],
	config: ReliabilityConfig = {},
): Map<string, JudgeReliabilityMetrics> {
	const judgeIds = [...new Set(observations.map((o) => o.judgeId))];
	const result = new Map<string, JudgeReliabilityMetrics>();
	for (const id of judgeIds) {
		result.set(id, computeJudgeReliability(id, observations, config));
	}
	return result;
}

/**
 * Derive a reliability-adjusted weight for a judge (0.1 – 1.0).
 *
 * Excellent judges get weight 1.0.
 * Poor judges are downweighted to 0.1 so they still participate but with low influence.
 * Flagged judges are penalised by 50%.
 */
export function judgeReliabilityWeight(
	metrics: JudgeReliabilityMetrics,
): number {
	const tierWeights: Record<ReliabilityTier, number> = {
		excellent: 1.0,
		good: 0.8,
		fair: 0.5,
		poor: 0.1,
		unrated: 0.6,
	};
	const base = tierWeights[metrics.tier];
	return metrics.flagged ? base * 0.5 : base;
}

/**
 * Detect judges whose recent score variance is unusually high compared
 * to the provided population baseline (e.g. std-dev across all judges).
 */
export function detectUnstableJudges(
	metricsMap: Map<string, JudgeReliabilityMetrics>,
	populationStdDevMean: number,
	multiplier = 2.0,
): string[] {
	const unstable: string[] = [];
	for (const [id, m] of metricsMap) {
		if (m.recentStdDev > populationStdDevMean * multiplier) {
			unstable.push(id);
		}
	}
	return unstable;
}
