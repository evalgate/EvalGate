import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { PublicPageHeader } from "@/components/public-page-header";
import { Button } from "@/components/ui/button";

export default function OpenAIIntegrationGuide() {
	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			<PublicPageHeader />

			<main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
				<Link
					href="/guides"
					className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
					Back to Guides
				</Link>

				<div className="mb-6 sm:mb-8">
					<h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">
						Using with OpenAI API
					</h1>
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
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						TypeScript
					</p>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
						npm install openai @evalgate/sdk
					</div>
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						Python
					</p>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
						pip install openai pauly4010-evalgate-sdk
					</div>

					<h2>Basic Setup</h2>
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						TypeScript
					</p>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
						{`import OpenAI from 'openai'
import { AIEvalClient, WorkflowTracer, traceOpenAI, traceWorkflowStep } from '@evalgate/sdk'

const client = new AIEvalClient({ apiKey: process.env.EVALGATE_API_KEY })
const tracer = new WorkflowTracer(client)

// Wrap OpenAI client for automatic tracing
const openai = traceOpenAI(new OpenAI(), client)`}
					</div>
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						Python
					</p>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
						{`from openai import OpenAI
from evalgate_sdk import AIEvalClient, WorkflowTracer
from evalgate_sdk.integrations.openai import trace_openai

client = AIEvalClient(api_key=os.environ["EVALGATE_API_KEY"])
tracer = WorkflowTracer(client)

# Wrap OpenAI client for automatic tracing
openai = trace_openai(OpenAI(), client)`}
					</div>

					<p className="text-sm text-muted-foreground my-4">
						<strong>Environment variables:</strong> Make sure you have{" "}
						<code className="bg-muted px-1 rounded">EVALGATE_API_KEY</code> and{" "}
						<code className="bg-muted px-1 rounded">
							EVALGATE_ORGANIZATION_ID
						</code>{" "}
						in your .env file.
					</p>

					<h2>Tracing OpenAI Calls</h2>

					<h3>Chat Completions</h3>
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						TypeScript
					</p>
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

// Automatically tracked in EvalGate dashboard:
// ✓ Full prompt and response
// ✓ Token usage (input/output)
// ✓ Latency
// ✓ Model and parameters
// ✓ Cost estimation`}
					</div>
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						Python
					</p>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
						{`# All OpenAI calls are automatically traced!
response = await openai.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)

# Automatically tracked in EvalAI dashboard:
# ✓ Full prompt and response
# ✓ Token usage (input/output)
# ✓ Latency
# ✓ Model and parameters
# ✓ Cost estimation`}
					</div>

					<h3>Streaming Responses</h3>
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						TypeScript
					</p>
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
					<p className="text-xs font-semibold text-muted-foreground mb-1">
						Python
					</p>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
						{`# Streaming is automatically traced too!
stream = await openai.chat.completions.create(
    model="gpt-4",
    messages=messages,
    stream=True
)

# Stream tokens to user
full_response = ""
async for chunk in stream:
    content = chunk.choices[0].delta.content or ""
    full_response += content
    print(content, end="", flush=True)

# Full response is automatically captured in trace`}
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
						{`import { traceWorkflowStep } from '@evalgate/sdk'

await tracer.startWorkflow('multi-turn-conversation', undefined, { sessionId: 'session_456' });

const messages = [];

// Turn 1
messages.push({ role: 'user', content: 'Hello!' });
const response1 = await traceWorkflowStep(tracer, 'turn-1', () =>
  openai.chat.completions.create({ model: 'gpt-4', messages })
);
messages.push(response1.choices[0].message);

// Turn 2
messages.push({ role: 'user', content: 'Tell me a joke' });
const response2 = await traceWorkflowStep(tracer, 'turn-2', () =>
  openai.chat.completions.create({ model: 'gpt-4', messages })
);
messages.push(response2.choices[0].message);

await tracer.endWorkflow({ status: 'success' });`}
					</div>

					<h3>Retry Logic with Tracing</h3>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
						{`async function callOpenAIWithRetry(messages, maxRetries = 3) {
  await tracer.startWorkflow('openai-with-retry', undefined, { maxRetries });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await traceWorkflowStep(
        tracer,
        \`attempt-\${attempt}\`,
        () => openai.chat.completions.create({ model: 'gpt-4', messages })
      );
      await tracer.endWorkflow({ status: 'success' });
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        await tracer.endWorkflow({ status: 'failed', error: error.message });
        throw error;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}`}
					</div>

					<h3>Parallel Requests</h3>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
						{`await tracer.startWorkflow('generate-variations', undefined, { count: 3 });

const prompts = [
  'Write a formal email...',
  'Write a casual email...',
  'Write a brief email...'
];

const variations = await Promise.all(
  prompts.map((prompt, i) =>
    traceWorkflowStep(tracer, \`variation-\${i + 1}\`, () =>
      openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }]
      })
    )
  )
);

await tracer.endWorkflow({ status: 'success' });`}
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
  await tracer.startWorkflow('test-case', undefined, testCase.metadata);
  const result = await traceWorkflowStep(tracer, 'llm-call', () =>
    openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: testCase.input.prompt }]
    })
  );
  await tracer.endWorkflow({ status: 'success' });

  const output = result.choices[0].message.content;
  const passed = testCase.expectedOutput.contains
    ? output.toLowerCase().includes(testCase.expectedOutput.contains)
    : output === testCase.expectedOutput.exact;

  console.log(\`Test \${testCase.metadata.category}: \${passed ? '✓' : '✗'}\`);
}`}
					</div>

					<h3>A/B Testing Models</h3>
					<div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
						{`async function abTestModels(prompt) {
  const variant = Math.random() < 0.5 ? 'gpt-4' : 'gpt-3.5-turbo';

  await tracer.startWorkflow('model-ab-test', undefined, {
    variant,
    experimentId: 'gpt4-vs-gpt35'
  });
  const result = await traceWorkflowStep(tracer, 'llm-call', () =>
    openai.chat.completions.create({
      model: variant,
      messages: [{ role: 'user', content: prompt }]
    })
  );
  await tracer.endWorkflow({ status: 'success' });
  return result;
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
						{`await tracer.startWorkflow('content-generation', undefined, {
  userId: user.id,
  contentType: 'blog-post',
  targetAudience: 'developers',
  tone: 'professional',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000
});
const span = await tracer.startAgentSpan('ContentAgent', { input: '...' });
// OpenAI call
await tracer.endAgentSpan(span, { result: '...' });
await tracer.endWorkflow({ status: 'success' });`}
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
  await tracer.startWorkflow('api-call');
  const result = await traceWorkflowStep(tracer, 'llm-call', () =>
    openai.chat.completions.create({...})
  );
  await tracer.endWorkflow({ status: 'success' });
  return result;
} catch (error) {
  await tracer.endWorkflow({ status: 'failed', error: error.message });
  console.error('OpenAI error:', error.message);

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

					<p>
						<strong>Traces not capturing token usage?</strong>
					</p>
					<p>Ensure you're using the latest version of the SDK.</p>

					<p>
						<strong>High latency in traces?</strong>
					</p>
					<p>
						Check if you're using synchronous operations. Use async/await
						consistently.
					</p>

					<p>
						<strong>Missing streaming response data?</strong>
					</p>
					<p>
						The SDK automatically buffers streaming responses for complete trace
						capture.
					</p>

					<h2>Real-World Example</h2>
					<div className="bg-card border border-border p-6 rounded-lg my-6">
						<h3 className="mt-0">Content Moderation System</h3>
						<p>
							<strong>Setup:</strong> GPT-4 API for content safety
							classification
						</p>
						<p>
							<strong>Tracing:</strong> All API calls traced with content
							metadata
						</p>
						<p>
							<strong>Evaluation:</strong> 500 test cases with known safe/unsafe
							content
						</p>
						<p>
							<strong>Results:</strong>
						</p>
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
						<Button
							asChild
							variant="outline"
							size="lg"
							className="w-full sm:w-auto"
						>
							<Link href="/guides">View All Guides</Link>
						</Button>
					</div>

					<div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border">
						<h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">
							Related Guides
						</h3>
						<div className="grid gap-3 sm:gap-4">
							<Link
								href="/guides/tracing-setup"
								className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors"
							>
								<div className="font-semibold mb-1 text-sm sm:text-base">
									Setting Up Tracing in Your Application
								</div>
								<div className="text-xs sm:text-sm text-muted-foreground">
									General tracing concepts
								</div>
							</Link>
							<Link
								href="/guides/token-optimization"
								className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors"
							>
								<div className="font-semibold mb-1 text-sm sm:text-base">
									Optimizing Token Usage and Latency
								</div>
								<div className="text-xs sm:text-sm text-muted-foreground">
									Reduce OpenAI API costs
								</div>
							</Link>
						</div>
					</div>
				</div>
			</main>

			<Footer />
		</div>
	);
}
