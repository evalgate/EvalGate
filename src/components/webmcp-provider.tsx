"use client";

import { useEffect, useRef } from "react";

// Extend Navigator interface for WebMCP
declare global {
	interface Navigator {
		modelContext?: {
			registerTool(tool: WebMCPTool): () => void;
		};
	}
}

interface WebMCPTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (params: unknown) => Promise<unknown>;
}

/** Fetch wrapper with error handling for all WebMCP tools */
async function safeFetch(url: string, init?: RequestInit): Promise<unknown> {
	const response = await fetch(url, init);
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
	}
	return response.json();
}

/**
 * WebMCP Provider — registers AI-discoverable tool contracts via navigator.modelContext
 * These allow AI agents to interact with the evaluation platform through structured APIs
 */
export function WebMCPProvider() {
	const unregisterFns = useRef<(() => void)[]>([]);

	useEffect(() => {
		if (!navigator.modelContext) {
			return; // WebMCP not supported in this browser
		}

		const tools: WebMCPTool[] = [
			{
				name: "list_evaluation_templates",
				description:
					"EvalAI: List evaluation templates for testing AI models. Returns templates from the quick-start library (6) and full catalog (50+ across 17 categories: unit_tests, adversarial, human_eval, llm_judge, chatbot, rag, code-gen, etc.) with configurations and test cases.",
				inputSchema: {
					type: "object",
					properties: {
						category: {
							type: "string",
							description:
								"Filter by template category (e.g., unit_tests, adversarial, human_eval, llm_judge, agent_eval, chatbot, rag, code-gen)",
						},
						limit: {
							type: "number",
							description:
								"Maximum number of templates to return (default: all)",
						},
					},
				},
				execute: async (params: unknown) => {
					const typedParams = params as { category?: string; limit?: number };
					const searchParams = new URLSearchParams();
					if (typedParams.category)
						searchParams.set("category", typedParams.category);
					if (typedParams.limit)
						searchParams.set("limit", typedParams.limit.toString());
					const query = searchParams.toString();
					const url = query
						? `/api/evaluation-templates?${query}`
						: "/api/evaluation-templates";
					return safeFetch(url);
				},
			},
			{
				name: "get_evaluation_test_cases",
				description:
					"EvalAI: Get test cases for an evaluation. Returns test cases for the specified evaluation ID.",
				inputSchema: {
					type: "object",
					properties: {
						evaluationId: {
							type: "number",
							description: "ID of the evaluation",
						},
						limit: {
							type: "number",
							description:
								"Maximum number of test cases to return (default: all)",
						},
					},
					required: ["evaluationId"],
				},
				execute: async (params: unknown) => {
					const typedParams = params as {
						evaluationId: number;
						limit?: number;
					};
					const searchParams = new URLSearchParams();
					if (typedParams.limit)
						searchParams.set("limit", typedParams.limit.toString());
					const query = searchParams.toString();
					const url = query
						? `/api/evaluations/${typedParams.evaluationId}/test-cases?${query}`
						: `/api/evaluations/${typedParams.evaluationId}/test-cases`;
					return safeFetch(url);
				},
			},
			{
				name: "create_evaluation",
				description:
					"EvalAI: Create an evaluation for testing an AI model. Types: unit_test (assertions), human_eval (expert annotation), model_eval (LLM-as-judge), ab_test. Provide name, type, optional description and test cases. Requires user to be signed in.",
				inputSchema: {
					type: "object",
					properties: {
						name: { type: "string", description: "Name of the evaluation" },
						type: {
							type: "string",
							enum: ["unit_test", "human_eval", "model_eval", "ab_test"],
							description: "Type of evaluation to create",
						},
						description: {
							type: "string",
							description: "Description of what this evaluation tests",
						},
						testCases: {
							type: "array",
							items: {
								type: "object",
								properties: {
									name: { type: "string" },
									input: { type: "string" },
									expectedOutput: { type: "string" },
								},
							},
							description: "Optional test cases to include",
						},
					},
					required: ["name", "type"],
				},
				execute: async (params: unknown) => {
					return safeFetch("/api/evaluations", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(params),
					});
				},
			},
			{
				name: "run_evaluation",
				description:
					"EvalAI: Execute an evaluation run. Fetches test cases, runs them (unit assertions, LLM judge, or marks for human review), and computes pass/fail and scores. Requires user to be signed in.",
				inputSchema: {
					type: "object",
					properties: {
						evaluationId: {
							type: "number",
							description: "ID of the evaluation to run",
						},
					},
					required: ["evaluationId"],
				},
				execute: async (params: unknown) => {
					const typedParams = params as { evaluationId: number };
					return safeFetch(`/api/evaluations/${typedParams.evaluationId}`);
				},
			},
			{
				name: "get_evaluation_results",
				description:
					"EvalAI: Get evaluation run results—pass/fail counts, per-test-case results, scores, and run status. Requires user to be signed in.",
				inputSchema: {
					type: "object",
					properties: {
						evaluationId: {
							type: "number",
							description: "ID of the evaluation",
						},
						limit: {
							type: "number",
							description: "Maximum number of runs to return (default: 10)",
						},
					},
					required: ["evaluationId"],
				},
				execute: async (params: unknown) => {
					const typedParams = params as {
						evaluationId: number;
						limit?: number;
					};
					const limit = typedParams.limit || 10;
					return safeFetch(
						`/api/evaluations/${typedParams.evaluationId}/runs?limit=${limit}`,
					);
				},
			},
			{
				name: "get_quality_score",
				description:
					"EvalAI: Get quality score from the latest evaluation run—evaluation name, run status, total/passed/failed counts, pass rate. Returns a message to run the evaluation first if no runs exist. Requires user to be signed in.",
				inputSchema: {
					type: "object",
					properties: {
						evaluationId: {
							type: "number",
							description: "ID of the evaluation",
						},
					},
					required: ["evaluationId"],
				},
				execute: async (params: unknown) => {
					const typedParams = params as { evaluationId: number };
					const response = await safeFetch(
						`/api/evaluations/${typedParams.evaluationId}/runs`,
					);
					const runs = Array.isArray(response) ? response : [];
					const latestRun = runs[0] || null;
					return {
						evaluationId: typedParams.evaluationId,
						evaluationName:
							(response as any)?.evaluation?.name ||
							`Evaluation ${typedParams.evaluationId}`,
						score: latestRun?.score || null,
						message: latestRun?.status || "No runs available",
						latestRun: latestRun || undefined,
					};
				},
			},
		];

		// Register all tools
		for (const tool of tools) {
			try {
				const unregister = navigator.modelContext?.registerTool(tool);
				unregisterFns.current.push(unregister);
			} catch (err) {
				console.warn(`[WebMCP] Failed to register tool: ${tool.name}`, err);
			}
		}

		// Cleanup on unmount
		return () => {
			for (const unregister of unregisterFns.current) {
				try {
					unregister();
				} catch {
					// Ignore cleanup errors
				}
			}
			unregisterFns.current = [];
		};
	}, []);

	// This component renders nothing
	return null;
}
