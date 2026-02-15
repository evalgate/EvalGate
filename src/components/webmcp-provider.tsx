'use client';

import { useEffect, useRef } from 'react';

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
  inputSchema: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

/** Fetch wrapper with error handling for all WebMCP tools */
async function safeFetch(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
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
        name: 'list_evaluation_templates',
        description: 'List available evaluation templates for AI model testing. Returns templates from both the quick-start library (6 copy-paste ready) and the full catalog (50+ across 17 categories) with their configurations and test cases.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by template category (e.g., unit_tests, adversarial, human_eval, llm_judge, agent_eval, chatbot, rag, code-gen)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of templates to return (default: all)',
            },
          },
        },
        execute: async (params: { category?: string; limit?: number }) => {
          const searchParams = new URLSearchParams();
          if (params.category) searchParams.set('category', params.category);
          if (params.limit) searchParams.set('limit', params.limit.toString());
          const query = searchParams.toString();
          const url = query ? `/api/evaluation-templates?${query}` : '/api/evaluation-templates';
          return safeFetch(url);
        },
      },
      {
        name: 'create_evaluation',
        description: 'Create a new evaluation for testing an AI model. Specify the evaluation type (unit_test, human_eval, model_eval, ab_test), name, and optional test cases. Requires authentication.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the evaluation' },
            type: {
              type: 'string',
              enum: ['unit_test', 'human_eval', 'model_eval', 'ab_test'],
              description: 'Type of evaluation to create',
            },
            description: { type: 'string', description: 'Description of what this evaluation tests' },
            testCases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  input: { type: 'string' },
                  expectedOutput: { type: 'string' },
                },
              },
              description: 'Optional test cases to include',
            },
          },
          required: ['name', 'type'],
        },
        execute: async (params: any) => {
          return safeFetch('/api/evaluations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
        },
      },
      {
        name: 'run_evaluation',
        description: 'Execute an evaluation run. This fetches all test cases for the evaluation, runs them, and computes metrics (pass rate, scores, etc.). Requires authentication.',
        inputSchema: {
          type: 'object',
          properties: {
            evaluationId: { type: 'number', description: 'ID of the evaluation to run' },
          },
          required: ['evaluationId'],
        },
        execute: async (params: { evaluationId: number }) => {
          return safeFetch(`/api/evaluations/${params.evaluationId}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
        },
      },
      {
        name: 'get_evaluation_results',
        description: 'Get results from evaluation runs including pass/fail counts, individual test case results, and metrics. Requires authentication.',
        inputSchema: {
          type: 'object',
          properties: {
            evaluationId: { type: 'number', description: 'ID of the evaluation' },
            limit: { type: 'number', description: 'Maximum number of runs to return (default: 10)' },
          },
          required: ['evaluationId'],
        },
        execute: async (params: { evaluationId: number; limit?: number }) => {
          const limit = params.limit || 10;
          return safeFetch(`/api/evaluations/${params.evaluationId}/runs?limit=${limit}`);
        },
      },
      {
        name: 'get_quality_score',
        description: 'Get the quality score for an evaluation based on its latest run. Returns the evaluation name, run status, total/passed/failed test case counts, and pass rate percentage. Run the evaluation first if no runs exist.',
        inputSchema: {
          type: 'object',
          properties: {
            evaluationId: { type: 'number', description: 'ID of the evaluation' },
          },
          required: ['evaluationId'],
        },
        execute: async (params: { evaluationId: number }) => {
          // Fetch the evaluation details — route returns { evaluation: {...} }
          const evalResponse = await safeFetch(`/api/evaluations/${params.evaluationId}`);
          const evaluation = evalResponse?.evaluation || evalResponse;

          // Fetch latest run for metrics
          const runs = await safeFetch(`/api/evaluations/${params.evaluationId}/runs?limit=1`);

          if (!Array.isArray(runs) || runs.length === 0) {
            return {
              evaluationId: params.evaluationId,
              evaluationName: evaluation?.name || 'Unknown',
              score: null,
              message: 'No runs found. Run the evaluation first.',
            };
          }

          const latestRun = runs[0];
          const totalCases = latestRun.totalCases || 0;
          const passedCases = latestRun.passedCases || 0;
          const passRate = totalCases > 0 ? (passedCases / totalCases) * 100 : 0;

          return {
            evaluationId: params.evaluationId,
            evaluationName: evaluation?.name || 'Unknown',
            latestRun: {
              id: latestRun.id,
              status: latestRun.status,
              totalCases,
              passedCases,
              failedCases: latestRun.failedCases || 0,
              passRate: Math.round(passRate),
            },
          };
        },
      },
    ];

    // Register all tools
    for (const tool of tools) {
      try {
        const unregister = navigator.modelContext!.registerTool(tool);
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
