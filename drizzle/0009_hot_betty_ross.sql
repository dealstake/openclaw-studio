CREATE TABLE `project_plan_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc` text NOT NULL,
	`phase_name` text NOT NULL,
	`task_description` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`doc`) REFERENCES `projects_index`(`doc`) ON UPDATE no action ON DELETE cascade
);
