ALTER TABLE agent_baselines ADD COLUMN tool_error_rate_mean REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE agent_baselines ADD COLUMN tool_error_rate_std_dev REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE agent_baselines ADD COLUMN tool_error_rate_sample_count INTEGER NOT NULL DEFAULT 0;
