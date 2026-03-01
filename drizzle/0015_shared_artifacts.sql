-- Migration 0015: Shared Artifacts
--
-- Persists agent-produced outputs that can be shared/consumed across agent sessions.
-- Phase 1 of the Inter-Agent Data Sharing & Handoff UI feature.
-- Each artifact carries the source agent ID, source session key, name, MIME type,
-- full text content, and arbitrary JSON metadata.

CREATE TABLE `shared_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`source_agent_id` text NOT NULL,
	`source_session_key` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL DEFAULT 'text/plain',
	`content` text NOT NULL DEFAULT '',
	`metadata_json` text NOT NULL DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sa_source_agent` ON `shared_artifacts` (`source_agent_id`);
--> statement-breakpoint
CREATE INDEX `idx_sa_source_session` ON `shared_artifacts` (`source_session_key`);
--> statement-breakpoint
CREATE INDEX `idx_sa_created_at` ON `shared_artifacts` (`created_at`);
