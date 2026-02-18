import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow.service';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, internalError, zodValidationError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

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

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    const workflowId = parseInt(id);

    if (isNaN(workflowId)) {
      return validationError('Valid workflow ID is required');
    }

    const { searchParams } = new URL(req.url);
    const includeStats = searchParams.get('includeStats') === 'true';

    if (includeStats) {
      const result = await workflowService.getStats(workflowId, ctx.organizationId);
      if (!result) {
        return notFound('Workflow not found');
      }
      return NextResponse.json(result);
    }

    const workflow = await workflowService.getById(workflowId, ctx.organizationId);

    if (!workflow) {
      return notFound('Workflow not found');
    }

    return NextResponse.json(workflow, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error: unknown) {
    logger.error('Error fetching workflow', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/workflows/[id]',
      method: 'GET',
    });
    return internalError();
  }
}, { rateLimit: 'free' });

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    const workflowId = parseInt(id);

    if (isNaN(workflowId)) {
      return validationError('Valid workflow ID is required');
    }

    const body = await req.json();
    const validation = updateWorkflowSchema.safeParse(body);
    if (!validation.success) {
      return zodValidationError(validation.error);
    }

    if (validation.data.definition) {
      const { definition } = validation.data;
      if (!definition.nodes.some(n => n.id === definition.entrypoint)) {
        return validationError('Entrypoint must reference a valid node ID');
      }

      const nodeIds = new Set(definition.nodes.map(n => n.id));
      for (const edge of definition.edges) {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          return validationError(`Edge references invalid node: ${edge.from} -> ${edge.to}`);
        }
      }
    }

    const updateData = {
      ...validation.data,
      description: validation.data.description ?? undefined,
    };
    const updated = await workflowService.update(workflowId, ctx.organizationId, updateData);

    if (!updated) {
      return notFound('Workflow not found');
    }

    logger.info('Workflow updated', { workflowId, organizationId: ctx.organizationId });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error('Error updating workflow', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/workflows/[id]',
      method: 'PUT',
    });
    return internalError();
  }
}, { rateLimit: 'free' });

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    const workflowId = parseInt(id);

    if (isNaN(workflowId)) {
      return validationError('Valid workflow ID is required');
    }

    const deleted = await workflowService.delete(workflowId, ctx.organizationId);

    if (!deleted) {
      return notFound('Workflow not found');
    }

    logger.info('Workflow deleted', { workflowId, organizationId: ctx.organizationId });

    return NextResponse.json({
      message: 'Workflow deleted successfully',
      success: true,
    });
  } catch (error: unknown) {
    logger.error('Error deleting workflow', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/workflows/[id]',
      method: 'DELETE',
    });
    return internalError();
  }
}, { rateLimit: 'free' });
