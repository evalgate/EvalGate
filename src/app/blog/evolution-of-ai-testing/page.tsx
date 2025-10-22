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
              Industry
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">The Evolution of AI Testing: From Unit Tests to A/B Tests</h1>
            <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>October 13, 2025</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>10 min read</span>
              </div>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base">
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              A comprehensive look at evaluation methodologies for AI systems across the development lifecycle.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Testing Paradigm Shift</h2>
            <p className="text-muted-foreground mb-4">
              For decades, software testing followed a predictable pattern: write code, write tests, run tests, 
              deploy. Tests were deterministic—the same input always produced the same output. If a test passed, 
              you could be confident the code worked.
            </p>
            <p className="text-muted-foreground mb-4">
              Then came LLMs, and everything changed.
            </p>
            <p className="text-muted-foreground mb-4">
              AI systems are probabilistic, context-dependent, and subjective. The same input might yield different 
              outputs. What's "correct" depends on nuanced judgment, not exact string matching. Traditional testing 
              frameworks weren't built for this world.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Four Stages of AI Testing Maturity</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">Stage 1: Manual Spot Checking</h3>
            <p className="text-muted-foreground mb-4">
              <strong>What it looks like:</strong> Developers test changes by running a few prompts in a playground 
              and eyeballing the results. "Looks good to me" becomes the deployment criteria.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Why teams do it:</strong> It's fast and requires no setup. When you're moving quickly in early 
              prototyping, this might be enough.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>The problems:</strong> No systematic coverage, no regression detection, no visibility into what 
              broke. Changes that improve one scenario often break others, but you won't know until production.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>When to graduate:</strong> As soon as you have users. One person's "looks good" is not sufficient 
              for production AI.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Stage 2: Test Sets & Unit Tests</h3>
            <p className="text-muted-foreground mb-4">
              <strong>What it looks like:</strong> Create a curated set of example inputs with expected outputs. Run your 
              AI system against this test set and check for exact or semantic matches.
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
{`test_cases = [
  {"input": "What are your hours?", "expected": "9am-5pm EST"},
  {"input": "Do you ship internationally?", "expected": "Yes, worldwide"},
]

for case in test_cases:
  output = chatbot(case["input"])
  assert semantic_similarity(output, case["expected"]) > 0.8`}
              </code>
            </div>
            <p className="text-muted-foreground mb-4">
              <strong>Why teams do it:</strong> Familiar developer workflow, catches regressions, provides confidence 
              before deployment.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>The problems:</strong> Test sets are expensive to build and maintain. They can't cover every edge 
              case. And passing tests doesn't guarantee good user experience—you might be optimizing for the wrong metrics.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Best practices:</strong> Start small (20-50 cases), prioritize edge cases, version your test sets, 
              use semantic similarity not exact matching.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Stage 3: Automated Evaluation with LLM Judges</h3>
            <p className="text-muted-foreground mb-4">
              <strong>What it looks like:</strong> Use a strong LLM (GPT-4, Claude-3.5) to evaluate outputs from your 
              production model against custom rubrics. Scale from 50 test cases to 5,000 without hiring more humans.
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
{`rubric = """
Score the customer support response on:
1. Accuracy (1-5): Are all facts correct?
2. Helpfulness (1-5): Does it solve the user's problem?
3. Tone (1-5): Is it professional and empathetic?
"""

judge_score = llm_judge(
  input=user_question,
  output=chatbot_response,
  rubric=rubric
)

assert judge_score["accuracy"] >= 4
assert judge_score["helpfulness"] >= 4`}
              </code>
            </div>
            <p className="text-muted-foreground mb-4">
              <strong>Why teams do it:</strong> Achieves 85-95% agreement with human experts at 1% of the cost. Enables 
              large-scale evaluation and continuous monitoring.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>The problems:</strong> Rubric design is hard. Judge models have biases (length bias, self-preference). 
              Still requires human validation for high-stakes decisions.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Best practices:</strong> Validate judge scores against human labels, use chain-of-thought reasoning, 
              calibrate rubrics with examples, monitor judge reliability over time.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Stage 4: Production A/B Testing</h3>
            <p className="text-muted-foreground mb-4">
              <strong>What it looks like:</strong> Run controlled experiments in production. Show variant A to 50% of 
              users, variant B to the other 50%, and measure which performs better on real business metrics.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Why teams do it:</strong> This is the only way to measure true impact. Offline evals can't predict 
              user satisfaction, task completion, or retention. A/B tests tell you what actually matters.
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <p className="text-sm">
                <strong>Example:</strong> A product team ran an A/B test on their AI search feature. Variant A had higher 
                accuracy on their eval set (89% vs 85%), but variant B had 12% higher click-through rate and 8% better 
                user satisfaction. They shipped variant B.
              </p>
            </div>
            <p className="text-muted-foreground mb-4">
              <strong>The problems:</strong> Requires experimentation infrastructure, statistical rigor, and sufficient 
              traffic. Not viable for early-stage products or high-risk changes.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Best practices:</strong> Define success metrics upfront, ensure statistical significance, monitor 
              both leading and lagging indicators, combine with offline evals for safety.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Choosing the Right Approach</h2>
            <p className="text-muted-foreground mb-4">
              Most mature AI teams use all four stages in combination:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-3 mb-4">
              <li><strong>Manual spot checking:</strong> During rapid prototyping and exploratory work</li>
              <li><strong>Unit tests:</strong> For deterministic components (API validation, data preprocessing)</li>
              <li><strong>LLM judges:</strong> For semantic quality, relevance, safety checks at scale</li>
              <li><strong>A/B tests:</strong> For validating significant changes with real user impact data</li>
            </ul>

            <div className="rounded-lg border border-border bg-card p-6 mb-6">
              <h4 className="font-semibold mb-3">Testing Strategy by Development Stage</h4>
              <div className="text-sm space-y-3">
                <div>
                  <p className="font-medium">🔬 Research/Prototyping</p>
                  <p className="text-muted-foreground">Manual testing + small test set (10-20 cases)</p>
                </div>
                <div>
                  <p className="font-medium">🚀 Pre-Production</p>
                  <p className="text-muted-foreground">Comprehensive test sets (50-100 cases) + LLM judges</p>
                </div>
                <div>
                  <p className="font-medium">📊 Production</p>
                  <p className="text-muted-foreground">Continuous evaluation + A/B testing + human audits</p>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Future: Continuous Evaluation</h2>
            <p className="text-muted-foreground mb-4">
              The next frontier is treating evaluation as a continuous process, not a pre-deployment checkpoint:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Real-time monitoring:</strong> Evaluate every production request, flag anomalies automatically</li>
              <li><strong>Adaptive test sets:</strong> Automatically expand test coverage based on production edge cases</li>
              <li><strong>Feedback loops:</strong> Use production failures to train better judge models</li>
              <li><strong>Multi-model evaluation:</strong> Compare outputs across different models/prompts in real-time</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">Key Takeaways</h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Traditional testing doesn't work for AI—you need new methodologies</li>
              <li>Start simple (test sets) and scale up (LLM judges, A/B tests) as you mature</li>
              <li>No single approach is sufficient—combine offline evals with production testing</li>
              <li>Invest in evaluation infrastructure early—it pays dividends as you scale</li>
              <li>The goal isn't perfect tests, it's continuous improvement guided by data</li>
            </ol>

            <div className="rounded-lg border border-border bg-card p-6 mt-8">
              <h3 className="text-lg font-semibold mb-3">Ready to Level Up Your AI Testing?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our platform supports all stages of AI evaluation—from test sets to LLM judges to production A/B tests. 
                Start with our evaluation guide.
              </p>
              <Button asChild>
                <Link href="/guides/evaluation-types">Explore Evaluation Types</Link>
              </Button>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}