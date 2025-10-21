/**
 * Email Subscribers API
 * Handles email capture from playground, homepage, and other sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emailSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().min(1, 'Source is required'),
  context: z.record(z.any()).optional(),
  subscribedAt: z.string().optional(),
});

/**
 * POST /api/subscribers
 * Subscribe a new email address
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validated = subscribeSchema.parse(body);
    const { email, source, context = {} } = validated;

    // Check if already subscribed
    const existing = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, email))
      .limit(1);

    if (existing.length > 0) {
      const subscriber = existing[0];
      
      // If they previously unsubscribed, re-subscribe them
      if (subscriber.status === 'unsubscribed') {
        await db
          .update(emailSubscribers)
          .set({
            status: 'active',
            source, // Update source
            context: JSON.stringify(context),
            subscribedAt: new Date().toISOString(),
            unsubscribedAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(emailSubscribers.email, email));

        logger.info('Email re-subscribed', { email, source });

        return NextResponse.json({
          success: true,
          message: 'Welcome back! You have been re-subscribed.',
          subscriber: { email, status: 'active' },
        });
      }

      // Already active subscriber
      return NextResponse.json({
        success: true,
        message: 'You are already subscribed!',
        subscriber: { email, status: subscriber.status },
      });
    }

    // Determine tags based on source and context
    const tags = generateTags(source, context);

    // Create new subscriber
    const now = new Date().toISOString();
    const [newSubscriber] = await db
      .insert(emailSubscribers)
      .values({
        email,
        source,
        context: JSON.stringify(context),
        status: 'active',
        tags: JSON.stringify(tags),
        subscribedAt: now,
        unsubscribedAt: null,
        lastEmailSentAt: null,
        emailCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info('New email subscriber', { email, source, tags });

    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    // - Send welcome email with evaluation results
    // - Add to nurture sequence
    // - Notify team in Slack

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed! Check your email.',
      subscriber: {
        email: newSubscriber.email,
        status: newSubscriber.status,
        tags,
      },
    }, { status: 201 });

  } catch (error: any) {
    logger.error('Failed to subscribe email', { error: error.message });

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: error.errors[0].message,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to subscribe. Please try again.',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/subscribers?email=xxx
 * Unsubscribe an email address
 */
export async function DELETE(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email parameter is required',
      }, { status: 400 });
    }

    // Find subscriber
    const existing = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, email))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Email not found',
      }, { status: 404 });
    }

    // Update status to unsubscribed
    await db
      .update(emailSubscribers)
      .set({
        status: 'unsubscribed',
        unsubscribedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailSubscribers.email, email));

    logger.info('Email unsubscribed', { email });

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed',
    });

  } catch (error: any) {
    logger.error('Failed to unsubscribe email', { error: error.message });

    return NextResponse.json({
      success: false,
      error: 'Failed to unsubscribe. Please try again.',
    }, { status: 500 });
  }
}

/**
 * Generate tags based on source and context
 */
function generateTags(source: string, context: Record<string, any>): string[] {
  const tags: string[] = [];

  // Source tags
  tags.push(`source:${source}`);

  // Context-based tags
  if (source === 'playground') {
    tags.push('playground-lead');
    tags.push('high-intent');

    if (context.scenario) {
      tags.push(`scenario:${context.scenario}`);
    }

    if (context.score && context.score > 80) {
      tags.push('impressed-by-results');
    }

    if (context.testsPassed && context.testsPassed > 5) {
      tags.push('engaged-user');
    }
  }

  if (source === 'homepage') {
    tags.push('homepage-lead');
  }

  if (source === 'blog') {
    tags.push('content-reader');
  }

  if (source === 'templates') {
    tags.push('template-user');
    tags.push('developer');
  }

  return tags;
}

