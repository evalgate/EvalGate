import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { llmJudgeResults } from '@/db/schema';
import { eq, gte, lte, and, desc } from 'drizzle-orm';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const configId = searchParams.get('configId');
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');

    // Build filter conditions
    const conditions = [];

    if (configId) {
      conditions.push(eq(llmJudgeResults.configId, parseInt(configId)));
    }

    if (minScore) {
      conditions.push(gte(llmJudgeResults.score, parseInt(minScore)));
    }

    if (maxScore) {
      conditions.push(lte(llmJudgeResults.score, parseInt(maxScore)));
    }

    // Build and execute the query with all conditions
    const results = await db.select()
      .from(llmJudgeResults)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(llmJudgeResults.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    logger.error({ error, route: '/api/llm-judge/results', method: 'GET' }, 'Error fetching LLM judge results');
    return NextResponse.json({ error: 'Internal server error: ' + error }, { status: 500 });
  }
  }, { customTier: 'free' });
}