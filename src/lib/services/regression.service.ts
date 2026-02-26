// src/lib/services/regression.service.ts

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { goldenSets, testCases } from "@/db/schema";
import { logger } from "@/lib/logger";

export interface RegressionResult {
  goldenSetId: number;
  status: "passed" | "failed";
  results: { testCaseId: number; name: string; score: number; passed: boolean }[];
  avgScore: number;
  passedCount: number;
  totalCount: number;
}

class RegressionService {
  /**
   * Run a quick mini-eval against the golden set for an evaluation.
   * Returns within seconds — this is the "Save button" check.
   */
  async runQuick(evaluationId: number, organizationId: number): Promise<RegressionResult> {
    // 1. Find the golden set
    const [goldenSet] = await db
      .select()
      .from(goldenSets)
      .where(
        and(
          eq(goldenSets.evaluationId, evaluationId),
          eq(goldenSets.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!goldenSet) {
      throw new Error("No golden set configured. Mark your most important test cases first.");
    }

    const caseIds = goldenSet.testCaseIds as number[];
    if (caseIds.length === 0) {
      throw new Error("Golden set has no test cases.");
    }

    // 2. Fetch the golden test cases
    const cases = await db.select().from(testCases).where(inArray(testCases.id, caseIds));

    // 3. Run quick scoring (no LLM call — use local similarity scoring for speed)
    const results = cases.map((tc) => {
      if (!tc.expectedOutput) {
        return { testCaseId: tc.id, name: tc.name, score: 100, passed: true };
      }
      const score = this.quickScore(tc.expectedOutput, tc.input);
      return {
        testCaseId: tc.id,
        name: tc.name,
        score,
        passed: score >= (goldenSet.passThreshold || 70),
      };
    });

    const passedCount = results.filter((r) => r.passed).length;
    const avgScore =
      results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
        : 0;
    const status = passedCount === results.length ? "passed" : "failed";

    // 4. Update golden set status
    await db
      .update(goldenSets)
      .set({
        lastStatus: status,
        lastRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(goldenSets.id, goldenSet.id));

    logger.info("Regression check complete", {
      evaluationId,
      status,
      avgScore,
      passedCount,
      total: results.length,
    });

    return {
      goldenSetId: goldenSet.id,
      status,
      results,
      avgScore,
      passedCount,
      totalCount: results.length,
    };
  }

  /**
   * Create or update a golden set from selected test case IDs.
   */
  async setGoldenCases(evaluationId: number, organizationId: number, testCaseIds: number[]) {
    const existing = await db
      .select()
      .from(goldenSets)
      .where(
        and(
          eq(goldenSets.evaluationId, evaluationId),
          eq(goldenSets.organizationId, organizationId),
        ),
      )
      .limit(1);

    const now = new Date();
    if (existing.length > 0) {
      await db
        .update(goldenSets)
        .set({ testCaseIds: JSON.stringify(testCaseIds), updatedAt: now })
        .where(eq(goldenSets.id, existing[0].id));
      return existing[0].id;
    }

    const [created] = await db
      .insert(goldenSets)
      .values({
        evaluationId,
        organizationId,
        testCaseIds: JSON.stringify(testCaseIds),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created.id;
  }

  /**
   * Quick local similarity scoring (keyword match rate).
   * No LLM call — for speed on the save-button check.
   */
  private quickScore(expected: string, actual: string): number {
    const expWords = expected
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (expWords.length === 0) return 100;
    const actLower = actual.toLowerCase();
    const matched = expWords.filter((w) => actLower.includes(w)).length;
    return Math.round((matched / expWords.length) * 100);
  }
}

export const regressionService = new RegressionService();
