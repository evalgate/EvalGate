/**
 * POST /api/evaluations/:id/publish-run
 * Sets evaluations.publishedRunId = runId (admin scope).
 * Makes "published baseline" a real release artifact.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { evaluations, evaluationRuns } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { publishRunBodySchema } from '@/lib/validation';
import { logger } from '@/lib/logger';

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id);
  if (isNaN(evaluationId)) {
    return validationError('Valid evaluation ID is required');
  }

  const parsed = await parseBody(req, publishRunBodySchema);
  if (!parsed.ok) return parsed.response;

  const runId = parsed.data.runId;

  const organizationId = ctx.organizationId;

  // Verify evaluation belongs to org
  const [evalRow] = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.id, evaluationId),
        eq(evaluations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!evalRow) {
    return notFound('Evaluation not found');
  }

  // Verify run belongs to this evaluation and org
  const [runRow] = await db
    .select({ id: evaluationRuns.id })
    .from(evaluationRuns)
    .where(
      and(
        eq(evaluationRuns.id, runId),
        eq(evaluationRuns.evaluationId, evaluationId),
        eq(evaluationRuns.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!runRow) {
    return notFound('Run not found or does not belong to this evaluation');
  }

  const now = new Date().toISOString();
  await db
    .update(evaluations)
    .set({
      publishedRunId: runId,
      updatedAt: now,
    })
    .where(
      and(
        eq(evaluations.id, evaluationId),
        eq(evaluations.organizationId, organizationId)
      )
    );

  logger.info('Published run set', { evaluationId, runId, organizationId });

  return NextResponse.json({
    success: true,
    evaluationId,
    publishedRunId: runId,
  });
}, { minRole: 'admin' });
