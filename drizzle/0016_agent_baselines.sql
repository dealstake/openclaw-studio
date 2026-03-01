-- Migration 0016: Agent Baselines
--
-- Stores per-(agent, task) rolling behavioral baselines for the Anomaly Detection
-- feature. Each row holds mean + stdDev + sampleCount for four key metrics:
--   • totalTokens  — combined token usage per run
--   • costUsd      — estimated USD cost per run
--   • durationMs   — wall-clock duration per run
--   • errorRate    — fraction of errored runs (0.0–1.0)
--
-- Recomputed daily (or on-demand via POST /api/activity/baselines) from the
-- last 7 days of activity_events. One row per (agentId, taskId) pair.

CREATE TABLE `agent_baselines` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`task_id` text NOT NULL,
	`task_name` text NOT NULL DEFAULT '',
	`tokens_mean` real NOT NULL DEFAULT 0,
	`tokens_std_dev` real NOT NULL DEFAULT 0,
	`tokens_sample_count` integer NOT NULL DEFAULT 0,
	`cost_mean` real NOT NULL DEFAULT 0,
	`cost_std_dev` real NOT NULL DEFAULT 0,
	`cost_sample_count` integer NOT NULL DEFAULT 0,
	`duration_mean` real NOT NULL DEFAULT 0,
	`duration_std_dev` real NOT NULL DEFAULT 0,
	`duration_sample_count` integer NOT NULL DEFAULT 0,
	`error_rate_mean` real NOT NULL DEFAULT 0,
	`error_rate_std_dev` real NOT NULL DEFAULT 0,
	`error_rate_sample_count` integer NOT NULL DEFAULT 0,
	`computed_at` text NOT NULL,
	`window_days` integer NOT NULL DEFAULT 7
);
--> statement-breakpoint
CREATE INDEX `idx_ab_agent_id` ON `agent_baselines` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `idx_ab_task_id` ON `agent_baselines` (`task_id`);
--> statement-breakpoint
CREATE INDEX `idx_ab_computed_at` ON `agent_baselines` (`computed_at`);
