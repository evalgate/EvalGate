import { CheckCircle2, Copy, Rocket } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { PublicPageHeader } from "@/components/public-page-header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function QuickStartPage() {
	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			<PublicPageHeader />

			{/* Main Content */}
			<main className="flex-1">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
					{/* Hero */}
					<div className="mb-12">
						<h1 className="text-4xl font-bold mb-4">Quick Start Guide</h1>
						<p className="text-xl text-muted-foreground mb-2">
							Get started with the EvalAI SDK in under 5 minutes
						</p>
						<p className="text-muted-foreground">
							<strong>EvalAI is CI for AI behavior.</strong> LLMs drift silently
							— EvalAI turns evaluations into CI gates so regressions never
							reach production.
						</p>
					</div>

					{/* One-Command CI (EvalAI 1.9.1) */}
					<Card className="mb-8 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Rocket className="h-5 w-5 text-blue-500" />
								One-Command CI (EvalAI 1.9.1)
							</CardTitle>
							<CardDescription>
								Complete CI pipeline in a single command. No config needed.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
								<pre>{`# Add this to .github/workflows/evalai.yml
name: EvalAI CI
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
          path: .evalai/`}</pre>
							</div>
							<p className="text-sm text-muted-foreground">
								That&apos;s it! Your CI now automatically discovers specs, runs
								only impacted tests, compares against baseline, and posts rich
								summaries in PRs.
							</p>
						</CardContent>
					</Card>

					{/* Zero-Config Fast Path */}
					<Card className="mb-8 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Rocket className="h-5 w-5 text-green-500" />
								Traditional Setup (2 minutes)
							</CardTitle>
							<CardDescription>
								For existing projects or when you need more control
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
								<pre>{`npx @pauly4010/evalai-sdk init    # detects repo, creates baseline, installs CI workflow
git add evals/ .github/workflows/evalai-gate.yml evalai.config.json
git commit -m "chore: add EvalAI regression gate"
git push                           # open a PR → CI blocks regressions`}</pre>
							</div>
							<p className="text-sm text-muted-foreground">
								That&apos;s it.{" "}
								<code className="bg-muted px-1.5 py-0.5 rounded">
									evalai init
								</code>{" "}
								detects your package manager, runs your tests to capture a
								baseline, and scaffolds everything. No account required for
								local gating.
							</p>
							<div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
								<div className="p-3 bg-background rounded-lg border">
									<p className="font-medium">Run gate locally</p>
									<code className="text-xs text-muted-foreground">
										npx evalai gate
									</code>
								</div>
								<div className="p-3 bg-background rounded-lg border">
									<p className="font-medium">Update baseline</p>
									<code className="text-xs text-muted-foreground">
										npx evalai baseline update
									</code>
								</div>
								<div className="p-3 bg-background rounded-lg border">
									<p className="font-medium">Upgrade to full gate</p>
									<code className="text-xs text-muted-foreground">
										npx evalai upgrade --full
									</code>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Python Quickstart */}
					<Card className="mb-8 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Rocket className="h-5 w-5 text-amber-500" />
								Python Quickstart
							</CardTitle>
							<CardDescription>
								Same CI gate, same quality checks. Full parity with TypeScript.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
								<pre>{`pip install pauly4010-evalai-sdk`}</pre>
							</div>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
								<pre>{`from evalai_sdk import expect

result = expect("The capital of France is Paris.").to_contain("Paris")
print(result.passed)  # True`}</pre>
							</div>
							<p className="text-sm text-muted-foreground">
								No API key needed for local assertions. For platform traces and
								evaluations, use{" "}
								<code className="bg-muted px-1.5 py-0.5 rounded">
									AIEvalClient
								</code>
								. See{" "}
								<Link href="/sdk" className="text-primary hover:underline">
									SDK page
								</Link>{" "}
								for full Python examples.
							</p>
						</CardContent>
					</Card>

					<div className="relative mb-8">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-background px-2 text-muted-foreground">
								Or set up manually with the platform
							</span>
						</div>
					</div>

					{/* Prerequisites */}
					<Card className="mb-8">
						<CardHeader>
							<CardTitle>Prerequisites</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2 text-muted-foreground">
								<li className="flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 text-green-500" />
									Node.js 18.0.0 or higher
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 text-green-500" />
									npm, yarn, or pnpm package manager
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 text-green-500" />
									Python 3.8+ (for Python SDK)
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 text-green-500" />
									An EvalAI account (sign up above)
								</li>
							</ul>
						</CardContent>
					</Card>

					{/* Step 1: Create API Key */}
					<div className="mb-8">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
								1
							</div>
							<h2 className="text-2xl font-bold">Create an API Key</h2>
						</div>
						<Card>
							<CardContent className="pt-6">
								<ol className="space-y-3 text-muted-foreground">
									<li>
										1. Navigate to the{" "}
										<Link
											href="/developer"
											className="text-primary hover:underline"
										>
											Developer Dashboard
										</Link>
									</li>
									<li>2. Scroll down to the "API Keys" section</li>
									<li>3. Click "Create API Key"</li>
									<li>4. Enter a name (e.g., "Development Key")</li>
									<li>
										5. Select the scopes you need (start with all for testing)
									</li>
									<li>6. Click "Create Key"</li>
									<li>
										7. <strong>Copy and save your API key immediately</strong> -
										you won&apos;t see it again!
									</li>
								</ol>
								<div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
									<p className="text-sm text-yellow-600 dark:text-yellow-500">
										<strong>Important:</strong> Your API key is shown only once.
										Store it securely!
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Step 2: Install SDK */}
					<div className="mb-8">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
								2
							</div>
							<h2 className="text-2xl font-bold">Install the SDK</h2>
						</div>
						<Card>
							<CardContent className="pt-6">
								<p className="text-muted-foreground mb-4">
									Install the EvalAI SDK in your project using your preferred
									package manager:
								</p>
								<div className="space-y-3">
									<div className="bg-muted p-4 rounded-lg font-mono text-sm">
										<div className="flex items-center justify-between">
											<span>npm install @pauly4010/evalai-sdk</span>
											<Button size="sm" variant="ghost">
												<Copy className="h-3 w-3" />
											</Button>
										</div>
									</div>
									<div className="bg-muted p-4 rounded-lg font-mono text-sm">
										<div className="flex items-center justify-between">
											<span>yarn add @pauly4010/evalai-sdk</span>
											<Button size="sm" variant="ghost">
												<Copy className="h-3 w-3" />
											</Button>
										</div>
									</div>
									<div className="bg-muted p-4 rounded-lg font-mono text-sm">
										<div className="flex items-center justify-between">
											<span>pnpm add @pauly4010/evalai-sdk</span>
											<Button size="sm" variant="ghost">
												<Copy className="h-3 w-3" />
											</Button>
										</div>
									</div>
									<p className="text-sm font-semibold mt-4 mb-2">Python</p>
									<div className="bg-muted p-4 rounded-lg font-mono text-sm">
										<div className="flex items-center justify-between">
											<span>pip install pauly4010-evalai-sdk</span>
											<Button size="sm" variant="ghost">
												<Copy className="h-3 w-3" />
											</Button>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Step 3: Configure Environment */}
					<div className="mb-8">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
								3
							</div>
							<h2 className="text-2xl font-bold">
								Configure Environment Variables
							</h2>
						</div>
						<Card>
							<CardContent className="pt-6">
								<p className="text-muted-foreground mb-4">
									Create a{" "}
									<code className="bg-muted px-2 py-1 rounded">.env</code> file
									in your project root:
								</p>
								<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
									<pre>{`EVALAI_API_KEY=sk_test_your_api_key_here
EVALAI_ORGANIZATION_ID=your_org_id_here`}</pre>
								</div>
								<div className="space-y-3 text-sm text-muted-foreground">
									<p>
										<strong>Where to find these values:</strong>
									</p>
									<ul className="list-disc list-inside space-y-1 ml-4">
										<li>
											<code className="bg-muted px-1 rounded">
												EVALAI_API_KEY
											</code>{" "}
											- From the API key creation dialog
										</li>
										<li>
											<code className="bg-muted px-1 rounded">
												EVALAI_ORGANIZATION_ID
											</code>{" "}
											- Shown in the API key creation dialog
										</li>
									</ul>
								</div>
								<div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
									<p className="text-sm text-blue-600 dark:text-blue-400">
										<strong>Security Tip:</strong> Add{" "}
										<code className="bg-muted px-1 rounded">.env</code> to your{" "}
										<code className="bg-muted px-1 rounded">.gitignore</code>{" "}
										file to prevent committing secrets!
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Step 4: Initialize Client */}
					<div className="mb-8">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
								4
							</div>
							<h2 className="text-2xl font-bold">Initialize the Client</h2>
						</div>
						<Card>
							<CardContent className="pt-6">
								<p className="text-muted-foreground mb-4">
									Import and initialize the SDK in your code:
								</p>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									TypeScript
								</p>
								<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
									<pre>{`import { AIEvalClient } from '@pauly4010/evalai-sdk'

// Auto-loads from environment variables
const client = AIEvalClient.init()

// Or with explicit configuration
const client = new AIEvalClient({
  apiKey: process.env.EVALAI_API_KEY,
  organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
  debug: true // Enable debug logging
})`}</pre>
								</div>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									Python
								</p>
								<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
									<pre>{`from evalai_sdk import AIEvalClient

# Auto-loads from environment variables
client = AIEvalClient.init()

# Or with explicit configuration
client = AIEvalClient(
    api_key=os.environ["EVALAI_API_KEY"],
    organization_id=int(os.environ["EVALAI_ORGANIZATION_ID"]),
    debug=True
)`}</pre>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Step 5: Create Your First Trace */}
					<div className="mb-8">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
								5
							</div>
							<h2 className="text-2xl font-bold">Create Your First Trace</h2>
						</div>
						<Card>
							<CardContent className="pt-6">
								<p className="text-muted-foreground mb-4">
									Track your first LLM call:
								</p>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									TypeScript
								</p>
								<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
									<pre>{`// Create a trace
const trace = await client.traces.create({
  name: 'Chat Completion',
  traceId: 'trace-' + Date.now(),
  metadata: {
    userId: 'user-123',
    model: 'gpt-4'
  }
})

console.log('Trace created:', trace.id)

// Add a span to track the LLM call
const span = await client.traces.createSpan(trace.id, {
  name: 'OpenAI API Call',
  spanId: 'span-' + Date.now(),
  type: 'llm',
  startTime: new Date().toISOString(),
  input: 'What is AI?',
  output: 'AI is artificial intelligence...',
  metadata: {
    model: 'gpt-4',
    tokens: 150,
    latency: 1200
  }
})

console.log('Span created:', span.id)`}</pre>
								</div>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									Python
								</p>
								<div className="bg-muted p-4 rounded-lg font-mono text-sm">
									<pre>{`from evalai_sdk.types import CreateTraceParams, CreateSpanParams

# Create a trace
trace = await client.traces.create(CreateTraceParams(
    name="Chat Completion",
    trace_id=f"trace-{int(time.time() * 1000)}",
    metadata={"userId": "user-123", "model": "gpt-4"}
))

print(f"Trace created: {trace.id}")

# Add a span to track the LLM call
span = await client.traces.create_span(trace.id, CreateSpanParams(
    name="OpenAI API Call",
    span_id=f"span-{int(time.time() * 1000)}",
    type="llm",
    start_time=datetime.now().isoformat(),
    input="What is AI?",
    output="AI is artificial intelligence...",
    metadata={"model": "gpt-4", "tokens": 150, "latency": 1200}
))

print(f"Span created: {span.id}")`}</pre>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Step 6: Write Your First Eval */}
					<div className="mb-8">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
								6
							</div>
							<h2 className="text-2xl font-bold">Write Your First Eval</h2>
						</div>
						<Card>
							<CardContent className="pt-6">
								<p className="text-muted-foreground mb-4">
									Now that you can trace, let&apos;s evaluate. The SDK includes
									a test suite runner with 20+ built-in assertions designed for
									LLM outputs.
								</p>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									TypeScript
								</p>
								<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
									<pre>{`import { createTestSuite, expect } from '@pauly4010/evalai-sdk';

const suite = createTestSuite('My First Eval', {
  executor: async (input) => await myLLM(input),
  cases: [{
    input: 'Summarize this document...',
    assertions: [
      (output) => expect(output).toHaveLength({ min: 50, max: 500 }),
      (output) => expect(output).toNotContainPII(),
      (output) => expect(output).toHaveSentiment('neutral'),
    ]
  }]
});

const { total, passed, failed } = await suite.run();
console.log(\`Results: \${passed}/\${total} passed\`);`}</pre>
								</div>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									Python
								</p>
								<div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
									<pre>{`from evalai_sdk import create_test_suite, expect

suite = create_test_suite("My First Eval",
    executor=lambda input: my_llm(input),
    cases=[{
        "input": "Summarize this document...",
        "assertions": [
            lambda output: expect(output).to_have_length(min=50, max=500),
            lambda output: expect(output).to_not_contain_pii(),
            lambda output: expect(output).to_have_sentiment("neutral"),
        ]
    }]
)

results = await suite.run()
print(f"Results: {results.passed}/{results.total} passed")`}</pre>
								</div>
								<div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
									<p className="text-sm text-blue-600 dark:text-blue-400">
										<strong>Explore all 20+ assertions</strong> including
										hallucination detection, JSON validation, and profanity
										checks.{" "}
										<Link
											href="/sdk#assertions"
											className="underline hover:no-underline"
										>
											View the full assertion library &rarr;
										</Link>
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Next Steps */}
					<Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Rocket className="h-5 w-5" />
								Next Steps
							</CardTitle>
							<CardDescription>
								Now that you&apos;re set up, explore these features:
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid md:grid-cols-2 gap-4">
								<Link href="/sdk#assertions" className="block">
									<Card className="h-full hover:bg-accent transition-colors cursor-pointer">
										<CardContent className="pt-6">
											<h3 className="font-semibold mb-2">Assertion Library</h3>
											<p className="text-sm text-muted-foreground">
												20+ built-in assertions for LLM outputs
											</p>
										</CardContent>
									</Card>
								</Link>
								<Link href="/guides/openai-integration" className="block">
									<Card className="h-full hover:bg-accent transition-colors cursor-pointer">
										<CardContent className="pt-6">
											<h3 className="font-semibold mb-2">OpenAI Integration</h3>
											<p className="text-sm text-muted-foreground">
												Automatically trace OpenAI calls
											</p>
										</CardContent>
									</Card>
								</Link>
								<Link href="/guides/llm-judge" className="block">
									<Card className="h-full hover:bg-accent transition-colors cursor-pointer">
										<CardContent className="pt-6">
											<h3 className="font-semibold mb-2">LLM Judge</h3>
											<p className="text-sm text-muted-foreground">
												Use AI to evaluate AI outputs
											</p>
										</CardContent>
									</Card>
								</Link>
								<Link href="/api-reference" className="block">
									<Card className="h-full hover:bg-accent transition-colors cursor-pointer">
										<CardContent className="pt-6">
											<h3 className="font-semibold mb-2">API Reference</h3>
											<p className="text-sm text-muted-foreground">
												Complete API documentation
											</p>
										</CardContent>
									</Card>
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Help Section */}
					<div className="mt-12 text-center">
						<h3 className="text-xl font-semibold mb-4">Need Help?</h3>
						<div className="flex gap-4 justify-center">
							<Button variant="outline" asChild>
								<Link href="/documentation">View Documentation</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link href="/contact">Contact Support</Link>
							</Button>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<Footer />
		</div>
	);
}
