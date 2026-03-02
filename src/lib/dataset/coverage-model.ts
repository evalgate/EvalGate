/**
 * Dataset Coverage Model — Estimate which behaviors are NOT tested.
 *
 * Clusters test cases by their behavioral "fingerprint" and identifies gaps.
 * Uses lightweight bag-of-words similarity as a proxy for behavioral embeddings
 * until a real embedding service is wired in.
 *
 * Enables the statement: "You have never tested refund scenarios involving
 * partial payments." — EvalGate Phase 2 differentiation.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface BehaviorPoint {
	/** Test case or trace ID */
	id: string;
	/** Text representation of the behavior (prompt + expected output) */
	text: string;
	/** Optional cluster label (from prior run) */
	clusterLabel?: string;
}

export interface BehaviorCluster {
	/** Cluster identifier */
	id: string;
	/** Human-readable cluster label (derived from centroid tokens) */
	label: string;
	/** Member IDs in this cluster */
	memberIds: string[];
	/** Centroid tokens */
	centroidTokens: string[];
	/** Cluster density (average intra-cluster similarity) */
	density: number;
}

export interface CoverageGap {
	/** Gap ID */
	id: string;
	/** Description of the untested behavior space */
	description: string;
	/** Nearest tested cluster */
	nearestClusterId: string | null;
	/** How far this gap is from any tested behavior (0-1, higher = more isolated) */
	gapDistance: number;
	/** Importance score (0-1) */
	importance: number;
}

export interface CoverageModel {
	/** Total test cases analyzed */
	totalTestCases: number;
	/** Behavior clusters discovered */
	clusters: BehaviorCluster[];
	/** Identified coverage gaps */
	gaps: CoverageGap[];
	/** Coverage ratio: tested behavior space / total behavior space estimate (0-1) */
	coverageRatio: number;
	/** Human-readable coverage summary */
	summary: string;
}

// ── Tokenization ──────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\W+/)
		.filter((t) => t.length > 2);
}

function tokenSet(text: string): Set<string> {
	return new Set(tokenize(text));
}

function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1;
	if (a.size === 0 || b.size === 0) return 0;
	let intersection = 0;
	for (const t of a) {
		if (b.has(t)) intersection++;
	}
	return intersection / (a.size + b.size - intersection);
}

// ── K-medoid clustering ────────────────────────────────────────────────────────

/**
 * Simple greedy k-medoid–style clustering.
 * Assigns each point to its nearest centroid.
 */
function clusterPoints(
	points: Array<{ id: string; tokens: Set<string> }>,
	k: number,
): Map<number, string[]> {
	if (points.length === 0) return new Map();
	const clampedK = Math.min(k, points.length);

	// Initialize: pick every (n/k)th point as centroid
	const step = Math.max(1, Math.floor(points.length / clampedK));
	const centroids = points
		.filter((_, i) => i % step === 0)
		.slice(0, clampedK)
		.map((p) => p.tokens);

	const assignments = new Map<number, string[]>();
	for (let i = 0; i < clampedK; i++) assignments.set(i, []);

	for (const point of points) {
		let bestCluster = 0;
		let bestSim = -1;
		for (let ci = 0; ci < centroids.length; ci++) {
			const sim = jaccard(point.tokens, centroids[ci]!);
			if (sim > bestSim) {
				bestSim = sim;
				bestCluster = ci;
			}
		}
		assignments.get(bestCluster)!.push(point.id);
	}

	return assignments;
}

// ── Centroid label ────────────────────────────────────────────────────────────

function centroidLabel(memberTexts: string[], topN = 5): string[] {
	const freq = new Map<string, number>();
	for (const text of memberTexts) {
		for (const token of tokenize(text)) {
			freq.set(token, (freq.get(token) ?? 0) + 1);
		}
	}
	return [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, topN)
		.map(([t]) => t);
}

function clusterDensity(members: Array<{ tokens: Set<string> }>): number {
	if (members.length < 2) return 1;
	let totalSim = 0;
	let count = 0;
	for (let i = 0; i < members.length; i++) {
		for (let j = i + 1; j < members.length; j++) {
			totalSim += jaccard(members[i]!.tokens, members[j]!.tokens);
			count++;
		}
	}
	return count > 0 ? totalSim / count : 1;
}

// ── Gap detection ─────────────────────────────────────────────────────────────

/**
 * Default seed phrases for gap detection. These represent common agent
 * behavior categories that are often undertested. Replace or extend with
 * domain-specific phrases for your evaluation use case.
 */
