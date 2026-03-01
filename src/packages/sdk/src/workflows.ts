/**
 * Workflow Tracer SDK
 * Multi-agent workflow instrumentation, decision tracking, and cost capture
 *
 * @example
 * ```typescript
 * import { WorkflowTracer } from '@evalgate/sdk';
 *
 * const tracer = new WorkflowTracer(client, { organizationId: 123 });
 *
 * // Start a workflow
 * const workflow = await tracer.startWorkflow('Customer Support Pipeline');
 *
 * // Record agent spans and handoffs
 * const span1 = await tracer.startAgentSpan('RouterAgent', { input: query });
 * await tracer.recordDecision({
 *   agent: 'RouterAgent',
 *   chosen: 'delegate_to_technical',
 *   alternatives: [{ action: 'delegate_to_billing', confidence: 0.3 }],
 *   reasoning: 'Query contains technical keywords'
 * });
 * await tracer.recordHandoff('RouterAgent', 'TechnicalAgent', { issue: 'API error' });
 * await tracer.endAgentSpan(span1, { result: 'delegated' });
 *
 * // End workflow with final output
 * await tracer.endWorkflow({ resolution: 'Issue resolved' });
 * ```
 */

import type { AIEvalClient } from "./client";
import { mergeWithContext } from "./context";

// ============================================================================
// TYPES - Workflow Definition
// ============================================================================

/**
 * Node in a workflow DAG
 */
export interface WorkflowNode {
	id: string;
	type: "agent" | "tool" | "decision" | "parallel" | "human" | "llm";
	name: string;
	config?: Record<string, unknown>;
}

/**
 * Edge connecting nodes in a workflow DAG
 */
export interface WorkflowEdge {
	from: string;
	to: string;
	condition?: string;
	label?: string;
}

/**
 * Complete workflow definition (DAG structure)
 */
