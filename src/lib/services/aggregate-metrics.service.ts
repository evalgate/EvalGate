/**
 * Aggregate Metrics Service
 *
 * Computes exact aggregates for quality score inputs from real DB data:
 * passRate, safetyPassRate, judgeAvg, avgLatencyMs, runTotalCostUsd, avgCostPerTestCaseUsd.
 *
 * Also provides confidence bands for trend data based on sample size.
 */

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  costRecords,
  evaluationRuns,
  llmJudgeResults,
  qualityScores,
  testResults,
} from "@/db/schema";
import { canonicalizeJson } from "@/lib/crypto/canonical-json";
import { sha256Hex } from "@/lib/crypto/hash";
import { computeSafetyPassRate, parseAssertionsJson } from "@/lib/eval/assertions";
import { logger } from "@/lib/logger";
import {
  computeQualityScore,
  type QualityScoreResult,
  type ScoreInputs,
} from "@/lib/scoring/quality-score";
import { SCORING_SPEC_V1, SCORING_SPEC_VERSION } from "@/lib/scoring/scoring-spec";

export interface AggregateMetrics {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  safetyPassRate: number | null;
  safetyFromProxy: boolean; // true when using keyword proxy instead of assertionsJson
  traceCoverageRate: number | null; // for trace-linked runs: matched/total
  judgeAvg: number | null;
  avgLatencyMs: number | null;
  /** Sum of all cost records for the run */
  runTotalCostUsd: number | null;
  /** runTotalCostUsd / total (cost per test case) */
  avgCostPerTestCaseUsd: number | null;
  /** @deprecated Use avgCostPerTestCaseUsd */
  avgCostUsd: number | null;
  /** Count of cost_records for this run (for hasProvenance) */
  costRecordCount: number;
  /** Per-test-case: fraction of results with provenance (model/provider from cost). 0..1 or null. */
  provenanceCoverageRate: number | null;
}

export interface ConfidenceBand {
  lower: number;
  upper: number;
  sampleSize: number;
}

/**
 * Compute aggregates for a completed evaluation run from the test_results,
 * llm_judge_results, and cost_records tables.
 */
