/**
 * POST /api/evaluations/:id/runs/import
 *
 * Import local run results for an existing evaluation.
 * Creates run row, inserts test_results, computes quality score.
 * Used by openAIChatEval({ reportToEvalAI: true }) to upload local results.
 *
 * Idempotency: Send Idempotency-Key header to avoid duplicate runs on CI retries.
 * Policy: All-or-nothing — if any testCaseId is invalid, the whole request is rejected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { evaluationRuns, evaluations, testCases, testResults, qualityScores } from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, forbidden } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { importRunBodySchema } from '@/lib/validation';
import { SCOPES } from '@/lib/auth/scopes';
import { computeAndStoreQualityScore } from '@/lib/services/aggregate-metrics.service';
import { logger } from '@/lib/logger';
import { getRequestId } from '@/lib/api/request-id';

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id);

  if (isNaN(evaluationId)) {
    return validationError('Valid evaluation ID is required');
  }

  const parsed = await parseBody(req, importRunBodySchema);
  if (!parsed.ok) return parsed.response;

  const { environment, results, importClientVersion, ci } = parsed.data;
  const idempotencyKey = req.headers.get('Idempotency-Key') ?? req.headers.get('X-EvalAI-Idempotency-Key');

  // Verify evaluation exists and belongs to org
  const [evaluation] = await db
    .select()
    .from(evaluations)
    .where(and(
      eq(evaluations.id, evaluationId),
      eq(evaluations.organizationId, ctx.organizationId),
    ))
    .limit(1);

  if (!evaluation) {
    return notFound('Evaluation not found');
  }

  if (environment === 'prod') {
    const isAdmin = ctx.role === 'owner' || ctx.role === 'admin';
    const isApiKey = ctx.authType === 'apiKey';
    if (!isAdmin && !isApiKey) {
      return forbidden('Only admins or API keys can tag runs as prod');
    }
  }

  // Verify all testCaseIds belong to this evaluation
  const testCaseIds = [...new Set(results.map((r) => r.testCaseId))];
  const validCases = await db
    .select({ id: testCases.id })
    .from(testCases)
    .where(and(
      eq(testCases.evaluationId, evaluationId),
      inArray(testCases.id, testCaseIds),
    ));

  const validIds = new Set(validCases.map((c) => c.id));
  const invalid = testCaseIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return validationError(`Test case IDs not found in evaluation: ${invalid.join(', ')}`);
  }

  // Idempotency: return existing run if key provided and matches
  if (idempotencyKey?.trim()) {
    const [existing] = await db
      .select()
      .from(evaluationRuns)
      .where(and(
        eq(evaluationRuns.idempotencyKey, idempotencyKey.trim()),
        eq(evaluationRuns.evaluationId, evaluationId),
        eq(evaluationRuns.organizationId, ctx.organizationId),
      ))
      .limit(1);

    if (existing) {
      const [qs] = await db
        .select({ score: qualityScores.score, flags: qualityScores.flags })
        .from(qualityScores)
        .where(and(
          eq(qualityScores.evaluationRunId, existing.id),
          eq(qualityScores.organizationId, ctx.organizationId),
        ))
        .orderBy(desc(qualityScores.createdAt))
        .limit(1);

      const score = qs?.score ?? 0;
      const flags = (typeof qs?.flags === 'string' ? JSON.parse(qs.flags || '[]') : qs?.flags) ?? [];
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        'http://localhost:3000';
      const dashboardUrl = `${String(baseUrl).replace(/\/$/, '')}/evaluations/${evaluationId}/runs/${existing.id}`;

      return NextResponse.json(
        { runId: existing.id, score, flags, dashboardUrl },
        { status: 200 },
      );
    }
  }

  const now = new Date().toISOString();
  const requestId = getRequestId();

  // Create run (tagged as import for audit/debug; metadata in traceLog.import)
  const passedCount = results.filter((r) => r.status === 'passed').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const traceLog = JSON.stringify({
    import: {
      source: 'import',
      importedAt: now,
      clientReportedVersion: importClientVersion ?? null,
      ci: ci ?? undefined,
      serverReceivedAt: now,
      requestId,
    },
  });

  const [run] = await db
    .insert(evaluationRuns)
    .values({
      evaluationId,
      organizationId: ctx.organizationId,
      idempotencyKey: idempotencyKey?.trim() || null,
      status: 'completed',
      totalCases: results.length,
      passedCases: passedCount,
      failedCases: failedCount,
      startedAt: now,
      completedAt: now,
      environment,
      traceLog,
      createdAt: now,
    })
    .returning();

  if (!run) {
    return validationError('Failed to create run');
  }

  // Insert test results
  for (const r of results) {
    await db.insert(testResults).values({
      evaluationRunId: run.id,
      testCaseId: r.testCaseId,
      organizationId: ctx.organizationId,
      status: r.status,
      output: r.output,
      durationMs: r.latencyMs ?? null,
      assertionsJson: r.assertionsJson ?? undefined,
      createdAt: now,
    });
  }

  // Compute quality score (synchronous so we can return it)
  let qualityResult: { score: number; flags: string[] } | null = null;
  try {
    const q = await computeAndStoreQualityScore(run.id, evaluationId, ctx.organizationId);
    qualityResult = { score: q.score, flags: q.flags };
  } catch (err) {
    logger.error('Quality score computation failed on import', {
      runId: run.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000';
  const dashboardUrl = `${String(baseUrl).replace(/\/$/, '')}/evaluations/${evaluationId}/runs/${run.id}`;

  return NextResponse.json(
    {
      runId: run.id,
      score: qualityResult?.score ?? 0,
      flags: qualityResult?.flags ?? [],
      dashboardUrl,
    },
    { status: 201 },
  );
}, { requiredScopes: [SCOPES.RUNS_WRITE] });
