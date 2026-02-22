/**
 * LLM Judge Service Layer
 * Handles business logic for LLM judge operations
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { llmJudgeConfigs, llmJudgeResults } from "@/db/schema";
import { logger } from "@/lib/logger";
import { providerKeysService } from "./provider-keys.service";

export const createLLMJudgeConfigSchema = z.object({
  name: z.string().min(1).max(255),
  model: z.string().min(1),
  promptTemplate: z.string().min(1),
  criteria: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const evaluateRequestSchema = z.object({
  configId: z.number().int().positive(),
  input: z.string().min(1),
  output: z.string().min(1),
  context: z.string().optional(),
  expectedOutput: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateLLMJudgeConfigInput = z.infer<typeof createLLMJudgeConfigSchema>;
export type EvaluateRequestInput = z.infer<typeof evaluateRequestSchema>;

export interface JudgementResult {
  score: number;
  reasoning: string;
  passed: boolean;
  details?: Record<string, unknown>;
}

interface JudgeConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export class LLMJudgeService {
  /**
   * List LLM judge configurations for an organization
   */
  async listConfigs(
    organizationId: number,
    options?: {
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    logger.info("Listing LLM judge configs", { organizationId, limit, offset });

    const configs = await db
      .select()
      .from(llmJudgeConfigs)
      .where(eq(llmJudgeConfigs.organizationId, organizationId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(llmJudgeConfigs.createdAt));

    logger.info("LLM judge configs listed", { count: configs.length, organizationId });

    return configs;
  }

  /**
   * Get LLM judge config by ID
   */
  async getConfigById(id: number, organizationId: number) {
    logger.info("Getting LLM judge config by ID", { id, organizationId });

    const [config] = await db
      .select()
      .from(llmJudgeConfigs)
      .where(and(eq(llmJudgeConfigs.id, id), eq(llmJudgeConfigs.organizationId, organizationId)))
      .limit(1);

    if (!config) {
      logger.warn("LLM judge config not found", { id, organizationId });
      return null;
    }

    logger.info("LLM judge config retrieved", { id, organizationId });
    return config;
  }

  /**
   * Create a new LLM judge configuration
   */
  async createConfig(organizationId: number, createdBy: string, data: CreateLLMJudgeConfigInput) {
    logger.info("Creating LLM judge config", { organizationId, name: data.name });

    const [config] = await db
      .insert(llmJudgeConfigs)
      .values({
        organizationId,
        createdBy,
        name: data.name,
        model: data.model,
        promptTemplate: data.promptTemplate,
        criteria: data.criteria ? JSON.stringify(data.criteria) : null,
        settings: data.settings ? JSON.stringify(data.settings) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    logger.info("LLM judge config created", { id: config.id, organizationId });

    return config;
  }

  /**
   * Update an LLM judge configuration
   */
  async updateConfig(id: number, organizationId: number, data: Partial<CreateLLMJudgeConfigInput>) {
    logger.info("Updating LLM judge config", { id, organizationId });

    // Verify ownership
    const existing = await this.getConfigById(id, organizationId);
    if (!existing) {
      logger.warn("LLM judge config not found for update", { id, organizationId });
      return null;
    }

    const [updated] = await db
      .update(llmJudgeConfigs)
      .set({
        ...data,
        criteria: data.criteria ? JSON.stringify(data.criteria) : undefined,
        settings: data.settings ? JSON.stringify(data.settings) : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(llmJudgeConfigs.id, id), eq(llmJudgeConfigs.organizationId, organizationId)))
      .returning();

    logger.info("LLM judge config updated", { id, organizationId });

    return updated;
  }

  /**
   * Delete an LLM judge configuration
   */
  async deleteConfig(id: number, organizationId: number) {
    logger.info("Deleting LLM judge config", { id, organizationId });

    // Verify ownership
    const existing = await this.getConfigById(id, organizationId);
    if (!existing) {
      logger.warn("LLM judge config not found for deletion", { id, organizationId });
      return false;
    }

    await db
      .delete(llmJudgeConfigs)
      .where(and(eq(llmJudgeConfigs.id, id), eq(llmJudgeConfigs.organizationId, organizationId)));

    logger.info("LLM judge config deleted", { id, organizationId });

    return true;
  }

  /**
   * Evaluate using LLM judge
   */
  async evaluate(organizationId: number, data: EvaluateRequestInput): Promise<JudgementResult> {
    logger.info("Evaluating with LLM judge", {
      organizationId,
      configId: data.configId,
    });

    // Get config
    const config = await this.getConfigById(data.configId, organizationId);
    if (!config) {
      throw new Error("LLM judge config not found");
    }

    // Build prompt
    const prompt = this.buildEvaluationPrompt(config, data);

    // Call LLM API (placeholder - integrate with actual LLM providers)
    const judgement = await this.callLLMProvider(config, prompt, organizationId);

    // Store result
    const [result] = await db
      .insert(llmJudgeResults)
      .values({
        configId: data.configId,
        input: data.input,
        output: data.output,
        score: judgement.score,
        reasoning: judgement.reasoning,
        metadata: JSON.stringify({
          ...data.metadata,
          organizationId,
          expectedOutput: data.expectedOutput,
          passed: judgement.passed,
          context: data.context,
          details: judgement.details,
        }),
        createdAt: new Date().toISOString(),
      })
      .returning();

    logger.info("LLM judge evaluation completed", {
      resultId: result.id,
      score: judgement.score,
      passed: judgement.passed,
    });

    return judgement;
  }

  /**
   * Get evaluation results for a config
   */
  async getResults(
    configId: number,
    organizationId: number,
    options?: {
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    logger.info("Getting LLM judge results", { configId, organizationId, limit, offset });

    // Verify config ownership
    const config = await this.getConfigById(configId, organizationId);
    if (!config) {
      return null;
    }

    const results = await db
      .select()
      .from(llmJudgeResults)
      .where(eq(llmJudgeResults.configId, configId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(llmJudgeResults.createdAt));

    logger.info("LLM judge results retrieved", { count: results.length });

    return results;
  }

  /**
   * Build evaluation prompt from config and data
   * @private
   */
  private buildEvaluationPrompt(config: unknown, data: EvaluateRequestInput): string {
    const parts = [
      "You are an expert evaluator.",
      "\n\n# Evaluation Template\n",
      (config as any).promptTemplate,
      "\n\n# Input\n",
      data.input,
      "\n\n# Output to Evaluate\n",
      data.output,
    ];

    if (data.context) {
      parts.push("\n\n# Context\n", data.context);
    }

    if (data.expectedOutput) {
      parts.push("\n\n# Expected Output\n", data.expectedOutput);
    }

    parts.push("\n\n# Instructions\n");
    parts.push(
      "Evaluate the output according to the template. Provide a score (0-100), reasoning, and whether it passed.",
    );

    return parts.join("");
  }

  /**
   * Determine the provider from a model name string
   * @private
   */
  private getProviderFromModel(model: string): "openai" | "anthropic" | "google" {
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
    if (m.includes("gemini") || m.includes("palm") || m.includes("bard")) return "google";
    // Default to OpenAI
    return "openai";
  }

  /**
   * Call LLM provider API to evaluate
   * @private
   */
  private async callLLMProvider(
    config: JudgeConfig,
    prompt: string,
    organizationId: number,
  ): Promise<JudgementResult> {
    const provider = this.getProviderFromModel(config.model || "gpt-4o-mini");
    logger.info("Calling LLM provider", {
      provider,
      model: config.model || "gpt-4o-mini",
      organizationId,
    });

    const systemPrompt =
      'You are an expert AI evaluator. Respond ONLY with valid JSON in this exact format: {"score": <0-100>, "reasoning": "<explanation>", "passed": <true/false>}. Do not include unknown other text.';

    try {
      if (provider === "openai") {
        // Get per-org encrypted OpenAI key
        const providerKey = await providerKeysService.getActiveProviderKey(
          organizationId,
          "openai",
        );
        if (!providerKey) {
          logger.warn("No OpenAI key found for organization, falling back to simple scoring", {
            organizationId,
          });
          return this.fallbackScoring(prompt);
        }

        const apiKey = providerKey.decryptedKey;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: config.model || "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          logger.error({ status: response.status, body: errorBody }, "OpenAI API error");
          return this.fallbackScoring(prompt);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return this.parseJudgementResponse(content, provider, config.model || "gpt-4o-mini");
      } else if (provider === "anthropic") {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          logger.warn("ANTHROPIC_API_KEY not set, falling back to simple scoring");
          return this.fallbackScoring(prompt);
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model || "claude-3-5-haiku-latest",
            max_tokens: 500,
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          logger.error({ status: response.status, body: errorBody }, "Anthropic API error");
          return this.fallbackScoring(prompt);
        }

        const data = await response.json();
        const content = data.content?.[0]?.text || "";
        return this.parseJudgementResponse(content, provider, config.model || "gpt-4o-mini");
      } else {
        // Google or unsupported — fallback
        logger.warn("Unsupported provider, falling back to simple scoring", { provider });
        return this.fallbackScoring(prompt);
      }
    } catch (error) {
      logger.error(
        { error, provider, model: config.model || "gpt-4o-mini" },
        "LLM provider call failed",
      );
      return this.fallbackScoring(prompt);
    }
  }

  /**
   * Parse a JSON judgement response from LLM
   * @private
   */
  private parseJudgementResponse(
    content: string,
    provider: string,
    model: string,
  ): JudgementResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
          reasoning: String(parsed.reasoning || "No reasoning provided"),
          passed: Boolean(parsed.passed),
          details: { provider, model, timestamp: new Date().toISOString() },
        };
      }
    } catch (parseError) {
      logger.warn("Failed to parse LLM judge response as JSON", { parseError, content });
    }

    // Fallback: try to extract a score from the text
    const scoreMatch = content.match(/(\d{1,3})\s*(?:\/\s*100|%|out of 100)/i);
    const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : 50;

    return {
      score,
      reasoning: content.slice(0, 500),
      passed: score >= 70,
      details: { provider, model, timestamp: new Date().toISOString(), rawResponse: true },
    };
  }

  /**
   * Fallback scoring when no LLM API key is available — uses simple heuristics
   * @private
   */
  private fallbackScoring(prompt: string): JudgementResult {
    // Basic heuristic: check if output section is non-empty and reasonably long
    const outputMatch = prompt.match(/# Output to Evaluate\n([\s\S]*?)(?:\n# |$)/);
    const output = outputMatch?.[1]?.trim() || "";
    const expectedMatch = prompt.match(/# Expected Output\n([\s\S]*?)(?:\n# |$)/);
    const expected = expectedMatch?.[1]?.trim() || "";

    let score = 50; // Base score
    if (output.length > 0) score += 20;
    if (output.length > 50) score += 10;
    if (expected && output.toLowerCase().includes(expected.toLowerCase().slice(0, 20))) score += 20;

    return {
      score: Math.min(100, score),
      reasoning:
        "Scored using heuristic fallback (no LLM API key configured). Set OPENAI_API_KEY or ANTHROPIC_API_KEY for real evaluation.",
      passed: score >= 70,
      details: { provider: "fallback", model: "heuristic", timestamp: new Date().toISOString() },
    };
  }

  /**
   * Get statistics for a config
   */
  async getConfigStats(configId: number, organizationId: number) {
    logger.info("Getting LLM judge config stats", { configId, organizationId });

    const config = await this.getConfigById(configId, organizationId);
    if (!config) {
      return null;
    }

    const results = await db
      .select()
      .from(llmJudgeResults)
      .where(eq(llmJudgeResults.configId, configId));

    const totalEvaluations = results.length;
    const passedEvaluations = results.filter((r) => {
      try {
        const metadata = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
        return metadata?.passed === true;
      } catch {
        return false;
      }
    }).length;
    const averageScore =
      totalEvaluations > 0
        ? results.reduce((sum, r) => sum + (r.score || 0), 0) / totalEvaluations
        : 0;

    return {
      totalEvaluations,
      passedEvaluations,
      failedEvaluations: totalEvaluations - passedEvaluations,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: totalEvaluations > 0 ? Math.round((passedEvaluations / totalEvaluations) * 100) : 0,
    };
  }

  /**
   * Evaluate a batch of test results using LLM judge (post-eval hook).
   * This is called automatically after an evaluation run completes.
   */
  async evaluateRunBatch(
    evaluationRunId: number,
    organizationId: number,
    testResults: Array<{
      testCaseId: number;
      input: string;
      output: string;
      expectedOutput?: string;
      score?: number;
      status: string;
    }>,
  ): Promise<{
    totalJudged: number;
    passedJudged: number;
    failedJudged: number;
    averageJudgeScore: number;
    judgeResults: Array<{
      testCaseId: number;
      judgeScore: number;
      judgeReasoning: string;
      passed: boolean;
    }>;
  }> {
    logger.info("Starting batch LLM judge evaluation", {
      evaluationRunId,
      testResultsCount: testResults.length,
    });

    // Get default judge config for the organization
    const [defaultConfig] = await db
      .select()
      .from(llmJudgeConfigs)
      .where(
        and(
          eq(llmJudgeConfigs.organizationId, organizationId),
          eq(llmJudgeConfigs.name, "Default Judge Config"),
        ),
      )
      .limit(1);

    if (!defaultConfig) {
      logger.warn("No default judge config found, skipping batch evaluation", { organizationId });
      return {
        totalJudged: 0,
        passedJudged: 0,
        failedJudged: 0,
        averageJudgeScore: 0,
        judgeResults: [],
      };
    }

    const judgeResults: Array<{
      testCaseId: number;
      judgeScore: number;
      judgeReasoning: string;
      passed: boolean;
    }> = [];

    // Evaluate each test result
    for (const testResult of testResults) {
      try {
        const evaluation = await this.evaluate(organizationId, {
          configId: defaultConfig.id,
          input: testResult.input,
          output: testResult.output,
          expectedOutput: testResult.expectedOutput,
          context: `Evaluation Run ID: ${evaluationRunId}, Test Case ID: ${testResult.testCaseId}`,
          metadata: {
            originalScore: testResult.score,
            originalStatus: testResult.status,
            testCaseId: testResult.testCaseId,
            evaluationRunId,
          },
        });

        // Save judge result
        await db.insert(llmJudgeResults).values({
          configId: defaultConfig.id,
          evaluationRunId,
          testCaseId: testResult.testCaseId,
          input: testResult.input,
          output: testResult.output,
          score: evaluation.score,
          reasoning: evaluation.reasoning,
          metadata: JSON.stringify({
            originalScore: testResult.score,
            originalStatus: testResult.status,
            passed: evaluation.passed,
            evaluationRunId,
          }),
          createdAt: new Date().toISOString(),
        });

        judgeResults.push({
          testCaseId: testResult.testCaseId,
          judgeScore: evaluation.score,
          judgeReasoning: evaluation.reasoning,
          passed: evaluation.passed,
        });
      } catch (error: unknown) {
        logger.error("Failed to judge test case", {
          testCaseId: testResult.testCaseId,
          error: (error as any).message,
        });

        // Save failed judge result
        await db.insert(llmJudgeResults).values({
          configId: defaultConfig.id,
          evaluationRunId,
          testCaseId: testResult.testCaseId,
          input: testResult.input,
          output: testResult.output,
          score: 0,
          reasoning: `Judge evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
          metadata: JSON.stringify({
            originalScore: testResult.score,
            originalStatus: testResult.status,
            passed: false,
            evaluationRunId,
            error: (error as any).message,
          }),
          createdAt: new Date().toISOString(),
        });

        judgeResults.push({
          testCaseId: testResult.testCaseId,
          judgeScore: 0,
          judgeReasoning: `Judge evaluation failed: ${(error as any).message}`,
          passed: false,
        });
      }
    }

    // Calculate summary statistics
    const totalJudged = judgeResults.length;
    const passedJudged = judgeResults.filter((r) => r.passed).length;
    const failedJudged = totalJudged - passedJudged;
    const averageJudgeScore =
      totalJudged > 0 ? judgeResults.reduce((sum, r) => sum + r.judgeScore, 0) / totalJudged : 0;

    logger.info("Batch LLM judge evaluation completed", {
      evaluationRunId,
      totalJudged,
      passedJudged,
      failedJudged,
      averageJudgeScore,
    });

    return {
      totalJudged,
      passedJudged,
      failedJudged,
      averageJudgeScore: Math.round(averageJudgeScore * 100) / 100,
      judgeResults,
    };
  }
}

// Export singleton instance
export const llmJudgeService = new LLMJudgeService();
