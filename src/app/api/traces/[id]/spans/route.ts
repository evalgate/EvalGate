import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { notFound, validationError, forbidden } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { createSpanBodySchema } from '@/lib/validation';
import { SCOPES } from '@/lib/auth/scopes';
import { spanService } from '@/lib/services/span.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const traceId = parseInt(params.id);

  if (isNaN(traceId)) {
    return validationError('Valid trace ID is required');
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const offset = parseInt(searchParams.get('offset') || '0');

  const result = await spanService.listByTrace(ctx.organizationId, traceId, { limit, offset });

  if (result === null) {
    return notFound('Trace not found');
  }

  return NextResponse.json(result);
}, { requiredScopes: [SCOPES.TRACES_READ] });

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const traceId = parseInt(params.id);

  if (isNaN(traceId)) {
    return validationError('Valid trace ID is required');
  }

  const parsed = await parseBody(req, createSpanBodySchema);
  if (!parsed.ok) return parsed.response;

  const {
    spanId,
    name,
    type,
    parentSpanId,
    input,
    output,
    durationMs,
    startTime,
    endTime,
    metadata,
    evaluationRunId,
  } = parsed.data;

  const result = await spanService.create(ctx.organizationId, traceId, {
    spanId,
    name,
    type,
    parentSpanId,
    input,
    output,
    durationMs,
    startTime,
    endTime,
    metadata,
    evaluationRunId,
  });

  if (typeof result === 'object' && 'ok' in result && result.ok === false) {
    if (result.reason === 'run_not_in_org') return forbidden('Run not in organization');
    return forbidden('Trace not in organization');
  }

  return NextResponse.json(result, { status: 201 });
}, { requiredScopes: [SCOPES.TRACES_WRITE] });
