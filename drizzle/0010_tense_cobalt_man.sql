CREATE TABLE `project_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc` text NOT NULL,
	`entry_date` text NOT NULL,
	`entry_text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`doc`) REFERENCES `projects_index`(`doc`) ON UPDATE no action ON DELETE cascade
);
