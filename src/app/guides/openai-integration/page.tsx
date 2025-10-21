export const dynamic = 'force-static'
export const revalidate = false

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { ArrowLeft } from "lucide-react"

export default function OpenAIIntegrationGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-base sm:text-xl font-bold">AI Evaluation Platform</Link>
            <Button asChild size="sm" className="h-9">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Using with OpenAI API</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Wrap OpenAI API calls with our tracing SDK for full observability.
          </p>
          <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <span>8 min read</span>
            <span>•</span>
            <span>Integrations</span>
          </div>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <h2>Installation</h2>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
            npm install openai @evalai/sdk
          </div>

          <h2>Basic Setup</h2>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`import OpenAI from 'openai'
import { AIEvalClient, traceOpenAI } from '@evalai/sdk'

// Initialize EvalAI client (auto-loads from env vars)
const client = AIEvalClient.init()

// Wrap OpenAI client for automatic tracing
const openai = traceOpenAI(new OpenAI(), client)`}
          </div>

          <p className="text-sm text-muted-foreground my-4">
            <strong>Environment variables:</strong> Make sure you have <code className="bg-muted px-1 rounded">EVALAI_API_KEY</code> and <code className="bg-muted px-1 rounded">EVALAI_ORGANIZATION_ID</code> in your .env file.
          </p>

          <h2>Tracing OpenAI Calls</h2>

          <h3>Chat Completions</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// All OpenAI calls are automatically traced!
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.7
})

console.log(response.choices[0].message.content)

// Automatically tracked in EvalAI dashboard:
// ✓ Full prompt and response
// ✓ Token usage (input/output)
// ✓ Latency
// ✓ Model and parameters
// ✓ Cost estimation`}
          </div>

          <h3>Streaming Responses</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Streaming is automatically traced too!
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
  stream: true
})

// Stream tokens to user
let fullResponse = ''
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || ''
  fullResponse += content
  process.stdout.write(content)
}

// Full response is automatically captured in trace`}
          </div>

          <h3>Function Calling</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  }
]

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
  tools: tools,
  tool_choice: 'auto'
})

// Function calls are automatically tracked`}
          </div>

          <h3>Embeddings</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Embeddings are also automatically traced
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Your text here'
})

const vector = embedding.data[0].embedding`}
          </div>

          <h2>Advanced Patterns</h2>

          <h3>Multi-Turn Conversations</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Track entire conversation
await aiEval.trace({
  name: 'multi-turn-conversation',
  metadata: { sessionId: 'session_456' }
}, async (traceContext) => {
  
  const messages = [];
  
  // Turn 1
  messages.push({ role: 'user', content: 'Hello!' });
  const response1 = await traceContext.span(
    { name: 'turn-1' },
    () => openai.chat.completions.create({ model: 'gpt-4', messages })
  );
  messages.push(response1.choices[0].message);
  
  // Turn 2
  messages.push({ role: 'user', content: 'Tell me a joke' });
  const response2 = await traceContext.span(
    { name: 'turn-2' },
    () => openai.chat.completions.create({ model: 'gpt-4', messages })
  );
  messages.push(response2.choices[0].message);
  
  return messages;
});`}
          </div>

          <h3>Retry Logic with Tracing</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`async function callOpenAIWithRetry(messages, maxRetries = 3) {
  return await aiEval.trace({
    name: 'openai-with-retry',
    metadata: { maxRetries }
  }, async (traceContext) => {
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await traceContext.span(
          { name: \`attempt-\${attempt}\` },
          () => openai.chat.completions.create({
            model: 'gpt-4',
            messages
          })
        );
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        // Log retry in trace
        traceContext.logEvent({
          name: 'retry',
          metadata: { 
            attempt,
            error: error.message,
            waitTime: Math.pow(2, attempt) * 1000
          }
        });
        
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  });
}`}
          </div>

          <h3>Parallel Requests</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Generate multiple variations in parallel
