import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "EvalGate Integration Reference — SDK, REST API, Governance",
	description:
		"Complete technical reference for integrating with the EvalGate. TypeScript SDK, REST API contracts, multi-agent workflow tracing, cost analytics, governance presets, and Python examples.",
	keywords: [
		"ai evaluation sdk",
		"llm observability",
		"agent tracing",
		"workflow dag",
		"cost tracking",
		"decision auditing",
		"governance",
		"langchain integration",
		"crewai integration",
		"autogen integration",
		"evalgate",
		"typescript sdk",
		"multi-agent",
	],
	openGraph: {
		title: "EvalGate Integration Reference",
		description:
			"SDK, REST API, governance, and Python integration docs for the EvalGate.",
		type: "website",
	},
};

function CodeBlock({
	lang: _lang,
	children,
}: {
	lang: string;
	children: string;
}) {
	return (
		<pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed">
			<code className="text-zinc-300">{children}</code>
		</pre>
	);
}

function Section({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section id={id} className="scroll-mt-24">
			<h2 className="mb-6 text-2xl font-bold tracking-tight text-white">
				{title}
			</h2>
			{children}
		</section>
	);
}

function Badge({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex items-center rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400 ring-1 ring-inset ring-violet-500/20">
			{children}
		</span>
	);
}

