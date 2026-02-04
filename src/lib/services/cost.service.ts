/**
 * Cost Service
 * Business logic for LLM cost tracking and calculation
 */

import { db } from '@/db';
import { costRecords, providerPricing, workflowRuns, spans } from '@/db/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateCostRecordParams {
  spanId: number;
  workflowRunId?: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  category?: 'llm' | 'tool' | 'embedding' | 'other';
  isRetry?: boolean;
  retryNumber?: number;
}

export interface CostBreakdown {
  totalCost: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byCategory: Record<string, number>;
  retryCount: number;
  retryCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostTrend {
  date: string;
  totalCost: number;
  tokenCount: number;
  requestCount: number;
}

// ============================================================================
// COST SERVICE
// ============================================================================

class CostService {
  // Cache for pricing to avoid repeated DB lookups
  private pricingCache: Map<string, { inputPrice: number; outputPrice: number }> = new Map();
  private pricingCacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get pricing for a model from database or cache
   */
  async getPricing(provider: string, model: string): Promise<{ inputPrice: number; outputPrice: number }> {
    const now = Date.now();
    const cacheKey = `${provider}/${model}`;

    // Check cache
    if (this.pricingCacheExpiry > now && this.pricingCache.has(cacheKey)) {
      return this.pricingCache.get(cacheKey)!;
    }

    // Refresh cache if expired
    if (this.pricingCacheExpiry <= now) {
      await this.refreshPricingCache();
    }

    // Return from cache or default
    if (this.pricingCache.has(cacheKey)) {
      return this.pricingCache.get(cacheKey)!;
    }

    // Default pricing if not found
    return { inputPrice: 1.00, outputPrice: 3.00 };
  }

  /**
   * Refresh the pricing cache from database
   */
  private async refreshPricingCache(): Promise<void> {
    const pricing = await db
      .select()
      .from(providerPricing)
      .where(eq(providerPricing.isActive, true));

    this.pricingCache.clear();
    
    for (const p of pricing) {
      const key = `${p.provider}/${p.model}`;
      this.pricingCache.set(key, {
        inputPrice: parseFloat(p.inputPricePerMillion),
        outputPrice: parseFloat(p.outputPricePerMillion),
      });
    }

    this.pricingCacheExpiry = Date.now() + this.CACHE_TTL;
  }

  /**
   * Calculate cost for a given number of tokens
   */
  async calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<{ inputCost: number; outputCost: number; totalCost: number }> {
    const pricing = await this.getPricing(provider, model);

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPrice;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
    };
  }

  /**
   * Create a cost record
   */
  async createRecord(params: CreateCostRecordParams) {
    const now = new Date().toISOString();
    const totalTokens = params.inputTokens + params.outputTokens;

    // Calculate costs
    const costs = await this.calculateCost(
      params.provider,
      params.model,
      params.inputTokens,
      params.outputTokens
    );

    const result = await db
      .insert(costRecords)
      .values({
        spanId: params.spanId,
        workflowRunId: params.workflowRunId || null,
        provider: params.provider,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens,
        inputCost: costs.inputCost.toFixed(8),
        outputCost: costs.outputCost.toFixed(8),
        totalCost: costs.totalCost.toFixed(8),
        isRetry: params.isRetry || false,
        retryNumber: params.retryNumber || 0,
        costCategory: params.category || 'llm',
        createdAt: now,
      })
      .returning();

    return result[0];
  }

