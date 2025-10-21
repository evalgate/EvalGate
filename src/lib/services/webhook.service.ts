/**
 * Webhook Service Layer
 * Handles webhook delivery with HMAC-SHA256 request signing
 */

import { db } from '@/db';
import { webhooks, webhookDeliveries } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
  description: z.string().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  organizationId: number;
}

export class WebhookService {
  /**
   * List webhooks for an organization
   */
  async list(organizationId: number) {
    logger.info('Listing webhooks', { organizationId });

    const results = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.organizationId, organizationId))
      .orderBy(desc(webhooks.createdAt));

    logger.info('Webhooks listed', { count: results.length, organizationId });

    return results;
  }

  /**
   * Get webhook by ID
   */
  async getById(id: number, organizationId: number) {
    logger.info('Getting webhook by ID', { id, organizationId });

    const webhook = await db.query.webhooks.findFirst({
      where: and(
        eq(webhooks.id, id),
        eq(webhooks.organizationId, organizationId)
      ),
    });

    if (!webhook) {
      logger.warn('Webhook not found', { id, organizationId });
      return null;
    }

    return webhook;
  }

  /**
   * Create a new webhook
   */
  async create(organizationId: number, data: CreateWebhookInput) {
    logger.info('Creating webhook', { organizationId, url: data.url });

    // Generate secret if not provided
    const secret = data.secret || this.generateSecret();

    const [webhook] = await db.insert(webhooks).values({
      organizationId,
      url: data.url,
      events: data.events as any,
      secret,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    logger.info('Webhook created', { id: webhook.id, organizationId });

    return webhook;
  }

  /**
   * Update a webhook
   */
  async update(id: number, organizationId: number, data: Partial<CreateWebhookInput>) {
    logger.info('Updating webhook', { id, organizationId });

    const existing = await this.getById(id, organizationId);
    if (!existing) {
      logger.warn('Webhook not found for update', { id, organizationId });
      return null;
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    if (data.url) updateData.url = data.url;
    if (data.events) updateData.events = data.events;
    if (data.secret) updateData.secret = data.secret;

    const [updated] = await db
      .update(webhooks)
      .set(updateData)
      .where(and(
        eq(webhooks.id, id),
        eq(webhooks.organizationId, organizationId)
      ))
      .returning();

    logger.info('Webhook updated', { id, organizationId });

    return updated;
  }

  /**
   * Delete a webhook
   */
  async delete(id: number, organizationId: number) {
    logger.info('Deleting webhook', { id, organizationId });

    const existing = await this.getById(id, organizationId);
    if (!existing) {
      logger.warn('Webhook not found for deletion', { id, organizationId });
      return false;
    }

    await db
      .delete(webhooks)
      .where(and(
        eq(webhooks.id, id),
        eq(webhooks.organizationId, organizationId)
      ));

    logger.info('Webhook deleted', { id, organizationId });

    return true;
  }

  /**
   * Deliver webhook payload
   */
  async deliver(webhookId: number, organizationId: number, payload: WebhookPayload) {
    logger.info('Delivering webhook', { webhookId, organizationId, event: payload.event });

    const webhook = await this.getById(webhookId, organizationId);
    if (!webhook) {
      logger.error('Webhook not found for delivery', { webhookId, organizationId });
      throw new Error('Webhook not found');
    }

    if (webhook.status !== 'active') {
      logger.warn('Webhook is not active', { webhookId, status: webhook.status });
      return null;
    }

    // Check if webhook is subscribed to this event
    const events = Array.isArray(webhook.events) ? webhook.events : [];
    if (!events.includes(payload.event)) {
      logger.debug('Webhook not subscribed to event', { webhookId, event: payload.event });
      return null;
    }

    const payloadString = JSON.stringify(payload);
    const signature = this.signPayload(payloadString, webhook.secret);

    const startTime = Date.now();
    let status: 'success' | 'failed' = 'failed';
    let responseCode: number | null = null;
    let responseBody = '';
    let error: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event,
          'X-Webhook-Timestamp': payload.timestamp,
          'User-Agent': 'EvalAI-Webhooks/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      responseCode = response.status;
      responseBody = await response.text();

      if (response.ok) {
        status = 'success';
        logger.info('Webhook delivered successfully', { 
          webhookId, 
          status: responseCode,
          duration: Date.now() - startTime 
        });
      } else {
        error = `HTTP ${responseCode}: ${responseBody.substring(0, 500)}`;
        logger.warn('Webhook delivery failed', { 
          webhookId, 
          status: responseCode,
          error 
        });
      }
    } catch (err: any) {
      error = err.message;
      logger.error('Webhook delivery error', { 
        webhookId, 
        error: err.message,
        stack: err.stack 
      });
    }

    // Record delivery attempt
    const [delivery] = await db.insert(webhookDeliveries).values({
      webhookId,
      eventType: payload.event,
      payload: payload as any,
      status,
      responseStatus: responseCode || null,
      responseBody: error ? `Error: ${error}` : responseBody,
      attemptCount: 1,
      createdAt: new Date().toISOString(),
    }).returning();

    return delivery;
  }

  /**
   * Get webhook deliveries
   */
  async getDeliveries(webhookId: number, organizationId: number, options?: {
    limit?: number;
    offset?: number;
  }) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    logger.info('Getting webhook deliveries', { webhookId, organizationId, limit, offset });

    // Verify webhook ownership
    const webhook = await this.getById(webhookId, organizationId);
    if (!webhook) {
      return null;
    }

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(webhookDeliveries.createdAt));

    logger.info('Webhook deliveries retrieved', { count: deliveries.length });

    return deliveries;
  }

  /**
   * Generate webhook secret
   * @private
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sign webhook payload with HMAC-SHA256
   * @private
   */
  private signPayload(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.signPayload(payload, secret);
    
    // Use constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Trigger webhook for event
   */
  async trigger(organizationId: number, event: string, data: any) {
    logger.info('Triggering webhooks for event', { organizationId, event });

    // Get all active webhooks for this organization subscribed to this event
    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.organizationId, organizationId),
        eq(webhooks.status, 'active')
      ));

    const subscribedWebhooks = activeWebhooks.filter(w => {
      const events = Array.isArray(w.events) ? w.events : [];
      return events.includes(event);
    });

    logger.info('Found subscribed webhooks', { 
      count: subscribedWebhooks.length, 
      event, 
      organizationId 
    });

    const payload: WebhookPayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      organizationId,
    };

    // Deliver to all subscribed webhooks (in parallel)
    const deliveryPromises = subscribedWebhooks.map(webhook =>
      this.deliver(webhook.id, organizationId, payload).catch(err => {
        logger.error('Failed to deliver webhook', { 
          webhookId: webhook.id, 
          error: err.message 
        });
        return null;
      })
    );

    const results = await Promise.allSettled(deliveryPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    logger.info('Webhooks triggered', { 
      total: subscribedWebhooks.length, 
      successful, 
      failed: subscribedWebhooks.length - successful 
    });

    return {
      triggered: subscribedWebhooks.length,
      successful,
      failed: subscribedWebhooks.length - successful,
    };
  }
}

// Export singleton instance
export const webhookService = new WebhookService();

