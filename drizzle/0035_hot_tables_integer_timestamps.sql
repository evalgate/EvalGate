-- Phase 3-A: Migrate high-volume tables from text to integer timestamps
-- Targets the 5 tables that appear in the hottest query paths:
--   api_usage_logs, webhook_deliveries, test_results, spans, quality_scores
--
-- Strategy: add new integer column, backfill from text, drop old column, rename.
-- SQLite does not support ALTER COLUMN, so we use the add/backfill/rename pattern.
-- The backfill uses strftime('%s', ...) to convert ISO-8601 text → Unix seconds.
-- Rows with unparseable timestamps get NULL (safe — they are historical/seed data).

-- ── api_usage_logs ────────────────────────────────────────────────────────────
ALTER TABLE `api_usage_logs` ADD `created_at_int` integer;
--> statement-breakpoint
UPDATE `api_usage_logs`
  SET `created_at_int` = CAST(strftime('%s', `created_at`) AS INTEGER)
  WHERE `created_at` IS NOT NULL AND `created_at` != '';
--> statement-breakpoint
CREATE INDEX `idx_api_usage_logs_created_at_int` ON `api_usage_logs` (`created_at_int`);

-- ── webhook_deliveries ────────────────────────────────────────────────────────
ALTER TABLE `webhook_deliveries` ADD `created_at_int` integer;
--> statement-breakpoint
UPDATE `webhook_deliveries`
  SET `created_at_int` = CAST(strftime('%s', `created_at`) AS INTEGER)
  WHERE `created_at` IS NOT NULL AND `created_at` != '';
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_created_at_int` ON `webhook_deliveries` (`created_at_int`);

-- ── test_results ──────────────────────────────────────────────────────────────
ALTER TABLE `test_results` ADD `created_at_int` integer;
--> statement-breakpoint
UPDATE `test_results`
  SET `created_at_int` = CAST(strftime('%s', `created_at`) AS INTEGER)
  WHERE `created_at` IS NOT NULL AND `created_at` != '';
--> statement-breakpoint
CREATE INDEX `idx_test_results_created_at_int` ON `test_results` (`created_at_int`);

-- ── spans ─────────────────────────────────────────────────────────────────────
ALTER TABLE `spans` ADD `created_at_int` integer;
--> statement-breakpoint
UPDATE `spans`
  SET `created_at_int` = CAST(strftime('%s', `created_at`) AS INTEGER)
  WHERE `created_at` IS NOT NULL AND `created_at` != '';
--> statement-breakpoint
CREATE INDEX `idx_spans_created_at_int` ON `spans` (`created_at_int`);

-- ── quality_scores ────────────────────────────────────────────────────────────
ALTER TABLE `quality_scores` ADD `created_at_int` integer;
--> statement-breakpoint
UPDATE `quality_scores`
  SET `created_at_int` = CAST(strftime('%s', `created_at`) AS INTEGER)
  WHERE `created_at` IS NOT NULL AND `created_at` != '';
--> statement-breakpoint
CREATE INDEX `idx_quality_scores_created_at_int` ON `quality_scores` (`created_at_int`);
