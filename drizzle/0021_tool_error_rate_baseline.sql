-- Add tool error rate columns to agent_baselines for anomaly detection
ALTER TABLE agent_baselines ADD COLUMN tool_error_rate_mean REAL NOT NULL DEFAULT 0;
ALTER TABLE agent_baselines ADD COLUMN tool_error_rate_std_dev REAL NOT NULL DEFAULT 0;
ALTER TABLE agent_baselines ADD COLUMN tool_error_rate_sample_count INTEGER NOT NULL DEFAULT 0;
