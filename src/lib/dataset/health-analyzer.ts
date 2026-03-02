/**
 * Dataset Health Analyzer — quality trends, schema drift, duplicate and outlier detection.
 *
 * Tracks how a dataset evolves over time and surfaces health signals that
 * indicate when a dataset is degrading (duplicates accumulating, outliers
 * skewing results, schema becoming inconsistent, or score distributions drifting).
 *
 * Pure module — no DB or I/O dependencies.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A single test case record in the dataset */
export interface DatasetEntry {
	/** Unique identifier */
	id: string;
	/** Input/prompt text */
	input: string;
	/** Expected output (optional) */
	expectedOutput?: string;
	/** Tags or category labels */
	tags?: string[];
	/** Numeric score from a previous evaluation (0-1), if available */
	lastScore?: number;
	/** ISO timestamp when this entry was created */
	createdAt?: string;
	/** ISO timestamp of last evaluation */
	lastEvaluatedAt?: string;
	/** Schema version or format key (for drift detection) */
	schemaVersion?: string;
}

/** Duplicate pair detected in the dataset */
export interface DuplicatePair {
	idA: string;
	idB: string;
	/** Jaccard similarity between the two entries (0-1) */
	similarity: number;
	/** Whether this is an exact match or near-duplicate */
	type: "exact" | "near_duplicate";
}

/** An outlier entry — statistically unusual compared to the rest */
export interface OutlierEntry {
	id: string;
	/** Reason for outlier classification */
	reason: OutlierReason;
	/** Severity: low/medium/high */
	severity: "low" | "medium" | "high";
	/** Supporting evidence (e.g. "length 5× median", "score 3σ below mean") */
	evidence: string;
}

export type OutlierReason =
	| "extreme_length"
	| "empty_input"
	| "low_score_outlier"
	| "high_score_outlier"
	| "missing_expected_output"
	| "schema_anomaly";

/** Schema drift — inconsistency in field presence across entries */
export interface SchemaDriftReport {
	/** Whether drift was detected */
	driftDetected: boolean;
	/** Fields present in some but not all entries */
	inconsistentFields: string[];
	/** Entries with anomalous schema (missing/extra required fields) */
	anomalousEntryIds: string[];
	/** Ratio of entries with inconsistent schema (0-1) */
	driftRatio: number;
}

/** Score distribution snapshot */
export interface ScoreDistribution {
	mean: number;
	median: number;
	stdDev: number;
	p10: number;
	p90: number;
	/** Percentage of entries with score < 0.4 */
	lowScoreRatio: number;
	/** Percentage of entries with score >= 0.7 */
	highScoreRatio: number;
}

/** Trend comparison between two dataset snapshots */
export interface DatasetTrend {
	/** Change in mean score (positive = improving) */
	meanScoreDelta: number;
	/** Change in dataset size */
	sizeDelta: number;
	/** Change in duplicate count */
	duplicateDelta: number;
	/** Whether the score trend is improving, degrading, or stable */
	scoreTrend: "improving" | "degrading" | "stable";
	/** Whether dataset size is growing, shrinking, or stable */
	sizeTrend: "growing" | "shrinking" | "stable";
}

/** Overall health report for a dataset */
export interface DatasetHealthReport {
	/** Total entries analyzed */
	totalEntries: number;
	/** Duplicate pairs found */
	duplicates: DuplicatePair[];
	/** Outlier entries */
	outliers: OutlierEntry[];
	/** Schema drift report */
	schemaDrift: SchemaDriftReport;
	/** Score distribution (null if no scores available) */
	scoreDistribution: ScoreDistribution | null;
	/** Overall health score (0-1, higher = healthier) */
	healthScore: number;
	/** Human-readable health summary */
	summary: string;
	/** Actionable recommendations */
	recommendations: string[];
}

export interface HealthAnalyzerConfig {
	/** Jaccard similarity threshold for near-duplicates (default: 0.8) */
	nearDuplicateThreshold?: number;
	/** Exact duplicate threshold (default: 0.99) */
	exactDuplicateThreshold?: number;
	/** Length z-score threshold for extreme length outliers (default: 3.0) */
	extremeLengthZScore?: number;
	/** Score z-score threshold for score outliers (default: 2.5) */
	scoreOutlierZScore?: number;
	/** Maximum allowed duplicate ratio before flagging (default: 0.1 = 10%) */
	maxDuplicateRatio?: number;
	/** Minimum entries required before computing statistics (default: 5) */
	minEntries?: number;
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

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.max(0, Math.floor((p / 100) * sorted.length) - 1);
	return sorted[idx] ?? 0;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return percentile(sorted, 50);
}

