import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { PublicPageHeader } from "@/components/public-page-header"

import Link from "next/link"
import { ArrowLeft, Zap, DollarSign, TrendingDown } from "lucide-react"

export default function TokenOptimizationPage() {
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
            <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Token Optimization Guide</h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Reduce costs and improve performance by optimizing token usage in your LLM applications.
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <h2>The Cost of LLM Applications</h2>
            <p>
              LLM costs can spiral quickly at scale. A seemingly efficient application using GPT-4 at $0.03 per 1K 
              input tokens can cost thousands per month with just moderate traffic. Latency compounds the problem—users 
              abandon slow applications.
            </p>

            <h2>Measuring Current Performance</h2>
            <p>
              Start by understanding your baseline. Navigate to the <Link href="/traces" className="text-blue-500 hover:underline">Traces</Link> dashboard 
              to see:
            </p>
            <ul>
              <li>Average tokens per request (input + output)</li>
              <li>P50, P95, P99 latency</li>
              <li>Cost per request and total monthly spend</li>
              <li>Slowest operations and bottlenecks</li>
            </ul>

            <h2>Strategy 1: Reduce Input Tokens</h2>
            
            <h3>1. Trim Unnecessary Context</h3>
            <p>Are you sending more context than the model needs?</p>
            <div className="bg-muted p-4 rounded-lg my-4">
              <p className="mb-2"><strong>Before:</strong> 3,500 tokens (full conversation history)</p>
              <p className="mb-0"><strong>After:</strong> 1,200 tokens (last 3 turns + summary)</p>
              <p className="mb-0 text-sm text-muted-foreground mt-2">Savings: 66% input tokens</p>
            </div>

            <h3>2. Semantic Search Over Full Documents</h3>
            <p>
              For RAG systems, don't dump entire documents into the prompt. Use embeddings to retrieve only the most 
              relevant chunks.
            </p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`// Before: Sending 10 full documents (15,000 tokens)
const context = documents.join('\\n');

// After: Top 3 relevant chunks (2,000 tokens)
const embedding = await embed(query);
const chunks = await vectorDB.search(embedding, limit: 3);
const context = chunks.join('\\n');`}
            </div>

            <h3>3. Prompt Compression</h3>
            <p>Remove verbose instructions and redundant examples:</p>
            <ul>
              <li>Use terse, imperative language</li>
              <li>Replace examples with few-shot learning (2-3 examples max)</li>
              <li>Remove filler words and formatting</li>
            </ul>

            <h2>Strategy 2: Reduce Output Tokens</h2>

            <h3>1. Set max_tokens Limits</h3>
            <p>Prevent runaway generation by capping output length:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
              {`max_tokens: 150  // For short answers\nmax_tokens: 500  // For detailed explanations`}
            </div>

            <h3>2. Use Structured Outputs</h3>
            <p>JSON outputs are more token-efficient than prose:</p>
            <div className="bg-card border border-border p-6 rounded-lg my-6">
              <p className="mb-2"><strong>Prose (120 tokens):</strong></p>
              <p className="text-sm mb-4">"The sentiment of this review is positive. The user seems happy with the product quality and delivery speed."</p>
              <p className="mb-2"><strong>JSON (15 tokens):</strong></p>
              <p className="text-sm font-mono mb-0">{`{"sentiment": "positive", "aspects": ["quality", "delivery"]}`}</p>
            </div>

            <h3>3. Stop Sequences</h3>
            <p>Use stop sequences to halt generation early when the task is complete:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
              {`stop: ["\\n\\n", "###", "END"]  // Stops at natural breakpoints`}
            </div>

            <h2>Strategy 3: Choose the Right Model</h2>

            <h3>Model Selection Matrix</h3>
            <table className="w-full my-6 text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2">Task</th>
                  <th className="text-left py-2">Model</th>
                  <th className="text-left py-2">Cost/1K tokens</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2">Simple classification</td>
                  <td className="py-2">GPT-3.5-turbo</td>
                  <td className="py-2">$0.0005</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">Creative writing</td>
                  <td className="py-2">GPT-4</td>
                  <td className="py-2">$0.03</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">Code generation</td>
                  <td className="py-2">GPT-4</td>
                  <td className="py-2">$0.03</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">Embeddings</td>
                  <td className="py-2">text-embedding-3-small</td>
                  <td className="py-2">$0.00002</td>
                </tr>
              </tbody>
            </table>
            <p>Don't use GPT-4 for tasks GPT-3.5 can handle. Test with smaller models first.</p>

            <h3>Model Cascading</h3>
            <p>Route requests to cheaper models when possible:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`// Try GPT-3.5 first
let response = await callGPT35(prompt);

// Only escalate to GPT-4 if confidence is low
if (response.confidence < 0.8) {
  response = await callGPT4(prompt);
}`}
            </div>

            <h2>Strategy 4: Reduce Latency</h2>

            <h3>1. Streaming Responses</h3>
            <p>Show tokens as they're generated instead of waiting for completion:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages,
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    // Send to frontend immediately
    yield content;
  }
}`}
            </div>
            <p>Perceived latency drops from 3s to 0.5s.</p>

            <h3>2. Parallel Requests</h3>
            <p>For independent operations, call LLMs in parallel:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
              {`// Sequential: 6 seconds total
