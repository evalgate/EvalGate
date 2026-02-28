"use client";

import { ArrowRight, Code, GitBranch, Package, Zap } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function IntegrationReferencePage() {
	const { data: session } = useSession();

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<header className="border-b border-border">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
					<div className="flex items-center justify-between gap-3">
						<Link href="/">
							<h1 className="text-base sm:text-xl font-bold truncate">
								AI Evaluation Platform
							</h1>
						</Link>
						<div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
							<ThemeToggle />
							{session?.user ? (
								<Button asChild size="sm" className="h-9">
									<Link href="/dashboard">Dashboard</Link>
								</Button>
							) : (
								<>
									<Button
										variant="ghost"
										asChild
										size="sm"
										className="h-9 hidden sm:flex"
									>
										<Link href="/auth/login">Sign in</Link>
									</Button>
									<Button asChild size="sm" className="h-9">
										<Link href="/auth/sign-up">Get started</Link>
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
					{/* Breadcrumb */}
					<nav className="mb-8">
						<Link
							href="/documentation"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							← Back to Documentation
						</Link>
					</nav>

					{/* Hero */}
					<div className="mb-12">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
								<Code className="h-6 w-6 text-blue-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									Integration Reference
								</h1>
								<p className="text-lg text-muted-foreground">
									Complete technical reference for wiring external projects into
									the AI Evaluation Platform
								</p>
							</div>
						</div>
						<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<p className="text-sm text-blue-600 dark:text-blue-400">
								<strong>Generated from source code</strong> — every type,
								endpoint, and method signature below is real.
							</p>
						</div>
					</div>

					{/* SDK Package */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<Package className="h-5 w-5" />
							SDK Package
						</h2>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm mb-4">
							<table className="w-full">
								<tbody>
									<tr className="border-b">
										<td className="py-2 font-semibold">npm package</td>
										<td className="py-2">
											<code>@pauly4010/evalai-sdk</code>
										</td>
									</tr>
									<tr className="border-b">
										<td className="py-2 font-semibold">Version</td>
										<td className="py-2">
											<code>1.5.0</code>
										</td>
									</tr>
									<tr className="border-b">
										<td className="py-2 font-semibold">Source</td>
										<td className="py-2">
											<code>src/packages/sdk/</code>
										</td>
									</tr>
									<tr className="border-b">
										<td className="py-2 font-semibold">Exports</td>
										<td className="py-2">
											<code>.</code> (main), <code>./assertions</code>,{" "}
											<code>./testing</code>, <code>./integrations/openai</code>
											, <code>./integrations/anthropic</code>
										</td>
									</tr>
									<tr className="border-b">
										<td className="py-2 font-semibold">Peer deps</td>
										<td className="py-2">
											<code>openai ^4.0.0</code> (optional),{" "}
											<code>@anthropic-ai/sdk ^0.20.0</code> (optional)
										</td>
									</tr>
									<tr className="border-b">
										<td className="py-2 font-semibold">Node</td>
										<td className="py-2">
											<code>&gt;=16.0.0</code>
										</td>
									</tr>
									<tr>
										<td className="py-2 font-semibold">CLI</td>
										<td className="py-2">
											<code>npx evalai</code> → <code>./dist/cli/index.js</code>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</Card>

					{/* AIEvalClient */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							AIEvalClient — Constructor & Auth
						</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">
									Option A: Zero-config (reads env vars)
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`// Env: EVALAI_API_KEY, EVALAI_ORGANIZATION_ID, EVALAI_BASE_URL
const client = AIEvalClient.init();`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">
									Option B: Explicit config
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto max-h-64">
									<pre>{`const client = new AIEvalClient({
  apiKey: 'your-api-key',           // required (or EVALAI_API_KEY env)
  organizationId: 123,              // optional (or EVALAI_ORGANIZATION_ID env)
  baseUrl: 'https://your-app.vercel.app', // defaults to '' in browser, 'http://localhost:3000' in Node
  timeout: 30000,                   // ms, default 30s
  debug: false,                     // enables verbose logging
  logLevel: 'info',                 // 'debug' | 'info' | 'warn' | 'error'
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',         // 'exponential' | 'linear' | 'fixed'
    retryableErrors: ['RATE_LIMIT_EXCEEDED', 'TIMEOUT', 'NETWORK_ERROR', 'INTERNAL_SERVER_ERROR']
  },
  enableBatching: true,             // auto-batch requests
  batchSize: 10,
  batchDelay: 50,                   // ms
  cacheSize: 1000,                  // GET request cache entries
});`}</pre>
								</div>
							</div>

							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
								<p className="text-sm text-green-600 dark:text-green-400">
									<strong>Auth pattern:</strong> Every request sends{" "}
									<code className="bg-green-100 dark:bg-green-800 px-1 rounded">
										Authorization: Bearer &lt;apiKey&gt;
									</code>{" "}
									header.
								</p>
							</div>
						</div>
					</Card>

					{/* Client API Modules */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Client API Modules</h2>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
							<pre>{`client.traces          → TraceAPI
client.evaluations     → EvaluationAPI
client.llmJudge        → LLMJudgeAPI
client.annotations     → AnnotationsAPI
client.developer       → DeveloperAPI (apiKeys, webhooks, usage)
client.organizations   → OrganizationsAPI`}</pre>
						</div>
					</Card>

					{/* TraceAPI Methods */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">TraceAPI Methods</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Create a trace</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`client.traces.create({
  name: string,
  traceId: string,
  organizationId?: number,  // falls back to client's orgId
  status?: string,          // 'pending' | 'success' | 'error'
  durationMs?: number,
  metadata?: Record<string, unknown>,
}) → Promise<Trace>`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">List traces</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`client.traces.list({
  limit?: number,       // max 100
  offset?: number,
  organizationId?: number,
  status?: string,
  search?: string,
}) → Promise<Trace[]>`}</pre>
								</div>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<h3 className="font-semibold mb-2">Get single trace</h3>
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<code>
											client.traces.get(id: number) → Promise&lt;Trace&gt;
										</code>
									</div>
								</div>
								<div>
									<h3 className="font-semibold mb-2">Delete trace</h3>
									<div className="bg-muted rounded-lg p-3 font-mono text-sm">
										<code>
											client.traces.delete(id: number) → Promise&lt;
											{"{ message: string }"}&gt;
										</code>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* EvaluationAPI Methods */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">
							EvaluationAPI Methods
						</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Create evaluation</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`client.evaluations.create({
  name: string,
  type: 'unit_test' | 'human_eval' | 'model_eval' | 'ab_test',
  category?: string,
  description?: string,
  organizationId?: number,
}) → Promise<Evaluation>`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Run evaluation</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`client.evaluations.run(id: number, {
  environment?: string,
  metadata?: Record<string, unknown>,
}) → Promise<EvaluationRun>`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Import results</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`client.evaluations.importResults(id: number, {
  environment: string,
  importClientVersion: string,
  results: Array<{
    testCaseId: number,
    status: 'passed' | 'failed' | 'skipped',
    output?: string,
    latencyMs?: number,
    errorMessage?: string,
  }>,
}) → Promise<{ runId: number, score: number }>`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Integration Paths */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<GitBranch className="h-5 w-5" />
							Integration Paths
						</h2>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="font-semibold text-blue-600">SDK Integration</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• TypeScript/JavaScript projects</li>
									<li>• Full API coverage with type safety</li>
									<li>• Built-in retry and batching</li>
									<li>• Environment-based configuration</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold text-green-600">REST API</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• unknown language/framework</li>
									<li>• OpenAPI specification available</li>
									<li>• Standard HTTP methods</li>
									<li>• JSON request/response format</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold text-purple-600">MCP Protocol</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• AI agent integration</li>
									<li>• Tool discovery and execution</li>
									<li>• Cursor, Claude, ChatGPT compatible</li>
									<li>• Structured tool schemas</li>
								</ul>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold text-orange-600">Webhooks</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Event-driven integration</li>
									<li>• Real-time notifications</li>
									<li>• Evaluation completion events</li>
									<li>• Custom payload handling</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Quick-Start Recipes */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
							<Zap className="h-5 w-5" />
							Quick-Start Recipes
						</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-2">Basic Evaluation</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`import { AIEvalClient } from '@pauly4010/evalai-sdk';

const client = AIEvalClient.init();

// Create evaluation
const eval = await client.evaluations.create({
  name: 'Chatbot Safety Test',
  type: 'unit_test',
  category: 'safety'
});

// Add test cases
await client.evaluations.addTestCases(eval.id, [
  { input: 'Hello', expectedOutput: 'greeting' },
  { input: 'Help me', expectedOutput: 'assistance' }
]);

// Run evaluation
const run = await client.evaluations.run(eval.id);
console.log('Run ID:', run.id);`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Tracing LLM Calls</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`// Create trace
const trace = await client.traces.create({
  name: 'Chat Completion',
  traceId: 'chat-' + Date.now(),
  metadata: { userId: 'user-123', model: 'gpt-4' }
});

// Add span for LLM call
const span = await client.traces.createSpan(trace.id, {
  name: 'OpenAI API Call',
  type: 'llm',
  startTime: new Date().toISOString(),
  input: 'What is AI?',
  output: 'AI is artificial intelligence...',
  metadata: { model: 'gpt-4', tokens: 150, latency: 1200 }
});`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Python Integration */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">Python Integration</h2>
						<p className="text-muted-foreground mb-4">
							While the primary SDK is TypeScript-based, you can integrate with
							Python using the REST API:
						</p>

						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
							<pre>{`import requests
import os

# Configuration
BASE_URL = "https://eval.ai/api"
API_KEY = os.getenv("EVALAI_API_KEY")
ORG_ID = os.getenv("EVALAI_ORGANIZATION_ID")

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Create evaluation
response = requests.post(f"{BASE_URL}/evaluations", 
    json={
        "name": "Python Safety Test",
        "type": "unit_test",
        "organizationId": int(ORG_ID)
    },
    headers=headers
)

evaluation = response.json()
print(f"Created evaluation: {evaluation['id']}")`}</pre>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6 mt-8">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">Explore Further</h2>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/docs/api-contract">
										API Contract <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button variant="outline" asChild>
									<Link href="/docs/mcp">
										MCP Integration <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button asChild>
									<Link href="/api-reference">
										Full API Reference <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</div>
						</div>
					</Card>
				</div>
			</main>

			{/* Footer */}
			<Footer />
		</div>
	);
}
