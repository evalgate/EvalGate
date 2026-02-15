import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webhooks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organizationId, url, events } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required', code: 'MISSING_ORGANIZATION_ID' },
        { status: 400 }
      );
    }

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required', code: 'MISSING_URL' },
        { status: 400 }
      );
    }

    if (!events) {
      return NextResponse.json(
        { error: 'Events array is required', code: 'MISSING_EVENTS' },
        { status: 400 }
      );
    }

    // Validate URL format
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'URL must start with http:// or https://', code: 'INVALID_URL_FORMAT' },
        { status: 400 }
      );
    }

    // Validate events array
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Events must be a non-empty array', code: 'INVALID_EVENTS' },
        { status: 400 }
      );
    }

    // Generate random secret
    const secret = crypto.randomBytes(32).toString('hex');

    // Create webhook
    const now = new Date().toISOString();
    const newWebhook = await db.insert(webhooks)
      .values({
        organizationId,
        url: trimmedUrl,
        events: JSON.stringify(events),
        secret,
        status: 'active',
        lastDeliveredAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (newWebhook.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create webhook', code: 'CREATION_FAILED' },
        { status: 500 }
      );
    }

    // Return webhook with secret (only returned once)
    const created = newWebhook[0];
    return NextResponse.json(
      {
        id: created.id,
        url: created.url,
        events: typeof created.events === 'string' ? JSON.parse(created.events) : created.events,
        secret: created.secret,
        status: created.status,
        createdAt: created.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationIdParam = searchParams.get('organizationId');
    const statusParam = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate required organizationId
    if (!organizationIdParam) {
      return NextResponse.json(
        { error: 'Organization ID is required', code: 'MISSING_ORGANIZATION_ID' },
        { status: 400 }
      );
    }

    const organizationId = parseInt(organizationIdParam);
    if (isNaN(organizationId)) {
      return NextResponse.json(
        { error: 'Valid organization ID is required', code: 'INVALID_ORGANIZATION_ID' },
        { status: 400 }
      );
    }

    // Build query with filters
    let conditions = [eq(webhooks.organizationId, organizationId)];

    if (statusParam) {
      if (statusParam !== 'active' && statusParam !== 'inactive') {
        return NextResponse.json(
          { error: 'Status must be "active" or "inactive"', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      conditions.push(eq(webhooks.status, statusParam));
    }

    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    const results = await db.select({
      id: webhooks.id,
      organizationId: webhooks.organizationId,
      url: webhooks.url,
      events: webhooks.events,
      status: webhooks.status,
      lastDeliveredAt: webhooks.lastDeliveredAt,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
      .from(webhooks)
      .where(whereCondition)
      .orderBy(desc(webhooks.createdAt))
      .limit(limit)
      .offset(offset);

    // Parse events JSON and remove secret from response
    const webhooksWithParsedEvents = results.map(webhook => ({
      id: webhook.id,
      organizationId: webhook.organizationId,
      url: webhook.url,
      events: typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events,
      status: webhook.status,
      lastDeliveredAt: webhook.lastDeliveredAt,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    }));

    return NextResponse.json(webhooksWithParsedEvents, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}