export interface WorkflowDefinition {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	entrypoint: string;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// TYPES - Workflow Execution
// ============================================================================

// External library interfaces for type safety
interface LangChainExecutor {
	invoke?: (input: unknown, config?: unknown) => Promise<unknown>;
	call?: (input: unknown, config?: unknown) => Promise<unknown>;
}

interface CrewAI {
	kickoff?: (input?: unknown) => Promise<unknown>;
}

interface LangChainConversation {
	initiate_chat?: (...args: unknown[]) => Promise<unknown>;
}

/**
 * Active workflow context
 */
export interface WorkflowContext {
	id: number;
	traceId: number;
	name: string;
	startedAt: string;
	definition?: WorkflowDefinition;
	metadata?: Record<string, unknown>;
}

/**
 * Workflow run status
 */
export type WorkflowStatus = "running" | "completed" | "failed" | "cancelled";

/**
 * Handoff types between agents
 */
export type HandoffType = "delegation" | "escalation" | "parallel" | "fallback";

/**
 * Agent handoff record
 */
export interface AgentHandoff {
	fromAgent?: string;
	toAgent: string;
	handoffType: HandoffType;
	context?: Record<string, unknown>;
	timestamp: string;
}

// ============================================================================
// TYPES - Decision Auditing
// ============================================================================

/**
 * Alternative action that was considered but not chosen
 */
export interface DecisionAlternative {
	action: string;
	confidence: number;
	reasoning?: string;
	rejectedReason?: string;
}

/**
 * Decision types made by agents
 */
export type DecisionType = "action" | "tool" | "delegate" | "respond" | "route";

/**
 * Parameters for recording a decision
 */
export interface RecordDecisionParams {
	/** Name of the agent making the decision */
	agent: string;
	/** Type of decision */
	type: DecisionType;
	/** The action/tool/response that was chosen */
	chosen: string;
	/** Alternative options that were considered */
	alternatives: DecisionAlternative[];
	/** Reasoning for the choice */
	reasoning?: string;
	/** Confidence score 0-100 */
	confidence?: number;
	/** Factors that influenced the decision */
	contextFactors?: string[];
	/** Input context at decision time */
	inputContext?: Record<string, unknown>;
}

// ============================================================================
// TYPES - Cost Tracking
// ============================================================================

/**
 * LLM provider names
 */
export type LLMProvider =
	| "openai"
	| "anthropic"
	| "google"
	| "cohere"
	| "mistral"
	| "custom";

/**
 * Cost categories for tracking
 */
export type CostCategory = "llm" | "tool" | "embedding" | "other";

/**
 * Parameters for recording cost
 */
export interface RecordCostParams {
	provider: LLMProvider | string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	category?: CostCategory;
	isRetry?: boolean;
	retryNumber?: number;
}

/**
 * Cost record with calculated values
 */
export interface CostRecord extends RecordCostParams {
	totalTokens: number;
	inputCost: string;
	outputCost: string;
	totalCost: string;
}

// ============================================================================
// TYPES - Workflow Tracer Options
// ============================================================================

/**
 * Options for WorkflowTracer
 */
export interface WorkflowTracerOptions {
	/** Organization ID for traces */
	organizationId?: number;
	/** Whether to auto-calculate costs (requires provider pricing) */
	autoCalculateCost?: boolean;
	/** Custom trace name prefix */
	tracePrefix?: string;
	/** Whether to capture full input/output (may be large) */
	captureFullPayloads?: boolean;
	/** Debug mode */
	debug?: boolean;
}

// ============================================================================
// TYPES - Agent Span
// ============================================================================

/**
 * Agent span context
 */
export interface AgentSpanContext {
	spanId: string;
	agentName: string;
	startTime: string;
	parentSpanId?: string;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// MAIN CLASS - WorkflowTracer
// ============================================================================

/**
 * WorkflowTracer - Instrument multi-agent workflows with tracing, decision auditing, and cost tracking
 *
 * @example
 * ```typescript
 * const tracer = new WorkflowTracer(client, { organizationId: 123 });
 *
 * // Simple workflow
 * await tracer.startWorkflow('Data Processing Pipeline');
 *
 * const agentSpan = await tracer.startAgentSpan('DataAgent', { source: 'api' });
 * // ... agent work ...
 * await tracer.endAgentSpan(agentSpan, { processed: 100 });
 *
 * await tracer.endWorkflow({ status: 'success' });
 * ```
 */
export class WorkflowTracer {
	private client: AIEvalClient;
	private options: Required<WorkflowTracerOptions>;
	private currentWorkflow: WorkflowContext | null = null;
	private activeSpans: Map<string, AgentSpanContext> = new Map();
	private handoffs: AgentHandoff[] = [];
	private decisions: RecordDecisionParams[] = [];
	private costs: CostRecord[] = [];
	private spanCounter = 0;

	constructor(client: AIEvalClient, options: WorkflowTracerOptions = {}) {
		this.client = client;
		this.options = {
			organizationId: options.organizationId || client.getOrganizationId() || 0,
			autoCalculateCost: options.autoCalculateCost ?? true,
			tracePrefix: options.tracePrefix || "workflow",
			captureFullPayloads: options.captureFullPayloads ?? true,
			debug: options.debug ?? false,
		};
	}

	// ==========================================================================
	// WORKFLOW LIFECYCLE
	// ==========================================================================

