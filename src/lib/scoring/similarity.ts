// src/lib/scoring/similarity.ts

/**
 * Automated scoring algorithms for ground-truth comparison.
 * Section 2.1b — cosine similarity, Levenshtein distance, combined scoring.
 */

/**
 * Cosine similarity between two strings using word-frequency vectors.
 * Returns a value between 0 and 1.
 */
export function cosineSimilarity(a: string, b: string): number {
  const vecA = wordFrequency(a);
  const vecB = wordFrequency(b);

  const allWords = new Set([...vecA.keys(), ...vecB.keys()]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const word of allWords) {
    const valA = vecA.get(word) || 0;
    const valB = vecB.get(word) || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Normalized Levenshtein distance between two strings.
 * Returns a similarity value between 0 and 1 (1 = identical).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

/**
 * Combined scoring: weighted average of cosine + Levenshtein.
 * Returns a value between 0 and 100.
 */
export function combinedScore(
  expected: string,
  actual: string,
  weights: { cosine?: number; levenshtein?: number } = {},
): number {
  const cosineWeight = weights.cosine ?? 0.6;
  const levWeight = weights.levenshtein ?? 0.4;

  const cosine = cosineSimilarity(expected, actual);
  const lev = levenshteinSimilarity(expected, actual);

  return Math.round((cosine * cosineWeight + lev * levWeight) * 100);
}

/**
 * Keyword match rate — fast check for golden-set regressions.
 * Returns a value between 0 and 100.
 */
export function keywordMatchRate(expected: string, actual: string): number {
  const keywords = expected
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (keywords.length === 0) return 100;
  const actLower = actual.toLowerCase();
  const matched = keywords.filter((w) => actLower.includes(w)).length;
  return Math.round((matched / keywords.length) * 100);
}

// ---- Helpers ----

function wordFrequency(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return freq;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use two-row optimization for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}
