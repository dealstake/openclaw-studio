-- Migration 0019: Agent Anomalies
--
-- Stores flagged behavioral anomalies for the Anomaly Detection feature (Phase 2).
-- Each row represents a single metric deviation >3σ from the stored baseline for
-- a given (agentId, taskId) pair.
--
-- Created when scoreEventAgainstBaseline() detects a Z-score exceeding 3σ.
-- Queried by GET /api/activity/alerts.
--
-- Severities:
--   warning  — Z-score ≥ 3σ (statistically significant)
--   critical — Z-score ≥ 5σ (extreme deviation)

CREATE TABLE `agent_anomalies` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`task_id` text NOT NULL,
	`task_name` text NOT NULL DEFAULT '',
	`event_id` text NOT NULL,
	`event_timestamp` text NOT NULL,
	`metric` text NOT NULL,
	`observed_value` real NOT NULL,
	`baseline_mean` real NOT NULL,
	`baseline_std_dev` real NOT NULL,
	`z_score` real NOT NULL,
	`severity` text NOT NULL DEFAULT 'warning',
	`explanation` text NOT NULL DEFAULT '',
	`dismissed` integer NOT NULL DEFAULT 0,
	`detected_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_aa_agent_id` ON `agent_anomalies` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `idx_aa_task_id` ON `agent_anomalies` (`task_id`);
--> statement-breakpoint
CREATE INDEX `idx_aa_event_id` ON `agent_anomalies` (`event_id`);
--> statement-breakpoint
CREATE INDEX `idx_aa_detected_at` ON `agent_anomalies` (`detected_at`);
--> statement-breakpoint
CREATE INDEX `idx_aa_severity` ON `agent_anomalies` (`severity`);
--> statement-breakpoint
CREATE INDEX `idx_aa_dismissed` ON `agent_anomalies` (`dismissed`);
