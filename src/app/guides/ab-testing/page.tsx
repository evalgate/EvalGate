import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { PublicPageHeader } from "@/components/public-page-header"
import { ArrowLeft, GitBranch, TrendingUp, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function ABTestingGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicPageHeader />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold tracking-tight">A/B Testing for LLMs</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Learn how to run controlled experiments to improve your LLM applications in production
          </p>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Why A/B Test LLMs?</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              A/B testing allows you to validate changes to your LLM application with real users before full deployment.
              This is critical because:
            </p>
            <ul className="mb-4 space-y-2 text-sm sm:text-base text-muted-foreground">
              <li>• LLM outputs are non-deterministic and context-dependent</li>
              <li>• User preferences may differ from internal evaluations</li>
              <li>• Production data reveals edge cases not in test sets</li>
              <li>• Statistical significance reduces risk of bad deployments</li>
            </ul>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Setting Up an Experiment</h2>
            
            <div className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                <h3 className="text-base sm:text-lg font-semibold">Define Your Variants</h3>
              </div>
              <p className="mb-3 sm:mb-4 text-sm sm:text-base text-muted-foreground">
                Start by creating two or more variants of your LLM configuration:
              </p>
              <div className="rounded-md bg-muted p-3 sm:p-4">
                <code className="text-xs sm:text-sm">
                  {`const variants = {
  control: {
    model: "gpt-4",
    temperature: 0.7,
    prompt: "Answer concisely..."
  },
  treatment: {
    model: "gpt-4",
    temperature: 0.3,
    prompt: "Provide a detailed..."
  }
}`}
                </code>
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <h3 className="text-base sm:text-lg font-semibold">Choose Success Metrics</h3>
              </div>
              <p className="mb-3 sm:mb-4 text-sm sm:text-base text-muted-foreground">
                Define what success looks like for your experiment:
              </p>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>• <strong>User engagement:</strong> Click-through rates, time spent</li>
                <li>• <strong>Quality metrics:</strong> Thumbs up/down, user ratings</li>
                <li>• <strong>Task completion:</strong> Conversion rates, success rates</li>
                <li>• <strong>Performance:</strong> Latency, token usage</li>
              </ul>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Running the Experiment</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              Use our platform to randomly assign users to variants and track results:
            </p>
            <div className="rounded-md bg-muted p-3 sm:p-4">
              <code className="text-xs sm:text-sm">
                {`// Initialize experiment
const experiment = await platform.createExperiment({
  name: "prompt-optimization",
  variants: ["control", "treatment"],
  trafficSplit: [0.5, 0.5]
})

// Get variant for user
const variant = experiment.getVariant(userId)

// Track outcome
await experiment.track(userId, {
  variant,
  metric: "user_satisfaction",
  value: 4.5
})`}
              </code>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Analyzing Results</h2>
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 sm:p-6">
              <div className="mb-2 sm:mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                <h3 className="text-base sm:text-lg font-semibold">Statistical Significance</h3>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                Wait for statistical significance before making decisions. Our platform calculates p-values and
                confidence intervals automatically. Generally, you need:
              </p>
              <ul className="mt-3 space-y-1 text-sm sm:text-base text-muted-foreground">
                <li>• At least 100 samples per variant</li>
                <li>• p-value &lt; 0.05 for 95% confidence</li>
                <li>• Consistent results over time</li>
              </ul>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Best Practices</h2>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">Test One Thing</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Change only one variable at a time to understand what drives improvements
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">Run Long Enough</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Collect data for at least one full business cycle to account for variations
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">Monitor Cost</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Track token usage and API costs across variants to ensure improvements are cost-effective
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">Document Everything</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Keep detailed records of hypotheses, configurations, and results for future reference
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/dashboard">Start A/B Testing</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/guides">View All Guides</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}