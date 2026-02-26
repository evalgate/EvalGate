-- Migration 0040: Convert ALL remaining text timestamp columns to integer (Unix seconds)
-- Uses the same recreate-table pattern as migration 0028 and 0039.
-- Tables: evaluation_test_cases, annotation_tasks, annotation_items, llm_judge_configs,
--         llm_judge_results, provider_keys, webhook_deliveries, api_usage_logs,
--         human_annotations, test_cases, email_subscribers, workflows, workflow_runs,
--         agent_handoffs, agent_decisions, cost_records, provider_pricing, benchmarks,
--         agent_configs, benchmark_results, golden_sets, arena_matches, report_cards,
--         audit_logs, quality_scores, evaluation_versions, drift_alerts, shared_reports,
--         shared_exports

--> statement-breakpoint
-- 1. evaluation_test_cases
CREATE TABLE evaluation_test_cases_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  input TEXT NOT NULL,
  expected_output TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO evaluation_test_cases_new (id, evaluation_id, input, expected_output, metadata, created_at)
  SELECT id, evaluation_id, input, expected_output, metadata,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM evaluation_test_cases;
--> statement-breakpoint
DROP TABLE evaluation_test_cases;
--> statement-breakpoint
ALTER TABLE evaluation_test_cases_new RENAME TO evaluation_test_cases;

--> statement-breakpoint
-- 2. annotation_tasks
CREATE TABLE annotation_tasks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES user(id),
  annotation_settings TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO annotation_tasks_new (id, name, description, organization_id, type, status, total_items, completed_items, created_by, annotation_settings, created_at, updated_at)
  SELECT id, name, description, organization_id, type, status, total_items, completed_items, created_by, annotation_settings,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM annotation_tasks;
--> statement-breakpoint
DROP TABLE annotation_tasks;
--> statement-breakpoint
ALTER TABLE annotation_tasks_new RENAME TO annotation_tasks;

--> statement-breakpoint
-- 3. annotation_items
CREATE TABLE annotation_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES annotation_tasks(id),
  content TEXT NOT NULL,
  annotation TEXT,
  annotated_by TEXT REFERENCES user(id),
  annotated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO annotation_items_new (id, task_id, content, annotation, annotated_by, annotated_at, created_at)
  SELECT id, task_id, content, annotation, annotated_by,
    CASE WHEN typeof(annotated_at) = 'text' AND annotated_at != '' THEN CAST(strftime('%s', annotated_at) AS INTEGER) ELSE NULL END,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM annotation_items;
--> statement-breakpoint
DROP TABLE annotation_items;
--> statement-breakpoint
ALTER TABLE annotation_items_new RENAME TO annotation_items;

--> statement-breakpoint
-- 4. llm_judge_configs
CREATE TABLE llm_judge_configs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  model TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  criteria TEXT,
  settings TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO llm_judge_configs_new (id, name, organization_id, model, prompt_template, criteria, settings, created_by, created_at, updated_at)
  SELECT id, name, organization_id, model, prompt_template, criteria, settings, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM llm_judge_configs;
--> statement-breakpoint
DROP TABLE llm_judge_configs;
--> statement-breakpoint
ALTER TABLE llm_judge_configs_new RENAME TO llm_judge_configs;

--> statement-breakpoint
-- 5. llm_judge_results
CREATE TABLE llm_judge_results_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id INTEGER NOT NULL REFERENCES llm_judge_configs(id),
  evaluation_run_id INTEGER REFERENCES evaluation_runs(id),
  test_case_id INTEGER REFERENCES test_cases(id),
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  score INTEGER,
  reasoning TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO llm_judge_results_new (id, config_id, evaluation_run_id, test_case_id, input, output, score, reasoning, metadata, created_at)
  SELECT id, config_id, evaluation_run_id, test_case_id, input, output, score, reasoning, metadata,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM llm_judge_results;
--> statement-breakpoint
DROP TABLE llm_judge_results;
--> statement-breakpoint
ALTER TABLE llm_judge_results_new RENAME TO llm_judge_results;

