-- Jobs table for background job queue (Phase 1-A)
-- Supports webhook delivery and other async tasks with retry/backoff semantics

CREATE TABLE `jobs` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `type` TEXT NOT NULL,
  `payload` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT 'pending',
  `attempt` INTEGER NOT NULL DEFAULT 0,
  `max_attempts` INTEGER NOT NULL DEFAULT 5,
  `next_run_at` INTEGER NOT NULL,
  `last_error` TEXT,
  `idempotency_key` TEXT,
  `organization_id` INTEGER REFERENCES `organizations`(`id`),
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE UNIQUE INDEX `jobs_idempotency_key_unique` ON `jobs` (`idempotency_key`);
CREATE INDEX `idx_jobs_status_next_run` ON `jobs` (`status`, `next_run_at`);
