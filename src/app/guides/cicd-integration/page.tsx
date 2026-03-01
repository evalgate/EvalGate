import { ArrowLeft, CheckCircle2, GitBranch, XCircle } from "lucide-react";
import Link from "next/link";
import { PublicPageHeader } from "@/components/public-page-header";
import { Button } from "@/components/ui/button";

export default function CICDIntegrationGuidePage() {
	return (
		<div className="min-h-screen bg-background">
			<PublicPageHeader />
			<div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
				<Link
					href="/guides"
					className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
					Back to Guides
				</Link>

				<div className="mb-6 sm:mb-8">
					<h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold tracking-tight">
						CI/CD Integration
					</h1>
					<p className="text-base sm:text-lg text-muted-foreground">
						Integrate LLM evaluation into your continuous integration and
						deployment pipeline
					</p>
				</div>

				<div className="prose prose-sm sm:prose-base max-w-none">
					<section className="mb-8 sm:mb-12">
						<h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">
							Why CI/CD for LLMs?
						</h2>
						<p className="mb-4 text-sm sm:text-base text-muted-foreground">
							Just like traditional software, your LLM applications need
							automated testing in the development workflow:
						</p>
						<div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
							<div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
								<div className="mb-2 flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
									<h3 className="text-base sm:text-lg font-semibold">
										Catch Regressions Early
									</h3>
								</div>
								<p className="text-sm sm:text-base text-muted-foreground">
									Detect quality degradation before it reaches production
								</p>
							</div>
							<div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
								<div className="mb-2 flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
									<h3 className="text-base sm:text-lg font-semibold">
										Faster Iteration
									</h3>
								</div>
								<p className="text-sm sm:text-base text-muted-foreground">
									Get immediate feedback on prompt and model changes
								</p>
							</div>
							<div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
								<div className="mb-2 flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
									<h3 className="text-base sm:text-lg font-semibold">
										Team Confidence
									</h3>
								</div>
								<p className="text-sm sm:text-base text-muted-foreground">
									Deploy with confidence knowing tests have passed
								</p>
							</div>
							<div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 sm:p-5">
								<div className="mb-2 flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
									<h3 className="text-base sm:text-lg font-semibold">
										Compliance & Audit
									</h3>
								</div>
								<p className="text-sm sm:text-base text-muted-foreground">
									Maintain test history and quality standards
								</p>
							</div>
						</div>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">
							🚀 One-Command CI Setup (EvalAI 1.9.1)
						</h2>
						<p className="mb-4 text-sm sm:text-base text-muted-foreground">
							With EvalAI 1.9.1, you get a complete CI pipeline in a single
							command:
						</p>
						<div className="rounded-md bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 p-4 sm:p-4 mb-6">
							<code className="text-xs sm:text-sm">
								{`name: EvalAI CI
on: [push, pull_request]
jobs:
  evalai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx evalai ci --format github --write-results --base main
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: evalai-results
          path: .evalai/`}
							</code>
						</div>
						<p className="mb-4 text-sm sm:text-base text-muted-foreground">
							That's it! This single command does everything:
						</p>
						<div className="grid gap-3 sm:gap-4">
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle2 className="h-4 w-4 text-green-500" />
								<span>Discovers evaluation specs automatically</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle2 className="h-4 w-4 text-green-500" />
								<span>Runs only impacted specs (smart caching)</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle2 className="h-4 w-4 text-green-500" />
								<span>Compares results against base branch</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle2 className="h-4 w-4 text-green-500" />
								<span>Posts rich summary in PR with regressions</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle2 className="h-4 w-4 text-green-500" />
								<span>
									Exits with proper codes (0=clean, 1=regressions, 2=config)
								</span>
							</div>
						</div>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">
							Legacy Setup (Pre-1.9.1)
						</h2>
						<p className="mb-4 text-sm sm:text-base text-muted-foreground">
							For existing workflows, you can use the traditional regression
							gate:
						</p>
						<p className="mb-2 text-sm sm:text-base text-muted-foreground">
							<strong>Option A: Zero-config</strong> — run{" "}
							<code className="bg-muted px-1 rounded">
								npx @pauly4010/evalai-sdk init
							</code>{" "}
							to auto-generate this workflow.
						</p>
						<div className="rounded-md bg-muted p-3 sm:p-4 overflow-x-auto">
							<code className="text-xs sm:text-sm">
								{`name: EvalAI CI Gate

on:
  pull_request:
    branches: [main]

jobs:
  eval-gate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci

      # Option A: Local gate (no API key needed)
      - name: EvalAI regression gate
        run: npx evalai gate --format github

      # Option B: Platform gate (requires API key)
      # - name: EvalAI quality gate
      #   env:
      #     EVALAI_API_KEY: \${{ secrets.EVALAI_API_KEY }}
      #   run: npx evalai check --format github --onFail import`}
							</code>
						</div>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">
							GitLab CI Configuration
						</h2>
						<p className="mb-4 text-sm sm:text-base text-muted-foreground">
							For GitLab users, add this to your .gitlab-ci.yml:
						</p>
						<div className="rounded-md bg-muted p-3 sm:p-4 overflow-x-auto">
							<code className="text-xs sm:text-sm">
								{`eval-gate:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx evalai gate --format json
  only:
    - merge_requests
    - main`}
							</code>
						</div>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">
							Setting Quality Gates
						</h2>
						<div className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
							<div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
								<GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
								<h3 className="text-base sm:text-lg font-semibold">
									Defining Thresholds
								</h3>
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
								<h3 className="text-base sm:text-lg font-semibold">
									Blocking Deployments
								</h3>
							</div>
							<p className="text-sm sm:text-base text-muted-foreground">
								When evaluations fail, the CI pipeline will block the
								merge/deployment until issues are resolved. This ensures only
								high-quality changes make it to production.
							</p>
						</div>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">
							Best Practices
						</h2>
						<ul className="space-y-3 text-sm sm:text-base text-muted-foreground">
							<li>
								• <strong>Keep tests fast:</strong> Use a subset of test cases
								in CI, run full suite nightly
							</li>
							<li>
								• <strong>Cache dependencies:</strong> Speed up builds by
								caching npm packages and models
							</li>
							<li>
								• <strong>Parallel execution:</strong> Run independent test
								suites in parallel when possible
							</li>
							<li>
								• <strong>Clear reporting:</strong> Generate easy-to-read
								reports showing what failed and why
							</li>
							<li>
								• <strong>Version control:</strong> Store test cases and
								thresholds in version control
							</li>
							<li>
								• <strong>Cost monitoring:</strong> Track API costs to avoid
								expensive CI runs
							</li>
						</ul>
					</section>

					<section className="mb-8 sm:mb-12">
						<h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">
							CLI Commands Reference
						</h2>
						<div className="rounded-md bg-muted p-3 sm:p-4 overflow-x-auto">
							<code className="text-xs sm:text-sm">
								{`# Setup (run once)
npx @pauly4010/evalai-sdk init     # scaffolds everything: baseline, CI workflow, config

# Gate commands
npx evalai gate                     # run regression gate locally
npx evalai gate --format github     # CI step summary + PR annotations
npx evalai gate --format json       # machine-readable output

# Baseline management
npx evalai baseline update           # re-run tests and update baseline

# Platform gate (requires API key)
npx evalai check --format github --onFail import

# Diagnostics
npx evalai doctor                    # verify CI/CD setup`}
							</code>
						</div>
					</section>

					<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
						<Button asChild size="lg" className="w-full sm:w-auto">
							<Link href="/dashboard">Set Up CI/CD</Link>
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
				</div>
			</div>
		</div>
	);
}