export const DEFAULT_GAP_SEED_PHRASES: readonly string[] = [
	"partial payment refund",
	"error recovery fallback",
	"multi-language support",
	"concurrent request handling",
	"empty input edge case",
	"very long context window",
	"ambiguous user intent",
	"adversarial prompt injection",
	"tool timeout handling",
	"rate limit exceeded response",
];

function detectGaps(
	clusters: BehaviorCluster[],
	clusterTokenSets: Map<string, Set<string>>,
	seedPhrases: readonly string[],
): CoverageGap[] {
	const gaps: CoverageGap[] = [];
	let gapIndex = 0;

	for (const phrase of seedPhrases) {
		const phraseTokens = tokenSet(phrase);

		// Find nearest cluster
		let nearestClusterId: string | null = null;
		let maxSim = 0;
		for (const cluster of clusters) {
			const sim = jaccard(
				phraseTokens,
				clusterTokenSets.get(cluster.id) ?? new Set(),
			);
			if (sim > maxSim) {
				maxSim = sim;
				nearestClusterId = cluster.id;
			}
		}

		// If similarity is low, this represents a coverage gap
		if (maxSim < 0.2) {
			gaps.push({
				id: `gap-${gapIndex++}`,
				description: `Behavior not well-covered: "${phrase}"`,
				nearestClusterId,
				gapDistance: 1 - maxSim,
				importance: Math.min(1, 0.5 + (1 - maxSim) * 0.5),
			});
		}
	}

	return gaps.sort((a, b) => b.importance - a.importance);
}

// ── Embedding support (Gap E) ──────────────────────────────────────────────────

/**
 * A function that produces a dense vector embedding for a text string.
 * Callers must inject this — the module itself has no external dependencies.
 *
 * @param text - Input string to embed
 * @returns A numeric vector (length must be consistent across all calls)
 */
export type EmbeddingFn = (text: string) => number[];

/**
 * Identifies which embedding model/version produced the stored vectors.
 * Changing this value invalidates any cached embedding clusters.
 */
export interface EmbeddingVersionInfo {
	/** Embedding model identifier, e.g. "text-embedding-3-small" */
	model: string;
	/** Embedding dimension */
	dimensions: number;
	/** Short hash of the model + dimension for cache keying */
	versionHash: string;
}

/** Compute a deterministic version hash from model + dimensions. */
export function computeEmbeddingVersionHash(
	model: string,
	dimensions: number,
): string {
	const raw = `${model}:${dimensions}`;
	let h = 0;
	for (let i = 0; i < raw.length; i++) {
		h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
	}
	return Math.abs(h).toString(16).padStart(8, "0");
}

function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;
	let dot = 0,
		magA = 0,
		magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!;
		magA += a[i]! * a[i]!;
		magB += b[i]! * b[i]!;
	}
	const denom = Math.sqrt(magA) * Math.sqrt(magB);
	return denom === 0 ? 0 : dot / denom;
}

function clusterByEmbeddings(
	points: Array<{ id: string; embedding: number[] }>,
	k: number,
): Map<number, string[]> {
	if (points.length === 0) return new Map();
	const clampedK = Math.min(k, points.length);

	const step = Math.max(1, Math.floor(points.length / clampedK));
	const centroids = points
		.filter((_, i) => i % step === 0)
		.slice(0, clampedK)
		.map((p) => p.embedding);

	const assignments = new Map<number, string[]>();
	for (let i = 0; i < clampedK; i++) assignments.set(i, []);

	for (const point of points) {
		let bestCluster = 0;
		let bestSim = -Infinity;
		for (let ci = 0; ci < centroids.length; ci++) {
			const sim = cosineSimilarity(point.embedding, centroids[ci]!);
			if (sim > bestSim) {
				bestSim = sim;
				bestCluster = ci;
			}
		}
		assignments.get(bestCluster)!.push(point.id);
	}

	return assignments;
}

// ── Core model ────────────────────────────────────────────────────────────────

/**
 * Build a coverage model from a dataset of behavior points.
 *
 * @param points - Behavior points (test cases / traces)
 * @param k - Number of behavior clusters to discover (default: auto)
 * @param options.seedPhrases - Phrases used for gap detection (default: DEFAULT_GAP_SEED_PHRASES)
 * @param options.embeddingFn - Optional embedding function (Gap E). When provided,
 *   cosine-similarity clustering is used instead of BoW Jaccard. The flag
 *   `useEmbeddings` must also be true (default: true when embeddingFn is supplied).
 * @param options.embeddingVersion - Metadata about the embedding model for cache keying.
 */
