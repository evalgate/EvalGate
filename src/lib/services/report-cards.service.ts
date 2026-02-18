// src/lib/services/report-cards.service.ts

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  evaluationRuns,
  evaluations,
  llmJudgeResults,
  organizations,
  testResults,
} from "@/db/schema";
import { logger } from "@/lib/logger";

export interface ReportCardData {
  evaluationId: number;
  evaluationName: string;
  evaluationType: string;
  organizationId: number;
  organizationName: string;
  totalRuns: number;
  completedRuns: number;
  averageScore: number;
  passRate: number;
  averageDuration: number;
  totalCost: number;
  lastRunAt: string;
  createdAt: string;
  performance: {
    scoreDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
    durationStats: {
      min: number;
      max: number;
      avg: number;
      p95: number;
    };
    costStats: {
      min: number;
      max: number;
      avg: number;
      total: number;
    };
  };
  quality: {
    judgeResults: {
      totalJudged: number;
      averageJudgeScore: number;
      passedJudged: number;
      failedJudged: number;
    };
    consistency: {
      scoreVariance: number;
      scoreStdDev: number;
      coefficientOfVariation: number;
    };
  };
  trends: {
    recentPerformance: Array<{
      runId: number;
      score: number;
      completedAt: string;
    }>;
    scoreTrend: "improving" | "declining" | "stable";
    performanceChange: number;
  };
  metadata: Record<string, any>;
}

export interface ReportCardSummary {
  evaluationId: number;
  evaluationName: string;
  overallScore: number;
  grade: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";
  status: "excellent" | "good" | "fair" | "poor";
  lastUpdated: string;
  keyMetrics: {
    averageScore: number;
    passRate: number;
    totalRuns: number;
    averageDuration: number;
  };
}

/**
 * Report Cards Service
 * Generates comprehensive evaluation reports with grading and insights.
 * This is the core of the "Report Cards" viral feature.
 */
export class ReportCardsService {
  /**
   * Generate a comprehensive report card for an evaluation.
   */
  async generateReportCard(evaluationId: number, organizationId: number): Promise<ReportCardData> {
    logger.info("Generating report card", { evaluationId, organizationId });

    // Get evaluation details
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!evaluation) {
      throw new Error("Evaluation not found or access denied");
    }

