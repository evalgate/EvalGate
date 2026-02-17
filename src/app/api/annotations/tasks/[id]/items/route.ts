import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { annotationItems, annotationTasks } from '@/db/schema';
import { eq, isNull, isNotNull, asc, and } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { notFound, forbidden, validationError } from '@/lib/api/errors';

type VerifyTaskResult =
  | { error: NextResponse }
  | { task: typeof annotationTasks.$inferSelect };

/**
 * Verify the parent annotationTask exists and belongs to the caller's org.
 * Returns the task row or a NextResponse error.
 */
async function verifyTaskOwnership(taskId: number, ctx: AuthContext): Promise<VerifyTaskResult> {
  const task = await db
    .select()
    .from(annotationTasks)
    .where(eq(annotationTasks.id, taskId))
    .limit(1);

  if (task.length === 0) {
    return { error: notFound('Task not found') };
  }
  if (task[0].organizationId !== ctx.organizationId) {
    return { error: forbidden('Task does not belong to your organization') };
  }
  return { task: task[0] };
}

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params): Promise<NextResponse> => {
  const taskId = parseInt(params.id ?? '', 10);

  if (!taskId || isNaN(taskId)) {
    return validationError('Valid task ID is required');
  }

  const ownership = await verifyTaskOwnership(taskId, ctx);
  if ('error' in ownership) {
    return ownership.error;
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const annotatedParam = searchParams.get('annotated');

  const conditions = [eq(annotationItems.taskId, taskId)];

  if (annotatedParam === 'true') {
    conditions.push(isNotNull(annotationItems.annotatedBy));
  } else if (annotatedParam === 'false') {
    conditions.push(isNull(annotationItems.annotatedBy));
  }

  const items = await db
    .select()
    .from(annotationItems)
    .where(and(...conditions))
    .orderBy(asc(annotationItems.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(items);
})

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const taskId = parseInt(params.id);

  if (!taskId || isNaN(taskId)) {
    return validationError('Valid task ID is required');
  }

  const ownership = await verifyTaskOwnership(taskId, ctx);
  if ('error' in ownership) return ownership.error;

  const body = await req.json();
  const { content, annotation, annotatedBy, annotatedAt } = body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return validationError('Content is required and must be a non-empty string');
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
})

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('itemId');

  if (!itemId || isNaN(parseInt(itemId))) {
    return validationError('Valid item ID is required');
  }

  // Look up the item, then verify its parent task belongs to the org
  const existingItem = await db
    .select()
    .from(annotationItems)
    .where(eq(annotationItems.id, parseInt(itemId)))
    .limit(1);

  if (existingItem.length === 0) {
    return notFound('Item not found');
  }

  const ownership = await verifyTaskOwnership(existingItem[0].taskId, ctx);
  if ('error' in ownership) return ownership.error;

  const body = await req.json();
  const { annotation, annotatedBy, annotatedAt } = body;

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
})
