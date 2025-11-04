/**
 * Demo Traces API
 * Returns pre-populated trace data for unauthenticated users
 * No authentication required - public endpoint
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

const demoTraces = [
  {
    id: 'demo_trace_1',
    name: 'Chat Completion - Product Query',
    traceId: 'trace-1705320000000',
    status: 'completed',
    totalLatency: 1250,
    totalCost: 0.0012,
    spanCount: 2,
    created_at: '2024-01-15T10:00:00Z',
    metadata: {
      userId: 'demo_user_1',
      sessionId: 'demo_session_1'
    },
    spans: [
      {
        id: 'span_1',
        name: 'OpenAI API Call',
        type: 'llm',
        input: 'What are your return policies?',
        output: 'We offer a 30-day money-back guarantee on all purchases.',
        latency: 1200,
        cost: 0.0012,
        metadata: {
          model: 'gpt-4',
          tokens: 150
        }
      },
      {
        id: 'span_2',
        name: 'Response Validation',
        type: 'processing',
        input: 'We offer a 30-day money-back guarantee on all purchases.',
        output: { valid: true, score: 0.95 },
        latency: 50,
        cost: 0,
        metadata: {}
      }
    ]
  },
  {
    id: 'demo_trace_2',
    name: 'RAG Query - Documentation',
    traceId: 'trace-1705233600000',
    status: 'completed',
    totalLatency: 1850,
    totalCost: 0.0024,
    spanCount: 3,
    created_at: '2024-01-14T10:00:00Z',
    metadata: {
      userId: 'demo_user_2',
      sessionId: 'demo_session_2'
    },
    spans: [
      {
        id: 'span_3',
        name: 'Vector Search',
        type: 'retrieval',
        input: 'How do I reset my password?',
        output: 'Retrieved 3 relevant documents',
        latency: 200,
        cost: 0,
        metadata: {
          documentsRetrieved: 3
        }
      },
      {
        id: 'span_4',
        name: 'LLM Generation',
        type: 'llm',
        input: 'Context + Query',
        output: 'To reset your password, click "Forgot Password" on the login page...',
        latency: 1600,
        cost: 0.0024,
        metadata: {
          model: 'gpt-4',
          tokens: 280
        }
      },
      {
        id: 'span_5',
        name: 'Hallucination Check',
        type: 'validation',
        input: 'Generated response',
        output: { hallucinated: false, score: 0.98 },
        latency: 50,
        cost: 0,
        metadata: {}
      }
    ]
  },
  {
    id: 'demo_trace_3',
    name: 'Code Generation Request',
    traceId: 'trace-1705147200000',
    status: 'completed',
    totalLatency: 2680,
    totalCost: 0.0038,
    spanCount: 2,
    created_at: '2024-01-13T10:00:00Z',
    metadata: {
      userId: 'demo_user_3',
      language: 'javascript'
    },
    spans: [
      {
        id: 'span_6',
        name: 'Code Generation',
        type: 'llm',
        input: 'Write a binary search function in JavaScript',
        output: 'function binarySearch(arr, target) { ... }',
        latency: 2680,
        cost: 0.0038,
        metadata: {
          model: 'gpt-4',
          tokens: 420
        }
      },
      {
        id: 'span_7',
        name: 'Syntax Validation',
        type: 'validation',
        input: 'Generated code',
        output: { valid: true, score: 1.0 },
        latency: 100,
        cost: 0,
        metadata: {}
      }
    ]
  },
  {
    id: 'demo_trace_4',
    name: 'Multi-turn Conversation',
    traceId: 'trace-1705060800000',
    status: 'completed',
    totalLatency: 3200,
    totalCost: 0.0045,
    spanCount: 4,
    created_at: '2024-01-12T10:00:00Z',
    metadata: {
      userId: 'demo_user_4',
      conversationId: 'conv_123'
    },
    spans: [
      {
        id: 'span_8',
        name: 'Turn 1',
        type: 'llm',
        input: 'Hello',
        output: 'Hi! How can I help you today?',
        latency: 800,
        cost: 0.0010,
        metadata: { model: 'gpt-4', tokens: 120 }
      },
      {
        id: 'span_9',
        name: 'Turn 2',
        type: 'llm',
        input: 'What are your hours?',
        output: 'We are open Monday-Friday, 9am-5pm EST.',
        latency: 900,
        cost: 0.0012,
        metadata: { model: 'gpt-4', tokens: 140 }
      },
      {
        id: 'span_10',
        name: 'Turn 3',
        type: 'llm',
        input: 'Do you offer weekend support?',
        output: 'Yes, we have limited weekend support available via email.',
        latency: 850,
        cost: 0.0011,
        metadata: { model: 'gpt-4', tokens: 135 }
      },
      {
        id: 'span_11',
        name: 'Turn 4',
        type: 'llm',
        input: 'Thank you',
        output: 'You\'re welcome! Have a great day!',
        latency: 650,
        cost: 0.0012,
        metadata: { model: 'gpt-4', tokens: 110 }
      }
    ]
  },
  {
    id: 'demo_trace_5',
    name: 'Sentiment Analysis Pipeline',
    traceId: 'trace-1704974400000',
    status: 'completed',
    totalLatency: 1100,
    totalCost: 0.0015,
    spanCount: 2,
    created_at: '2024-01-11T10:00:00Z',
    metadata: {
      userId: 'demo_user_5'
    },
    spans: [
      {
        id: 'span_12',
        name: 'Sentiment Classification',
        type: 'llm',
        input: 'This product is amazing! Highly recommend.',
        output: 'positive',
        latency: 1000,
        cost: 0.0015,
        metadata: { model: 'gpt-4', confidence: 0.98 }
      },
      {
        id: 'span_13',
        name: 'Post-processing',
        type: 'processing',
        input: 'positive',
        output: { sentiment: 'positive', score: 0.98 },
        latency: 100,
        cost: 0,
        metadata: {}
      }
    ]
  }
];

/**
 * GET /api/demo/traces
 * Returns demo trace data
 */
export async function GET() {
  return NextResponse.json({
    traces: demoTraces,
    total: demoTraces.length,
    page: 1,
    isDemo: true
  });
}
