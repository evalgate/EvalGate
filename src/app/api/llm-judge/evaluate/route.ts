import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithOrg } from '@/lib/autumn-server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { llmJudgeService } from '@/lib/services/llm-judge.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    try {
      // Authenticate and resolve org from user membership (app-layer RLS)
      const authResult = await requireAuthWithOrg(request);
      if (!authResult.authenticated) {
        const data = await authResult.response.json();
        return NextResponse.json(data, { status: authResult.response.status });
      }

      const body = await request.json();
      const { configId, input, output, context, expectedOutput, metadata } = body;

      if (!configId || !input || !output) {
        return NextResponse.json({ 
          error: "configId, input, and output are required",
          code: "MISSING_REQUIRED_FIELDS" 
        }, { status: 400 });
      }

      const organizationId = authResult.organizationId;
      const judgement = await llmJudgeService.evaluate(organizationId, {
        configId,
        input,
        output,
        context,
        expectedOutput,
        metadata: {
          ...metadata,
          evaluatedBy: authResult.userId,
        },
      });

      return NextResponse.json({ 
        result: {
          score: judgement.score,
          reasoning: judgement.reasoning,
          passed: judgement.passed,
          details: judgement.details,
        },
      }, { status: 201 });
    } catch (error) {
      logger.error({ error, route: '/api/llm-judge/evaluate', method: 'POST' }, 'Error evaluating with LLM judge');
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
