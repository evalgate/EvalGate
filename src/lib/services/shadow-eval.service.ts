// src/lib/services/shadow-eval.service.ts

import { and, desc, eq, gte, inArray, like, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { evaluationRuns, evaluations, spans, testResults, traces } from "@/db/schema";
import { logger } from "@/lib/logger";
import { providerKeysService } from "@/lib/services/provider-keys.service";

export const createShadowEvalSchema = z.object({
  evaluationId: z.number(),
  traceIds: z.array(z.string()),
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  filters: z
    .object({
      status: z.array(z.string()).optional(),
      duration: z
        .object({
          min: z.number().optional(),
          max: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type CreateShadowEvalInput = z.infer<typeof createShadowEvalSchema>;

export interface ShadowEvalResult {
  id: number;
  evaluationId: number;
  originalEvaluationId: number;
  status: string;
  totalTraces: number;
  processedTraces: number;
  passedTraces: number;
  failedTraces: number;
  averageScore: number;
  averageDuration: number;
  startedAt: string;
  completedAt: string | null;
  results: Array<{
    traceId: string;
    originalScore: number | null;
    shadowScore: number;
    scoreDiff: number;
    passed: boolean;
    duration: number;
    metadata: Record<string, any>;
  }>;
}

export interface TraceReplayData {
  traceId: string;
  spans: Array<{
    spanId: string;
    name: string;
    type: string;
    input: string;
    output: string;
    duration: number;
    metadata: Record<string, any>;
  }>;
  metadata: Record<string, any>;
}

/**
 * Shadow Evaluation Service
 * Enables running evaluations against production trace data for comparison.
 * This is the core of "Shadow Evals" - running prompts against real production data.
 */
export class ShadowEvalService {
  /**
   * Create a shadow evaluation against production traces.
   */
  async createShadowEval(
    organizationId: number,
    input: CreateShadowEvalInput,
    createdBy: string,
  ): Promise<{
    id: number;
    status: string;
    totalTraces: number;
  }> {
    logger.info("Creating shadow evaluation", {
      organizationId,
      evaluationId: input.evaluationId,
      traceCount: input.traceIds.length,
    });

    // Verify evaluation exists and belongs to organization
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(
        and(eq(evaluations.id, input.evaluationId), eq(evaluations.organizationId, organizationId)),
      )
      .limit(1);

    if (!evaluation) {
      throw new Error("Evaluation not found or access denied");
    }

    // Get production traces for replay
    const productionTraces = await this.getProductionTraces(
      organizationId,
      input.traceIds,
      input.dateRange,
      input.filters,
    );

    if (productionTraces.length === 0) {
      throw new Error("No production traces found for shadow evaluation");
    }

    // Create shadow evaluation run
    const now = new Date().toISOString();
    const [shadowRun] = await db
      .insert(evaluationRuns)
      .values({
        evaluationId: input.evaluationId,
        organizationId,
        status: "pending",
        totalCases: productionTraces.length,
        processedCount: 0,
        passedCases: 0,
        failedCases: 0,
        environment: "dev",
        startedAt: now,
        traceLog: JSON.stringify({
          type: "shadow_eval",
          originalEvaluationId: input.evaluationId,
          traceIds: input.traceIds,
          dateRange: input.dateRange,
          filters: input.filters,
          createdBy,
          startedAt: now,
        }),
        createdAt: now,
      })
      .returning({
        id: evaluationRuns.id,
        status: evaluationRuns.status,
        totalCases: evaluationRuns.totalCases,
      });

    // Start background processing (fire-and-forget)
    this.processShadowEval(
      shadowRun.id,
      input.evaluationId,
      productionTraces,
      organizationId,
    ).catch((error) => {
      logger.error("Shadow eval processing failed", {
        shadowRunId: shadowRun.id,
        error: error.message,
      });
    });

    logger.info("Shadow evaluation created", {
      shadowRunId: shadowRun.id,
      totalTraces: productionTraces.length,
    });

    return {
      id: shadowRun.id,
      status: shadowRun.status,
      totalTraces: productionTraces.length,
    };
  }

  /**
   * Get shadow evaluation results.
   */
  async getShadowEvalResults(
    organizationId: number,
    shadowRunId: number,
  ): Promise<ShadowEvalResult | null> {
    const [run] = await db
      .select()
      .from(evaluationRuns)
      .innerJoin(evaluations, eq(evaluationRuns.evaluationId, evaluations.id))
      .where(
        and(eq(evaluationRuns.id, shadowRunId), eq(evaluations.organizationId, organizationId)),
      )
      .limit(1);

    if (!run) {
      return null;
    }

    // Get test results for this shadow run
    const results = await db
      .select()
      .from(testResults)
      .where(eq(testResults.evaluationRunId, shadowRunId));

    const processedTraces = results.length;
    const passedTraces = results.filter((r) => r.status === "passed").length;
    const failedTraces = results.filter((r) => r.status === "failed").length;
    const averageScore =
      processedTraces > 0
        ? results.reduce((sum, r) => sum + (r.score || 0), 0) / processedTraces
        : 0;
    const averageDuration =
      processedTraces > 0
        ? results.reduce((sum, r) => sum + (r.durationMs || 0), 0) / processedTraces
        : 0;

    // Parse trace log for metadata
    let traceLog = {};
    try {
      traceLog =
        typeof run.evaluation_runs.traceLog === "string"
          ? JSON.parse(run.evaluation_runs.traceLog)
          : run.evaluation_runs.traceLog;
    } catch (_error) {
      logger.warn("Failed to parse trace log", { shadowRunId });
    }

    return {
      id: run.evaluation_runs.id,
      evaluationId: run.evaluation_runs.evaluationId,
      originalEvaluationId: (traceLog as any).originalEvaluationId || 0,
      status: run.evaluation_runs.status,
      totalTraces: run.evaluation_runs.totalCases ?? 0,
      processedTraces,
      passedTraces,
      failedTraces,
      averageScore: Math.round(averageScore * 100) / 100,
      averageDuration: Math.round(averageDuration),
      startedAt: run.evaluation_runs.startedAt || "",
      completedAt: run.evaluation_runs.completedAt,
      results: results.map((result) => ({
        traceId: "",
        originalScore: null,
        shadowScore: result.score || 0,
        scoreDiff: 0,
        passed: result.status === "passed",
        duration: result.durationMs || 0,
        metadata: {},
      })),
    };
  }

  /**
   * Get production traces for shadow evaluation.
   */
  private async getProductionTraces(
    organizationId: number,
    traceIds: string[],
    dateRange?: { start: string; end: string },
    _filters?: {
      status?: string[];
      duration?: { min?: number; max?: number };
    },
  ): Promise<TraceReplayData[]> {
    // Build conditions upfront
    const conditions = [eq(traces.organizationId, organizationId)];
    if (traceIds.length > 0) {
      conditions.push(inArray(traces.traceId, traceIds));
    }
    if (dateRange) {
      conditions.push(gte(traces.createdAt, dateRange.start));
      conditions.push(lte(traces.createdAt, dateRange.end));
    }

    const tracesData = await db
      .select({ traceId: traces.traceId, metadata: traces.metadata })
      .from(traces)
      .where(and(...conditions))
      .orderBy(desc(traces.createdAt));

    // Get spans for each trace
    const traceReplayData: TraceReplayData[] = [];

    for (const trace of tracesData) {
      const traceSpanData = await db
        .select({
          spanId: spans.spanId,
          name: spans.name,
          type: spans.type,
          input: spans.input,
          output: spans.output,
          duration: spans.durationMs,
          metadata: spans.metadata,
        })
        .from(spans)
        .where(eq(spans.traceId, trace.traceId as any));

      traceReplayData.push({
        traceId: trace.traceId,
        spans: traceSpanData.map((span) => ({
          spanId: span.spanId,
          name: span.name,
          type: span.type,
          input: span.input || "",
          output: span.output || "",
          duration: span.duration || 0,
          metadata: typeof span.metadata === "string" ? JSON.parse(span.metadata) : span.metadata,
        })),
        metadata: typeof trace.metadata === "string" ? JSON.parse(trace.metadata) : trace.metadata,
      });
    }

    return traceReplayData;
  }

  /**
   * Process shadow evaluation in background.
   */
  private async processShadowEval(
    shadowRunId: number,
    evaluationId: number,
    productionTraces: TraceReplayData[],
    organizationId: number,
  ): Promise<void> {
    logger.info("Processing shadow evaluation", {
      shadowRunId,
      traceCount: productionTraces.length,
    });

    // Get evaluation configuration
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, organizationId)))
      .limit(1);

    if (!evaluation) {
      throw new Error("Evaluation not found");
    }

    let processedCount = 0;
    let passedCount = 0;
    let failedCount = 0;

    try {
      // Update status to running
      await db
        .update(evaluationRuns)
        .set({ status: "running" })
        .where(eq(evaluationRuns.id, shadowRunId));

      // Process each production trace
      for (const trace of productionTraces) {
        const result = await this.replayTrace(trace, evaluation);

        // Save result
        await db.insert(testResults).values({
          evaluationRunId: shadowRunId,
          testCaseId: 0, // Shadow evals don't have test cases
          organizationId,
          status: result.passed ? "passed" : "failed",
          output: result.output,
          score: result.score,
          error: result.error,
          durationMs: result.duration,
          messages: JSON.stringify(result.messages || []),
          toolCalls: JSON.stringify(result.toolCalls || []),
          createdAt: new Date().toISOString(),
        });

        if (result.passed) {
          passedCount++;
        } else {
          failedCount++;
        }

        processedCount++;

        // Update progress
        await db
          .update(evaluationRuns)
          .set({
            processedCount,
            passedCases: passedCount,
            failedCases: failedCount,
          })
          .where(eq(evaluationRuns.id, shadowRunId));
      }

      // Mark as completed
      const finalStatus = failedCount === 0 ? "completed" : "completed_with_failures";
      await db
        .update(evaluationRuns)
        .set({
          status: finalStatus,
          processedCount,
          passedCases: passedCount,
          failedCases: failedCount,
          completedAt: new Date().toISOString(),
        })
        .where(eq(evaluationRuns.id, shadowRunId));

      logger.info("Shadow evaluation completed", {
        shadowRunId,
        totalTraces: productionTraces.length,
        processedCount,
        passedCount,
        failedCount,
      });
    } catch (error: any) {
      logger.error("Shadow evaluation failed", { shadowRunId, error: error.message });

      await db
        .update(evaluationRuns)
        .set({
          status: "failed",
          completedAt: new Date().toISOString(),
        })
        .where(eq(evaluationRuns.id, shadowRunId));
    }
  }

  /**
   * Replay a single trace against current evaluation.
   */
  private async replayTrace(
    trace: TraceReplayData,
    evaluation: any,
  ): Promise<{
    passed: boolean;
    score: number;
    output: string;
    error?: string;
    originalScore?: number;
    duration: number;
    messages?: any[];
    toolCalls?: any[];
  }> {
    try {
      // Extract the main input/output from the trace
      const mainSpan = trace.spans.find((span) => span.type === "llm" || span.type === "main");
      if (!mainSpan) {
        throw new Error("No main LLM span found in trace");
      }

      const input = mainSpan.input;
      const originalOutput = mainSpan.output;
      const _originalDuration = mainSpan.duration;

      const systemPrompt =
        evaluation.modelSettings?.systemPrompt || "You are a helpful AI assistant.";
      const model = evaluation.modelSettings?.model || "gpt-4o-mini";
      const organizationId = evaluation.organizationId;

      // Determine provider and get API key
      const provider = this.getProviderFromModel(model);
      const providerKey = await providerKeysService.getActiveProviderKey(organizationId, provider);

      let replayOutput = "";
      const startTime = Date.now();

      if (!providerKey) {
        // No API key — fall back to heuristic comparison
        logger.warn("No provider key for shadow eval, using heuristic", {
          organizationId,
          provider,
        });
        replayOutput = `[Heuristic] Replay for: ${input.substring(0, 100)}`;
      } else {
        const apiKey = providerKey.decryptedKey;

        if (provider === "openai") {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: input },
              ],
              max_tokens: 2048,
              temperature: 0.2,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
          replayOutput = json.choices?.[0]?.message?.content ?? "";
        } else if (provider === "anthropic") {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 2048,
              system: systemPrompt,
              messages: [{ role: "user", content: input }],
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
          replayOutput = json.content?.[0]?.text ?? "";
        } else {
          throw new Error(`Unsupported provider: ${provider}`);
        }
      }

      const duration = Date.now() - startTime;
      const score = this.calculateSimilarityScore(originalOutput, replayOutput);
      const passed = score >= 70;

      return {
        passed,
        score,
        output: replayOutput,
        originalScore: this.extractOriginalScoreFromTrace(trace) ?? undefined,
        duration,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
          { role: "assistant", content: replayOutput },
        ],
        toolCalls: [],
      };
    } catch (error: any) {
      return {
        passed: false,
        score: 0,
        output: "",
        error: error.message,
        duration: 0,
        messages: [],
        toolCalls: [],
      };
    }
  }

  /**
   * Determine the LLM provider from a model name.
   */
  private getProviderFromModel(model: string): string {
    const m = model.toLowerCase();
    if (
      m.includes("gpt") ||
      m.includes("o1") ||
      m.includes("o3") ||
      m.includes("davinci") ||
      m.includes("turbo")
    )
      return "openai";
    if (m.includes("claude") || m.includes("haiku") || m.includes("sonnet") || m.includes("opus"))
      return "anthropic";
    return "openai";
  }

  /**
   * Calculate similarity score between original and new output.
   */
  private calculateSimilarityScore(original: string, current: string): number {
    if (!original || !current) return 0;

    const originalWords = original.toLowerCase().split(" ");
    const currentWords = current.toLowerCase().split(" ");

    let matches = 0;
    for (const word of originalWords) {
      if (currentWords.includes(word)) {
        matches++;
      }
    }

    return Math.round((matches / originalWords.length) * 100);
  }

  private extractOriginalScoreFromTrace(trace: TraceReplayData): number | null {
    try {
      return trace.metadata?.score || null;
    } catch {
      return null;
    }
  }

  /**
   * Get shadow evaluation statistics.
   */
  async getShadowEvalStats(organizationId: number): Promise<{
    totalEvals: number;
    completedEvals: number;
    averageScoreImprovement: number;
    recentEvals: Array<{
      id: number;
      evaluationId: number;
      status: string;
      averageScore: number;
      completedAt: string;
    }>;
  }> {
    const runs = await db
      .select({
        id: evaluationRuns.id,
        evaluationId: evaluationRuns.evaluationId,
        status: evaluationRuns.status,
        traceLog: evaluationRuns.traceLog,
        completedAt: evaluationRuns.completedAt,
      })
      .from(evaluationRuns)
      .innerJoin(evaluations, eq(evaluationRuns.evaluationId, evaluations.id))
      .where(
        and(
          eq(evaluations.organizationId, organizationId),
          // Filter for shadow evals by checking trace log type
          like(evaluationRuns.traceLog as any, "%shadow_eval%"),
        ),
      )
      .orderBy(desc(evaluationRuns.createdAt))
      .limit(10);

    const totalEvals = runs.length;
    const completedEvals = runs.filter((r) =>
      ["completed", "completed_with_failures"].includes(r.status),
    ).length;

    // Calculate average score improvement
    let totalScoreDiff = 0;
    let scoreDiffCount = 0;

    for (const run of runs) {
      try {
        const traceLog = typeof run.traceLog === "string" ? JSON.parse(run.traceLog) : run.traceLog;
        if (traceLog.scoreImprovement !== undefined) {
          totalScoreDiff += traceLog.scoreImprovement;
          scoreDiffCount++;
        }
      } catch (_error) {
        // Skip malformed trace logs
      }
    }

    const averageScoreImprovement = scoreDiffCount > 0 ? totalScoreDiff / scoreDiffCount : 0;

    return {
      totalEvals,
      completedEvals,
      averageScoreImprovement: Math.round(averageScoreImprovement * 100) / 100,
      recentEvals: runs.map((run) => ({
        id: run.id,
        evaluationId: run.evaluationId,
        status: run.status,
        averageScore: 0, // Would need to calculate from test results
        completedAt: run.completedAt || "",
      })),
    };
  }
}

// Export singleton instance
export const shadowEvalService = new ShadowEvalService();
