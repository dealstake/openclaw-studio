CREATE TABLE `projects_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`doc` text NOT NULL,
	`status` text NOT NULL,
	`status_emoji` text NOT NULL,
	`priority` text NOT NULL,
	`priority_emoji` text NOT NULL,
	`one_liner` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_index_doc_unique` ON `projects_index` (`doc`);