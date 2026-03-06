ALTER TABLE "job_runner_locks" ALTER COLUMN "locked_until" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "job_runner_locks" ALTER COLUMN "updated_at" SET DATA TYPE bigint;