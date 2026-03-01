export const WORKFLOW_NODES = [
	{
		id: "router",
		type: "agent",
		name: "RouterAgent",
		status: "completed",
		x: 60,
		y: 180,
	},
	{
		id: "technical",
		type: "agent",
		name: "TechnicalAgent",
		status: "completed",
		x: 340,
		y: 60,
	},
	{
		id: "billing",
		type: "agent",
		name: "BillingAgent",
		status: "completed",
		x: 340,
		y: 180,
	},
	{
		id: "fraud",
		type: "decision",
		name: "FraudCheck",
		status: "completed",
		x: 340,
		y: 300,
		requiresApproval: true,
	},
	{
		id: "human",
		type: "human",
		name: "HumanReview",
		status: "running",
		x: 620,
		y: 180,
		blocked: true,
	},
	{
		id: "notify",
		type: "llm",
		name: "NotifyAgent",
		status: "pending",
		x: 620,
		y: 60,
	},
] as const;

export const WORKFLOW_EDGES = [
	{ from: "router", to: "technical", label: "is_technical" },
	{ from: "router", to: "billing", label: "is_billing" },
	{ from: "router", to: "fraud", label: "check_fraud" },
	{ from: "technical", to: "notify" },
	{ from: "billing", to: "human" },
	{ from: "fraud", to: "human", label: "review" },
] as const;

export const WORKFLOW_RUNS = [
	{
		id: 1,
		status: "completed",
		duration: 2340,
		cost: "$0.0847",
		agents: 4,
		handoffs: 3,
		time: "2 min ago",
	},
	{
		id: 2,
		status: "failed",
		duration: 1205,
		cost: "$0.0312",
		agents: 3,
		handoffs: 2,
		time: "15 min ago",
	},
	{
		id: 3,
		status: "running",
		duration: null,
		cost: null,
		agents: 2,
		handoffs: 1,
		time: "Just now",
	},
] as const;

export const HANDOFF_STATS = [
	{ from: "RouterAgent", to: "TechnicalAgent", type: "delegation", count: 42 },
	{ from: "RouterAgent", to: "BillingAgent", type: "delegation", count: 28 },
	{ from: "FraudCheck", to: "HumanReview", type: "escalation", count: 7 },
	{ from: "TechnicalAgent", to: "NotifyAgent", type: "delegation", count: 38 },
] as const;

export const COST_SUMMARY = {
	spend30d: "$245.67",
	spend7d: "$58.23",
	spend7dChange: "+7.2%",
	requests30d: "8,420",
	tokens30d: "12.50M",
	avgCost: "$0.0292",
};

export const COST_TRENDS = [
	{ date: "Jan 1", cost: 8.5 },
	{ date: "Jan 2", cost: 9.2 },
	{ date: "Jan 3", cost: 7.8 },
	{ date: "Jan 4", cost: 15.5 },
	{ date: "Jan 5", cost: 11.2 },
	{ date: "Jan 6", cost: 6.3 },
	{ date: "Jan 7", cost: 4.9 },
];

export const TOP_MODELS = [
	{
		model: "GPT-4o",
		provider: "OpenAI",
		cost: 125.5,
		pct: 51,
		color: "#8b5cf6",
	},
	{
		model: "Claude 3.5 Sonnet",
		provider: "Anthropic",
		cost: 78.3,
		pct: 32,
		color: "#3b82f6",
	},
	{
		model: "GPT-4o-mini",
		provider: "OpenAI",
		cost: 25.12,
		pct: 10,
		color: "#22c55e",
	},
	{
		model: "embed-3-small",
		provider: "OpenAI",
		cost: 12.45,
		pct: 5,
		color: "#f59e0b",
	},
	{
		model: "Gemini Flash",
		provider: "Google",
		cost: 4.3,
		pct: 2,
		color: "#ef4444",
	},
];

export const LEADERBOARD = [
	{
		rank: 1,
		name: "GPT-4 ReAct Agent",
		arch: "react",
		model: "gpt-4o",
		accuracy: 94,
		latency: 1250,
		success: 96,
		score: 92,
	},
	{
		rank: 2,
		name: "Claude CoT Agent",
		arch: "cot",
		model: "claude-3.5-sonnet",
		accuracy: 89,
		latency: 980,
		success: 91,
		score: 88,
	},
	{
		rank: 3,
		name: "GPT-4o ToT Agent",
		arch: "tot",
		model: "gpt-4o",
		accuracy: 87,
		latency: 2100,
		success: 88,
		score: 84,
	},
	{
		rank: 4,
		name: "Gemini Custom",
		arch: "custom",
		model: "gemini-1.5-pro",
		accuracy: 82,
		latency: 1450,
		success: 85,
		score: 79,
	},
	{
		rank: 5,
		name: "Mistral ReAct",
		arch: "react",
		model: "mistral-large",
		accuracy: 78,
		latency: 890,
		success: 82,
		score: 75,
	},
];

export const RADAR_METRICS = [
	"Accuracy",
	"Speed",
	"Cost Eff.",
	"Reliability",
	"Tool Use",
];
export const RADAR_DATA = {
	react: [85, 70, 65, 88, 90],
	cot: [82, 75, 70, 85, 75],
	tot: [78, 60, 55, 82, 85],
};

