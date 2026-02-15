import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webhookDeliveries, webhooks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Extract and validate webhook ID
    const { id } = await params;
    const webhookId = parseInt(id);
    
    if (!id || isNaN(webhookId)) {
      return NextResponse.json(
        { error: 'Valid webhook ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Verify webhook exists
    const webhook = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, webhookId))
      .limit(1);

    if (webhook.length === 0) {
      return NextResponse.json(
        { error: 'Webhook not found', code: 'WEBHOOK_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate status if provided
    if (status && !['success', 'failed', 'pending'].includes(status)) {
      return NextResponse.json(
        { 
          error: 'Invalid status. Must be one of: success, failed, pending',
          code: 'INVALID_STATUS' 
        },
        { status: 400 }
      );
    }

    // Build query conditions
    let whereConditions = eq(webhookDeliveries.webhookId, webhookId);
    
    if (status) {
      whereConditions = and(
        whereConditions,
        eq(webhookDeliveries.status, status)
      ) as typeof whereConditions;
    }

    // Fetch deliveries with pagination
    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(whereConditions)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for the same conditions
    const totalCountResult = await db
      .select()
      .from(webhookDeliveries)
      .where(whereConditions);

    return NextResponse.json(
      {
        deliveries: deliveries.map(delivery => ({
          id: delivery.id,
          webhookId: delivery.webhookId,
          eventType: delivery.eventType,
          payload: delivery.payload,
          status: delivery.status,
          responseStatus: delivery.responseStatus,
          responseBody: delivery.responseBody,
          attemptCount: delivery.attemptCount,
          createdAt: delivery.createdAt
        })),
        total: totalCountResult.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET webhook deliveries error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}