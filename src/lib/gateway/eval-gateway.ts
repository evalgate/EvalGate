// src/lib/gateway/eval-gateway.ts
import { db } from '@/db';
import { evaluations, evaluationRuns, testCases } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { evalWorker } from '@/lib/workers/eval-worker';

interface StartRunOptions {
  testCases?: string[];
  settings?: Record<string, any>;
  idempotencyKey?: string;
}

interface RunStatus {
  id: number;
  status: string;
  totalCases: number;
  processedCount: number;
  passedCases: number;
  failedCases: number;
  startedAt?: string;
  completedAt?: string;
  traceLog?: any;
}

class EvalGateway {
  /**
   * Create a new evaluation run and trigger background processing.
   * Returns immediately with PENDING status; actual work happens in worker.
   */
  async startRun(
    evaluationId: number,
    organizationId: number,
    userId: string,
    options: StartRunOptions = {}
  ): Promise<RunStatus> {
    logger.info('Gateway: Starting evaluation run', { evaluationId, organizationId, userId });

    // 1. Verify evaluation exists and belongs to organization
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!evaluation) {
      throw new Error('Evaluation not found or access denied');
    }

    // 2. Get test cases (either specified or all for evaluation)
    let testCaseIds: number[] = [];
    if (options.testCases) {
      // Use provided test case IDs
      const cases = await db
        .select({ id: testCases.id })
        .from(testCases)
        .where(and(
          eq(testCases.evaluationId, evaluationId),
          // TODO: Add filter for provided test case IDs when they're strings
        ));
      testCaseIds = cases.map(c => c.id);
    } else {
      // Use all test cases for evaluation
      const cases = await db
        .select({ id: testCases.id })
        .from(testCases)
        .where(eq(testCases.evaluationId, evaluationId));
      testCaseIds = cases.map(c => c.id);
    }

    if (testCaseIds.length === 0) {
      throw new Error('No test cases found for evaluation');
    }

    // 2b. Idempotency check: if an idempotencyKey is provided, return existing run
    if (options.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(evaluationRuns)
        .where(eq(evaluationRuns.idempotencyKey, options.idempotencyKey))
        .limit(1);

      if (existing) {
        logger.info('Gateway: Returning existing run for idempotency key', {
          runId: existing.id,
          idempotencyKey: options.idempotencyKey,
        });
        return {
          id: existing.id,
          status: existing.status,
          totalCases: existing.totalCases ?? 0,
          processedCount: existing.processedCount ?? 0,
          passedCases: existing.passedCases ?? 0,
          failedCases: existing.failedCases ?? 0,
          startedAt: existing.startedAt ?? undefined,
          completedAt: existing.completedAt ?? undefined,
          traceLog: existing.traceLog,
        };
      }
    }

    // 3. Create evaluation run with PENDING status
    const now = new Date().toISOString();
    const [run] = await db.insert(evaluationRuns).values({
      evaluationId,
      organizationId,
      idempotencyKey: options.idempotencyKey ?? null,
      status: 'pending',
      totalCases: testCaseIds.length,
      processedCount: 0,
      passedCases: 0,
      failedCases: 0,
      environment: 'dev',
      startedAt: now,
      traceLog: JSON.stringify({
        startedAt: now,
        evaluationId,
        organizationId,
        userId,
        settings: options.settings,
        testCases: testCaseIds.length,
      }),
      createdAt: now,
    }).returning();

    logger.info('Gateway: Created evaluation run', { runId: run.id, totalCases: testCaseIds.length });

    // 4. Fire-and-forget: trigger background worker
    // This runs asynchronously and doesn't block the response
    this.triggerWorker(run.id, evaluationId, organizationId, userId, testCaseIds, options).catch(error => {
      logger.error('Gateway: Failed to trigger worker', { runId: run.id, error });
      // Update run status to failed if worker can't be triggered
      db.update(evaluationRuns)
        .set({ 
          status: 'failed',
          completedAt: new Date().toISOString(),
          traceLog: JSON.stringify({
            ...(run.traceLog ? JSON.parse(run.traceLog as string) : {}),
            error: 'Failed to start background worker',
            failedAt: new Date().toISOString(),
          })
        })
        .where(eq(evaluationRuns.id, run.id));
    });

    return {
      id: run.id,
      status: run.status,
      totalCases: run.totalCases || 0,
      processedCount: run.processedCount || 0,
      passedCases: run.passedCases || 0,
      failedCases: run.failedCases || 0,
      startedAt: run.startedAt || undefined,
    };
  }

  /**
   * Get current status of an evaluation run.
   */
  async getRunStatus(runId: number, organizationId: number): Promise<RunStatus> {
    const [run] = await db
      .select()
      .from(evaluationRuns)
      .innerJoin(evaluations, eq(evaluationRuns.evaluationId, evaluations.id))
      .where(and(eq(evaluationRuns.id, runId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!run) {
      throw new Error('Evaluation run not found or access denied');
    }

    return {
      id: run.evaluation_runs.id,
      status: run.evaluation_runs.status,
      totalCases: run.evaluation_runs.totalCases || 0,
      processedCount: run.evaluation_runs.processedCount || 0,
      passedCases: run.evaluation_runs.passedCases || 0,
      failedCases: run.evaluation_runs.failedCases || 0,
      startedAt: run.evaluation_runs.startedAt || undefined,
      completedAt: run.evaluation_runs.completedAt || undefined,
      traceLog: run.evaluation_runs.traceLog,
    };
  }

  /**
   * Cancel an evaluation run.
   */
  async cancelRun(runId: number, organizationId: number): Promise<void> {
    const [run] = await db
      .select()
      .from(evaluationRuns)
      .innerJoin(evaluations, eq(evaluationRuns.evaluationId, evaluations.id))
      .where(and(eq(evaluationRuns.id, runId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!run) {
      throw new Error('Evaluation run not found or access denied');
    }

    // Only allow cancellation if run is pending or running
    if (!['pending', 'running'].includes(run.evaluation_runs.status)) {
      throw new Error('Cannot cancel evaluation run in current status');
    }

    await db.update(evaluationRuns)
      .set({
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        traceLog: JSON.stringify({
          ...(run.evaluation_runs.traceLog ? JSON.parse(run.evaluation_runs.traceLog as string) : {}),
          cancelledAt: new Date().toISOString(),
        }),
      })
      .where(eq(evaluationRuns.id, runId));

    logger.info('Gateway: Cancelled evaluation run', { runId });
  }

  /**
   * Trigger background worker to process the evaluation.
   * This is fire-and-forget - we don't wait for completion.
   */
  private async triggerWorker(
    runId: number,
    evaluationId: number,
    organizationId: number,
    userId: string,
    testCaseIds: number[],
    options: StartRunOptions
  ): Promise<void> {
    // Update run status to running
    await db.update(evaluationRuns)
      .set({ status: 'running' })
      .where(eq(evaluationRuns.id, runId));

    // Trigger the background worker
    // In a real implementation, this could use a job queue (Bull, Agenda, etc.)
    // For now, we'll use setTimeout to simulate async processing
    setTimeout(() => {
      evalWorker.processRun(runId, evaluationId, organizationId, userId, testCaseIds, options);
    }, 100); // Small delay to ensure DB transaction is committed
  }
}

export const evalGateway = new EvalGateway();
