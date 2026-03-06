import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
	AgentConfig,
	Annotation,
	AnnotationLabels,
	AnnotationSettings,
	ApiKeyScopes,
	ArenaResult,
	ArenaScores,
	AssertionsJson,
	AuditLogMetadata,
	BenchmarkCustomMetrics,
	BenchmarkDataset,
	BenchmarkMetrics,
	CandidateEvalTags,
	CandidateExpectedConstraints,
	CandidateMinimizedInput,
	CandidateSourceTraceIds,
	CustomMetrics,
	DecisionAlternative,
	DecisionInputContext,
	DriftAlertMetadata,
	ExecutionSettings,
	ExecutorConfig,
	ExportData,
	FailureReportLineage,
	FailureReportSecondaryCategories,
	FailureReportSuggestedFixes,
	GoldenSetTestCaseIds,
	HandoffContext,
	HumanAnnotationMetadata,
	JobPayload,
	JudgeCriteria,
	JudgeResultMetadata,
	JudgeSettings,
	ModelSettings,
	ProviderKeyMetadata,
	QualityBreakdown,
	QualityFlags,
	QualityInputsJson,
	QualityScoringSpecJson,
	ReportData,
	SpanMetadata,
	SubscriberContext,
	SubscriberTags,
	TestCaseMetadata,
	TestResultMessage,
	ToolCall,
	TraceLog,
	TraceMetadata,
	UserFeedbackValue,
	VersionSnapshotJson,
	WebhookEvents,
	WebhookPayload,
	WorkflowDefinition,
	WorkflowRunMetadata,
} from "./types";

// Auth tables for better-auth
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified")
		.$defaultFn(() => false)
		.notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// Organizations
export const organizations = pgTable("organizations", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationMembers = pgTable(
	"organization_members",
	{
		id: serial("id").primaryKey(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		userId: text("user_id")
			.references(() => user.id)
			.notNull(),
		role: text("role").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		uniqueOrgUser: uniqueIndex("org_members_org_user_unique").on(
			table.organizationId,
			table.userId,
		),
	}),
);

// Evaluations
export const evaluations = pgTable(
	"evaluations",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		type: text("type").notNull(),
		status: text("status").notNull().default("draft"),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		createdBy: text("created_by")
			.references(() => user.id)
			.notNull(),
		executionSettings: jsonb("execution_settings").$type<ExecutionSettings>(),
		modelSettings: jsonb("model_settings").$type<ModelSettings>(),
		customMetrics: jsonb("custom_metrics").$type<CustomMetrics>(),
		executorType: text("executor_type"),
		executorConfig: jsonb("executor_config").$type<ExecutorConfig>(),
		publishedRunId: integer("published_run_id"),
		publishedVersion: integer("published_version"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_evaluations_org_created").on(
			table.organizationId,
			table.createdAt,
		),
	],
);

/**
 * @deprecated Use `testCases` table instead. This table is retained only for
 * backwards-compatible migrations. All new code must use `testCases`.
 */