--> statement-breakpoint
-- 6. provider_keys
CREATE TABLE provider_keys_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL,
  key_name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_type TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  iv TEXT NOT NULL,
  tag TEXT NOT NULL,
  metadata TEXT,
  is_active INTEGER DEFAULT 1,
  last_used_at INTEGER,
  expires_at INTEGER,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO provider_keys_new (id, organization_id, provider, key_name, encrypted_key, key_type, key_prefix, iv, tag, metadata, is_active, last_used_at, expires_at, created_by, created_at, updated_at)
  SELECT id, organization_id, provider, key_name, encrypted_key, key_type, key_prefix, iv, tag, metadata, is_active,
    CASE WHEN typeof(last_used_at) = 'text' AND last_used_at != '' THEN CAST(strftime('%s', last_used_at) AS INTEGER) ELSE NULL END,
    CASE WHEN typeof(expires_at) = 'text' AND expires_at != '' THEN CAST(strftime('%s', expires_at) AS INTEGER) ELSE NULL END,
    created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM provider_keys;
--> statement-breakpoint
DROP TABLE provider_keys;
--> statement-breakpoint
ALTER TABLE provider_keys_new RENAME TO provider_keys;

--> statement-breakpoint
-- 7. webhook_deliveries
CREATE TABLE webhook_deliveries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO webhook_deliveries_new (id, webhook_id, event_type, payload, payload_hash, status, response_status, response_body, attempt_count, created_at)
  SELECT id, webhook_id, event_type, payload, payload_hash, status, response_status, response_body, attempt_count,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM webhook_deliveries;
--> statement-breakpoint
DROP TABLE webhook_deliveries;
--> statement-breakpoint
ALTER TABLE webhook_deliveries_new RENAME TO webhook_deliveries;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_webhook_deliveries_dedup ON webhook_deliveries (webhook_id, event_type, payload_hash);

--> statement-breakpoint
-- 8. api_usage_logs
CREATE TABLE api_usage_logs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id INTEGER REFERENCES api_keys(id),
  user_id TEXT REFERENCES user(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO api_usage_logs_new (id, api_key_id, user_id, organization_id, endpoint, method, status_code, response_time_ms, created_at)
  SELECT id, api_key_id, user_id, organization_id, endpoint, method, status_code, response_time_ms,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM api_usage_logs;
--> statement-breakpoint
DROP TABLE api_usage_logs;
--> statement-breakpoint
ALTER TABLE api_usage_logs_new RENAME TO api_usage_logs;

--> statement-breakpoint
-- 9. human_annotations
CREATE TABLE human_annotations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_run_id INTEGER NOT NULL REFERENCES evaluation_runs(id),
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id),
  annotator_id TEXT NOT NULL REFERENCES user(id),
  rating INTEGER,
  feedback TEXT,
  labels TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO human_annotations_new (id, evaluation_run_id, test_case_id, annotator_id, rating, feedback, labels, metadata, created_at)
  SELECT id, evaluation_run_id, test_case_id, annotator_id, rating, feedback, labels, metadata,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM human_annotations;
--> statement-breakpoint
DROP TABLE human_annotations;
--> statement-breakpoint
ALTER TABLE human_annotations_new RENAME TO human_annotations;

--> statement-breakpoint
-- 10. test_cases
CREATE TABLE test_cases_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  name TEXT NOT NULL,
  input TEXT NOT NULL,
  input_hash TEXT,
  expected_output TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO test_cases_new (id, evaluation_id, name, input, input_hash, expected_output, metadata, created_at)
  SELECT id, evaluation_id, name, input, input_hash, expected_output, metadata,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM test_cases;
--> statement-breakpoint
DROP TABLE test_cases;
--> statement-breakpoint
ALTER TABLE test_cases_new RENAME TO test_cases;

