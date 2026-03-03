import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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
  cacheRetention: text("cache_retention"),
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
  // ── Voice config (Phase 6: persona-agent unification) ──
  voiceProvider: text("voice_provider"),      // 'elevenlabs' | 'openai' | null
  voiceId: text("voice_id"),                  // e.g. 'Rachel'
  voiceModelId: text("voice_model_id"),       // e.g. 'eleven_flash_v2_5'
  voiceStability: real("voice_stability").default(0.5),
  voiceClarity: real("voice_clarity").default(0.75),
  voiceStyle: real("voice_style").default(0.0),
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

// ─── Contacts ────────────────────────────────────────────────────────────────

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  personaId: text("persona_id"),           // NULL = shared, set = persona-specific
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  title: text("title"),
  tags: text("tags"),                      // JSON array: ["prospect", "cto", "saas"]
  stage: text("stage"),                    // "lead" | "contacted" | "qualified" | "meeting" | "closed"
  notes: text("notes"),
  metadata: text("metadata"),              // JSON: custom fields per persona type
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  deletedAt: text("deleted_at"),           // NULL = active, ISO date = soft deleted
});

// ─── Interactions ─────────────────────────────────────────────────────────────

export const interactions = sqliteTable("interactions", {
  id: text("id").primaryKey(),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  agentId: text("agent_id").notNull(),
  personaId: text("persona_id").notNull(),
  type: text("type").notNull(),            // "call" | "email" | "meeting" | "note" | "task"
  channel: text("channel"),               // "phone" | "email" | "whatsapp" | "in-person"
  summary: text("summary"),
  content: text("content"),               // Full content (email body, call transcript, etc.)
  outcome: text("outcome"),               // "positive" | "neutral" | "negative" | "no-answer"
  artifactLink: text("artifact_link"),    // Link to generated doc, recording, etc.
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── contacts_search FTS5 virtual table ──────────────────────────────────────
// NOTE: FTS5 virtual tables are not supported by drizzle-orm schema.
// Created via raw SQL in migration 0013. Queried via raw SQL in contactsRepo.
//
// Schema (for reference):
//   CREATE VIRTUAL TABLE contacts_search USING fts5(
//     contact_id UNINDEXED,
//     agent_id   UNINDEXED,
//     name,
//     email,
//     company,
//     notes,
//     tokenize = 'porter unicode61'
//   );

/** A row returned from a contacts_search FTS5 query. */
export type ContactSearchRow = {
  /** rowid from the FTS5 virtual table */
  rowid: number;
  contactId: string;
  agentId: string;
  name: string;
  email: string;
  company: string;
  notes: string;
  /** BM25 relevance score (negative — lower = more relevant) */
  rank: number;
};

// ─── Agent File Versions ─────────────────────────────────────────────────────

/**
 * Snapshots of all brain files for an agent at a point in time.
 * Each row captures the full content of all AGENT_FILE_NAMES files.
 * The deploy operation writes the snapshot back to the gateway.
 */
export const agentFileVersions = sqliteTable("agent_file_versions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  label: text("label").notNull().default(""),
  description: text("description").notNull().default(""),
  /** JSON-serialized Record<AgentFileName, string> */
  filesJson: text("files_json").notNull(),
  /** ISO date when this version was deployed (null = never deployed) */
  deployedAt: text("deployed_at"),
  /** 1 = currently active/deployed version */
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type AgentFileVersionRow = typeof agentFileVersions.$inferSelect;
export type NewAgentFileVersionRow = typeof agentFileVersions.$inferInsert;

// ─── Shared Artifacts ────────────────────────────────────────────────────────

/**
 * Persists agent-produced outputs that can be shared/consumed across sessions.
 * Phase 1 of the Inter-Agent Data Sharing feature.
 */
export const sharedArtifacts = sqliteTable("shared_artifacts", {
  id: text("id").primaryKey(),
  sourceAgentId: text("source_agent_id").notNull(),
  sourceSessionKey: text("source_session_key").notNull(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull().default("text/plain"),
  content: text("content").notNull().default(""),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Agent Baselines (Anomaly Detection) ─────────────────────────────────────

/**
 * Per-(agent, task) behavioral baseline computed from the last N days of
 * activity events. Stores mean + stdDev + sampleCount for each tracked metric.
 *
 * Used by Phase 2 anomaly detection to flag deviations via Z-score comparison.
 */
export const agentBaselines = sqliteTable("agent_baselines", {
  /** Composite key: "<agentId>:<taskId>" */
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  taskId: text("task_id").notNull(),
  taskName: text("task_name").notNull().default(""),
  // Total tokens per run
  tokensMean: real("tokens_mean").notNull().default(0),
  tokensStdDev: real("tokens_std_dev").notNull().default(0),
  tokensSampleCount: integer("tokens_sample_count").notNull().default(0),
  // Estimated cost per run (USD)
  costMean: real("cost_mean").notNull().default(0),
  costStdDev: real("cost_std_dev").notNull().default(0),
  costSampleCount: integer("cost_sample_count").notNull().default(0),
  // Duration per run (ms)
  durationMean: real("duration_mean").notNull().default(0),
  durationStdDev: real("duration_std_dev").notNull().default(0),
  durationSampleCount: integer("duration_sample_count").notNull().default(0),
  // Error rate (0.0–1.0)
  errorRateMean: real("error_rate_mean").notNull().default(0),
  errorRateStdDev: real("error_rate_std_dev").notNull().default(0),
  errorRateSampleCount: integer("error_rate_sample_count").notNull().default(0),
  // Tool error rate (0.0–1.0) — fraction of tool invocations that errored
  toolErrorRateMean: real("tool_error_rate_mean").notNull().default(0),
  toolErrorRateStdDev: real("tool_error_rate_std_dev").notNull().default(0),
  toolErrorRateSampleCount: integer("tool_error_rate_sample_count").notNull().default(0),
  computedAt: text("computed_at").notNull(),
  windowDays: integer("window_days").notNull().default(7),
  /** Sensitivity threshold in σ (1, 2, or 3). Default 3. */
  sensitivity: integer("sensitivity").notNull().default(3),
});

export type AgentBaselineRow = typeof agentBaselines.$inferSelect;
export type NewAgentBaselineRow = typeof agentBaselines.$inferInsert;
// ─── Agent Anomalies (Phase 2 — Anomaly Scoring) ──────────────────────────────────────

/**
 * Each row is a single metric deviation >3σ from the stored baseline for a
 * given (agentId, taskId) pair.
 *
 * Created by scoreEventAgainstBaseline() in anomalyDetector.ts.
 * Queried by GET /api/activity/alerts.
 *
 * severity:
 *   "warning"  → |Z| ≥ 3σ
 *   "critical" → |Z| ≥ 5σ
 */
export const agentAnomalies = sqliteTable("agent_anomalies", {
  /** UUID primary key */
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  taskId: text("task_id").notNull(),
  taskName: text("task_name").notNull().default(""),
  /** FK to activity_events.id */
  eventId: text("event_id").notNull(),
  /** ISO timestamp of the triggering event */
  eventTimestamp: text("event_timestamp").notNull(),
  /** "totalTokens" | "costUsd" | "durationMs" | "errorRate" */
  metric: text("metric").notNull(),
  observedValue: real("observed_value").notNull(),
  baselineMean: real("baseline_mean").notNull(),
  baselineStdDev: real("baseline_std_dev").notNull(),
  zScore: real("z_score").notNull(),
  /** "warning" | "critical" */
  severity: text("severity").notNull().default("warning"),
  explanation: text("explanation").notNull().default(""),
  /** 0 = active, 1 = dismissed */
  dismissed: integer("dismissed").notNull().default(0),
  detectedAt: text("detected_at").notNull(),
});

export type AgentAnomalyRow = typeof agentAnomalies.$inferSelect;
export type NewAgentAnomalyRow = typeof agentAnomalies.$inferInsert;

// ─── Type exports ────────────────────────────────────────────────────────────

export type ContactRow = typeof contacts.$inferSelect;
export type NewContactRow = typeof contacts.$inferInsert;
export type InteractionRow = typeof interactions.$inferSelect;
export type NewInteractionRow = typeof interactions.$inferInsert;

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
export type SharedArtifactRow = typeof sharedArtifacts.$inferSelect;
export type NewSharedArtifactRow = typeof sharedArtifacts.$inferInsert;

// ─── Orchestrations ───────────────────────────────────────────────────────────

/**
 * Persists orchestration graph definitions for the Visual Swarm Orchestrator.
 * Each row stores the full graph JSON plus execution metadata.
 * Phase 1 of the Visual Swarm Orchestrator feature.
 */
export const orchestrations = sqliteTable("orchestrations", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** JSON-serialized OrchestrationGraph (nodes + edges) */
  graphJson: text("graph_json").notNull().default('{"nodes":[],"edges":[]}'),
  /** "idle" | "running" | "paused" */
  status: text("status").notNull().default("idle"),
  runCount: integer("run_count").notNull().default(0),
  lastRunAt: text("last_run_at"),
  /** "success" | "error" | "partial" | "cancelled" */
  lastRunStatus: text("last_run_status"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type OrchestrationRow = typeof orchestrations.$inferSelect;
export type NewOrchestrationRow = typeof orchestrations.$inferInsert;
