/**
 * Demo Evaluations API
 * Returns pre-populated evaluation data for unauthenticated users
 * No authentication required - public endpoint
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

const demoEvaluations = [
  {
    id: 'demo_eval_1',
    name: 'Chatbot Accuracy Evaluation',
    description: 'Testing customer service chatbot responses',
    type: 'chatbot',
    status: 'completed',
    overall: 0.87,
    metrics: {
      factuality: 0.90,
      toxicity: 0.02,
      relevance: 0.88
    },
    items: 10,
    passed: 8,
    failed: 2,
    avgLatency: 1172,
    totalCost: 0.0113,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:35:00Z'
  },
  {
    id: 'demo_eval_2',
    name: 'RAG Hallucination Detection',
    description: 'Detecting hallucinations in RAG system responses',
    type: 'rag',
    status: 'completed',
    overall: 0.82,
    metrics: {
      hallucination_score: 0.935,
      relevance: 0.915,
      groundedness: 0.925
    },
    items: 10,
    passed: 8,
    failed: 2,
    avgLatency: 1596,
    totalCost: 0.0208,
    created_at: '2024-01-14T14:20:00Z',
    updated_at: '2024-01-14T14:28:00Z'
  },
  {
    id: 'demo_eval_3',
    name: 'Code Generation Quality',
    description: 'Evaluating generated code for correctness and style',
    type: 'codegen',
    status: 'completed',
    overall: 0.79,
    metrics: {
      syntax_valid: 1.0,
      test_pass: 0.885,
      style_score: 0.825,
      security_score: 0.950
    },
    items: 10,
    passed: 9,
    failed: 1,
    avgLatency: 2364,
    totalCost: 0.0332,
    created_at: '2024-01-13T09:15:00Z',
    updated_at: '2024-01-13T09:25:00Z'
  },
  {
    id: 'demo_eval_4',
    name: 'Content Moderation Test',
    description: 'Testing content safety and toxicity detection',
    type: 'safety',
    status: 'completed',
    overall: 0.95,
    metrics: {
      toxicity: 0.01,
      bias: 0.03,
      safety: 0.98
    },
    items: 15,
    passed: 14,
    failed: 1,
    avgLatency: 890,
    totalCost: 0.0145,
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-12T16:52:00Z'
  },
  {
    id: 'demo_eval_5',
    name: 'Sentiment Analysis Accuracy',
    description: 'Evaluating sentiment classification performance',
    type: 'classification',
    status: 'completed',
    overall: 0.91,
    metrics: {
      accuracy: 0.92,
      precision: 0.90,
      recall: 0.91
    },
    items: 20,
    passed: 18,
    failed: 2,
    avgLatency: 650,
    totalCost: 0.0180,
    created_at: '2024-01-11T11:30:00Z',
    updated_at: '2024-01-11T11:38:00Z'
  },
  {
    id: 'demo_eval_6',
    name: 'Translation Quality Check',
    description: 'Evaluating translation accuracy and fluency',
    type: 'translation',
    status: 'completed',
    overall: 0.88,
    metrics: {
      accuracy: 0.89,
      fluency: 0.87,
      consistency: 0.88
    },
    items: 12,
    passed: 10,
    failed: 2,
    avgLatency: 1450,
    totalCost: 0.0195,
    created_at: '2024-01-10T13:20:00Z',
    updated_at: '2024-01-10T13:30:00Z'
  },
  {
    id: 'demo_eval_7',
    name: 'Summarization Quality',
    description: 'Testing document summarization accuracy',
    type: 'summarization',
    status: 'running',
    overall: null,
    metrics: {},
    items: 8,
    passed: 5,
    failed: 0,
    avgLatency: 0,
    totalCost: 0,
    created_at: '2024-01-15T15:00:00Z',
    updated_at: '2024-01-15T15:05:00Z'
  },
  {
    id: 'demo_eval_8',
    name: 'Question Answering Benchmark',
    description: 'Evaluating QA system performance',
    type: 'qa',
    status: 'completed',
    overall: 0.84,
    metrics: {
      accuracy: 0.85,
      relevance: 0.83,
      completeness: 0.84
    },
    items: 25,
    passed: 21,
    failed: 4,
    avgLatency: 1120,
    totalCost: 0.0275,
    created_at: '2024-01-09T10:00:00Z',
    updated_at: '2024-01-09T10:15:00Z'
  }
];

/**
 * GET /api/demo/evaluations
 * Returns demo evaluation data
 */
export async function GET() {
  return NextResponse.json({
    evaluations: demoEvaluations,
    total: demoEvaluations.length,
    page: 1,
    isDemo: true
  });
}
