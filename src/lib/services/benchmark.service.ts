/**
 * Benchmark Service
 * Business logic for agent performance benchmarking and leaderboards
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentConfigs, benchmarkResults, benchmarks, workflowRuns, workflows } from "@/db/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface CreateBenchmarkParams {
  name: string;
  description?: string;
  organizationId: number;
  taskType: "qa" | "coding" | "reasoning" | "tool_use" | "multi_step";
  dataset?: Array<{ input: string; expectedOutput?: string; metadata?: Record<string, any> }>;
  metrics: string[];
  isPublic?: boolean;
  createdBy: string;
}

export interface CreateAgentConfigParams {
  name: string;
  organizationId: number;
  architecture: "react" | "cot" | "tot" | "custom";
  model: string;
  config?: Record<string, any>;
  description?: string;
  createdBy: string;
}

export interface SubmitBenchmarkResultParams {
  benchmarkId: number;
  agentConfigId: number;
  workflowRunId?: number;
  accuracy?: number;
  latencyP50?: number;
  latencyP95?: number;
  totalCost?: string;
  successRate?: number;
  toolUseEfficiency?: number;
  customMetrics?: Record<string, any>;
}

export interface LeaderboardEntry {
  rank: number;
  agentConfig: {
    id: number;
    name: string;
    architecture: string;
    model: string;
  };
  accuracy: number | null;
  latencyP50: number | null;
  latencyP95: number | null;
  totalCost: string | null;
  successRate: number | null;
  runCount: number;
  score: number; // Composite score for ranking
}

// ============================================================================
// BENCHMARK SERVICE
// ============================================================================

class BenchmarkService {
  // ==========================================================================
  // BENCHMARKS
  // ==========================================================================

  /**
   * List benchmarks for an organization
   */
  async listBenchmarks(organizationId: number, includePublic = true) {
    const conditions = includePublic
      ? sql`${benchmarks.organizationId} = ${organizationId} OR ${benchmarks.isPublic} = true`
      : eq(benchmarks.organizationId, organizationId);

    const results = await db
      .select()
      .from(benchmarks)
      .where(conditions)
      .orderBy(desc(benchmarks.createdAt));

    return results;
  }

  /**
   * Get a single benchmark by ID
   */
  async getBenchmarkById(id: number) {
    const result = await db.select().from(benchmarks).where(eq(benchmarks.id, id)).limit(1);

    return result[0] || null;
  }

  /**
   * Create a new benchmark
   */
  async createBenchmark(params: CreateBenchmarkParams) {
    const now = new Date().toISOString();

    const result = await db
      .insert(benchmarks)
      .values({
        name: params.name.trim(),
        description: params.description?.trim() || null,
        organizationId: params.organizationId,
        taskType: params.taskType,
        dataset: (params.dataset as any) || null,
        metrics: params.metrics as any,
        isPublic: params.isPublic || false,
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  }

  /**
   * Delete a benchmark
   */
  async deleteBenchmark(id: number, organizationId: number) {
    const existing = await this.getBenchmarkById(id);
    if (!existing || existing.organizationId !== organizationId) {
      return false;
    }

    await db.delete(benchmarks).where(eq(benchmarks.id, id));
    return true;
  }

  // ==========================================================================
  // AGENT CONFIGS
  // ==========================================================================

  /**
   * List agent configs for an organization
   */
  async listAgentConfigs(organizationId: number) {
    const results = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.organizationId, organizationId))
      .orderBy(desc(agentConfigs.createdAt));

    return results;
  }

  /**
   * Get a single agent config by ID
   */
  async getAgentConfigById(id: number) {
    const result = await db.select().from(agentConfigs).where(eq(agentConfigs.id, id)).limit(1);

    return result[0] || null;
  }

  /**
   * Create a new agent config
   */
  async createAgentConfig(params: CreateAgentConfigParams) {
    const now = new Date().toISOString();

    const result = await db
      .insert(agentConfigs)
      .values({
        name: params.name.trim(),
        organizationId: params.organizationId,
        architecture: params.architecture,
        model: params.model,
        config: (params.config as any) || null,
        description: params.description?.trim() || null,
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  }

  /**
   * Delete an agent config
   */
  async deleteAgentConfig(id: number, organizationId: number) {
    const existing = await this.getAgentConfigById(id);
    if (!existing || existing.organizationId !== organizationId) {
      return false;
    }

    await db.delete(agentConfigs).where(eq(agentConfigs.id, id));
    return true;
  }

  // ==========================================================================
  // BENCHMARK RESULTS
  // ==========================================================================

  /**
   * Submit a benchmark result
   */
  async submitResult(params: SubmitBenchmarkResultParams) {
    const now = new Date().toISOString();

    // Check if there's an existing result for this benchmark/agent combo
    const existing = await db
      .select()
      .from(benchmarkResults)
      .where(
        and(
          eq(benchmarkResults.benchmarkId, params.benchmarkId),
          eq(benchmarkResults.agentConfigId, params.agentConfigId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing result (aggregate with new data)
      const existingResult = existing[0];
      const newRunCount = (existingResult.runCount || 1) + 1;

      // Average the metrics
      const result = await db
        .update(benchmarkResults)
        .set({
          accuracy:
            params.accuracy !== undefined
              ? Math.round(((existingResult.accuracy || 0) + params.accuracy) / 2)
              : existingResult.accuracy,
          latencyP50:
            params.latencyP50 !== undefined
              ? Math.round(((existingResult.latencyP50 || 0) + params.latencyP50) / 2)
              : existingResult.latencyP50,
          latencyP95:
            params.latencyP95 !== undefined
              ? Math.round(((existingResult.latencyP95 || 0) + params.latencyP95) / 2)
              : existingResult.latencyP95,
          totalCost:
            params.totalCost !== undefined
              ? (
                  parseFloat(existingResult.totalCost || "0") + parseFloat(params.totalCost)
                ).toFixed(6)
              : existingResult.totalCost,
          successRate:
            params.successRate !== undefined
              ? Math.round(((existingResult.successRate || 0) + params.successRate) / 2)
              : existingResult.successRate,
          toolUseEfficiency:
            params.toolUseEfficiency !== undefined
              ? Math.round(((existingResult.toolUseEfficiency || 0) + params.toolUseEfficiency) / 2)
              : existingResult.toolUseEfficiency,
          customMetrics: (params.customMetrics as any) || existingResult.customMetrics,
          runCount: newRunCount,
          workflowRunId: params.workflowRunId || existingResult.workflowRunId,
        })
        .where(eq(benchmarkResults.id, existingResult.id))
        .returning();

      return result[0];
    }

    // Create new result
    const result = await db
      .insert(benchmarkResults)
      .values({
        benchmarkId: params.benchmarkId,
        agentConfigId: params.agentConfigId,
        workflowRunId: params.workflowRunId || null,
        accuracy: params.accuracy || null,
        latencyP50: params.latencyP50 || null,
        latencyP95: params.latencyP95 || null,
        totalCost: params.totalCost || null,
        successRate: params.successRate || null,
        toolUseEfficiency: params.toolUseEfficiency || null,
        customMetrics: (params.customMetrics as any) || null,
        runCount: 1,
        createdAt: now,
      })
      .returning();

    return result[0];
  }

  /**
   * Get leaderboard for a benchmark
   */
  async getLeaderboard(
    benchmarkId: number,
    sortBy: "accuracy" | "latency" | "cost" | "score" = "score",
    limit = 20,
  ): Promise<LeaderboardEntry[]> {
    const results = await db
      .select({
        result: benchmarkResults,
        config: agentConfigs,
      })
      .from(benchmarkResults)
      .innerJoin(agentConfigs, eq(benchmarkResults.agentConfigId, agentConfigs.id))
      .where(eq(benchmarkResults.benchmarkId, benchmarkId))
      .limit(limit);

    // Calculate composite scores and sort
    const entries: LeaderboardEntry[] = results.map((r) => {
      // Composite score: weighted average of metrics
      // Higher accuracy, success rate, tool efficiency = better
      // Lower latency, cost = better
      const accuracyScore = r.result.accuracy || 0;
      const successScore = r.result.successRate || 0;
      const efficiencyScore = r.result.toolUseEfficiency || 0;
      const latencyScore = r.result.latencyP50 ? Math.max(0, 100 - r.result.latencyP50 / 100) : 0;
      const costScore = r.result.totalCost
        ? Math.max(0, 100 - parseFloat(r.result.totalCost) * 100)
        : 50;

      const compositeScore = Math.round(
        accuracyScore * 0.35 +
          successScore * 0.25 +
          efficiencyScore * 0.15 +
          latencyScore * 0.15 +
          costScore * 0.1,
      );

      return {
        rank: 0, // Will be set after sorting
        agentConfig: {
          id: r.config.id,
          name: r.config.name,
          architecture: r.config.architecture,
          model: r.config.model,
        },
        accuracy: r.result.accuracy,
        latencyP50: r.result.latencyP50,
        latencyP95: r.result.latencyP95,
        totalCost: r.result.totalCost,
        successRate: r.result.successRate,
        runCount: r.result.runCount || 1,
        score: compositeScore,
      };
    });

    // Sort by specified metric
    entries.sort((a, b) => {
      switch (sortBy) {
        case "accuracy":
          return (b.accuracy || 0) - (a.accuracy || 0);
        case "latency":
          return (a.latencyP50 || Infinity) - (b.latencyP50 || Infinity);
        case "cost":
          return parseFloat(a.totalCost || "999999") - parseFloat(b.totalCost || "999999");
        default:
          return b.score - a.score;
      }
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  /**
   * Compare multiple agents on a benchmark
   */
  async compareAgents(benchmarkId: number, agentConfigIds: number[]) {
    const results = await db
      .select({
        result: benchmarkResults,
        config: agentConfigs,
      })
      .from(benchmarkResults)
      .innerJoin(agentConfigs, eq(benchmarkResults.agentConfigId, agentConfigs.id))
      .where(
        and(
          eq(benchmarkResults.benchmarkId, benchmarkId),
          inArray(benchmarkResults.agentConfigId, agentConfigIds),
        ),
      );

    return results.map((r) => ({
      agentConfig: {
        id: r.config.id,
        name: r.config.name,
        architecture: r.config.architecture,
        model: r.config.model,
      },
      metrics: {
        accuracy: r.result.accuracy,
        latencyP50: r.result.latencyP50,
        latencyP95: r.result.latencyP95,
        totalCost: r.result.totalCost,
        successRate: r.result.successRate,
        toolUseEfficiency: r.result.toolUseEfficiency,
        runCount: r.result.runCount,
      },
      customMetrics: r.result.customMetrics,
    }));
  }

  /**
   * Get benchmark statistics
   */
  async getBenchmarkStats(benchmarkId: number) {
    const results = await db
      .select()
      .from(benchmarkResults)
      .where(eq(benchmarkResults.benchmarkId, benchmarkId));

    if (results.length === 0) {
      return {
        participantCount: 0,
        totalRuns: 0,
        avgAccuracy: 0,
        avgLatency: 0,
        topPerformer: null,
      };
    }

    const totalRuns = results.reduce((sum, r) => sum + (r.runCount || 1), 0);
    const avgAccuracy = results.reduce((sum, r) => sum + (r.accuracy || 0), 0) / results.length;
    const avgLatency = results.reduce((sum, r) => sum + (r.latencyP50 || 0), 0) / results.length;

    // Find top performer by accuracy
    const topResult = results.reduce(
      (best, r) => ((r.accuracy || 0) > (best.accuracy || 0) ? r : best),
      results[0],
    );

    const topConfig = topResult ? await this.getAgentConfigById(topResult.agentConfigId) : null;

    return {
      participantCount: results.length,
      totalRuns,
      avgAccuracy: Math.round(avgAccuracy),
      avgLatency: Math.round(avgLatency),
      topPerformer: topConfig
        ? {
            name: topConfig.name,
            architecture: topConfig.architecture,
            accuracy: topResult.accuracy,
          }
        : null,
    };
  }

  /**
   * Get architecture comparison across benchmarks
   */
  async getArchitectureComparison(organizationId: number) {
    const results = await db
      .select({
        architecture: agentConfigs.architecture,
        avgAccuracy: sql<number>`avg(${benchmarkResults.accuracy})`,
        avgLatency: sql<number>`avg(${benchmarkResults.latencyP50})`,
        avgCost: sql<string>`avg(cast(${benchmarkResults.totalCost} as real))`,
        count: sql<number>`count(*)`,
      })
      .from(benchmarkResults)
      .innerJoin(agentConfigs, eq(benchmarkResults.agentConfigId, agentConfigs.id))
      .where(eq(agentConfigs.organizationId, organizationId))
      .groupBy(agentConfigs.architecture);

    return results.map((r) => ({
      architecture: r.architecture,
      avgAccuracy: Math.round(r.avgAccuracy || 0),
      avgLatency: Math.round(r.avgLatency || 0),
      avgCost: parseFloat(r.avgCost || "0").toFixed(4),
      benchmarkCount: r.count,
    }));
  }
}

export const benchmarkService = new BenchmarkService();

// ============================================================================
// SLA VIOLATION CHECKING
// ============================================================================

export interface SLAViolation {
  type: "latency" | "cost" | "error_rate";
  threshold: number | string;
  actual: number | string;
  severity: "warning" | "critical";
  message: string;
}

export interface SLACheckResult {
  workflowRunId: number;
  violations: SLAViolation[];
  passed: boolean;
  checkedAt: string;
}

/**
 * Check SLA violations for a workflow run
 */
export async function checkSLAViolations(workflowRunId: number): Promise<SLACheckResult> {
  const run = await db
    .select({
      run: workflowRuns,
      workflow: workflows,
    })
    .from(workflowRuns)
    .leftJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
    .where(eq(workflowRuns.id, workflowRunId))
    .limit(1);

  if (run.length === 0) {
    return {
      workflowRunId,
      violations: [],
      passed: true,
      checkedAt: new Date().toISOString(),
    };
  }

  const { run: workflowRun, workflow } = run[0];
  const violations: SLAViolation[] = [];

  // Check latency SLA
  if (workflow?.slaLatencyMs && workflowRun.totalDurationMs) {
    if (workflowRun.totalDurationMs > workflow.slaLatencyMs) {
      const overagePercent =
        ((workflowRun.totalDurationMs - workflow.slaLatencyMs) / workflow.slaLatencyMs) * 100;
      violations.push({
        type: "latency",
        threshold: workflow.slaLatencyMs,
        actual: workflowRun.totalDurationMs,
        severity: overagePercent > 50 ? "critical" : "warning",
        message: `Latency ${workflowRun.totalDurationMs}ms exceeds SLA threshold of ${workflow.slaLatencyMs}ms (${overagePercent.toFixed(1)}% over)`,
      });
    }
  }

  // Check cost SLA
  if (workflow?.slaCostDollars && workflowRun.totalCost) {
    const slaCost = parseFloat(workflow.slaCostDollars);
    const actualCost = parseFloat(workflowRun.totalCost);
    if (actualCost > slaCost) {
      const overagePercent = ((actualCost - slaCost) / slaCost) * 100;
      violations.push({
        type: "cost",
        threshold: workflow.slaCostDollars,
        actual: workflowRun.totalCost,
        severity: overagePercent > 50 ? "critical" : "warning",
        message: `Cost $${actualCost.toFixed(4)} exceeds SLA threshold of $${slaCost.toFixed(4)} (${overagePercent.toFixed(1)}% over)`,
      });
    }
  }

  // Check error rate SLA (calculated from workflow history)
  if (workflow?.slaErrorRate && workflow.id) {
    const recentRuns = await db
      .select({
        status: workflowRuns.status,
      })
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflow.id))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(100);

    if (recentRuns.length >= 10) {
      const failedCount = recentRuns.filter((r) => r.status === "failed").length;
      const errorRate = (failedCount / recentRuns.length) * 100;

      if (errorRate > workflow.slaErrorRate) {
        violations.push({
          type: "error_rate",
          threshold: workflow.slaErrorRate,
          actual: Math.round(errorRate),
          severity: errorRate > workflow.slaErrorRate * 1.5 ? "critical" : "warning",
          message: `Error rate ${errorRate.toFixed(1)}% exceeds SLA threshold of ${workflow.slaErrorRate}% (last ${recentRuns.length} runs)`,
        });
      }
    }
  }

  return {
    workflowRunId,
    violations,
    passed: violations.length === 0,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Get SLA status summary for a workflow
 */
export async function getWorkflowSLAStatus(workflowId: number): Promise<{
  workflow: {
    id: number;
    name: string;
    slaLatencyMs: number | null;
    slaCostDollars: string | null;
    slaErrorRate: number | null;
  };
  recentViolations: number;
  complianceRate: number;
  lastChecked: string;
}> {
  const workflow = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);

  if (workflow.length === 0) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const recentRuns = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, workflowId))
    .orderBy(desc(workflowRuns.startedAt))
    .limit(50);

  let violationCount = 0;
  for (const run of recentRuns) {
    const result = await checkSLAViolations(run.id);
    if (!result.passed) {
      violationCount++;
    }
  }

  const complianceRate =
    recentRuns.length > 0 ? ((recentRuns.length - violationCount) / recentRuns.length) * 100 : 100;

  return {
    workflow: {
      id: workflow[0].id,
      name: workflow[0].name,
      slaLatencyMs: workflow[0].slaLatencyMs,
      slaCostDollars: workflow[0].slaCostDollars,
      slaErrorRate: workflow[0].slaErrorRate,
    },
    recentViolations: violationCount,
    complianceRate: Math.round(complianceRate * 10) / 10,
    lastChecked: new Date().toISOString(),
  };
}
