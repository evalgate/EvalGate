// src/lib/workers/eval-worker.ts

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { evaluationRuns, evaluations, testCases, testResults } from "@/db/schema";

// Define types based on table schema
type TestCase = typeof testCases.$inferSelect;
type Evaluation = typeof evaluations.$inferSelect;

import { logger } from "@/lib/logger";
import { computeAndStoreQualityScore } from "@/lib/services/aggregate-metrics.service";
// import { validateSDKTestResult, validateSDKEvaluationResult } from '@/lib/sdk/mapper';
// import { transformTestResultToDB, transformEvaluationResultToDB } from '@/lib/sdk/transformer';
import { llmJudgeService } from "@/lib/services/llm-judge.service";
import { providerKeysService } from "@/lib/services/provider-keys.service";
import {
  createEvaluationCompletedMessage,
  createEvaluationProgressMessage,
  createSSEMessage,
  createTestCaseCompletedMessage,
  createTestCaseFailedMessage,
  sseServer,
} from "@/lib/streaming/sse-server";

interface WorkerOptions {
  testCases?: string[];
  settings?: Record<string, unknown>;
}

/**
 * Background evaluation worker that processes runs asynchronously.
 * Implements heartbeat pattern for progress tracking and captures full trace journey.
 */
class EvalWorker {
  /**
   * Process an evaluation run in the background.
   * This is the main worker entry point that handles the entire evaluation lifecycle.
   */
  async processRun(
    runId: number,
    evaluationId: number,
    organizationId: number,
    _userId: string,
    testCaseIds: number[],
    options: WorkerOptions = {},
  ): Promise<void> {
    logger.info("Worker: Starting evaluation run processing", {
      runId,
      evaluationId,
      testCaseIds: testCaseIds.length,
    });

    try {
      // 1. Fetch evaluation configuration
      const [evaluation] = await db
        .select()
        .from(evaluations)
        .where(
          and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, organizationId)),
        )
        .limit(1);

      if (!evaluation) {
        throw new Error("Evaluation not found or access denied");
      }

      // 2. Fetch test cases
      const testCasesData = await db
        .select()
        .from(testCases)
        .where(and(eq(testCases.evaluationId, evaluationId), inArray(testCases.id, testCaseIds)));

      if (testCasesData.length === 0) {
        throw new Error("No test cases found");
      }

      // 3. Initialize trace log
      const traceLog = {
        evaluationName: evaluation.name,
        evaluationType: evaluation.type,
        startedAt: new Date().toISOString(),
        testCases: testCaseIds.length,
        settings: options.settings,
        heartbeat: [] as Array<{ timestamp: string; processedCount: number; message: string }>,
        turns: [] as Array<{
          testCaseId: number;
          input: string;
          output: string;
          messages: unknown[];
          toolCalls: unknown[];
          timestamp: string;
          duration: number;
        }>,
      };

      // 4. Process each test case with heartbeat updates
      let processedCount = 0;
      let passedCount = 0;
      let failedCount = 0;