export async function computeRunAggregates(
  evaluationRunId: number,
  organizationId: number,
): Promise<AggregateMetrics> {
  // Pass/fail counts from test_results
  const results = await db
    .select({
      total: sql<number>`count(*)`,
      passed: sql<number>`sum(case when ${testResults.status} = 'passed' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${testResults.status} = 'failed' then 1 else 0 end)`,
      avgLatency: sql<number>`avg(${testResults.durationMs})`,
    })
    .from(testResults)
    .where(
      and(
        eq(testResults.evaluationRunId, evaluationRunId),
        eq(testResults.organizationId, organizationId),
      ),
    );

  const row = results[0] ?? { total: 0, passed: 0, failed: 0, avgLatency: null };
  const total = Number(row.total) || 0;
  const passed = Number(row.passed) || 0;
  const failed = Number(row.failed) || 0;
  const passRate = total > 0 ? passed / total : 0;
  const avgLatencyMs = row.avgLatency != null ? Number(row.avgLatency) : null;

  // Safety pass rate: prefer structured assertionsJson (envelope or legacy); fall back to keyword proxy
  let safetyPassRate: number | null = null;
  let safetyFromProxy = false;
  if (total > 0) {
    const resultsWithAssertions = await db
      .select({ assertionsJson: testResults.assertionsJson })
      .from(testResults)
      .where(
        and(
          eq(testResults.evaluationRunId, evaluationRunId),
          eq(testResults.organizationId, organizationId),
        ),
      );

    const withAssertions = resultsWithAssertions.filter(
      (r) => r.assertionsJson != null && typeof r.assertionsJson === "object",
    );

    if (withAssertions.length > 0) {
      const rates: number[] = [];
      for (const r of withAssertions) {
        const parsed = parseAssertionsJson(r.assertionsJson);
        const rate = computeSafetyPassRate(parsed);
        if (rate !== null) rates.push(rate);
      }
      if (rates.length > 0) {
        safetyPassRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      }
    }
    if (safetyPassRate === null) {
      safetyFromProxy = true;
      const safetyFailures = await db
        .select({ count: sql<number>`count(*)` })
        .from(testResults)
        .where(
          and(
            eq(testResults.evaluationRunId, evaluationRunId),
            eq(testResults.organizationId, organizationId),
            sql`lower(${testResults.error}) like '%safety%' or lower(${testResults.error}) like '%harmful%' or lower(${testResults.error}) like '%toxic%'`,
          ),
        );
      const safetyFails = Number(safetyFailures[0]?.count ?? 0);
      safetyPassRate = 1 - safetyFails / total;
    }
  }

  // Judge average from llm_judge_results (org-scoped via join)
  let judgeAvg: number | null = null;
  const judgeRows = await db
    .select({
      avgScore: sql<number>`avg(cast(${llmJudgeResults.score} as real))`,
    })
    .from(llmJudgeResults)
    .innerJoin(evaluationRuns, eq(llmJudgeResults.evaluationRunId, evaluationRuns.id))
    .where(
      and(
        eq(llmJudgeResults.evaluationRunId, evaluationRunId),
        eq(evaluationRuns.organizationId, organizationId),
      ),
    );

  if (judgeRows[0]?.avgScore != null) {
    // Normalize judge score to 0..1 (judge scores are 0-100)
    judgeAvg = Number(judgeRows[0].avgScore) / 100;
  }

  // Cost from cost_records: sum for run total, count for provenance
  let runTotalCostUsd: number | null = null;
  let costRecordCount = 0;
  const costRows = await db
    .select({
      totalCost: sql<number>`sum(cast(${costRecords.totalCost} as real))`,
      count: sql<number>`count(*)`,
    })
    .from(costRecords)
    .where(
      and(
        eq(costRecords.organizationId, organizationId),
        eq(costRecords.evaluationRunId, evaluationRunId),
      ),
    );

  if (costRows[0]) {
    costRecordCount = Number(costRows[0].count ?? 0);
    if (costRows[0].totalCost != null) {
      runTotalCostUsd = Number(costRows[0].totalCost);
    }
  }
  const avgCostPerTestCaseUsd =
    runTotalCostUsd != null && total > 0 ? runTotalCostUsd / total : null;

  // Trace coverage: for trace-linked runs, matchedCount / total
  let traceCoverageRate: number | null = null;
  const traceLinkedCount = await db
    .select({
      total: sql<number>`count(*)`,
      matched: sql<number>`sum(case when ${testResults.traceLinkedMatched} = 1 then 1 else 0 end)`,
    })
    .from(testResults)
    .where(
      and(
        eq(testResults.evaluationRunId, evaluationRunId),
        eq(testResults.organizationId, organizationId),
        isNotNull(testResults.traceLinkedMatched),
      ),
    );
  const tcRow = traceLinkedCount[0];
  if (tcRow && Number(tcRow.total) > 0) {
    traceCoverageRate = Number(tcRow.matched) / Number(tcRow.total);
  }

  // Provenance coverage: per-test-case fraction with model/provider from cost
  const provenanceCount = await db
    .select({
      withProvenance: sql<number>`sum(case when ${testResults.hasProvenance} = 1 then 1 else 0 end)`,
      nullProvenance: sql<number>`sum(case when ${testResults.hasProvenance} is null then 1 else 0 end)`,
    })
    .from(testResults)
    .where(
      and(
        eq(testResults.evaluationRunId, evaluationRunId),
        eq(testResults.organizationId, organizationId),
      ),
    );
  const provRow = provenanceCount[0];
  let provenanceCoverageRate: number | null = null;
  if (total > 0 && provRow) {
    const withProv = Number(provRow.withProvenance ?? 0);
    const nullProv = Number(provRow.nullProvenance ?? 0);
    // When run has cost records, treat null hasProvenance as provenance (direct_llm path)
    const effectiveWithProvenance = costRecordCount > 0 ? withProv + nullProv : withProv;
    provenanceCoverageRate = effectiveWithProvenance / total;
  }

  return {
    total,
    passed,
    failed,
    passRate,
    safetyPassRate,
    safetyFromProxy,
    traceCoverageRate,
    judgeAvg,
    avgLatencyMs,
    runTotalCostUsd,
    avgCostPerTestCaseUsd,
    avgCostUsd: avgCostPerTestCaseUsd,
    costRecordCount,
    provenanceCoverageRate,
  };
}

/**
 * Compute and persist the quality score for a completed evaluation run.
 * Called at the end of evaluation run processing.
 */
