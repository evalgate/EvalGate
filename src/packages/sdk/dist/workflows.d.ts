/**
 * Workflow Tracer SDK
 * Multi-agent workflow instrumentation, decision tracking, and cost capture
 *
 * @example
 * ```typescript
 * import { WorkflowTracer } from '@pauly4010/evalai-sdk';
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
/**
 * Node in a workflow DAG
 */
export interface WorkflowNode {
    id: string;
    type: "agent" | "tool" | "decision" | "parallel" | "human" | "llm";
    name: string;
    config?: Record<string, any>;
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
    metadata?: Record<string, any>;
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
    metadata?: Record<string, any>;
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
    context?: Record<string, any>;
    timestamp: string;
}
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
    inputContext?: Record<string, any>;
}
/**
 * LLM provider names
 */
export type LLMProvider = "openai" | "anthropic" | "google" | "cohere" | "mistral" | "custom";
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
/**
 * Agent span context
 */
export interface AgentSpanContext {
    spanId: string;
    agentName: string;
    startTime: string;
    parentSpanId?: string;
    metadata?: Record<string, any>;
}
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
export declare class WorkflowTracer {
    private client;
    private options;
    private currentWorkflow;
    private activeSpans;
    private handoffs;
    private decisions;
    private costs;
    private spanCounter;
    constructor(client: AIEvalClient, options?: WorkflowTracerOptions);
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
    startWorkflow(name: string, definition?: WorkflowDefinition, metadata?: Record<string, any>): Promise<WorkflowContext>;
    /**
     * End the current workflow
     */
    endWorkflow(output?: Record<string, any>, status?: WorkflowStatus): Promise<void>;
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
    startAgentSpan(agentName: string, input?: Record<string, any>, parentSpanId?: string): Promise<AgentSpanContext>;
    /**
     * End an agent span
     */
    endAgentSpan(span: AgentSpanContext, output?: Record<string, any>, error?: string): Promise<void>;
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
    recordHandoff(fromAgent: string | undefined, toAgent: string, context?: Record<string, any>, handoffType?: HandoffType): Promise<void>;
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
    recordDecision(params: RecordDecisionParams): Promise<void>;
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
    recordCost(params: RecordCostParams): Promise<CostRecord>;
    /**
     * Get total cost for the current workflow
     */
    getTotalCost(): number;
    /**
     * Get cost breakdown by category
     */
    getCostBreakdown(): Record<CostCategory, number>;
    /**
     * Get known pricing for a model (can be extended or fetched from API)
     */
    private getModelPricing;
    /**
     * Generate a unique ID
     */
    private generateId;
    /**
     * Log if debug mode is enabled
     */
    private log;
    /**
     * Get current workflow context
     */
    getCurrentWorkflow(): WorkflowContext | null;
    /**
     * Check if a workflow is active
     */
    isWorkflowActive(): boolean;
    /**
     * Get all recorded handoffs
     */
    getHandoffs(): AgentHandoff[];
    /**
     * Get all recorded decisions
     */
    getDecisions(): RecordDecisionParams[];
    /**
     * Get all recorded costs
     */
    getCosts(): CostRecord[];
}
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
export declare function traceLangChainAgent(executor: any, tracer: WorkflowTracer, options?: {
    agentName?: string;
}): any;
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
export declare function traceCrewAI(crew: any, tracer: WorkflowTracer, options?: {
    crewName?: string;
}): any;
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
export declare function traceAutoGen(conversation: any, tracer: WorkflowTracer, options?: {
    conversationName?: string;
}): any;
/**
 * Create a workflow tracer from an existing client
 */
export declare function createWorkflowTracer(client: AIEvalClient, options?: WorkflowTracerOptions): WorkflowTracer;
/**
 * Helper to trace an async function as a workflow step
 */
export declare function traceWorkflowStep<T>(tracer: WorkflowTracer, agentName: string, fn: () => Promise<T>, input?: Record<string, any>): Promise<T>;
