import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "API Reference — EvalAI",
	description:
		"Full OpenAPI reference for the EvalAI platform REST API — evaluations, traces, webhooks, and more.",
};

const endpointGroups = [
	{
		name: "Evaluations",
		prefix: "/api/evaluations",
		description:
			"Create, read, update, and delete evaluations. Manage test cases, runs, exports, regression checks, and publishing.",
		endpoints: 12,
	},
	{
		name: "Traces",
		prefix: "/api/traces",
		description:
			"Record and query LLM traces and spans for full observability of your AI pipeline.",
		endpoints: 3,
	},
	{
		name: "LLM Judge",
		prefix: "/api/llm-judge",
		description:
			"Configure AI judge models, run automated evaluations, and query alignment scores.",
		endpoints: 4,
	},
	{
		name: "Workflows",
		prefix: "/api/workflows",
		description:
			"Define multi-step evaluation workflows with handoffs and run tracking.",
		endpoints: 5,
	},
	{
		name: "Developer",
		prefix: "/api/developer",
		description:
			"Manage API keys, webhooks, webhook deliveries, and usage metrics.",
		endpoints: 7,
	},
	{
		name: "Quality & Reports",
		prefix: "/api/quality, /api/reports, /api/report-cards",
		description:
			"Compute quality scores, generate reports, and view evaluation report cards.",
		endpoints: 5,
	},
	{
		name: "Benchmarks",
		prefix: "/api/benchmarks",
		description:
			"Create benchmarks, submit results, and view leaderboards for model comparisons.",
		endpoints: 4,
	},
	{
		name: "Arena",
		prefix: "/api/arena-matches, /api/arena",
		description:
			"Run head-to-head model comparisons, view match results, and ELO leaderboards.",
		endpoints: 5,
	},
	{
		name: "Annotations",
		prefix: "/api/annotations",
		description:
			"Manage human annotation tasks and items for RLHF and evaluation labeling.",
		endpoints: 4,
	},
	{
		name: "Shadow Evaluations",
		prefix: "/api/shadow-evals",
		description:
			"Run shadow evaluations against production traffic and view aggregate stats.",
		endpoints: 3,
	},
	{
		name: "Streaming",
		prefix: "/api/stream",
		description:
			"Server-Sent Events endpoints for real-time evaluation progress and results.",
		endpoints: 2,
	},
	{
		name: "Organizations",
		prefix: "/api/organizations",
		description:
			"Manage organization settings and retrieve the current organization context.",
		endpoints: 2,
	},
	{
		name: "Drift & Alerts",
		prefix: "/api/drift",
		description:
			"Monitor model drift and manage alerting rules for quality regressions.",
		endpoints: 2,
	},
	{
		name: "Costs & Decisions",
		prefix: "/api/costs, /api/decisions",
		description:
			"Track LLM usage costs, view cost trends, and query decision audit logs.",
		endpoints: 4,
	},
	{
		name: "Misc",
		prefix:
			"/api/mcp, /api/evaluation-templates, /api/exports, /api/audit-logs",
		description:
			"MCP tool integration, evaluation template catalog, shared export access, and audit logs.",
		endpoints: 5,
	},
] as const;

export default function ApiReferencePage() {
	return (
		<div className="max-w-4xl space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
				<p className="mt-2 text-muted-foreground">
					The EvalAI platform exposes a comprehensive REST API described by an{" "}
					<Link
						href="/docs/openapi.json"
						className="font-medium text-primary hover:underline"
					>
						OpenAPI 3.1 specification
					</Link>
					. All authenticated endpoints require either a session cookie or an
					API key passed via the{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-sm">
						Authorization: Bearer
					</code>{" "}
					header.
				</p>
			</div>

			<div className="flex flex-wrap gap-3">
				<Link
					href="/docs/openapi.json"
					target="_blank"
					className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<ExternalLink className="h-4 w-4" />
					Download OpenAPI Spec
				</Link>
				<Link
					href="/developer/api-keys"
					className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
				>
					Get an API Key
				</Link>
			</div>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold">Endpoint Groups</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					{endpointGroups.map((group) => (
						<div
							key={group.name}
							className="rounded-lg border p-4 space-y-2 hover:border-primary/50 transition-colors"
						>
							<div className="flex items-center justify-between">
								<h3 className="font-semibold">{group.name}</h3>
								<span className="text-xs text-muted-foreground">
									{group.endpoints} endpoints
								</span>
							</div>
							<p className="text-sm text-muted-foreground">
								{group.description}
							</p>
							<code className="block text-xs text-primary/80 font-mono">
								{group.prefix}
							</code>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold">Authentication</h2>
				<div className="rounded-lg border p-4 space-y-3 text-sm">
					<p>
						All API requests must be authenticated using one of the following
						methods:
					</p>
					<ul className="list-disc list-inside space-y-1 text-muted-foreground">
						<li>
							<span className="font-medium text-foreground">API Key</span> —
							pass your key as{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">
								Authorization: Bearer &lt;key&gt;
							</code>
						</li>
						<li>
							<span className="font-medium text-foreground">
								Session Cookie
							</span>{" "}
							— automatically set when logged in via the web UI
						</li>
					</ul>
					<p className="text-muted-foreground">
						API keys can be created and managed from the{" "}
						<Link
							href="/developer/api-keys"
							className="text-primary hover:underline"
						>
							API Keys
						</Link>{" "}
						page. Each key is scoped to specific permissions (e.g.{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">
							traces:read
						</code>
						,{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">
							evaluations:write
						</code>
						).
					</p>
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold">Rate Limits</h2>
				<div className="rounded-lg border p-4 text-sm">
					<p className="mb-3">
						Rate limits are applied per API key based on your plan tier:
					</p>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						{[
							{ tier: "Free", limit: "200/min" },
							{ tier: "Pro", limit: "1,000/min" },
							{ tier: "Enterprise", limit: "10,000/min" },
							{ tier: "Anonymous", limit: "30/min" },
						].map((t) => (
							<div key={t.tier} className="rounded-md bg-muted p-3 text-center">
								<div className="text-xs text-muted-foreground">{t.tier}</div>
								<div className="font-semibold">{t.limit}</div>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold">Base URLs</h2>
				<div className="rounded-lg border p-4 text-sm space-y-2">
					<div className="flex items-center gap-3">
						<span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
							Production
						</span>
						<code className="text-xs font-mono">
							https://v0-ai-evaluation-platform-nu.vercel.app
						</code>
					</div>
					<div className="flex items-center gap-3">
						<span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
							Local
						</span>
						<code className="text-xs font-mono">http://localhost:3000</code>
					</div>
				</div>
			</section>
		</div>
	);
}
