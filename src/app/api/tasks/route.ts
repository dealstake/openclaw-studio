import { NextResponse, type NextRequest } from "next/server";

import { readTasks, writeTasks, ensureTaskStateDir, removeTaskStateDir } from "@/features/tasks/lib/taskStore";
import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { getDb } from "@/lib/database";
import * as tasksRepo from "@/lib/database/repositories/tasksRepo";
import type { StudioTask, UpdateTaskPayload } from "@/features/tasks/types";

export const runtime = "nodejs";

// ─── GET /api/tasks?agentId=<id> ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const validation = validateAgentId(request.nextUrl.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const result = await withSidecarGetFallback("/tasks", { agentId }, () => {
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

      return { tasks };
    });

    // Add cache headers — tasks change infrequently and the 3-min poll cycle
    // handles freshness. This avoids redundant sidecar round-trips on Cloud Run.
    result.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return result;
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

    return await withSidecarMutateFallback("/tasks", "POST", { task }, () => {
      const db = getDb();
      tasksRepo.upsert(db, task);
      ensureTaskStateDir(task.agentId, task.id);

      // Sync to tasks.json for backward compat with cron agent reads
      const allTasks = tasksRepo.listByAgent(db, task.agentId);
      writeTasks(task.agentId, allTasks);

      return { task };
    });
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

    return await withSidecarMutateFallback("/tasks", "PATCH", { agentId, taskId, patch }, () => {
      const db = getDb();
      const found = tasksRepo.update(db, taskId, patch);
      if (!found) {
        throw new Error("Task not found.");
      }

      const updated = tasksRepo.getById(db, taskId);

      // Sync to tasks.json
      const allTasks = tasksRepo.listByAgent(db, agentId);
      writeTasks(agentId, allTasks);

      return { task: updated };
    });
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

    return await withSidecarMutateFallback("/tasks", "DELETE", { agentId, taskId }, () => {
      const db = getDb();
      tasksRepo.remove(db, taskId);
      removeTaskStateDir(agentId, taskId);

      // Sync to tasks.json
      const allTasks = tasksRepo.listByAgent(db, agentId);
      writeTasks(agentId, allTasks);

      return { ok: true };
    });
  } catch (err) {
    return handleApiError(err, "tasks");
  }
}
