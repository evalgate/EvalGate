import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { evaluationTestCases, evaluations } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
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
    const evaluationId = parseInt(id);

    if (isNaN(evaluationId)) {
      return NextResponse.json({ 
        error: "Valid evaluation ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const testCases = await db.select()
      .from(evaluationTestCases)
      .where(eq(evaluationTestCases.evaluationId, evaluationId))
      .orderBy(desc(evaluationTestCases.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(testCases);
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
    const evaluationId = parseInt(id);

    if (isNaN(evaluationId)) {
      return NextResponse.json({ 
        error: "Valid evaluation ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const { input, expectedOutput, metadata } = body;

    if (!input) {
      return NextResponse.json({ 
        error: "Input is required",
        code: "MISSING_INPUT" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newTestCase = await db.insert(evaluationTestCases)
      .values({
        evaluationId,
        input: input.trim(),
        expectedOutput: expectedOutput?.trim() || null,
        metadata: metadata || null,
        createdAt: now,
      })
      .returning();

    return NextResponse.json(newTestCase[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Authenticate and resolve org from user membership (app-layer RLS)
    const authResult = await requireAuthWithOrg(request);
    if (!authResult.authenticated) {
      const data = await authResult.response.json();
      return NextResponse.json(data, { status: authResult.response.status });
    }

    const { searchParams } = new URL(request.url);
    const testCaseId = searchParams.get('testCaseId');

    if (!testCaseId || isNaN(parseInt(testCaseId))) {
      return NextResponse.json({ 
        error: "Valid test case ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existing = await db.select()
      .from(evaluationTestCases)
      .where(eq(evaluationTestCases.id, parseInt(testCaseId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Test case not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    await db.delete(evaluationTestCases)
      .where(eq(evaluationTestCases.id, parseInt(testCaseId)));

    return NextResponse.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}