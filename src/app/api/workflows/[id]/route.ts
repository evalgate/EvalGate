import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Validation schemas
const workflowDefinitionSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['agent', 'tool', 'decision', 'parallel', 'human', 'llm']),
    name: z.string(),
    config: z.record(z.any()).optional(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    condition: z.string().optional(),
    label: z.string().optional(),
  })),
  entrypoint: z.string(),
  metadata: z.record(z.any()).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  definition: workflowDefinitionSchema.optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

/**
 * GET /api/workflows/[id] - Get a single workflow
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { id } = await params;
      const workflowId = parseInt(id);

      if (isNaN(workflowId)) {
        return NextResponse.json({
          error: 'Valid workflow ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const organizationId = parseInt(searchParams.get('organizationId') || '0');

      if (!organizationId) {
        return NextResponse.json({
          error: 'Organization ID is required',
          code: 'MISSING_ORGANIZATION_ID',
        }, { status: 400 });
      }

      // Check if stats are requested
      const includeStats = searchParams.get('includeStats') === 'true';

      if (includeStats) {
        const result = await workflowService.getStats(workflowId, organizationId);
        if (!result) {
          return NextResponse.json({
            error: 'Workflow not found',
            code: 'NOT_FOUND',
          }, { status: 404 });
        }
        return NextResponse.json(result);
      }

      const workflow = await workflowService.getById(workflowId, organizationId);

      if (!workflow) {
        return NextResponse.json({
          error: 'Workflow not found',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      return NextResponse.json(workflow, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      });
    } catch (error: any) {
      logger.error('Error fetching workflow', {
        error: error.message,
        route: '/api/workflows/[id]',
        method: 'GET',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}

/**
 * PUT /api/workflows/[id] - Update a workflow
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { id } = await params;
      const workflowId = parseInt(id);

      if (isNaN(workflowId)) {
        return NextResponse.json({
          error: 'Valid workflow ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const organizationId = parseInt(searchParams.get('organizationId') || '0');

      if (!organizationId) {
        return NextResponse.json({
          error: 'Organization ID is required',
          code: 'MISSING_ORGANIZATION_ID',
        }, { status: 400 });
      }

      const body = await req.json();

      // Validate request body
      const validation = updateWorkflowSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      // Validate definition structure if provided
      if (validation.data.definition) {
        const { definition } = validation.data;
        
        if (!definition.nodes.some(n => n.id === definition.entrypoint)) {
          return NextResponse.json({
            error: 'Entrypoint must reference a valid node ID',
            code: 'INVALID_ENTRYPOINT',
          }, { status: 400 });
        }

        const nodeIds = new Set(definition.nodes.map(n => n.id));
        for (const edge of definition.edges) {
          if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
            return NextResponse.json({
              error: `Edge references invalid node: ${edge.from} -> ${edge.to}`,
              code: 'INVALID_EDGE',
            }, { status: 400 });
          }
        }
      }

      const updated = await workflowService.update(workflowId, organizationId, validation.data);

      if (!updated) {
        return NextResponse.json({
          error: 'Workflow not found',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      logger.info('Workflow updated', { workflowId, organizationId });

      return NextResponse.json(updated);
    } catch (error: any) {
      logger.error('Error updating workflow', {
        error: error.message,
        route: '/api/workflows/[id]',
        method: 'PUT',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}

/**
 * DELETE /api/workflows/[id] - Delete a workflow
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { id } = await params;
      const workflowId = parseInt(id);

      if (isNaN(workflowId)) {
        return NextResponse.json({
          error: 'Valid workflow ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const organizationId = parseInt(searchParams.get('organizationId') || '0');

      if (!organizationId) {
        return NextResponse.json({
          error: 'Organization ID is required',
          code: 'MISSING_ORGANIZATION_ID',
        }, { status: 400 });
      }

      const deleted = await workflowService.delete(workflowId, organizationId);

      if (!deleted) {
        return NextResponse.json({
          error: 'Workflow not found',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      logger.info('Workflow deleted', { workflowId, organizationId });

      return NextResponse.json({
        message: 'Workflow deleted successfully',
        success: true,
      });
    } catch (error: any) {
      logger.error('Error deleting workflow', {
        error: error.message,
        route: '/api/workflows/[id]',
        method: 'DELETE',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
