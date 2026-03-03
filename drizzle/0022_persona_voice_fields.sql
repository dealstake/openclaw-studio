ALTER TABLE `personas` ADD COLUMN `voice_provider` text;
--> statement-breakpoint
ALTER TABLE `personas` ADD COLUMN `voice_id` text;
--> statement-breakpoint
ALTER TABLE `personas` ADD COLUMN `voice_model_id` text;
--> statement-breakpoint
ALTER TABLE `personas` ADD COLUMN `voice_stability` real DEFAULT 0.5;
--> statement-breakpoint
ALTER TABLE `personas` ADD COLUMN `voice_clarity` real DEFAULT 0.75;
--> statement-breakpoint
ALTER TABLE `personas` ADD COLUMN `voice_style` real DEFAULT 0.0;
