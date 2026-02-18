import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webhooks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, forbidden, internalError } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/parse';
import { createWebhookBodySchema } from '@/lib/validation';
import crypto from 'crypto';

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const parsed = await parseBody(req, createWebhookBodySchema);
  if (!parsed.ok) return parsed.response;

  const { organizationId, url, events } = parsed.data;

  if (organizationId !== ctx.organizationId) {
    return forbidden('Organization ID must match your current organization');
  }

  try {
    const trimmedUrl = url.trim();
    const secret = crypto.randomBytes(32).toString('hex');

    const now = new Date().toISOString();
    const newWebhook = await db.insert(webhooks)
      .values({
        organizationId: ctx.organizationId,
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
      return internalError('Failed to create webhook');
    }

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
  } catch (error: unknown) {
    return internalError();
  }
});

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const organizationIdParam = searchParams.get('organizationId');
    const statusParam = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!organizationIdParam) {
      return validationError('Organization ID is required');
    }

    const organizationId = parseInt(organizationIdParam);
    if (isNaN(organizationId)) {
      return validationError('Valid organization ID is required');
    }

    if (organizationId !== ctx.organizationId) {
      return forbidden('Organization ID must match your current organization');
    }

    let conditions = [eq(webhooks.organizationId, organizationId)];

    if (statusParam) {
      if (statusParam !== 'active' && statusParam !== 'inactive') {
        return validationError('Status must be "active" or "inactive"');
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
  } catch (error: unknown) {
    return internalError();
  }
});
