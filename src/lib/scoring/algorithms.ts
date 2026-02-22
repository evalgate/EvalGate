// src/lib/scoring/algorithms.ts
/**
 * Automated scoring algorithms for evaluation comparisons.
 * Provides multiple scoring methods: cosine similarity, Levenshtein distance, and combined scoring.
 */

export interface ScoringResult {
  score: number;
  confidence: number;
  details: {
    algorithm: string;
    metrics: Record<string, number>;
    explanation: string;
  };
}

export interface ScoringOptions {
  algorithm?: "cosine" | "levenshtein" | "combined" | "jaccard" | "bleu";
  weights?: {
    semantic?: number;
    syntactic?: number;
    length?: number;
  };
  normalize?: boolean;
}

/**
 * Scoring Algorithms class
 * Provides multiple text similarity and scoring algorithms for evaluation.
 */
export class ScoringAlgorithms {
  /**
   * Calculate cosine similarity between two text vectors.
   * Uses TF-IDF vectorization for semantic similarity.
   */
  static cosineSimilarity(text1: string, text2: string): ScoringResult {
    if (!text1 || !text2) {
      return {
        score: 0,
        confidence: 0,
        details: {
          algorithm: "cosine",
          metrics: { similarity: 0 },
          explanation: "One or both texts are empty",
        },
      };
    }

    // Simple tokenization and vectorization
    const tokens1 = ScoringAlgorithms.tokenize(text1.toLowerCase());
    const tokens2 = ScoringAlgorithms.tokenize(text2.toLowerCase());

    // Create TF-IDF vectors
    const allTokens = [...new Set([...tokens1, ...tokens2])];
    const vector1 = ScoringAlgorithms.createTFIDFVector(tokens1, allTokens);
    const vector2 = ScoringAlgorithms.createTFIDFVector(tokens2, allTokens);

    // Calculate cosine similarity
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

    const similarity = magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
    const score = Math.round(similarity * 100);

    return {
      score,
      confidence:
        Math.min(tokens1.length, tokens2.length) / Math.max(tokens1.length, tokens2.length),
      details: {
        algorithm: "cosine",
        metrics: {
          similarity: similarity,
          tokens1: tokens1.length,
          tokens2: tokens2.length,
          dotProduct,
          magnitude1,
          magnitude2,
        },
        explanation: `Cosine similarity: ${similarity.toFixed(4)} (${score}/100) based on ${tokens1.length} vs ${tokens2.length} tokens`,
      },
    };
  }

  /**
   * Calculate Levenshtein distance (edit distance) between two strings.
   * Measures syntactic similarity.
   */
  static levenshteinDistance(text1: string, text2: string): ScoringResult {
    if (!text1 || !text2) {
      return {
        score: 0,
        confidence: 0,
        details: {
          algorithm: "levenshtein",
          metrics: { distance: 0, similarity: 0 },
          explanation: "One or both texts are empty",
        },
      };
    }

    const distance = ScoringAlgorithms.calculateLevenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    const similarity = maxLength > 0 ? 1 - distance / maxLength : 1;
    const score = Math.round(similarity * 100);

    return {
      score,
      confidence: 1, // Levenshtein is deterministic
      details: {
        algorithm: "levenshtein",
        metrics: {
          distance,
          similarity,
          maxLength,
          text1Length: text1.length,
          text2Length: text2.length,
        },
        explanation: `Levenshtein similarity: ${similarity.toFixed(4)} (${score}/100) with distance ${distance} of ${maxLength} characters`,
      },
    };
  }

  /**
   * Calculate Jaccard similarity between two sets of tokens.
   * Measures overlap between token sets.
   */
  static jaccardSimilarity(text1: string, text2: string): ScoringResult {
    if (!text1 || !text2) {
      return {
        score: 0,
        confidence: 0,
        details: {
          algorithm: "jaccard",
          metrics: { similarity: 0 },
          explanation: "One or both texts are empty",
        },
      };
    }

    const tokens1 = new Set(ScoringAlgorithms.tokenize(text1.toLowerCase()));
    const tokens2 = new Set(ScoringAlgorithms.tokenize(text2.toLowerCase()));

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    const similarity = union.size > 0 ? intersection.size / union.size : 0;
    const score = Math.round(similarity * 100);

    return {
      score,
      confidence: Math.min(tokens1.size, tokens2.size) / Math.max(tokens1.size, tokens2.size),
      details: {
        algorithm: "jaccard",
        metrics: {
          similarity,
          intersectionSize: intersection.size,
          unionSize: union.size,
          tokens1Size: tokens1.size,
          tokens2Size: tokens2.size,
        },
        explanation: `Jaccard similarity: ${similarity.toFixed(4)} (${score}/100) with ${intersection.size}/${union.size} overlapping tokens`,
      },
    };
  }

