import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { evaluationRuns } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const evaluationId = parseInt(id);

    if (isNaN(evaluationId)) {
      return NextResponse.json({ 
        error: "Valid evaluation ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
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
    let query = db.select()
      .from(evaluationRuns)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const runs = await query
      .orderBy(desc(evaluationRuns.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(runs);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const evaluationId = parseInt(id);

    if (isNaN(evaluationId)) {
      return NextResponse.json({ 
        error: "Valid evaluation ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const { status, totalCases, passedCases, failedCases } = body;

    const now = new Date().toISOString();
    const runData: any = {
      evaluationId,
      status: status || 'pending',
      totalCases: totalCases || 0,
      passedCases: passedCases || 0,
      failedCases: failedCases || 0,
      createdAt: now,
    };

    if (status === 'running') {
      runData.startedAt = now;
    }

    const newRun = await db.insert(evaluationRuns)
      .values(runData)
      .returning();

    return NextResponse.json(newRun[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
  }
}