export async function computeAndStoreQualityScore(
  evaluationRunId: number,
  evaluationId: number,
  organizationId: number,
  model?: string,
): Promise<QualityScoreResult> {
  const metrics = await computeRunAggregates(evaluationRunId, organizationId);

  const hasProvenance = metrics.traceCoverageRate == null || metrics.costRecordCount > 0;

  const inputs: ScoreInputs = {
    total: metrics.total,
    passed: metrics.passed,
    safetyPassRate: metrics.safetyPassRate ?? undefined,
    safetyFromProxy: metrics.safetyFromProxy,
    traceCoverageRate: metrics.traceCoverageRate ?? undefined,
    hasProvenance,
    judgeAvg: metrics.judgeAvg ?? undefined,
    avgLatencyMs: metrics.avgLatencyMs ?? undefined,
    avgCostUsd: metrics.avgCostUsd ?? undefined,
  };

  const result = computeQualityScore(inputs);

  // Reproducible scoring: canonical inputs + spec + hashes
  const _inputsJson = JSON.stringify(inputs);
  const _scoringSpecJson = JSON.stringify(SCORING_SPEC_V1);
  const inputsHash = sha256Hex(canonicalizeJson(inputs));
  const scoringSpecHash = sha256Hex(canonicalizeJson(SCORING_SPEC_V1));
  const scoringCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null;

  // Backfill hasProvenance for direct_llm runs when cost records exist (only where null)
  if (metrics.costRecordCount > 0) {
    await db
      .update(testResults)
      .set({ hasProvenance: true })
      .where(
        and(
          eq(testResults.evaluationRunId, evaluationRunId),
          eq(testResults.organizationId, organizationId),
          isNull(testResults.hasProvenance),
        ),
      );
  }

  // Persist to quality_scores table
  await db.insert(qualityScores).values({
    evaluationRunId,
    evaluationId,
    organizationId,
    score: result.score,
    total: metrics.total,
    traceCoverageRate: metrics.traceCoverageRate != null ? String(metrics.traceCoverageRate) : null,
    provenanceCoverageRate:
      metrics.provenanceCoverageRate != null ? String(metrics.provenanceCoverageRate) : null,
    breakdown: JSON.stringify(result.breakdown),
    flags: JSON.stringify(result.flags),
    evidenceLevel: result.evidenceLevel,
    scoringVersion: SCORING_SPEC_VERSION,
    model: model ?? null,
    inputsJson: inputs,
    scoringSpecJson: SCORING_SPEC_V1,
    inputsHash,
    scoringSpecHash,
    scoringCommit,
    createdAt: new Date(),
  });

  logger.info("Quality score computed", {
    evaluationRunId,
    evaluationId,
    score: result.score,
    flags: result.flags,
  });

  return result;
}

/**
 * Recompute and store quality score for an evaluation run.
 * Deletes unknown existing score for the run, then computes fresh from aggregates.
 * Returns null if run not found or not in org.
 */
export async function recomputeAndStoreQualityScore(
  evaluationRunId: number,
  organizationId: number,
): Promise<QualityScoreResult | null> {
  const [run] = await db
    .select({ id: evaluationRuns.id, evaluationId: evaluationRuns.evaluationId })
    .from(evaluationRuns)
    .where(
      and(
        eq(evaluationRuns.id, evaluationRunId),
        eq(evaluationRuns.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!run) return null;

  await db
    .delete(qualityScores)
    .where(
      and(
        eq(qualityScores.evaluationRunId, evaluationRunId),
        eq(qualityScores.organizationId, organizationId),
      ),
    );

  const result = await computeAndStoreQualityScore(
    evaluationRunId,
    run.evaluationId,
    organizationId,
  );

  return result;
}

/**
 * Compute Wilson-score confidence interval for a proportion.
 * Returns 95% confidence bounds [lower, upper] for the true pass rate.
 */
export function wilsonConfidence(passed: number, total: number): ConfidenceBand {
  if (total === 0) return { lower: 0, upper: 1, sampleSize: 0 };

  const z = 1.96; // 95% CI
  const p = passed / total;
  const n = total;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

  return {
    lower: Math.max(0, (centre - margin) / denom),
    upper: Math.min(1, (centre + margin) / denom),
    sampleSize: total,
  };
}

/**
 * Augment a trend series with confidence bands based on sample sizes.
 */
export function addConfidenceBands(
  trendData: Array<{ score: number; passRate: number; total: number }>,
): Array<{ score: number; passRate: number; total: number; confidence: ConfidenceBand }> {
  return trendData.map((d) => ({
    ...d,
    confidence: wilsonConfidence(Math.round(d.passRate * d.total), d.total),
  }));
}
