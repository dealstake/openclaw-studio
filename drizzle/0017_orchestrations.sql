-- Migration 0016: Orchestrations
--
-- Persists orchestration graph definitions for the Visual Swarm Orchestrator.
-- Phase 1 of the Visual Swarm Orchestrator feature.
-- Each row stores the full graph JSON (nodes + edges) plus execution metadata.

CREATE TABLE `orchestrations` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`graph_json` text NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
	`status` text NOT NULL DEFAULT 'idle',
	`run_count` integer NOT NULL DEFAULT 0,
	`last_run_at` text,
	`last_run_status` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_orchestrations_agent` ON `orchestrations` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `idx_orchestrations_status` ON `orchestrations` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_orchestrations_updated` ON `orchestrations` (`updated_at`);
