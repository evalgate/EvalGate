/**
 * LangChain Integration Example
 * Demonstrates how to integrate EvalAI workflow tracing with LangChain agents
 *
 * This example shows:
 * - Automatic tracing of LangChain agent executions
 * - Decision auditing for agent routing
 * - Cost tracking per LLM call
 * - Human-in-the-loop escalation
 */

import { AIEvalClient } from "@evalgate/sdk";
import { traceLangChainAgent, WorkflowTracer } from "@evalgate/sdk/workflows";
import { CompliancePresets, GovernanceEngine } from "@/lib/governance/rules";
import { executeWithRetry } from "@/lib/workflows/retry";

// ============================================================================
// SETUP
// ============================================================================

/**
 * Initialize the EvalAI client and tracer
 */
export function initializeEvalAI(config: {
	apiKey: string;
	organizationId?: number;
	debug?: boolean;
}) {
	const client = new AIEvalClient({
		apiKey: config.apiKey,
	});

	const tracer = new WorkflowTracer(client, {
		organizationId: config.organizationId,
		debug: config.debug ?? false,
		captureFullPayloads: true,
	});

	return { client, tracer };
}

// ============================================================================
// LANGCHAIN CALLBACK HANDLER
// ============================================================================

/**
 * Custom callback handler for LangChain that integrates with EvalAI
 *
 * @example
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { AgentExecutor } from 'langchain/agents';
 *
 * const { tracer } = initializeEvalAI({ apiKey: process.env.EVALAI_API_KEY });
 *
 * const model = new ChatOpenAI({
 *   modelName: 'gpt-4',
 *   callbacks: [createEvalAICallback(tracer)]
 * });
 * ```
 */
export function createEvalAICallback(tracer: WorkflowTracer) {
	return {
		handleLLMStart: async (llm: unknown, prompts: string[]) => {
			// Track LLM call start
			const span = await tracer.startAgentSpan("LLM", {
				model: llm.modelName || llm.model || "unknown",
				prompts: prompts.slice(0, 1), // Capture first prompt
			});
			return span;
		},

		handleLLMEnd: async (output: unknown, _runId: string) => {
			// Track token usage and cost
			if (output.llmOutput?.tokenUsage) {
				await tracer.recordCost({
					provider: "openai",
					model: output.llmOutput.modelName || "gpt-4",
					inputTokens: output.llmOutput.tokenUsage.promptTokens || 0,
					outputTokens: output.llmOutput.tokenUsage.completionTokens || 0,
					category: "llm",
				});
			}
		},

		handleChainStart: async (chain: unknown, inputs: unknown) => {
			return await tracer.startAgentSpan(chain.name || "Chain", { inputs });
		},

		handleChainEnd: async (_outputs: unknown) => {
			// Chain completed
		},

		handleToolStart: async (tool: unknown, input: string) => {
			return await tracer.startAgentSpan(`Tool: ${tool.name}`, { input });
		},

		handleToolEnd: async (_output: string) => {
			// Tool completed
		},

		handleAgentAction: async (action: unknown) => {
			// Record agent decision
			await tracer.recordDecision({
				agent: "LangChainAgent",
				type: "tool",
				chosen: action.tool,
				alternatives: [], // LangChain doesn't expose alternatives
				reasoning: action.log || "Agent selected tool",
				confidence: 80,
			});
		},
	};
}

// ============================================================================
// TRACED AGENT EXAMPLE
// ============================================================================

/**
 * Example: Customer Support Agent with full tracing
 *
 * @example
 * ```typescript
 * const result = await runCustomerSupportAgent(
 *   'How do I reset my password?',
 *   { apiKey: process.env.EVALAI_API_KEY }
 * );
 * ```
 */
