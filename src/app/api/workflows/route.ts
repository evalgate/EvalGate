import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow.service';
import { requireFeature, trackFeature } from '@/lib/autumn-server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

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

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  organizationId: z.number().int().positive(),
  definition: workflowDefinitionSchema,
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

/**
 * GET /api/workflows - List workflows
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const organizationId = parseInt(searchParams.get('organizationId') || '0');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const offset = parseInt(searchParams.get('offset') || '0');
      const status = searchParams.get('status') as 'draft' | 'active' | 'archived' | null;
      const search = searchParams.get('search');

      if (!organizationId) {
        return NextResponse.json({
          error: 'Organization ID is required',
          code: 'MISSING_ORGANIZATION_ID',
        }, { status: 400 });
      }

      const workflows = await workflowService.list(organizationId, {
        limit,
        offset,
        status: status || undefined,
        search: search || undefined,
      });

      return NextResponse.json(workflows, {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      });
    } catch (error: any) {
      logger.error('Error listing workflows', {
        error: error.message,
        route: '/api/workflows',
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
 * POST /api/workflows - Create a new workflow
 */
export async function POST(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    // Check authentication and feature allowance
    const featureCheck = await requireFeature(req, 'workflows', 1);

    if (!featureCheck.allowed) {
      const responseData = await featureCheck.response.json();
      return NextResponse.json(responseData, {
        status: featureCheck.response.status,
        headers: Object.fromEntries(featureCheck.response.headers.entries()),
      });
    }

    const userId = featureCheck.userId;

    try {
      const body = await req.json();

      // Validate request body
      const validation = createWorkflowSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const { name, description, organizationId, definition, status } = validation.data;

      // Check per-organization workflow limit
      const orgLimitCheck = await requireFeature(req, 'workflows_per_project', 1);

      if (!orgLimitCheck.allowed) {
        return NextResponse.json({
          error: "You've reached your workflow limit for this organization. Please upgrade your plan.",
          code: 'ORGANIZATION_WORKFLOW_LIMIT_REACHED',
        }, { status: 402 });
      }

      // Validate definition structure
      if (!definition.nodes.some(n => n.id === definition.entrypoint)) {
        return NextResponse.json({
          error: 'Entrypoint must reference a valid node ID',
          code: 'INVALID_ENTRYPOINT',
        }, { status: 400 });
      }

      // Validate edges reference valid nodes
      const nodeIds = new Set(definition.nodes.map(n => n.id));
      for (const edge of definition.edges) {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          return NextResponse.json({
            error: `Edge references invalid node: ${edge.from} -> ${edge.to}`,
            code: 'INVALID_EDGE',
          }, { status: 400 });
        }
      }

      const workflow = await workflowService.create({
        name,
        description,
        organizationId,
        definition,
        createdBy: userId,
        status,
      });

      // Track feature usage
      await trackFeature({
        userId,
        featureId: 'workflows',
        value: 1,
        idempotencyKey: `workflow-${workflow.id}-${Date.now()}`,
      });

      await trackFeature({
        userId,
        featureId: 'workflows_per_project',
        value: 1,
        idempotencyKey: `workflow-org-${organizationId}-${workflow.id}-${Date.now()}`,
      });

      logger.info('Workflow created', {
        workflowId: workflow.id,
        organizationId,
        userId,
      });

      return NextResponse.json(workflow, { status: 201 });
    } catch (error: any) {
      logger.error('Error creating workflow', {
        error: error.message,
        route: '/api/workflows',
        method: 'POST',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
