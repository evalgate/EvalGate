-- Advanced indexes for common query patterns
-- These indexes optimize frequent queries and improve performance

-- Evaluations: Common filters and sorts
CREATE INDEX IF NOT EXISTS idx_evaluations_org_status ON evaluations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_evaluations_org_created ON evaluations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_status_created ON evaluations(status, created_at DESC);

-- Evaluation Runs: Status and date filtering
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_eval_status ON evaluation_runs(evaluation_id, status);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_status_date ON evaluation_runs(status, created_at DESC);

-- Traces: Organization and date range queries
CREATE INDEX IF NOT EXISTS idx_traces_org_created ON traces(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_org_name ON traces(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_created_status ON traces(created_at DESC, status);

-- Trace Spans: Parent-child relationships
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_parent ON trace_spans(trace_id, parent_span_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_created ON trace_spans(trace_id, created_at);

-- LLM Judge Configs: Organization queries
CREATE INDEX IF NOT EXISTS idx_llm_judge_configs_org_created ON llm_judge_configs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_judge_configs_org_provider ON llm_judge_configs(organization_id, provider);

-- LLM Judge Results: Config and score filtering
CREATE INDEX IF NOT EXISTS idx_llm_judge_results_config_created ON llm_judge_results(config_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_judge_results_config_passed ON llm_judge_results(config_id, passed);
CREATE INDEX IF NOT EXISTS idx_llm_judge_results_org_passed ON llm_judge_results(organization_id, passed);

-- Annotations: Task and status filtering
CREATE INDEX IF NOT EXISTS idx_annotation_tasks_org_status ON annotation_tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_annotation_items_task_status ON annotation_items(task_id, status);
CREATE INDEX IF NOT EXISTS idx_annotation_items_task_created ON annotation_items(task_id, created_at DESC);

-- API Keys: Organization and active status
CREATE INDEX IF NOT EXISTS idx_api_keys_org_active ON api_keys(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used_at DESC);

-- Webhooks: Organization and event filtering
CREATE INDEX IF NOT EXISTS idx_webhooks_org_active ON webhooks(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_status ON webhook_deliveries(webhook_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_created ON webhook_deliveries(webhook_id, created_at DESC);

-- API Usage Logs: Organization and time-based queries
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_org_timestamp ON api_usage_logs(organization_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key_timestamp ON api_usage_logs(api_key_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint, timestamp DESC);

-- Test Cases: Evaluation queries
CREATE INDEX IF NOT EXISTS idx_evaluation_test_cases_eval_id ON evaluation_test_cases(evaluation_id);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_traces_org_status_created ON traces(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_judge_results_org_config_passed ON llm_judge_results(organization_id, config_id, passed);

-- Cover more filtering scenarios
CREATE INDEX IF NOT EXISTS idx_evaluations_name ON evaluations(name);
CREATE INDEX IF NOT EXISTS idx_traces_name ON traces(name);
CREATE INDEX IF NOT EXISTS idx_llm_judge_configs_name ON llm_judge_configs(name);

