import { eq, desc } from "drizzle-orm";
import { orchestrations } from "../schema";
import type { StudioDb } from "../index";
import type { Orchestration, OrchestrationGraph } from "@/features/orchestrator/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToOrchestration(row: typeof orchestrations.$inferSelect): Orchestration {
  let graph: OrchestrationGraph = { nodes: [], edges: [] };
  try {
    graph = JSON.parse(row.graphJson) as OrchestrationGraph;
  } catch {
    // Malformed JSON — return empty graph
  }

  return {
    id: row.id,
    agentId: row.agentId,
    name: row.name,
    description: row.description || undefined,
    graph,
    status: row.status as Orchestration["status"],
    runCount: row.runCount,
    lastRunAt: row.lastRunAt ?? undefined,
    lastRunStatus: (row.lastRunStatus as Orchestration["lastRunStatus"]) ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

/** List all orchestrations for an agent, ordered by most recently updated. */
export function listByAgent(db: StudioDb, agentId: string): Orchestration[] {
  const rows = db
    .select()
    .from(orchestrations)
    .where(eq(orchestrations.agentId, agentId))
    .orderBy(desc(orchestrations.updatedAt))
    .all();

  return rows.map(rowToOrchestration);
}

/** Get a single orchestration by ID. Returns null if not found. */
export function getById(db: StudioDb, id: string): Orchestration | null {
  const row = db
    .select()
    .from(orchestrations)
    .where(eq(orchestrations.id, id))
    .get();

  return row ? rowToOrchestration(row) : null;
}

/** Insert or replace an orchestration. Uses `id` as conflict key. */
export function upsert(db: StudioDb, orchestration: Orchestration): void {
  const now = new Date().toISOString();
  db.insert(orchestrations)
    .values({
      id: orchestration.id,
      agentId: orchestration.agentId,
      name: orchestration.name,
      description: orchestration.description ?? "",
      graphJson: JSON.stringify(orchestration.graph),
      status: orchestration.status,
      runCount: orchestration.runCount,
      lastRunAt: orchestration.lastRunAt ?? null,
      lastRunStatus: orchestration.lastRunStatus ?? null,
      createdAt: orchestration.createdAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: orchestrations.id,
      set: {
        agentId: orchestration.agentId,
        name: orchestration.name,
        description: orchestration.description ?? "",
        graphJson: JSON.stringify(orchestration.graph),
        status: orchestration.status,
        runCount: orchestration.runCount,
        lastRunAt: orchestration.lastRunAt ?? null,
        lastRunStatus: orchestration.lastRunStatus ?? null,
        updatedAt: now,
      },
    })
    .run();
}

/** Apply a partial update to an orchestration. Returns the updated record. */
export function patch(
  db: StudioDb,
  id: string,
  updates: Partial<Pick<Orchestration, "name" | "description" | "graph" | "status" | "lastRunAt" | "lastRunStatus" | "runCount">>,
): Orchestration | null {
  const now = new Date().toISOString();

  const set: Partial<typeof orchestrations.$inferInsert> = { updatedAt: now };
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.description !== undefined) set.description = updates.description ?? "";
  if (updates.graph !== undefined) set.graphJson = JSON.stringify(updates.graph);
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.lastRunAt !== undefined) set.lastRunAt = updates.lastRunAt ?? null;
  if (updates.lastRunStatus !== undefined) set.lastRunStatus = updates.lastRunStatus ?? null;
  if (updates.runCount !== undefined) set.runCount = updates.runCount;

  db.update(orchestrations).set(set).where(eq(orchestrations.id, id)).run();

  return getById(db, id);
}

/** Delete an orchestration by ID. */
export function deleteById(db: StudioDb, id: string): void {
  db.delete(orchestrations).where(eq(orchestrations.id, id)).run();
}
