import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { evaluationRuns, organizationMembers, evaluations } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuthWithOrg } from '@/lib/autumn-server';
import { evaluationService } from '@/lib/services/evaluation.service';
import { logger } from '@/lib/logger';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate and resolve org from user membership (app-layer RLS)
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { id } = await params;
    const evaluationId = parseInt(id);

    if (isNaN(evaluationId)) {
      return NextResponse.json({ 
        error: "Valid evaluation ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Verify the evaluation belongs to the user's org
    const evalCheck = await db.select({ id: evaluations.id })
      .from(evaluations)
      .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, authResult.organizationId)))
      .limit(1);

    if (evalCheck.length === 0) {
      return NextResponse.json({ error: 'Evaluation not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    // Build the where conditions
    const conditions = [eq(evaluationRuns.evaluationId, evaluationId)];
    if (status) {
      conditions.push(eq(evaluationRuns.status, status));
    }
    
    // Apply all conditions at once
    const query = db.select()
      .from(evaluationRuns)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const runs = await query
      .orderBy(desc(evaluationRuns.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(runs);
  } catch (error) {
    logger.error({ error, route: '/api/evaluations/[id]/runs', method: 'GET' }, 'Error fetching runs');
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
    const evaluationId = parseInt(id);

    if (isNaN(evaluationId)) {
      return NextResponse.json({ 
        error: "Valid evaluation ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const organizationId = authResult.organizationId;
    const run = await evaluationService.run(evaluationId, organizationId);

    if (!run) {
      return NextResponse.json({ 
        error: 'Evaluation not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    logger.error({ error, route: '/api/evaluations/[id]/runs', method: 'POST' }, 'Error creating run');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
