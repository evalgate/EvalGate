import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';



// Auth tables for better-auth
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// Organizations
export const organizations = sqliteTable('organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const organizationMembers = sqliteTable('organization_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => user.id).notNull(),
  role: text('role').notNull(),
  createdAt: text('created_at').notNull(),
});

// Evaluations
export const evaluations = sqliteTable('evaluations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  status: text('status').notNull().default('draft'),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  createdBy: text('created_by').references(() => user.id).notNull(),
  executionSettings: text('execution_settings', { mode: 'json' }),
  modelSettings: text('model_settings', { mode: 'json' }),
  customMetrics: text('custom_metrics', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const evaluationTestCases = sqliteTable('evaluation_test_cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id').references(() => evaluations.id).notNull(),
  input: text('input').notNull(),
  expectedOutput: text('expected_output'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

export const evaluationRuns = sqliteTable('evaluation_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id').references(() => evaluations.id).notNull(),
  status: text('status').notNull().default('pending'),
  totalCases: integer('total_cases').default(0),
  passedCases: integer('passed_cases').default(0),
  failedCases: integer('failed_cases').default(0),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
});

// Traces
export const traces = sqliteTable('traces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  traceId: text('trace_id').notNull().unique(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  status: text('status').notNull().default('pending'),
  durationMs: integer('duration_ms'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

export const traceSpans = sqliteTable('trace_spans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  traceId: integer('trace_id').references(() => traces.id).notNull(),
  spanId: text('span_id').notNull(),
  parentSpanId: text('parent_span_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  input: text('input'),
  output: text('output'),
  durationMs: integer('duration_ms'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

// Annotations
export const annotationTasks = sqliteTable('annotation_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  type: text('type').notNull(),
  status: text('status').notNull().default('active'),
  totalItems: integer('total_items').default(0),
  completedItems: integer('completed_items').default(0),
  createdBy: text('created_by').references(() => user.id).notNull(),
  annotationSettings: text('annotation_settings', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const annotationItems = sqliteTable('annotation_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => annotationTasks.id).notNull(),
  content: text('content').notNull(),
  annotation: text('annotation', { mode: 'json' }),
  annotatedBy: text('annotated_by').references(() => user.id),
  annotatedAt: text('annotated_at'),
  createdAt: text('created_at').notNull(),
});

// LLM Judge
export const llmJudgeConfigs = sqliteTable('llm_judge_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  model: text('model').notNull(),
  promptTemplate: text('prompt_template').notNull(),
  criteria: text('criteria', { mode: 'json' }),
  settings: text('settings', { mode: 'json' }),
  createdBy: text('created_by').references(() => user.id).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const llmJudgeResults = sqliteTable('llm_judge_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configId: integer('config_id').references(() => llmJudgeConfigs.id).notNull(),
  input: text('input').notNull(),
  output: text('output').notNull(),
  score: integer('score'),
  reasoning: text('reasoning'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

// Developer Experience Tables
export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => user.id).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  name: text('name').notNull(),
  scopes: text('scopes', { mode: 'json' }).notNull(),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull(),
});

export const webhooks = sqliteTable('webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  url: text('url').notNull(),
  events: text('events', { mode: 'json' }).notNull(),
  secret: text('secret').notNull(),
  status: text('status').notNull().default('active'),
  lastDeliveredAt: text('last_delivered_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  webhookId: integer('webhook_id').references(() => webhooks.id).notNull(),
  eventType: text('event_type').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  status: text('status').notNull().default('pending'),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  attemptCount: integer('attempt_count').default(0),
  createdAt: text('created_at').notNull(),
});

export const apiUsageLogs = sqliteTable('api_usage_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  apiKeyId: integer('api_key_id').references(() => apiKeys.id),
  userId: text('user_id').references(() => user.id),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code').notNull(),
  responseTimeMs: integer('response_time_ms').notNull(),
  createdAt: text('created_at').notNull(),
});

export const humanAnnotations = sqliteTable('human_annotations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationRunId: integer('evaluation_run_id').references(() => evaluationRuns.id).notNull(),
  testCaseId: integer('test_case_id').references(() => testCases.id).notNull(),
  annotatorId: text('annotator_id').references(() => user.id).notNull(),
  rating: integer('rating'),
  feedback: text('feedback'),
  labels: text('labels', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

export const testCases = sqliteTable('test_cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id').references(() => evaluations.id).notNull(),
  name: text('name').notNull(),
  input: text('input').notNull(),
  expectedOutput: text('expected_output'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

export const testResults = sqliteTable('test_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationRunId: integer('evaluation_run_id').references(() => evaluationRuns.id).notNull(),
  testCaseId: integer('test_case_id').references(() => testCases.id).notNull(),
  status: text('status').notNull().default('pending'),
  output: text('output'),
  score: integer('score'),
  error: text('error'),
  durationMs: integer('duration_ms'),
  createdAt: text('created_at').notNull(),
});

export const spans = sqliteTable('spans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  traceId: integer('trace_id').references(() => traces.id).notNull(),
  spanId: text('span_id').notNull().unique(),
  parentSpanId: text('parent_span_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  durationMs: integer('duration_ms'),
  input: text('input'),
  output: text('output'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

// Email Subscribers (for lead capture)
export const emailSubscribers = sqliteTable('email_subscribers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  source: text('source').notNull(), // 'playground', 'homepage', 'blog', etc.
  context: text('context', { mode: 'json' }), // Additional context like scenario, score, etc.
  status: text('status').notNull().default('active'), // 'active', 'unsubscribed', 'bounced'
  tags: text('tags', { mode: 'json' }), // ['playground-lead', 'high-intent', etc.]
  subscribedAt: text('subscribed_at').notNull(),
  unsubscribedAt: text('unsubscribed_at'),
  lastEmailSentAt: text('last_email_sent_at'),
  emailCount: integer('email_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Multi-Agent Workflows
// ============================================

// Workflow definitions for multi-agent evaluation
export const workflows = sqliteTable('workflows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  definition: text('definition', { mode: 'json' }).notNull(), // DAG structure with nodes and edges
  version: integer('version').default(1),
  status: text('status').notNull().default('draft'), // 'draft', 'active', 'archived'
  createdBy: text('created_by').references(() => user.id).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Individual workflow executions
export const workflowRuns = sqliteTable('workflow_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workflowId: integer('workflow_id').references(() => workflows.id),
  traceId: integer('trace_id').references(() => traces.id).notNull(),
  status: text('status').notNull().default('running'), // 'running', 'completed', 'failed', 'cancelled'
  input: text('input', { mode: 'json' }),
  output: text('output', { mode: 'json' }),
  totalCost: text('total_cost'), // decimal as string for precision
  totalDurationMs: integer('total_duration_ms'),
  agentCount: integer('agent_count'),
  handoffCount: integer('handoff_count'),
  retryCount: integer('retry_count').default(0),
  errorMessage: text('error_message'),
  metadata: text('metadata', { mode: 'json' }),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

// Agent handoff events between agents in a workflow
export const agentHandoffs = sqliteTable('agent_handoffs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workflowRunId: integer('workflow_run_id').references(() => workflowRuns.id).notNull(),
  fromSpanId: text('from_span_id'),
  toSpanId: text('to_span_id').notNull(),
  fromAgent: text('from_agent'),
  toAgent: text('to_agent').notNull(),
  handoffType: text('handoff_type').notNull(), // 'delegation', 'escalation', 'parallel', 'fallback'
  context: text('context', { mode: 'json' }), // data passed between agents
  timestamp: text('timestamp').notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Decision Auditing
// ============================================

// Agent decision tracking for audit trails
export const agentDecisions = sqliteTable('agent_decisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  spanId: integer('span_id').references(() => spans.id).notNull(),
  workflowRunId: integer('workflow_run_id').references(() => workflowRuns.id),
  agentName: text('agent_name').notNull(),
  decisionType: text('decision_type').notNull(), // 'action', 'tool', 'delegate', 'respond'
  chosen: text('chosen').notNull(), // the action/tool that was chosen
  alternatives: text('alternatives', { mode: 'json' }).notNull(), // array of alternative options considered
  reasoning: text('reasoning'), // why this choice was made
  confidence: integer('confidence'), // 0-100 confidence score
  inputContext: text('input_context', { mode: 'json' }), // context that influenced the decision
  createdAt: text('created_at').notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Cost Tracking
// ============================================

// Cost records for individual LLM calls and operations
export const costRecords = sqliteTable('cost_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  spanId: integer('span_id').references(() => spans.id).notNull(),
  workflowRunId: integer('workflow_run_id').references(() => workflowRuns.id),
  provider: text('provider').notNull(), // 'openai', 'anthropic', 'google', etc.
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  inputCost: text('input_cost').notNull(), // decimal as string
  outputCost: text('output_cost').notNull(),
  totalCost: text('total_cost').notNull(),
  isRetry: integer('is_retry', { mode: 'boolean' }).default(false),
  retryNumber: integer('retry_number').default(0),
  costCategory: text('cost_category').notNull(), // 'llm', 'tool', 'embedding', 'other'
  createdAt: text('created_at').notNull(),
});

// Provider pricing table (admin-managed)
export const providerPricing = sqliteTable('provider_pricing', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputPricePerMillion: text('input_price_per_million').notNull(), // price per 1M input tokens
  outputPricePerMillion: text('output_price_per_million').notNull(), // price per 1M output tokens
  effectiveDate: text('effective_date').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
});

// ============================================
// ORCHESTRATION LAYER - Benchmarks
// ============================================

// Benchmark definitions
export const benchmarks = sqliteTable('benchmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  taskType: text('task_type').notNull(), // 'qa', 'coding', 'reasoning', 'tool_use', 'multi_step'
  dataset: text('dataset', { mode: 'json' }), // test cases for the benchmark
  metrics: text('metrics', { mode: 'json' }).notNull(), // which metrics to track
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  createdBy: text('created_by').references(() => user.id).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Agent configurations being benchmarked
export const agentConfigs = sqliteTable('agent_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  architecture: text('architecture').notNull(), // 'react', 'cot', 'tot', 'custom'
  model: text('model').notNull(),
  config: text('config', { mode: 'json' }), // full agent configuration
  description: text('description'),
  createdBy: text('created_by').references(() => user.id).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Benchmark results
export const benchmarkResults = sqliteTable('benchmark_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  benchmarkId: integer('benchmark_id').references(() => benchmarks.id).notNull(),
  agentConfigId: integer('agent_config_id').references(() => agentConfigs.id).notNull(),
  workflowRunId: integer('workflow_run_id').references(() => workflowRuns.id),
  accuracy: integer('accuracy'), // 0-100
  latencyP50: integer('latency_p50'), // median latency in ms
  latencyP95: integer('latency_p95'), // 95th percentile latency in ms
  totalCost: text('total_cost'), // total cost in dollars
  successRate: integer('success_rate'), // 0-100
  toolUseEfficiency: integer('tool_use_efficiency'), // 0-100
  customMetrics: text('custom_metrics', { mode: 'json' }),
  runCount: integer('run_count').default(1),
  createdAt: text('created_at').notNull(),
});