	/**
	 * Start a new workflow
	 *
	 * @example
	 * ```typescript
	 * const workflow = await tracer.startWorkflow('Customer Support Flow', {
	 *   nodes: [
	 *     { id: 'router', type: 'agent', name: 'RouterAgent' },
	 *     { id: 'technical', type: 'agent', name: 'TechnicalAgent' },
	 *   ],
	 *   edges: [{ from: 'router', to: 'technical', condition: 'is_technical' }],
	 *   entrypoint: 'router'
	 * });
	 * ```
	 */
	async startWorkflow(
		name: string,
		definition?: WorkflowDefinition,
		metadata?: Record<string, unknown>,
	): Promise<WorkflowContext> {
		if (this.currentWorkflow) {
			throw new Error(
				"A workflow is already active. Call endWorkflow() first.",
			);
		}

		const traceId = `${this.options.tracePrefix}-${Date.now()}-${this.generateId()}`;
		const startedAt = new Date().toISOString();

		// Create the trace
		const trace = await this.client.traces.create({
			name: `Workflow: ${name}`,
			traceId,
			organizationId: this.options.organizationId,
			status: "pending",
			metadata: mergeWithContext({
				workflowName: name,
				definition,
				...metadata,
			}),
		});

		this.currentWorkflow = {
			id: 0, // Will be set after API call returns
			traceId: trace.id,
			name,
			startedAt,
			definition,
			metadata,
		};

		// Reset state
		this.handoffs = [];
		this.decisions = [];
		this.costs = [];
		this.activeSpans.clear();
		this.spanCounter = 0;

		this.log("Started workflow", { name, traceId: trace.id });

		return this.currentWorkflow;
	}

	/**
	 * End the current workflow
	 */
	async endWorkflow(
		output?: Record<string, unknown>,
		status: WorkflowStatus = "completed",
	): Promise<void> {
		if (!this.currentWorkflow) {
			throw new Error("No active workflow. Call startWorkflow() first.");
		}

		const durationMs =
			Date.now() - new Date(this.currentWorkflow.startedAt).getTime();

		// Calculate total cost
		const totalCost = this.costs.reduce(
			(sum, cost) => sum + parseFloat(cost.totalCost),
			0,
		);

		// Update the original trace with completion data
		await this.client.traces.update(this.currentWorkflow.traceId, {
			status: status === "completed" ? "success" : "error",
			durationMs,
			metadata: mergeWithContext({
				workflowName: this.currentWorkflow.name,
				output,
				status,
				totalCost: totalCost.toFixed(6),
				handoffCount: this.handoffs.length,
				decisionCount: this.decisions.length,
				agentCount: new Set(this.handoffs.map((h) => h.toAgent)).size + 1,
				retryCount: this.costs.filter((c) => c.isRetry).length,
				handoffs: this.handoffs,
				decisions: this.decisions,
				costs: this.costs,
			}),
		});

		this.log("Ended workflow", {
			name: this.currentWorkflow.name,
			status,
			durationMs,
			totalCost: totalCost.toFixed(6),
		});

		this.currentWorkflow = null;
	}

	// ==========================================================================
	// AGENT SPANS
	// ==========================================================================

	/**
	 * Start an agent span within the workflow
	 *
	 * @example
	 * ```typescript
	 * const span = await tracer.startAgentSpan('RouterAgent', {
	 *   input: userQuery
	 * });
	 * ```
	 */
	async startAgentSpan(
		agentName: string,
		input?: Record<string, unknown>,
		parentSpanId?: string,
	): Promise<AgentSpanContext> {
		if (!this.currentWorkflow) {
			throw new Error("No active workflow. Call startWorkflow() first.");
		}

		const spanId = `span-${++this.spanCounter}-${this.generateId()}`;
		const startTime = new Date().toISOString();

		const spanContext: AgentSpanContext = {
			spanId,
			agentName,
			startTime,
			parentSpanId,
			metadata: input,
		};

		this.activeSpans.set(spanId, spanContext);

		// Create span via API
		await this.client.traces.createSpan(this.currentWorkflow.traceId, {
			name: `Agent: ${agentName}`,
			spanId,
			type: "agent",
			parentSpanId,
			startTime,
			metadata: mergeWithContext({
				agentName,
				...(this.options.captureFullPayloads ? { input } : {}),
			}),
		});

		this.log("Started agent span", { agentName, spanId });

		return spanContext;
	}

