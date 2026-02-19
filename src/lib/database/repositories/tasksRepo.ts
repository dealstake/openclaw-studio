import { eq } from "drizzle-orm";
import { tasks } from "../schema";
import type { StudioDb } from "../index";
import type { StudioTask, TaskSchedule } from "@/features/tasks/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToTask(row: typeof tasks.$inferSelect): StudioTask {
  return {
    id: row.id,
    cronJobId: row.cronJobId ?? "",
    agentId: row.agentId,
    name: row.name,
    description: row.description,
    type: row.type as StudioTask["type"],
    schedule: row.scheduleJson ? (JSON.parse(row.scheduleJson) as TaskSchedule) : { type: "periodic", intervalMs: 300_000 },
    prompt: row.prompt,
    model: row.model,
    deliveryChannel: row.deliveryChannel ?? null,
    deliveryTarget: row.deliveryTarget ?? null,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt ?? null,
    lastRunStatus: (row.lastRunStatus as StudioTask["lastRunStatus"]) ?? null,
    runCount: row.runCount,
  };
}

// ─── Repository ──────────────────────────────────────────────────────────────

/** List all tasks for an agent. */
export function listByAgent(db: StudioDb, agentId: string): StudioTask[] {
  const rows = db
    .select()
    .from(tasks)
    .where(eq(tasks.agentId, agentId))
    .all();

  return rows.map(rowToTask);
}

/** Get a single task by ID. */
export function getById(db: StudioDb, id: string): StudioTask | null {
  const row = db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .get();

  return row ? rowToTask(row) : null;
}

/** Insert or update a task. Uses `id` as conflict key. */
export function upsert(db: StudioDb, task: StudioTask): void {
  const now = new Date().toISOString();

  db.insert(tasks)
    .values({
      id: task.id,
      cronJobId: task.cronJobId || null,
      agentId: task.agentId,
      name: task.name,
      description: task.description,
      type: task.type,
      scheduleJson: JSON.stringify(task.schedule),
      prompt: task.prompt,
      model: task.model,
      deliveryChannel: task.deliveryChannel,
      deliveryTarget: task.deliveryTarget,
      enabled: task.enabled,
      createdAt: task.createdAt || now,
      updatedAt: now,
      lastRunAt: task.lastRunAt,
      lastRunStatus: task.lastRunStatus,
      runCount: task.runCount,
    })
    .onConflictDoUpdate({
      target: tasks.id,
      set: {
        cronJobId: task.cronJobId || null,
        name: task.name,
        description: task.description,
        type: task.type,
        scheduleJson: JSON.stringify(task.schedule),
        prompt: task.prompt,
        model: task.model,
        deliveryChannel: task.deliveryChannel,
        deliveryTarget: task.deliveryTarget,
        enabled: task.enabled,
        updatedAt: now,
        lastRunAt: task.lastRunAt,
        lastRunStatus: task.lastRunStatus,
        runCount: task.runCount,
      },
    })
    .run();
}

/** Update specific fields on a task. Returns true if found. */
export function update(
  db: StudioDb,
  id: string,
  patch: Partial<Pick<StudioTask, "name" | "description" | "schedule" | "prompt" | "model" | "enabled" | "deliveryChannel" | "deliveryTarget" | "lastRunAt" | "lastRunStatus" | "runCount">>,
): boolean {
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.schedule !== undefined) set.scheduleJson = JSON.stringify(patch.schedule);
  if (patch.prompt !== undefined) set.prompt = patch.prompt;
  if (patch.model !== undefined) set.model = patch.model;
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  if (patch.deliveryChannel !== undefined) set.deliveryChannel = patch.deliveryChannel;
  if (patch.deliveryTarget !== undefined) set.deliveryTarget = patch.deliveryTarget;
  if (patch.lastRunAt !== undefined) set.lastRunAt = patch.lastRunAt;
  if (patch.lastRunStatus !== undefined) set.lastRunStatus = patch.lastRunStatus;
  if (patch.runCount !== undefined) set.runCount = patch.runCount;

  const result = db
    .update(tasks)
    .set(set)
    .where(eq(tasks.id, id))
    .run();

  return result.changes > 0;
}

/** Remove a task by ID. Returns true if found. */
export function remove(db: StudioDb, id: string): boolean {
  const result = db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .run();

  return result.changes > 0;
}

/** Import tasks from an array (e.g., parsed from tasks.json). Idempotent. */
export function importFromArray(db: StudioDb, taskList: StudioTask[]): void {
  for (const task of taskList) {
    upsert(db, task);
  }
}
