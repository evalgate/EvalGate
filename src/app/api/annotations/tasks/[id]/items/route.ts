import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { annotationItems, annotationTasks } from '@/db/schema';
import { eq, isNull, isNotNull, asc, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const taskId = parseInt(id);

    if (!taskId || isNaN(taskId)) {
      return NextResponse.json(
        { error: 'Valid task ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const annotatedParam = searchParams.get('annotated');

    // Verify task exists and belongs to user's organization
    const task = await db
      .select()
      .from(annotationTasks)
      .where(eq(annotationTasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json(
        { error: 'Task not found', code: 'TASK_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Build conditions array
    const conditions = [eq(annotationItems.taskId, taskId)];

    // Apply annotated filter if provided
    if (annotatedParam === 'true') {
      conditions.push(isNotNull(annotationItems.annotatedBy));
    } else if (annotatedParam === 'false') {
      conditions.push(isNull(annotationItems.annotatedBy));
    }

    // Execute query with combined conditions
    const items = await db
      .select()
      .from(annotationItems)
      .where(and(...conditions))
      .orderBy(asc(annotationItems.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(items);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const taskId = parseInt(id);

    if (!taskId || isNaN(taskId)) {
      return NextResponse.json(
        { error: 'Valid task ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content, annotation, annotatedBy, annotatedAt } = body;

    // Validate required fields
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Content is required and must be a non-empty string', code: 'MISSING_CONTENT' },
        { status: 400 }
      );
    }

    // Verify task exists and belongs to user's organization
    const task = await db
      .select()
      .from(annotationTasks)
      .where(eq(annotationTasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json(
        { error: 'Task not found', code: 'TASK_NOT_FOUND' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const insertData: {
      taskId: number;
      content: string;
      annotation?: unknown;
      annotatedBy?: string;
      annotatedAt?: string;
      createdAt: string;
    } = {
      taskId,
      content: content.trim(),
      createdAt: now,
    };

    if (annotation !== undefined) {
      insertData.annotation = annotation;
    }

    if (annotatedBy !== undefined && annotatedBy !== null) {
      insertData.annotatedBy = annotatedBy;
    }

    if (annotatedAt !== undefined && annotatedAt !== null) {
      insertData.annotatedAt = annotatedAt;
    }

    const newItem = await db
      .insert(annotationItems)
      .values(insertData)
      .returning();

    return NextResponse.json(newItem[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId || isNaN(parseInt(itemId))) {
      return NextResponse.json(
        { error: 'Valid item ID is required', code: 'INVALID_ITEM_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { annotation, annotatedBy, annotatedAt } = body;

    // Check if item exists
    const existingItem = await db
      .select()
      .from(annotationItems)
      .where(eq(annotationItems.id, parseInt(itemId)))
      .limit(1);

    if (existingItem.length === 0) {
      return NextResponse.json(
        { error: 'Item not found', code: 'ITEM_NOT_FOUND' },
        { status: 404 }
      );
    }

    const updateData: {
      annotation?: unknown;
      annotatedBy?: string;
      annotatedAt: string;
    } = {
      annotatedAt: annotatedAt || new Date().toISOString(),
    };

    if (annotation !== undefined) {
      updateData.annotation = annotation;
    }

    if (annotatedBy !== undefined && annotatedBy !== null) {
      updateData.annotatedBy = annotatedBy;
    }

    const updatedItem = await db
      .update(annotationItems)
      .set(updateData)
      .where(eq(annotationItems.id, parseInt(itemId)))
      .returning();

    return NextResponse.json(updatedItem[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}
