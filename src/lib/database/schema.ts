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
  version: integer("version").notNull().default(1),
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
  version: integer("version").notNull().default(1),
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
  sessionKey: text("session_key"),
  transcriptJson: text("transcript_json"),
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  model: text("model"),
  agentId: text("agent_id"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Project Details (parsed cache) ──────────────────────────────────────────

export const projectDetails = sqliteTable("project_details", {
  doc: text("doc")
    .primaryKey()
    .references(() => projectsIndex.doc, { onDelete: "cascade" }),
  lastWorkedOn: text("last_worked_on"),
  nextStep: text("next_step"),
  blockedBy: text("blocked_by"),
  contextNeeded: text("context_needed"),
  progressCompleted: integer("progress_completed").notNull().default(0),
  progressTotal: integer("progress_total").notNull().default(0),
  progressPercent: integer("progress_percent").notNull().default(0),
  associatedTasksJson: text("associated_tasks_json"),
  fileMtimeMs: integer("file_mtime_ms"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Project Plan Items (structured phase/task breakdown) ────────────────────

export const projectPlanItems = sqliteTable("project_plan_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  doc: text("doc")
    .notNull()
    .references(() => projectsIndex.doc, { onDelete: "cascade" }),
  phaseName: text("phase_name").notNull(),
  taskDescription: text("task_description").notNull(),
  isCompleted: integer("is_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Project History ─────────────────────────────────────────────────────────

export const projectHistory = sqliteTable("project_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  doc: text("doc")
    .notNull()
    .references(() => projectsIndex.doc, { onDelete: "cascade" }),
  entryDate: text("entry_date").notNull(),
  entryText: text("entry_text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Task State ──────────────────────────────────────────────────────────────

export const taskState = sqliteTable("task_state", {
  taskId: text("task_id").primaryKey(),
  stateJson: text("state_json").notNull().default("{}"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Personas ────────────────────────────────────────────────────────────────

export const personas = sqliteTable("personas", {
  personaId: text("persona_id").primaryKey(),
  displayName: text("display_name").notNull(),
  templateKey: text("template_key"),
  category: text("category").notNull(),
  status: text("status").notNull().default("draft"),
  optimizationGoals: text("optimization_goals").notNull().default("[]"),
  metricsJson: text("metrics_json").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  lastTrainedAt: text("last_trained_at"),
  practiceCount: integer("practice_count").notNull().default(0),
});

// ─── Knowledge Sources ───────────────────────────────────────────────────────

export const knowledgeSources = sqliteTable("knowledge_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id")
    .notNull()
    .references(() => personas.personaId, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // "web" | "file" | "manual"
  sourceUri: text("source_uri").notNull(),
  title: text("title").notNull().default(""),
  fetchedAt: text("fetched_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Knowledge Chunks (FTS5) ─────────────────────────────────────────────────
// NOTE: FTS5 virtual tables are not supported by drizzle-orm schema.
// Created via raw SQL in migration 0012. Queried via raw SQL in repo.
//
// Schema (for reference):
//   CREATE VIRTUAL TABLE knowledge_chunks USING fts5(
//     persona_id UNINDEXED,
//     source_id  UNINDEXED,
//     chunk_index UNINDEXED,
//     content,
//     tokenize = 'porter unicode61'
//   );

/** A row returned from a knowledge_chunks FTS5 search. */
export type KnowledgeChunkSearchRow = {
  /** rowid from the FTS5 virtual table */
  rowid: number;
  /** The persona this chunk belongs to */
  personaId: string;
  /** FK to knowledge_sources.id */
  sourceId: number;
  /** Zero-based index of this chunk within the source */
  chunkIndex: number;
  /** The chunk text content */
  content: string;
  /** BM25 relevance score (negative — lower = more relevant) */
  rank: number;
};

/** A row to insert into knowledge_chunks. */
export type NewKnowledgeChunkRow = {
  personaId: string;
  sourceId: number;
  chunkIndex: number;
  content: string;
};

// ─── Type exports ────────────────────────────────────────────────────────────

export type ProjectIndexRow = typeof projectsIndex.$inferSelect;
export type NewProjectIndexRow = typeof projectsIndex.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type NewActivityEventRow = typeof activityEvents.$inferInsert;
export type ProjectDetailsRow = typeof projectDetails.$inferSelect;
export type NewProjectDetailsRow = typeof projectDetails.$inferInsert;
export type TaskStateRow = typeof taskState.$inferSelect;
export type NewTaskStateRow = typeof taskState.$inferInsert;
export type ProjectPlanItemRow = typeof projectPlanItems.$inferSelect;
export type NewProjectPlanItemRow = typeof projectPlanItems.$inferInsert;
export type ProjectHistoryRow = typeof projectHistory.$inferSelect;
export type NewProjectHistoryRow = typeof projectHistory.$inferInsert;
export type PersonaRow = typeof personas.$inferSelect;
export type NewPersonaRow = typeof personas.$inferInsert;
export type KnowledgeSourceRow = typeof knowledgeSources.$inferSelect;
export type NewKnowledgeSourceRow = typeof knowledgeSources.$inferInsert;
