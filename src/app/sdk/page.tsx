import { CheckCircle2, ExternalLink, Sparkles, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
	title: "SDK Quick Start - EvalGate | AI Quality Infrastructure",
	description:
		"EvalGate 3.0.2: AI quality infrastructure. Production failures become regression tests. TypeScript & Python SDKs. One-command CI workflow plus production trace collection.",
	openGraph: {
		title: "SDK Quick Start - EvalGate | AI Quality Infrastructure",
		description:
			"EvalGate 3.0.2: AI quality infrastructure. Production failures become regression tests. TypeScript & Python SDKs.",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "SDK Quick Start - EvalGate | AI Quality Infrastructure",
		description:
			"EvalGate 3.0.2: AI quality infrastructure. Production failures become regression tests. TypeScript & Python SDKs.",
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

	const analyzeWorkflowCode = `# 1 — Define your app's specific failure modes (run once)
npx evalgate failure-modes

# 2 — Label production traces interactively
npx evalgate label
# Arrow-key menu, u to undo, Ctrl-C saves progress

# 3 — See failure-mode frequency across all labeled traces
npx evalgate analyze

# 4 — Compare two runs and emit keep/discard decision
npx evalgate replay-decision \\
  --previous .evalgate/runs/run-prev.json \\
  --current  .evalgate/runs/run-latest.json`;

	const judgeCredibilityCode = `// evalgate.config.json
{
  "judge": {
    "bootstrapSeed": 42,    // deterministic CI seed
    "tprMin": 0.70,         // gate fails if judge TPR < 70%
    "tnrMin": 0.70,         // gate fails if judge TNR < 70%
    "minLabeledSamples": 30 // skip CI when n < 30 (warn)
  },
  "failureModeAlerts": {
    "modes": {
      "hallucination": { "weight": 1.5, "maxPercent": 10 },
      "off_topic":     { "weight": 1.0, "maxPercent": 20, "maxCount": 5 },
      "wrong_format":  { "weight": 0.8, "maxPercent": 15 }
    }
  }
}`;

	const costTierCode = `import { defineEval, expect } from '@evalgate/sdk';

defineEval('SQL safety check', async () => {
  const response = await yourApp.generate('Generate a report query');

  // 'code' tier — fast local check, no API call
  const structureOk = expect(response).withCostTier('code').toContain('SELECT');

  // 'llm' tier — LLM-backed check, consumes tokens
  const safetyOk = await expect(response).withCostTier('llm').toNotHallucinateAsync(facts);

  return { pass: structureOk.passed && safetyOk.passed, score: 100 };
});`;

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
							<Badge variant="secondary">AI Quality Infrastructure</Badge>
							<Badge variant="outline">TypeScript & Python</Badge>
							<Badge variant="outline">50+ Built-in Assertions</Badge>
							<Badge variant="outline">Production → CI Loop</Badge>
							<Badge variant="default">EvalGate 3.0.2</Badge>
						</div>
						<h1 className="text-4xl font-bold tracking-tight">
							SDK Quick Start
						</h1>
						<p className="text-xl text-muted-foreground">
							EvalGate is AI quality infrastructure. Production failures
							automatically become regression tests. Collect traces, detect
							failures, auto-generate test cases — Node or Python, same quality
							gates.
						</p>
					</div>

					{/* How it works in 3 steps */}
					<section className="space-y-4">
						<h2 className="text-2xl font-semibold text-center">
							How EvalGate Works
						</h2>
						<p className="text-center text-muted-foreground max-w-2xl mx-auto">
							A closed-loop AI quality system. Production failures automatically
							become regression tests.
						</p>
						<div className="grid md:grid-cols-3 gap-4">
							<Card className="p-5 bg-linear-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
								<div className="flex items-center gap-2 mb-3">
									<div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
										1
									</div>
									<h3 className="font-semibold">Collect</h3>
								</div>
								<p className="text-sm text-muted-foreground mb-3">
									Production traces flow in via{" "}
									<code className="text-xs bg-muted px-1 rounded">
										reportTrace()
									</code>
									. Asymmetric sampling: 10% success, 100% errors.
								</p>
								<code className="text-xs font-mono text-primary">
									reportTrace(input, output)
								</code>
							</Card>
							<Card className="p-5 bg-linear-to-br from-green-500/5 to-green-500/10 border-green-500/20">
								<div className="flex items-center gap-2 mb-3">
									<div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 font-bold">
										2
									</div>
									<h3 className="font-semibold">Label</h3>
								</div>
								<p className="text-sm text-muted-foreground mb-3">
									Interactive CLI labels each trace: pass/fail + failure mode.
									Builds your golden dataset.
								</p>
								<code className="text-xs font-mono text-primary">
									evalgate label
								</code>
							</Card>
							<Card className="p-5 bg-linear-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
								<div className="flex items-center gap-2 mb-3">
									<div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
										3
									</div>
									<h3 className="font-semibold">Gate</h3>
								</div>
								<p className="text-sm text-muted-foreground mb-3">
									CI blocks regressions using validated judge credibility. Every
									label becomes a regression test.
								</p>
								<code className="text-xs font-mono text-primary">
									evalgate ci
								</code>
							</Card>
						</div>
					</section>

					{/* One-Command CI (EvalGate 3.0.0) */}
					<section className="space-y-4">
						<div className="bg-linear-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-6">
							<div className="flex items-center gap-2 mb-3">
								<Sparkles className="h-5 w-5 text-blue-500" />
								<h2 className="text-xl font-semibold">
									🚀 One-Command CI + AI Reliability Loop (3.0.2)
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
						<div className="grid sm:grid-cols-3 gap-2 text-sm">
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
							<Card className="p-3">
								<code className="text-xs font-mono font-medium text-primary">
									npx evalgate label
								</code>
								<p className="text-xs text-muted-foreground mt-0.5">
									Label traces interactively
								</p>
							</Card>
							<Card className="p-3">
								<code className="text-xs font-mono font-medium text-primary">
									npx evalgate analyze
								</code>
								<p className="text-xs text-muted-foreground mt-0.5">
									Failure-mode frequency report
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
									href="https://github.com/evalgate/ai-evaluation-platform/blob/main/docs/python-cli.md"
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

					{/* Label & Analyze (3.0.2) */}
					<section className="space-y-4">
						<div className="bg-linear-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg p-6">
							<div className="flex items-center gap-2 mb-3">
								<Sparkles className="h-5 w-5 text-green-500" />
								<h2 className="text-xl font-semibold">
									🆕 3.0.2: Label, Analyze &amp; Judge Credibility
								</h2>
							</div>
							<p className="text-muted-foreground mb-4">
								Build a labeled golden dataset, measure failure-mode frequency,
								and verify your judge is trustworthy before gating on its score.
							</p>

							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
								Analyze Workflow
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group mb-4">
								<pre>
									<code>{analyzeWorkflowCode}</code>
								</pre>
								<CopyButton
									code={analyzeWorkflowCode}
									className="absolute top-2 right-2"
								/>
							</div>

							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
								Judge Credibility + Failure Mode Alerts Config
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group mb-4">
								<pre>
									<code>{judgeCredibilityCode}</code>
								</pre>
								<CopyButton
									code={judgeCredibilityCode}
									className="absolute top-2 right-2"
								/>
							</div>

							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
								withCostTier() — Tag Assertions by Execution Cost
							</p>
							<div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative group mb-4">
								<pre>
									<code>{costTierCode}</code>
								</pre>
								<CopyButton
									code={costTierCode}
									className="absolute top-2 right-2"
								/>
							</div>

							<p className="text-sm text-muted-foreground">
								When discriminative power (TPR+TNR−1) ≤ 0.05, correction is
								skipped and gate exits{" "}
								<code className="text-xs bg-muted px-1 rounded">8 (WARN)</code>{" "}
								instead of silently using a biased score. Bootstrap CI is
								skipped when n &lt; 30 — both emit reason codes into the{" "}
								<code className="text-xs bg-muted px-1 rounded">
									judgeCredibility
								</code>{" "}
								block of the JSON report.
							</p>
						</div>
					</section>

					{/* Next Steps */}
					<Card className="p-6 bg-linear-to-br from-blue-500/10 to-blue-500/5">
						<div className="space-y-4">
							<h3 className="text-xl font-semibold">Next Steps</h3>
							<div className="grid gap-3">
								<a
									href="https://github.com/evalgate/ai-evaluation-platform/blob/main/docs/ZERO_TO_GOLDEN_DATASET.md"
									target="_blank"
									rel="noopener noreferrer"
								>
									<Button variant="outline" className="w-full justify-start">
										<Sparkles className="h-4 w-4 mr-2" />
										Zero to Golden Dataset (30 min guide)
									</Button>
								</a>
								<Link href="/templates">
									<Button variant="outline" className="w-full justify-start">
										<CheckCircle2 className="h-4 w-4 mr-2" />
										Browse Evaluation Templates
									</Button>
								</Link>
								<Link href="/playground">
									<Button variant="outline" className="w-full justify-start">
										<Sparkles className="h-4 w-4 mr-2" />
										Try the Interactive Playground
									</Button>
								</Link>
								<a
									href="https://github.com/evalgate/ai-evaluation-platform/blob/main/src/packages/sdk/README.md#troubleshooting"
									target="_blank"
									rel="noopener noreferrer"
								>
									<Button variant="outline" className="w-full justify-start">
										<ExternalLink className="h-4 w-4 mr-2" />
										Troubleshooting Guide
									</Button>
								</a>
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
