import { NextRequest, NextResponse } from 'next/server';
import { checkFeature, trackFeature } from '@/lib/autumn-server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, internalError, quotaExceeded } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { sanitizeSearchInput, createTraceBodySchema } from '@/lib/validation';
import { traceService } from '@/lib/services/trace.service';
import * as Sentry from '@sentry/nextjs';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') ?? undefined;
    const searchRaw = searchParams.get('search');
    const search = searchRaw ? sanitizeSearchInput(searchRaw) : undefined;

    const results = await traceService.list(ctx.organizationId, {
      limit,
      offset,
      status,
      search,
    });

    return NextResponse.json(results, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    return internalError();
  }
}, { rateLimit: 'free' });

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const featureCheck = await checkFeature({
    userId: ctx.userId,
    featureId: 'traces',
    requiredBalance: 1,
  });

  if (!featureCheck.allowed) {
    return quotaExceeded('Traces limit reached. Upgrade your plan to increase quota.', {
      featureId: 'traces',
      remaining: featureCheck.remaining ?? 0,
    });
  }

  const orgLimitCheck = await checkFeature({
    userId: ctx.userId,
    featureId: 'traces_per_project',
    requiredBalance: 1,
  });

  if (!orgLimitCheck.allowed) {
    return quotaExceeded("You've reached your trace limit for this organization. Please upgrade your plan.");
  }

  const parsed = await parseBody(req, createTraceBodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { name, traceId, status, durationMs, metadata } = parsed.data;

    const newTrace = await traceService.create(ctx.organizationId, {
      name,
      traceId,
      status,
      durationMs,
      metadata,
    });

    await trackFeature({
      userId: ctx.userId,
      featureId: 'traces',
      value: 1,
      idempotencyKey: `trace-${newTrace[0].id}-${Date.now()}`,
    });

    await trackFeature({
      userId: ctx.userId,
      featureId: 'traces_per_project',
      value: 1,
      idempotencyKey: `trace-org-${ctx.organizationId}-${newTrace[0].id}-${Date.now()}`,
    });

    return NextResponse.json(newTrace[0], { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    return internalError();
  }
}, { rateLimit: 'free' });

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const featureCheck = await checkFeature({
    userId: ctx.userId,
    featureId: 'trace_deletion',
    requiredBalance: 1,
  });

  if (!featureCheck.allowed) {
    return quotaExceeded('Trace deletion limit reached. Upgrade your plan to increase quota.', {
      featureId: 'trace_deletion',
      remaining: featureCheck.remaining ?? 0,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return validationError('Valid ID is required');
    }

    const removed = await traceService.remove(ctx.organizationId, parseInt(id));

    if (!removed) {
      return notFound('Trace not found');
    }

    return NextResponse.json({ message: 'Trace deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    return internalError();
  }
}, { rateLimit: 'free' });
