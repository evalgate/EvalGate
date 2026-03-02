/**
 * Test Case Deduplicator — Similarity clustering for generated test cases.
 *
 * Prevents dataset explosion by clustering near-duplicate generated tests.
 * Uses a bag-of-words Jaccard similarity as a lightweight default.
 * Intended to be replaced with embedding similarity when vectors are available.
 *
 * Performance: pairwise comparison is O(n²). Use maxPairwiseN (default 500)
 * to guard against large-dataset blowup. Above the cap, pass a pre-sampled
 * subset or switch to an embedding-based ANN index.
 */

import type { EvalCase } from "@/lib/testcases/spec";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SimilarityScore {
	caseIdA: string;
	caseIdB: string;
	/** Jaccard similarity between the two cases (0-1) */
	score: number;
}

export interface DedupCluster {
	/** Cluster representative ID (canonical case) */
	canonicalId: string;
	/** All member IDs (including canonical) */
	memberIds: string[];
	/** Pairwise similarity scores within the cluster */
	similarities: SimilarityScore[];
}

/** Maximum number of cases supported by O(n²) pairwise comparison. */
export const MAX_PAIRWISE_N = 500;

export interface DedupResult {
	/** Cases that are unique (no near-duplicate found) */
	unique: EvalCase[];
	/** Clusters of near-duplicate cases */
	clusters: DedupCluster[];
	/** Total deduplication ratio (0-1, higher = more duplicates) */
	deduplicationRatio: number;
}

// ── Similarity ────────────────────────────────────────────────────────────────

/**
 * Tokenize text into a bag of words (lowercase, alphanumeric tokens).
 */
export function tokenize(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.split(/\W+/)
			.filter((t) => t.length > 2),
	);
}

/**
 * Compute Jaccard similarity between two token sets.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1.0;
	if (a.size === 0 || b.size === 0) return 0.0;

	let intersectionSize = 0;
	for (const token of a) {
		if (b.has(token)) intersectionSize++;
	}

	const unionSize = a.size + b.size - intersectionSize;
	return intersectionSize / unionSize;
}

/**
 * Compute the fingerprint text for an EvalCase (title + tags).
 */
function caseFingerprint(c: EvalCase): string {
	return `${c.title} ${c.tags.join(" ")}`;
}

/**
 * Compute pairwise similarity for a list of cases.
 *
 * @throws {RangeError} if cases.length exceeds maxN (default MAX_PAIRWISE_N)
 */
export function computePairwiseSimilarity(
	cases: EvalCase[],
	maxN = MAX_PAIRWISE_N,
): SimilarityScore[] {
	if (cases.length > maxN) {
		throw new RangeError(
			`computePairwiseSimilarity: input has ${cases.length} cases which exceeds the O(n²) safety limit of ${maxN}. ` +
				`Pass a sampled subset or increase maxN explicitly if you understand the performance cost.`,
		);
	}
	const scores: SimilarityScore[] = [];
	const tokenSets = cases.map((c) => ({
		id: c.id,
		tokens: tokenize(caseFingerprint(c)),
	}));

	for (let i = 0; i < tokenSets.length; i++) {
		for (let j = i + 1; j < tokenSets.length; j++) {
			const score = jaccardSimilarity(
				tokenSets[i]!.tokens,
				tokenSets[j]!.tokens,
			);
			scores.push({
				caseIdA: tokenSets[i]!.id,
				caseIdB: tokenSets[j]!.id,
				score,
			});
		}
	}

	return scores;
}

// ── Clustering ────────────────────────────────────────────────────────────────

/**
 * Cluster cases by similarity threshold (greedy single-link clustering).
 *
 * @param cases - EvalCases to cluster
 * @param threshold - Jaccard similarity >= threshold means "near-duplicate" (default: 0.5)
 * @param maxPairwiseN - O(n²) size guard (default MAX_PAIRWISE_N). Pass Infinity to disable.
 */
export function clusterBySimilarity(
	cases: EvalCase[],
	threshold = 0.5,
	maxPairwiseN = MAX_PAIRWISE_N,
): DedupResult {
	if (cases.length === 0) {
		return { unique: [], clusters: [], deduplicationRatio: 0 };
	}

	const allSimilarities = computePairwiseSimilarity(cases, maxPairwiseN);
	const nearDuplicatePairs = allSimilarities.filter(
		(s) => s.score >= threshold,
	);

	// Build adjacency from near-duplicate pairs
	const adjacency = new Map<string, Set<string>>();
	for (const c of cases) {
		adjacency.set(c.id, new Set());
	}
	for (const pair of nearDuplicatePairs) {
		adjacency.get(pair.caseIdA)!.add(pair.caseIdB);
		adjacency.get(pair.caseIdB)!.add(pair.caseIdA);
	}

	// BFS to find connected components
	const visited = new Set<string>();
	const components: string[][] = [];

	for (const c of cases) {
		if (visited.has(c.id)) continue;
		const component: string[] = [];
		const queue = [c.id];
		while (queue.length > 0) {
			const current = queue.shift()!;
			if (visited.has(current)) continue;
			visited.add(current);
			component.push(current);
			for (const neighbor of adjacency.get(current) ?? []) {
				if (!visited.has(neighbor)) queue.push(neighbor);
			}
		}
		components.push(component);
	}

	const caseMap = new Map(cases.map((c) => [c.id, c]));

	const unique: EvalCase[] = [];
	const clusters: DedupCluster[] = [];

	for (const component of components) {
		if (component.length === 1) {
			unique.push(caseMap.get(component[0]!)!);
		} else {
			// Pick canonical: oldest by createdAt (or first if no date)
			const sorted = [...component].sort((a, b) => {
				const ca = caseMap.get(a)?.createdAt ?? "";
				const cb = caseMap.get(b)?.createdAt ?? "";
				return ca.localeCompare(cb);
			});

			const canonicalId = sorted[0]!;
			const memberSims = nearDuplicatePairs.filter(
				(s) => component.includes(s.caseIdA) && component.includes(s.caseIdB),
			);

			clusters.push({
				canonicalId,
				memberIds: component,
				similarities: memberSims,
			});
		}
	}

	const totalCases = cases.length;
	const duplicateCount = clusters.reduce(
		(acc, c) => acc + c.memberIds.length - 1,
		0,
	);
	const deduplicationRatio = totalCases > 0 ? duplicateCount / totalCases : 0;

	return { unique, clusters, deduplicationRatio };
}
