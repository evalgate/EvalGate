-- Shared exports table for public share links
CREATE TABLE IF NOT EXISTS `shared_exports` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `share_id` text NOT NULL,
  `organization_id` integer NOT NULL REFERENCES `organizations`(`id`),
  `evaluation_id` integer REFERENCES `evaluations`(`id`),
  `evaluation_run_id` integer REFERENCES `evaluation_runs`(`id`),
  `share_scope` text DEFAULT 'evaluation' NOT NULL,
  `export_data` text NOT NULL,
  `export_hash` text NOT NULL,
  `is_public` integer DEFAULT 1,
  `revoked_at` text,
  `created_at` text NOT NULL,
  `expires_at` text,
  `view_count` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `shared_exports_share_id_unique` ON `shared_exports` (`share_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `shared_exports_org_eval_unique` ON `shared_exports` (`organization_id`, `share_scope`, `evaluation_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `shared_exports_org_run_unique` ON `shared_exports` (`organization_id`, `share_scope`, `evaluation_run_id`);