export async function runCustomerSupportAgent(
	query: string,
	config: {
		apiKey: string;
		organizationId?: number;
	},
) {
	const { tracer } = initializeEvalAI(config);

	// Initialize governance
	const governance = new GovernanceEngine(CompliancePresets.SOC2);

	// Start workflow
	await tracer.startWorkflow("Customer Support Agent", {
		nodes: [
			{ id: "router", type: "agent", name: "RouterAgent" },
			{ id: "technical", type: "agent", name: "TechnicalSupport" },
			{ id: "billing", type: "agent", name: "BillingSupport" },
			{ id: "general", type: "agent", name: "GeneralSupport" },
		],
		edges: [
			{ from: "router", to: "technical", condition: "is_technical" },
			{ from: "router", to: "billing", condition: "is_billing" },
			{ from: "router", to: "general", condition: "is_general" },
		],
		entrypoint: "router",
	});

	try {
		// Router agent decides which specialist to use
		const routerSpan = await tracer.startAgentSpan("RouterAgent", { query });

		// Simulate routing decision
		const routingDecision = classifyQuery(query);

		await tracer.recordDecision({
			agent: "RouterAgent",
			type: "route",
			chosen: routingDecision.route,
			alternatives: routingDecision.alternatives,
			reasoning: routingDecision.reasoning,
			confidence: routingDecision.confidence,
		});

		// Check governance
		const governanceResult = governance.evaluate({
			agentName: "RouterAgent",
			decisionType: "route",
			chosen: routingDecision.route,
			confidence: routingDecision.confidence / 100,
			alternatives: routingDecision.alternatives,
			context: { sensitiveData: query.toLowerCase().includes("password") },
		});

		if (governanceResult.blocked) {
			throw new Error(
				`Execution blocked: ${governanceResult.reasons.join(", ")}`,
			);
		}

		await tracer.endAgentSpan(routerSpan, { route: routingDecision.route });

		// Handoff to specialist
		await tracer.recordHandoff("RouterAgent", routingDecision.route, {
			query,
			confidence: routingDecision.confidence,
		});

		// Execute specialist agent with retry
		const result = await executeWithRetry(
			async () => {
				const specialistSpan = await tracer.startAgentSpan(
					routingDecision.route,
					{ query },
				);

				// Simulate specialist response
				const response = await simulateSpecialistResponse(
					routingDecision.route,
					query,
				);

				await tracer.endAgentSpan(specialistSpan, { response });
				return response;
			},
			{
				maxRetries: 3,
				escalateOnFailure: governanceResult.requiresApproval,
			},
			tracer,
		);

		await tracer.endWorkflow({ result: result.result }, "completed");

		return {
			success: true,
			response: result.result,
			route: routingDecision.route,
			governanceResult,
		};
	} catch (error) {
		await tracer.endWorkflow(
			{ error: error instanceof Error ? error.message : String(error) },
			"failed",
		);
		throw error;
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function classifyQuery(query: string): {
	route: string;
	confidence: number;
	reasoning: string;
	alternatives: Array<{
		action: string;
		confidence: number;
		reasoning?: string;
	}>;
} {
	const lowerQuery = query.toLowerCase();

	if (
		lowerQuery.includes("password") ||
		lowerQuery.includes("login") ||
		lowerQuery.includes("api")
	) {
		return {
			route: "TechnicalSupport",
			confidence: 85,
			reasoning: "Query contains technical keywords (password, login, api)",
			alternatives: [
				{
					action: "GeneralSupport",
					confidence: 0.1,
					reasoning: "Could be general inquiry",
				},
				{
					action: "BillingSupport",
					confidence: 0.05,
					reasoning: "Unlikely billing issue",
				},
			],
		};
	}

	if (
		lowerQuery.includes("bill") ||
		lowerQuery.includes("payment") ||
		lowerQuery.includes("charge")
	) {
		return {
			route: "BillingSupport",
			confidence: 90,
			reasoning: "Query contains billing keywords (bill, payment, charge)",
			alternatives: [
				{
					action: "GeneralSupport",
					confidence: 0.08,
					reasoning: "Could be general inquiry",
				},
				{
					action: "TechnicalSupport",
					confidence: 0.02,
					reasoning: "Unlikely technical issue",
				},
			],
		};
	}

	return {
		route: "GeneralSupport",
		confidence: 70,
		reasoning: "No specific keywords detected, routing to general support",
		alternatives: [
			{
				action: "TechnicalSupport",
				confidence: 0.2,
				reasoning: "Could be technical",
			},
			{
				action: "BillingSupport",
				confidence: 0.1,
				reasoning: "Could be billing",
			},
		],
	};
}

async function simulateSpecialistResponse(
	route: string,
	_query: string,
): Promise<string> {
	// Simulate API latency
	await new Promise((resolve) => setTimeout(resolve, 100));

	const responses: Record<string, string> = {
		TechnicalSupport: `I can help you with that technical issue. For password resets, please visit your account settings page.`,
		BillingSupport: `I'd be happy to help with your billing inquiry. Let me look up your account details.`,
		GeneralSupport: `Thank you for reaching out! I'll do my best to assist you with your question.`,
	};

	return responses[route] || "How can I help you today?";
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
	traceLangChainAgent,
	WorkflowTracer,
	GovernanceEngine,
	executeWithRetry,
};
