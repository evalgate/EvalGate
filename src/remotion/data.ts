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
	hookPain: { start: 0, duration: 2 * FPS },
	hookCatch: { start: 2 * FPS, duration: 2 * FPS },
	quickStartTerminal: { start: 4 * FPS, duration: 11 * FPS },
	quickStartSummary: { start: 15 * FPS, duration: 12 * FPS },
	loop: { start: 27 * FPS, duration: 20 * FPS },
	trust: { start: 47 * FPS, duration: 10 * FPS },
	explain: { start: 57 * FPS, duration: 20 * FPS },
	remove: { start: 77 * FPS, duration: 8 * FPS },
};

export const TOTAL_FRAMES = 85 * FPS;

export const CAPTIONS: Array<{
	text: string;
	startFrame: number;
	endFrame: number;
}> = [
	{
		text: "You shipped a prompt change. Quality dropped 15%. You found out from a user.",
		startFrame: 0,
		endFrame: 2 * FPS,
	},
	{
		text: "EvalGate catches it in CI before it ships.",
		startFrame: 2 * FPS,
		endFrame: 4 * FPS,
	},
	{
		text: "2-minute setup: npx @evalgate/sdk init, then git push.",
		startFrame: 4 * FPS,
		endFrame: 15 * FPS,
	},
	{
		text: "GitHub Actions blocks regressions with a readable delta table.",
		startFrame: 15 * FPS,
		endFrame: 27 * FPS,
	},
	{
		text: "collect → detect → generate → promote → gate → ship",
		startFrame: 27 * FPS,
		endFrame: 47 * FPS,
	},
	{
		text: "Trust signal: gate and explain are offline and never phone home.",
		startFrame: 47 * FPS,
		endFrame: 57 * FPS,
	},
	{
		text: "npx evalgate explain shows root cause + exact fix commands from local artifacts.",
		startFrame: 57 * FPS,
		endFrame: 77 * FPS,
	},
	{
		text: "Remove anytime. No account cancellation. No data export. Your tests keep working.",
		startFrame: 77 * FPS,
		endFrame: 85 * FPS,
	},
];
