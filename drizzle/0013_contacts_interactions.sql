-- Migration 0013: Contacts & Interactions CRM tables
--
-- Creates the shared contact database with interaction history for use across
-- all persona types (Cold Caller, Recruiter, Executive Assistant, etc.).
-- Includes a contacts_search FTS5 virtual table for full-text search.

CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`persona_id` text,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`company` text,
	`title` text,
	`tags` text,
	`stage` text,
	`notes` text,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`type` text NOT NULL,
	`channel` text,
	`summary` text,
	`content` text,
	`outcome` text,
	`artifact_link` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_agent` ON `contacts` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `idx_contacts_persona` ON `contacts` (`persona_id`);
--> statement-breakpoint
CREATE INDEX `idx_contacts_stage` ON `contacts` (`agent_id`, `stage`);
--> statement-breakpoint
CREATE INDEX `idx_contacts_email` ON `contacts` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_interactions_contact` ON `interactions` (`contact_id`);
--> statement-breakpoint
CREATE INDEX `idx_interactions_agent` ON `interactions` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `idx_interactions_persona` ON `interactions` (`persona_id`);
--> statement-breakpoint
-- FTS5 virtual table for full-text search on contacts.
-- Mirrors key text columns from `contacts` — must be kept in sync by contactsRepo.
CREATE VIRTUAL TABLE IF NOT EXISTS contacts_search USING fts5(
	contact_id UNINDEXED,
	agent_id UNINDEXED,
	name,
	email,
	company,
	notes,
	tokenize = 'porter unicode61'
);
