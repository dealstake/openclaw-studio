ALTER TABLE `activity_events` ADD `session_key` text;--> statement-breakpoint
ALTER TABLE `activity_events` ADD `transcript_json` text;--> statement-breakpoint
ALTER TABLE `activity_events` ADD `tokens_in` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `activity_events` ADD `tokens_out` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `activity_events` ADD `model` text;--> statement-breakpoint
ALTER TABLE `activity_events` ADD `agent_id` text;