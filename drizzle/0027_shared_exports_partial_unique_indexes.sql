-- Replace composite unique indexes with partial indexes so:
-- - evaluation scope: one share per (org, evaluation)
-- - run scope: one share per (org, run) — evaluation_id repeats across runs, so we must not include it
DROP INDEX IF EXISTS shared_exports_org_eval_unique;
--> statement-breakpoint
DROP INDEX IF EXISTS shared_exports_org_run_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS shared_exports_org_eval_unique ON shared_exports (organization_id, evaluation_id) WHERE share_scope = 'evaluation';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS shared_exports_org_run_unique ON shared_exports (organization_id, evaluation_run_id) WHERE share_scope = 'run';