const title = await generateTitle(content);
const summary = await generateSummary(content);
const tags = await generateTags(content);

// Parallel: 2 seconds total (limited by slowest call)
const [title, summary, tags] = await Promise.all([
  generateTitle(content),
  generateSummary(content),
  generateTags(content)
]);`}
            </div>

            <h3>3. Caching</h3>
            <p>Cache responses for repeated queries:</p>
            <ul>
              <li><strong>Exact match caching:</strong> Identical inputs return cached responses</li>
              <li><strong>Semantic caching:</strong> Similar queries reuse cached responses</li>
              <li><strong>TTL:</strong> Expire cache after 24 hours for time-sensitive content</li>
            </ul>

            <h3>4. Reduce Retrieval Overhead</h3>
            <p>For RAG systems, optimize the retrieval step:</p>
            <ul>
              <li>Use faster vector databases (Pinecone, Weaviate)</li>
              <li>Pre-compute embeddings at write-time, not read-time</li>
              <li>Index frequently accessed documents</li>
            </ul>

            <h2>Monitoring and Alerting</h2>
            <p>Set up alerts in the platform to catch regressions:</p>
            <ul>
              <li><strong>Cost spike:</strong> Alert if daily spend exceeds $X</li>
              <li><strong>Latency degradation:</strong> Alert if P95 latency &gt; 3s</li>
              <li><strong>Token anomalies:</strong> Alert if average tokens per request jumps 2x</li>
            </ul>

            <h2>Real-World Optimization Case Study</h2>
            <div className="bg-card border border-border p-6 rounded-lg my-6">
              <h3 className="mt-0">Customer Support Chatbot</h3>
              <p><strong>Initial State:</strong></p>
              <ul>
                <li>Model: GPT-4</li>
                <li>Avg tokens: 4,500 per request</li>
                <li>Latency: 3.2s</li>
                <li>Cost: $8,400/month</li>
              </ul>
              <p><strong>Optimizations Applied:</strong></p>
              <ol>
                <li>Switched to GPT-3.5-turbo for 70% of simple queries (model cascading)</li>
                <li>Reduced context window from full history to last 3 turns + summary</li>
                <li>Added semantic caching with 40% hit rate</li>
                <li>Enabled streaming for perceived latency</li>
              </ol>
              <p><strong>Final State:</strong></p>
              <ul>
                <li>Avg tokens: 1,800 per request (-60%)</li>
                <li>Latency: 1.1s (-66%)</li>
                <li>Cost: $2,100/month (-75%)</li>
              </ul>
            </div>

            <h2>Quick Wins Checklist</h2>
            <ul>
              <li>✅ Set max_tokens limits on all completions</li>
              <li>✅ Use GPT-3.5-turbo for simple tasks</li>
              <li>✅ Enable streaming for all user-facing responses</li>
              <li>✅ Implement exact-match caching</li>
              <li>✅ Trim conversation history to last 3-5 turns</li>
              <li>✅ Use structured outputs (JSON) instead of prose</li>
              <li>✅ Monitor token usage and set cost alerts</li>
            </ul>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <h3 className="font-semibold mb-4">Related Guides</h3>
            <div className="grid gap-4">
              <Link href="/guides/tracing-setup" className="block p-4 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1">Setting Up Tracing in Your Application</div>
                <div className="text-sm text-muted-foreground">Required to measure token usage</div>
              </Link>
              <Link href="/guides/rag-evaluation" className="block p-4 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1">RAG System Evaluation</div>
                <div className="text-sm text-muted-foreground">Optimize retrieval for better performance</div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}