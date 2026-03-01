-- Migration 0018: Task Cache Retention
--
-- Adds per-task cache retention preference for OpenClaw prompt-caching tuning.
-- Corresponds to cron-agent-cache-tuning Phase 1.
--
-- Valid values: "none" | "short" | "long" (or NULL for inherit-from-agent).
-- This field is Studio metadata only; it does not write to the cron payload
-- (cron payload does not support params). The value informs per-agent
-- params.cacheRetention configuration in openclaw.json.

ALTER TABLE `tasks` ADD COLUMN `cache_retention` text;