  /**
   * Calculate BLEU score (Bilingual Evaluation Understudy) for text similarity.
   * Commonly used in machine translation evaluation.
   */
  static bleuScore(reference: string, candidate: string, n: number = 4): ScoringResult {
    if (!reference || !candidate) {
      return {
        score: 0,
        confidence: 0,
        details: {
          algorithm: "bleu",
          metrics: { bleu: 0 },
          explanation: "One or both texts are empty",
        },
      };
    }

    const refTokens = ScoringAlgorithms.tokenize(reference.toLowerCase());
    const candTokens = ScoringAlgorithms.tokenize(candidate.toLowerCase());

    if (refTokens.length === 0) {
      return {
        score: 0,
        confidence: 0,
        details: {
          algorithm: "bleu",
          metrics: { bleu: 0 },
          explanation: "Reference text has no tokens",
        },
      };
    }

    // Calculate n-gram precisions
    const precisions: number[] = [];
    for (let i = 1; i <= n; i++) {
      const refNGrams = ScoringAlgorithms.getNGrams(refTokens, i);
      const candNGrams = ScoringAlgorithms.getNGrams(candTokens, i);

      const intersection = new Set([...refNGrams].filter((x) => candNGrams.has(x)));
      const precision = candNGrams.size > 0 ? intersection.size / candNGrams.size : 0;
      precisions.push(precision);
    }

    // Calculate geometric mean of precisions
    const product = precisions.reduce((acc, p) => acc * p, 1);
    const bleu = product ** (1 / n) * 100;

    // Brevity penalty
    const bp =
      candTokens.length > refTokens.length ? Math.exp(1 - refTokens.length / candTokens.length) : 1;

    const finalScore = bleu * bp;

    return {
      score: Math.round(finalScore),
      confidence:
        Math.min(refTokens.length, candTokens.length) /
        Math.max(refTokens.length, candTokens.length),
      details: {
        algorithm: "bleu",
        metrics: {
          bleu: finalScore / 100,
          precision_1: precisions[0] || 0,
          precision_2: precisions[1] || 0,
          precision_3: precisions[2] || 0,
          precision_4: precisions[3] || 0,
          brevityPenalty: bp,
          refLength: refTokens.length,
          candLength: candTokens.length,
        },
        explanation: `BLEU-${n}: ${(finalScore / 100).toFixed(4)} (${Math.round(finalScore)}/100) with brevity penalty ${bp.toFixed(4)}`,
      },
    };
  }

  /**
   * Combined scoring algorithm that weights multiple metrics.
   */
  static combinedScore(text1: string, text2: string, options: ScoringOptions = {}): ScoringResult {
    const weights = {
      semantic: 0.4,
      syntactic: 0.3,
      length: 0.3,
      ...options.weights,
    };

    // Calculate individual scores
    const cosine = ScoringAlgorithms.cosineSimilarity(text1, text2);
    const levenshtein = ScoringAlgorithms.levenshteinDistance(text1, text2);
    const jaccard = ScoringAlgorithms.jaccardSimilarity(text1, text2);

    // Normalize scores to 0-1 range
    const normalizedCosine = cosine.score / 100;
    const normalizedLevenshtein = levenshtein.score / 100;
    const normalizedJaccard = jaccard.score / 100;

    // Calculate length penalty
    const lengthPenalty = ScoringAlgorithms.calculateLengthPenalty(text1, text2);

    // Weighted combination
    const combinedScore =
      (weights.semantic * normalizedCosine +
        weights.syntactic * normalizedLevenshtein +
        weights.length * normalizedJaccard) *
      (1 - lengthPenalty);

    const finalScore = Math.round(combinedScore * 100);

    return {
      score: finalScore,
      confidence: (cosine.confidence + levenshtein.confidence + jaccard.confidence) / 3,
      details: {
        algorithm: "combined",
        metrics: {
          cosine: normalizedCosine,
          levenshtein: normalizedLevenshtein,
          jaccard: normalizedJaccard,
          lengthPenalty,
          weight_semantic: weights.semantic,
          weight_syntactic: weights.syntactic,
          weight_length: weights.length,
        },
        explanation: `Combined score: ${finalScore}/100 (semantic: ${Math.round(normalizedCosine * 100)}, syntactic: ${Math.round(normalizedLevenshtein * 100)}, length: ${Math.round(normalizedJaccard * 100)}, penalty: ${Math.round(lengthPenalty * 100)}%)`,
      },
    };
  }

