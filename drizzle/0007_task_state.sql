CREATE TABLE `task_state` (
	`task_id` text PRIMARY KEY NOT NULL,
	`state_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
