/**
 * AI Quality Score Calculator
 * Calculates overall quality metrics for AI models
 */

export interface QualityMetrics {
  accuracy: number;      // 0-100
  safety: number;        // 0-100
  latency: number;       // 0-100 (lower ms = higher score)
  cost: number;          // 0-100 (lower cost = higher score)
  consistency: number;   // 0-100
}

export interface QualityScore {
  overall: number;       // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  metrics: QualityMetrics;
  trend: number;         // percentage change vs previous period
  insights: string[];
  recommendations: string[];
  shareableLink?: string;
}

export interface EvaluationStats {
  totalEvaluations: number;
  passedEvaluations: number;
  failedEvaluations: number;
  averageLatency: number;      // in ms
  averageCost: number;         // in dollars
  averageScore: number;        // 0-100
  consistencyScore: number;    // 0-100 (std deviation based)
}

/**
 * Calculate AI Quality Score from evaluation statistics
 */
export function calculateQualityScore(
  stats: EvaluationStats,
  previousStats?: EvaluationStats
): QualityScore {
  // Calculate individual metrics
  const metrics: QualityMetrics = {
    accuracy: calculateAccuracyScore(stats),
    safety: calculateSafetyScore(stats),
    latency: calculateLatencyScore(stats),
    cost: calculateCostScore(stats),
    consistency: stats.consistencyScore || 0,
  };

  // Calculate overall score (weighted average)
  const weights = {
    accuracy: 0.35,    // 35%
    safety: 0.25,      // 25%
    latency: 0.15,     // 15%
    cost: 0.15,        // 15%
    consistency: 0.10, // 10%
  };

  const overall = Math.round(
    metrics.accuracy * weights.accuracy +
    metrics.safety * weights.safety +
    metrics.latency * weights.latency +
    metrics.cost * weights.cost +
    metrics.consistency * weights.consistency
  );

  // Calculate trend
  let trend = 0;
  if (previousStats) {
    const previousOverall = calculateQualityScore(previousStats).overall;
    trend = Math.round(((overall - previousOverall) / previousOverall) * 100);
  }

  // Generate grade
  const grade = calculateGrade(overall);

  // Generate insights
  const insights = generateInsights(metrics, stats);

  // Generate recommendations
  const recommendations = generateRecommendations(metrics, stats);

  return {
    overall,
    grade,
    metrics,
    trend,
    insights,
    recommendations,
  };
}

/**
 * Calculate accuracy score from pass/fail ratio
 */
function calculateAccuracyScore(stats: EvaluationStats): number {
  if (stats.totalEvaluations === 0) return 0;
  
  const passRate = stats.passedEvaluations / stats.totalEvaluations;
  return Math.round(passRate * 100);
}

/**
 * Calculate safety score (inverse of failure rate + severity)
 */
function calculateSafetyScore(stats: EvaluationStats): number {
  if (stats.totalEvaluations === 0) return 100;
  
  const failureRate = stats.failedEvaluations / stats.totalEvaluations;
  
  // Safety score: high when failures are low
  // Penalize more heavily for high failure rates
  const safetyScore = 100 - (failureRate * 120); // Max penalty of 120
  
  return Math.max(0, Math.round(safetyScore));
}

/**
 * Calculate latency score (lower latency = higher score)
 */
function calculateLatencyScore(stats: EvaluationStats): number {
  const avgLatency = stats.averageLatency || 1000;
  
  // Score based on latency thresholds
  // < 100ms = 100
  // < 500ms = 90
  // < 1000ms = 80
  // < 2000ms = 60
  // < 5000ms = 40
  // > 5000ms = 20
  
  if (avgLatency < 100) return 100;
  if (avgLatency < 500) return 100 - Math.round((avgLatency - 100) / 40);
  if (avgLatency < 1000) return 90 - Math.round((avgLatency - 500) / 50);
  if (avgLatency < 2000) return 80 - Math.round((avgLatency - 1000) / 50);
  if (avgLatency < 5000) return 60 - Math.round((avgLatency - 2000) / 150);
  return 20;
}

/**
 * Calculate cost efficiency score (lower cost = higher score)
 */
function calculateCostScore(stats: EvaluationStats): number {
  const avgCost = stats.averageCost || 0.01;
  
  // Score based on cost per evaluation
  // < $0.001 = 100
  // < $0.01 = 90
  // < $0.05 = 70
  // < $0.10 = 50
  // > $0.10 = 30
  
  if (avgCost < 0.001) return 100;
  if (avgCost < 0.01) return 90;
  if (avgCost < 0.05) return 70;
  if (avgCost < 0.10) return 50;
  return Math.max(30, Math.round(100 - (avgCost * 700)));
}

