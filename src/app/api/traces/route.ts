import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traces } from '@/db/schema';
import { eq, like, and, desc } from 'drizzle-orm';
import { requireFeature, trackFeature } from '@/lib/autumn-server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { getRateLimitTier } from '@/lib/rate-limit';
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const offset = parseInt(searchParams.get('offset') || '0');
      const organizationId = searchParams.get('organizationId');
      const status = searchParams.get('status');
      const search = searchParams.get('search');

      const conditions = [];

      if (organizationId) {
        conditions.push(eq(traces.organizationId, parseInt(organizationId)));
      }

      if (status) {
        conditions.push(eq(traces.status, status));
      }

      if (search) {
        conditions.push(like(traces.name, `%${search}%`));
      }

      // Build and execute the query with all conditions
      const results = await db.select()
        .from(traces)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(traces.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json(results);
    } catch (error) {
      Sentry.captureException(error);
      console.error('GET error:', error);
      return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }, { customTier: 'free' });
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    // Step 1: Check authentication and global feature allowance
    const featureCheck = await requireFeature(req, 'traces', 1);
    
    if (!featureCheck.allowed) {
      // Convert Response to NextResponse
      const responseData = await featureCheck.response.json();
      return NextResponse.json(responseData, { 
        status: featureCheck.response.status,
        headers: Object.fromEntries(featureCheck.response.headers.entries())
      });
    }

    const userId = featureCheck.userId;

    try {
      const body = await req.json();
      const { name, traceId, organizationId, status, durationMs, metadata } = body;

      if (!name || !traceId || !organizationId) {
        return NextResponse.json({ 
          error: "Name, traceId, and organizationId are required",
          code: "MISSING_REQUIRED_FIELDS" 
        }, { status: 400 });
      }

      // Step 2: Check per-organization trace limit
      const orgLimitCheck = await requireFeature(req, 'traces_per_project', 1);
      
      if (!orgLimitCheck.allowed) {
        return NextResponse.json({
          error: "You've reached your trace limit for this organization. Please upgrade your plan.",
          code: "ORGANIZATION_TRACE_LIMIT_REACHED"
        }, { status: 402 });
      }

      const now = new Date().toISOString();
      const newTrace = await db.insert(traces)
        .values({
          name: name.trim(),
          traceId: traceId.trim(),
          organizationId,
          status: status || 'pending',
          durationMs: durationMs || null,
          metadata: metadata || null,
          createdAt: now,
        })
        .returning();

      // Step 3: Track usage for BOTH global and per-organization features
      await trackFeature({
        userId,
        featureId: 'traces',
        value: 1,
        idempotencyKey: `trace-${newTrace[0].id}-${Date.now()}`,
      });

// Track per-organization trace usage
      await trackFeature({
        userId,
        featureId: 'traces_per_project',
        value: 1,
        idempotencyKey: `trace-org-${organizationId}-${newTrace[0].id}-${Date.now()}`,
      });

      return NextResponse.json(newTrace[0], { status: 201 });
    } catch (error) {
      Sentry.captureException(error);
      console.error('POST error:', error);
      return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
    }
  }, { customTier: 'free' });
}

export async function DELETE(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    // Check authentication and feature allowance first
    const featureCheck = await requireFeature(req, 'trace_deletion', 1);
    
    if (!featureCheck.allowed) {
      // Convert Response to NextResponse
      const responseData = await featureCheck.response.json();
      return NextResponse.json(responseData, { 
        status: featureCheck.response.status,
        headers: Object.fromEntries(featureCheck.response.headers.entries())
      });
    }

    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const existing = await db.select()
        .from(traces)
        .where(eq(traces.id, parseInt(id)))
        .limit(1);

      if (existing.length === 0) {
        return NextResponse.json({ 
          error: 'Trace not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      await db.delete(traces)
        .where(eq(traces.id, parseInt(id)));

      return NextResponse.json({ message: 'Trace deleted successfully' });
    } catch (error) {
      Sentry.captureException(error);
      console.error('DELETE error:', error);
      return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
    }
  }, { customTier: 'free' });
}