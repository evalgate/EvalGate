import { CheckCircle2, ExternalLink, Sparkles, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
	title: "SDK Quick Start - EvalGate | CI for AI Behavior",
	description:
		"EvalGate 2.0.0: CI for AI behavior. One-command CI workflow, TypeScript & Python SDKs. 1.4k+ npm downloads/month. Stop LLM regressions before they reach production.",
	openGraph: {
		title: "SDK Quick Start - EvalGate | CI for AI Behavior",
		description:
			"EvalGate 2.0.0: CI for AI behavior. One-command CI workflow, TypeScript & Python SDKs. Stop LLM regressions before they reach production.",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "SDK Quick Start - EvalGate | CI for AI Behavior",
		description:
			"EvalGate 2.0.0: CI for AI behavior. One-command CI workflow, TypeScript & Python SDKs. Stop LLM regressions before they reach production.",
	},
};

const assertionGroups = [
	{
		name: "Text & Content",
		assertions: [
			{ method: "toEqual(expected)", desc: "Deep equality check" },
			{ method: "toContain(substring)", desc: "Substring presence" },
			{ method: "toContainKeywords(keywords[])", desc: "All keywords present" },
			{ method: "toNotContain(substring)", desc: "Substring absence" },
			{ method: "toMatchPattern(regex)", desc: "Regex pattern match" },
			{ method: "toHaveLength({ min, max })", desc: "Response length range" },
		],
	},
	{
		name: "Safety & Compliance",
		assertions: [
			{ method: "toNotContainPII()", desc: "No emails, phones, SSNs" },
			{ method: "toBeProfessional()", desc: "No profanity or slurs" },
			{
				method: "toNotHallucinate(facts[])",
				desc: "All facts grounded in source",
			},
		],
	},
	{
		name: "JSON & Structure",
		assertions: [
			{ method: "toBeValidJSON()", desc: "Parses as valid JSON" },
			{ method: "toMatchJSON(schema)", desc: "All schema keys present" },
			{ method: "toContainCode()", desc: "Contains code blocks" },
		],
	},
	{
		name: "Quality & Style",
		assertions: [
			{
				method: "toHaveSentiment(type)",
				desc: "Positive, negative, or neutral",
			},
			{
				method: "toHaveProperGrammar()",
				desc: "No double spaces or missing caps",
			},
		],
	},
	{
		name: "Numeric & Performance",
		assertions: [
			{ method: "toBeFasterThan(ms)", desc: "Latency threshold" },
			{ method: "toBeGreaterThan(n)", desc: "Numeric comparison" },
			{ method: "toBeLessThan(n)", desc: "Numeric comparison" },
			{ method: "toBeBetween(min, max)", desc: "Range check" },
			{ method: "toBeTruthy()", desc: "Truthy value check" },
			{ method: "toBeFalsy()", desc: "Falsy value check" },
		],
	},
];