	/**
	 * End an agent span
	 */
	async endAgentSpan(
		span: AgentSpanContext,
		output?: Record<string, unknown>,
		error?: string,
	): Promise<void> {
		if (!this.currentWorkflow) {
			throw new Error("No active workflow.");
		}

		const endTime = new Date().toISOString();
		const durationMs =
			new Date(endTime).getTime() - new Date(span.startTime).getTime();

		// Update span via API (create completion record)
		await this.client.traces.createSpan(this.currentWorkflow.traceId, {
			name: `Agent: ${span.agentName}`,
			spanId: `${span.spanId}-end`,
			type: "agent",
			parentSpanId: span.spanId,
			startTime: span.startTime,
			endTime,
			durationMs,
			metadata: mergeWithContext({
				agentName: span.agentName,
				...(this.options.captureFullPayloads ? { output } : {}),
				...(error ? { error } : {}),
			}),
		});

		this.activeSpans.delete(span.spanId);
		this.log("Ended agent span", {
			agentName: span.agentName,
			spanId: span.spanId,
			durationMs,
		});
	}

	// ==========================================================================
	// HANDOFFS
	// ==========================================================================

	/**
	 * Record a handoff between agents
	 *
	 * @example
	 * ```typescript
	 * await tracer.recordHandoff(
	 *   'RouterAgent',
	 *   'TechnicalAgent',
	 *   { issueType: 'api_error', priority: 'high' },
	 *   'delegation'
	 * );
	 * ```
	 */
	async recordHandoff(
		fromAgent: string | undefined,
		toAgent: string,
		context?: Record<string, unknown>,
		handoffType: HandoffType = "delegation",
	): Promise<void> {
		if (!this.currentWorkflow) {
			throw new Error("No active workflow. Call startWorkflow() first.");
		}

		const handoff: AgentHandoff = {
			fromAgent,
			toAgent,
			handoffType,
			context,
			timestamp: new Date().toISOString(),
		};

		this.handoffs.push(handoff);

		// Also create a span for the handoff
		const spanId = `handoff-${this.handoffs.length}-${this.generateId()}`;
		await this.client.traces.createSpan(this.currentWorkflow.traceId, {
			name: `Handoff: ${fromAgent || "start"} → ${toAgent}`,
			spanId,
			type: "handoff",
			startTime: handoff.timestamp,
			endTime: handoff.timestamp,
			durationMs: 0,
			metadata: mergeWithContext({
				handoffType,
				fromAgent,
				toAgent,
				context,
			}),
		});

		this.log("Recorded handoff", { fromAgent, toAgent, handoffType });
	}

	// ==========================================================================
	// DECISION AUDITING
	// ==========================================================================

	/**
	 * Record a decision made by an agent
	 *
	 * @example
	 * ```typescript
	 * await tracer.recordDecision({
	 *   agent: 'RouterAgent',
	 *   type: 'route',
	 *   chosen: 'technical_support',
	 *   alternatives: [
	 *     { action: 'billing_support', confidence: 0.3, reasoning: 'No billing keywords' },
	 *     { action: 'general_support', confidence: 0.1, reasoning: 'Fallback option' }
	 *   ],
	 *   reasoning: 'Query contains technical terms like "API", "error", "endpoint"',
	 *   confidence: 85,
	 *   contextFactors: ['keyword_match', 'user_history']
	 * });
	 * ```
	 */
	async recordDecision(params: RecordDecisionParams): Promise<void> {
		if (!this.currentWorkflow) {
			throw new Error("No active workflow. Call startWorkflow() first.");
		}

		this.decisions.push(params);

		// Create a span for the decision
		const spanId = `decision-${this.decisions.length}-${this.generateId()}`;
		const timestamp = new Date().toISOString();

		await this.client.traces.createSpan(this.currentWorkflow.traceId, {
			name: `Decision: ${params.agent} chose ${params.chosen}`,
			spanId,
			type: "decision",
			startTime: timestamp,
			endTime: timestamp,
			durationMs: 0,
			metadata: mergeWithContext({
				isDecisionPoint: true,
				agentName: params.agent,
				decisionType: params.type,
				chosen: params.chosen,
				alternatives: params.alternatives,
				reasoning: params.reasoning,
				confidence: params.confidence,
				contextFactors: params.contextFactors,
				inputContext: params.inputContext,
			}),
		});

		this.log("Recorded decision", {
			agent: params.agent,
			type: params.type,
			chosen: params.chosen,
			confidence: params.confidence,
		});
	}

