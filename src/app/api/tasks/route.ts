import { NextResponse, type NextRequest } from "next/server";
import { readTasks, writeTasks, ensureTaskStateDir, removeTaskStateDir } from "@/features/tasks/lib/taskStore";
import { isSidecarConfigured, sidecarGet, sidecarMutate } from "@/lib/workspace/sidecar";
import { handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as tasksRepo from "@/lib/database/repositories/tasksRepo";
import type { StudioTask, UpdateTaskPayload } from "@/features/tasks/types";

export const runtime = "nodejs";

// ─── GET /api/tasks?agentId=<id> ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get("agentId")?.trim();
    if (!agentId) {
      return NextResponse.json({ error: "agentId query parameter is required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarGet("/tasks", { agentId });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // DB path
    const db = getDb();
    let tasks = tasksRepo.listByAgent(db, agentId);

    // Auto-import from tasks.json if DB is empty
    if (tasks.length === 0) {
      const fileTasks = readTasks(agentId);
      if (fileTasks.length > 0) {
        tasksRepo.importFromArray(db, fileTasks);
        tasks = tasksRepo.listByAgent(db, agentId);
      }
    }

    return NextResponse.json({ tasks });
  } catch (err) {
    return handleApiError(err, "tasks");
  }
}

// ─── POST /api/tasks — Create a task (metadata only; cron is created client-side) ─

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { task } = body as { task?: StudioTask };
    if (!task?.id || !task?.agentId) {
      return NextResponse.json({ error: "task.id and task.agentId are required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarMutate("/tasks", "POST", { task });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // DB path
    const db = getDb();
    tasksRepo.upsert(db, task);
    ensureTaskStateDir(task.agentId, task.id);

    // Sync to tasks.json for backward compat with cron agent reads
    const allTasks = tasksRepo.listByAgent(db, task.agentId);
    writeTasks(task.agentId, allTasks);

    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err, "tasks");
  }
}

// ─── PATCH /api/tasks — Update a task ────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { agentId, taskId, patch } = body as {
      agentId?: string;
      taskId?: string;
      patch?: UpdateTaskPayload;
    };
    if (!agentId || !taskId || !patch) {
      return NextResponse.json({ error: "agentId, taskId, and patch are required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarMutate("/tasks", "PATCH", { agentId, taskId, patch });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // DB path
    const db = getDb();
    const found = tasksRepo.update(db, taskId, patch);
    if (!found) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const updated = tasksRepo.getById(db, taskId);

    // Sync to tasks.json
    const allTasks = tasksRepo.listByAgent(db, agentId);
    writeTasks(agentId, allTasks);

    return NextResponse.json({ task: updated });
  } catch (err) {
    return handleApiError(err, "tasks");
  }
}

// ─── DELETE /api/tasks — Delete a task (metadata only; cron removed client-side) ─

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { agentId, taskId } = body as { agentId?: string; taskId?: string };
    if (!agentId || !taskId) {
      return NextResponse.json({ error: "agentId and taskId are required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarMutate("/tasks", "DELETE", { agentId, taskId });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // DB path
    const db = getDb();
    tasksRepo.remove(db, taskId);
    removeTaskStateDir(agentId, taskId);

    // Sync to tasks.json
    const allTasks = tasksRepo.listByAgent(db, agentId);
    writeTasks(agentId, allTasks);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "tasks");
  }
}
