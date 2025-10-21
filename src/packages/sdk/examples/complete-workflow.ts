/**
 * Complete Workflow Example
 * End-to-end guide for using the SDK
 */

import { 
  AIEvalClient, 
  createTestSuite, 
  expect,
  traceOpenAI,
  exportData,
  autoPaginate 
} from '../src';
import OpenAI from 'openai';

/**
 * Complete workflow demonstrating:
 * 1. Client initialization
 * 2. Creating evaluations
 * 3. Running tests
 * 4. Collecting traces
 * 5. Human annotations
 * 6. LLM judge evaluation
 * 7. Analyzing results
 * 8. Exporting data
 */
async function completeWorkflow() {
  // Step 1: Initialize SDK client
  console.log('=== Step 1: Initialize Client ===');
  const client = new AIEvalClient({
    apiKey: process.env.EVALAI_API_KEY!,
    organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
    debug: true,
    // Performance optimizations
    enableCaching: true,
    enableBatching: true,
    keepAlive: true,
  });

  // Step 2: Create an evaluation
  console.log('\n=== Step 2: Create Evaluation ===');
  const evaluation = await client.evaluations.create({
    name: 'Customer Support Chatbot Eval',
    type: 'quality',
    description: 'Evaluate chatbot responses for quality and accuracy',
    modelSettings: {
      model: 'gpt-4',
      temperature: 0.7,
    },
  });
  console.log(`Created evaluation: ${evaluation.name} (ID: ${evaluation.id})`);

  // Step 3: Create test suite
  console.log('\n=== Step 3: Create Test Suite ===');
  const testSuite = createTestSuite({
    name: 'Chatbot Quality Tests',
    description: 'Test suite for chatbot responses',
  });

  // Add test cases
  const testCases = [
    {
      input: 'How do I reset my password?',
      expected: 'Clear instructions with steps',
      tags: ['password', 'account'],
    },
    {
      input: 'What are your business hours?',
      expected: 'Specific hours with timezone',
      tags: ['info', 'hours'],
    },
    {
      input: 'I want to cancel my subscription',
      expected: 'Empathetic response with cancellation steps',
      tags: ['subscription', 'sensitive'],
    },
  ];

  for (const testCase of testCases) {
    testSuite.addCase({
      name: testCase.input,
      input: testCase.input,
      assertions: [
        expect('output').toContainKeywords(['help', 'support']),
        expect('output').toHaveLength({ min: 20 }),
      ],
    });
  }

  // Step 4: Run chatbot with automatic tracing
  console.log('\n=== Step 4: Run Chatbot with Tracing ===');
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const tracedOpenAI = traceOpenAI(openai, client);

  const responses = [];
  for (const testCase of testCases) {
    console.log(`\nTesting: "${testCase.input}"`);
    
    const response = await tracedOpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful customer support agent.',
        },
        {
          role: 'user',
          content: testCase.input,
        },
      ],
    });

    const output = response.choices[0].message.content || '';
    responses.push({ ...testCase, output });
    console.log(`Response: ${output.substring(0, 100)}...`);
  }

  // Step 5: Run assertions
  console.log('\n=== Step 5: Run Test Assertions ===');
  for (let i = 0; i < responses.length; i++) {
    const result = await testSuite.run({ output: responses[i].output });
    console.log(`Test ${i + 1}: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
    
    if (!result.passed) {
      console.log(`  Failures: ${result.failures.map(f => f.message).join(', ')}`);
    }
  }

  // Step 6: Create LLM Judge config
  console.log('\n=== Step 6: Create LLM Judge Config ===');
  const judgeConfig = await client.llmJudge.createConfig({
    name: 'Chatbot Quality Rubric',
    model: 'gpt-4',
    rubric: {
      criteria: [
        {
          name: 'Helpfulness',
          description: 'Response provides clear, actionable help',
          weight: 0.4,
        },
        {
          name: 'Tone',
          description: 'Professional and empathetic tone',
          weight: 0.3,
        },
        {
          name: 'Accuracy',
          description: 'Information is correct and complete',
          weight: 0.3,
        },
      ],
      scoreRange: { min: 0, max: 10 },
    },
  });
  console.log(`Created LLM Judge config: ${judgeConfig.name}`);

  // Step 7: Run LLM Judge evaluation
  console.log('\n=== Step 7: Run LLM Judge Evaluation ===');
  const judgeResults = await client.llmJudge.evaluate({
    configId: judgeConfig.id,
    testCases: responses.map(r => ({
      input: r.input,
      output: r.output,
      expectedOutput: r.expected,
    })),
  });

  console.log('Evaluation Results:');
  for (const result of judgeResults) {
    console.log(`  Score: ${result.score}/10`);
    console.log(`  Reasoning: ${result.reasoning.substring(0, 100)}...`);
  }

  // Step 8: Create annotation tasks for human review
  console.log('\n=== Step 8: Create Annotation Tasks ===');
  const annotationTask = await client.annotations.createTask({
    name: 'Review Chatbot Responses',
    description: 'Human review of chatbot quality',
    annotationType: 'rating',
    metadata: {
      evaluationId: evaluation.id,
    },
  });

  console.log(`Created annotation task: ${annotationTask.name}`);

  // Add items to annotation task
  for (let i = 0; i < responses.length; i++) {
    await client.annotations.createItem({
      taskId: annotationTask.id,
      testCaseId: i + 1,
      data: {
        input: responses[i].input,
        output: responses[i].output,
      },
    });
  }

  console.log(`Added ${responses.length} items for annotation`);

  // Step 9: Collect all traces
  console.log('\n=== Step 9: Collect Traces ===');
  const allTraces = [];
  for await (const trace of autoPaginate(
    async (offset, limit) => {
      return await client.traces.list({ 
        limit, 
        offset,
        status: 'success',
      });
    },
    50
  )) {
    allTraces.push(trace);
    if (allTraces.length >= 100) break; // Limit for demo
  }

  console.log(`Collected ${allTraces.length} traces`);

  // Step 10: Analyze results
  console.log('\n=== Step 10: Analyze Results ===');
  const avgScore = judgeResults.reduce((sum, r) => sum + r.score, 0) / judgeResults.length;
  const passedTests = testSuite.getCases().filter((_, i) => responses[i].output.length > 20).length;
  
  console.log('Summary:');
  console.log(`  Total Tests: ${testCases.length}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Average LLM Judge Score: ${avgScore.toFixed(2)}/10`);
  console.log(`  Total Traces: ${allTraces.length}`);

  // Step 11: Export data
  console.log('\n=== Step 11: Export Data ===');
  const exportedData = await exportData(client, {
    format: 'json',
    includeTraces: true,
    includeEvaluations: true,
    includeAnnotations: true,
  });

  console.log(`Exported ${Object.keys(exportedData).length} data types`);

  // Save to file
  const fs = await import('fs');
  const filename = `evaluation-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(exportedData, null, 2));
  console.log(`Saved to ${filename}`);

  console.log('\n✅ Complete workflow finished successfully!');
}

// Run the workflow
async function main() {
  try {
    await completeWorkflow();
  } catch (error) {
    console.error('Error in workflow:', error);
    process.exit(1);
  }
}

// Uncomment to run
// main();

export { completeWorkflow };

