import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { ArrowLeft } from "lucide-react"
import { PublicPageHeader } from "@/components/public-page-header"

export default function EvaluationTypesGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Understanding Evaluation Types</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Learn the differences between unit tests, human evaluation, LLM judges, and A/B testing.
          </p>
          <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <span>8 min read</span>
            <span>•</span>
            <span>Getting Started</span>
          </div>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <p>
            The AI Evaluation Platform supports four distinct evaluation methodologies, each serving different 
            purposes in your AI development lifecycle. Understanding when to use each type is key to building 
            reliable AI systems.
          </p>

          <h2>1. Unit Tests</h2>
          <p>
            <strong>Best for:</strong> Regression testing, deterministic behavior, continuous integration
          </p>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">How It Works</h3>
            <p>
              Unit tests define explicit input/output pairs and assertion rules. They pass or fail based on 
              deterministic criteria like exact string matching, regex patterns, or programmatic checks.
            </p>
          </div>
          <p><strong>When to use:</strong></p>
          <ul>
            <li>Testing specific functionality (e.g., "extract email from text")</li>
            <li>Preventing regressions after model updates</li>
            <li>CI/CD pipelines requiring fast, automated checks</li>
            <li>Validating structured outputs (JSON, SQL, code)</li>
          </ul>
          <p><strong>Limitations:</strong> Can be brittle for creative or open-ended tasks.</p>

          <h2>2. Human Evaluation</h2>
          <p>
            <strong>Best for:</strong> Subjective quality, nuanced tasks, ground truth establishment
          </p>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">How It Works</h3>
            <p>
              Human evaluators review AI outputs and provide ratings or feedback. The platform presents 
              test cases to annotators, collects their judgments, and aggregates results into quality scores.
            </p>
          </div>
          <p><strong>When to use:</strong></p>
          <ul>
            <li>Evaluating creative content (writing, design, recommendations)</li>
            <li>Assessing helpfulness, tone, or empathy</li>
            <li>Creating gold-standard datasets for training LLM judges</li>
            <li>When automated metrics miss important nuances</li>
          </ul>
          <p><strong>Limitations:</strong> Slow, expensive, and doesn't scale to large test suites.</p>

          <h2>3. LLM Judge</h2>
          <p>
            <strong>Best for:</strong> Scalable quality assessment, complex reasoning tasks, mimicking human judgment
          </p>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">How It Works</h3>
            <p>
              A separate LLM (the "judge") evaluates outputs from your target LLM based on custom rubrics. 
              The judge scores outputs on dimensions like accuracy, relevance, helpfulness, or safety.
            </p>
          </div>
          <p><strong>When to use:</strong></p>
          <ul>
            <li>Scaling human-like evaluation to 1000s of test cases</li>
            <li>Assessing open-ended tasks where exact matches aren't possible</li>
            <li>Multi-dimensional scoring (accuracy + tone + safety)</li>
            <li>Continuous monitoring of production outputs</li>
          </ul>
          <p><strong>Best practices:</strong></p>
          <ul>
            <li>Train judges on human-labeled examples</li>
            <li>Use powerful models (GPT-4, Claude) as judges</li>
            <li>Create detailed rubrics with examples</li>
            <li>Validate judge alignment with human ratings</li>
          </ul>
          <p><strong>Limitations:</strong> Judges can have biases and may not catch all edge cases.</p>

          <h2>4. A/B Testing</h2>
          <p>
            <strong>Best for:</strong> Production experimentation, comparing model versions, data-driven decisions
          </p>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">How It Works</h3>
            <p>
              Traffic is split between two variants (e.g., old prompt vs. new prompt, GPT-3.5 vs. GPT-4). 
              Statistical analysis determines which performs better based on real user interactions.
            </p>
          </div>
          <p><strong>When to use:</strong></p>
          <ul>
            <li>Testing prompt changes before full rollout</li>
            <li>Comparing model performance (GPT-4 vs. Claude)</li>
            <li>Optimizing for user engagement metrics</li>
            <li>Validating hypothesis about quality improvements</li>
          </ul>
          <p><strong>Metrics to track:</strong></p>
          <ul>
            <li>User satisfaction (thumbs up/down, ratings)</li>
            <li>Task completion rates</li>
            <li>Latency and cost</li>
            <li>Conversion or retention metrics</li>
          </ul>
          <p><strong>Limitations:</strong> Requires significant traffic and time to reach statistical significance.</p>

          <h2>Combining Evaluation Types</h2>
          <p>
            The most robust evaluation strategies use multiple types together:
          </p>
          <div className="bg-muted p-6 rounded-lg my-6">
            <p><strong>Example Workflow:</strong></p>
            <ol className="mb-0">
              <li><strong>Development:</strong> Run unit tests on every commit</li>
              <li><strong>Pre-release:</strong> Use LLM judge on comprehensive test suite</li>
              <li><strong>Validation:</strong> Human evaluation on sample of critical cases</li>
              <li><strong>Production:</strong> A/B test with real users to confirm improvements</li>
            </ol>
          </div>

          <h2>Choosing the Right Type</h2>
          <table className="w-full my-6">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2">Scenario</th>
                <th className="text-left py-2">Recommended Type</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2">Fast CI/CD checks</td>
                <td className="py-2">Unit Tests</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Establishing ground truth</td>
                <td className="py-2">Human Evaluation</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Scaling quality checks</td>
                <td className="py-2">LLM Judge</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Production optimization</td>
                <td className="py-2">A/B Testing</td>
              </tr>
            </tbody>
          </table>

          <h2>Next Steps</h2>
          <ul>
            <li><Link href="/guides/quick-start" className="text-blue-500 hover:underline">Create your first unit test evaluation</Link></li>
            <li><Link href="/guides/llm-judge" className="text-blue-500 hover:underline">Learn to build custom LLM judge rubrics</Link></li>
            <li><Link href="/guides/ab-testing" className="text-blue-500 hover:underline">Run your first A/B test in production</Link></li>
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
            <Link href="/guides/llm-judge" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Building Custom LLM Judge Rubrics</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Create domain-specific evaluation criteria</div>
            </Link>
            <Link href="/guides/ab-testing" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Running A/B Tests in Production</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Test changes with statistical rigor</div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}