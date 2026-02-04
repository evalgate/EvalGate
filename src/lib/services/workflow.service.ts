/**
 * Workflow Service
 * Business logic for multi-agent workflow management
 */

import { db } from '@/db';
import { workflows, workflowRuns, agentHandoffs, traces } from '@/db/schema';
import { eq, and, desc, like, sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowDefinition {
  nodes: {
    id: string;
    type: 'agent' | 'tool' | 'decision' | 'parallel' | 'human' | 'llm';
    name: string;
    config?: Record<string, any>;
  }[];
  edges: {
    from: string;
    to: string;
    condition?: string;
    label?: string;
  }[];
  entrypoint: string;
  metadata?: Record<string, any>;
}

export interface CreateWorkflowParams {
  name: string;
  description?: string;
  organizationId: number;
  definition: WorkflowDefinition;
  createdBy: string;
  status?: 'draft' | 'active' | 'archived';
}

export interface UpdateWorkflowParams {
  name?: string;
  description?: string;
  definition?: WorkflowDefinition;
  status?: 'draft' | 'active' | 'archived';
}

export interface CreateWorkflowRunParams {
  workflowId?: number;
  traceId: number;
  input?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateWorkflowRunParams {
  status?: 'running' | 'completed' | 'failed' | 'cancelled';
  output?: Record<string, any>;
  totalCost?: string;
  totalDurationMs?: number;
  agentCount?: number;
  handoffCount?: number;
  retryCount?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface CreateHandoffParams {
  workflowRunId: number;
  fromSpanId?: string;
  toSpanId: string;
  fromAgent?: string;
  toAgent: string;
  handoffType: 'delegation' | 'escalation' | 'parallel' | 'fallback';
  context?: Record<string, any>;
}

export interface ListWorkflowsParams {
  limit?: number;
  offset?: number;
  status?: 'draft' | 'active' | 'archived';
  search?: string;
}

export interface ListWorkflowRunsParams {
  limit?: number;
  offset?: number;
  status?: 'running' | 'completed' | 'failed' | 'cancelled';
}

// ============================================================================
// WORKFLOW SERVICE
// ============================================================================

class WorkflowService {
  // ==========================================================================
  // WORKFLOWS
  // ==========================================================================

  /**
   * List workflows for an organization
   */
  async list(organizationId: number, params: ListWorkflowsParams = {}) {
    const { limit = 50, offset = 0, status, search } = params;

    const conditions = [eq(workflows.organizationId, organizationId)];

    if (status) {
      conditions.push(eq(workflows.status, status));
    }

    if (search) {
      conditions.push(like(workflows.name, `%${search}%`));
    }

    const results = await db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.createdAt))
      .limit(Math.min(limit, 100))
      .offset(offset);

    return results;
  }

  /**
   * Get a single workflow by ID
   */
  async getById(id: number, organizationId: number) {
    const result = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.organizationId, organizationId)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create a new workflow
   */
  async create(params: CreateWorkflowParams) {
    const now = new Date().toISOString();

    const result = await db
      .insert(workflows)
      .values({
        name: params.name.trim(),
        description: params.description?.trim() || null,
        organizationId: params.organizationId,
        definition: params.definition as any,
        status: params.status || 'draft',
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  }

  /**
   * Update a workflow
   */
  async update(id: number, organizationId: number, params: UpdateWorkflowParams) {
    const existing = await this.getById(id, organizationId);
    if (!existing) return null;

    const now = new Date().toISOString();

    const result = await db
      .update(workflows)
      .set({
        ...(params.name && { name: params.name.trim() }),
        ...(params.description !== undefined && { description: params.description?.trim() || null }),
        ...(params.definition && { definition: params.definition as any }),
        ...(params.status && { status: params.status }),
        updatedAt: now,
      })
      .where(and(eq(workflows.id, id), eq(workflows.organizationId, organizationId)))
      .returning();

    return result[0] || null;
  }

  /**
   * Delete a workflow
   */
  async delete(id: number, organizationId: number) {
    const existing = await this.getById(id, organizationId);
    if (!existing) return false;

    await db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.organizationId, organizationId)));

    return true;
  }

  /**
   * Get workflow statistics
   */
  async getStats(id: number, organizationId: number) {
    const workflow = await this.getById(id, organizationId);
    if (!workflow) return null;

    // Get run statistics
    const runs = await db
      .select({
        status: workflowRuns.status,
        count: sql<number>`count(*)`,
        avgDuration: sql<number>`avg(${workflowRuns.totalDurationMs})`,
        totalCost: sql<string>`sum(cast(${workflowRuns.totalCost} as real))`,
      })
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, id))
      .groupBy(workflowRuns.status);

    const totalRuns = runs.reduce((sum, r) => sum + Number(r.count), 0);
    const completedRuns = runs.find(r => r.status === 'completed');
    const failedRuns = runs.find(r => r.status === 'failed');

    return {
      workflow,
      stats: {
        totalRuns,
        completedRuns: Number(completedRuns?.count || 0),
        failedRuns: Number(failedRuns?.count || 0),
        successRate: totalRuns > 0 
          ? (Number(completedRuns?.count || 0) / totalRuns * 100).toFixed(1) 
          : '0.0',
        avgDuration: completedRuns?.avgDuration || 0,
        totalCost: runs.reduce((sum, r) => sum + parseFloat(r.totalCost || '0'), 0).toFixed(6),
      },
    };
  }

  // ==========================================================================
  // WORKFLOW RUNS
  // ==========================================================================

  /**
   * List runs for a workflow
   */
  async listRuns(workflowId: number, params: ListWorkflowRunsParams = {}) {
    const { limit = 50, offset = 0, status } = params;

    const conditions = [eq(workflowRuns.workflowId, workflowId)];

    if (status) {
      conditions.push(eq(workflowRuns.status, status));
    }

    const results = await db
      .select()
      .from(workflowRuns)
      .where(and(...conditions))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(Math.min(limit, 100))
      .offset(offset);

    return results;
  }

  /**
   * Get a single workflow run by ID
   */
  async getRunById(runId: number) {
    const result = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create a workflow run
   */
  async createRun(params: CreateWorkflowRunParams) {
    const now = new Date().toISOString();

    const result = await db
      .insert(workflowRuns)
      .values({
        workflowId: params.workflowId || null,
        traceId: params.traceId,
        status: 'running',
        input: params.input as any || null,
        metadata: params.metadata as any || null,
        startedAt: now,
      })
      .returning();

    return result[0];
  }

  /**
   * Update a workflow run
   */
  async updateRun(runId: number, params: UpdateWorkflowRunParams) {
    const existing = await this.getRunById(runId);
    if (!existing) return null;

    const now = new Date().toISOString();

    const result = await db
      .update(workflowRuns)
      .set({
        ...(params.status && { status: params.status }),
        ...(params.output && { output: params.output as any }),
        ...(params.totalCost !== undefined && { totalCost: params.totalCost }),
        ...(params.totalDurationMs !== undefined && { totalDurationMs: params.totalDurationMs }),
        ...(params.agentCount !== undefined && { agentCount: params.agentCount }),
        ...(params.handoffCount !== undefined && { handoffCount: params.handoffCount }),
        ...(params.retryCount !== undefined && { retryCount: params.retryCount }),
        ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
        ...(params.metadata && { metadata: params.metadata as any }),
        ...(params.status === 'completed' || params.status === 'failed' ? { completedAt: now } : {}),
      })
      .where(eq(workflowRuns.id, runId))
      .returning();

    return result[0] || null;
  }

  /**
   * Get run with associated trace and spans
   */
  async getRunWithDetails(runId: number) {
    const run = await this.getRunById(runId);
    if (!run) return null;

    // Get associated trace
    const trace = await db
      .select()
      .from(traces)
      .where(eq(traces.id, run.traceId))
      .limit(1);

    // Get handoffs for this run
    const handoffs = await db
      .select()
      .from(agentHandoffs)
      .where(eq(agentHandoffs.workflowRunId, runId))
      .orderBy(agentHandoffs.timestamp);

    return {
      run,
      trace: trace[0] || null,
      handoffs,
    };
  }

  // ==========================================================================
  // HANDOFFS
  // ==========================================================================

  /**
   * List handoffs for a workflow run
   */
  async listHandoffs(workflowRunId: number) {
    const results = await db
      .select()
      .from(agentHandoffs)
      .where(eq(agentHandoffs.workflowRunId, workflowRunId))
      .orderBy(agentHandoffs.timestamp);

    return results;
  }

  /**
   * Create a handoff
   */
  async createHandoff(params: CreateHandoffParams) {
    const now = new Date().toISOString();

    const result = await db
      .insert(agentHandoffs)
      .values({
        workflowRunId: params.workflowRunId,
        fromSpanId: params.fromSpanId || null,
        toSpanId: params.toSpanId,
        fromAgent: params.fromAgent || null,
        toAgent: params.toAgent,
        handoffType: params.handoffType,
        context: params.context as any || null,
        timestamp: now,
      })
      .returning();

    // Update handoff count on the run
    await db
      .update(workflowRuns)
      .set({
        handoffCount: sql`coalesce(${workflowRuns.handoffCount}, 0) + 1`,
      })
      .where(eq(workflowRuns.id, params.workflowRunId));

    return result[0];
  }

  /**
   * Get handoff statistics for a workflow
   */
  async getHandoffStats(workflowId: number) {
    const stats = await db
      .select({
        handoffType: agentHandoffs.handoffType,
        fromAgent: agentHandoffs.fromAgent,
        toAgent: agentHandoffs.toAgent,
        count: sql<number>`count(*)`,
      })
      .from(agentHandoffs)
      .innerJoin(workflowRuns, eq(agentHandoffs.workflowRunId, workflowRuns.id))
      .where(eq(workflowRuns.workflowId, workflowId))
      .groupBy(agentHandoffs.handoffType, agentHandoffs.fromAgent, agentHandoffs.toAgent);

    return stats;
  }
}

export const workflowService = new WorkflowService();
