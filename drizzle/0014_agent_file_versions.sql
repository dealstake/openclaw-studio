-- Migration 0014: Agent File Versions
--
-- Stores complete snapshots of all brain files for an agent at a point in time.
-- Enables versioning, rollback, and audit trail for agent configuration changes.
-- Each version captures the full content of all brain files (AGENTS.md, SOUL.md, etc.).

CREATE TABLE `agent_file_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`label` text NOT NULL DEFAULT '',
	`description` text NOT NULL DEFAULT '',
	`files_json` text NOT NULL,
	`deployed_at` text,
	`is_active` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_afv_agent` ON `agent_file_versions` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `idx_afv_agent_version` ON `agent_file_versions` (`agent_id`, `version_number`);
--> statement-breakpoint
CREATE INDEX `idx_afv_active` ON `agent_file_versions` (`agent_id`, `is_active`);
