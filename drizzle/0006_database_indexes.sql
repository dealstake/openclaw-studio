CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_events(timestamp);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_activity_task_id ON activity_events(task_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_activity_project_slug ON activity_events(project_slug);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_activity_status ON activity_events(status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
