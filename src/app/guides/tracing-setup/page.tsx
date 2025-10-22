import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { PublicPageHeader } from "@/components/public-page-header"

import Link from "next/link"
import { ArrowLeft, Activity, Code, Eye } from "lucide-react"

export default function TracingSetupPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
          <Button variant="ghost" asChild className="mb-4 sm:mb-6">
            <Link href="/guides">
              <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Back to Guides
            </Link>
          </Button>

          <div className="mb-8 sm:mb-12">
            <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Tracing Setup Guide</h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Set up distributed tracing to gain visibility into your LLM application's behavior.
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <h2>Why Tracing Matters</h2>
            <p>
              Distributed tracing gives you full visibility into your AI application's behavior in production. 
              Track every LLM call, measure latency, monitor token usage, and debug issues before they impact users.
            </p>

            <h2>Installation</h2>
            <p>Install the AI Evaluation Platform SDK in your project:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
              npm install @evalai/sdk
            </div>
            <p>Or with other package managers:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
              yarn add @evalai/sdk<br />
              pnpm add @evalai/sdk
            </div>

            <h2>Environment Setup</h2>
            <p>Create a <code>.env</code> file in your project root:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`EVALAI_API_KEY=sk_test_your_api_key_here
EVALAI_ORGANIZATION_ID=your_org_id_here`}
            </div>
            <p className="text-sm text-muted-foreground">
              Get your API key from the <Link href="/developer" className="text-primary underline">Developer Dashboard</Link>.
            </p>

            <h2>Basic Setup</h2>
            <p>Initialize the SDK client:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`import { AIEvalClient } from '@evalai/sdk'

// Auto-loads from environment variables
const client = AIEvalClient.init()`}
            </div>

            <h2>Creating Traces</h2>
            <p>Create traces to track LLM calls and operations:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`// Create a trace
const trace = await client.traces.create({
  name: 'Customer Support Query',
  traceId: 'trace-' + Date.now(),
  metadata: { 
    userId: 'user_123', 
    sessionId: 'session_456' 
  }
})

// Add spans to track specific operations
const span = await client.traces.createSpan(trace.id, {
  name: 'LLM Call',
  spanId: 'span-' + Date.now(),
  type: 'llm',
  startTime: new Date().toISOString(),
  input: userQuery,
  output: response,
  metadata: { model: 'gpt-4', tokens: 150 }
})`}
            </div>

            <h2>What Gets Tracked</h2>
            <p>Each trace automatically captures:</p>
            <ul>
              <li><strong>Input/Output:</strong> Full prompts and responses</li>
              <li><strong>Timing:</strong> Start time, duration, latency</li>
              <li><strong>Tokens:</strong> Input tokens, output tokens, total cost</li>
              <li><strong>Model:</strong> Model name, version, parameters</li>
              <li><strong>Metadata:</strong> User ID, session ID, custom tags</li>
              <li><strong>Errors:</strong> Stack traces and error messages</li>
            </ul>

            <h2>Nested Traces (Spans)</h2>
            <p>For complex workflows with multiple LLM calls, use nested spans:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`await aiEval.trace({ name: 'rag-pipeline' }, async (parentTrace) => {
  // Step 1: Generate embedding
  const embedding = await parentTrace.span({ name: 'embed-query' }, async () => {
    return await openai.embeddings.create({...});
  });

  // Step 2: Retrieve documents
  const docs = await parentTrace.span({ name: 'retrieve-docs' }, async () => {
    return await vectorDb.search(embedding);
  });

  // Step 3: Generate response
  const response = await parentTrace.span({ name: 'generate-response' }, async () => {
    return await openai.chat.completions.create({...});
  });

  return response;
});`}
            </div>

            <h2>Adding Custom Metadata</h2>
            <p>Enrich traces with business context:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`await aiEval.trace({
  name: 'content-generation',
  metadata: {
    userId: user.id,
    contentType: 'blog-post',
    targetAudience: 'developers',
    keywords: ['AI', 'evaluation', 'testing']
  },
  tags: ['production', 'content-gen']
}, async () => {
  // Your LLM call here
});`}
            </div>

            <h2>Viewing Traces</h2>
            <p>
              Once instrumented, visit the <Link href="/traces" className="text-blue-500 hover:underline">Traces</Link> page 
              in your dashboard to:
            </p>
            <ul>
              <li>Search and filter traces by metadata, tags, or time range</li>
              <li>View detailed timelines showing nested spans</li>
              <li>Analyze token usage and costs</li>
              <li>Debug failures with full stack traces</li>
              <li>Identify performance bottlenecks</li>
            </ul>

            <h2>Integration with Evaluations</h2>
            <p>
              Traces can be used as test cases for evaluations. Convert real production traces into 
              regression tests to ensure your AI system maintains quality over time.
            </p>

            <h2>Best Practices</h2>
            <ul>
              <li>Use descriptive names for traces (e.g., "customer-support-query" not "llm-call")</li>
              <li>Add relevant metadata (user ID, session ID, feature flags)</li>
              <li>Tag traces with environment (production, staging, development)</li>
              <li>Set up sampling for high-volume applications (trace 10% of requests)</li>
              <li>Use nested spans for complex multi-step workflows</li>
              <li>Never log sensitive PII without proper anonymization</li>
            </ul>

            <h2>Troubleshooting</h2>
            <p><strong>Traces not appearing?</strong></p>
            <p>Check that your API key is correct and the SDK is properly initialized.</p>
            
            <p><strong>High latency overhead?</strong></p>
            <p>The SDK adds minimal overhead (~10ms), but ensure you're not blocking on trace uploads.</p>

            <p><strong>Missing span data?</strong></p>
            <p>Make sure async functions are properly awaited within trace callbacks.</p>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <h3 className="font-semibold mb-4">Related Guides</h3>
            <div className="grid gap-4">
              <Link href="/guides/openai-integration" className="block p-4 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1">Using with OpenAI API</div>
                <div className="text-sm text-muted-foreground">Specific integration patterns for OpenAI</div>
              </Link>
              <Link href="/guides/token-optimization" className="block p-4 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1">Optimizing Token Usage and Latency</div>
                <div className="text-sm text-muted-foreground">Use tracing data to reduce costs</div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}