--> statement-breakpoint
-- 11. email_subscribers
CREATE TABLE email_subscribers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  tags TEXT,
  subscribed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  unsubscribed_at INTEGER,
  last_email_sent_at INTEGER,
  email_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO email_subscribers_new (id, email, source, context, status, tags, subscribed_at, unsubscribed_at, last_email_sent_at, email_count, created_at, updated_at)
  SELECT id, email, source, context, status, tags,
    CASE WHEN typeof(subscribed_at) = 'text' AND subscribed_at != '' THEN CAST(strftime('%s', subscribed_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(unsubscribed_at) = 'text' AND unsubscribed_at != '' THEN CAST(strftime('%s', unsubscribed_at) AS INTEGER) ELSE NULL END,
    CASE WHEN typeof(last_email_sent_at) = 'text' AND last_email_sent_at != '' THEN CAST(strftime('%s', last_email_sent_at) AS INTEGER) ELSE NULL END,
    email_count,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM email_subscribers;
--> statement-breakpoint
DROP TABLE email_subscribers;
--> statement-breakpoint
ALTER TABLE email_subscribers_new RENAME TO email_subscribers;

--> statement-breakpoint
-- 12. workflows
CREATE TABLE workflows_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  definition TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  sla_latency_ms INTEGER,
  sla_cost_dollars TEXT,
  sla_error_rate INTEGER,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO workflows_new (id, name, description, organization_id, definition, version, status, sla_latency_ms, sla_cost_dollars, sla_error_rate, created_by, created_at, updated_at)
  SELECT id, name, description, organization_id, definition, version, status, sla_latency_ms, sla_cost_dollars, sla_error_rate, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM workflows;
--> statement-breakpoint
DROP TABLE workflows;
--> statement-breakpoint
ALTER TABLE workflows_new RENAME TO workflows;

--> statement-breakpoint
-- 13. workflow_runs
CREATE TABLE workflow_runs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER REFERENCES workflows(id),
  trace_id INTEGER NOT NULL REFERENCES traces(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  status TEXT NOT NULL DEFAULT 'running',
  input TEXT,
  output TEXT,
  total_cost TEXT,
  total_duration_ms INTEGER,
  agent_count INTEGER,
  handoff_count INTEGER,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);
INSERT INTO workflow_runs_new (id, workflow_id, trace_id, organization_id, status, input, output, total_cost, total_duration_ms, agent_count, handoff_count, retry_count, error_message, metadata, started_at, completed_at)
  SELECT id, workflow_id, trace_id, organization_id, status, input, output, total_cost, total_duration_ms, agent_count, handoff_count, retry_count, error_message, metadata,
    CASE WHEN typeof(started_at) = 'text' AND started_at != '' THEN CAST(strftime('%s', started_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(completed_at) = 'text' AND completed_at != '' THEN CAST(strftime('%s', completed_at) AS INTEGER) ELSE NULL END
  FROM workflow_runs;
--> statement-breakpoint
DROP TABLE workflow_runs;
--> statement-breakpoint
ALTER TABLE workflow_runs_new RENAME TO workflow_runs;

--> statement-breakpoint
-- 14. agent_handoffs
CREATE TABLE agent_handoffs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_run_id INTEGER NOT NULL REFERENCES workflow_runs(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  from_span_id TEXT,
  to_span_id TEXT NOT NULL,
  from_agent TEXT,
  to_agent TEXT NOT NULL,
  handoff_type TEXT NOT NULL,
  context TEXT,
  timestamp INTEGER NOT NULL
);
INSERT INTO agent_handoffs_new (id, workflow_run_id, organization_id, from_span_id, to_span_id, from_agent, to_agent, handoff_type, context, timestamp)
  SELECT id, workflow_run_id, organization_id, from_span_id, to_span_id, from_agent, to_agent, handoff_type, context,
    CASE WHEN typeof(timestamp) = 'text' AND timestamp != '' THEN CAST(strftime('%s', timestamp) AS INTEGER) ELSE unixepoch() END
  FROM agent_handoffs;
--> statement-breakpoint
DROP TABLE agent_handoffs;
--> statement-breakpoint
ALTER TABLE agent_handoffs_new RENAME TO agent_handoffs;

--> statement-breakpoint
-- 15. agent_decisions
CREATE TABLE agent_decisions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  span_id INTEGER NOT NULL REFERENCES spans(id),
  workflow_run_id INTEGER REFERENCES workflow_runs(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  agent_name TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  chosen TEXT NOT NULL,
  alternatives TEXT NOT NULL,
  reasoning TEXT,
  confidence INTEGER,
  input_context TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO agent_decisions_new (id, span_id, workflow_run_id, organization_id, agent_name, decision_type, chosen, alternatives, reasoning, confidence, input_context, created_at)
  SELECT id, span_id, workflow_run_id, organization_id, agent_name, decision_type, chosen, alternatives, reasoning, confidence, input_context,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM agent_decisions;
--> statement-breakpoint
DROP TABLE agent_decisions;
--> statement-breakpoint
ALTER TABLE agent_decisions_new RENAME TO agent_decisions;

--> statement-breakpoint
-- 16. cost_records
CREATE TABLE cost_records_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  span_id INTEGER NOT NULL REFERENCES spans(id),
  workflow_run_id INTEGER REFERENCES workflow_runs(id),
  evaluation_run_id INTEGER REFERENCES evaluation_runs(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  input_cost TEXT NOT NULL,
  output_cost TEXT NOT NULL,
  total_cost TEXT NOT NULL,
  is_retry INTEGER DEFAULT 0,
  retry_number INTEGER DEFAULT 0,
  cost_category TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO cost_records_new (id, span_id, workflow_run_id, evaluation_run_id, organization_id, provider, model, input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost, is_retry, retry_number, cost_category, created_at)
  SELECT id, span_id, workflow_run_id, evaluation_run_id, organization_id, provider, model, input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost, is_retry, retry_number, cost_category,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM cost_records;
--> statement-breakpoint
DROP TABLE cost_records;
--> statement-breakpoint
ALTER TABLE cost_records_new RENAME TO cost_records;

--> statement-breakpoint
-- 17. provider_pricing
CREATE TABLE provider_pricing_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_price_per_million TEXT NOT NULL,
  output_price_per_million TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO provider_pricing_new (id, provider, model, input_price_per_million, output_price_per_million, effective_date, is_active, created_at)
  SELECT id, provider, model, input_price_per_million, output_price_per_million, effective_date, is_active,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM provider_pricing;
--> statement-breakpoint
DROP TABLE provider_pricing;
--> statement-breakpoint
ALTER TABLE provider_pricing_new RENAME TO provider_pricing;

--> statement-breakpoint
-- 18. benchmarks
CREATE TABLE benchmarks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  task_type TEXT NOT NULL,
  dataset TEXT,
  metrics TEXT NOT NULL,
  is_public INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO benchmarks_new (id, name, description, organization_id, task_type, dataset, metrics, is_public, created_by, created_at, updated_at)
  SELECT id, name, description, organization_id, task_type, dataset, metrics, is_public, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM benchmarks;
--> statement-breakpoint
DROP TABLE benchmarks;
--> statement-breakpoint
ALTER TABLE benchmarks_new RENAME TO benchmarks;

--> statement-breakpoint
-- 19. agent_configs
CREATE TABLE agent_configs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  architecture TEXT NOT NULL,
  model TEXT NOT NULL,
  config TEXT,
  description TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO agent_configs_new (id, name, organization_id, architecture, model, config, description, created_by, created_at, updated_at)
  SELECT id, name, organization_id, architecture, model, config, description, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM agent_configs;
--> statement-breakpoint
DROP TABLE agent_configs;
--> statement-breakpoint
ALTER TABLE agent_configs_new RENAME TO agent_configs;

--> statement-breakpoint
-- 20. benchmark_results
CREATE TABLE benchmark_results_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  benchmark_id INTEGER NOT NULL REFERENCES benchmarks(id),
  agent_config_id INTEGER NOT NULL REFERENCES agent_configs(id),
  workflow_run_id INTEGER REFERENCES workflow_runs(id),
  accuracy INTEGER,
  latency_p50 INTEGER,
  latency_p95 INTEGER,
  total_cost TEXT,
  success_rate INTEGER,
  tool_use_efficiency INTEGER,
  custom_metrics TEXT,
  run_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO benchmark_results_new (id, benchmark_id, agent_config_id, workflow_run_id, accuracy, latency_p50, latency_p95, total_cost, success_rate, tool_use_efficiency, custom_metrics, run_count, created_at)
  SELECT id, benchmark_id, agent_config_id, workflow_run_id, accuracy, latency_p50, latency_p95, total_cost, success_rate, tool_use_efficiency, custom_metrics, run_count,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM benchmark_results;
--> statement-breakpoint
DROP TABLE benchmark_results;
--> statement-breakpoint
ALTER TABLE benchmark_results_new RENAME TO benchmark_results;

--> statement-breakpoint
-- 21. golden_sets
CREATE TABLE golden_sets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL DEFAULT 'Default Golden Set',
  test_case_ids TEXT NOT NULL,
  last_status TEXT DEFAULT 'unknown',
  last_run_at INTEGER,
  pass_threshold INTEGER DEFAULT 70,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO golden_sets_new (id, evaluation_id, organization_id, name, test_case_ids, last_status, last_run_at, pass_threshold, created_at, updated_at)
  SELECT id, evaluation_id, organization_id, name, test_case_ids, last_status,
    CASE WHEN typeof(last_run_at) = 'text' AND last_run_at != '' THEN CAST(strftime('%s', last_run_at) AS INTEGER) ELSE NULL END,
    pass_threshold,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE unixepoch() END
  FROM golden_sets;
--> statement-breakpoint
DROP TABLE golden_sets;
--> statement-breakpoint
ALTER TABLE golden_sets_new RENAME TO golden_sets;

--> statement-breakpoint
-- 22. arena_matches
CREATE TABLE arena_matches_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  prompt TEXT NOT NULL,
  winner_id TEXT NOT NULL,
  winner_label TEXT NOT NULL,
  judge_reasoning TEXT,
  results TEXT NOT NULL,
  scores TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO arena_matches_new (id, organization_id, prompt, winner_id, winner_label, judge_reasoning, results, scores, created_by, created_at)
  SELECT id, organization_id, prompt, winner_id, winner_label, judge_reasoning, results, scores, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM arena_matches;
--> statement-breakpoint
DROP TABLE arena_matches;
--> statement-breakpoint
ALTER TABLE arena_matches_new RENAME TO arena_matches;

--> statement-breakpoint
-- 23. report_cards
CREATE TABLE report_cards_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  evaluation_run_id INTEGER NOT NULL REFERENCES evaluation_runs(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  is_public INTEGER DEFAULT 1,
  report_data TEXT NOT NULL,
  expires_at INTEGER,
  view_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO report_cards_new (id, evaluation_id, evaluation_run_id, organization_id, slug, title, description, is_public, report_data, expires_at, view_count, created_by, created_at)
  SELECT id, evaluation_id, evaluation_run_id, organization_id, slug, title, description, is_public, report_data,
    CASE WHEN typeof(expires_at) = 'text' AND expires_at != '' THEN CAST(strftime('%s', expires_at) AS INTEGER) ELSE NULL END,
    view_count, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM report_cards;
--> statement-breakpoint
DROP TABLE report_cards;
--> statement-breakpoint
ALTER TABLE report_cards_new RENAME TO report_cards;

--> statement-breakpoint
-- 24. audit_logs
CREATE TABLE audit_logs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO audit_logs_new (id, organization_id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
  SELECT id, organization_id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM audit_logs;
--> statement-breakpoint
DROP TABLE audit_logs;
--> statement-breakpoint
ALTER TABLE audit_logs_new RENAME TO audit_logs;

--> statement-breakpoint
-- 25. quality_scores
CREATE TABLE quality_scores_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_run_id INTEGER NOT NULL REFERENCES evaluation_runs(id),
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  score INTEGER NOT NULL,
  total INTEGER,
  trace_coverage_rate TEXT,
  provenance_coverage_rate TEXT,
  breakdown TEXT NOT NULL,
  flags TEXT NOT NULL,
  evidence_level TEXT,
  scoring_version TEXT NOT NULL DEFAULT 'v1',
  model TEXT,
  is_baseline INTEGER DEFAULT 0,
  inputs_json TEXT,
  scoring_spec_json TEXT,
  inputs_hash TEXT,
  scoring_spec_hash TEXT,
  scoring_commit TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO quality_scores_new (id, evaluation_run_id, evaluation_id, organization_id, score, total, trace_coverage_rate, provenance_coverage_rate, breakdown, flags, evidence_level, scoring_version, model, is_baseline, inputs_json, scoring_spec_json, inputs_hash, scoring_spec_hash, scoring_commit, created_at)
  SELECT id, evaluation_run_id, evaluation_id, organization_id, score, total, trace_coverage_rate, provenance_coverage_rate, breakdown, flags, evidence_level, scoring_version, model, is_baseline, inputs_json, scoring_spec_json, inputs_hash, scoring_spec_hash, scoring_commit,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM quality_scores;
--> statement-breakpoint
DROP TABLE quality_scores;
--> statement-breakpoint
ALTER TABLE quality_scores_new RENAME TO quality_scores;

--> statement-breakpoint
-- 26. evaluation_versions
CREATE TABLE evaluation_versions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  diff_summary TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO evaluation_versions_new (id, evaluation_id, version, snapshot_json, diff_summary, created_by, created_at)
  SELECT id, evaluation_id, version, snapshot_json, diff_summary, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM evaluation_versions;
--> statement-breakpoint
DROP TABLE evaluation_versions;
--> statement-breakpoint
ALTER TABLE evaluation_versions_new RENAME TO evaluation_versions;

--> statement-breakpoint
-- 27. drift_alerts
CREATE TABLE drift_alerts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  evaluation_id INTEGER REFERENCES evaluations(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  explanation TEXT NOT NULL,
  model TEXT,
  current_value TEXT,
  baseline_value TEXT,
  z_score_value TEXT,
  metadata TEXT,
  acknowledged_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO drift_alerts_new (id, organization_id, evaluation_id, alert_type, severity, explanation, model, current_value, baseline_value, z_score_value, metadata, acknowledged_at, created_at)
  SELECT id, organization_id, evaluation_id, alert_type, severity, explanation, model, current_value, baseline_value, z_score_value, metadata,
    CASE WHEN typeof(acknowledged_at) = 'text' AND acknowledged_at != '' THEN CAST(strftime('%s', acknowledged_at) AS INTEGER) ELSE NULL END,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM drift_alerts;
--> statement-breakpoint
DROP TABLE drift_alerts;
--> statement-breakpoint
ALTER TABLE drift_alerts_new RENAME TO drift_alerts;

--> statement-breakpoint
-- 28. shared_reports
CREATE TABLE shared_reports_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  evaluation_run_id INTEGER NOT NULL REFERENCES evaluation_runs(id),
  share_token TEXT NOT NULL UNIQUE,
  report_body TEXT NOT NULL,
  signature TEXT NOT NULL,
  expires_at INTEGER,
  view_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO shared_reports_new (id, organization_id, evaluation_id, evaluation_run_id, share_token, report_body, signature, expires_at, view_count, created_by, created_at)
  SELECT id, organization_id, evaluation_id, evaluation_run_id, share_token, report_body, signature,
    CASE WHEN typeof(expires_at) = 'text' AND expires_at != '' THEN CAST(strftime('%s', expires_at) AS INTEGER) ELSE NULL END,
    view_count, created_by,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END
  FROM shared_reports;
--> statement-breakpoint
DROP TABLE shared_reports;
--> statement-breakpoint
ALTER TABLE shared_reports_new RENAME TO shared_reports;

--> statement-breakpoint
-- 29. shared_exports
CREATE TABLE shared_exports_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  evaluation_id INTEGER REFERENCES evaluations(id),
  evaluation_run_id INTEGER REFERENCES evaluation_runs(id),
  share_scope TEXT NOT NULL DEFAULT 'evaluation',
  export_data TEXT NOT NULL,
  export_hash TEXT NOT NULL,
  is_public INTEGER DEFAULT 1,
  revoked_at INTEGER,
  revoked_by TEXT,
  revoked_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER,
  expires_at INTEGER,
  view_count INTEGER DEFAULT 0
);
INSERT INTO shared_exports_new (id, share_id, organization_id, evaluation_id, evaluation_run_id, share_scope, export_data, export_hash, is_public, revoked_at, revoked_by, revoked_reason, created_at, updated_at, expires_at, view_count)
  SELECT id, share_id, organization_id, evaluation_id, evaluation_run_id, share_scope, export_data, export_hash, is_public,
    CASE WHEN typeof(revoked_at) = 'text' AND revoked_at != '' THEN CAST(strftime('%s', revoked_at) AS INTEGER) ELSE NULL END,
    revoked_by, revoked_reason,
    CASE WHEN typeof(created_at) = 'text' AND created_at != '' THEN CAST(strftime('%s', created_at) AS INTEGER) ELSE unixepoch() END,
    CASE WHEN typeof(updated_at) = 'text' AND updated_at != '' THEN CAST(strftime('%s', updated_at) AS INTEGER) ELSE NULL END,
    CASE WHEN typeof(expires_at) = 'text' AND expires_at != '' THEN CAST(strftime('%s', expires_at) AS INTEGER) ELSE NULL END,
    view_count
  FROM shared_exports;
--> statement-breakpoint
DROP TABLE shared_exports;
--> statement-breakpoint
ALTER TABLE shared_exports_new RENAME TO shared_exports;
--> statement-breakpoint
CREATE UNIQUE INDEX shared_exports_share_id_unique ON shared_exports (share_id);
--> statement-breakpoint
CREATE UNIQUE INDEX shared_exports_org_eval_unique ON shared_exports (organization_id, evaluation_id) WHERE share_scope = 'evaluation';
--> statement-breakpoint
CREATE UNIQUE INDEX shared_exports_org_run_unique ON shared_exports (organization_id, evaluation_run_id) WHERE share_scope = 'run';