export function buildCoverageModel(
	points: BehaviorPoint[],
	k?: number,
	options: {
		seedPhrases?: readonly string[];
		embeddingFn?: EmbeddingFn;
		useEmbeddings?: boolean;
		embeddingVersion?: EmbeddingVersionInfo;
	} = {},
): CoverageModel {
	const useEmbed =
		options.embeddingFn !== undefined && options.useEmbeddings !== false;
	const seedPhrases = options.seedPhrases ?? DEFAULT_GAP_SEED_PHRASES;
	if (points.length === 0) {
		return {
			totalTestCases: 0,
			clusters: [],
			gaps: detectGaps([], new Map(), seedPhrases),
			coverageRatio: 0,
			summary: "No test cases provided — coverage is 0%",
		};
	}

	const tokenizedPoints = points.map((p) => ({
		id: p.id,
		text: p.text,
		tokens: tokenSet(p.text),
	}));

	// Auto-select k: roughly sqrt(n) clusters, capped at 20
	const clusterCount =
		k ?? Math.min(20, Math.max(1, Math.round(Math.sqrt(points.length))));

	// Choose clustering strategy: embedding cosine similarity (Gap E) or BoW Jaccard
	let assignments: Map<number, string[]>;
	if (useEmbed && options.embeddingFn) {
		const embeddedPoints = tokenizedPoints.map((p) => ({
			id: p.id,
			embedding: options.embeddingFn!(p.text),
		}));
		assignments = clusterByEmbeddings(embeddedPoints, clusterCount);
	} else {
		assignments = clusterPoints(tokenizedPoints, clusterCount);
	}

	const idToPoint = new Map(tokenizedPoints.map((p) => [p.id, p]));

	const clusters: BehaviorCluster[] = [];
	const clusterTokenSets = new Map<string, Set<string>>();

	for (const [clusterIdx, memberIds] of assignments) {
		if (memberIds.length === 0) continue;

		const members = memberIds.map((id) => idToPoint.get(id)!).filter(Boolean);
		const memberTexts = members.map((m) => m.text);
		const topTokens = centroidLabel(memberTexts);
		const density = clusterDensity(members);
		const clusterId = `cluster-${clusterIdx}`;

		// Cluster centroid token set (used for gap detection regardless of clustering mode)
		const centroidSet = new Set(topTokens);
		for (const m of members) {
			for (const t of m.tokens) centroidSet.add(t);
		}
		clusterTokenSets.set(clusterId, centroidSet);

		clusters.push({
			id: clusterId,
			label:
				topTokens.length > 0
					? topTokens.slice(0, 3).join(", ")
					: `Cluster ${clusterIdx}`,
			memberIds,
			centroidTokens: topTokens,
			density,
		});
	}

	const gaps = detectGaps(clusters, clusterTokenSets, seedPhrases);

	// Coverage ratio: fraction of gap seed phrases that are covered
	const coveredPhrases = seedPhrases.length - gaps.length;
	const coverageRatio = Math.min(1, coveredPhrases / seedPhrases.length);

	const summary = [
		`${points.length} test case(s) across ${clusters.length} behavior cluster(s).`,
		`Estimated coverage: ${(coverageRatio * 100).toFixed(0)}%.`,
		gaps.length > 0
			? `${gaps.length} gap(s) identified. Top gap: "${gaps[0]?.description ?? "unknown"}".`
			: "No significant coverage gaps detected.",
	].join(" ");

	return {
		totalTestCases: points.length,
		clusters,
		gaps,
		coverageRatio,
		summary,
	};
}

/**
 * Format the coverage model as a human-readable report.
 */
export function formatCoverageReport(model: CoverageModel): string {
	const lines = [
		"## Dataset Coverage Report",
		"",
		model.summary,
		"",
		`**Clusters (${model.clusters.length}):**`,
	];

	for (const cluster of model.clusters.slice(0, 10)) {
		lines.push(
			`  - [${cluster.id}] "${cluster.label}" — ${cluster.memberIds.length} test(s), density: ${cluster.density.toFixed(2)}`,
		);
	}

	if (model.gaps.length > 0) {
		lines.push("", `**Coverage Gaps (${model.gaps.length}):**`);
		for (const gap of model.gaps.slice(0, 5)) {
			lines.push(
				`  - ${gap.description} (importance: ${gap.importance.toFixed(2)})`,
			);
		}
	}

	return lines.join("\n");
}