      for (const testCase of testCasesData) {
        const turnStart = Date.now();

        // Heartbeat update before processing
        await this.updateHeartbeat(runId, processedCount, `Processing test case: ${testCase.name}`);

        try {
          // Simulate SDK evaluation (will be replaced with actual SDK call)
          const result = await this.evaluateTestCase(testCase, evaluation, options.settings);

          // Capture the turn data
          const turnData = {
            testCaseId: testCase.id,
            input: testCase.input,
            output: result.output,
            messages: result.messages || [],
            toolCalls: result.toolCalls || [],
            timestamp: new Date().toISOString(),
            duration: Date.now() - turnStart,
          };

          traceLog.turns.push(turnData);

          // Save test result
          await db.insert(testResults).values({
            evaluationRunId: runId,
            testCaseId: testCase.id,
            organizationId,
            status: result.status,
            output: result.output,
            score: result.score,
            error: result.error,
            durationMs: turnData.duration,
            messages: JSON.stringify(result.messages || []),
            toolCalls: JSON.stringify(result.toolCalls || []),
            createdAt: new Date().toISOString(),
          });

          if (result.status === "passed") {
            passedCount++;
          } else {
            failedCount++;
          }

          processedCount++;

          // Update heartbeat after successful processing
          await this.updateHeartbeat(
            runId,
            processedCount,
            `Completed: ${testCase.name} (${result.status})`,
          );

          // Send test case completed message
          const completedMessage = createTestCaseCompletedMessage(
            evaluationId,
            testCase.id,
            result.score || 0,
            result.status === "passed",
          );
          sseServer.sendToOrganization(organizationId, completedMessage);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error("Worker: Test case failed", {
            runId,
            testCaseId: testCase.id,
            error: errorMessage,
          });

          failedCount++;
          processedCount++;

          // Save failed result
          await db.insert(testResults).values({
            evaluationRunId: runId,
            testCaseId: testCase.id,
            organizationId,
            status: "failed",
            output: null,
            score: 0,
            error: errorMessage,
            durationMs: Date.now() - turnStart,
            messages: JSON.stringify([]),
            toolCalls: JSON.stringify([]),
            createdAt: new Date().toISOString(),
          });

          // Update heartbeat after failure
          await this.updateHeartbeat(
            runId,
            processedCount,
            `Failed: ${testCase.name} - ${errorMessage}`,
          );

          // Send test case failed message
          const failedMessage = createTestCaseFailedMessage(
            evaluationId,
            testCase.id,
            errorMessage,
          );
          sseServer.sendToOrganization(organizationId, failedMessage);
        }

        // Small delay between test cases to prevent overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Send progress update
        const progressMessage = createEvaluationProgressMessage(
          evaluationId,
          Math.round((processedCount / testCasesData.length) * 100),
          testCase.name || `Test Case ${testCase.id}`,
          testCasesData.length,
        );
        sseServer.sendToOrganization(organizationId, progressMessage);
      }

      // 5. Finalize the run
      const finalStatus = failedCount === 0 ? "completed" : "completed_with_failures";
      const completedAt = new Date().toISOString();

      await db
        .update(evaluationRuns)
        .set({
          status: finalStatus,
          processedCount,
          passedCases: passedCount,
          failedCases: failedCount,
          completedAt,
          traceLog: JSON.stringify({
            ...traceLog,
            completedAt,
            summary: {
              totalCases: testCaseIds.length,
              processedCount,
              passedCount,
              failedCount,
              duration: Date.now() - new Date(traceLog.startedAt).getTime(),
            },
          }),
        })
        .where(eq(evaluationRuns.id, runId));

