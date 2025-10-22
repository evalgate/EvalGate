import { Button } from "@/components/ui/button"
import { PublicPageHeader } from "@/components/public-page-header"
import { Footer } from "@/components/footer"
import { ArrowLeft, GitBranch, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"

export default function CICDIntegrationGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicPageHeader />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold tracking-tight">CI/CD Integration</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Integrate LLM evaluation into your continuous integration and deployment pipeline
          </p>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Why CI/CD for LLMs?</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              Just like traditional software, your LLM applications need automated testing in the development workflow:
            </p>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <h3 className="text-base sm:text-lg font-semibold">Catch Regressions Early</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Detect quality degradation before it reaches production
                </p>
              </div>
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <h3 className="text-base sm:text-lg font-semibold">Faster Iteration</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Get immediate feedback on prompt and model changes
                </p>
              </div>
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <h3 className="text-base sm:text-lg font-semibold">Team Confidence</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Deploy with confidence knowing tests have passed
                </p>
              </div>
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <h3 className="text-base sm:text-lg font-semibold">Compliance & Audit</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Maintain test history and quality standards
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">GitHub Actions Setup</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              Add evaluation to your GitHub Actions workflow:
            </p>
            <div className="rounded-md bg-muted p-3 sm:p-4 overflow-x-auto">
              <code className="text-xs sm:text-sm">
                {`name: LLM Evaluation

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run evaluations
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          EVAL_PLATFORM_KEY: \${{ secrets.EVAL_PLATFORM_KEY }}
        run: npm run evaluate
      
      - name: Check pass threshold
        run: npm run check-threshold -- --min-score 0.8`}
              </code>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">GitLab CI Configuration</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              For GitLab users, add this to your .gitlab-ci.yml:
            </p>
            <div className="rounded-md bg-muted p-3 sm:p-4 overflow-x-auto">
              <code className="text-xs sm:text-sm">
                {`evaluate:
  stage: test
  image: node:18
  script:
    - npm install
    - npm run evaluate
    - npm run check-threshold -- --min-score 0.8
  variables:
    OPENAI_API_KEY: $OPENAI_API_KEY
    EVAL_PLATFORM_KEY: $EVAL_PLATFORM_KEY
  only:
    - merge_requests
    - main`}
              </code>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Setting Quality Gates</h2>
            <div className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                <h3 className="text-base sm:text-lg font-semibold">Defining Thresholds</h3>
              </div>
              <p className="mb-3 sm:mb-4 text-sm sm:text-base text-muted-foreground">
                Configure minimum scores for different evaluation criteria:
              </p>
              <div className="rounded-md bg-muted p-3 sm:p-4">
                <code className="text-xs sm:text-sm">
                  {`{
  "thresholds": {
    "accuracy": 0.85,
    "relevance": 0.80,
    "safety": 1.0,
    "latency_p95": 2000
  },
  "failOnViolation": true
}`}
                </code>
              </div>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 sm:p-6">
              <div className="mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                <h3 className="text-base sm:text-lg font-semibold">Blocking Deployments</h3>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                When evaluations fail, the CI pipeline will block the merge/deployment until issues are resolved.
                This ensures only high-quality changes make it to production.
              </p>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Best Practices</h2>
            <ul className="space-y-3 text-sm sm:text-base text-muted-foreground">
              <li>• <strong>Keep tests fast:</strong> Use a subset of test cases in CI, run full suite nightly</li>
              <li>• <strong>Cache dependencies:</strong> Speed up builds by caching npm packages and models</li>
              <li>• <strong>Parallel execution:</strong> Run independent test suites in parallel when possible</li>
              <li>• <strong>Clear reporting:</strong> Generate easy-to-read reports showing what failed and why</li>
              <li>• <strong>Version control:</strong> Store test cases and thresholds in version control</li>
              <li>• <strong>Cost monitoring:</strong> Track API costs to avoid expensive CI runs</li>
            </ul>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Example Evaluation Script</h2>
            <div className="rounded-md bg-muted p-3 sm:p-4 overflow-x-auto">
              <code className="text-xs sm:text-sm">
                {`// evaluate.js
import { Platform } from '@eval-platform/sdk'

const platform = new Platform({
  apiKey: process.env.EVAL_PLATFORM_KEY
})

async function runEvaluation() {
  const results = await platform.evaluate({
    model: 'my-llm-app',
    testCases: './tests/test-cases.json',
    judges: ['accuracy', 'relevance', 'safety']
  })
  
  console.log(\`Accuracy: \${results.metrics.accuracy}\`)
  console.log(\`Relevance: \${results.metrics.relevance}\`)
  console.log(\`Safety: \${results.metrics.safety}\`)
  
  // Exit with error if below threshold
  if (results.metrics.accuracy < 0.85) {
    process.exit(1)
  }
}

runEvaluation()`}
              </code>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/dashboard">Set Up CI/CD</Link>
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