    // Get organization details
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    // Get all runs for this evaluation
    const runs = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.evaluationId, evaluationId))
      .orderBy(desc(evaluationRuns.createdAt));

    // Get test results for all runs
    const runIds = runs.map((r) => r.id);
    const testResultsData =
      runIds.length > 0
        ? await db.select().from(testResults).where(inArray(testResults.evaluationRunId, runIds))
        : [];

    // Get judge results for all runs
    const judgeResultsData =
      runIds.length > 0
        ? await db
            .select()
            .from(llmJudgeResults)
            .where(inArray(llmJudgeResults.evaluationRunId, runIds))
        : [];

    // Calculate performance metrics
    const performance = this.calculatePerformance(testResultsData);

    // Calculate quality metrics
    const quality = this.calculateQuality(judgeResultsData);

    // Calculate trends
    const trends = this.calculateTrends(runs, testResultsData);

    // Calculate overall statistics
    const stats = this.calculateOverallStats(runs, testResultsData);

    return {
      evaluationId,
      evaluationName: evaluation.name,
      evaluationType: evaluation.type,
      organizationId,
      organizationName: organization?.name || "Unknown",
      totalRuns: runs.length,
      completedRuns: runs.filter((r) => ["completed", "completed_with_failures"].includes(r.status))
        .length,
      averageScore: stats.averageScore,
      passRate: stats.passRate,
      averageDuration: stats.averageDuration,
      totalCost: stats.totalCost,
      lastRunAt: runs.length > 0 ? runs[0].createdAt : "",
      createdAt: evaluation.createdAt,
      performance,
      quality,
      trends,
      metadata: {
        generatedAt: new Date().toISOString(),
        dataPoints: testResultsData.length,
        judgeDataPoints: judgeResultsData.length,
      },
    };
  }

  /**
   * Generate a summary report card.
   */
  async generateReportCardSummary(
    evaluationId: number,
    organizationId: number,
  ): Promise<ReportCardSummary> {
    const reportCard = await this.generateReportCard(evaluationId, organizationId);

    const overallScore = this.calculateOverallScore(reportCard);
    const grade = this.calculateGrade(overallScore);
    const status = this.getStatus(grade);

    return {
      evaluationId: reportCard.evaluationId,
      evaluationName: reportCard.evaluationName,
      overallScore,
      grade,
      status,
      lastUpdated: reportCard.metadata.generatedAt,
      keyMetrics: {
        averageScore: reportCard.averageScore,
        passRate: reportCard.passRate,
        totalRuns: reportCard.totalRuns,
        averageDuration: reportCard.averageDuration,
      },
    };
  }

  /**
   * Get report cards for an organization.
   */
  async getReportCards(
    organizationId: number,
    options?: {
      limit?: number;
      offset?: number;
      evaluationType?: string;
    },
  ): Promise<ReportCardSummary[]> {
    // Get evaluations for the organization
    const evaluationsData = await db
      .select({
        id: evaluations.id,
        name: evaluations.name,
        type: evaluations.type,
        createdAt: evaluations.createdAt,
      })
      .from(evaluations)
      .where(
        options?.evaluationType
          ? and(
              eq(evaluations.organizationId, organizationId),
              eq(evaluations.type, options.evaluationType),
            )
          : eq(evaluations.organizationId, organizationId),
      )
      .orderBy(desc(evaluations.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    // Generate report card summaries for each evaluation
    const reportCards: ReportCardSummary[] = [];

    for (const evaluation of evaluationsData) {
      try {
        const summary = await this.generateReportCardSummary(evaluation.id, organizationId);
        reportCards.push(summary);
      } catch (error) {
        logger.error(`Failed to generate report card for evaluation ${evaluation.id}`, error);
      }
    }

    return reportCards;
  }

  /**
   * Calculate performance metrics.
   */
  private calculatePerformance(testResults: any[]): ReportCardData["performance"] {
    if (testResults.length === 0) {
      return {
        scoreDistribution: {},
        statusDistribution: {},
        durationStats: { min: 0, max: 0, avg: 0, p95: 0 },
        costStats: { min: 0, max: 0, avg: 0, total: 0 },
      };
    }

    // Score distribution
    const scoreDistribution: Record<string, number> = {};
    const scoreRanges = [
      { range: "0-20", min: 0, max: 20 },
      { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 },
      { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];

    for (const range of scoreRanges) {
      scoreDistribution[range.range] = testResults.filter(
        (r) => r.score && r.score >= range.min && r.score <= range.max,
      ).length;
    }

    // Status distribution
    const statusDistribution: Record<string, number> = {};
    for (const result of testResults) {
      statusDistribution[result.status] = (statusDistribution[result.status] || 0) + 1;
    }

    // Duration stats
    const durations = testResults
      .map((r) => r.durationMs || 0)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);

    const durationStats = {
      min: durations.length > 0 ? durations[0] : 0,
      max: durations.length > 0 ? durations[durations.length - 1] : 0,
      avg: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
      p95: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0,
    };

    // Cost stats
    const costs = testResults
      .map((r) => this.extractCost(r))
      .filter((c) => c > 0)
      .sort((a, b) => a - b);

    const costStats = {
      min: costs.length > 0 ? costs[0] : 0,
      max: costs.length > 0 ? costs[costs.length - 1] : 0,
      avg: costs.length > 0 ? costs.reduce((sum, c) => sum + c, 0) / costs.length : 0,
      total: costs.reduce((sum, c) => sum + c, 0),
    };

    return {
      scoreDistribution,
      statusDistribution,
      durationStats,
      costStats,
    };
  }

  /**
   * Calculate quality metrics.
   */
  private calculateQuality(judgeResults: any[]): ReportCardData["quality"] {
    if (judgeResults.length === 0) {
      return {
        judgeResults: {
          totalJudged: 0,
          averageJudgeScore: 0,
          passedJudged: 0,
          failedJudged: 0,
        },
        consistency: {
          scoreVariance: 0,
          scoreStdDev: 0,
          coefficientOfVariation: 0,
        },
      };
    }

    const scores = judgeResults.map((r) => r.score || 0).filter((s) => s > 0);
    const passed = judgeResults.filter((r) => {
      try {
        const metadata = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
        return metadata?.passed === true;
      } catch {
        return false;
      }
    });

    // Calculate consistency metrics
    const mean = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
    const variance =
      scores.length > 0 ? scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length : 0;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

    return {
      judgeResults: {
        totalJudged: judgeResults.length,
        averageJudgeScore: mean,
        passedJudged: passed.length,
        failedJudged: judgeResults.length - passed.length,
      },
      consistency: {
        scoreVariance: variance,
        scoreStdDev: stdDev,
        coefficientOfVariation,
      },
    };
  }

  /**
   * Calculate trends.
   */
  private calculateTrends(runs: any[], testResults: any[]): ReportCardData["trends"] {
    const recentRuns = runs
      .filter((r) => ["completed", "completed_with_failures"].includes(r.status))
      .slice(0, 10)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const recentPerformance = recentRuns.map((run) => {
      const runResults = testResults.filter((r) => r.evaluationRunId === run.id);
      const avgScore =
        runResults.length > 0
          ? runResults.reduce((sum, r) => sum + (r.score || 0), 0) / runResults.length
          : 0;

      return {
        runId: run.id,
        score: avgScore,
        completedAt: run.completedAt || run.createdAt,
      };
    });

    // Calculate trend
    let scoreTrend: "improving" | "declining" | "stable" = "stable";
    let performanceChange = 0;

    if (recentPerformance.length >= 3) {
      const recent = recentPerformance.slice(0, 3);
      const earlier = recentPerformance.slice(3, 6);

      if (earlier.length > 0) {
        const recentAvg = recent.reduce((sum, p) => sum + p.score, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, p) => sum + p.score, 0) / earlier.length;
        performanceChange = recentAvg - earlierAvg;

        if (performanceChange > 5) scoreTrend = "improving";
        else if (performanceChange < -5) scoreTrend = "declining";
      }
    }

    return {
      recentPerformance,
      scoreTrend,
      performanceChange,
    };
  }

  /**
   * Calculate overall statistics.
   */
  private calculateOverallStats(
    runs: any[],
    testResults: any[],
  ): {
    averageScore: number;
    passRate: number;
    averageDuration: number;
    totalCost: number;
  } {
    const completedRuns = runs.filter((r) =>
      ["completed", "completed_with_failures"].includes(r.status),
    );

    if (completedRuns.length === 0) {
      return { averageScore: 0, passRate: 0, averageDuration: 0, totalCost: 0 };
    }

    const scores = testResults.map((r) => r.score || 0);
    const averageScore =
      scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

    const passedCount = testResults.filter((r) => r.status === "passed").length;
    const passRate = testResults.length > 0 ? (passedCount / testResults.length) * 100 : 0;

    const durations = testResults.map((r) => r.durationMs || 0).filter((d) => d > 0);
    const averageDuration =
      durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

    const totalCost = testResults.reduce((sum, r) => sum + this.extractCost(r), 0);

    return {
      averageScore,
      passRate,
      averageDuration,
      totalCost,
    };
  }

  /**
   * Extract cost from test result metadata.
   */
  private extractCost(testResult: any): number {
    try {
      const metadata =
        typeof testResult.metadata === "string"
          ? JSON.parse(testResult.metadata)
          : testResult.metadata;
      return metadata?.cost || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate overall score (0-100).
   */
  private calculateOverallScore(reportCard: ReportCardData): number {
    const weights = {
      averageScore: 0.4,
      passRate: 0.3,
      consistency: 0.2,
      judgeQuality: 0.1,
    };

    const normalizedScore = reportCard.averageScore;
    const normalizedPassRate = reportCard.passRate;
    const consistencyScore = Math.max(
      0,
      100 - reportCard.quality.consistency.coefficientOfVariation * 100,
    );
    const judgeQualityScore = reportCard.quality.judgeResults.averageJudgeScore;

    const overallScore =
      normalizedScore * weights.averageScore +
      normalizedPassRate * weights.passRate +
      consistencyScore * weights.consistency +
      judgeQualityScore * weights.judgeQuality;

    return Math.min(100, Math.max(0, overallScore));
  }

  /**
   * Calculate grade based on score.
   */
  private calculateGrade(score: number): ReportCardSummary["grade"] {
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 85) return "B+";
    if (score >= 80) return "B";
    if (score >= 75) return "C+";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  /**
   * Get status based on grade.
   */
  private getStatus(grade: ReportCardSummary["grade"]): ReportCardSummary["status"] {
    if (grade === "A+" || grade === "A") return "excellent";
    if (grade === "B+" || grade === "B") return "good";
    if (grade === "C+" || grade === "C") return "fair";
    return "poor";
  }

  /**
   * Get report card statistics for an organization.
   */
  async getReportCardStats(organizationId: number): Promise<{
    totalEvaluations: number;
    averageScore: number;
    gradeDistribution: Record<string, number>;
    topPerformers: Array<{
      evaluationId: number;
      evaluationName: string;
      grade: string;
      score: number;
    }>;
    recentActivity: number;
  }> {
    const reportCards = await this.getReportCards(organizationId, {
      limit: 100,
    });

    const totalEvaluations = reportCards.length;
    const averageScore =
      reportCards.length > 0
        ? reportCards.reduce((sum, card) => sum + card.overallScore, 0) / reportCards.length
        : 0;

    // Grade distribution
    const gradeDistribution: Record<string, number> = {};
    for (const card of reportCards) {
      gradeDistribution[card.grade] = (gradeDistribution[card.grade] || 0) + 1;
    }

    // Top performers
    const topPerformers = reportCards
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 5)
      .map((card) => ({
        evaluationId: card.evaluationId,
        evaluationName: card.evaluationName,
        grade: card.grade,
        score: card.overallScore,
      }));

    // Recent activity (evaluations updated in last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivity = reportCards.filter((card) => {
      const lastUpdated = new Date(card.lastUpdated);
      return lastUpdated > weekAgo;
    }).length;

    return {
      totalEvaluations,
      averageScore: Math.round(averageScore),
      gradeDistribution,
      topPerformers,
      recentActivity,
    };
  }
}

// Export singleton instance
export const reportCardsService = new ReportCardsService();