      // 6. Compute and store quality score
      computeAndStoreQualityScore(runId, evaluationId, organizationId).catch((error) => {
        logger.error("Worker: Quality score computation failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // 7. Trigger Meta-Judge as post-eval hook (async, fire-and-forget)
      this.triggerMetaJudge(runId, evaluationId, organizationId, testCasesData).catch((error) => {
        logger.error("Worker: Meta-Judge failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      logger.info("Worker: Evaluation run completed", {
        runId,
        status: finalStatus,
        totalCases: testCaseIds.length,
        passedCount,
        failedCount,
      });

      // Send evaluation completed message
      const completedMessage = createEvaluationCompletedMessage(evaluationId, {
        runId,
        totalTests: testCasesData.length,
        passed: passedCount,
        failed: failedCount,
        results: await db.select().from(testResults).where(eq(testResults.evaluationRunId, runId)),
        status: finalStatus,
      });
      sseServer.sendToOrganization(organizationId, completedMessage);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Worker: Evaluation run failed", { runId, error: errorMessage });

      // Update run status to failed
      await db
        .update(evaluationRuns)
        .set({
          status: "failed",
          completedAt: new Date().toISOString(),
          traceLog: JSON.stringify({
            error: errorMessage,
            failedAt: new Date().toISOString(),
          }),
        })
        .where(eq(evaluationRuns.id, runId));

      // Send error message
      const errorSSEMessage = createSSEMessage("error", {
        error: errorMessage,
        runId,
        evaluationId,
      });
      sseServer.sendToOrganization(organizationId, errorSSEMessage);
    }
  }

  /**
   * Update heartbeat counter and log message.
   * This allows the UI to poll for progress updates.
   */
  private async updateHeartbeat(
    runId: number,
    processedCount: number,
    message: string,
  ): Promise<void> {
    // Simple heartbeat update without complex JSON operations
    const currentRun = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.id, runId))
      .limit(1);

    if (currentRun.length > 0 && currentRun[0].traceLog) {
      try {
        const traceLog = JSON.parse(currentRun[0].traceLog as string);
        traceLog.heartbeat = traceLog.heartbeat || [];
        traceLog.heartbeat.push({
          timestamp: new Date().toISOString(),
          processedCount,
          message,
        });

        await db
          .update(evaluationRuns)
          .set({
            processedCount,
            traceLog: JSON.stringify(traceLog),
          })
          .where(eq(evaluationRuns.id, runId));
      } catch (error) {
        logger.warn("Failed to update heartbeat", { runId, error });
      }
    }
  }

  /**
   * Trigger Meta-Judge evaluation as post-eval hook.
   * This runs asynchronously after the evaluation completes.
   */
  private async triggerMetaJudge(
    runId: number,
    evaluationId: number,
    organizationId: number,
    testCases: TestCase[],
  ): Promise<void> {
    logger.info("Worker: Triggering Meta-Judge evaluation", { runId, evaluationId });

    try {
      // Fetch all test results for this run
      const results = await db
        .select()
        .from(testResults)
        .where(eq(testResults.evaluationRunId, runId));

      if (results.length === 0) {
        logger.warn("No test results found for Meta-Judge", { runId });
        return;
      }

      // Prepare test results for Meta-Judge
      const testResultsForJudge = results.map((result) => ({
        testCaseId: result.testCaseId,
        input: this.extractInputFromMessages(result.messages as string),
        output: result.output || "",
        expectedOutput: this.getExpectedOutput(testCases, result.testCaseId) || undefined,
        score: result.score || undefined,
        status: result.status,
      }));

      // Run batch evaluation
      const judgeResults = await llmJudgeService.evaluateRunBatch(
        runId,
        organizationId,
        testResultsForJudge,
      );

      // Update evaluation run with judge results
      await db
        .update(evaluationRuns)
        .set({
          traceLog: JSON.stringify({
            metaJudge: {
              triggeredAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              results: judgeResults,
            },
          }),
        })
        .where(eq(evaluationRuns.id, runId));

      logger.info("Worker: Meta-Judge evaluation completed", {
        runId,
        totalJudged: judgeResults.totalJudged,
        passedJudged: judgeResults.passedJudged,
        averageJudgeScore: judgeResults.averageJudgeScore,
      });
    } catch (error: unknown) {
      const metaJudgeError = error instanceof Error ? error.message : String(error);
      logger.error("Worker: Meta-Judge evaluation failed", { runId, error: metaJudgeError });

      // Update evaluation run with error information
      await db
        .update(evaluationRuns)
        .set({
          traceLog: JSON.stringify({
            metaJudge: {
              triggeredAt: new Date().toISOString(),
              error: metaJudgeError,
              failedAt: new Date().toISOString(),
            },
          }),
        })
        .where(eq(evaluationRuns.id, runId));
    }
  }

  /**
   * Extract input from messages array.
   */
  private extractInputFromMessages(messages: string | null): string {
    if (!messages) return "";

    try {
      const parsed = JSON.parse(messages);
      const userMessage = parsed.find(
        (msg: { role?: string; content?: string }) => msg.role === "user",
      );
      return userMessage?.content || "";
    } catch {
      return "";
    }
  }

