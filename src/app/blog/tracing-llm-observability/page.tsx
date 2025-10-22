import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { PublicPageHeader } from "@/components/public-page-header"
import { Calendar, Clock, ArrowLeft } from "lucide-react"

export default function BlogPost() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Button variant="ghost" size="sm" asChild className="mb-4 sm:mb-6">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Back to Blog
          </Link>
        </Button>

        <article>
          <div className="mb-6 sm:mb-8">
            <div className="inline-block bg-blue-500/10 text-blue-500 px-2.5 sm:px-3 py-1 rounded text-xs font-medium mb-3 sm:mb-4">
              Technical
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Tracing: The Missing Layer in LLM Observability</h1>
            <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>October 13, 2025</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>9 min read</span>
              </div>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base">
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              Why distributed tracing matters for AI applications and what metrics you should be tracking 
              to understand and optimize your LLM systems.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Observability Gap</h2>
            <p className="text-muted-foreground mb-4">
              Traditional observability tools were built for deterministic systems: API latency, error rates, 
              database queries. These metrics still matter for AI applications, but they don't tell you what 
              you really need to know:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Why is this LLM call taking 8 seconds when it usually takes 2?</li>
              <li>How many tokens am I actually using per request?</li>
              <li>Which part of my RAG pipeline is causing quality issues?</li>
              <li>Did that prompt change reduce latency or just make outputs shorter?</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              You need tracing—the ability to follow a request through your entire AI pipeline and understand 
              what happened at each step.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">What is LLM Tracing?</h2>
            <p className="text-muted-foreground mb-4">
              Tracing captures the full execution path of an AI request as a tree of "spans"—individual 
              operations that make up the larger workflow. For an AI application, that might look like:
            </p>

            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <code className="text-sm">
{`📊 Trace: "User asks about pricing"
├─ 🔍 Span: Embed query (45ms, 12 tokens)
├─ 📚 Span: Vector search (123ms, 5 results)
├─ 🤖 Span: LLM call - GPT-4
│   ├─ Input: 1,247 tokens
│   ├─ Output: 156 tokens
│   └─ Latency: 2,834ms
└─ ✅ Total: 3,002ms, $0.042 cost`}
              </code>
            </div>

            <p className="text-muted-foreground mb-4">
              Each span captures:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>What happened:</strong> Operation name and type</li>
              <li><strong>When it happened:</strong> Start time and duration</li>
              <li><strong>Inputs/outputs:</strong> Prompts, completions, retrieved documents</li>
              <li><strong>Metadata:</strong> Model name, temperature, token counts</li>
              <li><strong>Cost:</strong> Token usage translated to actual dollars spent</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">Why Tracing Matters</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">1. Debug Production Issues</h3>
            <p className="text-muted-foreground mb-4">
              When a user reports "the AI gave me a wrong answer," what do you do? Without tracing, you're 
              guessing. With tracing, you can:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Pull up the exact trace for that request</li>
              <li>See what prompt was sent to the LLM</li>
              <li>Review what documents were retrieved for context</li>
              <li>Identify if it was a retrieval problem or a generation problem</li>
              <li>Reproduce the issue with the exact inputs</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2. Optimize Costs</h3>
            <p className="text-muted-foreground mb-4">
              LLM costs scale with usage, and tokens add up fast. Tracing shows you exactly where money 
              is being spent:
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <p className="text-sm mb-2"><strong>Example Discovery:</strong></p>
              <p className="text-sm text-muted-foreground">
                A team noticed their LLM costs doubled overnight. Tracing revealed a code change accidentally 
                included the entire conversation history in every request. Average prompt size went from 400 
                tokens to 2,100 tokens. One line fix saved $15K/month.
              </p>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">3. Improve Latency</h3>
            <p className="text-muted-foreground mb-4">
              Users expect fast responses. Tracing helps you identify bottlenecks:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Is the LLM call slow, or is retrieval the bottleneck?</li>
              <li>Are you making sequential calls that could be parallel?</li>
              <li>Which model/provider combination is fastest for your use case?</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">4. Understand Quality Issues</h3>
            <p className="text-muted-foreground mb-4">
              When outputs are wrong, tracing reveals why:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Did we retrieve the wrong documents? (RAG issue)</li>
              <li>Did we retrieve the right documents but the LLM ignored them? (Prompt issue)</li>
              <li>Did the model hallucinate despite good context? (Model issue)</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">Key Metrics to Track</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">Performance Metrics</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>End-to-end latency:</strong> Total time from request to response</li>
              <li><strong>LLM latency:</strong> Just the model inference time</li>
              <li><strong>Time to first token (TTFT):</strong> For streaming responses</li>
              <li><strong>Tokens per second:</strong> Generation speed</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Cost Metrics</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Input tokens:</strong> Prompt size</li>
              <li><strong>Output tokens:</strong> Completion size</li>
              <li><strong>Cost per request:</strong> Total spend per API call</li>
              <li><strong>Cost per user/session:</strong> Aggregate spending patterns</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Quality Metrics</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Retrieval relevance:</strong> Are we finding the right documents?</li>
              <li><strong>Context utilization:</strong> Is the LLM using provided context?</li>
              <li><strong>Output diversity:</strong> Are responses varied or repetitive?</li>
              <li><strong>Error rates:</strong> API failures, timeouts, rate limits</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">Implementing Tracing</h2>
            <p className="text-muted-foreground mb-4">
              Most AI applications need tracing at three levels:
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">1. LLM Calls</h3>
            <p className="text-muted-foreground mb-4">
              Capture every LLM API call with full context:
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
{`import { trace } from "@/lib/tracing"

const response = await trace.llm({
  name: "Generate response",
  model: "gpt-4",
  input: prompt,
  metadata: { temperature: 0.7, user_id }
})`}
              </code>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">2. Retrieval Operations</h3>
            <p className="text-muted-foreground mb-4">
              Track what documents are fetched and why:
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
{`const docs = await trace.retrieval({
  name: "Vector search",
  query: userQuery,
  results: retrievedDocs,
  metadata: { top_k: 5, score_threshold: 0.7 }
})`}
              </code>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">3. Full Request Traces</h3>
            <p className="text-muted-foreground mb-4">
              Wrap the entire request to capture end-to-end behavior:
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
{`await trace.request("User question", async () => {
  const embedded = await embedQuery(query)
  const docs = await vectorSearch(embedded)
  const response = await llm.complete(prompt, docs)
  return response
})`}
              </code>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">Real-World Use Cases</h2>

            <div className="space-y-6 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="font-medium mb-2">🔍 Cost Optimization</p>
                <p className="text-sm text-muted-foreground">
                  Identify requests with abnormally high token counts. Found that certain user questions 
                  triggered expensive multi-turn conversations. Added smarter conversation pruning, reduced 
                  costs by 35%.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <p className="font-medium mb-2">⚡ Latency Reduction</p>
                <p className="text-sm text-muted-foreground">
                  Discovered that vector search was taking 400ms while LLM call took 2s. Moved to parallel 
                  retrieval and reduced end-to-end latency by 25%.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <p className="font-medium mb-2">🐛 Quality Debugging</p>
                <p className="text-sm text-muted-foreground">
                  Users reported "AI doesn't know about recent features." Traces showed retrieval was working, 
                  but LLM was ignoring recent docs in favor of general knowledge. Added recency weighting to 
                  fix.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">Best Practices</h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Trace everything in production:</strong> You can't debug what you don't capture</li>
              <li><strong>Include user context:</strong> User ID, session ID, feature flags help with filtering</li>
              <li><strong>Set up alerts:</strong> Notify when latency, cost, or error rates spike</li>
              <li><strong>Sample intelligently:</strong> Trace 100% of errors and slow requests, sample the rest</li>
              <li><strong>Link traces to evaluation:</strong> Use trace IDs to pull production examples into test sets</li>
              <li><strong>Build dashboards:</strong> Monitor trends over time, not just individual traces</li>
            </ol>

            <h2 className="text-2xl font-bold mb-4 mt-8">Getting Started</h2>
            <p className="text-muted-foreground mb-4">
              If you're not tracing your LLM calls yet, start simple:
            </p>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Instrument one critical path (e.g., your main chat endpoint)</li>
              <li>Capture input tokens, output tokens, latency, and cost</li>
              <li>Build a simple dashboard to visualize these metrics over time</li>
              <li>Use traces to debug the next production issue</li>
            </ol>
            <p className="text-muted-foreground mb-4">
              You'll immediately see patterns and opportunities for optimization that were invisible before.
            </p>

            <div className="rounded-lg border border-border bg-card p-6 mt-8">
              <h3 className="text-lg font-semibold mb-3">Start Tracing Your LLM Calls</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our platform provides automatic tracing for all major LLM providers. Get started with our 
                tracing setup guide.
              </p>
              <Button asChild>
                <Link href="/guides/tracing-setup">Setup Tracing</Link>
              </Button>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}