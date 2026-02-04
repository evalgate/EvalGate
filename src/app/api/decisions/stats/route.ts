import { NextRequest, NextResponse } from 'next/server';
import { decisionService } from '@/lib/services/decision.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/decisions/stats - Get decision statistics
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const workflowRunId = searchParams.get('workflowRunId');
      const workflowId = searchParams.get('workflowId');
      const traceId = searchParams.get('traceId');

      // Get stats for a workflow run
      if (workflowRunId) {
        const id = parseInt(workflowRunId);
        if (isNaN(id)) {
          return NextResponse.json({
            error: 'Valid workflow run ID is required',
            code: 'INVALID_ID',
          }, { status: 400 });
        }

        const stats = await decisionService.getWorkflowDecisionStats(id);
        return NextResponse.json(stats);
      }

      // Get decision patterns for a workflow
      if (workflowId) {
        const id = parseInt(workflowId);
        if (isNaN(id)) {
          return NextResponse.json({
            error: 'Valid workflow ID is required',
            code: 'INVALID_ID',
          }, { status: 400 });
        }

        const patterns = await decisionService.getAgentDecisionPatterns(id);
        return NextResponse.json(patterns);
      }

      // Get audit trail for a trace
      if (traceId) {
        const id = parseInt(traceId);
        if (isNaN(id)) {
          return NextResponse.json({
            error: 'Valid trace ID is required',
            code: 'INVALID_ID',
          }, { status: 400 });
        }

        const auditTrail = await decisionService.getDecisionAuditTrail(id);
        return NextResponse.json(auditTrail);
      }

      return NextResponse.json({
        error: 'Either workflowRunId, workflowId, or traceId is required',
        code: 'MISSING_PARAMETER',
      }, { status: 400 });
    } catch (error: any) {
      logger.error('Error fetching decision stats', {
        error: error.message,
        route: '/api/decisions/stats',
        method: 'GET',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