// ── Jaccard similarity ────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.replace(/[^\w\s]/g, " ")
			.split(/\s+/)
			.filter((t) => t.length > 1),
	);
}

function jaccardSimilarity(a: string, b: string): number {
	const tokA = tokenize(a);
	const tokB = tokenize(b);
	if (tokA.size === 0 && tokB.size === 0) return 1.0;
	if (tokA.size === 0 || tokB.size === 0) return 0;
	let intersection = 0;
	for (const t of tokA) {
		if (tokB.has(t)) intersection++;
	}
	return intersection / (tokA.size + tokB.size - intersection);
}

// ── Duplicate detection ───────────────────────────────────────────────────────

/**
 * Detect duplicate and near-duplicate entries by Jaccard similarity on input text.
 * O(n²) — suitable for datasets up to ~5k entries.
 */
export function detectDuplicates(
	entries: DatasetEntry[],
	config: HealthAnalyzerConfig = {},
): DuplicatePair[] {
	const { nearDuplicateThreshold = 0.8, exactDuplicateThreshold = 0.99 } =
		config;
	const pairs: DuplicatePair[] = [];

	for (let i = 0; i < entries.length; i++) {
		for (let j = i + 1; j < entries.length; j++) {
			const sim = jaccardSimilarity(entries[i]!.input, entries[j]!.input);
			if (sim >= nearDuplicateThreshold) {
				pairs.push({
					idA: entries[i]!.id,
					idB: entries[j]!.id,
					similarity: sim,
					type: sim >= exactDuplicateThreshold ? "exact" : "near_duplicate",
				});
			}
		}
	}

	return pairs;
}

// ── Outlier detection ─────────────────────────────────────────────────────────

/**
 * Detect statistical outliers across length, score, and structural dimensions.
 */
export function detectOutliers(
	entries: DatasetEntry[],
	config: HealthAnalyzerConfig = {},
): OutlierEntry[] {
	const { extremeLengthZScore = 3.0, scoreOutlierZScore = 2.5 } = config;
	const outliers: OutlierEntry[] = [];

	// Length outliers
	const lengths = entries.map((e) => e.input.length);
	const lenMean = mean(lengths);
	const lenSd = stdDev(lengths);

	for (const entry of entries) {
		if (entry.input.trim().length === 0) {
			outliers.push({
				id: entry.id,
				reason: "empty_input",
				severity: "high",
				evidence: "Input is empty or whitespace-only",
			});
			continue;
		}

		if (lenSd > 0) {
			const z = Math.abs(entry.input.length - lenMean) / lenSd;
			if (z >= extremeLengthZScore) {
				outliers.push({
					id: entry.id,
					reason: "extreme_length",
					severity: z >= extremeLengthZScore * 1.5 ? "high" : "medium",
					evidence: `Input length ${entry.input.length} chars (z=${z.toFixed(1)}, mean=${Math.round(lenMean)})`,
				});
			}
		}

		if (
			entry.expectedOutput === undefined ||
			entry.expectedOutput === null ||
			entry.expectedOutput === ""
		) {
			outliers.push({
				id: entry.id,
				reason: "missing_expected_output",
				severity: "low",
				evidence: "No expected output defined",
			});
		}
	}

	// Score outliers
	const scored = entries.filter((e) => e.lastScore !== undefined);
	if (scored.length >= 5) {
		const scores = scored.map((e) => e.lastScore as number);
		const scoreMean = mean(scores);
		const scoreSd = stdDev(scores);

		if (scoreSd > 0) {
			for (const entry of scored) {
				const z = (entry.lastScore! - scoreMean) / scoreSd;
				if (z <= -scoreOutlierZScore) {
					outliers.push({
						id: entry.id,
						reason: "low_score_outlier",
						severity:
							Math.abs(z) >= scoreOutlierZScore * 1.5 ? "high" : "medium",
						evidence: `Score ${entry.lastScore!.toFixed(2)} (z=${z.toFixed(1)}, mean=${scoreMean.toFixed(2)})`,
					});
				} else if (z >= scoreOutlierZScore) {
					outliers.push({
						id: entry.id,
						reason: "high_score_outlier",
						severity: "low",
						evidence: `Score ${entry.lastScore!.toFixed(2)} (z=${z.toFixed(1)}, mean=${scoreMean.toFixed(2)})`,
					});
				}
			}
		}
	}

	return outliers;
}

// ── Schema drift ──────────────────────────────────────────────────────────────

