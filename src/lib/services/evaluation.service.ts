/**
 * Evaluation Service Layer
 * Handles business logic for evaluation operations
 */

import { db } from '@/db';
import { evaluations, evaluationRuns, evaluationTestCases } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const createEvaluationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.string().default('standard'),
  modelConfig: z.record(z.any()).optional(),
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })).optional(),
});

export const updateEvaluationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  modelConfig: z.record(z.any()).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>;

export class EvaluationService {
  /**
   * List evaluations for an organization with pagination
   */
  async list(organizationId: number, options?: {
    limit?: number;
    offset?: number;
    status?: 'draft' | 'active' | 'archived';
  }) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    logger.info('Listing evaluations', { organizationId, limit, offset, status: options?.status });

    const whereConditions = [eq(evaluations.organizationId, organizationId)];
    
    if (options?.status) {
      whereConditions.push(eq(evaluations.status, options.status));
    }

    const results = await db
      .select()
      .from(evaluations)
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(evaluations.createdAt));

    logger.info('Evaluations listed', { count: results.length, organizationId });

    return results;
  }

  /**
   * Get evaluation by ID
   */
  async getById(id: number, organizationId: number) {
    logger.info('Getting evaluation by ID', { id, organizationId });

    const evaluation = await db.query.evaluations.findFirst({
      where: and(
        eq(evaluations.id, id),
        eq(evaluations.organizationId, organizationId)
      ),
      with: {
        testCases: {
          limit: 100,
          orderBy: (testCases: any, { asc }: any) => [asc(testCases.id)],
        },
        runs: {
          limit: 10,
          orderBy: (runs: any, { desc }: any) => [desc(runs.createdAt)],
        },
      },
    });

    if (!evaluation) {
      logger.warn('Evaluation not found', { id, organizationId });
      return null;
    }

    logger.info('Evaluation retrieved', { id, organizationId });
    return evaluation;
  }

  /**
   * Create a new evaluation
   */
  async create(organizationId: number, createdBy: string, data: CreateEvaluationInput) {
    logger.info('Creating evaluation', { organizationId, name: data.name });

    const [evaluation] = await db.insert(evaluations).values({
      organizationId,
      createdBy,
      name: data.name,
      description: data.description || '',
      type: data.type || 'standard',
      modelSettings: data.modelConfig ? JSON.stringify(data.modelConfig) : null,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    // Create test cases if provided
    if (data.testCases && data.testCases.length > 0) {
      await db.insert(evaluationTestCases).values(
        data.testCases.map((tc) => ({
          evaluationId: evaluation.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput || '',
          metadata: JSON.stringify(tc.metadata || {}),
          createdAt: new Date().toISOString(),
        }))
      );
    }

    logger.info('Evaluation created', { id: evaluation.id, organizationId });

    return evaluation;
  }

  /**
   * Update an evaluation
   */
  async update(id: number, organizationId: number, data: UpdateEvaluationInput) {
    logger.info('Updating evaluation', { id, organizationId });

    // Verify ownership
    const existing = await this.getById(id, organizationId);
    if (!existing) {
      logger.warn('Evaluation not found for update', { id, organizationId });
      return null;
    }

    const [updated] = await db
      .update(evaluations)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(evaluations.id, id),
        eq(evaluations.organizationId, organizationId)
      ))
      .returning();

    logger.info('Evaluation updated', { id, organizationId });

    return updated;
  }

  /**
   * Delete an evaluation
   */
  async delete(id: number, organizationId: number) {
    logger.info('Deleting evaluation', { id, organizationId });

    // Verify ownership
    const existing = await this.getById(id, organizationId);
    if (!existing) {
      logger.warn('Evaluation not found for deletion', { id, organizationId });
      return false;
    }

    await db
      .delete(evaluations)
      .where(and(
        eq(evaluations.id, id),
        eq(evaluations.organizationId, organizationId)
      ));

    logger.info('Evaluation deleted', { id, organizationId });

    return true;
  }

  /**
   * Run an evaluation
   */
  async run(id: number, organizationId: number) {
    logger.info('Running evaluation', { id, organizationId });

    const evaluation = await this.getById(id, organizationId);
    if (!evaluation) {
      logger.warn('Evaluation not found for run', { id, organizationId });
      return null;
    }

    const [run] = await db.insert(evaluationRuns).values({
      evaluationId: id,
      status: 'running',
      startedAt: new Date().toISOString(),
      totalCases: 0, // Will be updated when evaluation runs
      passedCases: 0,
      failedCases: 0,
      createdAt: new Date().toISOString(),
    }).returning();

    logger.info('Evaluation run started', { runId: run.id, evaluationId: id });

    // TODO: Trigger async evaluation processing
    // For now, immediately mark as completed (placeholder)
    await db
      .update(evaluationRuns)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      .where(eq(evaluationRuns.id, run.id));

    return run;
  }

  /**
   * Get evaluation statistics
   */
  async getStats(id: number, organizationId: number) {
    logger.info('Getting evaluation stats', { id, organizationId });

    const evaluation = await this.getById(id, organizationId);
    if (!evaluation) {
      return null;
    }

    // Query counts separately to avoid TypeScript issues with relations
    const runs = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.evaluationId, id));

    const testCases = await db
      .select()
      .from(evaluationTestCases)
      .where(eq(evaluationTestCases.evaluationId, id));

    return {
      totalRuns: runs.length,
      totalTestCases: testCases.length,
      lastRunAt: runs[0]?.createdAt || null,
      status: evaluation.status,
    };
  }
}

// Export singleton instance
export const evaluationService = new EvaluationService();