/**
 * Calculate letter grade from overall score
 */
function calculateGrade(score: number): QualityScore['grade'] {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Generate insights based on metrics
 */
function generateInsights(metrics: QualityMetrics, stats: EvaluationStats): string[] {
  const insights: string[] = [];

  // Accuracy insights
  if (metrics.accuracy >= 95) {
    insights.push('🎯 Excellent accuracy - Your model is performing very well');
  } else if (metrics.accuracy >= 80) {
    insights.push('✅ Good accuracy - Minor improvements possible');
  } else if (metrics.accuracy >= 60) {
    insights.push('⚠️ Moderate accuracy - Consider prompt optimization');
  } else {
    insights.push('🚨 Low accuracy - Immediate attention required');
  }

  // Safety insights
  if (metrics.safety >= 90) {
    insights.push('🛡️ High safety score - Minimal harmful outputs detected');
  } else if (metrics.safety < 70) {
    insights.push('⚠️ Safety concerns detected - Review failed evaluations');
  }

  // Latency insights
  if (metrics.latency >= 90) {
    insights.push('⚡ Fast response times - Great user experience');
  } else if (metrics.latency < 60) {
    insights.push('🐌 High latency detected - Consider model optimization');
  }

  // Cost insights
  if (metrics.cost >= 80) {
    insights.push('💰 Cost-efficient operations');
  } else if (metrics.cost < 50) {
    insights.push('💸 High costs detected - Review model selection');
  }

  // Consistency insights
  if (metrics.consistency >= 85) {
    insights.push('📊 Highly consistent results');
  } else if (metrics.consistency < 60) {
    insights.push('📉 Inconsistent outputs - Consider prompt refinement');
  }

  // Volume insights
  if (stats.totalEvaluations > 10000) {
    insights.push(`📈 ${stats.totalEvaluations.toLocaleString()} evaluations - High confidence in metrics`);
  }

  return insights;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(metrics: QualityMetrics, stats: EvaluationStats): string[] {
  const recommendations: string[] = [];

  // Accuracy recommendations
  if (metrics.accuracy < 80) {
    recommendations.push('Add more specific instructions to your prompts');
    recommendations.push('Include examples in your system prompt');
    recommendations.push('Consider using few-shot learning');
  }

  // Safety recommendations
  if (metrics.safety < 80) {
    recommendations.push('Implement content filtering for harmful outputs');
    recommendations.push('Add safety guidelines to system prompts');
    recommendations.push('Review and update your evaluation rubric');
  }

  // Latency recommendations
  if (metrics.latency < 70) {
    recommendations.push('Consider using a faster model (e.g., GPT-3.5 instead of GPT-4)');
    recommendations.push('Reduce max_tokens in your API calls');
    recommendations.push('Implement response streaming for better UX');
  }

  // Cost recommendations
  if (metrics.cost < 60) {
    recommendations.push('Switch to more cost-effective models for simple tasks');
    recommendations.push('Implement prompt caching to reduce redundant calls');
    recommendations.push('Set lower max_tokens limits where appropriate');
  }

  // Consistency recommendations
  if (metrics.consistency < 70) {
    recommendations.push('Set temperature to 0 for more deterministic outputs');
    recommendations.push('Use more specific and structured prompts');
    recommendations.push('Add output format examples to your prompts');
  }

  // If everything is good, provide optimization tips
  if (recommendations.length === 0) {
    recommendations.push('Continue monitoring for regressions');
    recommendations.push('Run A/B tests on prompt variations');
    recommendations.push('Expand test coverage to edge cases');
  }

  return recommendations;
}

/**
 * Generate shareable link for quality score
 */
export function generateShareableLink(
  organizationId: number,
  evaluationId: number
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://evalai.com';
  return `${baseUrl}/share/${organizationId}/${evaluationId}`;
}

/**
 * Calculate consistency score from evaluation results
 */
export function calculateConsistency(scores: number[]): number {
  if (scores.length < 2) return 100;

  // Calculate standard deviation
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Convert to 0-100 score (lower std dev = higher consistency)
  // Max acceptable std dev is 20 points
  const consistencyScore = Math.max(0, 100 - (stdDev * 5));

  return Math.round(consistencyScore);
}