/**
 * Detect schema inconsistency — fields present in some entries but not others.
 */
export function detectSchemaDrift(entries: DatasetEntry[]): SchemaDriftReport {
	if (entries.length === 0) {
		return {
			driftDetected: false,
			inconsistentFields: [],
			anomalousEntryIds: [],
			driftRatio: 0,
		};
	}

	// Track which optional fields are present per entry
	const optionalFields: Array<keyof DatasetEntry> = [
		"expectedOutput",
		"tags",
		"lastScore",
		"schemaVersion",
	];

	// Count how many entries have each field
	const fieldCounts = new Map<string, number>();
	for (const field of optionalFields) {
		const count = entries.filter(
			(e) => e[field] !== undefined && e[field] !== null && e[field] !== "",
		).length;
		fieldCounts.set(field, count);
	}

	// A field is "inconsistent" if it's present in some but not all, and present in > 20% of entries
	const inconsistentFields: string[] = [];
	for (const [field, count] of fieldCounts) {
		const ratio = count / entries.length;
		if (ratio > 0.2 && ratio < 0.8) {
			inconsistentFields.push(field);
		}
	}

	// Schema version drift: multiple versions present
	const versions = new Set(entries.map((e) => e.schemaVersion).filter(Boolean));
	if (versions.size > 1) {
		inconsistentFields.push("schemaVersion");
	}

	// Find entries with anomalous schema (missing fields that most others have)
	const anomalousEntryIds: string[] = [];
	for (const field of inconsistentFields) {
		const fieldKey = field as keyof DatasetEntry;
		const fieldCount = fieldCounts.get(field) ?? 0;
		// If most entries (>50%) have it, entries without it are anomalous
		if (fieldCount / entries.length > 0.5) {
			for (const entry of entries) {
				const val = entry[fieldKey];
				if (val === undefined || val === null || val === "") {
					if (!anomalousEntryIds.includes(entry.id)) {
						anomalousEntryIds.push(entry.id);
					}
				}
			}
		}
	}

	const driftRatio = anomalousEntryIds.length / entries.length;

	return {
		driftDetected: inconsistentFields.length > 0,
		inconsistentFields: [...new Set(inconsistentFields)],
		anomalousEntryIds,
		driftRatio,
	};
}

// ── Score distribution ────────────────────────────────────────────────────────

/**
 * Compute score distribution statistics for entries with scores.
 */
export function computeScoreDistribution(
	entries: DatasetEntry[],
): ScoreDistribution | null {
	const scored = entries
		.filter((e) => e.lastScore !== undefined)
		.map((e) => e.lastScore as number);
	if (scored.length < 3) return null;

	const sorted = [...scored].sort((a, b) => a - b);
	const avg = mean(scored);
	const sd = stdDev(scored);

	return {
		mean: avg,
		median: median(scored),
		stdDev: sd,
		p10: percentile(sorted, 10),
		p90: percentile(sorted, 90),
		lowScoreRatio: scored.filter((s) => s < 0.4).length / scored.length,
		highScoreRatio: scored.filter((s) => s >= 0.7).length / scored.length,
	};
}

// ── Trend analysis ────────────────────────────────────────────────────────────

/**
 * Compare two dataset health reports to produce a trend summary.
 */
export function computeDatasetTrend(
	previous: DatasetHealthReport,
	current: DatasetHealthReport,
): DatasetTrend {
	const prevMean = previous.scoreDistribution?.mean ?? null;
	const currMean = current.scoreDistribution?.mean ?? null;
	const meanScoreDelta =
		prevMean !== null && currMean !== null ? currMean - prevMean : 0;

	const scoreTrend: DatasetTrend["scoreTrend"] =
		Math.abs(meanScoreDelta) < 0.02
			? "stable"
			: meanScoreDelta > 0
				? "improving"
				: "degrading";

	const sizeDelta = current.totalEntries - previous.totalEntries;
	const sizeTrend: DatasetTrend["sizeTrend"] =
		Math.abs(sizeDelta) < 2
			? "stable"
			: sizeDelta > 0
				? "growing"
				: "shrinking";

	return {
		meanScoreDelta,
		sizeDelta,
		duplicateDelta: current.duplicates.length - previous.duplicates.length,
		scoreTrend,
		sizeTrend,
	};
}

// ── Health score ──────────────────────────────────────────────────────────────