	// ==========================================================================
	// COST TRACKING
	// ==========================================================================

	/**
	 * Record cost for an LLM call or operation
	 *
	 * @example
	 * ```typescript
	 * await tracer.recordCost({
	 *   provider: 'openai',
	 *   model: 'gpt-4',
	 *   inputTokens: 500,
	 *   outputTokens: 200,
	 *   category: 'llm',
	 *   isRetry: false
	 * });
	 * ```
	 */
	async recordCost(params: RecordCostParams): Promise<CostRecord> {
		const totalTokens = params.inputTokens + params.outputTokens;

		// Calculate cost based on known pricing (can be extended)
		const pricing = this.getModelPricing(params.provider, params.model);
		const inputCost =
			(params.inputTokens / 1_000_000) * pricing.inputPricePerMillion;
		const outputCost =
			(params.outputTokens / 1_000_000) * pricing.outputPricePerMillion;
		const totalCost = inputCost + outputCost;

		const costRecord: CostRecord = {
			...params,
			totalTokens,
			category: params.category || "llm",
			inputCost: inputCost.toFixed(6),
			outputCost: outputCost.toFixed(6),
			totalCost: totalCost.toFixed(6),
		};

		this.costs.push(costRecord);

		// Also record as a span if in an active workflow
		if (this.currentWorkflow) {
			const spanId = `cost-${this.costs.length}-${this.generateId()}`;
			const timestamp = new Date().toISOString();

			await this.client.traces.createSpan(this.currentWorkflow.traceId, {
				name: `Cost: ${params.provider}/${params.model}`,
				spanId,
				type: "cost",
				startTime: timestamp,
				endTime: timestamp,
				durationMs: 0,
				metadata: mergeWithContext({
					costRecord,
				}),
			});
		}

		this.log("Recorded cost", {
			provider: params.provider,
			model: params.model,
			totalTokens,
			totalCost: costRecord.totalCost,
		});

		return costRecord;
	}

	/**
	 * Get total cost for the current workflow
	 */
	getTotalCost(): number {
		return this.costs.reduce(
			(sum, cost) => sum + parseFloat(cost.totalCost),
			0,
		);
	}

	/**
	 * Get cost breakdown by category
	 */
	getCostBreakdown(): Record<CostCategory, number> {
		const breakdown: Record<CostCategory, number> = {
			llm: 0,
			tool: 0,
			embedding: 0,
			other: 0,
		};

		for (const cost of this.costs) {
			const category = cost.category || "other";
			breakdown[category] += parseFloat(cost.totalCost);
		}

		return breakdown;
	}

	// ==========================================================================
	// UTILITY METHODS
	// ==========================================================================

