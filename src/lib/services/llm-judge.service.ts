/**
 * LLM Judge Service Layer
 * Handles business logic for LLM judge operations
 */

import { db } from '@/db';
import { llmJudgeConfigs, llmJudgeResults } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const createLLMJudgeConfigSchema = z.object({
  name: z.string().min(1).max(255),
  model: z.string().min(1),
  promptTemplate: z.string().min(1),
  criteria: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
});

export const evaluateRequestSchema = z.object({
  configId: z.number().int().positive(),
  input: z.string().min(1),
  output: z.string().min(1),
  context: z.string().optional(),
  expectedOutput: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateLLMJudgeConfigInput = z.infer<typeof createLLMJudgeConfigSchema>;
export type EvaluateRequestInput = z.infer<typeof evaluateRequestSchema>;

export interface JudgementResult {
  score: number;
  reasoning: string;
  passed: boolean;
  details?: Record<string, any>;
}

export class LLMJudgeService {
  /**
   * List LLM judge configurations for an organization
   */
  async listConfigs(organizationId: number, options?: {
    limit?: number;
    offset?: number;
  }) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    logger.info('Listing LLM judge configs', { organizationId, limit, offset });

    const configs = await db
      .select()
      .from(llmJudgeConfigs)
      .where(eq(llmJudgeConfigs.organizationId, organizationId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(llmJudgeConfigs.createdAt));

    logger.info('LLM judge configs listed', { count: configs.length, organizationId });

    return configs;
  }

  /**
   * Get LLM judge config by ID
   */
  async getConfigById(id: number, organizationId: number) {
    logger.info('Getting LLM judge config by ID', { id, organizationId });

    const config = await db.query.llmJudgeConfigs.findFirst({
      where: and(
        eq(llmJudgeConfigs.id, id),
        eq(llmJudgeConfigs.organizationId, organizationId)
      ),
    });

    if (!config) {
      logger.warn('LLM judge config not found', { id, organizationId });
      return null;
    }

    logger.info('LLM judge config retrieved', { id, organizationId });
    return config;
  }

  /**
   * Create a new LLM judge configuration
   */
  async createConfig(organizationId: number, createdBy: string, data: CreateLLMJudgeConfigInput) {
    logger.info('Creating LLM judge config', { organizationId, name: data.name });

    const [config] = await db.insert(llmJudgeConfigs).values({
      organizationId,
      createdBy,
      name: data.name,
      model: data.model,
      promptTemplate: data.promptTemplate,
      criteria: data.criteria ? JSON.stringify(data.criteria) : null,
      settings: data.settings ? JSON.stringify(data.settings) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    logger.info('LLM judge config created', { id: config.id, organizationId });

    return config;
  }

  /**
   * Update an LLM judge configuration
   */
  async updateConfig(id: number, organizationId: number, data: Partial<CreateLLMJudgeConfigInput>) {
    logger.info('Updating LLM judge config', { id, organizationId });

    // Verify ownership
    const existing = await this.getConfigById(id, organizationId);
    if (!existing) {
      logger.warn('LLM judge config not found for update', { id, organizationId });
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
      .where(and(
        eq(llmJudgeConfigs.id, id),
        eq(llmJudgeConfigs.organizationId, organizationId)
      ))
      .returning();

    logger.info('LLM judge config updated', { id, organizationId });

    return updated;
  }

  /**
   * Delete an LLM judge configuration
   */
  async deleteConfig(id: number, organizationId: number) {
    logger.info('Deleting LLM judge config', { id, organizationId });

    // Verify ownership
    const existing = await this.getConfigById(id, organizationId);
    if (!existing) {
      logger.warn('LLM judge config not found for deletion', { id, organizationId });
      return false;
    }

    await db
      .delete(llmJudgeConfigs)
      .where(and(
        eq(llmJudgeConfigs.id, id),
        eq(llmJudgeConfigs.organizationId, organizationId)
      ));

    logger.info('LLM judge config deleted', { id, organizationId });

    return true;
  }

  /**
   * Evaluate using LLM judge
   */
  async evaluate(organizationId: number, data: EvaluateRequestInput): Promise<JudgementResult> {
    logger.info('Evaluating with LLM judge', { 
      organizationId, 
      configId: data.configId 
    });

    // Get config
    const config = await this.getConfigById(data.configId, organizationId);
    if (!config) {
      throw new Error('LLM judge config not found');
    }

    // Build prompt
    const prompt = this.buildEvaluationPrompt(config, data);

    // Call LLM API (placeholder - integrate with actual LLM providers)
    const judgement = await this.callLLMProvider(config, prompt);

    // Store result
    const [result] = await db.insert(llmJudgeResults).values({
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
    }).returning();

    logger.info('LLM judge evaluation completed', { 
      resultId: result.id,
      score: judgement.score,
      passed: judgement.passed 
    });

    return judgement;
  }

  /**
   * Get evaluation results for a config
   */
  async getResults(configId: number, organizationId: number, options?: {
    limit?: number;
    offset?: number;
  }) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    logger.info('Getting LLM judge results', { configId, organizationId, limit, offset });

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

    logger.info('LLM judge results retrieved', { count: results.length });

    return results;
  }

  /**
   * Build evaluation prompt from config and data
   * @private
   */
  private buildEvaluationPrompt(
    config: any,
    data: EvaluateRequestInput
  ): string {
    const parts = [
      'You are an expert evaluator.',
      '\n\n# Evaluation Template\n',
      config.promptTemplate,
      '\n\n# Input\n',
      data.input,
      '\n\n# Output to Evaluate\n',
      data.output,
    ];

    if (data.context) {
      parts.push('\n\n# Context\n', data.context);
    }

    if (data.expectedOutput) {
      parts.push('\n\n# Expected Output\n', data.expectedOutput);
    }

    parts.push('\n\n# Instructions\n');
    parts.push('Evaluate the output according to the template. Provide a score (0-100), reasoning, and whether it passed.');

    return parts.join('');
  }

  /**
   * Call LLM provider API
   * @private
   */
  private async callLLMProvider(
    config: any,
    prompt: string
  ): Promise<JudgementResult> {
    logger.info('Calling LLM provider', { provider: config.provider, model: config.model });

    // TODO: Implement actual LLM provider integration
    // For now, return mock result
    const mockScore = Math.floor(Math.random() * 40) + 60; // 60-100
    
    return {
      score: mockScore,
      reasoning: 'Mock evaluation reasoning. TODO: Implement actual LLM provider integration.',
      passed: mockScore >= 70,
      details: {
        provider: config.provider,
        model: config.model,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get statistics for a config
   */
  async getConfigStats(configId: number, organizationId: number) {
    logger.info('Getting LLM judge config stats', { configId, organizationId });

    const config = await this.getConfigById(configId, organizationId);
    if (!config) {
      return null;
    }

    const results = await db
      .select()
      .from(llmJudgeResults)
      .where(eq(llmJudgeResults.configId, configId));

    const totalEvaluations = results.length;
    const passedEvaluations = results.filter(r => {
      try {
        const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
        return metadata?.passed === true;
      } catch {
        return false;
      }
    }).length;
    const averageScore = totalEvaluations > 0
      ? results.reduce((sum, r) => sum + (r.score || 0), 0) / totalEvaluations
      : 0;

    return {
      totalEvaluations,
      passedEvaluations,
      failedEvaluations: totalEvaluations - passedEvaluations,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: totalEvaluations > 0
        ? Math.round((passedEvaluations / totalEvaluations) * 100)
        : 0,
    };
  }
}

// Export singleton instance
export const llmJudgeService = new LLMJudgeService();