export const evaluationTestCases = pgTable("evaluation_test_cases", {
	id: serial("id").primaryKey(),
	evaluationId: integer("evaluation_id")
		.references(() => evaluations.id)
		.notNull(),
	input: text("input").notNull(),
	expectedOutput: text("expected_output"),
	metadata: jsonb("metadata").$type<TestCaseMetadata>(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evaluationRuns = pgTable(
	"evaluation_runs",
	{
		id: serial("id").primaryKey(),
		evaluationId: integer("evaluation_id")
			.references(() => evaluations.id)
			.notNull(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		idempotencyKey: text("idempotency_key").unique(),
		status: text("status").notNull().default("pending"),
		totalCases: integer("total_cases").default(0),
		passedCases: integer("passed_cases").default(0),
		failedCases: integer("failed_cases").default(0),
		processedCount: integer("processed_count").default(0), // Heartbeat counter for progress tracking
		traceLog: jsonb("trace_log").$type<TraceLog>(), // Full journey JSON with messages array
		startedAt: timestamp("started_at"),
		completedAt: timestamp("completed_at"),
		environment: text("environment").default("dev"), // dev | staging | prod (for baseline=production)
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_evaluation_runs_eval_status").on(
			table.evaluationId,
			table.status,
		),
		index("idx_evaluation_runs_org_created").on(
			table.organizationId,
			table.createdAt,
		),
	],
);

// Traces
export const traces = pgTable(
	"traces",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		traceId: text("trace_id").notNull().unique(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		status: text("status").notNull().default("pending"),
		analysisStatus: text("analysis_status").default("pending"), // pending | analyzing | analyzed | failed
		source: text("source"), // sdk | api | cli
		environment: text("environment"), // production | staging | dev
		durationMs: integer("duration_ms"),
		metadata: jsonb("metadata").$type<TraceMetadata>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_traces_org_created").on(table.organizationId, table.createdAt),
		uniqueIndex("idx_traces_org_trace_id").on(
			table.organizationId,
			table.traceId,
		),
	],
);

// DEPRECATED: traceSpans table removed in span unification (Phase 2).
// All span data now lives in the `spans` table which has startTime/endTime
// and a UNIQUE constraint on spanId. See spans definition below.

// Annotations
export const annotationTasks = pgTable(
	"annotation_tasks",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		type: text("type").notNull(),
		status: text("status").notNull().default("active"),
		totalItems: integer("total_items").default(0),
		completedItems: integer("completed_items").default(0),
		createdBy: text("created_by")
			.references(() => user.id)
			.notNull(),
		annotationSettings: jsonb(
			"annotation_settings",
		).$type<AnnotationSettings>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("idx_annotation_tasks_org").on(table.organizationId)],
);

export const annotationItems = pgTable("annotation_items", {
	id: serial("id").primaryKey(),
	taskId: integer("task_id")
		.references(() => annotationTasks.id)
		.notNull(),
	content: text("content").notNull(),
	annotation: jsonb("annotation").$type<Annotation>(),
	annotatedBy: text("annotated_by").references(() => user.id),
	annotatedAt: timestamp("annotated_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// LLM Judge
export const llmJudgeConfigs = pgTable(
	"llm_judge_configs",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		model: text("model").notNull(),
		promptTemplate: text("prompt_template").notNull(),
		criteria: jsonb("criteria").$type<JudgeCriteria>(),
		settings: jsonb("settings").$type<JudgeSettings>(),
		createdBy: text("created_by")
			.references(() => user.id)
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("idx_llm_judge_configs_org").on(table.organizationId)],
);

export const llmJudgeResults = pgTable(
	"llm_judge_results",
	{
		id: serial("id").primaryKey(),
		configId: integer("config_id")
			.references(() => llmJudgeConfigs.id)
			.notNull(),
		evaluationRunId: integer("evaluation_run_id").references(
			() => evaluationRuns.id,
		),
		testCaseId: integer("test_case_id").references(() => testCases.id),
		input: text("input").notNull(),
		output: text("output").notNull(),
		score: integer("score"),
		reasoning: text("reasoning"),
		metadata: jsonb("metadata").$type<JudgeResultMetadata>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("idx_llm_judge_results_run").on(table.evaluationRunId)],
);

// Developer Experience Tables
export const apiKeys = pgTable("api_keys", {
	id: serial("id").primaryKey(),
	userId: text("user_id")
		.references(() => user.id)
		.notNull(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	keyHash: text("key_hash").notNull(),
	keyPrefix: text("key_prefix").notNull().unique(),
	name: text("name").notNull(),
	scopes: jsonb("scopes").$type<ApiKeyScopes>().notNull(),
	lastUsedAt: timestamp("last_used_at"),
	expiresAt: timestamp("expires_at"),
	revokedAt: timestamp("revoked_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhooks = pgTable("webhooks", {
	id: serial("id").primaryKey(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	url: text("url").notNull(),
	events: jsonb("events").$type<WebhookEvents>().notNull(),
	secret: text("secret").notNull(), // legacy placeholder column (kept for migration compatibility)
	encryptedSecret: text("encrypted_secret"),
	secretIv: text("secret_iv"),
	secretTag: text("secret_tag"),
	status: text("status").notNull().default("active"),
	lastDeliveredAt: timestamp("last_delivered_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Provider Keys for per-org encrypted third-party API keys
export const providerKeys = pgTable("provider_keys", {
	id: serial("id").primaryKey(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	provider: text("provider").notNull(), // 'openai', 'anthropic', 'google', etc.
	keyName: text("key_name").notNull(),
	encryptedKey: text("encrypted_key").notNull(), // AES-256-GCM encrypted key
	keyType: text("key_type").notNull(), // 'api_key', 'oauth_token', 'service_account'
	keyPrefix: text("key_prefix").notNull(), // First few characters for identification
	iv: text("iv").notNull(), // Initialization vector for decryption
	tag: text("tag").notNull(), // Authentication tag for integrity
	metadata: jsonb("metadata").$type<ProviderKeyMetadata>(), // Additional key information
	isActive: boolean("is_active").default(true),
	lastUsedAt: timestamp("last_used_at"),
	expiresAt: timestamp("expires_at"),
	createdBy: text("created_by")
		.references(() => user.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhookDeliveries = pgTable(
	"webhook_deliveries",
	{
		id: serial("id").primaryKey(),
		webhookId: integer("webhook_id")
			.references(() => webhooks.id)
			.notNull(),
		eventType: text("event_type").notNull(),
		payload: jsonb("payload").$type<WebhookPayload>().notNull(),
		payloadHash: text("payload_hash"), // SHA-256 for deduplication
		status: text("status").notNull().default("pending"),
		responseStatus: integer("response_status"),
		responseBody: text("response_body"),
		attemptCount: integer("attempt_count").default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		dedupIndex: uniqueIndex("idx_webhook_deliveries_dedup").on(
			table.webhookId,
			table.eventType,
			table.payloadHash,
		),
		webhookIdx: index("idx_webhook_deliveries_webhook").on(table.webhookId),
		createdIdx: index("idx_webhook_deliveries_created").on(table.createdAt),
	}),
);

export const apiUsageLogs = pgTable(
	"api_usage_logs",
	{
		id: serial("id").primaryKey(),
		apiKeyId: integer("api_key_id").references(() => apiKeys.id),
		userId: text("user_id").references(() => user.id),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		endpoint: text("endpoint").notNull(),
		method: text("method").notNull(),
		statusCode: integer("status_code").notNull(),
		responseTimeMs: integer("response_time_ms").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_api_usage_logs_key_created").on(table.apiKeyId, table.createdAt),
		index("idx_api_usage_logs_org_created").on(
			table.organizationId,
			table.createdAt,
		),
	],
);

export const humanAnnotations = pgTable("human_annotations", {
	id: serial("id").primaryKey(),
	evaluationRunId: integer("evaluation_run_id")
		.references(() => evaluationRuns.id)
		.notNull(),
	testCaseId: integer("test_case_id")
		.references(() => testCases.id)
		.notNull(),
	annotatorId: text("annotator_id")
		.references(() => user.id)
		.notNull(),
	rating: integer("rating"),
	feedback: text("feedback"),
	labels: jsonb("labels").$type<AnnotationLabels>(),
	metadata: jsonb("metadata").$type<HumanAnnotationMetadata>(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testCases = pgTable("test_cases", {
	id: serial("id").primaryKey(),
	evaluationId: integer("evaluation_id")
		.references(() => evaluations.id)
		.notNull(),
	name: text("name").notNull(),
	input: text("input").notNull(),
	inputHash: text("input_hash"), // SHA-256 of normalized input for trace-linked matching
	expectedOutput: text("expected_output"),
	metadata: jsonb("metadata").$type<TestCaseMetadata>(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testResults = pgTable(
	"test_results",
	{
		id: serial("id").primaryKey(),
		evaluationRunId: integer("evaluation_run_id")
			.references(() => evaluationRuns.id)
			.notNull(),
		testCaseId: integer("test_case_id")
			.references(() => testCases.id)
			.notNull(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		status: text("status").notNull().default("pending"),
		output: text("output"),
		score: integer("score"),
		error: text("error"),
		assertionsJson: jsonb("assertions_json").$type<AssertionsJson>(), // Structured assertion outcomes: { pii: false, toxicity: false, ... }
		traceLinkedMatched: boolean("trace_linked_matched"), // true=matched, false=no span, null=not trace-linked
		hasProvenance: boolean("has_provenance"), // true=model/provider from cost; null=unknown
		durationMs: integer("duration_ms"),
		messages: jsonb("messages").$type<TestResultMessage[]>(), // Raw LLM messages array for each turn
		toolCalls: jsonb("tool_calls").$type<ToolCall[]>(), // Tool arguments and outputs per turn
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_test_results_run").on(table.evaluationRunId),
		index("idx_test_results_case").on(table.testCaseId),
	],
);

export const spans = pgTable(
	"spans",
	{
		id: serial("id").primaryKey(),
		traceId: integer("trace_id")
			.references(() => traces.id)
			.notNull(),
		spanId: text("span_id").notNull().unique(),
		parentSpanId: text("parent_span_id"),
		name: text("name").notNull(),
		type: text("type").notNull(),
		startTime: timestamp("start_time"),
		endTime: timestamp("end_time"),
		durationMs: integer("duration_ms"),
		input: text("input"),
		inputHash: text("input_hash"), // SHA-256 of normalized input for deterministic matching
		output: text("output"),
		evaluationRunId: integer("evaluation_run_id").references(
			() => evaluationRuns.id,
		), // when consumed by trace-linked run
		metadata: jsonb("metadata").$type<SpanMetadata>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_spans_trace_start").on(table.traceId, table.startTime),
	],
);

// Email Subscribers (for lead capture)
export const emailSubscribers = pgTable("email_subscribers", {
	id: serial("id").primaryKey(),
	email: text("email").notNull().unique(),
	source: text("source").notNull(), // 'playground', 'homepage', 'blog', etc.
	context: jsonb("context").$type<SubscriberContext>(), // Additional context like scenario, score, etc.
	status: text("status").notNull().default("active"), // 'active', 'unsubscribed', 'bounced'
	tags: jsonb("tags").$type<SubscriberTags>(), // ['playground-lead', 'high-intent', etc.]
	subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
	unsubscribedAt: timestamp("unsubscribed_at"),
	lastEmailSentAt: timestamp("last_email_sent_at"),
	emailCount: integer("email_count").notNull().default(0),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Multi-Agent Workflows
// ============================================

// Workflow definitions for multi-agent evaluation
export const workflows = pgTable(
	"workflows",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		definition: jsonb("definition").$type<WorkflowDefinition>().notNull(), // DAG structure with nodes and edges
		version: integer("version").default(1),
		status: text("status").notNull().default("draft"), // 'draft', 'active', 'archived'
		// SLA Configuration
		slaLatencyMs: integer("sla_latency_ms"), // Maximum allowed latency in milliseconds
		slaCostDollars: text("sla_cost_dollars"), // Maximum allowed cost per run (decimal as string)
		slaErrorRate: integer("sla_error_rate"), // Maximum allowed error rate (0-100)
		createdBy: text("created_by")
			.references(() => user.id)
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("idx_workflows_org").on(table.organizationId)],
);

// Individual workflow executions
export const workflowRuns = pgTable(
	"workflow_runs",
	{
		id: serial("id").primaryKey(),
		workflowId: integer("workflow_id").references(() => workflows.id),
		traceId: integer("trace_id")
			.references(() => traces.id)
			.notNull(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		status: text("status").notNull().default("running"), // 'running', 'completed', 'failed', 'cancelled'
		input: jsonb("input").$type<Record<string, unknown>>(),
		output: jsonb("output").$type<Record<string, unknown>>(),
		totalCost: text("total_cost"), // decimal as string for precision
		totalDurationMs: integer("total_duration_ms"),
		agentCount: integer("agent_count"),
		handoffCount: integer("handoff_count"),
		retryCount: integer("retry_count").default(0),
		errorMessage: text("error_message"),
		metadata: jsonb("metadata").$type<WorkflowRunMetadata>(),
		startedAt: timestamp("started_at").notNull(),
		completedAt: timestamp("completed_at"),
	},
	(table) => [
		index("idx_workflow_runs_workflow_status").on(
			table.workflowId,
			table.status,
		),
	],
);

// Agent handoff events between agents in a workflow
export const agentHandoffs = pgTable("agent_handoffs", {
	id: serial("id").primaryKey(),
	workflowRunId: integer("workflow_run_id")
		.references(() => workflowRuns.id)
		.notNull(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	fromSpanId: text("from_span_id"),
	toSpanId: text("to_span_id").notNull(),
	fromAgent: text("from_agent"),
	toAgent: text("to_agent").notNull(),
	handoffType: text("handoff_type").notNull(), // 'delegation', 'escalation', 'parallel', 'fallback'
	context: jsonb("context").$type<HandoffContext>(), // data passed between agents
	timestamp: timestamp("timestamp").notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Decision Auditing
// ============================================

// Agent decision tracking for audit trails
export const agentDecisions = pgTable("agent_decisions", {
	id: serial("id").primaryKey(),
	spanId: integer("span_id")
		.references(() => spans.id)
		.notNull(),
	workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	agentName: text("agent_name").notNull(),
	decisionType: text("decision_type").notNull(), // 'action', 'tool', 'delegate', 'respond'
	chosen: text("chosen").notNull(), // the action/tool that was chosen
	alternatives: jsonb("alternatives").$type<DecisionAlternative[]>().notNull(), // array of alternative options considered
	reasoning: text("reasoning"), // why this choice was made
	confidence: integer("confidence"), // 0-100 confidence score
	inputContext: jsonb("input_context").$type<DecisionInputContext>(), // context that influenced the decision
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Cost Tracking
// ============================================

// Cost records for individual LLM calls and operations
export const costRecords = pgTable(
	"cost_records",
	{
		id: serial("id").primaryKey(),
		spanId: integer("span_id")
			.references(() => spans.id)
			.notNull(),
		workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id),
		evaluationRunId: integer("evaluation_run_id").references(
			() => evaluationRuns.id,
		),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		provider: text("provider").notNull(), // 'openai', 'anthropic', 'google', etc.
		model: text("model").notNull(),
		inputTokens: integer("input_tokens").notNull(),
		outputTokens: integer("output_tokens").notNull(),
		totalTokens: integer("total_tokens").notNull(),
		inputCost: text("input_cost").notNull(), // decimal as string
		outputCost: text("output_cost").notNull(),
		totalCost: text("total_cost").notNull(),
		isRetry: boolean("is_retry").default(false),
		retryNumber: integer("retry_number").default(0),
		costCategory: text("cost_category").notNull(), // 'llm', 'tool', 'embedding', 'other'
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_cost_records_org_created").on(
			table.organizationId,
			table.createdAt,
		),
		index("idx_cost_records_run").on(table.evaluationRunId),
	],
);

// Provider pricing table (admin-managed)
export const providerPricing = pgTable("provider_pricing", {
	id: serial("id").primaryKey(),
	provider: text("provider").notNull(),
	model: text("model").notNull(),
	inputPricePerMillion: text("input_price_per_million").notNull(), // price per 1M input tokens
	outputPricePerMillion: text("output_price_per_million").notNull(), // price per 1M output tokens
	effectiveDate: text("effective_date").notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Benchmarks
// ============================================

// Benchmark definitions
export const benchmarks = pgTable("benchmarks", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	taskType: text("task_type").notNull(), // 'qa', 'coding', 'reasoning', 'tool_use', 'multi_step'
	dataset: jsonb("dataset").$type<BenchmarkDataset>(), // test cases for the benchmark
	metrics: jsonb("metrics").$type<BenchmarkMetrics>().notNull(), // which metrics to track
	isPublic: boolean("is_public").default(false),
	createdBy: text("created_by")
		.references(() => user.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Agent configurations being benchmarked
export const agentConfigs = pgTable("agent_configs", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	architecture: text("architecture").notNull(), // 'react', 'cot', 'tot', 'custom'
	model: text("model").notNull(),
	config: jsonb("config").$type<AgentConfig>(), // full agent configuration
	description: text("description"),
	createdBy: text("created_by")
		.references(() => user.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Benchmark results
export const benchmarkResults = pgTable("benchmark_results", {
	id: serial("id").primaryKey(),
	benchmarkId: integer("benchmark_id")
		.references(() => benchmarks.id)
		.notNull(),
	agentConfigId: integer("agent_config_id")
		.references(() => agentConfigs.id)
		.notNull(),
	workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id),
	accuracy: integer("accuracy"), // 0-100
	latencyP50: integer("latency_p50"), // median latency in ms
	latencyP95: integer("latency_p95"), // 95th percentile latency in ms
	totalCost: text("total_cost"), // total cost in dollars
	successRate: integer("success_rate"), // 0-100
	toolUseEfficiency: integer("tool_use_efficiency"), // 0-100
	customMetrics: jsonb("custom_metrics").$type<BenchmarkCustomMetrics>(),
	runCount: integer("run_count").default(1),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// VIRAL FEATURES - Priority 5 Tables
// ============================================

// Golden Sets for One-Click Regression (CI/CD for Prompts)
export const goldenSets = pgTable("golden_sets", {
	id: serial("id").primaryKey(),
	evaluationId: integer("evaluation_id")
		.references(() => evaluations.id)
		.notNull(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	name: text("name").notNull().default("Default Golden Set"),
	testCaseIds: jsonb("test_case_ids").$type<GoldenSetTestCaseIds>().notNull(), // number[] — the 5 most important
	lastStatus: text("last_status").default("unknown"), // 'passed', 'failed', 'unknown'
	lastRunAt: timestamp("last_run_at"),
	passThreshold: integer("pass_threshold").default(70), // Minimum score to pass (0-100)
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Arena Matches for LLM Battle Arena (Social Proof)
export const arenaMatches = pgTable("arena_matches", {
	id: serial("id").primaryKey(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	prompt: text("prompt").notNull(),
	winnerId: text("winner_id").notNull(),
	winnerLabel: text("winner_label").notNull(),
	judgeReasoning: text("judge_reasoning"),
	results: jsonb("results").$type<ArenaResult[]>().notNull(), // ArenaResult[]
	scores: jsonb("scores").$type<ArenaScores>(), // { "GPT-4o": 87, "Claude": 92 }
	createdBy: text("created_by")
		.references(() => user.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Report Cards for Shareable Evaluation Certificates (Marketing Asset)
export const reportCards = pgTable("report_cards", {
	id: serial("id").primaryKey(),
	evaluationId: integer("evaluation_id")
		.references(() => evaluations.id)
		.notNull(),
	evaluationRunId: integer("evaluation_run_id")
		.references(() => evaluationRuns.id)
		.notNull(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	slug: text("slug").notNull().unique(), // Public URL: /report/abc123
	title: text("title").notNull(),
	description: text("description"),
	isPublic: boolean("is_public").default(true),
	reportData: jsonb("report_data").$type<ReportData>().notNull(), // Snapshot of scores/results
	expiresAt: timestamp("expires_at"),
	viewCount: integer("view_count").default(0),
	createdBy: text("created_by")
		.references(() => user.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// AUDIT & GOVERNANCE
// ============================================

// Immutable audit log for security events and data mutations
export const auditLogs = pgTable(
	"audit_logs",
	{
		id: serial("id").primaryKey(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		userId: text("user_id"),
		action: text("action").notNull(),
		resourceType: text("resource_type"),
		resourceId: text("resource_id"),
		metadata: jsonb("metadata").$type<AuditLogMetadata>(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_audit_logs_org_created").on(
			table.organizationId,
			table.createdAt,
		),
	],
);

// ============================================
// QUALITY SCORING
// ============================================

// Quality scores computed per evaluation run
export const qualityScores = pgTable(
	"quality_scores",
	{
		id: serial("id").primaryKey(),
		evaluationRunId: integer("evaluation_run_id")
			.references(() => evaluationRuns.id)
			.notNull(),
		evaluationId: integer("evaluation_id")
			.references(() => evaluations.id)
			.notNull(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		score: integer("score").notNull(),
		total: integer("total"), // test case count for minN gating
		traceCoverageRate: text("trace_coverage_rate"), // nullable, for trace-linked runs: matched/total
		provenanceCoverageRate: text("provenance_coverage_rate"), // 0..1, per-test-case fraction with model/provider
		breakdown: jsonb("breakdown").$type<QualityBreakdown>().notNull(),
		flags: jsonb("flags").$type<QualityFlags>().notNull(),
		evidenceLevel: text("evidence_level"), // 'strong' | 'medium' | 'weak'
		scoringVersion: text("scoring_version").notNull().default("v1"),
		model: text("model"),
		isBaseline: boolean("is_baseline").default(false),
		inputsJson: jsonb("inputs_json").$type<QualityInputsJson>(),
		scoringSpecJson: jsonb("scoring_spec_json").$type<QualityScoringSpecJson>(),
		inputsHash: text("inputs_hash"),
		scoringSpecHash: text("scoring_spec_hash"),
		scoringCommit: text("scoring_commit"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_quality_scores_run").on(table.evaluationRunId),
		index("idx_quality_scores_created").on(table.createdAt),
	],
);

// ============================================
// EVALUATION VERSIONING
// ============================================

// Snapshots of evaluation configs at publish time
export const evaluationVersions = pgTable("evaluation_versions", {
	id: serial("id").primaryKey(),
	evaluationId: integer("evaluation_id")
		.references(() => evaluations.id)
		.notNull(),
	version: integer("version").notNull(),
	snapshotJson: jsonb("snapshot_json").$type<VersionSnapshotJson>().notNull(),
	diffSummary: text("diff_summary"),
	createdBy: text("created_by")
		.references(() => user.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// DRIFT DETECTION
// ============================================

// Alerts generated by drift detection
export const driftAlerts = pgTable("drift_alerts", {
	id: serial("id").primaryKey(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	evaluationId: integer("evaluation_id").references(() => evaluations.id),
	alertType: text("alert_type").notNull(),
	severity: text("severity").notNull(),
	explanation: text("explanation").notNull(),
	model: text("model"),
	currentValue: text("current_value"),
	baselineValue: text("baseline_value"),
	zScoreValue: text("z_score_value"),
	metadata: jsonb("metadata").$type<DriftAlertMetadata>(),
	acknowledgedAt: timestamp("acknowledged_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// SIGNED REPORT EXPORT
// ============================================

// Shared reports with HMAC signatures
export const sharedReports = pgTable("shared_reports", {
	id: serial("id").primaryKey(),
	organizationId: integer("organization_id")
		.references(() => organizations.id)
		.notNull(),
	evaluationId: integer("evaluation_id")
		.references(() => evaluations.id)
		.notNull(),
	evaluationRunId: integer("evaluation_run_id")
		.references(() => evaluationRuns.id)
		.notNull(),
	shareToken: text("share_token").notNull().unique(),
	reportBody: text("report_body").notNull(),
	signature: text("signature").notNull(),
	expiresAt: timestamp("expires_at"),
	viewCount: integer("view_count").default(0),
	createdBy: text("created_by")
		.references(() => user.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// SHARED EXPORTS (Public share links)
// ============================================

export const sharedExports = pgTable(
	"shared_exports",
	{
		id: serial("id").primaryKey(),
		shareId: text("share_id").notNull().unique(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		evaluationId: integer("evaluation_id").references(() => evaluations.id),
		evaluationRunId: integer("evaluation_run_id").references(
			() => evaluationRuns.id,
		),
		shareScope: text("share_scope").notNull().default("evaluation"), // "evaluation" | "run"
		exportData: jsonb("export_data").$type<ExportData>().notNull(),
		exportHash: text("export_hash").notNull(),
		isPublic: boolean("is_public").default(true),
		revokedAt: timestamp("revoked_at"),
		revokedBy: text("revoked_by"),
		revokedReason: text("revoked_reason"), // Admin only; never exposed in public 410 response
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at"),
		expiresAt: timestamp("expires_at"),
		viewCount: integer("view_count").default(0),
	},
	(table) => ({
		sharedExportsShareIdUnique: uniqueIndex(
			"shared_exports_share_id_unique",
		).on(table.shareId),
		sharedExportsOrgEvalUnique: uniqueIndex("shared_exports_org_eval_unique")
			.on(table.organizationId, table.evaluationId)
			.where(sql`${table.shareScope} = 'evaluation'`),
		sharedExportsOrgRunUnique: uniqueIndex("shared_exports_org_run_unique")
			.on(table.organizationId, table.evaluationRunId)
			.where(sql`${table.shareScope} = 'run'`),
	}),
);

// ============================================
// BACKGROUND JOBS
// ============================================

export const jobs = pgTable(
	"jobs",
	{
		id: serial("id").primaryKey(),
		type: text("type").notNull(), // 'webhook_delivery'
		payload: jsonb("payload").$type<JobPayload>().notNull(),
		status: text("status").notNull().default("pending"), // pending | running | success | dead_letter
		attempt: integer("attempt").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(5),
		nextRunAt: timestamp("next_run_at").notNull(),
		lastError: text("last_error"),
		lastErrorCode: text("last_error_code"),
		idempotencyKey: text("idempotency_key").unique(),
		organizationId: integer("organization_id").references(
			() => organizations.id,
		),
		// Lock / TTL fields (set on claim, cleared on finish)
		lockedAt: timestamp("locked_at"),
		lockedUntil: timestamp("locked_until"),
		lockedBy: text("locked_by"),
		// Attempt timing
		lastStartedAt: timestamp("last_started_at"),
		lastFinishedAt: timestamp("last_finished_at"),
		lastDurationMs: integer("last_duration_ms"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_jobs_status_next_run").on(table.status, table.nextRunAt),
	],
);

export const jobRunnerLocks = pgTable("job_runner_locks", {
	lockName: text("lock_name").primaryKey(),
	lockedUntil: bigint("locked_until", { mode: "number" }).notNull().default(0),
	lockedBy: text("locked_by"),
	updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(0),
});

// ── Production → CI Loop ─────────────────────────────────────────────────────

export const failureReports = pgTable(
	"failure_reports",
	{
		id: serial("id").primaryKey(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		traceId: integer("trace_id").references(() => traces.id, {
			onDelete: "set null",
		}),
		spanId: text("span_id"),
		evaluationRunId: integer("evaluation_run_id").references(
			() => evaluationRuns.id,
		),
		category: text("category").notNull(),
		secondaryCategories: jsonb(
			"secondary_categories",
		).$type<FailureReportSecondaryCategories>(),
		severity: text("severity").notNull(),
		description: text("description").notNull(),
		evidence: text("evidence"),
		confidence: integer("confidence").notNull(), // stored as 0-100 integer (divide by 100 for 0-1)
		detectorCount: integer("detector_count").notNull().default(1),
		detectedBy: text("detected_by").notNull(),
		suggestedFixes:
			jsonb("suggested_fixes").$type<FailureReportSuggestedFixes>(),
		lineage: jsonb("lineage").$type<FailureReportLineage>(),
		groupHash: text("group_hash"),
		occurrenceCount: integer("occurrence_count").notNull().default(1),
		modelVersion: text("model_version"),
		promptVersion: text("prompt_version"),
		status: text("status").notNull().default("open"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_failure_reports_org_created").on(
			table.organizationId,
			table.createdAt,
		),
		index("idx_failure_reports_group").on(
			table.organizationId,
			table.groupHash,
		),
	],
);

export const candidateEvalCases = pgTable(
	"candidate_eval_cases",
	{
		id: serial("id").primaryKey(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		failureReportId: integer("failure_report_id").references(
			() => failureReports.id,
		),
		traceId: integer("trace_id").references(() => traces.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		tags: jsonb("tags").$type<CandidateEvalTags>(),
		sourceTraceIds: jsonb("source_trace_ids").$type<CandidateSourceTraceIds>(),
		expectedConstraints: jsonb(
			"expected_constraints",
		).$type<CandidateExpectedConstraints>(),
		minimizedInput: jsonb("minimized_input").$type<CandidateMinimizedInput>(),
		evalCaseId: text("eval_case_id").notNull(),
		qualityScore: integer("quality_score"),
		qualityVerdict: text("quality_verdict"),
		autoPromoteEligible: boolean("auto_promote_eligible")
			.notNull()
			.default(false),
		status: text("status").notNull().default("quarantined"),
		rationale: text("rationale"),
		promotedToEvaluationId: integer("promoted_to_evaluation_id").references(
			() => evaluations.id,
		),
		reviewedBy: text("reviewed_by").references(() => user.id),
		reviewedAt: timestamp("reviewed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_candidates_org_status").on(table.organizationId, table.status),
		index("idx_candidates_org_auto_promote").on(
			table.organizationId,
			table.autoPromoteEligible,
		),
	],
);

export const userFeedback = pgTable(
	"user_feedback",
	{
		id: serial("id").primaryKey(),
		organizationId: integer("organization_id")
			.references(() => organizations.id)
			.notNull(),
		traceId: integer("trace_id")
			.references(() => traces.id, { onDelete: "set null" })
			.notNull(),
		spanId: text("span_id"),
		feedbackType: text("feedback_type").notNull(),
		value: jsonb("value").$type<UserFeedbackValue>(),
		userIdExternal: text("user_id_external"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_user_feedback_trace").on(table.traceId),
		index("idx_user_feedback_org_created").on(
			table.organizationId,
			table.createdAt,
		),
	],
);
