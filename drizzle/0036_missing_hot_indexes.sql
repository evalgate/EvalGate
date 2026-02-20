-- Phase 3-B: Add missing indexes identified by index-audit.ts
-- Covers: SLO window scan columns, aggregate metrics joins, delivery history

-- ── SLO window scan indexes (text created_at — existing columns) ──────────────
CREATE INDEX IF NOT EXISTS `idx_api_usage_logs_created_at` ON `api_usage_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_webhook_deliveries_created_at` ON `webhook_deliveries` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_quality_scores_created_at` ON `quality_scores` (`created_at`);

-- ── Aggregate metrics join indexes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `idx_test_results_eval_run_id` ON `test_results` (`evaluation_run_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_llm_judge_results_eval_run_id` ON `llm_judge_results` (`evaluation_run_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_cost_records_eval_run_id` ON `cost_records` (`evaluation_run_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_quality_scores_eval_run_id` ON `quality_scores` (`evaluation_run_id`);

-- ── Webhook delivery history lookup ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `idx_webhook_deliveries_webhook_id` ON `webhook_deliveries` (`webhook_id`);
