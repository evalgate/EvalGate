/**
 * Server-side evaluation run export
 * GET /api/evaluations/[id]/runs/[runId]/export
 * Returns full export payload with IAA for human evals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  evaluations,
  evaluationRuns,
  testResults,
  testCases,
  humanAnnotations,
  llmJudgeResults,
  user,
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { notFound } from '@/lib/api/errors';
import { SCOPES } from '@/lib/auth/scopes';
import { computeIAA, type AnnotationRecord } from '@/lib/iaa';
import { formatExportData, type EvaluationType } from '@/lib/export-templates';
import { calculateQualityScore, type EvaluationStats } from '@/lib/ai-quality-score';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const evaluationId = parseInt(params.id);
  const runId = parseInt(params.runId);

  const [evaluation] = await db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, ctx.organizationId)))
    .limit(1);

  if (!evaluation) return notFound('Evaluation not found');

  const [run] = await db
    .select()
    .from(evaluationRuns)
    .where(and(eq(evaluationRuns.id, runId), eq(evaluationRuns.evaluationId, evaluationId)))
    .limit(1);

  if (!run || run.organizationId !== ctx.organizationId) return notFound('Run not found');

  const totalCases = run.totalCases ?? 0;
  const passedCases = run.passedCases ?? 0;
  const failedCases = run.failedCases ?? 0;
  const stats: EvaluationStats = {
    totalEvaluations: totalCases,
    passedEvaluations: passedCases,
    failedEvaluations: failedCases,
    averageLatency: 500,
    averageCost: 0.01,
    averageScore: totalCases > 0 ? (passedCases / totalCases) * 100 : 0,
    consistencyScore: 85,
  };
  const qualityScore = calculateQualityScore(stats);

  const baseData = {
    evaluation: {
      id: String(evaluation.id),
      name: evaluation.name,
      description: evaluation.description ?? '',
      type: evaluation.type as EvaluationType,
      category: (evaluation as { category?: string }).category,
      created_at: evaluation.createdAt,
    },
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: totalCases,
      passed: passedCases,
      failed: failedCases,
      passRate: totalCases ? `${Math.round((passedCases / totalCases) * 100)}%` : '0%',
    },
    qualityScore,
  };

  let additionalData: Record<string, unknown> = {};

  if (evaluation.type === 'human_eval') {
    const annotations = await db
      .select({
        id: humanAnnotations.id,
        testCaseId: humanAnnotations.testCaseId,
        annotatorId: humanAnnotations.annotatorId,
        rating: humanAnnotations.rating,
        feedback: humanAnnotations.feedback,
        labels: humanAnnotations.labels,
        createdAt: humanAnnotations.createdAt,
      })
      .from(humanAnnotations)
      .where(eq(humanAnnotations.evaluationRunId, runId));

    const annotatorNames = new Map<string, string>();
    const userIds = [...new Set(annotations.map((a) => a.annotatorId))];
    if (userIds.length > 0) {
      const usersData = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, userIds));
      for (const u of usersData) annotatorNames.set(u.id, u.name ?? u.id);
    }

    const iaaRecords: AnnotationRecord[] = annotations.map((a) => {
      const category = a.rating != null ? a.rating : (a.labels as Record<string, unknown>)?.['rating'] ?? (a.labels as Record<string, unknown>)?.['quality'];
      return {
        itemId: a.testCaseId,
        annotatorId: a.annotatorId,
        category: category != null ? String(category) : '',
      };
    }).filter((r) => r.category !== '');

    const iaaResult = computeIAA(iaaRecords);

    const evaluationsList = annotations.map((a) => ({
      id: String(a.id),
      evaluator_id: a.annotatorId,
      evaluator_name: annotatorNames.get(a.annotatorId) ?? a.annotatorId,
      test_case_id: String(a.testCaseId),
      ratings: {
        rating: a.rating,
        ...(typeof a.labels === 'object' && a.labels ? (a.labels as Record<string, number | string>) : {}),
      },
      comments: a.feedback ?? '',
      timestamp: a.createdAt,
    }));

    const execSettings = evaluation.executionSettings as { humanEvalCriteria?: Array<{ name: string; description?: string; scale?: string }> } | null;
    const criteria = execSettings?.humanEvalCriteria ?? [];

    additionalData = {
      evaluations: evaluationsList,
      interRaterReliability: {
        cohens_kappa: iaaResult.cohensKappa,
        fleiss_kappa: iaaResult.fleissKappa,
        agreement_percentage: iaaResult.agreementPercentage,
      },
      criteria: criteria.map((c) => ({
        name: c.name,
        description: c.description ?? '',
        scale: c.scale ?? '1-5',
      })),
    };
  } else if (evaluation.type === 'unit_test') {
    const results = await db
      .select({
        result: testResults,
        testCase: testCases,
      })
      .from(testResults)
      .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
      .where(eq(testResults.evaluationRunId, runId));

    additionalData = {
      testResults: results.map((r) => ({
        id: String(r.result.id),
        name: r.testCase?.name ?? '',
        input: r.testCase?.input,
        expected_output: r.testCase?.expectedOutput,
        actual_output: r.result.output,
        passed: r.result.status === 'passed',
        execution_time_ms: r.result.durationMs ?? undefined,
        error_message: r.result.error ?? undefined,
      })),
    };
  } else if (evaluation.type === 'model_eval') {
    const judgeResults = await db
      .select()
      .from(llmJudgeResults)
      .where(eq(llmJudgeResults.evaluationRunId, runId));

    const modelSettings = evaluation.modelSettings as { judgeModel?: string; judgePrompt?: string } | null;
    additionalData = {
      judgeEvaluations: judgeResults.map((j) => ({
        id: String(j.id),
        test_case_id: j.testCaseId ? String(j.testCaseId) : '',
        judge_model: modelSettings?.judgeModel ?? 'gpt-4',
        input: j.input,
        response: j.output,
        judgment: {
          label: (j.metadata as { label?: string })?.label ?? '',
          score: j.score ?? 0,
          reasoning: j.reasoning ?? '',
          metadata: j.metadata ?? undefined,
        },
        timestamp: j.createdAt,
      })),
      judgePrompt: modelSettings?.judgePrompt ?? '',
      judgeModel: modelSettings?.judgeModel ?? 'gpt-4',
      aggregateMetrics: judgeResults.length > 0
        ? {
            average_score:
              judgeResults.reduce((s, j) => s + (j.score ?? 0), 0) / judgeResults.length,
            score_distribution: {} as Record<string, number>,
            common_failure_patterns: [] as string[],
          }
        : undefined,
    };
  } else {
    additionalData = { testResults: [], recentRuns: [] };
  }

  const exportData = formatExportData(baseData, additionalData);

  return NextResponse.json(exportData);
}, { requiredScopes: [SCOPES.RUNS_READ] });