export default function IntegrationDocsPage() {
	return (
		<>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data for SEO
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "SoftwareApplication",
						name: "EvalGate SDK",
						applicationCategory: "DeveloperApplication",
						operatingSystem: "Cross-platform",
						offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
						description:
							"TypeScript/JavaScript SDK for AI agent observability, workflow tracing, cost analytics, decision auditing, and governance. Integrates with LangChain, CrewAI, AutoGen.",
						url: "https://www.npmjs.com/package/@evalgate/sdk",
						downloadUrl: "https://www.npmjs.com/package/@evalgate/sdk",
						softwareVersion: "1.3.0",
						author: {
							"@type": "Organization",
							name: "EvalGate",
							url: "https://github.com/pauly7610/ai-evaluation-platform",
						},
						programmingLanguage: ["TypeScript", "JavaScript", "Python"],
						codeRepository:
							"https://github.com/pauly7610/ai-evaluation-platform",
						license: "https://opensource.org/licenses/MIT",
						featureList: [
							"Multi-agent workflow tracing with DAG visualization",
							"LLM cost tracking across OpenAI, Anthropic, Google",
							"Decision auditing with alternatives and confidence scores",
							"Governance engine with SOC2, GDPR, HIPAA, FINRA, PCI-DSS presets",
							"Agent benchmarking (ReAct, CoT, ToT)",
							"LangChain, CrewAI, AutoGen framework integrations",
							"REST API for Python/Go/Rust backends",
							"Zero-config initialization with env variables",
							"Auto-retry with exponential backoff",
							"Request caching and batching",
						],
					}),
				}}
			/>

			<div className="min-h-screen bg-zinc-950 text-zinc-300">
				<div className="mx-auto max-w-4xl px-6 py-16">
					{/* Header */}
					<div className="mb-16">
						<div className="mb-4 flex items-center gap-3">
							<Badge>v1.3.0</Badge>
							<Badge>MIT License</Badge>
							<Badge>npm published</Badge>
						</div>
						<h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
							EvalGate Integration Reference
						</h1>
						<p className="max-w-2xl text-lg text-zinc-400">
							Complete technical reference for wiring external projects into the
							EvalGate. Every type, endpoint, and method signature below is
							sourced directly from the codebase.
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							<a
								href="https://www.npmjs.com/package/@evalgate/sdk"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
							>
								npm install @evalgate/sdk
							</a>
							<a
								href="https://github.com/pauly7610/ai-evaluation-platform"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500"
							>
								GitHub
							</a>
							<a
								href="/llms.txt"
								className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500"
							>
								llms.txt
							</a>
						</div>
					</div>

					{/* TOC */}
					<nav className="mb-16 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
						<h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
							Contents
						</h3>
						<ul className="grid gap-2 text-sm sm:grid-cols-2">
							{[
								["#quick-start", "Quick Start"],
								["#sdk-client", "SDK Client & Auth"],
								["#workflow-tracer", "WorkflowTracer API"],
								["#rest-api", "REST API Contracts"],
								["#governance", "Governance Engine"],
								["#python", "Python Integration"],
								["#frameworks", "Framework Integrations"],
								["#comparison", "Comparison with Alternatives"],
							].map(([href, label]) => (
								<li key={href}>
									<a
										href={href}
										className="text-violet-400 hover:text-violet-300"
									>
										{label}
									</a>
								</li>
							))}
						</ul>
					</nav>

					<div className="space-y-20">
						{/* Quick Start */}
						<Section id="quick-start" title="Quick Start">
							<CodeBlock lang="bash">{`npm install @evalgate/sdk`}</CodeBlock>
							<div className="mt-4" />
							<CodeBlock lang="typescript">{`import { AIEvalClient, WorkflowTracer } from '@evalgate/sdk';

// Zero-config: reads EVALAI_API_KEY and EVALAI_ORGANIZATION_ID from env
const client = AIEvalClient.init();
const tracer = new WorkflowTracer(client);

await tracer.startWorkflow('My Pipeline', {
  nodes: [
    { id: 'router', type: 'agent', name: 'RouterAgent' },
    { id: 'worker', type: 'agent', name: 'WorkerAgent' },
  ],
  edges: [{ from: 'router', to: 'worker' }],
  entrypoint: 'router',
});

const span = await tracer.startAgentSpan('RouterAgent', { query: userInput });

await tracer.recordDecision({
  agent: 'RouterAgent',
  type: 'route',
  chosen: 'WorkerAgent',
  alternatives: [{ action: 'fallback', confidence: 20 }],
  confidence: 90,
});

await tracer.recordCost({
  provider: 'openai', model: 'gpt-4o',
  inputTokens: 500, outputTokens: 200,
});

await tracer.endAgentSpan(span, { result: 'routed' });
await tracer.endWorkflow({ status: 'success' });`}</CodeBlock>
						</Section>

						{/* SDK Client */}
						<Section id="sdk-client" title="SDK Client & Auth">
							<p className="mb-4 text-zinc-400">
								The <code className="text-violet-400">AIEvalClient</code> is the
								main entry point. It supports zero-config initialization via
								environment variables, or explicit configuration.
							</p>
							<CodeBlock lang="typescript">{`const client = new AIEvalClient({
  apiKey: 'your-api-key',           // required (or EVALAI_API_KEY env)
  organizationId: 123,              // optional (or EVALAI_ORGANIZATION_ID env)
  baseUrl: 'https://your-app.vercel.app',
  timeout: 30000,                   // ms
  debug: false,
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',         // 'exponential' | 'linear' | 'fixed'
  },
  enableBatching: true,
  cacheSize: 1000,
});

// Auth: every request sends Authorization: Bearer <apiKey>`}</CodeBlock>

							<h3 className="mb-3 mt-8 text-lg font-semibold text-white">
								API Modules
							</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-zinc-800 text-left text-zinc-500">
											<th className="pb-2 pr-4">Module</th>
											<th className="pb-2">Methods</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-800/50">
										{[
											[
												"client.traces",
												"create, list, get, delete, createSpan, listSpans",
											],
											[
												"client.evaluations",
												"create, list, get, update, delete, createTestCase, createRun",
											],
											[
												"client.llmJudge",
												"evaluate, createConfig, listConfigs, listResults, getAlignment({ evaluationRunId })",
											],
											[
												"client.annotations",
												"create, list, tasks.create, tasks.items.create",
											],
											[
												"client.developer",
												"getUsage, apiKeys.create/list/revoke, webhooks.create/list",
											],
											["client.organizations", "getCurrent"],
										].map(([mod, methods]) => (
											<tr key={mod}>
												<td className="py-2 pr-4 font-mono text-violet-400">
													{mod}
												</td>
												<td className="py-2 text-zinc-400">{methods}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</Section>

						{/* WorkflowTracer */}
						<Section id="workflow-tracer" title="WorkflowTracer API">
							<p className="mb-4 text-zinc-400">
								The WorkflowTracer instruments multi-agent workflows with
								tracing, decision auditing, handoff tracking, and cost capture.
							</p>
							<CodeBlock lang="typescript">{`const tracer = new WorkflowTracer(client, {
  organizationId?: number,
  autoCalculateCost?: boolean,    // default: true
  tracePrefix?: string,           // default: 'workflow'
  captureFullPayloads?: boolean,  // default: true
  debug?: boolean,
});

// Lifecycle
tracer.startWorkflow(name, definition?, metadata?)
tracer.endWorkflow(output?, status?)  // 'completed' | 'failed' | 'cancelled'

// Agent Spans
tracer.startAgentSpan(agentName, input?, parentSpanId?)
tracer.endAgentSpan(span, output?, error?)

// Handoffs
tracer.recordHandoff(fromAgent, toAgent, context?, handoffType?)
// handoffType: 'delegation' | 'escalation' | 'parallel' | 'fallback'

// Decision Auditing
tracer.recordDecision({
  agent, type, chosen, alternatives, reasoning?, confidence?, contextFactors?
})
// type: 'action' | 'tool' | 'delegate' | 'respond' | 'route'

// Cost Tracking (auto-calculates from built-in pricing for 12 models)
tracer.recordCost({
  provider, model, inputTokens, outputTokens, category?, isRetry?
})

// Utilities
tracer.getTotalCost()        → number
tracer.getCostBreakdown()    → { llm, tool, embedding, other }
tracer.getHandoffs()         → AgentHandoff[]
tracer.getDecisions()        → RecordDecisionParams[]`}</CodeBlock>
						</Section>

						{/* REST API */}
						<Section id="rest-api" title="REST API Contracts">
							<p className="mb-4 text-zinc-400">
								All endpoints accept JSON, require{" "}
								<code className="text-violet-400">
									Authorization: Bearer &lt;key&gt;
								</code>{" "}
								header.
							</p>

							<div className="space-y-8">
								{[
									{
										method: "POST",
										path: "/api/traces",
										body: `{ "name": "string", "traceId": "string", "organizationId": int, "status?": "pending|success|error", "durationMs?": int, "metadata?": {} }`,
									},
									{
										method: "POST",
										path: "/api/workflows",
										body: `{ "name": "string", "organizationId": int, "definition": { "nodes": [...], "edges": [...], "entrypoint": "string" }, "description?": "string", "status?": "draft|active|archived" }`,
									},
									{
										method: "POST",
										path: "/api/decisions",
										body: `{ "spanId": int, "agentName": "string", "decisionType": "action|tool|delegate|respond|route", "chosen": "string", "alternatives": [{ "action": "str", "confidence": 0-100 }], "reasoning?": "str", "confidence?": 0-100 }`,
									},
									{
										method: "POST",
										path: "/api/costs",
										body: `{ "spanId": int, "provider": "string", "model": "string", "inputTokens": int, "outputTokens": int, "category?": "llm|tool|embedding|other", "isRetry?": bool }`,
									},
									{
										method: "GET",
										path: "/api/costs/trends",
										body: `?organizationId=int&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD → { trends: [...], summary: { totalCost, totalTokens, totalRequests, avgDailyCost } }`,
									},
								].map((ep) => (
									<div
										key={ep.path}
										className="rounded-lg border border-zinc-800 p-4"
									>
										<div className="mb-2 flex items-center gap-2">
											<span
												className={`rounded px-2 py-0.5 text-xs font-bold ${
													ep.method === "POST"
														? "bg-green-500/10 text-green-400"
														: "bg-blue-500/10 text-blue-400"
												}`}
											>
												{ep.method}
											</span>
											<code className="text-sm text-white">{ep.path}</code>
										</div>
										<pre className="overflow-x-auto text-xs text-zinc-500">
											{ep.body}
										</pre>
									</div>
								))}
							</div>
						</Section>

						{/* Governance */}
						<Section id="governance" title="Governance Engine">
							<p className="mb-4 text-zinc-400">
								Enterprise-grade governance with compliance presets for SOC2,
								GDPR, HIPAA, FINRA, and PCI-DSS.
							</p>
							<CodeBlock lang="typescript">{`import { GovernanceEngine, CompliancePresets } from '@/lib/governance/rules';

const engine = new GovernanceEngine(CompliancePresets.SOC2);
// Or custom:
const engine = new GovernanceEngine({
  confidenceThreshold: 0.7,     // below → requires approval
  amountThreshold: 500,         // above → requires approval
  requireApprovalForSensitiveData: true,
  requireApprovalForPII: true,
  allowedModels: [],            // empty = no restrictions
  maxCostPerRun: 10.0,
  auditLevel: 'SOC2',
});

const result = engine.evaluate(decision);
// → { requiresApproval, blocked, reasons[], auditLevel, timestamp }`}</CodeBlock>

							<h3 className="mb-3 mt-8 text-lg font-semibold text-white">
								Compliance Presets
							</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-zinc-800 text-left text-zinc-500">
											<th className="pb-2 pr-4">Preset</th>
											<th className="pb-2 pr-4">Confidence</th>
											<th className="pb-2 pr-4">Amount</th>
											<th className="pb-2 pr-4">PII</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-800/50">
										{[
											["BASIC", "60%", "$1,000", "No"],
											["SOC2", "70%", "$500", "Yes"],
											["GDPR", "75%", "$250", "Yes"],
											["HIPAA", "80%", "$100", "Yes"],
											["FINRA_4511", "85%", "$100", "Yes"],
											["PCI_DSS", "80%", "$50", "Yes"],
										].map(([preset, conf, amt, pii]) => (
											<tr key={preset}>
												<td className="py-2 pr-4 font-mono text-violet-400">
													{preset}
												</td>
												<td className="py-2 pr-4">{conf}</td>
												<td className="py-2 pr-4">{amt}</td>
												<td className="py-2 pr-4">{pii}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</Section>

						{/* Python */}
						<Section id="python" title="Python Integration">
							<p className="mb-4 text-zinc-400">
								No Python package is published yet. Use the REST API directly,
								or copy the reference tracer from{" "}
								<code className="text-violet-400">
									src/integrations/crewai-example.py
								</code>
								.
							</p>
							<CodeBlock lang="python">{`import requests, os, time

BASE = "https://evalgate.com"
HEADERS = {
    "Authorization": f"Bearer {os.environ['EVALAI_API_KEY']}",
    "Content-Type": "application/json"
}

# Create trace
trace = requests.post(f"{BASE}/api/traces", headers=HEADERS, json={
    "name": "Agent Run",
    "traceId": f"py-{int(time.time()*1000)}",
    "organizationId": 1,
    "status": "pending"
}).json()

# Record decision
requests.post(f"{BASE}/api/decisions", headers=HEADERS, json={
    "spanId": trace["id"],
    "agentName": "RouterAgent",
    "decisionType": "route",
    "chosen": "technical_support",
    "alternatives": [{"action": "billing", "confidence": 20}],
    "confidence": 85
})

# Record cost
requests.post(f"{BASE}/api/costs", headers=HEADERS, json={
    "spanId": trace["id"],
    "provider": "openai",
    "model": "gpt-4",
    "inputTokens": 1500,
    "outputTokens": 800
})`}</CodeBlock>
						</Section>

						{/* Frameworks */}
						<Section id="frameworks" title="Framework Integrations">
							<CodeBlock lang="typescript">{`// LangChain — wraps .invoke() and .call()
import { traceLangChainAgent } from '@evalgate/sdk';
const traced = traceLangChainAgent(executor, tracer, { agentName: 'SupportBot' });

// CrewAI — wraps .kickoff() with auto workflow start/end
import { traceCrewAI } from '@evalgate/sdk';
const traced = traceCrewAI(crew, tracer, { crewName: 'ResearchCrew' });

// AutoGen — wraps .initiate_chat() with auto workflow start/end
import { traceAutoGen } from '@evalgate/sdk';
const traced = traceAutoGen(conversation, tracer);

// Generic helper — trace unknown async function
import { traceWorkflowStep } from '@evalgate/sdk';
const result = await traceWorkflowStep(tracer, 'MyAgent', async () => {
  return await doWork();
});`}</CodeBlock>
						</Section>

						{/* Comparison */}
						<Section id="comparison" title="Comparison with Alternatives">
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-zinc-800 text-left text-zinc-500">
											<th className="pb-2 pr-4">Feature</th>
											<th className="pb-2 pr-4">EvalGate</th>
											<th className="pb-2 pr-4">LangSmith</th>
											<th className="pb-2 pr-4">Helicone</th>
											<th className="pb-2">Braintrust</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-800/50">
										{[
											["Open source", "Yes", "No", "Partial", "No"],
											["Multi-agent DAG", "Yes", "No", "No", "No"],
											["Decision auditing", "Yes", "No", "No", "No"],
											["Governance presets", "6", "No", "No", "No"],
											["Cost tracking", "12 models", "Yes", "Yes", "Yes"],
											[
												"Framework integrations",
												"LC, CrewAI, AutoGen",
												"LangChain",
												"OpenAI",
												"LangChain",
											],
											["Self-hostable", "Yes", "No", "Yes", "No"],
										].map(([feature, ...values]) => (
											<tr key={feature}>
												<td className="py-2 pr-4 font-medium text-zinc-300">
													{feature}
												</td>
												{values.map((v, i) => (
													<td
														key={v}
														className={`py-2 pr-4 ${
															i === 0
																? "text-violet-400 font-semibold"
																: "text-zinc-500"
														}`}
													>
														{v}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</Section>
					</div>

					{/* Footer */}
					<div className="mt-20 border-t border-zinc-800 pt-8 text-center text-sm text-zinc-600">
						<p>
							Generated from source code. All signatures match the actual
							codebase.
						</p>
						<p className="mt-2">
							<a
								href="https://github.com/pauly7610/ai-evaluation-platform"
								className="text-violet-500 hover:text-violet-400"
							>
								github.com/pauly7610/ai-evaluation-platform
							</a>
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