	/**
	 * Get known pricing for a model (can be extended or fetched from API)
	 */
	private getModelPricing(
		provider: string,
		model: string,
	): { inputPricePerMillion: number; outputPricePerMillion: number } {
		// Default pricing (can be extended with API lookup)
		const knownPricing: Record<
			string,
			{ inputPricePerMillion: number; outputPricePerMillion: number }
		> = {
			// OpenAI
			"openai/gpt-4": {
				inputPricePerMillion: 30.0,
				outputPricePerMillion: 60.0,
			},
			"openai/gpt-4-turbo": {
				inputPricePerMillion: 10.0,
				outputPricePerMillion: 30.0,
			},
			"openai/gpt-4o": {
				inputPricePerMillion: 5.0,
				outputPricePerMillion: 15.0,
			},
			"openai/gpt-4o-mini": {
				inputPricePerMillion: 0.15,
				outputPricePerMillion: 0.6,
			},
			"openai/gpt-3.5-turbo": {
				inputPricePerMillion: 0.5,
				outputPricePerMillion: 1.5,
			},
			// Anthropic
			"anthropic/claude-3-opus": {
				inputPricePerMillion: 15.0,
				outputPricePerMillion: 75.0,
			},
			"anthropic/claude-3-sonnet": {
				inputPricePerMillion: 3.0,
				outputPricePerMillion: 15.0,
			},
			"anthropic/claude-3-haiku": {
				inputPricePerMillion: 0.25,
				outputPricePerMillion: 1.25,
			},
			"anthropic/claude-3.5-sonnet": {
				inputPricePerMillion: 3.0,
				outputPricePerMillion: 15.0,
			},
			// Google
			"google/gemini-pro": {
				inputPricePerMillion: 0.5,
				outputPricePerMillion: 1.5,
			},
			"google/gemini-1.5-pro": {
				inputPricePerMillion: 3.5,
				outputPricePerMillion: 10.5,
			},
			"google/gemini-1.5-flash": {
				inputPricePerMillion: 0.075,
				outputPricePerMillion: 0.3,
			},
		};

		const key = `${provider}/${model}`;
		return (
			knownPricing[key] || {
				inputPricePerMillion: 1.0,
				outputPricePerMillion: 3.0,
			}
		);
	}

	/**
	 * Generate a unique ID
	 */
	private generateId(): string {
		return Math.random().toString(36).substring(2, 11);
	}

	/**
	 * Log if debug mode is enabled
	 */
	private log(message: string, data?: Record<string, unknown>): void {
		if (this.options.debug) {
			console.log(`[WorkflowTracer] ${message}`, data || "");
		}
	}

	/**
	 * Get current workflow context
	 */
	getCurrentWorkflow(): WorkflowContext | null {
		return this.currentWorkflow;
	}

	/**
	 * Check if a workflow is active
	 */
	isWorkflowActive(): boolean {
		return this.currentWorkflow !== null;
	}

	/**
	 * Get all recorded handoffs
	 */
	getHandoffs(): AgentHandoff[] {
		return [...this.handoffs];
	}

	/**
	 * Get all recorded decisions
	 */
	getDecisions(): RecordDecisionParams[] {
		return [...this.decisions];
	}

