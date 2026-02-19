CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`cron_job_id` text,
	`agent_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`schedule_json` text,
	`prompt` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`delivery_channel` text,
	`delivery_target` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_run_at` text,
	`last_run_status` text,
	`run_count` integer DEFAULT 0 NOT NULL
);