  /**
   * Tokenize text into words.
   */
  private static tokenize(text: string): string[] {
    // Simple tokenization - split on whitespace and punctuation
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Replace non-word chars with space
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Create TF-IDF vector for tokens.
   */
  private static createTFIDFVector(tokens: string[], vocabulary: string[]): number[] {
    const tf: Record<string, number> = {};
    const totalTokens = tokens.length;

    // Calculate term frequency
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }

    // Create vector
    return vocabulary.map((token) => {
      const tfValue = tf[token] || 0;
      return tfValue / totalTokens;
    });
  }

  /**
   * Calculate Levenshtein distance using dynamic programming.
   */
  private static calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + 1, // substitution
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get n-grams from token array.
   */
  private static getNGrams(tokens: string[], n: number): Set<string> {
    const ngrams = new Set<string>();

    if (tokens.length < n) {
      return ngrams;
    }

    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(" ");
      ngrams.add(ngram);
    }

    return ngrams;
  }

  /**
   * Calculate length penalty for score normalization.
   */
  private static calculateLengthPenalty(text1: string, text2: string): number {
    const length1 = text1.length;
    const length2 = text2.length;
    const maxLength = Math.max(length1, length2);
    const minLength = Math.min(length1, length2);

    if (maxLength === 0) return 0;

    return (maxLength - minLength) / maxLength;
  }

  /**
   * Score multiple text pairs in batch.
   */
  static batchScore(
    pairs: Array<{ text1: string; text2: string }>,
    options: ScoringOptions = {},
  ): ScoringResult[] {
    return pairs.map((pair) => {
      switch (options.algorithm || "combined") {
        case "cosine":
          return ScoringAlgorithms.cosineSimilarity(pair.text1, pair.text2);
        case "levenshtein":
          return ScoringAlgorithms.levenshteinDistance(pair.text1, pair.text2);
        case "jaccard":
          return ScoringAlgorithms.jaccardSimilarity(pair.text1, pair.text2);
        case "bleu":
          return ScoringAlgorithms.bleuScore(pair.text1, pair.text2);
        default:
          return ScoringAlgorithms.combinedScore(pair.text1, pair.text2, options);
      }
    });
  }

  /**
   * Get algorithm recommendations based on text characteristics.
   */
  static getRecommendation(
    text1: string,
    text2: string,
  ): {
    recommended: "cosine" | "levenshtein" | "combined";
    reasoning: string;
    alternatives: Array<{ algorithm: string; reason: string }>;
  } {
    const tokens1 = ScoringAlgorithms.tokenize(text1);
    const tokens2 = ScoringAlgorithms.tokenize(text2);
    const avgLength = (tokens1.length + tokens2.length) / 2;

    const recommendations = [];
    const alternatives = [];

    // For short texts, Levenshtein is good
    if (avgLength < 10) {
      recommendations.push({
        algorithm: "levenshtein",
        reason: "Short texts benefit from character-level comparison",
      });
    } else {
      alternatives.push({
        algorithm: "levenshtein",
        reason: "Character-level comparison for detailed analysis",
      });
    }

    // For texts with shared vocabulary, cosine is good
    const tokenSet2 = new Set(tokens2);
    const intersection = new Set([...tokens1].filter((x) => tokenSet2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    const overlap = intersection.size / union.size;

    if (overlap > 0.3) {
      recommendations.push({
        algorithm: "cosine",
        reason: "High vocabulary overlap suggests semantic similarity",
      });
    } else {
      alternatives.push({
        algorithm: "cosine",
        reason: "Semantic similarity for different vocabularies",
      });
    }

    // For evaluation purposes, combined is always recommended
    recommendations.push({
      algorithm: "combined",
      reason: "Balanced approach for comprehensive evaluation",
    });

    alternatives.push({
      algorithm: "jaccard",
      reason: "Token overlap measurement",
    });

    alternatives.push({
      algorithm: "bleu",
      reason: "N-gram precision for structured text",
    });

    return {
      recommended: recommendations[0].algorithm as "cosine" | "levenshtein" | "combined",
      reasoning: recommendations[0].reason,
      alternatives,
    };
  }
}

// Convenience functions
export const scoreText = (
  text1: string,
  text2: string,
  options?: ScoringOptions,
): ScoringResult => {
  return ScoringAlgorithms.combinedScore(text1, text2, options);
};

export const compareTexts = (
  pairs: Array<{ text1: string; text2: string }>,
  options?: ScoringOptions,
): ScoringResult[] => {
  return ScoringAlgorithms.batchScore(pairs, options);
};

export const getScoringRecommendation = (text1: string, text2: string) => {
  return ScoringAlgorithms.getRecommendation(text1, text2);
};
