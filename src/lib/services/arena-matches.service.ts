// src/lib/services/arena-matches.service.ts

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { arenaMatches, llmJudgeConfigs } from "@/db/schema";
import { logger } from "@/lib/logger";
import { llmJudgeService } from "./llm-judge.service";

export const createArenaMatchSchema = z.object({
  prompt: z.string().min(1),
  models: z.array(z.string()).min(2).max(10),
  judgeConfigId: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateArenaMatchInput = z.infer<typeof createArenaMatchSchema>;

export interface ArenaMatchResult {
  id: number;
  prompt: string;
  winnerId: string;
  winnerLabel: string;
  winnerScore: number;
  judgeReasoning: string;
  results: Array<{
    modelId: string;
    modelLabel: string;
    score: number;
    output: string;
    responseTime: number;
    tokenCount: number;
    cost: number;
  }>;
  scores: Record<string, number>;
  metadata: Record<string, unknown>;
  organizationId: number;
  createdBy: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  modelId: string;
  modelLabel: string;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  averageScore: number;
  averageResponseTime: number;
  totalCost: number;
  lastMatchAt: string;
  streak: number;
}

/**
 * Arena Matches Service
 * Manages LLM battle arena matches for competitive evaluation.
 * This is the core of the "LLM Battle Arena" viral feature.
 */
export class ArenaMatchesService {
  /**
   * Create a new arena match between multiple models.
   */
  async createArenaMatch(
    organizationId: number,
    input: CreateArenaMatchInput,
    createdBy: string,
  ): Promise<ArenaMatchResult> {
    logger.info("Creating arena match", {
      organizationId,
      models: input.models.length,
      promptLength: input.prompt.length,
    });

    // Verify organization has access to requested models
    const availableModels = await this.getAvailableModels(organizationId, input.models);
    if (availableModels.length === 0) {
      throw new Error("No available models found for arena match");
    }

    // Get or create default judge config
    let judgeConfigId = input.judgeConfigId;
    if (!judgeConfigId) {
      judgeConfigId = await this.getOrCreateDefaultJudgeConfig(organizationId, createdBy);
    }

    // Run arena match
    const results = await this.runArenaMatch(
      input.prompt,
      availableModels,
      organizationId,
      judgeConfigId,
    );

    // Determine winner
    const winner = this.determineWinner(results);

    // Calculate scores for leaderboard
    const scores = this.calculateScores(results);

    // Save arena match
    const now = new Date();
    const [match] = await db
      .insert(arenaMatches)
      .values({
        organizationId,
        prompt: input.prompt,
        winnerId: winner.modelId,
        winnerLabel: winner.modelLabel,
        judgeReasoning: winner.reasoning,
        results: JSON.stringify(results),
        scores: JSON.stringify(scores),
        createdBy,
        createdAt: now,
      })
      .returning({
        id: arenaMatches.id,
        prompt: arenaMatches.prompt,
        winnerId: arenaMatches.winnerId,
        winnerLabel: arenaMatches.winnerLabel,
        judgeReasoning: arenaMatches.judgeReasoning,
        results: arenaMatches.results,
        scores: arenaMatches.scores,
        organizationId: arenaMatches.organizationId,
        createdBy: arenaMatches.createdBy,
        createdAt: arenaMatches.createdAt,
      });

    logger.info("Arena match completed", {
      matchId: match.id,
      winner: winner.modelLabel,
      totalModels: results.length,
      scores,
    });

    return {
      ...match,
      winnerScore: winner.score,
      judgeReasoning: match.judgeReasoning || "",
      results:
        typeof match.results === "string"
          ? JSON.parse(match.results as string)
          : match.results || [],
      scores:
        typeof match.scores === "string" ? JSON.parse(match.scores as string) : match.scores || {},
      metadata: {},
    } as ArenaMatchResult;
  }

  /**
   * Get arena match by ID.
   */
  async getArenaMatch(organizationId: number, matchId: number): Promise<ArenaMatchResult | null> {
    const [match] = await db
      .select()
      .from(arenaMatches)
      .where(and(eq(arenaMatches.id, matchId), eq(arenaMatches.organizationId, organizationId)))
      .limit(1);

    if (!match) return null;

    return {
      id: match.id,
      prompt: match.prompt,
      winnerId: match.winnerId,
      winnerLabel: match.winnerLabel,
      winnerScore: 0,
      judgeReasoning: match.judgeReasoning || "",
      results: typeof match.results === "string" ? JSON.parse(match.results) : match.results,
      scores: typeof match.scores === "string" ? JSON.parse(match.scores) : match.scores || {},
      metadata: {},
      organizationId: match.organizationId,
      createdBy: match.createdBy,
      createdAt: match.createdAt,
    } as ArenaMatchResult;
  }

  /**
   * Get arena matches for an organization.
   */
  async getArenaMatches(
    organizationId: number,
    options?: {
      limit?: number;
      offset?: number;
      winnerId?: string;
      dateRange?: { start: string; end: string };
    },
  ): Promise<Array<ArenaMatchResult>> {
    // Build where conditions upfront to avoid Drizzle chaining issues
    const conditions = [eq(arenaMatches.organizationId, organizationId)];
    if (options?.winnerId) {
      conditions.push(eq(arenaMatches.winnerId, options.winnerId));
    }
    if (options?.dateRange) {
      conditions.push(gte(arenaMatches.createdAt, options.dateRange.start));
      conditions.push(lte(arenaMatches.createdAt, options.dateRange.end));
    }

    const matches = await db
      .select()
      .from(arenaMatches)
      .where(and(...conditions))
      .orderBy(desc(arenaMatches.createdAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    return matches.map(
      (match) =>
        ({
          id: match.id,
          prompt: match.prompt,
          winnerId: match.winnerId,
          winnerLabel: match.winnerLabel,
          winnerScore: 0,
          judgeReasoning: match.judgeReasoning || "",
          results:
            typeof match.results === "string"
              ? JSON.parse(match.results as string)
              : match.results || [],
          scores:
            typeof match.scores === "string"
              ? JSON.parse(match.scores as string)
              : match.scores || {},
          metadata: {},
          organizationId: match.organizationId,
          createdBy: match.createdBy,
          createdAt: match.createdAt,
        }) as ArenaMatchResult,
    );
  }

  /**
   * Get leaderboard for arena matches.
   */
  async getLeaderboard(
    organizationId: number,
    options?: {
      limit?: number;
      timeRange?: { days: number };
    },
  ): Promise<LeaderboardEntry[]> {
    // Get all arena matches for the organization
    const matches = await this.getArenaMatches(organizationId, {
      dateRange: options?.timeRange
        ? {
            start: new Date(
              Date.now() - options.timeRange.days * 24 * 60 * 60 * 1000,
            ).toISOString(),
            end: new Date().toISOString(),
          }
        : undefined,
    });

    // Calculate leaderboard entries
    const modelStats = new Map<string, LeaderboardEntry>();

    for (const match of matches) {
      const results = match.results;

      for (const result of results) {
        const existing = modelStats.get(result.modelId);

        if (!existing) {
          modelStats.set(result.modelId, {
            modelId: result.modelId,
            modelLabel: result.modelLabel,
            totalMatches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            averageScore: 0,
            averageResponseTime: 0,
            totalCost: 0,
            lastMatchAt: match.createdAt,
            streak: 0,
          });
        }

        const entry = modelStats.get(result.modelId)!;

        entry.totalMatches++;
        entry.lastMatchAt = match.createdAt;

        // Update win/loss/draw counts
        if (result.modelId === match.winnerId) {
          entry.wins++;
        } else {
          entry.losses++;
        }

        // Update scores
        entry.averageScore =
          (entry.averageScore * (entry.totalMatches - 1) + result.score) / entry.totalMatches;
        entry.averageResponseTime =
          (entry.averageResponseTime * (entry.totalMatches - 1) + result.responseTime) /
          entry.totalMatches;
        entry.totalCost += result.cost;
      }
    }

    // Calculate win rates and streaks
    for (const entry of Array.from(modelStats.values())) {
      entry.winRate = entry.totalMatches > 0 ? (entry.wins / entry.totalMatches) * 100 : 0;
      entry.streak = this.calculateStreak(entry);
    }

    // Sort by win rate, then by total matches
    const leaderboard = Array.from(modelStats.values()).sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
      return b.averageScore - a.averageScore;
    });

    return options?.limit ? leaderboard.slice(0, options.limit) : leaderboard;
  }

  /**
   * Run an arena match between multiple models.
   */
  private async runArenaMatch(
    prompt: string,
    models: Array<{ id: string; label: string; config: unknown }>,
    organizationId: number,
    judgeConfigId: number,
  ): Promise<
    Array<{
      modelId: string;
      modelLabel: string;
      score: number;
      output: string;
      responseTime: number;
      tokenCount: number;
      cost: number;
    }>
  > {
    const results = [];

    for (const model of models) {
      try {
        const startTime = Date.now();

        // Call the model (this would integrate with actual LLM providers)
        const output = await this.callModel(model, prompt);
        const endTime = Date.now();

        // Get judge score
        const judgeResult = await llmJudgeService.evaluate(organizationId, {
          configId: judgeConfigId,
          input: prompt,
          output,
          context: `Arena match - Model: ${model.label}`,
        });

        const responseTime = endTime - startTime;
        const tokenCount = this.estimateTokenCount(prompt, output);
        const cost = this.calculateCost(model.config, tokenCount);

        results.push({
          modelId: model.id,
          modelLabel: model.label,
          score: judgeResult.score,
          output,
          responseTime,
          tokenCount,
          cost,
        });
      } catch (error: unknown) {
        logger.error(`Arena match failed for model ${model.label}`, error);

        results.push({
          modelId: model.id,
          modelLabel: model.label,
          score: 0,
          output: `Error: ${(error as any).message}`,
          responseTime: 0,
          tokenCount: 0,
          cost: 0,
        });
      }
    }

    return results;
  }

  /**
   * Determine the winner of an arena match.
   */
  private determineWinner(
    results: Array<{
      modelId: string;
      modelLabel: string;
      score: number;
      output: string;
    }>,
  ): { modelId: string; modelLabel: string; score: number; reasoning: string } {
    const winner = results.reduce((prev, current) => (current.score > prev.score ? current : prev));

    return {
      modelId: winner.modelId,
      modelLabel: winner.modelLabel,
      score: winner.score,
      reasoning: `Highest score: ${winner.score}/100 with output: "${winner.output.substring(0, 100)}..."`,
    };
  }

  /**
   * Calculate scores for all models.
   */
  private calculateScores(
    results: Array<{
      modelId: string;
      score: number;
    }>,
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const result of results) {
      scores[result.modelId] = result.score;
    }

    return scores;
  }

  /**
   * Get available models for the organization.
   */
  private async getAvailableModels(
    _organizationId: number,
    requestedModels: string[],
  ): Promise<Array<{ id: string; label: string; config: unknown }>> {
    // This would integrate with your model management system
    // For now, return mock data
    const allModels = [
      { id: "gpt-4", label: "GPT-4", config: { provider: "openai", model: "gpt-4" } },
      {
        id: "gpt-4-turbo",
        label: "GPT-4 Turbo",
        config: { provider: "openai", model: "gpt-4-turbo" },
      },
      {
        id: "claude-3.5-sonnet",
        label: "Claude 3.5 Sonnet",
        config: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
      },
      {
        id: "gemini-pro",
        label: "Gemini Pro",
        config: { provider: "google", model: "gemini-pro" },
      },
    ];

    // Filter by requested models
    return allModels.filter(
      (model) => requestedModels.length === 0 || requestedModels.includes(model.id),
    );
  }

  /**
   * Get or create default judge config for arena matches.
   */
  private async getOrCreateDefaultJudgeConfig(
    organizationId: number,
    createdBy: string,
  ): Promise<number> {
    // Check if default config exists
    const [existing] = await db
      .select()
      .from(llmJudgeConfigs)
      .where(
        and(
          eq(llmJudgeConfigs.organizationId, organizationId),
          eq(llmJudgeConfigs.name, "Arena Judge Config"),
        ),
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }

    // Create default judge config
    const [config] = await db
      .insert(llmJudgeConfigs)
      .values({
        organizationId,
        name: "Arena Judge Config",
        model: "gpt-4o-mini",
        promptTemplate: `You are an expert AI evaluator. Compare the following responses and determine which one is better.

Respond ONLY with valid JSON in this exact format:
{"score": <0-100>, "reasoning": "<detailed explanation>", "passed": <true/false>}

Consider:
- Relevance and accuracy
- Clarity and coherence
- Completeness
- Helpfulness
- Safety and ethics

Provide a clear explanation for your choice.`,
        criteria: {
          relevance: 0.3,
          clarity: 0.2,
          completeness: 0.2,
          helpfulness: 0.2,
          safety: 0.1,
        },
        settings: {
          temperature: 0.1,
          maxTokens: 500,
        },
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: llmJudgeConfigs.id,
      });

    return config.id;
  }

  /**
   * Call a model (placeholder for actual LLM integration).
   */
  private async callModel(
    model: { id: string; label: string; config: unknown },
    _prompt: string,
  ): Promise<string> {
    // This would integrate with your actual LLM providers
    // For now, return mock responses

    const mockResponses: Record<string, string> = {
      "gpt-4":
        "I understand your request completely and will provide a comprehensive response that addresses all aspects of your query.",
      "gpt-4-turbo": "Quick response: I can help with that! Here's what you need to know...",
      "claude-3.5-sonnet":
        "I'll provide a thoughtful analysis of your request with detailed insights.",
      "gemini-pro": "I'll analyze your request thoroughly and provide a comprehensive response.",
    };

    return mockResponses[model.id] || "Model response not available";
  }

  /**
   * Estimate token count for a prompt/response pair.
   */
  private estimateTokenCount(prompt: string, response: string): number {
    // Simple token estimation (rough approximation)
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil(response.length / 4);
    return promptTokens + responseTokens;
  }

  /**
   * Calculate cost for a model call.
   */
  private calculateCost(config: unknown, tokenCount: number): number {
    // This would integrate with your pricing system
    const pricing: Record<string, number> = {
      "gpt-4": 0.03, // $0.03 per 1K tokens
      "gpt-4-turbo": 0.01,
      "claude-3.5-sonnet-20241022": 0.015,
      "gemini-pro": 0.025,
    };

    const modelKey = (config as any).model || "gpt-4";
    const pricePerToken = pricing[modelKey] || 0.03;

    return (tokenCount / 1000) * pricePerToken;
  }

  /**
   * Calculate win/loss streak for a model.
   */
  private calculateStreak(entry: LeaderboardEntry): number {
    // This would require analyzing match history
    // For now, return a simple calculation based on win rate
    if (entry.winRate >= 80) return Math.min(5, Math.floor(entry.winRate / 20));
    if (entry.winRate <= 20) return -Math.min(5, Math.floor((20 - entry.winRate) / 20));
    return 0;
  }

  /**
   * Get arena match statistics.
   */
  async getArenaStats(organizationId: number): Promise<{
    totalMatches: number;
    averageScore: number;
    mostActiveModel: string;
    topPerformer: string;
    recentActivity: number;
  }> {
    const matches = await this.getArenaMatches(organizationId, {
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    });

    const totalMatches = matches.length;
    const averageScore =
      matches.length > 0
        ? matches.reduce((sum, match) => {
            const scores =
              typeof match.scores === "string" ? JSON.parse(match.scores) : match.scores;
            const scoreValues = Object.values(scores) as number[];
            return (
              sum +
              (scoreValues.length > 0
                ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
                : 0)
            );
          }, 0) / matches.length
        : 0;

    // Find most active model
    const modelCounts = new Map<string, number>();
    for (const match of matches) {
      const results = typeof match.results === "string" ? JSON.parse(match.results) : match.results;
      for (const result of results) {
        modelCounts.set(result.modelId, (modelCounts.get(result.modelId) || 0) + 1);
      }
    }
    const mostActiveModel =
      Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    // Find top performer
    const leaderboard = await this.getLeaderboard(organizationId, { limit: 1 });
    const topPerformer = leaderboard[0]?.modelLabel || "";

    const recentActivity = matches.filter((match) => {
      const matchDate = new Date(match.createdAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return matchDate > weekAgo;
    }).length;

    return {
      totalMatches,
      averageScore: Math.round(averageScore),
      mostActiveModel,
      topPerformer,
      recentActivity,
    };
  }
}

// Export singleton instance
export const arenaMatchesService = new ArenaMatchesService();
