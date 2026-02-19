import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Projects Index ──────────────────────────────────────────────────────────

export const projectsIndex = sqliteTable("projects_index", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  doc: text("doc").notNull().unique(),
  status: text("status").notNull(),
  statusEmoji: text("status_emoji").notNull(),
  priority: text("priority").notNull(),
  priorityEmoji: text("priority_emoji").notNull(),
  oneLiner: text("one_liner").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  cronJobId: text("cron_job_id"),
  agentId: text("agent_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull(), // "constant" | "periodic" | "scheduled"
  scheduleJson: text("schedule_json"), // JSON-serialized TaskSchedule
  prompt: text("prompt").notNull().default(""),
  model: text("model").notNull().default(""),
  deliveryChannel: text("delivery_channel"),
  deliveryTarget: text("delivery_target"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  lastRunAt: text("last_run_at"),
  lastRunStatus: text("last_run_status"),
  runCount: integer("run_count").notNull().default(0),
});

// ─── Activity Events ─────────────────────────────────────────────────────────

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  type: text("type").notNull(),
  taskName: text("task_name").notNull(),
  taskId: text("task_id").notNull(),
  projectSlug: text("project_slug"),
  projectName: text("project_name"),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  metaJson: text("meta_json"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Type exports ────────────────────────────────────────────────────────────

export type ProjectIndexRow = typeof projectsIndex.$inferSelect;
export type NewProjectIndexRow = typeof projectsIndex.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type NewActivityEventRow = typeof activityEvents.$inferInsert;
