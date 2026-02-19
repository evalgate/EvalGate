ALTER TABLE evaluations ADD COLUMN executor_type text;
--> statement-breakpoint
ALTER TABLE evaluations ADD COLUMN executor_config text;
--> statement-breakpoint
ALTER TABLE evaluations ADD COLUMN published_run_id integer;
--> statement-breakpoint
ALTER TABLE evaluations ADD COLUMN published_version integer;
