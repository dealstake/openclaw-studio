import { eq, desc, and, sql } from "drizzle-orm";
import { activityEvents } from "../schema";
import type { StudioDb } from "../index";
import type { ActivityEvent, ActivityMeta } from "@/features/activity/lib/activityTypes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToEvent(row: typeof activityEvents.$inferSelect): ActivityEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    taskName: row.taskName,
    taskId: row.taskId,
    projectSlug: row.projectSlug ?? null,
    projectName: row.projectName ?? null,
    status: row.status as ActivityEvent["status"],
    summary: row.summary,
    meta: row.metaJson ? (JSON.parse(row.metaJson) as ActivityMeta) : {},
    sessionKey: row.sessionKey ?? null,
    transcriptJson: row.transcriptJson ?? null,
    tokensIn: row.tokensIn ?? null,
    tokensOut: row.tokensOut ?? null,
    model: row.model ?? null,
    agentId: row.agentId ?? null,
  };
}

// ─── Repository ──────────────────────────────────────────────────────────────

export interface ActivityQueryFilters {
  type?: string | null;
  taskId?: string | null;
  projectSlug?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
  includeTranscript?: boolean;
}

/** Query activity events with optional filters, paginated. */
export function query(
  db: StudioDb,
  filters: ActivityQueryFilters = {},
): { events: ActivityEvent[]; total: number } {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;
  const includeTranscript = filters.includeTranscript ?? false;

  // Build WHERE conditions
  const conditions = [];
  if (filters.type) conditions.push(eq(activityEvents.type, filters.type));
  if (filters.taskId) conditions.push(eq(activityEvents.taskId, filters.taskId));
  if (filters.projectSlug) conditions.push(eq(activityEvents.projectSlug, filters.projectSlug));
  if (filters.status) conditions.push(eq(activityEvents.status, filters.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(activityEvents)
    .where(where)
    .get();
  const total = countResult?.count ?? 0;

  // Get paginated results
  const rows = db
    .select()
    .from(activityEvents)
    .where(where)
    .orderBy(desc(activityEvents.timestamp))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    events: rows.map((r) => {
      const event = rowToEvent(r);
      // Strip transcript by default (can be large)
      if (!includeTranscript) {
        event.transcriptJson = null;
      }
      return event;
    }),
    total,
  };
}

/** Insert a single activity event. */
export function insert(db: StudioDb, event: ActivityEvent): void {
  db.insert(activityEvents)
    .values({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      taskName: event.taskName,
      taskId: event.taskId,
      projectSlug: event.projectSlug,
      projectName: event.projectName,
      status: event.status,
      summary: event.summary,
      metaJson: Object.keys(event.meta).length > 0 ? JSON.stringify(event.meta) : null,
      sessionKey: event.sessionKey ?? null,
      transcriptJson: event.transcriptJson ?? null,
      tokensIn: event.tokensIn ?? null,
      tokensOut: event.tokensOut ?? null,
      model: event.model ?? null,
      agentId: event.agentId ?? null,
    })
    .onConflictDoNothing()
    .run();
}

/** Import events from JSONL content string. Idempotent (skips existing IDs). */
export function importFromJsonl(db: StudioDb, jsonlContent: string): number {
  const lines = jsonlContent.split("\n").filter((l) => l.trim());
  let imported = 0;

  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as ActivityEvent;
      if (!raw.id || !raw.timestamp || !raw.status) continue;
      insert(db, {
        id: raw.id,
        timestamp: raw.timestamp,
        type: raw.type ?? "unknown",
        taskName: raw.taskName ?? "",
        taskId: raw.taskId ?? "",
        projectSlug: raw.projectSlug ?? null,
        projectName: raw.projectName ?? null,
        status: raw.status,
        summary: raw.summary ?? "",
        meta: raw.meta ?? {},
      });
      imported++;
    } catch {
      // Skip malformed lines
    }
  }

  return imported;
}
