/**
 * Quality Score API
 *
 * GET /api/quality?evaluationId=&action=latest&baseline=published|previous|production
 * GET /api/quality?evaluationId=&action=trend&model=&limit=20 — trend
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { qualityScores, evaluations, evaluationRuns } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound } from '@/lib/api/errors';
import { SCOPES } from '@/lib/auth/scopes';

type BaselineMode = 'published' | 'previous' | 'production';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);
  const evaluationId = parseInt(searchParams.get('evaluationId') || '');
  const action = searchParams.get('action') || 'latest';
  const baselineParam = searchParams.get('baseline') || 'published';
  const baseline: BaselineMode =
    baselineParam === 'previous' || baselineParam === 'production'
      ? baselineParam
      : 'published';

  if (isNaN(evaluationId)) {
    return validationError('evaluationId query parameter is required');
  }

  // Verify eval belongs to org
  const [evaluation] = await db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, ctx.organizationId)))
    .limit(1);

  if (!evaluation) {
    return notFound('Evaluation not found');
  }

  if (action === 'latest') {
    const [latest] = await db
      .select()
      .from(qualityScores)
      .where(and(
        eq(qualityScores.evaluationId, evaluationId),
        eq(qualityScores.organizationId, ctx.organizationId),
      ))
      .orderBy(desc(qualityScores.createdAt), desc(qualityScores.id))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ score: null, message: 'No quality scores computed yet' });
    }

    // Resolve baseline run by mode (org-scoped, deterministic ordering)
    let baselineRunId: number | null = null;

    if (baseline === 'published' && evaluation.publishedRunId) {
      baselineRunId = evaluation.publishedRunId;
    } else if (baseline === 'previous') {
      // Latest run by createdAt desc, id desc excluding current
      const prevRuns = await db
        .select({ id: evaluationRuns.id })
        .from(evaluationRuns)
        .where(
          and(
            eq(evaluationRuns.evaluationId, evaluationId),
            eq(evaluationRuns.organizationId, ctx.organizationId),
            sql`${evaluationRuns.id} != ${latest.evaluationRunId}`,
          ),
        )
        .orderBy(desc(evaluationRuns.createdAt), desc(evaluationRuns.id))
        .limit(1);
      baselineRunId = prevRuns[0]?.id ?? null;
    } else if (baseline === 'production') {
      const prodRuns = await db
        .select({ id: evaluationRuns.id })
        .from(evaluationRuns)
        .where(
          and(
            eq(evaluationRuns.evaluationId, evaluationId),
            eq(evaluationRuns.organizationId, ctx.organizationId),
            eq(evaluationRuns.environment, 'prod'),
          ),
        )
        .orderBy(desc(evaluationRuns.createdAt), desc(evaluationRuns.id))
        .limit(1);
      baselineRunId = prodRuns[0]?.id ?? null;
    }

    let baselineScore: number | null = null;
    let regressionDelta: number | null = null;
    let baselineMissing: boolean = false;

    if (baselineRunId != null) {
      const [baselineQs] = await db
        .select()
        .from(qualityScores)
        .where(and(
          eq(qualityScores.evaluationRunId, baselineRunId),
          eq(qualityScores.organizationId, ctx.organizationId),
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

    return NextResponse.json({
      ...latest,
      baselineScore,
      regressionDelta,
      regressionDetected: regressionDelta !== null && regressionDelta <= -5,
      ...(baselineMissing && { baselineMissing: true }),
    });
  }

  if (action === 'trend') {
    const model = searchParams.get('model') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const conditions = [
      eq(qualityScores.evaluationId, evaluationId),
      eq(qualityScores.organizationId, ctx.organizationId),
    ];

    if (model) {
      conditions.push(eq(qualityScores.model, model));
    }

    const trend = await db
      .select()
      .from(qualityScores)
      .where(and(...conditions))
      .orderBy(desc(qualityScores.createdAt))
      .limit(limit);

    return NextResponse.json({ data: trend.reverse(), count: trend.length });
  }

  return validationError('action must be "latest" or "trend"');
}, { requiredScopes: [SCOPES.RUNS_READ] });