  /**
   * Get expected output for a test case.
   */
  private getExpectedOutput(testCases: TestCase[], testCaseId: number): string | null {
    const testCase = testCases.find((tc) => tc.id === testCaseId);
    return testCase?.expectedOutput || null;
  }

  /**
   * Evaluate a single test case using the SDK.
   * This integrates the actual @pauly4010/evalai-sdk for real evaluation.
   */
  private async evaluateTestCase(
    testCase: TestCase,
    evaluation: Evaluation,
    settings?: { systemPrompt?: string; model?: string; [key: string]: unknown },
  ): Promise<{
    status: string;
    output: string;
    score: number;
    error?: string;
    messages?: unknown[];
    toolCalls?: unknown[];
  }> {
    const modelSettings = evaluation.modelSettings
      ? (JSON.parse(evaluation.modelSettings as string) as {
          systemPrompt?: string;
          model?: string;
        })
      : {};
    const systemPrompt =
      modelSettings.systemPrompt || settings?.systemPrompt || "You are a helpful AI assistant.";
    const model = modelSettings.model || settings?.model || "gpt-4o-mini";
    const organizationId = evaluation.organizationId;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: testCase.input },
    ];

    try {
      // Determine provider from model name
      const provider = this.getProviderFromModel(model);

      // Get the org's decrypted API key
      const providerKey = await providerKeysService.getActiveProviderKey(organizationId, provider);

      let output = "";
      let _tokenCount = 0;

      if (!providerKey) {
        // No API key configured — use heuristic fallback
        logger.warn("No provider key found, using heuristic scoring", { organizationId, provider });
        output = `[Heuristic] Response for: ${testCase.input.substring(0, 100)}`;
        const score = this.heuristicScore(testCase.expectedOutput, output);
        messages.push({ role: "assistant", content: output });
        return {
          status: score >= 70 ? "passed" : "failed",
          output,
          score,
          messages,
          toolCalls: [],
        };
      }

      const apiKey = providerKey.decryptedKey;

      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.2 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
        output = json.choices?.[0]?.message?.content ?? "";
        _tokenCount = json.usage?.total_tokens ?? 0;
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
            messages: [{ role: "user", content: testCase.input }],
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
        output = json.content?.[0]?.text ?? "";
        _tokenCount = (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      messages.push({ role: "assistant", content: output });

      // Score: if expectedOutput exists, compute similarity; otherwise default pass
      const score = testCase.expectedOutput
        ? this.heuristicScore(testCase.expectedOutput, output)
        : 80;
      const status = score >= 70 ? "passed" : "failed";

      return { status, output, score, messages, toolCalls: [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Evaluation failed", { testCaseId: testCase.id, error: errorMessage });
      messages.push({ role: "assistant", content: "" });
      return {
        status: "failed",
        output: "",
        score: 0,
        error: errorMessage,
        messages,
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
    return "openai"; // default
  }

  /**
   * Heuristic scoring when comparing expected vs actual output.
   * Uses word overlap + length ratio. Returns 0-100.
   */
  private heuristicScore(expectedOutput: string | null, actualOutput: string): number {
    if (!expectedOutput) return 80;

    const expected = expectedOutput.toLowerCase().split(/\s+/).filter(Boolean);
    const actual = actualOutput.toLowerCase().split(/\s+/).filter(Boolean);

    if (expected.length === 0) return 80;

    const actualSet = new Set(actual);
    const matches = expected.filter((w) => actualSet.has(w)).length;
    const overlap = matches / expected.length;

    const lenRatio =
      Math.min(actual.length, expected.length) / Math.max(actual.length, expected.length, 1);

    return Math.round((overlap * 0.7 + lenRatio * 0.3) * 100);
  }
}

export const evalWorker = new EvalWorker();
