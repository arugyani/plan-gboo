ALTER TABLE `groups` ADD `discord_channel_id` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `recap_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `recap_hour_utc` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `last_recap_at` text;--> statement-breakpoint
ALTER TABLE `outbox` ADD `dedupe_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_outbox_dedupe` ON `outbox` (`dedupe_key`);