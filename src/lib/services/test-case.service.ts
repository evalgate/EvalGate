/**
 * Test Case Service
 * Business logic for test case CRUD.
 * Extracted from src/app/api/evaluations/[id]/test-cases/route.ts
 * Enforces tenant boundary via evaluation ownership.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, testCases } from "@/db/schema";

export interface CreateTestCaseInput {
  name?: string;
  input: string;
  expectedOutput?: string | null;
  metadata?: unknown;
}

export const testCaseService = {
  /**
   * List test cases for an evaluation. Enforces evaluation exists and belongs to org.
   * Returns null if evaluation not found or not in org.
   */
  async list(
    organizationId: number,
    evaluationId: number,
    opts: { limit: number; offset: number },
  ) {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!evaluation) return null;

    return await db
      .select()
      .from(testCases)
      .where(eq(testCases.evaluationId, evaluationId))
      .orderBy(desc(testCases.createdAt))
      .limit(opts.limit)
      .offset(opts.offset);
  },

  /**
   * Create a test case. Enforces evaluation exists and belongs to org.
   * Returns null if evaluation not found or not in org.
   */
  async create(organizationId: number, evaluationId: number, data: CreateTestCaseInput) {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!evaluation) return null;

    const now = new Date().toISOString();
    const [newTestCase] = await db
      .insert(testCases)
      .values({
        evaluationId,
        name: data.name || `Test Case ${Date.now()}`,
        input: data.input.trim(),
        expectedOutput: data.expectedOutput?.trim() ?? null,
        metadata: data.metadata ?? null,
        createdAt: now,
      })
      .returning();

    return newTestCase;
  },

  /**
   * Remove a test case. Enforces evaluation exists and belongs to org,
   * and test case belongs to that evaluation (tenant-safe delete).
   * Returns false if evaluation, test case not found, or test case not in evaluation.
   */
  async remove(organizationId: number, evaluationId: number, testCaseId: number): Promise<boolean> {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!evaluation) return false;

    const [existing] = await db
      .select()
      .from(testCases)
      .where(and(eq(testCases.id, testCaseId), eq(testCases.evaluationId, evaluationId)))
      .limit(1);

    if (!existing) return false;

    await db
      .delete(testCases)
      .where(and(eq(testCases.id, testCaseId), eq(testCases.evaluationId, evaluationId)));

    return true;
  },
};
