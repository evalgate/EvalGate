import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/db';
import { evaluations, testCases, evaluationRuns, testResults, user } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { notFound, internalError } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { updateEvaluationBodySchema } from '@/lib/validation';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;

    const evaluationData = await db
      .select({
        evaluation: evaluations,
        creator: {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      })
      .from(evaluations)
      .leftJoin(user, eq(evaluations.createdBy, user.id))
      .where(and(eq(evaluations.id, parseInt(id)), eq(evaluations.organizationId, ctx.organizationId)))
      .limit(1);

    if (evaluationData.length === 0) {
      return notFound('Evaluation not found');
    }

    const evalTestCases = await db
      .select()
      .from(testCases)
      .where(eq(testCases.evaluationId, parseInt(id)));

    const formattedEvaluation = {
      ...evaluationData[0].evaluation,
      test_cases: evalTestCases,
      users: evaluationData[0].creator,
    };

    return NextResponse.json({ evaluation: formattedEvaluation });
  } catch (error) {
    return internalError('Internal server error');
  }
});

export const PATCH = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;

    const parsed = await parseBody(req, updateEvaluationBodySchema);
    if (!parsed.ok) return parsed.response;

    const { name, description } = parsed.data;
    const now = new Date().toISOString();

    const updated = await db
      .update(evaluations)
      .set({
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        updatedAt: now,
      })
      .where(and(eq(evaluations.id, parseInt(id)), eq(evaluations.organizationId, ctx.organizationId)))
      .returning();

    if (updated.length === 0) {
      return notFound('Evaluation not found');
    }

    return NextResponse.json({ evaluation: updated[0] });
  } catch (error) {
    return internalError('Internal server error');
  }
});

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;

    const existing = await db
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(and(eq(evaluations.id, parseInt(id)), eq(evaluations.organizationId, ctx.organizationId)))
      .limit(1);

    if (existing.length === 0) {
      return notFound('Evaluation not found');
    }

    const evalId = parseInt(id);

    const runs = await db.select({ id: evaluationRuns.id }).from(evaluationRuns).where(eq(evaluationRuns.evaluationId, evalId));
    for (const run of runs) {
      await db.delete(testResults).where(eq(testResults.evaluationRunId, run.id));
    }
    await db.delete(evaluationRuns).where(eq(evaluationRuns.evaluationId, evalId));
    await db.delete(testCases).where(eq(testCases.evaluationId, evalId));
    await db.delete(evaluations).where(and(eq(evaluations.id, evalId), eq(evaluations.organizationId, ctx.organizationId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError('Internal server error');
  }
});
