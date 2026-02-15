import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traceSpans, traces } from '@/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { requireAuthWithOrg } from '@/lib/autumn-server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate and resolve org from user membership (app-layer RLS)
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { id } = await params;
    const traceId = parseInt(id);

    if (isNaN(traceId)) {
      return NextResponse.json({ 
        error: "Valid trace ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const spans = await db.select()
      .from(traceSpans)
      .where(eq(traceSpans.traceId, traceId))
      .orderBy(asc(traceSpans.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(spans);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate and resolve org from user membership (app-layer RLS)
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { id } = await params;
    const traceId = parseInt(id);

    if (isNaN(traceId)) {
      return NextResponse.json({ 
        error: "Valid trace ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const { spanId, name, type, parentSpanId, input, output, durationMs, metadata } = body;

    if (!spanId || !name || !type) {
      return NextResponse.json({ 
        error: "spanId, name, and type are required",
        code: "MISSING_REQUIRED_FIELDS" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newSpan = await db.insert(traceSpans)
      .values({
        traceId,
        spanId: spanId.trim(),
        parentSpanId: parentSpanId?.trim() || null,
        name: name.trim(),
        type: type.trim(),
        input: input || null,
        output: output || null,
        durationMs: durationMs || null,
        metadata: metadata || null,
        createdAt: now,
      })
      .returning();

    return NextResponse.json(newSpan[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}