  /**
   * Get cost record by ID
   */
  async getById(id: number) {
    const result = await db
      .select()
      .from(costRecords)
      .where(eq(costRecords.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * List cost records for a workflow run
   */
  async listByWorkflowRun(workflowRunId: number, limit = 100) {
    const results = await db
      .select()
      .from(costRecords)
      .where(eq(costRecords.workflowRunId, workflowRunId))
      .orderBy(desc(costRecords.createdAt))
      .limit(limit);

    return results;
  }

  /**
   * Aggregate workflow cost
   */
  async aggregateWorkflowCost(workflowRunId: number): Promise<CostBreakdown> {
    const records = await this.listByWorkflowRun(workflowRunId);

    const breakdown: CostBreakdown = {
      totalCost: 0,
      byProvider: {},
      byModel: {},
      byCategory: {},
      retryCount: 0,
      retryCost: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    };

    for (const record of records) {
      const cost = parseFloat(record.totalCost);
      
      breakdown.totalCost += cost;
      breakdown.totalTokens += record.totalTokens;
      breakdown.inputTokens += record.inputTokens;
      breakdown.outputTokens += record.outputTokens;

      // By provider
      breakdown.byProvider[record.provider] = (breakdown.byProvider[record.provider] || 0) + cost;

      // By model
      const modelKey = `${record.provider}/${record.model}`;
      breakdown.byModel[modelKey] = (breakdown.byModel[modelKey] || 0) + cost;

      // By category
      breakdown.byCategory[record.costCategory] = (breakdown.byCategory[record.costCategory] || 0) + cost;

      // Retry stats
      if (record.isRetry) {
        breakdown.retryCount++;
        breakdown.retryCost += cost;
      }
    }

    return breakdown;
  }

  /**
   * Get cost breakdown for a trace
   */
  async getCostBreakdownByTrace(traceId: number): Promise<CostBreakdown> {
    // Get all spans for the trace
    const traceSpans = await db
      .select({ id: spans.id })
      .from(spans)
      .where(eq(spans.traceId, traceId));

    if (traceSpans.length === 0) {
      return {
        totalCost: 0,
        byProvider: {},
        byModel: {},
        byCategory: {},
        retryCount: 0,
        retryCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    const spanIds = traceSpans.map(s => s.id);

    const records = await db
      .select()
      .from(costRecords)
      .where(sql`${costRecords.spanId} IN (${sql.raw(spanIds.join(','))})`);

    const breakdown: CostBreakdown = {
      totalCost: 0,
      byProvider: {},
      byModel: {},
      byCategory: {},
      retryCount: 0,
      retryCost: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    };

    for (const record of records) {
      const cost = parseFloat(record.totalCost);
      
      breakdown.totalCost += cost;
      breakdown.totalTokens += record.totalTokens;
      breakdown.inputTokens += record.inputTokens;
      breakdown.outputTokens += record.outputTokens;

      breakdown.byProvider[record.provider] = (breakdown.byProvider[record.provider] || 0) + cost;
      
      const modelKey = `${record.provider}/${record.model}`;
      breakdown.byModel[modelKey] = (breakdown.byModel[modelKey] || 0) + cost;
      
      breakdown.byCategory[record.costCategory] = (breakdown.byCategory[record.costCategory] || 0) + cost;

      if (record.isRetry) {
        breakdown.retryCount++;
        breakdown.retryCost += cost;
      }
    }

    return breakdown;
  }

  /**
   * Get cost trends over time for an organization
   */
  async getCostTrends(
    organizationId: number,
    startDate: string,
    endDate: string
  ): Promise<CostTrend[]> {
    // This would need to join with traces to filter by organization
    // For now, aggregate by date from all cost records
    const results = await db
      .select({
        date: sql<string>`date(${costRecords.createdAt})`,
        totalCost: sql<string>`sum(cast(${costRecords.totalCost} as real))`,
        tokenCount: sql<number>`sum(${costRecords.totalTokens})`,
        requestCount: sql<number>`count(*)`,
      })
      .from(costRecords)
      .where(
        and(
          gte(costRecords.createdAt, startDate),
          lte(costRecords.createdAt, endDate)
        )
      )
      .groupBy(sql`date(${costRecords.createdAt})`)
      .orderBy(sql`date(${costRecords.createdAt})`);

    return results.map(r => ({
      date: r.date,
      totalCost: parseFloat(r.totalCost || '0'),
      tokenCount: r.tokenCount,
      requestCount: r.requestCount,
    }));
  }

  /**
   * Get cost summary for an organization
   */
  async getOrganizationCostSummary(organizationId: number) {
    // Get all workflow runs for the organization's workflows
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total cost (last 30 days)
    const last30Days = await db
      .select({
        totalCost: sql<string>`sum(cast(${costRecords.totalCost} as real))`,
        totalTokens: sql<number>`sum(${costRecords.totalTokens})`,
        requestCount: sql<number>`count(*)`,
      })
      .from(costRecords)
      .where(gte(costRecords.createdAt, thirtyDaysAgo.toISOString()));

    // Last 7 days
    const last7Days = await db
      .select({
        totalCost: sql<string>`sum(cast(${costRecords.totalCost} as real))`,
        totalTokens: sql<number>`sum(${costRecords.totalTokens})`,
        requestCount: sql<number>`count(*)`,
      })
      .from(costRecords)
      .where(gte(costRecords.createdAt, sevenDaysAgo.toISOString()));

    // Top models by cost
    const topModels = await db
      .select({
        provider: costRecords.provider,
        model: costRecords.model,
        totalCost: sql<string>`sum(cast(${costRecords.totalCost} as real))`,
        requestCount: sql<number>`count(*)`,
      })
      .from(costRecords)
      .where(gte(costRecords.createdAt, thirtyDaysAgo.toISOString()))
      .groupBy(costRecords.provider, costRecords.model)
      .orderBy(desc(sql`sum(cast(${costRecords.totalCost} as real))`))
      .limit(5);

    return {
      last30Days: {
        totalCost: parseFloat(last30Days[0]?.totalCost || '0'),
        totalTokens: last30Days[0]?.totalTokens || 0,
        requestCount: last30Days[0]?.requestCount || 0,
      },
      last7Days: {
        totalCost: parseFloat(last7Days[0]?.totalCost || '0'),
        totalTokens: last7Days[0]?.totalTokens || 0,
        requestCount: last7Days[0]?.requestCount || 0,
      },
      topModels: topModels.map(m => ({
        provider: m.provider,
        model: m.model,
        totalCost: parseFloat(m.totalCost || '0'),
        requestCount: m.requestCount,
      })),
    };
  }

  /**
   * Get all available provider pricing
   */
  async getAllPricing() {
    const pricing = await db
      .select()
      .from(providerPricing)
      .where(eq(providerPricing.isActive, true))
      .orderBy(providerPricing.provider, providerPricing.model);

    return pricing;
  }

  /**
   * Update provider pricing
   */
  async updatePricing(
    provider: string,
    model: string,
    inputPricePerMillion: string,
    outputPricePerMillion: string
  ) {
    const now = new Date().toISOString();

    // Deactivate old pricing
    await db
      .update(providerPricing)
      .set({ isActive: false })
      .where(
        and(
          eq(providerPricing.provider, provider),
          eq(providerPricing.model, model)
        )
      );

    // Insert new pricing
    const result = await db
      .insert(providerPricing)
      .values({
        provider,
        model,
        inputPricePerMillion,
        outputPricePerMillion,
        effectiveDate: now.split('T')[0],
        isActive: true,
        createdAt: now,
      })
      .returning();

    // Clear cache
    this.pricingCacheExpiry = 0;

    return result[0];
  }
}

export const costService = new CostService();