export const SDK_INSTALL = "npm install @evalgate/sdk";

export const SDK_CODE = `import { WorkflowTracer } from '@evalgate/sdk';

const tracer = new WorkflowTracer(client, {
  organizationId: 123
});

await tracer.startWorkflow('Customer Support');

await tracer.recordDecision({
  agent: 'RouterAgent',
  type: 'route',
  chosen: 'technical_support',
  confidence: 85,
  reasoning: 'Technical keywords detected'
});

await tracer.endWorkflow({ resolution: 'resolved' });`;

export const FPS = 30;
export const SEGMENTS = {
	intro: { start: 0, duration: 4 * FPS },
	dashboard: { start: 4 * FPS, duration: 5 * FPS },
	evaluationsList: { start: 9 * FPS, duration: 4 * FPS },
	evaluationDetail: { start: 13 * FPS, duration: 5 * FPS },
	traces: { start: 18 * FPS, duration: 5 * FPS },
	workflowsList: { start: 23 * FPS, duration: 4 * FPS },
	workflowStats: { start: 27 * FPS, duration: 4 * FPS },
	workflowDag: { start: 31 * FPS, duration: 7 * FPS },
	workflowRuns: { start: 38 * FPS, duration: 5 * FPS },
	costsSummary: { start: 43 * FPS, duration: 4 * FPS },
	costsCharts: { start: 47 * FPS, duration: 6 * FPS },
	benchmarks: { start: 53 * FPS, duration: 6 * FPS },
	sdk: { start: 59 * FPS, duration: 5 * FPS },
	closing: { start: 64 * FPS, duration: 6 * FPS },
};

export const TOTAL_FRAMES = 70 * FPS;

export const CAPTIONS: Array<{
	text: string;
	startFrame: number;
	endFrame: number;
}> = [
	{
		text: "EvalAI — Agent orchestration with visual workflows, cost tracking, and benchmarking.",
		startFrame: 0,
		endFrame: 3.8 * FPS,
	},
	{
		text: "Dashboard overview — evaluations, recent runs, traces, and quality scores at a glance.",
		startFrame: 4 * FPS,
		endFrame: 8.8 * FPS,
	},
	{
		text: "Evaluations list with type badges, pass rates, and filters for unit tests, model evals, and A/B tests.",
		startFrame: 9 * FPS,
		endFrame: 12.8 * FPS,
	},
	{
		text: "Drill into an evaluation — AI quality grade, test case results, and metric breakdowns.",
		startFrame: 13 * FPS,
		endFrame: 17.8 * FPS,
	},
	{
		text: "Traces — monitor every LLM call, tool invocation, and agent span with a waterfall timeline.",
		startFrame: 18 * FPS,
		endFrame: 22.8 * FPS,
	},
	{
		text: "Workflow cards show DAG previews, status badges, run counts, and success rates.",
		startFrame: 23 * FPS,
		endFrame: 26.8 * FPS,
	},
	{
		text: "Each workflow tracks total runs, success rate, average duration, and total cost.",
		startFrame: 27 * FPS,
		endFrame: 30.8 * FPS,
	},
	{
		text: "Interactive SVG DAG with 6 node types: agent, tool, decision, parallel, human, LLM.",
		startFrame: 31 * FPS,
		endFrame: 34.5 * FPS,
	},
	{
		text: 'Governance badges — amber "Approval" and red "Blocked" — render directly on nodes.',
		startFrame: 34.5 * FPS,
		endFrame: 37.8 * FPS,
	},
	{
		text: "Full execution history — per-run cost, duration, agent count, and handoff tracking.",
		startFrame: 38 * FPS,
		endFrame: 42.8 * FPS,
	},
	{
		text: "Real-time cost analytics: 30-day spend, 7-day trend, total tokens, avg cost per request.",
		startFrame: 43 * FPS,
		endFrame: 46.8 * FPS,
	},
	{
		text: "Daily cost trend and model distribution. Spot spikes immediately.",
		startFrame: 47 * FPS,
		endFrame: 50 * FPS,
	},
	{
		text: "Cost breakdown by model — see exactly where money goes.",
		startFrame: 50 * FPS,
		endFrame: 52.8 * FPS,
	},
	{
		text: "Leaderboard ranks agents by accuracy, latency, success rate, and composite score.",
		startFrame: 53 * FPS,
		endFrame: 56 * FPS,
	},
	{
		text: "Radar chart compares ReAct vs Chain-of-Thought vs Tree-of-Thought across 5 metrics.",
		startFrame: 56 * FPS,
		endFrame: 58.8 * FPS,
	},
	{
		text: "Published on npm — install @evalgate/sdk and start tracing in minutes.",
		startFrame: 59 * FPS,
		endFrame: 63.8 * FPS,
	},
	{
		text: "Evaluations. Traces. Workflows. Cost analytics. Benchmarking. Published SDK.",
		startFrame: 64 * FPS,
		endFrame: 69.8 * FPS,
	},
];
