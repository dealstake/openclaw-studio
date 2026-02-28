CREATE TABLE `personas` (
	`persona_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`template_key` text,
	`category` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`optimization_goals` text DEFAULT '[]' NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`last_trained_at` text,
	`practice_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_uri` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`persona_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_personas_status` ON `personas` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_personas_category` ON `personas` (`category`);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_sources_persona` ON `knowledge_sources` (`persona_id`);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks USING fts5(
	persona_id UNINDEXED,
	source_id UNINDEXED,
	chunk_text,
	content='',
	tokenize='porter unicode61'
);
