/**
 * Quality Score API
 *
 * GET /api/quality?evaluationId=&action=latest&baseline=published|previous|production
 * GET /api/quality?evaluationId=&action=trend&model=&limit=20 — trend
 * POST /api/quality — recompute quality score for a run (body: { runId })
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { recomputeQualityBodySchema } from '@/lib/validation';
import { SCOPES } from '@/lib/auth/scopes';
import { qualityService, type BaselineMode } from '@/lib/services/quality.service';
import { recomputeAndStoreQualityScore } from '@/lib/services/aggregate-metrics.service';
import { SCORING_SPEC_V1, SCORING_SPEC_VERSION } from '@/lib/scoring/scoring-spec';
import { sha256Hex } from '@/lib/crypto/hash';
import { canonicalizeJson } from '@/lib/crypto/canonical-json';

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

  if (action === 'latest') {
    const result = await qualityService.latest(ctx.organizationId, evaluationId, { baseline });
    if (result === null) return notFound('Evaluation not found');
    return NextResponse.json(result);
  }

  if (action === 'trend') {
    const model = searchParams.get('model') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const result = await qualityService.trend(ctx.organizationId, evaluationId, { model, limit });
    if (result === null) return notFound('Evaluation not found');
    return NextResponse.json(result);
  }

  return validationError('action must be "latest" or "trend"');
}, { requiredScopes: [SCOPES.RUNS_READ] });

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const parsed = await parseBody(req, recomputeQualityBodySchema);
  if (!parsed.ok) return parsed.response;

  const { runId } = parsed.data;

  const result = await recomputeAndStoreQualityScore(runId, ctx.organizationId);

  if (result === null) {
    return notFound('Run not found');
  }

  const scoringSpecHash = sha256Hex(canonicalizeJson(SCORING_SPEC_V1));

  return NextResponse.json({
    success: true,
    runId,
    score: result.score,
    breakdown: result.breakdown,
    flags: result.flags,
    evidenceLevel: result.evidenceLevel,
    scoringVersion: SCORING_SPEC_VERSION,
    scoringSpecHash,
  }, { status: 200 });
}, { requiredScopes: [SCOPES.RUNS_WRITE] });
