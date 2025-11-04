/**
 * Tracing Example
 * 
 * This example demonstrates how to create traces and spans to monitor
 * LLM operations in your application.
 * 
 * Usage:
 *   npm run trace
 */

import { AIEvalClient } from '@evalai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function traceExample() {
  try {
    // Initialize the client
    const client = AIEvalClient.init({ 
      apiKey: process.env.EVALAI_API_KEY 
    });

    console.log('🔍 Creating trace...\n');

    // Create a trace
    const trace = await client.traces.create({
      name: 'Chat Completion',
      traceId: `trace-${Date.now()}`,
      metadata: {
        userId: 'user-123',
        sessionId: 'session-456'
      }
    });

    console.log(`✅ Trace created: ${trace.id}\n`);

    // Create a span for the LLM call
    const span1 = await client.traces.createSpan(trace.id, {
      name: 'OpenAI API Call',
      type: 'llm',
      input: 'What is artificial intelligence?',
      output: 'AI stands for Artificial Intelligence. It refers to computer systems that can perform tasks that typically require human intelligence.',
      metadata: {
        model: 'gpt-4',
        tokens: 150,
        latency_ms: 1200,
        cost_usd: 0.0012
      }
    });

    console.log(`✅ Span created: ${span1.id}`);
    console.log(`   Type: ${span1.type}`);
    console.log(`   Latency: ${span1.metadata.latency_ms}ms`);
    console.log(`   Cost: $${span1.metadata.cost_usd}\n`);

    // Create another span for post-processing
    const span2 = await client.traces.createSpan(trace.id, {
      name: 'Response Validation',
      type: 'processing',
      input: span1.output,
      output: { valid: true, score: 0.95 },
      metadata: {
        latency_ms: 50
      }
    });

    console.log(`✅ Span created: ${span2.id}`);
    console.log(`   Type: ${span2.type}`);
    console.log(`   Latency: ${span2.metadata.latency_ms}ms\n`);

    // Get trace details
    const traceDetails = await client.traces.get(trace.id);
    
    console.log('📊 Trace Summary:');
    console.log(`   Total Spans: ${traceDetails.spans.length}`);
    console.log(`   Total Latency: ${traceDetails.totalLatency}ms`);
    console.log(`   Total Cost: $${traceDetails.totalCost}`);
    console.log(`\n🔗 View in dashboard: ${process.env.EVALAI_DASHBOARD_URL}/traces/${trace.id}`);

  } catch (error) {
    console.error('❌ Error creating trace:', error.message);
    process.exit(1);
  }
}

// Run the example
traceExample();