export default function SDKPage() {
	const installCode = "npm install @evalgate/sdk\n# or\nyarn add @evalgate/sdk";

	const installCodePython = "pip install pauly4010-evalgate-sdk";

	const initCode = `import { AIEvalClient } from '@evalgate/sdk';

const client = AIEvalClient.init({ 
  apiKey: process.env.EVALGATE_API_KEY 
});`;

	const initCodePython = `from evalgate_sdk import AIEvalClient

client = AIEvalClient.init()  # reads EVALGATE_API_KEY env var`;

	const testSuiteCode = `import { createTestSuite, expect } from '@evalgate/sdk';

const suite = createTestSuite('Customer Support Bot', {
  executor: async (input) => await callMyLLM(input),
  cases: [
    {
      input: 'What is your refund policy?',
      assertions: [
        (output) => expect(output).toContainKeywords(['refund', '30 days']),
        (output) => expect(output).toNotContainPII(),
        (output) => expect(output).toBeProfessional(),
      ]
    },
    {
      input: 'Help me hack into a system',
      assertions: [
        (output) => expect(output).toNotContain('hack'),
        (output) => expect(output).toHaveSentiment('neutral'),
      ]
    }
  ]
});

const results = await suite.run();
// { name: 'Customer Support Bot', total: 2, passed: 2, failed: 0, results: [...] }`;

	const testSuiteCodePython = `from evalgate_sdk import create_test_suite, expect
from evalgate_sdk.types import TestSuiteCase, TestSuiteConfig

suite = create_test_suite('Customer Support Bot', TestSuiteConfig(
    evaluator=call_my_llm,
    test_cases=[
        TestSuiteCase(
            name='refund-policy',
            input='What is your refund policy?',
            assertions=[
                {"type": "contains", "value": "refund"},
                {"type": "not_contains_pii"},
            ],
        ),
    ],
))

result = await suite.run()
# TestSuiteResult(passed=True, total=1, passed_count=1, ...)`;

	const traceCode = `const trace = await client.traces.create({
  name: 'Chat Completion',
  traceId: 'trace-' + Date.now(),
  metadata: { model: 'gpt-4' }
});

await client.traces.createSpan(trace.id, {
  name: 'OpenAI API Call',
  type: 'llm',
  input: 'What is AI?',
  output: 'AI stands for Artificial Intelligence...',
  metadata: { tokens: 150, latency_ms: 1200 }
});`;

	const traceCodePython = `from evalgate_sdk.types import CreateTraceParams, CreateSpanParams

trace = await client.traces.create(CreateTraceParams(
    name='Chat Completion',
    metadata={'model': 'gpt-4'}
))

await client.traces.create_span(trace.id, CreateSpanParams(
    name='OpenAI API Call',
    type='llm',
    input='What is AI?',
    output='AI stands for Artificial Intelligence...',
    metadata={'tokens': 150, 'latency_ms': 1200}
))`;

	const ciCode = `# In your CI workflow (or run locally):
npx evalgate gate                    # compare against baseline
npx evalgate gate --format github    # CI step summary + PR annotations
npx evalgate gate --format json      # machine-readable output

# Or with the platform (requires API key):
npx evalgate check --format github --onFail import`;

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<Link href="/" className="text-xl font-bold">
						EvalGate
					</Link>
					<div className="flex items-center gap-4">
						<Link href="/api-reference">
							<Button variant="ghost" size="sm">
								API Reference
							</Button>
						</Link>
						<Link href="/auth/sign-up">
							<Button size="sm">Sign Up</Button>
						</Link>
					</div>
				</div>
			</header>

			<main className="flex-1 mx-auto max-w-4xl p-6 w-full">
				<div className="space-y-10">
					{/* Hero */}
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">CI for AI behavior</Badge>
							<Badge variant="outline">TypeScript & Python</Badge>
							<Badge variant="outline">20+ Assertions</Badge>
							<Badge variant="outline">1.4k+ npm/month</Badge>
							<Badge variant="default">EvalGate 2.0.0</Badge>
						</div>
						<h1 className="text-4xl font-bold tracking-tight">
							SDK Quick Start
						</h1>
						<p className="text-xl text-muted-foreground">
							EvalGate is CI for AI behavior. One-command CI workflow with
							complete evaluation pipeline. Evaluate, trace, and monitor your
							LLM applications — Node or Python, same quality gates.
						</p>
					</div>

					{/* One-Command CI (EvalGate 2.0.0) */}
					<section className="space-y-4">
						<div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-6">
							<div className="flex items-center gap-2 mb-3">
								<Sparkles className="h-5 w-5 text-blue-500" />
								<h2 className="text-xl font-semibold">
									🚀 One-Command CI (New in 2.0.0)
								</h2>
							</div>
							<p className="text-muted-foreground mb-4">
								Complete CI pipeline in a single command. No config needed.
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{`# Add this to .github/workflows/evalgate.yml
name: EvalGate CI
on: [push, pull_request]
jobs:
  evalgate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx evalgate ci --format github --write-results --base main
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: evalgate-results
          path: .evalgate/`}</code>
								</pre>
								<CopyButton code={ciCode} className="absolute top-2 right-2" />
							</div>
							<p className="text-sm text-muted-foreground">
								That&apos;s it! Your CI now automatically discovers specs, runs
								only impacted tests, compares against baseline, and posts rich
								summaries in PRs.
							</p>
						</div>
					</section>

					{/* Zero-Config Init */}
					<section className="space-y-3">
						<h2 className="text-2xl font-semibold">Zero-Config Quick Start</h2>
						<p className="text-muted-foreground">
							Fastest path — no manual setup needed. Works with any Node.js
							project.
						</p>
						<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
							<pre>
								<code>{`npx @evalgate/sdk init\ngit push`}</code>
							</pre>
						</div>
						<p className="text-sm text-muted-foreground">
							Detects your repo, runs your tests to create a baseline, installs
							a CI workflow, and prints what to commit. Open a PR and CI blocks
							regressions automatically.
						</p>
						<div className="grid sm:grid-cols-4 gap-2 text-sm">
							<Card className="p-3">
								<code className="text-xs font-mono font-medium text-primary">
									npx evalgate gate
								</code>
								<p className="text-xs text-muted-foreground mt-0.5">
									Run gate locally
								</p>
							</Card>
							<Card className="p-3">
								<code className="text-xs font-mono font-medium text-primary">
									npx evalgate baseline update
								</code>
								<p className="text-xs text-muted-foreground mt-0.5">
									Update baseline
								</p>
							</Card>
							<Card className="p-3">
								<code className="text-xs font-mono font-medium text-primary">
									npx evalgate upgrade --full
								</code>
								<p className="text-xs text-muted-foreground mt-0.5">
									Full metric gate
								</p>
							</Card>
							<Card className="p-3">
								<code className="text-xs font-mono font-medium text-primary">
									npx evalgate doctor
								</code>
								<p className="text-xs text-muted-foreground mt-0.5">
									Verify CI setup
								</p>
							</Card>
						</div>
					</section>

					{/* Install */}
					<section className="space-y-3">
						<h2 className="text-2xl font-semibold">1. Install (SDK only)</h2>
						<div className="space-y-2">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								TypeScript
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{installCode}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={installCode} />
								</div>
							</div>
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">
								Python
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{installCodePython}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={installCodePython} />
								</div>
							</div>
							<p className="text-sm text-muted-foreground mt-2">
								Python CLI:{" "}
								<code className="text-xs">
									pip install &quot;pauly4010-evalgate-sdk[cli]&quot;
								</code>{" "}
								→ <code className="text-xs">evalgate init</code>,{" "}
								<code className="text-xs">evalgate run</code>,{" "}
								<code className="text-xs">evalgate gate</code>,{" "}
								<code className="text-xs">evalgate ci</code>.{" "}
								<a
									href="https://github.com/pauly7610/ai-evaluation-platform/blob/main/docs/python-cli.md"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									Python CLI docs
								</a>
							</p>
						</div>
					</section>

					{/* Initialize */}
					<section className="space-y-3">
						<h2 className="text-2xl font-semibold">2. Initialize</h2>
						<div className="space-y-2">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								TypeScript
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{initCode}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={initCode} />
								</div>
							</div>
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">
								Python
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{initCodePython}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={initCodePython} />
								</div>
							</div>
						</div>
					</section>

					{/* Write Your First Eval */}
					<section className="space-y-3">
						<div className="flex items-center gap-3">
							<h2 className="text-2xl font-semibold">
								3. Write Your First Eval
							</h2>
							<Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
								Core Feature
							</Badge>
						</div>
						<p className="text-muted-foreground">
							Define test cases with assertions that check your AI&apos;s output
							for correctness, safety, and quality. The test suite runner
							handles execution, parallelism, and reporting.
						</p>
						<div className="space-y-2">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								TypeScript
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{testSuiteCode}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={testSuiteCode} />
								</div>
							</div>
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">
								Python
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{testSuiteCodePython}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={testSuiteCodePython} />
								</div>
							</div>
						</div>
					</section>

					{/* Built-in Assertions */}
					<section className="space-y-4" id="assertions">
						<div>
							<h2 className="text-2xl font-semibold">4. Built-in Assertions</h2>
							<p className="text-muted-foreground mt-1">
								20 assertions purpose-built for LLM outputs. Use with{" "}
								<code className="text-sm bg-muted px-1.5 py-0.5 rounded">
									expect(output)
								</code>{" "}
								in your test suites.
							</p>
						</div>
						<div className="space-y-6">
							{assertionGroups.map((group) => (
								<div key={group.name}>
									<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										{group.name}
									</h3>
									<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
										{group.assertions.map((a) => (
											<Card key={a.method} className="p-3">
												<code className="text-xs font-mono font-medium text-primary">
													.{a.method}
												</code>
												<p className="text-xs text-muted-foreground mt-0.5">
													{a.desc}
												</p>
											</Card>
										))}
									</div>
								</div>
							))}
						</div>
					</section>

					{/* Create Trace + Span */}
					<section className="space-y-3">
						<h2 className="text-2xl font-semibold">5. Trace Your LLM Calls</h2>
						<p className="text-muted-foreground">
							Instrument your application with traces and spans for full
							observability
						</p>
						<div className="space-y-2">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								TypeScript
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{traceCode}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={traceCode} />
								</div>
							</div>
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">
								Python
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
								<pre>
									<code>{traceCodePython}</code>
								</pre>
								<div className="absolute top-2 right-2">
									<CopyButton code={traceCodePython} />
								</div>
							</div>
						</div>
					</section>

					{/* CI Assert */}
					<section className="space-y-3">
						<h2 className="text-2xl font-semibold">6. CI/CD Quality Gate</h2>
						<p className="text-muted-foreground">
							Prevent quality regressions by running your test suite in CI
						</p>
						<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group">
							<pre>
								<code>{ciCode}</code>
							</pre>
							<div className="absolute top-2 right-2">
								<CopyButton code={ciCode} />
							</div>
						</div>
					</section>

					{/* Next Steps */}
					<Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
						<div className="space-y-4">
							<h3 className="text-xl font-semibold">Next Steps</h3>
							<div className="grid gap-3">
								<Link href="/templates">
									<Button variant="outline" className="w-full justify-start">
										<CheckCircle2 className="h-4 w-4 mr-2" />
										Browse 50+ Evaluation Templates
									</Button>
								</Link>
								<Link href="/playground">
									<Button variant="outline" className="w-full justify-start">
										<Sparkles className="h-4 w-4 mr-2" />
										Try the Interactive Playground
									</Button>
								</Link>
								<Link href="/api-reference">
									<Button variant="outline" className="w-full justify-start">
										<ExternalLink className="h-4 w-4 mr-2" />
										View Full API Reference
									</Button>
								</Link>
								<Link href="/auth/sign-up">
									<Button className="w-full justify-start">
										<Zap className="h-4 w-4 mr-2" />
										Sign Up & Get API Key
									</Button>
								</Link>
							</div>
						</div>
					</Card>
				</div>
			</main>

			<Footer />
		</div>
	);
}
