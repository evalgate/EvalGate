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
        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild className="mb-4 sm:mb-6">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Back to Blog
          </Link>
        </Button>

        {/* Article Header */}
        <article>
          <div className="mb-6 sm:mb-8">
            <div className="inline-block bg-blue-500/10 text-blue-500 px-2.5 sm:px-3 py-1 rounded text-xs font-medium mb-3 sm:mb-4">
              Best Practices
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Why Every AI Product Needs Evaluation</h1>
            <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>October 13, 2025</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>8 min read</span>
              </div>
            </div>
          </div>

          {/* Article Content */}
          <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base">
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              Traditional testing falls short for LLM applications. Learn why evaluation is critical 
              for AI products and how to get started with a comprehensive evaluation strategy.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Testing Gap in AI Products</h2>
            <p className="text-muted-foreground mb-4">
              If you're building with LLMs, you've probably noticed something unsettling: traditional 
              software testing doesn't work. Unit tests can't capture semantic quality. Integration 
              tests miss edge cases in natural language. And production issues often slip through 
              undetected until users complain.
            </p>
            <p className="text-muted-foreground mb-4">
              This isn't a tooling problem—it's a fundamental shift. LLM outputs are probabilistic, 
              context-dependent, and subjective. A chatbot response that's perfect for one user might 
              be completely wrong for another. How do you test for that?
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Why Evaluation Matters</h2>
            <p className="text-muted-foreground mb-4">
              Evaluation is the systematic process of measuring AI system quality across dimensions 
              that matter for your use case:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Accuracy:</strong> Does the output match the expected result?</li>
              <li><strong>Relevance:</strong> Is the response on-topic and helpful?</li>
              <li><strong>Safety:</strong> Does it avoid harmful, biased, or inappropriate content?</li>
              <li><strong>Consistency:</strong> Do similar inputs produce similar outputs?</li>
              <li><strong>Latency:</strong> Is it fast enough for your use case?</li>
              <li><strong>Cost:</strong> Are you spending tokens efficiently?</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              Without systematic evaluation, you're flying blind. You might ship a prompt change that 
              improves responses for one scenario but breaks three others. You might not notice when 
              a model update degrades quality. And you'll struggle to justify engineering decisions 
              with data.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Four Types of AI Evaluation</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">1. Unit Tests (Code-Level Validation)</h3>
            <p className="text-muted-foreground mb-4">
              Start with deterministic checks on your pipeline before you even call an LLM. Validate 
              input formatting, API schemas, and business logic. These are fast, cheap, and catch bugs 
              early.
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
                {`// Example: Validate RAG retrieval before generation
test("retrieval returns relevant documents", () => {
  const docs = retrieve("What is evaluation?")
  expect(docs.length).toBeGreaterThan(0)
  expect(docs[0].score).toBeGreaterThan(0.7)
})`}
              </code>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">2. Human Evaluation (Ground Truth)</h3>
            <p className="text-muted-foreground mb-4">
              Have domain experts review outputs and label them as good/bad. This is slow and expensive, 
              but provides the gold standard for training and validating other evaluation methods.
            </p>
            <p className="text-muted-foreground mb-4">
              Use human eval for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Building initial test sets</li>
              <li>Validating LLM judge rubrics</li>
              <li>Auditing production outputs</li>
              <li>Handling edge cases and disputes</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">3. LLM-as-a-Judge (Scalable Automation)</h3>
            <p className="text-muted-foreground mb-4">
              Use a strong LLM (like GPT-4 or Claude) to evaluate outputs from your production model. 
              With well-designed rubrics, LLM judges can approximate human judgment at 1/100th the cost 
              and 100x the speed.
            </p>
            <p className="text-muted-foreground mb-4">
              LLM judges work well for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Semantic similarity and relevance</li>
              <li>Tone and style adherence</li>
              <li>Factual consistency checks</li>
              <li>Safety and bias detection</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">4. A/B Testing (Production Validation)</h3>
            <p className="text-muted-foreground mb-4">
              The ultimate test: which version performs better with real users? Run controlled experiments 
              in production to measure impact on metrics that matter—user satisfaction, task completion, 
              retention.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Building Your Evaluation Strategy</h2>
            <p className="text-muted-foreground mb-4">
              Start simple and iterate:
            </p>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Define success metrics:</strong> What does "good" look like for your use case?</li>
              <li><strong>Create a test set:</strong> 20-50 representative examples with expected outputs</li>
              <li><strong>Run baseline evals:</strong> Measure current performance before making changes</li>
              <li><strong>Iterate with confidence:</strong> Test every prompt and model change against your test set</li>
              <li><strong>Scale with LLM judges:</strong> Automate evaluation as your test set grows</li>
              <li><strong>Validate in production:</strong> A/B test significant changes with real users</li>
            </ol>

            <h2 className="text-2xl font-bold mb-4 mt-8">Common Pitfalls to Avoid</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Over-optimizing for a small test set:</strong> Leads to overfitting and poor generalization</li>
              <li><strong>Ignoring edge cases:</strong> Your test set should include difficult, ambiguous examples</li>
              <li><strong>Chasing vanity metrics:</strong> "95% accuracy" means nothing if users are unhappy</li>
              <li><strong>Skipping baseline measurements:</strong> You can't improve what you don't measure</li>
              <li><strong>Not versioning test sets:</strong> Track how your evaluation criteria evolve over time</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">Getting Started Today</h2>
            <p className="text-muted-foreground mb-4">
              You don't need a perfect evaluation system to start. Begin with:
            </p>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Pick 10 examples that represent your use case</li>
              <li>Write down what "good" looks like for each</li>
              <li>Run your current system and manually score the outputs</li>
              <li>Make one improvement and measure if it helps</li>
            </ol>
            <p className="text-muted-foreground mb-4">
              That's it. You're now evaluating your AI system. From there, you can build more sophisticated 
              test sets, automate with LLM judges, and integrate evaluation into your development workflow.
            </p>

            <div className="rounded-lg border border-border bg-card p-6 mt-8">
              <h3 className="text-lg font-semibold mb-3">Ready to Build Better AI Products?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our platform makes it easy to evaluate, trace, and improve your LLM applications. 
                Start with our quick start guide or explore our evaluation templates.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/guides/quick-start">Get Started</Link>
                </Button>
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <Link href="/documentation">View Docs</Link>
                </Button>
              </div>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}