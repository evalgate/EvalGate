-- Add encrypted webhook secret storage columns
ALTER TABLE `webhooks` ADD `encrypted_secret` text;
--> statement-breakpoint
ALTER TABLE `webhooks` ADD `secret_iv` text;
--> statement-breakpoint
ALTER TABLE `webhooks` ADD `secret_tag` text;
