/**
 * Decision Service
 * Business logic for agent decision auditing
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentDecisions, spans, workflowRuns } from "@/db/schema";
import {
	type DecisionAlternative,
	normalizeDecisionAlternative,
} from "@/db/types";

export type { DecisionAlternative };

// ============================================================================
// TYPES
// ============================================================================

export interface CreateDecisionParams {
	spanId: number;
	workflowRunId?: number;
	organizationId: number;
	agentName: string;
	decisionType: "action" | "tool" | "delegate" | "respond" | "route";
	chosen: string;
	alternatives: DecisionAlternative[];
	reasoning?: string;
	confidence?: number;
	inputContext?: Record<string, unknown>;
}

export interface ListDecisionsParams {
	limit?: number;
	offset?: number;
	agentName?: string;
	decisionType?: string;
	minConfidence?: number;
}

// ============================================================================
// DECISION SERVICE
// ============================================================================

class DecisionService {
	/**
	 * Create a new decision record
	 */
	async create(params: CreateDecisionParams) {
		const now = new Date();

		const result = await db
			.insert(agentDecisions)
			.values({
				spanId: params.spanId,
				workflowRunId: params.workflowRunId || null,
				organizationId: params.organizationId,
				agentName: params.agentName,
				decisionType: params.decisionType,
				chosen: params.chosen,
				alternatives:
					params.alternatives as unknown as import("@/db/types").DecisionAlternative[],
				reasoning: params.reasoning || null,
				confidence: params.confidence || null,
				inputContext:
					(params.inputContext as import("@/db/types").DecisionInputContext) ||
					null,
				createdAt: now,
			})
			.returning();

		return result[0];
	}

	/**
	 * Get a decision by ID
	 */
	async getById(id: number) {
		const result = await db
			.select()
			.from(agentDecisions)
			.where(eq(agentDecisions.id, id))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * List decisions for a workflow run
	 */
	async listByWorkflowRun(
		workflowRunId: number,
		params: ListDecisionsParams = {},
	) {
		const {
			limit = 50,
			offset = 0,
			agentName,
			decisionType,
			minConfidence,
		} = params;

		const conditions = [eq(agentDecisions.workflowRunId, workflowRunId)];

		if (agentName) {
			conditions.push(eq(agentDecisions.agentName, agentName));
		}

		if (decisionType) {
			conditions.push(eq(agentDecisions.decisionType, decisionType));
		}

		const results = await db
			.select()
			.from(agentDecisions)
			.where(and(...conditions))
			.orderBy(desc(agentDecisions.createdAt))
			.limit(Math.min(limit, 100))
			.offset(offset);

		// Filter by confidence if specified (done in memory for simplicity)
		if (minConfidence !== undefined) {
			return results.filter((d) => (d.confidence ?? 0) >= minConfidence);
		}

		return results;
	}

	/**
	 * List decisions for a span
	 */
	async listBySpan(spanId: number, organizationId?: number) {
		const conditions = [eq(agentDecisions.spanId, spanId)];
		if (organizationId) {
			conditions.push(eq(agentDecisions.organizationId, organizationId));
		}
		const results = await db
			.select()
			.from(agentDecisions)
			.where(and(...conditions))
			.orderBy(agentDecisions.createdAt);

		return results;
	}

	/**
	 * Get decision statistics for a workflow
	 */
	async getWorkflowDecisionStats(workflowRunId: number) {
		// Get all decisions for the workflow run
		const decisions = await db
			.select()
			.from(agentDecisions)
			.where(eq(agentDecisions.workflowRunId, workflowRunId));

		if (decisions.length === 0) {
			return {
				totalDecisions: 0,
				byAgent: {},
				byType: {},
				avgConfidence: 0,
				lowConfidenceDecisions: 0,
			};
		}

		// Calculate statistics
		const byAgent: Record<string, number> = {};
		const byType: Record<string, number> = {};
		let totalConfidence = 0;
		let confidenceCount = 0;
		let lowConfidence = 0;

		for (const decision of decisions) {
			// By agent
			byAgent[decision.agentName] = (byAgent[decision.agentName] || 0) + 1;

			// By type
			byType[decision.decisionType] = (byType[decision.decisionType] || 0) + 1;

			// Confidence stats
			if (decision.confidence !== null) {
				totalConfidence += decision.confidence;
				confidenceCount++;
				if (decision.confidence < 50) {
					lowConfidence++;
				}
			}
		}

		return {
			totalDecisions: decisions.length,
			byAgent,
			byType,
			avgConfidence:
				confidenceCount > 0 ? Math.round(totalConfidence / confidenceCount) : 0,
			lowConfidenceDecisions: lowConfidence,
		};
	}

	/**
	 * Get decision comparison - analyze alternative choices
	 */
	async getDecisionComparison(decisionId: number) {
		const decision = await this.getById(decisionId);
		if (!decision) return null;

		const rawAlternatives =
			(decision.alternatives as unknown as Record<string, unknown>[]) || [];
		const alternatives = rawAlternatives.map(normalizeDecisionAlternative);

		// Calculate what-if scenarios
		const comparison = {
			decision,
			chosen: {
				action: decision.chosen,
				confidence: decision.confidence,
				reasoning: decision.reasoning,
			},
			alternatives: alternatives.map((alt) => ({
				action: alt.action,
				confidence: alt.confidence,
				reasoning: alt.reasoning,
				rejectedReason: alt.rejectedReason,
				confidenceDiff: (decision.confidence || 0) - alt.confidence,
			})),
			totalAlternatives: alternatives.length,
			highestAlternativeConfidence: Math.max(
				...alternatives.map((a) => a.confidence),
				0,
			),
		};

		return comparison;
	}

	/**
	 * Get decision audit trail for a trace
	 */
	async getDecisionAuditTrail(traceId: number) {
		// Get all spans for the trace
		const traceSpans = await db
			.select()
			.from(spans)
			.where(eq(spans.traceId, traceId))
			.orderBy(spans.startTime);

		// Get decisions for each span
		const spanIds = traceSpans.map((s) => s.id);

		if (spanIds.length === 0) {
			return { trace: traceId, decisions: [] };
		}

		const decisions = await db
			.select()
			.from(agentDecisions)
			.where(inArray(agentDecisions.spanId, spanIds))
			.orderBy(agentDecisions.createdAt);

		// Build audit trail
		const auditTrail = decisions.map((d) => {
			const span = traceSpans.find((s) => s.id === d.spanId);
			return {
				...d,
				spanName: span?.name,
				spanType: span?.type,
				timestamp: d.createdAt,
			};
		});

		return {
			traceId,
			totalDecisions: decisions.length,
			decisions: auditTrail,
		};
	}

	/**
	 * Get agent decision patterns
	 */
	async getAgentDecisionPatterns(workflowId: number) {
		// Get all runs for the workflow
		const runs = await db
			.select({ id: workflowRuns.id })
			.from(workflowRuns)
			.where(eq(workflowRuns.workflowId, workflowId));

		if (runs.length === 0) {
			return { patterns: [] };
		}

		const runIds = runs.map((r) => r.id);

		// Get all decisions across these runs
		const decisions = await db
			.select({
				agentName: agentDecisions.agentName,
				decisionType: agentDecisions.decisionType,
				chosen: agentDecisions.chosen,
				confidence: agentDecisions.confidence,
			})
			.from(agentDecisions)
			.where(inArray(agentDecisions.workflowRunId, runIds));

		// Analyze patterns
		const patterns: Record<
			string,
			{
				agent: string;
				type: string;
				choices: Record<string, number>;
				avgConfidence: number;
				totalDecisions: number;
			}
		> = {};

		for (const d of decisions) {
			const key = `${d.agentName}-${d.decisionType}`;

			if (!patterns[key]) {
				patterns[key] = {
					agent: d.agentName,
					type: d.decisionType,
					choices: {},
					avgConfidence: 0,
					totalDecisions: 0,
				};
			}

			patterns[key].choices[d.chosen] =
				(patterns[key].choices[d.chosen] || 0) + 1;
			patterns[key].avgConfidence += d.confidence || 0;
			patterns[key].totalDecisions++;
		}

		// Calculate averages
		const patternList = Object.values(patterns).map((p) => ({
			...p,
			avgConfidence:
				p.totalDecisions > 0
					? Math.round(p.avgConfidence / p.totalDecisions)
					: 0,
			mostCommonChoice:
				Object.entries(p.choices).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
		}));

		return {
			totalRuns: runs.length,
			patterns: patternList,
		};
	}
}

export const decisionService = new DecisionService();