function computeHealthScore(
	entries: DatasetEntry[],
	duplicates: DuplicatePair[],
	outliers: OutlierEntry[],
	schemaDrift: SchemaDriftReport,
	config: HealthAnalyzerConfig,
): number {
	if (entries.length === 0) return 0;

	const { maxDuplicateRatio = 0.1 } = config;

	let score = 1.0;

	// Penalise duplicates
	const duplicateRatio = (duplicates.length * 2) / entries.length;
	score -= Math.min(0.3, (duplicateRatio / maxDuplicateRatio) * 0.3);

	// Penalise high-severity outliers
	const highOutliers = outliers.filter((o) => o.severity === "high").length;
	const medOutliers = outliers.filter((o) => o.severity === "medium").length;
	score -= Math.min(0.2, highOutliers * 0.04 + medOutliers * 0.01);

	// Penalise schema drift
	score -= Math.min(0.2, schemaDrift.driftRatio * 0.5);

	return Math.max(0, Math.min(1, score));
}

// ── Recommendations ───────────────────────────────────────────────────────────

function buildRecommendations(
	duplicates: DuplicatePair[],
	outliers: OutlierEntry[],
	schemaDrift: SchemaDriftReport,
	scoreDistribution: ScoreDistribution | null,
): string[] {
	const recs: string[] = [];

	const exactDups = duplicates.filter((d) => d.type === "exact").length;
	const nearDups = duplicates.filter((d) => d.type === "near_duplicate").length;
	if (exactDups > 0)
		recs.push(`Remove ${exactDups} exact duplicate entry(s) to reduce noise`);
	if (nearDups > 5)
		recs.push(
			`Review ${nearDups} near-duplicate pairs — consider merging similar test cases`,
		);

	const emptyInputs = outliers.filter((o) => o.reason === "empty_input").length;
	if (emptyInputs > 0)
		recs.push(
			`Fix ${emptyInputs} entry(s) with empty or whitespace-only input`,
		);

	const missingExpected = outliers.filter(
		(o) => o.reason === "missing_expected_output",
	).length;
	if (missingExpected > 0)
		recs.push(
			`Add expected outputs to ${missingExpected} entry(s) to enable automated scoring`,
		);

	if (schemaDrift.driftDetected && schemaDrift.driftRatio > 0.1) {
		recs.push(
			`Normalise schema across ${schemaDrift.anomalousEntryIds.length} anomalous entries (fields: ${schemaDrift.inconsistentFields.join(", ")})`,
		);
	}

	if (scoreDistribution) {
		if (scoreDistribution.lowScoreRatio > 0.3) {
			recs.push(
				`${Math.round(scoreDistribution.lowScoreRatio * 100)}% of entries have low scores (<0.4) — review test case quality or prompt templates`,
			);
		}
		if (scoreDistribution.stdDev < 0.05) {
			recs.push(
				"Score distribution is very narrow — consider adding more diverse test cases",
			);
		}
	}

	return recs;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run a full health analysis on a dataset.
 */
export function analyzeDatasetHealth(
	entries: DatasetEntry[],
	config: HealthAnalyzerConfig = {},
): DatasetHealthReport {
	const { minEntries = 5 } = config;

	if (entries.length < minEntries) {
		return {
			totalEntries: entries.length,
			duplicates: [],
			outliers: [],
			schemaDrift: {
				driftDetected: false,
				inconsistentFields: [],
				anomalousEntryIds: [],
				driftRatio: 0,
			},
			scoreDistribution: null,
			healthScore: entries.length === 0 ? 0 : 0.5,
			summary: `Dataset too small for reliable analysis (${entries.length}/${minEntries} minimum)`,
			recommendations: ["Add more test cases to enable health analysis"],
		};
	}

	const duplicates = detectDuplicates(entries, config);
	const outliers = detectOutliers(entries, config);
	const schemaDrift = detectSchemaDrift(entries);
	const scoreDistribution = computeScoreDistribution(entries);
	const healthScore = computeHealthScore(
		entries,
		duplicates,
		outliers,
		schemaDrift,
		config,
	);
	const recommendations = buildRecommendations(
		duplicates,
		outliers,
		schemaDrift,
		scoreDistribution,
	);

	const healthLabel =
		healthScore >= 0.8
			? "healthy"
			: healthScore >= 0.6
				? "needs attention"
				: "unhealthy";
	const summary = `Dataset ${healthLabel} (score ${(healthScore * 100).toFixed(0)}%): ${entries.length} entries, ${duplicates.length} duplicate pair(s), ${outliers.filter((o) => o.severity === "high").length} high-severity outlier(s)`;

	return {
		totalEntries: entries.length,
		duplicates,
		outliers,
		schemaDrift,
		scoreDistribution,
		healthScore,
		summary,
		recommendations,
	};
}