	/**
	 * Get all recorded costs
	 */
	getCosts(): CostRecord[] {
		return [...this.costs];
	}
}

// ============================================================================
// FRAMEWORK INTEGRATIONS
// ============================================================================

/**
 * Wrap a LangChain agent for automatic workflow tracing
 *
 * @example
 * ```typescript
 * import { AgentExecutor } from 'langchain/agents';
 *
 * const executor = new AgentExecutor({ ... });
 * const tracedExecutor = traceLangChainAgent(executor, tracer);
 *
 * const result = await tracedExecutor.invoke({ input: 'Hello' });
 * ```
 */
export function traceLangChainAgent(
	executor: LangChainExecutor,
	tracer: WorkflowTracer,
	options: { agentName?: string } = {},
): LangChainExecutor {
	const agentName = options.agentName || "LangChainAgent";

	const originalInvoke = executor.invoke?.bind(executor);
	const originalCall = executor.call?.bind(executor);

	if (originalInvoke) {
		executor.invoke = async (input: unknown, config?: unknown) => {
			const span = await tracer.startAgentSpan(agentName, { input });
			try {
				const result = await originalInvoke(input, config);
				await tracer.endAgentSpan(span, { output: result });
				return result;
			} catch (error) {
				await tracer.endAgentSpan(
					span,
					undefined,
					error instanceof Error ? error.message : String(error),
				);
				throw error;
			}
		};
	}

	if (originalCall) {
		executor.call = async (input: unknown, config?: unknown) => {
			const span = await tracer.startAgentSpan(agentName, { input });
			try {
				const result = await originalCall(input, config);
				await tracer.endAgentSpan(span, { output: result });
				return result;
			} catch (error) {
				await tracer.endAgentSpan(
					span,
					undefined,
					error instanceof Error ? error.message : String(error),
				);
				throw error;
			}
		};
	}

	return executor;
}

/**
 * Create a traced wrapper for CrewAI crews
 *
 * @example
 * ```typescript
 * const tracedCrew = traceCrewAI(crew, tracer, {
 *   crewName: 'ResearchCrew'
 * });
 *
 * const result = await tracedCrew.kickoff({ topic: 'AI Safety' });
 * ```
 */
export function traceCrewAI(
	crew: CrewAI,
	tracer: WorkflowTracer,
	options: { crewName?: string } = {},
): CrewAI {
	const crewName = options.crewName || "CrewAI";

	const originalKickoff = crew.kickoff?.bind(crew);

	if (originalKickoff) {
		crew.kickoff = async (input?: unknown) => {
			await tracer.startWorkflow(`${crewName} Execution`);
			const span = await tracer.startAgentSpan(crewName, { input });

			try {
				const result = await originalKickoff(input);
				await tracer.endAgentSpan(span, { output: result });
				await tracer.endWorkflow({ result }, "completed");
				return result;
			} catch (error) {
				await tracer.endAgentSpan(
					span,
					undefined,
					error instanceof Error ? error.message : String(error),
				);
				await tracer.endWorkflow(
					{ error: error instanceof Error ? error.message : String(error) },
					"failed",
				);
				throw error;
			}
		};
	}

	return crew;
}

/**
 * Create a traced wrapper for AutoGen conversations
 *
 * @example
 * ```typescript
 * const tracedConversation = traceAutoGen(conversation, tracer, {
 *   conversationName: 'CodeReview'
 * });
 * ```
 */
export function traceAutoGen(
	conversation: LangChainConversation,
	tracer: WorkflowTracer,
	options: { conversationName?: string } = {},
): LangChainConversation {
	const conversationName = options.conversationName || "AutoGenConversation";

	const originalInitiateChat = conversation.initiate_chat?.bind(conversation);

	if (originalInitiateChat) {
		conversation.initiate_chat = async (...args: unknown[]) => {
			await tracer.startWorkflow(`${conversationName}`);
			const span = await tracer.startAgentSpan(conversationName, { args });

			try {
				const result = await originalInitiateChat(...args);
				await tracer.endAgentSpan(span, { output: result });
				await tracer.endWorkflow({ result }, "completed");
				return result;
			} catch (error) {
				await tracer.endAgentSpan(
					span,
					undefined,
					error instanceof Error ? error.message : String(error),
				);
				await tracer.endWorkflow(
					{ error: error instanceof Error ? error.message : String(error) },
					"failed",
				);
				throw error;
			}
		};
	}

	return conversation;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a workflow tracer from an existing client
 */
export function createWorkflowTracer(
	client: AIEvalClient,
	options?: WorkflowTracerOptions,
): WorkflowTracer {
	return new WorkflowTracer(client, options);
}

/**
 * Helper to trace an async function as a workflow step
 */
export async function traceWorkflowStep<T>(
	tracer: WorkflowTracer,
	agentName: string,
	fn: () => Promise<T>,
	input?: Record<string, unknown>,
): Promise<T> {
	const span = await tracer.startAgentSpan(agentName, input);
	try {
		const result = await fn();
		await tracer.endAgentSpan(span, { result });
		return result;
	} catch (error) {
		await tracer.endAgentSpan(
			span,
			undefined,
			error instanceof Error ? error.message : String(error),
		);
		throw error;
	}
}
