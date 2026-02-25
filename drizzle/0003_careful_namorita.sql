CREATE TABLE `project_details` (
	`doc` text PRIMARY KEY NOT NULL,
	`last_worked_on` text,
	`next_step` text,
	`blocked_by` text,
	`context_needed` text,
	`progress_completed` integer DEFAULT 0 NOT NULL,
	`progress_total` integer DEFAULT 0 NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`associated_tasks_json` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`doc`) REFERENCES `projects_index`(`doc`) ON UPDATE no action ON DELETE cascade
);
