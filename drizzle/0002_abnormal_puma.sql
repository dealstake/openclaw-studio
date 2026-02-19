CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text NOT NULL,
	`type` text NOT NULL,
	`task_name` text NOT NULL,
	`task_id` text NOT NULL,
	`project_slug` text,
	`project_name` text,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`meta_json` text,
	`created_at` text NOT NULL
);
