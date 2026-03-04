"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowTracer = void 0;
exports.traceLangChainAgent = traceLangChainAgent;
exports.traceCrewAI = traceCrewAI;
exports.traceAutoGen = traceAutoGen;
exports.createWorkflowTracer = createWorkflowTracer;
exports.traceWorkflowStep = traceWorkflowStep;
const fs = __importStar(require("node:fs"));
const nodePath = __importStar(require("node:path"));
const context_1 = require("./context");
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
class WorkflowTracer {
    constructor(client, options = {}) {
        this.currentWorkflow = null;
        this.activeSpans = new Map();
        this.handoffs = [];
        this.decisions = [];
        this.costs = [];
        this.spanCounter = 0;
        this.client = client;
        const resolvedOrgId = options.organizationId ??
            (typeof client?.getOrganizationId === "function"
                ? client.getOrganizationId()
                : undefined) ??
            0;
        this.options = {
            organizationId: resolvedOrgId,
            autoCalculateCost: options.autoCalculateCost ?? true,
            tracePrefix: options.tracePrefix || "workflow",
            captureFullPayloads: options.captureFullPayloads ?? true,
            debug: options.debug ?? false,
            offline: options.offline ?? false,
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
    async startWorkflow(name, definition, metadata) {
        if (this.currentWorkflow) {
            throw new Error("A workflow is already active. Call endWorkflow() first.");
        }
        const traceId = `${this.options.tracePrefix}-${Date.now()}-${this.generateId()}`;
        const startedAt = new Date().toISOString();
        // Create the trace (skip in offline mode)
        let traceResultId = 0;
        if (!this.options.offline) {
            const trace = await this.client.traces.create({
                name: `Workflow: ${name}`,
                traceId,
                organizationId: this.options.organizationId,
                status: "pending",
                metadata: (0, context_1.mergeWithContext)({
                    workflowName: name,
                    definition,
                    ...metadata,
                }),
            });
            traceResultId = trace.id;
        }
        const workflow = {
            id: 0,
            traceId: traceResultId,
            name,
            startedAt,
            definition,
            metadata,
        };
        this.currentWorkflow = workflow;
        // Reset state
        this.handoffs = [];
        this.decisions = [];
        this.costs = [];
        this.activeSpans.clear();
        this.spanCounter = 0;
        this.log("Started workflow", { name, traceId: traceResultId });
        return workflow;
    }
    /**
     * End the current workflow
     */
    async endWorkflow(output, status = "completed") {
        if (!this.currentWorkflow) {
            throw new Error("No active workflow. Call startWorkflow() first.");
        }
        const durationMs = Date.now() - new Date(this.currentWorkflow.startedAt).getTime();
        // Calculate total cost
        const totalCost = this.costs.reduce((sum, cost) => sum + parseFloat(cost.totalCost), 0);
        // Update the original trace with completion data (skip in offline mode)
        if (!this.options.offline) {
            await this.client.traces.update(this.currentWorkflow.traceId, {
                status: status === "completed" ? "success" : "error",
                durationMs,
                metadata: (0, context_1.mergeWithContext)({
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
        }
        // In offline mode, persist workflow data to local filesystem
        if (this.options.offline) {
            try {
                const dataDir = nodePath.resolve(".evalgate-data", "workflows");
                fs.mkdirSync(dataDir, { recursive: true });
                const fileName = `${this.currentWorkflow.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}.json`;
                const workflowData = {
                    name: this.currentWorkflow.name,
                    startedAt: this.currentWorkflow.startedAt,
                    endedAt: new Date().toISOString(),
                    status,
                    durationMs,
                    totalCost: totalCost.toFixed(6),
                    handoffs: this.handoffs,
                    decisions: this.decisions,
                    costs: this.costs,
                    output,
                    metadata: this.currentWorkflow.metadata,
                    definition: this.currentWorkflow.definition,
                };
                fs.writeFileSync(nodePath.join(dataDir, fileName), JSON.stringify(workflowData, null, 2));
                this.log("Saved workflow to local filesystem", {
                    path: nodePath.join(dataDir, fileName),
                });
            }
            catch (err) {
                this.log("Failed to save workflow to local filesystem", {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
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
    async startAgentSpan(agentName, input, parentSpanId) {
        if (!this.currentWorkflow) {
            throw new Error("No active workflow. Call startWorkflow() first.");
        }
        const spanId = `span-${++this.spanCounter}-${this.generateId()}`;
        const startTime = new Date().toISOString();
        const spanContext = {
            spanId,
            agentName,
            startTime,
            parentSpanId,
            metadata: input,
        };
        this.activeSpans.set(spanId, spanContext);
        // Create span via API (skip in offline mode)
        if (!this.options.offline) {
            await this.client.traces.createSpan(this.currentWorkflow.traceId, {
                name: `Agent: ${agentName}`,
                spanId,
                type: "agent",
                parentSpanId,
                startTime,
                metadata: (0, context_1.mergeWithContext)({
                    agentName,
                    ...(this.options.captureFullPayloads ? { input } : {}),
                }),
            });
        }
        this.log("Started agent span", { agentName, spanId });
        return spanContext;
    }
    /**
     * End an agent span
     */
    async endAgentSpan(span, output, error) {
        if (!this.currentWorkflow) {
            throw new Error("No active workflow.");
        }
        const endTime = new Date().toISOString();
        const durationMs = new Date(endTime).getTime() - new Date(span.startTime).getTime();
        // Update span via API (skip in offline mode)
        if (!this.options.offline) {
            await this.client.traces.createSpan(this.currentWorkflow.traceId, {
                name: `Agent: ${span.agentName}`,
                spanId: `${span.spanId}-end`,
                type: "agent",
                parentSpanId: span.spanId,
                startTime: span.startTime,
                endTime,
                durationMs,
                metadata: (0, context_1.mergeWithContext)({
                    agentName: span.agentName,
                    ...(this.options.captureFullPayloads ? { output } : {}),
                    ...(error ? { error } : {}),
                }),
            });
        }
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
    async recordHandoff(fromAgent, toAgent, context, handoffType = "delegation") {
        if (!this.currentWorkflow) {
            throw new Error("No active workflow. Call startWorkflow() first.");
        }
        const handoff = {
            fromAgent,
            toAgent,
            handoffType,
            context,
            timestamp: new Date().toISOString(),
        };
        this.handoffs.push(handoff);
        // Also create a span for the handoff (skip in offline mode)
        if (!this.options.offline) {
            const spanId = `handoff-${this.handoffs.length}-${this.generateId()}`;
            await this.client.traces.createSpan(this.currentWorkflow.traceId, {
                name: `Handoff: ${fromAgent || "start"} → ${toAgent}`,
                spanId,
                type: "handoff",
                startTime: handoff.timestamp,
                endTime: handoff.timestamp,
                durationMs: 0,
                metadata: (0, context_1.mergeWithContext)({
                    handoffType,
                    fromAgent,
                    toAgent,
                    context,
                }),
            });
        }
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
    async recordDecision(params) {
        if (!this.currentWorkflow) {
            throw new Error("No active workflow. Call startWorkflow() first.");
        }
        this.decisions.push(params);
        // Create a span for the decision (skip in offline mode)
        if (!this.options.offline) {
            const spanId = `decision-${this.decisions.length}-${this.generateId()}`;
            const timestamp = new Date().toISOString();
            await this.client.traces.createSpan(this.currentWorkflow.traceId, {
                name: `Decision: ${params.agent} chose ${params.chosen}`,
                spanId,
                type: "decision",
                startTime: timestamp,
                endTime: timestamp,
                durationMs: 0,
                metadata: (0, context_1.mergeWithContext)({
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
        }
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
    async recordCost(params) {
        const totalTokens = params.inputTokens + params.outputTokens;
        // Calculate cost based on known pricing (can be extended)
        const pricing = this.getModelPricing(params.provider, params.model);
        const inputCost = (params.inputTokens / 1000000) * pricing.inputPricePerMillion;
        const outputCost = (params.outputTokens / 1000000) * pricing.outputPricePerMillion;
        const totalCost = inputCost + outputCost;
        const costRecord = {
            ...params,
            totalTokens,
            category: params.category || "llm",
            inputCost: inputCost.toFixed(6),
            outputCost: outputCost.toFixed(6),
            totalCost: totalCost.toFixed(6),
        };
        this.costs.push(costRecord);
        // Also record as a span if in an active workflow (skip in offline mode)
        if (this.currentWorkflow && !this.options.offline) {
            const spanId = `cost-${this.costs.length}-${this.generateId()}`;
            const timestamp = new Date().toISOString();
            await this.client.traces.createSpan(this.currentWorkflow.traceId, {
                name: `Cost: ${params.provider}/${params.model}`,
                spanId,
                type: "cost",
                startTime: timestamp,
                endTime: timestamp,
                durationMs: 0,
                metadata: (0, context_1.mergeWithContext)({
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
    getTotalCost() {
        return this.costs.reduce((sum, cost) => sum + parseFloat(cost.totalCost), 0);
    }
    /**
     * Get cost breakdown by category
     */
    getCostBreakdown() {
        const breakdown = {
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
    getModelPricing(provider, model) {
        // Default pricing (can be extended with API lookup)
        const knownPricing = {
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
        return (knownPricing[key] || {
            inputPricePerMillion: 1.0,
            outputPricePerMillion: 3.0,
        });
    }
    /**
     * Generate a unique ID
     */
    generateId() {
        return Math.random().toString(36).substring(2, 11);
    }
    /**
     * Log if debug mode is enabled
     */
    log(message, data) {
        if (this.options.debug) {
            console.log(`[WorkflowTracer] ${message}`, data || "");
        }
    }
    /**
     * Get current workflow context
     */
    getCurrentWorkflow() {
        return this.currentWorkflow;
    }
    /**
     * Check if a workflow is active
     */
    isWorkflowActive() {
        return this.currentWorkflow !== null;
    }
    /**
     * Get all recorded handoffs
     */
    getHandoffs() {
        return [...this.handoffs];
    }
    /**
     * Get all recorded decisions
     */
    getDecisions() {
        return [...this.decisions];
    }
    /**
     * Get all recorded costs
     */
    getCosts() {
        return [...this.costs];
    }
}
exports.WorkflowTracer = WorkflowTracer;
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
function traceLangChainAgent(executor, tracer, options = {}) {
    const agentName = options.agentName || "LangChainAgent";
    const originalInvoke = executor.invoke?.bind(executor);
    const originalCall = executor.call?.bind(executor);
    if (originalInvoke) {
        executor.invoke = async (input, config) => {
            const span = await tracer.startAgentSpan(agentName, { input });
            try {
                const result = await originalInvoke(input, config);
                await tracer.endAgentSpan(span, { output: result });
                return result;
            }
            catch (error) {
                await tracer.endAgentSpan(span, undefined, error instanceof Error ? error.message : String(error));
                throw error;
            }
        };
    }
    if (originalCall) {
        executor.call = async (input, config) => {
            const span = await tracer.startAgentSpan(agentName, { input });
            try {
                const result = await originalCall(input, config);
                await tracer.endAgentSpan(span, { output: result });
                return result;
            }
            catch (error) {
                await tracer.endAgentSpan(span, undefined, error instanceof Error ? error.message : String(error));
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
function traceCrewAI(crew, tracer, options = {}) {
    const crewName = options.crewName || "CrewAI";
    const originalKickoff = crew.kickoff?.bind(crew);
    if (originalKickoff) {
        crew.kickoff = async (input) => {
            await tracer.startWorkflow(`${crewName} Execution`);
            const span = await tracer.startAgentSpan(crewName, { input });
            try {
                const result = await originalKickoff(input);
                await tracer.endAgentSpan(span, { output: result });
                await tracer.endWorkflow({ result }, "completed");
                return result;
            }
            catch (error) {
                await tracer.endAgentSpan(span, undefined, error instanceof Error ? error.message : String(error));
                await tracer.endWorkflow({ error: error instanceof Error ? error.message : String(error) }, "failed");
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
function traceAutoGen(conversation, tracer, options = {}) {
    const conversationName = options.conversationName || "AutoGenConversation";
    const originalInitiateChat = conversation.initiate_chat?.bind(conversation);
    if (originalInitiateChat) {
        conversation.initiate_chat = async (...args) => {
            await tracer.startWorkflow(`${conversationName}`);
            const span = await tracer.startAgentSpan(conversationName, { args });
            try {
                const result = await originalInitiateChat(...args);
                await tracer.endAgentSpan(span, { output: result });
                await tracer.endWorkflow({ result }, "completed");
                return result;
            }
            catch (error) {
                await tracer.endAgentSpan(span, undefined, error instanceof Error ? error.message : String(error));
                await tracer.endWorkflow({ error: error instanceof Error ? error.message : String(error) }, "failed");
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
function createWorkflowTracer(client, options) {
    return new WorkflowTracer(client, options);
}
/**
 * Helper to trace an async function as a workflow step
 */
async function traceWorkflowStep(tracer, agentName, fn, input) {
    const span = await tracer.startAgentSpan(agentName, input);
    try {
        const result = await fn();
        await tracer.endAgentSpan(span, { result });
        return result;
    }
    catch (error) {
        await tracer.endAgentSpan(span, undefined, error instanceof Error ? error.message : String(error));
        throw error;
    }
}