const variations = await aiEval.trace({
  name: 'generate-variations',
  metadata: { count: 3 }
}, async (traceContext) => {
  
  const prompts = [
    'Write a formal email...',
    'Write a casual email...',
    'Write a brief email...'
  ];
  
  return await Promise.all(
    prompts.map((prompt, i) =>
      traceContext.span(
        { name: \`variation-\${i + 1}\` },
        () => openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }]
        })
      )
    )
  );
});`}
          </div>

          <h2>Evaluation Integration</h2>

          <h3>Create Test Cases</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`const testCases = [
  {
    input: { prompt: 'Translate "hello" to Spanish' },
    expectedOutput: { contains: 'hola' },
    metadata: { category: 'translation' }
  },
  {
    input: { prompt: 'What is 2+2?' },
    expectedOutput: { exact: '4' },
    metadata: { category: 'math' }
  }
];

// Run evaluation
for (const testCase of testCases) {
  const result = await aiEval.trace({
    name: 'test-case',
    metadata: testCase.metadata
  }, async () => {
    return await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: testCase.input.prompt }]
    });
  });
  
  const output = result.choices[0].message.content;
  const passed = testCase.expectedOutput.contains 
    ? output.toLowerCase().includes(testCase.expectedOutput.contains)
    : output === testCase.expectedOutput.exact;
  
  console.log(\`Test \${testCase.metadata.category}: \${passed ? '✓' : '✗'}\`);
}`}
          </div>

          <h3>A/B Testing Models</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Compare GPT-4 vs GPT-3.5-turbo
async function abTestModels(prompt) {
  const variant = Math.random() < 0.5 ? 'gpt-4' : 'gpt-3.5-turbo';
  
  return await aiEval.trace({
    name: 'model-ab-test',
    metadata: { 
      variant,
      experimentId: 'gpt4-vs-gpt35'
    }
  }, async () => {
    return await openai.chat.completions.create({
      model: variant,
      messages: [{ role: 'user', content: prompt }]
    });
  });
}

// Analyze results in dashboard to compare:
// - Quality scores
// - Latency
// - Cost
// - User satisfaction`}
          </div>

          <h2>Best Practices</h2>

          <h3>1. Add Contextual Metadata</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`await aiEval.trace({
  name: 'content-generation',
  metadata: {
    userId: user.id,
    contentType: 'blog-post',
    targetAudience: 'developers',
    tone: 'professional',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000
  }
}, async () => {
  // OpenAI call
});`}
          </div>

          <h3>2. Track Token Usage</h3>
          <p>Automatically tracked in every trace:</p>
          <ul>
            <li>Input tokens</li>
            <li>Output tokens</li>
            <li>Total cost (calculated from pricing)</li>
          </ul>

          <h3>3. Monitor for Errors</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`try {
  await aiEval.trace({ name: 'api-call' }, async () => {
    return await openai.chat.completions.create({...});
  });
} catch (error) {
  // Error automatically logged in trace
  console.error('OpenAI error:', error.message);
  
  // Track error type for alerting
  if (error.status === 429) {
    // Rate limit hit
  } else if (error.status === 500) {
    // OpenAI service error
  }
}`}
          </div>

          <h3>4. Set Timeouts</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2
});

// Timeout tracked in trace automatically`}
          </div>

          <h2>Troubleshooting</h2>

          <p><strong>Traces not capturing token usage?</strong></p>
          <p>Ensure you're using the latest version of the SDK.</p>

          <p><strong>High latency in traces?</strong></p>
          <p>Check if you're using synchronous operations. Use async/await consistently.</p>

          <p><strong>Missing streaming response data?</strong></p>
          <p>The SDK automatically buffers streaming responses for complete trace capture.</p>

          <h2>Real-World Example</h2>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">Content Moderation System</h3>
            <p><strong>Setup:</strong> GPT-4 API for content safety classification</p>
            <p><strong>Tracing:</strong> All API calls traced with content metadata</p>
            <p><strong>Evaluation:</strong> 500 test cases with known safe/unsafe content</p>
            <p><strong>Results:</strong></p>
            <ul className="mb-0">
              <li>98.5% accuracy on test suite</li>
              <li>Average latency: 850ms</li>
              <li>Caught regression when model was updated</li>
              <li>Monthly cost: $420 (tracked via traces)</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-12">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/dashboard">Start Evaluating</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/guides">View All Guides</Link>
            </Button>
          </div>

          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border">
            <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Related Guides</h3>
            <div className="grid gap-3 sm:gap-4">
              <Link href="/guides/tracing-setup" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1 text-sm sm:text-base">Setting Up Tracing in Your Application</div>
                <div className="text-xs sm:text-sm text-muted-foreground">General tracing concepts</div>
              </Link>
              <Link href="/guides/token-optimization" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1 text-sm sm:text-base">Optimizing Token Usage and Latency</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Reduce OpenAI API costs</div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}