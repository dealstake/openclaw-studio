import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/database";
import { taskState } from "@/lib/database/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/task-state?taskId=<id>
 * Returns the state JSON for a task.
 */
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { error: "taskId query parameter required" },
      { status: 400 },
    );
  }

  const db = getDb();
  const rows = db
    .select()
    .from(taskState)
    .where(eq(taskState.taskId, taskId))
    .all();

  if (rows.length === 0) {
    return NextResponse.json({ taskId, state: null });
  }

  const row = rows[0];
  return NextResponse.json({
    taskId: row.taskId,
    state: JSON.parse(row.stateJson),
    updatedAt: row.updatedAt,
  });
}

/**
 * PUT /api/task-state
 * Body: { taskId: string, state: object }
 * Upserts the task state.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { taskId, state } = body;

  if (!taskId || state === undefined) {
    return NextResponse.json(
      { error: "taskId and state required" },
      { status: 400 },
    );
  }

  const db = getDb();
  const stateJson = JSON.stringify(state);
  const now = new Date().toISOString();

  db.insert(taskState)
    .values({ taskId, stateJson, updatedAt: now })
    .onConflictDoUpdate({
      target: taskState.taskId,
      set: { stateJson, updatedAt: now },
    })
    .run();

  return NextResponse.json({ ok: true, taskId });
}
