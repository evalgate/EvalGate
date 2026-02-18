/**
 * Quality Score Service
 * Business logic for quality score latest/trend queries.
 * Extracted from src/app/api/quality/route.ts
 */

import { db } from '@/db';
import { qualityScores, evaluations, evaluationRuns } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export type BaselineMode = 'published' | 'previous' | 'production';

export type QualityLatestResult = {
  score: null;
  message: string;
} | {
  id: number;
  evaluationRunId: number;
  evaluationId: number;
  organizationId: number;
  score: number;
  total: number | null;
  traceCoverageRate: string | null;
  provenanceCoverageRate: string | null;
  breakdown: unknown;
  flags: unknown;
  evidenceLevel: string | null;
  scoringVersion: string;
  model: string | null;
  createdAt: string;
  baselineScore: number | null;
  regressionDelta: number | null;
  regressionDetected: boolean;
  baselineMissing?: boolean;
};

export type QualityTrendResult = {
  data: Array<{
    id: number;
    evaluationRunId: number;
    evaluationId: number;
    organizationId: number;
    score: number;
    total: number | null;
    traceCoverageRate: string | null;
    provenanceCoverageRate: string | null;
    breakdown: unknown;
    flags: unknown;
    evidenceLevel: string | null;
    scoringVersion: string;
    model: string | null;
    createdAt: string;
  }>;
  count: number;
};

export const qualityService = {
  /**
   * Get latest quality score for an evaluation.
   * Returns null if evaluation not found or not in org.
   */
  async latest(
    organizationId: number,
    evaluationId: number,
    opts?: { baseline?: BaselineMode },
  ): Promise<QualityLatestResult | null> {
    const baseline = opts?.baseline ?? 'published';

    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(
        eq(evaluations.id, evaluationId),
        eq(evaluations.organizationId, organizationId),
      ))
      .limit(1);

    if (!evaluation) return null;

    const [latest] = await db
      .select()
      .from(qualityScores)
      .where(and(
        eq(qualityScores.evaluationId, evaluationId),
        eq(qualityScores.organizationId, organizationId),
      ))
      .orderBy(desc(qualityScores.createdAt), desc(qualityScores.id))
      .limit(1);

    if (!latest) {
      return { score: null, message: 'No quality scores computed yet' };
    }

    let baselineRunId: number | null = null;

    if (baseline === 'published' && evaluation.publishedRunId) {
      baselineRunId = evaluation.publishedRunId;
    } else if (baseline === 'previous') {
      const prevRuns = await db
        .select({ id: evaluationRuns.id })
        .from(evaluationRuns)
        .where(and(
          eq(evaluationRuns.evaluationId, evaluationId),
          eq(evaluationRuns.organizationId, organizationId),
          sql`${evaluationRuns.id} != ${latest.evaluationRunId}`,
        ))
        .orderBy(desc(evaluationRuns.createdAt), desc(evaluationRuns.id))
        .limit(1);
      baselineRunId = prevRuns[0]?.id ?? null;
    } else if (baseline === 'production') {
      const prodRuns = await db
        .select({ id: evaluationRuns.id })
        .from(evaluationRuns)
        .where(and(
          eq(evaluationRuns.evaluationId, evaluationId),
          eq(evaluationRuns.organizationId, organizationId),
          eq(evaluationRuns.environment, 'prod'),
          sql`${evaluationRuns.id} != ${latest.evaluationRunId}`,
        ))
        .orderBy(desc(evaluationRuns.createdAt), desc(evaluationRuns.id))
        .limit(1);
      baselineRunId = prodRuns[0]?.id ?? null;
    }

    let baselineScore: number | null = null;
    let regressionDelta: number | null = null;
    let baselineMissing = false;

    if (baselineRunId != null) {
      const [baselineQs] = await db
        .select()
        .from(qualityScores)
        .where(and(
          eq(qualityScores.evaluationRunId, baselineRunId),
          eq(qualityScores.organizationId, organizationId),
        ))
        .limit(1);

      if (baselineQs) {
        baselineScore = baselineQs.score;
        regressionDelta = latest.score - baselineQs.score;
      } else {
        baselineMissing = true;
      }
    } else {
      baselineMissing = baseline === 'published' && !evaluation.publishedRunId;
      if (baseline === 'previous' || baseline === 'production') {
        baselineMissing = true;
      }
    }

    return {
      ...latest,
      baselineScore,
      regressionDelta,
      regressionDetected: regressionDelta !== null && regressionDelta <= -5,
      ...(baselineMissing && { baselineMissing: true }),
    };
  },

  /**
   * Get quality score trend for an evaluation.
   * Returns null if evaluation not found or not in org.
   */
  async trend(
    organizationId: number,
    evaluationId: number,
    opts?: { model?: string; limit?: number },
  ): Promise<QualityTrendResult | null> {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(
        eq(evaluations.id, evaluationId),
        eq(evaluations.organizationId, organizationId),
      ))
      .limit(1);

    if (!evaluation) return null;

    const limit = Math.min(opts?.limit ?? 20, 100);
    const conditions = [
      eq(qualityScores.evaluationId, evaluationId),
      eq(qualityScores.organizationId, organizationId),
    ];

    if (opts?.model) {
      conditions.push(eq(qualityScores.model, opts.model));
    }

    const trend = await db
      .select()
      .from(qualityScores)
      .where(and(...conditions))
      .orderBy(desc(qualityScores.createdAt))
      .limit(limit);

    return { data: trend.reverse(), count: trend.length };
  },
};
