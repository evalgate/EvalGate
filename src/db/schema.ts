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